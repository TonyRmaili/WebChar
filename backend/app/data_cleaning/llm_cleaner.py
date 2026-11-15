# Run from backend/:
#   py -m app.data_cleaning.llm_cleaner status                         what's done / waiting, per category
#   py -m app.data_cleaning.llm_cleaner run races --srd --max-tokens 500000
#   py -m app.data_cleaning.llm_cleaner run backgrounds --only "Acolyte|PHB" --only "Acolyte|XPHB"
#   py -m app.data_cleaning.llm_cleaner run races --limit 10 --dry-run   show what would be sent, no cost
#   py -m app.data_cleaning.llm_cleaner run races --only "Dragonborn|PHB" --no-subraces
#   py -m app.data_cleaning.llm_cleaner run spells --only "Fireball|XPHB" --reasoning low
#   py -m app.data_cleaning.llm_cleaner run spells --only "Alter Self|XPHB" --redo --reasoning medium   redo a finished one
#   py -m app.data_cleaning.llm_cleaner run spells --srd --source XPHB --reasoning low   SRD spells of one book
"""Stage 5 of the data pipeline: the LLM step, one entry at a time.

Each job is one entry (a background, a race, or one subrace). The LLM gets
that entry's text, already cleaned by code (text_renderer.py), and returns
only the features and the grants the text gives (schemas/llm_schema.py). Answers are kept in
llm/<category>.json, so nothing is paid for twice.

A job is "waiting" when it has no answer yet, or when its input changed
since the answer was made (new 5etools data). Changing the prompt does NOT
make old answers wait again; `status` shows how many were made with an
older prompt, and you decide whether to redo them (--redo-old-prompt).

Use it from your own loop (e.g. for the free daily tokens):

    from app.data_cleaning.llm_cleaner import jobs_for, clean_job
    for job in jobs_for("races", srd_only=True, waiting_only=True):
        result = clean_job(job)          # one LLM call (two if it retries)
        used += result["tokens"]
        if used > my_budget: break

`clean_job` works on one entry, so the Catalogue import button can use it too.
"""

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from app.open_ai_api import LLMError, OpenAIApi

from .cleaners.common_cleaner import display_name, edition_of, entry_id
from .cleaners.feats_cleaner import option_id
from .cleaners.races_cleaner import subrace_id
from .data_files import LLM_PATH, RESOLVED_PATH, book_files, exists, load_json, read_cache, read_entries, save_cache_record
from .formula import extra_words
from .schemas.llm_schema import ClassAnswerLLM, FeaturesLLM, check_class_answer, check_features, class_to_final, to_final
from .text_renderer import kept_entries, render
from .spell_checks import spell_expectations, check_spell

HERE = Path(__file__).resolve().parent
PROMPTS_PATH = HERE / "prompts"

# category -> the list in the resolved file
CATEGORIES = {"backgrounds": "background", "races": "race", "feats": "feat", "optionalfeatures": "optionalfeature",
              "spells": "spell", "items": ["item", "baseitem", "magicvariant"],
              # classes: one job per class feature and one per subclass (cleaners/classes_cleaner.class_jobs)
              "classes": "class"}
# the `kind` the LLM sees, when it differs from the list name
KINDS = {"optionalfeatures": "optional_feature", "item": "item", "baseitem": "base_item",
         "magicvariant": "item_variant"}


def lists_of(category: str) -> list[str]:
    v = CATEGORIES[category]
    return v if isinstance(v, list) else [v]
REASONING = "medium"     # override per run with --reasoning low|medium|high


# ---------- prompt ----------

