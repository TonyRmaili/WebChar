# Run from backend/:
#   py -m app.data_cleaning.data_cleaner                    every category
#   py -m app.data_cleaning.data_cleaner backgrounds
#   py -m app.data_cleaning.data_cleaner races --show "Elf|XPHB"
#   py -m app.data_cleaning.data_cleaner backgrounds --show "Acolyte|XPHB"   print one result
"""Stage 4 of the data pipeline: the code cleaners (no LLM).

Reads resolved/<category>.json, cleans every entry and writes
cleaned/<category>.json (big categories: one file per book,
cleaned/spells/xphb.json, see data_files.py). It's free and fast, so it always cleans
everything; only the paid LLM step will need to skip unchanged entries.

The report (printed, and saved to cleaned/_report.json) groups problems by
kind, e.g. "feats: can't read …  ×3", with the entries each one came from,
so a new 5etools quirk shows up as one line instead of 40.
An entry whose result fails the schema is left out and listed.
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

from .cleaners.backgrounds_cleaner import clean_background
from .cleaners.classes_cleaner import clean_class_book
from .cleaners.feats_cleaner import clean_feat
from .cleaners.items_cleaner import clean_base_item, clean_group, clean_item, clean_variant
from .cleaners.monsters_cleaner import clean_monster
from .cleaners.optionalfeatures_cleaner import clean_optionalfeature
from .cleaners.races_cleaner import clean_race
from .cleaners.reference_cleaner import REFERENCE_CLEANERS
from .cleaners.spells_cleaner import clean_spell
from .data_files import book_files, exists, load_json, read_entries, read_list, write_list

HERE = Path(__file__).resolve().parent
RESOLVED_PATH = HERE / "resolved"
CLEANED_PATH = HERE / "cleaned"

# category -> (list key in the resolved file, cleaner)
CLEANERS = {
    "backgrounds": ("background", clean_background),
    "races": ("race", clean_race),
    "feats": ("feat", clean_feat),
    "optionalfeatures": ("optionalfeature", clean_optionalfeature),
    "spells": ("spell", clean_spell),
    # several lists in one category: (list, cleaner) pairs
    "items": [("baseitem", clean_base_item), ("item", clean_item), ("magicvariant", clean_variant),
              ("itemGroup", clean_group)],
    # one file per class: the class and its subclasses together (see classes_cleaner)
    "classes": "books",
    "monsters": ("monster", clean_monster),     # one file per book
    # The reference catalogues (Rules, Lore, Toolkit tabs): text only.
    **REFERENCE_CLEANERS,
}


def save(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    os.replace(tmp, path)


def kind_of(problem: str) -> str:
    """Group similar problems: drop the quoted/specific parts."""
    return re.sub(r"'[^']*'|\{.*\}|\[.*\]|=.*", "…", problem)


def clean_category(name: str) -> dict:
    if not exists(RESOLVED_PATH, name):
        return {"status": "error", "error": f"resolved/{name} missing: run the resolver first"}
    if CLEANERS[name] == "books":
        return clean_books(name)
    pairs = CLEANERS[name] if isinstance(CLEANERS[name], list) else [CLEANERS[name]]
    work = [(e, cleaner) for list_key, cleaner in pairs for e in read_entries(RESOLVED_PATH, name, list_key)]
    entries = [e for e, _ in work]

    cleaned, left_out = [], []
    by_kind: dict[str, list] = defaultdict(list)
    per_entry = {}
    for e, cleaner in work:
        label = f"{e.get('name')} ({e.get('source')})"
        result, problems = cleaner(e)
        if result is None:
            left_out.append(label)
        else:
            if e.get("_book"):
                result["_book"] = e["_book"]       # which book file it goes back to
            cleaned.append(result)
        if problems:
            per_entry[label] = problems
            for p in problems:
                by_kind[kind_of(p)].append(label)

    write_list(CLEANED_PATH, name, cleaned)
    return {
        "status": "ok",
        "in": len(entries),
        "out": len(cleaned),
        "left_out": left_out,
        "problem_kinds": {k: {"count": len(v), "entries": v} for k, v in sorted(by_kind.items(), key=lambda kv: -len(kv[1]))},
        "problems": per_entry,
    }


def clean_books(name: str) -> dict:
    """Classes: each resolved file is one class with its subclasses and
    features, cleaned together (one class -> one class record plus its
    subclass records)."""
    cleaned, left_out, n_in = [], [], 0
    by_kind: dict[str, list] = defaultdict(list)
    per_entry = {}
    for path in book_files(RESOLVED_PATH, name):
        book = load_json(path)
        n_in += len(book.get("class", [])) + len(book.get("subclass", []))
        records, problems = clean_class_book(book)
        for r in records:
            r["_book"] = path.stem
            cleaned.append(r)
        for label, probs in problems.items():
            if probs:
                per_entry[label] = probs
                for p in probs:
                    by_kind[kind_of(p)].append(label)
        left_out += [lbl for lbl, probs in problems.items() if any(p.startswith("schema:") for p in probs)]
    write_list(CLEANED_PATH, name, cleaned)
    return {
        "status": "ok",
        "in": n_in,
        "out": len(cleaned),
        "left_out": left_out,
        "problem_kinds": {k: {"count": len(v), "entries": v} for k, v in sorted(by_kind.items(), key=lambda kv: -len(kv[1]))},
        "problems": per_entry,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Run the code cleaners.")
    ap.add_argument("categories", nargs="*", help=f"default: all ({', '.join(CLEANERS)})")
    ap.add_argument("--show", help='print the cleaned result of one entry, e.g. "Acolyte|XPHB"')
    args = ap.parse_args()

    names = args.categories or list(CLEANERS)
    unknown = [n for n in names if n not in CLEANERS]
    if unknown:
        print(f"Unknown: {', '.join(unknown)}. Known: {', '.join(CLEANERS)}")
        return 1

    report_path = CLEANED_PATH / "_report.json"
    report = {}
    if report_path.is_file():
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass

    ok = True
    print()
    for name in names:
        r = clean_category(name)
        report[name] = r
        if r["status"] == "error":
            ok = False
            print(f"  {name:<12} ERROR  {r['error']}")
            continue
        print(f"  {name:<12} {r['out']}/{r['in']} cleaned" + (f" · {len(r['left_out'])} left out" if r["left_out"] else ""))
        for kind, info in r["problem_kinds"].items():
            sample = ", ".join(info["entries"][:3]) + (" …" if len(info["entries"]) > 3 else "")
            print(f"  {'':<12} ×{info['count']:<3} {kind}   ({sample})")
        for label in r["left_out"]:
            print(f"  {'':<12} left out: {label}")

    save(report_path, report)
    print(f"\nWritten to {CLEANED_PATH} · details in cleaned/_report.json\n")

    if args.show:
        name, _, source = args.show.partition("|")
        for cat in names:
            for e in read_list(CLEANED_PATH, cat):
                names = [e["name"].lower()] + [a.lower() for a in e.get("aliases") or []]
                if name.lower() in names and (not source or e["source"].lower() == source.lower()):
                    print(json.dumps({k: v for k, v in e.items() if k != "_book"}, indent=2, ensure_ascii=False))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
