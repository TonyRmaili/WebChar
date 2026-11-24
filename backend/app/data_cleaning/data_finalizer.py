# Run from backend/:
#   py -m app.data_cleaning.data_finalizer                  every category
#   py -m app.data_cleaning.data_finalizer races --srd      only SRD entries (the ship set)
"""Stage 6 of the data pipeline: code part + LLM part -> final/<category>.json.

For every cleaned entry (cleaned/) that has a good LLM answer (llm/) for its
current input:
  - `features` come from the LLM answer, `text` from cleaned/ (code-made);
    each feature gets its own part of that text (_feature_texts), so its
    card on the sheet shows only that part;
  - the LLM's extra grants are added to `grants`, minus what code already
    gives (fixed grants, the parent race's grants, and anything listed in a
    choice), so nothing is granted twice.

An entry whose LLM answer is missing, failed or out of date is left out and
counted as "waiting". For a race, the race needs its own answer; each
subrace is kept only once it has its answer (so SRD races can ship with
only their SRD subraces).

With --srd only SRD entries (and SRD subraces) are written: the set that
ships to every user.

Spells are one file per book: final/spells/xphb.json, and with --srd
final/spells_srd/xphb.json.

Monsters have no LLM step (code reads all their numbers), so cleaned/ is
copied to final/monsters/<book>.json as it is.
"""

import argparse
import json
import os
import sys
from pathlib import Path

from .data_files import CLEANED_PATH, FINAL_PATH, is_split, read_list, write_list
from .schemas.common_schema import GROUPS
from .llm_cleaner import CATEGORIES, jobs_for, load_cache

# Categories whose LLM extra_grants are not added: a spell's effects live in
# its features (toggles), not in grants the caster always has.
NO_EXTRA_GRANTS = {"spells"}

LIST_GRANTS = ("skills", "saves", "tools", "languages", "weapons", "armor")


def _choice_ids(choices: list, kind: str) -> set:
    """Ids listed by name in pool choices of `kind` (options included)."""
    found = set()
    for c in choices or []:
        if c.get("type") == "pool" and kind in (c["grant"] if isinstance(c["grant"], list) else [c["grant"]]):
            if isinstance(c.get("from"), list):
                found |= set(c["from"])
        for o in c.get("options", []):
            found |= _choice_ids(o.get("choices", []), kind)
            found |= set((o.get("grants") or {}).get(kind, []))
    return found


def _drop_shared_uses(features: list[dict], parent_features: list[dict]) -> list[dict]:
    """A subrace/option feature that repeats a pool of uses its parent
    already has (Strike of the Giants: PB uses per long rest on the feat)
    would be counted twice; the parent's pool is the real one."""
    parent_uses = [f["uses"] for f in parent_features if f.get("uses")]
    out = []
    for f in features:
        if f.get("uses") and f["uses"] in parent_uses:
            f = {k: v for k, v in f.items() if k != "uses"}
        out.append(f)
    return out


def merge_extra(entry: dict, extra: dict, parent: dict | None = None) -> list[str]:
    """Add the LLM's extra grants that code doesn't already give.
    Returns what was added, for the report."""
    grants = entry.setdefault("grants", {})
    pg = (parent or {}).get("grants", {})
    added = []
    for kind in LIST_GRANTS:
        known = set(grants.get(kind, [])) | set(pg.get(kind, [])) | _choice_ids(entry.get("choices"), kind) \
            | _choice_ids((parent or {}).get("choices"), kind)
        for x in extra.get(kind, []):
            if x not in known:
                grants.setdefault(kind, []).append(x)
                added.append(f"{kind}: {x}")
    for kind in ("senses", "speed"):
        for k, v in (extra.get(kind) or {}).items():
            if k not in grants.get(kind, {}) and k not in pg.get(kind, {}):
                grants.setdefault(kind, {})[k] = v
                added.append(f"{kind}: {k} {v}")
    for k, vals in (extra.get("defenses") or {}).items():
        have = set(grants.get("defenses", {}).get(k, [])) | set(pg.get("defenses", {}).get(k, [])) \
            | _choice_ids(entry.get("choices"), f"defenses.{k}")
        for x in vals:
            if x not in have:
                grants.setdefault("defenses", {}).setdefault(k, []).append(x)
                added.append(f"defenses.{k}: {x}")
    return added