def instructions(category: str) -> str:
    """The prompt for one category, joined from three files in prompts/:
    common_prompt.md (rules every category shares), <category>_prompt.md
    (rules only this category needs) and <category>_examples.json (its
    worked examples). A category never pays for another category's rules."""
    parts = [
        (PROMPTS_PATH / "common_prompt.md").read_text(encoding="utf-8").rstrip(),
        "---",
        (PROMPTS_PATH / f"{category}_prompt.md").read_text(encoding="utf-8").rstrip(),
        "---",
        "## Examples",
    ]
    examples = json.loads((PROMPTS_PATH / f"{category}_examples.json").read_text(encoding="utf-8"))
    for i, ex in enumerate(examples, 1):
        parts.append(
            f"### Example {i}: {ex['input']['name']}\n\n{ex['why']}\n\n"
            f"Input:\n```json\n{json.dumps(ex['input'], ensure_ascii=False)}\n```\n\n"
            f"Output:\n```json\n{json.dumps(ex['output'], ensure_ascii=False)}\n```"
        )
    return "\n\n".join(parts)


def prompt_version(category: str) -> str:
    return _hash(instructions(category))


def _hash(value) -> str:
    text = value if isinstance(value, str) else json.dumps(value, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


# ---------- jobs ----------

def _block_name(node) -> str | None:
    return node.get("name") if isinstance(node, dict) else None


def build_input(entry: dict, kind: str, parent: dict | None = None) -> dict:
    """The source of one job: its raw text blocks and context. Its hash says
    whether the job must be redone (new 5etools data). What is actually sent
    to the LLM is `payload()` of it: the same, with the blocks turned into
    clean text by code. A feat option also gets its feat's text as context
    (`parent_entries`), because the rules shared by all options (a save DC,
    the uses) live there."""
    inp = _base_input(entry, kind, parent)
    if kind == "option" and parent:
        inp["parent_entries"] = kept_entries(parent.get("entries"))
    return inp


def _base_input(entry: dict, kind: str, parent: dict | None = None) -> dict:
    return {
        "name": display_name(entry) or "Standard",
        "kind": kind,
        "edition": entry.get("edition") or (parent or {}).get("edition") or "classic",
        "race": parent["name"] if parent else None,
        "race_blocks": [n for n in (_block_name(e) for e in kept_entries(parent.get("entries"))) if n] if parent else [],
        "entries": kept_entries(entry.get("entries")),
    }


def payload(inp: dict) -> dict:
    """What the LLM gets: the job's input with `entries` (and
    `parent_entries`) rendered to clean text by code, exactly the text the
    cleaned entry has."""
    out = {k: v for k, v in inp.items() if k not in ("entries", "parent_entries")}
    out["text"] = render(inp.get("entries"))
    if "parent_entries" in inp:
        out["parent_text"] = render(inp["parent_entries"])
    return out


def _job(category: str, jid: str, label: str, inp: dict, srd: bool, entry: dict) -> dict:
    return {"category": category, "id": jid, "label": label, "srd": srd, "input": inp, "hash": _hash(inp),
            "send": payload(inp),
            "entry": f"{entry['name']}|{entry['source']}".lower(), "subrace": inp["kind"] in ("subrace", "option"),
            "book": entry.get("_book"), "entry_display": f"{display_name(entry)}|{entry['source']}".lower()}


def item_job(entry: dict, list_key: str) -> dict:
    """One item, base item or variant. A variant's text is what it gives
    its items (`inherits`), with "{base}" where the base item's name goes."""
    from .cleaners.items_cleaner import variant_view
    from .cleaners.items_cleaner import variant_id
    view = variant_view(entry) if list_key == "magicvariant" else entry
    inp = build_input(view, KINDS[list_key])
    jid = variant_id(entry) if list_key == "magicvariant" else entry_id(entry["name"], entry["source"])
    label = f"{display_name(view)} ({entry['source']})"
    srd = bool(view.get("srd") or view.get("srd52"))
    return _job("items", jid, label, inp, srd, entry)


def spell_input(entry: dict) -> dict:
    """A spell also sends its higher-level text (as the last block), its
    level and casting time, and the edition the code cleaner works out."""
    inp = _base_input(entry, "spell")
    inp["edition"] = edition_of(entry, [], "spells") or "classic"
    inp["spell_level"] = entry.get("level", 0)
    inp["casting_time"] = casting_time(entry.get("time"))
    inp["entries"] = inp["entries"] + list(entry.get("entriesHigherLevel") or [])
    return inp


def casting_time(times) -> str:
    """[{"number": 1, "unit": "bonus"}] -> "1 bonus action"."""
    words = {"action": "action", "bonus": "bonus action", "reaction": "reaction", "minute": "minute",
             "hour": "hour", "round": "round"}
    parts = []
    for t in times or []:
        n, unit = t.get("number", 1), words.get(t.get("unit"), str(t.get("unit")))
        part = f"{n} {unit}{'s' if n != 1 and unit in ('minute', 'hour', 'round') else ''}"
        if t.get("condition"):
            part += f", {t['condition']}"
        parts.append(part)
    return " or ".join(parts)


def jobs_from_entry(category: str, entry: dict, list_key: str | None = None) -> list[dict]:
    """The jobs for one resolved entry: the entry itself, plus each subrace
    of a race."""
    if category == "items":
        return [item_job(entry, list_key or "item")]
    kind = KINDS.get(category, CATEGORIES[category])
    jid = entry_id(entry["name"], entry["source"])
    label = f"{display_name(entry)} ({entry['source']})"
    if category == "spells":
        job = _job(category, jid, label, spell_input(entry), bool(entry.get("srd") or entry.get("srd52")), entry)
        job["expect"] = spell_expectations(entry)
        return [job]
    jobs = [_job(category, jid, label, build_input(entry, kind), bool(entry.get("srd") or entry.get("srd52")), entry)]
    if category == "races":
        for sub in entry.get("subraces") or []:
            jobs.append(_job(category, subrace_id(sub, entry),
                             f"{entry['name']} · {sub.get('name') or 'Standard'} ({sub.get('source') or entry['source']})",
                             build_input(sub, "subrace", entry), bool(sub.get("srd") or sub.get("srd52")), entry))
    if category == "feats":
        for opt in entry.get("options") or []:
            jobs.append(_job(category, option_id(opt, entry),
                             f"{entry['name']} · {opt.get('name')} ({opt.get('source') or entry['source']})",
                             build_input(opt, "option", entry), bool(opt.get("srd") or opt.get("srd52")), entry))
    return jobs


def jobs_for(category: str, srd_only: bool = False, waiting_only: bool = True,
             redo_old_prompt: bool = False, retry_failed: bool = False) -> list[dict]:
    """All jobs of a category, each with its `state`:
    new · changed · failed · done · old_prompt · reviewed.
    A record you fixed by hand and marked "reviewed": true is never redone
    (not even with --redo-old-prompt), unless its input text changes."""
    cache = load_cache(category)
    version = prompt_version(category)
    out = []
    for job in _all_jobs(category):
        if srd_only and not job["srd"]:
            continue
        rec = cache.get(job["id"])
        if rec is None:
            job["state"] = "new"
        elif rec["hash"] != job["hash"]:
            job["state"] = "changed"
        elif rec.get("reviewed"):
            job["state"] = "reviewed"   # checked/fixed by hand: never redone unless the input changes
        elif rec["problems"]:
            job["state"] = "failed"
        elif rec["prompt"] != version:
            job["state"] = "old_prompt"
        else:
            job["state"] = "done"
        waiting = job["state"] in ("new", "changed") \
            or (retry_failed and job["state"] == "failed") \
            or (redo_old_prompt and job["state"] == "old_prompt")
        if waiting or not waiting_only:
            out.append(job)
    return out


def _all_jobs(category: str):
    """Every job of a category, in file order (a job's id appears once)."""
    if category == "classes":
        from .cleaners.classes_cleaner import class_jobs
        seen = set()
        for path in book_files(RESOLVED_PATH, category):
            for job in class_jobs(load_json(path)):
                if job["id"] in seen:
                    continue
                seen.add(job["id"])
                job["category"] = category
                job["hash"] = _hash(job["input"])
                yield job
        return
    for entry, list_key in ((e, k) for k in lists_of(category) for e in read_entries(RESOLVED_PATH, category, k)):
        yield from jobs_from_entry(category, entry, list_key)


# ---------- cache ----------

def load_cache(category: str) -> dict:
    """All answers of a category (every book's file, for spells)."""
    return read_cache(category)


def save_record(category: str, jid: str, record: dict, book: str | None = None) -> None:
    """Save one answer right away (safe to stop the run at any moment)."""
    save_cache_record(category, jid, record, book)


# ---------- one job ----------

_api: OpenAIApi | None = None


def _ask(prompt: str, input_text: str, reasoning: str = REASONING, schema=FeaturesLLM):
    global _api
    if _api is None:
        _api = OpenAIApi()
    return _api.parse_model(prompt, input_text, schema, reasoning=reasoning)


def clean_job(job: dict, save: bool = True, reasoning: str = REASONING) -> dict:
    """One entry through the LLM: ask, check, ask once more if the answer
    had problems. Returns the record (also saved to llm/<category>.json)."""
    prompt = instructions(job["category"])
    if not job["send"]["text"].strip():
        # Nothing to read (e.g. a nameless "Standard" subrace that only has
        # ability scores): no LLM call, an empty answer, zero tokens.
        record = {"label": job["label"], "hash": job["hash"], "prompt": _hash(prompt),
                  "output": {"features": [], "extra_grants": {}},
                  "problems": [], "tokens": 0, "tries": 0, "reviewed": False,
                  "at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
        if save:
            save_record(job["category"], job["id"], record, job.get("book"))
        return record
    base = json.dumps(job["send"], ensure_ascii=False, indent=1)
    input_text = base
    record = {"label": job["label"], "hash": job["hash"], "prompt": _hash(prompt), "output": None,
              "problems": [], "tokens": 0, "tries": 0, "reviewed": False, "reasoning": reasoning,
              "at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    for attempt in (1, 2):
        record["tries"] = attempt
        is_class = job["category"] == "classes"
        try:
            answer, tokens = _ask(prompt, input_text, reasoning, ClassAnswerLLM if is_class else FeaturesLLM)
        except LLMError as e:
            record["problems"] = [f"LLM error: {e}"]
            break
        record["tokens"] += tokens
        if is_class:
            # formulas may use the class's table columns ("martial_arts")
            with extra_words(job.get("words", []), job.get("dice", [])):
                record["output"] = class_to_final(answer)
                record["problems"] = check_class_answer(answer, job["send"]["text"], job.get("names", []))
        else:
            record["output"] = to_final(answer)
            record["problems"] = check_features(answer, job["send"]["text"], job["send"]["name"])
        if "expect" in job:      # every spell, also one with nothing to expect (then no per_slot is allowed)
            record["problems"] += check_spell(answer, job["expect"])
        if not record["problems"]:
            break
        input_text = base + "\n\nYour previous answer had these problems. Fix them:\n- " + "\n- ".join(record["problems"])
    if save:
        save_record(job["category"], job["id"], record, job.get("book"))
    return record


# ---------- command line ----------

def status() -> None:
    print()
    for category in CATEGORIES:
        if not exists(RESOLVED_PATH, category):
            print(f"  {category:<12} (not resolved yet)")
            continue
        jobs = jobs_for(category, waiting_only=False)
        cache = load_cache(category)
        for scope, js in (("all", jobs), ("srd", [j for j in jobs if j["srd"]])):
            counts = {}
            for j in js:
                counts[j["state"]] = counts.get(j["state"], 0) + 1
            line = " · ".join(f"{k}: {v}" for k, v in sorted(counts.items()))
            print(f"  {category:<12} {scope:<4} {len(js):>4} jobs  {line}")
        spent = sum(r.get("tokens", 0) for r in cache.values())
        print(f"  {'':<12}      tokens spent so far: {spent:,}")
    print()


def run(args) -> int:
    if args.redo and not args.only:
        print("\n--redo needs --only (it redoes finished answers, so name them)\n")
        return 1
    jobs = jobs_for(args.category, srd_only=args.srd, waiting_only=not args.redo,
                    redo_old_prompt=args.redo_old_prompt, retry_failed=args.retry_failed)
    if args.only:
        # "Elf|XPHB" = that entry (with its subraces); "Elf" = every Elf
        wanted = [w.lower().strip() for w in args.only]
        names = lambda j: (j["entry"], j["entry"].split("|")[0], j["entry_display"], j["entry_display"].split("|")[0])
        jobs = [j for j in jobs if any(w in names(j) for w in wanted)]
    if args.source:
        # "XPHB" = only entries from that book (their subraces/options come along)
        wanted_src = {x.lower() for x in args.source}
        jobs = [j for j in jobs if j["entry"].rsplit("|", 1)[-1] in wanted_src]
    if args.no_subraces:
        jobs = [j for j in jobs if not j["subrace"]]
    if args.limit:
        jobs = jobs[: args.limit]
    print(f"\n{len(jobs)} job(s) waiting" + (f" · stopping at {args.max_tokens:,} tokens" if args.max_tokens else "") + "\n")

    used, bad = 0, 0
    for job in jobs:
        if args.max_tokens and used >= args.max_tokens:
            print(f"\n  token limit reached ({used:,}); the rest waits for the next run")
            break
        if args.dry_run:
            print(f"  ---  {job['label']:<50} {job['state']:<10} {len(json.dumps(job['send'])):>6,} chars")
            continue
        rec = clean_job(job, reasoning=args.reasoning)
        used += rec["tokens"]
        feats = ", ".join(f"{f['name']} [{f['category']}]" for f in (rec["output"] or {}).get("features", [])) or "no features"
        print(f"  {'OK ' if not rec['problems'] else 'BAD'}  {job['label']:<50} {rec['tokens']:>6,} tok  {feats}")
        for p in rec["problems"]:
            print(f"         problem: {p}")
        bad += bool(rec["problems"])
    if not args.dry_run:
        print(f"\n  {used:,} tokens used" + (f" · {bad} with problems (they show as 'failed' in status)" if bad else "") + "\n")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="The LLM step, one entry at a time.")
    sub = ap.add_subparsers(dest="command", required=True)
    sub.add_parser("status", help="what's done and what's waiting")
    r = sub.add_parser("run", help="clean waiting entries")
    r.add_argument("category", choices=list(CATEGORIES))
    r.add_argument("--srd", action="store_true", help="only SRD entries")
    r.add_argument("--only", action="append", help='only this entry and its subraces, e.g. "Elf|XPHB" (can repeat)')
    r.add_argument("--source", action="append", help='only entries from this book, e.g. XPHB (can repeat)')
    r.add_argument("--no-subraces", action="store_true", help="only the entries themselves, not their subraces / feat options")
    r.add_argument("--limit", type=int, help="at most this many jobs")
    r.add_argument("--max-tokens", type=int, help="stop starting new jobs after this many tokens")
    r.add_argument("--retry-failed", action="store_true", help="also redo jobs whose answer had problems")
    r.add_argument("--redo-old-prompt", action="store_true", help="also redo answers made with an older prompt")
    r.add_argument("--redo", action="store_true",
                   help='redo the --only entries whatever their state (done, reviewed…): replaces their answer')
    r.add_argument("--dry-run", action="store_true", help="only list what would be sent")
    r.add_argument("--reasoning", choices=["low", "medium", "high"], default=REASONING,
                   help=f"how hard the model thinks (default {REASONING}); low is cheaper")
    args = ap.parse_args()
    if args.command == "status":
        status()
        return 0
    return run(args)


if __name__ == "__main__":
    sys.exit(main())