def _feature_texts(e: dict, category: str) -> list[str]:
    """Give each feature its own `text`, cut from the entry's (code-made) text,
    so a feature's card on the sheet shows only its part:
      - a feature named after a **Name.** paragraph (or - **Name.** list
        item): that paragraph, plus the plain paragraphs after it up to the
        next named one (llm_schema.feature_text);
      - a feature named like the entry, alone: the whole text;
      - a feature named like the entry next to features with their own
        paragraphs (Demon Armor): the text none of them takes (the intro).
    Class features already have their own text and spells show the spell's
    card, so neither is touched. Returns the features left without text
    (their name matches nothing in the text), for the report."""
    from .schemas.llm_schema import feature_text, paragraph_names
    text = e.get("text") or ""
    names = paragraph_names(text)
    own = {str(e.get("name", "")).strip().lower()} | {a.lower() for a in e.get("aliases") or []}
    feats = [dict(f) for f in e.get("features") or []]
    e["features"] = feats
    claimed = [f["name"] for f in feats if f["name"].strip().lower() in names]
    lost = []
    for f in feats:
        key = f["name"].strip().lower()
        if key not in names and key not in own:
            lost.append(f"{e['id']}: {f['name']}")
            continue
        if category == "spells" or f.get("text"):
            continue
        if key in names:
            f["text"] = feature_text(text, f["name"])
        else:
            f["text"] = _unclaimed_text(text, claimed) if claimed else text.strip()
        if not f["text"]:
            del f["text"]
            lost.append(f"{e['id']}: {f['name']}")
    return lost


def _drop_twin_modifiers(e: dict) -> list[str]:
    """An item's own `modifiers` (code-made: "+2 to spell attack rolls")
    already count while it's equipped; a feature modifier that says exactly
    the same (the LLM read it from the text too) would count it twice
    (+2 Wand of the War Mage, Robe of the Archmagi). Drops those from the
    features (a switch's modifiers are left alone: they only count while
    on). Returns what was dropped, for the report."""
    own = {json.dumps(m, sort_keys=True) for m in e.get("modifiers") or []}
    if not own:
        return []
    dropped = []
    for f in e.get("features") or []:
        keep = [m for m in f.get("modifiers") or [] if json.dumps(m, sort_keys=True) not in own]
        if len(keep) < len(f.get("modifiers") or []):
            dropped += [f"{e['id']}: {f['name']}: {m['target']}" for m in f["modifiers"] if m not in keep]
            if keep:
                f["modifiers"] = keep
            else:
                del f["modifiers"]
    return dropped


def _unclaimed_text(text: str, claimed: list[str]) -> str:
    """The entry's text without the parts the named features take."""
    from .schemas.llm_schema import feature_text
    for name in claimed:
        part = feature_text(text, name)
        if part:
            text = text.replace(part, "", 1)
    return "\n\n".join(p.strip() for p in text.split("\n\n") if p.strip())


def finalize(category: str, srd_only: bool = False) -> dict:
    cleaned = read_list(CLEANED_PATH, category)
    cache = load_cache(category)
    good = {j["id"] for j in jobs_for(category, waiting_only=False) if j["state"] in ("done", "old_prompt", "reviewed")}

    def answer(jid):
        return cache[jid]["output"] if jid in good else None

    out, waiting, added_report, no_subraces, lost, twins = [], [], {}, [], [], []
    for e in cleaned:
        if srd_only and not e.get("srd"):
            continue
        if e.get("kind") == "item_group":
            out.append(e)          # a group only lists its members: no LLM step
            continue
        a = answer(e["id"])
        if a is None:
            waiting.append(e["id"])
            continue
        e = dict(e)
        e["features"] = a["features"]           # the text is the code-made one from cleaned/
        lost += _feature_texts(e, category)
        twins += _drop_twin_modifiers(e)
        added = [] if category in NO_EXTRA_GRANTS else merge_extra(e, a.get("extra_grants", {}))
        if added:
            added_report[e["id"]] = added
        for child_key in ("subraces", "options"):
            if not e.get(child_key):
                continue
            kids = []
            for s in e[child_key]:
                if srd_only and not s.get("srd"):
                    continue
                sa = answer(s["id"])
                if sa is None:
                    waiting.append(s["id"])
                    continue
                s = dict(s)
                s["features"] = _drop_shared_uses(sa["features"], e.get("features", []))
                lost += _feature_texts(s, category)
                added = merge_extra(s, sa.get("extra_grants", {}), parent=e)
                if added:
                    added_report[s["id"]] = added
                kids.append(s)
            if kids:
                e[child_key] = kids
            else:
                del e[child_key]
                # a subrace / option must be picked, so the entry isn't usable yet
                no_subraces.append(e["id"])
        out.append(e)

    # A group only shows members that are in this file (finished, and SRD
    # for the SRD set); a group with none of them is left out until it has.
    ids = {e["id"] for e in out}
    kept = []
    for e in out:
        if e.get("kind") == "item_group":
            members = [m for m in e.get("members") or [] if m in ids]
            if not members:
                continue
            e = {**e, "members": members}
        kept.append(e)
    out = kept
    files = write_list(FINAL_PATH, category, out, suffix="_srd" if srd_only else "")
    name = f"{category}{'_srd' if srd_only else ''}/ ({len(files)} books)" if is_split(category) else files[0]
    return {"written": name, "features_without_text": lost, "modifiers_counted_twice": twins, "entries": len(out), "waiting": waiting, "no_subraces_yet": no_subraces,
            "grants_added_from_text": added_report}


# ---------- classes ----------

def _pick_choice(p: dict, n: int) -> dict:
    """An LLM pick -> a pool choice (the shared shape)."""
    frm = p["from"][0] if len(p["from"]) == 1 and p["from"][0] in GROUPS else p["from"]
    ch = {"type": "pool", "id": f"{p['grant']}_{n}", "label": p["grant"].replace("_", " ").title(),
          "grant": p["grant"], "count": p.get("count", 1), "from": frm}
    if p.get("at"):
        ch["at"] = p["at"]
    return ch


def _attach(record: dict, answer: dict, job_ids: set, problems: list) -> None:
    """Put one job's answer on the record's features (matched by name within
    the job). A named block inside a feature becomes a feature of its own,
    with that feature as `parent`."""
    from .cleaners.common_cleaner import slug
    from .schemas.llm_schema import feature_text, paragraph_names
    feats = [f for f in record["features"] if _job_of(record, f) in job_ids]
    by_name = {f["name"].lower(): f for f in feats}
    for a in answer.get("features", []):
        target = by_name.get(a["name"].lower())
        if target is None:
            host = next((f for f in feats if a["name"].lower() in paragraph_names(f.get("text") or "")), None)
            if host is None:
                problems.append(f"{record['id']}: the answer's '{a['name']}' is not one of its features")
                continue
            target = {"id": f"{host['id']}:{slug(a['name'])}", "name": a["name"], "level": host["level"],
                      "text": feature_text(host["text"], a["name"]), "parent": host["id"]}
            record["features"].append(target)
            by_name[a["name"].lower()] = target
        for k in ("category", "uses", "action", "toggle", "modifiers"):
            if a.get(k) not in (None, [], {}):
                target[k] = a[k]
        if a.get("consumes") and not target.get("consumes"):     # the data's own cost wins
            target["consumes"] = a["consumes"]
        if a.get("grants"):
            target["grants"] = a["grants"]
        if a.get("picks"):
            target["choices"] = [_pick_choice(p, i + 1) for i, p in enumerate(a["picks"])]


def _job_of(record: dict, feature: dict) -> str:
    """The job that answers a feature: its top feature (class), or the subclass."""
    if record["kind"] == "subclass":
        return record["id"]
    by_id = {f["id"]: f for f in record["features"]}
    f = feature
    while f.get("parent") and f["parent"] in by_id:
        f = by_id[f["parent"]]
    return f["id"]


def _merge_resources(record: dict, answers: list, known_elsewhere: set, problems: list) -> None:
    """Code resources (table numbers, ids from `consumes`) + the LLM's
    (refills, pools only the text describes). Code wins on numbers.
    `answers`: [(level, output)], lowest level first. A later feature that
    changes a pool's refill (Font of Inspiration at 5: Bardic Inspiration
    back on a short rest) makes it a level table: {"1": "long", "5": "short"}."""
    from .cleaners.common_cleaner import resource_id
    res = {r["id"]: r for r in record.get("resources", [])}
    since = {}                              # pool id -> the level its refill was first set
    for lvl, a in answers:
        for r in a.get("resources", []):
            rid = resource_id(r["name"])
            if rid in known_elsewhere and rid not in res:
                continue                    # the class already has it (a subclass mentioning Channel Divinity)
            have = res.setdefault(rid, {"id": rid, "name": r["name"]})
            for k in ("max", "die"):
                if have.get(k) is None and r.get(k) is not None:
                    have[k] = r[k]
            new = r.get("reset")
            old = have.get("reset")
            if new is None:
                pass
            elif isinstance(old, str) and old != new and rid in since and lvl > since[rid]:
                have["reset"] = {str(since[rid]): old, str(lvl): new}
            elif isinstance(old, dict) and old.get(max(old, key=int)) != new:
                have["reset"] = {**old, str(lvl): new}
            elif not isinstance(old, dict):
                have["reset"] = new
                since.setdefault(rid, lvl)
            if r.get("short_rest") is not None:
                have["short_rest"] = r["short_rest"]
    for f in record["features"]:
        # A feature that is its own pool (2024 Second Wind: Tactical Mind spends its
        # uses too) is tracked once, as the resource: using it spends one.
        own = resource_id(f["name"])
        if own in res and f.get("uses"):
            uses = f.pop("uses")
            res[own].setdefault("max", uses.get("max"))        # nothing lost if only the feature had the number
            res[own].setdefault("reset", uses.get("reset"))
            f.setdefault("consumes", {"resource": own, "amount": 1})
        cons = f.get("consumes")
        if cons:
            cons["resource"] = resource_id(cons["resource"])
            if cons["resource"] not in res and cons["resource"] not in known_elsewhere:
                problems.append(f"{f['id']}: consumes '{cons['resource']}', which nothing defines")
    for r in res.values():
        if not r.get("reset"):
            problems.append(f"{record['id']}: resource '{r['id']}' has no refill rule")
    record["resources"] = list(res.values())


def _known_to_prepared(record: dict) -> None:
    """One word for "how many spells": a 2014 known caster (Bard, Ranger,
    Sorcerer, Warlock, Eldritch Knight, Arcane Trickster) keeps its count
    as `prepared` and changes its spells when it gains a level. Nothing
    else changes: every spell it picks is still ready."""
    sc = record.get("spellcasting")
    if not sc or sc.get("known") is None:
        return
    known = sc.pop("known")
    if sc.get("prepared") is None:
        sc["prepared"] = known
    sc.setdefault("change", "level")


def _srd_only(record: dict) -> dict:
    """The SRD part of an SRD class: features without an SRD flag (TCE's
    optional features on a PHB class) are left out."""
    keep = {f["id"] for f in record["features"] if f.get("srd")}
    by_id = {f["id"]: f for f in record["features"]}
    for f in record["features"]:          # features made from an answer follow their parent
        p = f.get("parent")
        while p and p in by_id and p not in keep and not by_id[p].get("srd"):
            p = by_id[p].get("parent")
        if f["id"] not in keep and p in keep:
            keep.add(f["id"])
    record["features"] = [f for f in record["features"] if f["id"] in keep]
    for lvl in record.get("progression", []):
        for k in ("features", "upgrades"):
            if lvl.get(k):
                lvl[k] = [x for x in lvl[k] if x in keep]
    return record


def _drop_features(record: dict, job_ids: set) -> list[str]:
    """Leave out the features (and the blocks made from them) answered by
    `job_ids`, and their ids in the progression rows. Returns their ids."""
    gone = {f["id"] for f in record["features"] if _job_of(record, f) in job_ids}
    record["features"] = [f for f in record["features"] if f["id"] not in gone]
    for lvl in record.get("progression", []):
        for k in ("features", "upgrades"):
            if lvl.get(k):
                lvl[k] = [x for x in lvl[k] if x not in gone]
    return sorted(gone)


def finalize_classes(srd_only: bool = False) -> dict:
    """cleaned/classes/<id>.json -> final/classes/<id>.json (the class) and
    final/subclasses/<id>.json (its subclasses). A class is written once
    every one of its feature jobs it needs has a good answer; a subclass
    once its own job has.

    A class doesn't wait for jobs it can do without, which are left out of
    it until they're answered (listed under "left out"):
      - the optional features another book adds to it (`optional`: TCE's
        Martial Versatility on the PHB Fighter);
      - with --srd, every feature that isn't SRD (they're dropped from the
        SRD set anyway), so the SRD classes need only their SRD jobs run."""
    import copy
    cleaned = read_list(CLEANED_PATH, "classes")
    cache = load_cache("classes")
    jobs = jobs_for("classes", waiting_only=False)
    all_ids = {j["id"] for j in jobs}
    good = {j["id"] for j in jobs if j["state"] in ("done", "old_prompt", "reviewed")}
    classes, subclasses, waiting, problems, left_out = [], [], [], [], []
    class_res = {}
    for e in cleaned:
        if srd_only and not e.get("srd"):
            continue
        e = copy.deepcopy(e)
        needed = {_job_of(e, f) for f in e["features"]} & all_ids
        if e["kind"] == "class":
            by_id = {f["id"]: f for f in e["features"]}
            optional = {j for j in needed if by_id.get(j, {}).get("optional")}
            if srd_only:
                optional |= {j for j in needed if j in by_id and not by_id[j].get("srd")}
            skip = optional - good
            if skip:
                left_out += [f"{e['id']}: {x}" for x in _drop_features(e, skip)]
                needed -= skip
        missing = needed - good
        if missing:
            waiting.append(f"{e['id']} ({len(missing)} job(s))")
            continue
        # each answer with its feature's level, lowest first (a later feature
        # can change a pool's refill from its level on: _merge_resources)
        level_of = {f["id"]: f.get("level") or 1 for f in e["features"]}
        answers = [(level_of.get(j, 1), cache[j]["output"]) for j in sorted(needed, key=lambda j: (level_of.get(j, 1), j))]
        for j in sorted(needed):
            _attach(e, cache[j]["output"], {j}, problems)
        for f in e["features"]:
            f.setdefault("category", "traits")
        known = class_res.get(e.get("class_id"), set()) if e["kind"] == "subclass" else set()
        _merge_resources(e, answers, known, problems)
        if e["kind"] == "class":
            class_res[e["id"]] = {r["id"] for r in e["resources"]}
        _known_to_prepared(e)
        if srd_only:
            e = _srd_only(e)
        (classes if e["kind"] == "class" else subclasses).append(e)
    suffix = "_srd" if srd_only else ""
    write_list(FINAL_PATH, "classes", classes, suffix=suffix)
    write_list(FINAL_PATH, "subclasses", subclasses, suffix=suffix)
    return {"written": f"classes{suffix}/ ({len(classes)} classes) + subclasses{suffix}/ ({len(subclasses)} subclasses)",
            "entries": len(classes) + len(subclasses), "waiting": waiting, "problems": problems, "left_out": left_out,
            "features_without_text": [], "no_subraces_yet": [], "grants_added_from_text": {}}


# ---------- monsters ----------

# Categories made by code alone: the cleaned entries are the final ones.
CODE_ONLY = ("monsters",)


def finalize_code_only(category: str, srd_only: bool = False) -> dict:
    """Monsters have no LLM step: cleaned/ is copied to final/ (with --srd,
    only SRD entries)."""
    out = [e for e in read_list(CLEANED_PATH, category) if not srd_only or e.get("srd")]
    suffix = "_srd" if srd_only else ""
    files = write_list(FINAL_PATH, category, out, suffix=suffix)
    return {"written": f"{category}{suffix}/ ({len(files)} books)", "entries": len(out), "waiting": [],
            "features_without_text": [], "no_subraces_yet": [], "grants_added_from_text": {}}


def main() -> int:
    ap = argparse.ArgumentParser(description="Merge the code part and the LLM part into final/.")
    ap.add_argument("categories", nargs="*", help=f"default: all ({', '.join([*CATEGORIES, *CODE_ONLY])})")
    ap.add_argument("--srd", action="store_true", help="only SRD entries -> final/<category>_srd.json")
    args = ap.parse_args()
    report = {}
    print()
    for category in args.categories or [*CATEGORIES, *CODE_ONLY]:
        if category == "classes":
            r = finalize_classes(args.srd)
        elif category in CODE_ONLY:
            r = finalize_code_only(category, args.srd)
        else:
            r = finalize(category, args.srd)
        report[category] = r
        print(f"  {category:<12} {r['entries']} entries -> final/{r['written']}"
              + (f" · {len(r['waiting'])} waiting for the LLM step" if r["waiting"] else ""))
        for rid in r["no_subraces_yet"]:
            print(f"  {'':<12} {rid}: has subraces/options but none are finished yet (one must be picked)")
        for x in r["features_without_text"]:
            print(f"  {'':<12} feature without text (its name isn't in the entry's text): {x}")
        for x in r.get("modifiers_counted_twice", []):
            print(f"  {'':<12} dropped a feature modifier the item already has: {x}")
        for jid, added in r["grants_added_from_text"].items():
            print(f"  {'':<12} {jid}: added from text: {', '.join(added)}")
        for p in r.get("problems", []):
            print(f"  {'':<12} problem: {p}")
        if r.get("left_out"):
            print(f"  {'':<12} left out until their LLM step is done ({len(r['left_out'])}): {', '.join(r['left_out'])}")
    (FINAL_PATH / "_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
