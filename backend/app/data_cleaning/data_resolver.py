# Run from backend/:
#   py -m app.data_cleaning.data_resolver              every category
#   py -m app.data_cleaning.data_resolver races        only these
"""Stage 2 of the data pipeline: make every entry complete on its own.

Reads extracted/<category>.json, writes resolved/<category>.json.
Big categories (spells) are one file per book: extracted/spells/xphb.json ->
resolved/spells/xphb.json. All books are resolved together (a copy may use
a base from another book), then each entry goes back to its own book.
Files next to the books that aren't entry lists (spell_sources.json) are
passed through unchanged.

5etools saves space by letting an entry say "I'm that other entry, except…".
This stage fills those gaps, so that afterwards no entry depends on another
one and a cleaner only ever has to look at one entry. Nothing is cleaned
here: the output is still 5etools format, just without the shortcuts.

What it does:

  _copy       Start from the base entry (resolved first, so a copy of a copy
              works), put the entry's own keys on top, then apply the `_mod`
              edits ("append this", "replace that", "find and replace a word").
              Some keys are never inherited (page, srd, reprintedAs, …)
              unless `_preserve` names them: a copy of an SRD entry is not SRD.
              A copy keeps its base's versions (subraces), unless it changes
              something those versions change: then it made its own pick
              (WoW Gnome replaces "Gnomish Lineage" and gets no lineages).

  _versions   Each version is built as a full entry (base + version keys +
              version `_mod`). Templates (`_abstract` + `_implementations`)
              get `{{color}}` etc. filled in. A version is a subrace:
                - versions of a race become subraces of that race, holding
                  only what differs from the race;
                - versions of a subrace replace that subrace. They are built
                  on race + subrace, because their edits target the race's
                  text (the Dragonborn colours edit "Breath Weapon").

  subraces    Every subrace is put inside its race, under `subraces`. In a
              subrace:
                - a null value means "remove the race's value" and becomes
                  `overwrite: {key: true}`;
                - a text block that replaces the race's block of the same
                  name (raw `data.overwrite`) is listed in `entriesRemoved`,
                  the same way versions list the blocks they drop.
              A subrace must be picked, so what every subrace replaces is
              removed from the race (XPHB Elf's per-lineage spells and its
              lineage table).

A `null` value removes the key. When an entry can't be built (base missing,
a loop, an edit that doesn't fit), it is left out and reported. It is never
written half-done.

The report is printed and saved to resolved/_report.json.
"""

import copy
import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

from .data_files import is_split, remove

HERE = Path(__file__).resolve().parent
EXTRACTED_PATH = HERE / "extracted"
RESOLVED_PATH = HERE / "resolved"
PATCHES_PATH = HERE / "patches"   # hand-kept fixes for 5etools data mistakes (not replaced with data/)

# lists:    the lists in the extracted file whose entries can use _copy
# subraces: True = the file has `race` + `subrace` lists to put together
# options: True = `_versions` become `options` inside the entry (feats:
#          Magic Initiate -> Cleric / Druid / Wizard), the same way race
#          versions become subraces.
CATEGORIES = {
    "backgrounds": {"lists": ["background"]},
    "races": {"lists": ["race", "subrace"], "subraces": True},
    "feats": {"lists": ["feat"], "options": True},
    "optionalfeatures": {"lists": ["optionalfeature"]},
    "spells": {"lists": ["spell"]},     # one file per book (data_files.SPLIT)
    # Items: one raw file, split into books by each entry's source. The
    # other lists (itemType, itemProperty, itemEntry, …) are lookup tables,
    # passed through as resolved/items/_tables.json.
    "items": {"lists": ["baseitem", "item", "magicvariant", "itemGroup"], "items": True},
    # Classes: one raw file per class name (class-fighter.json), written
    # back as one file per class id (classes/fighter-phb.json), holding that
    # class, its subclasses and every class/subclass feature they use.
    "classes": {"lists": ["class", "subclass", "classFeature", "subclassFeature"], "classes": True},
    # Monsters: one file per bestiary book. Versions become monsters of their
    # own; a legendary group (lair actions, regional effects) goes inside
    # each monster that uses it.
    "monsters": {"lists": ["monster", "legendaryGroup"], "monsters": True},
}

# Keys a copy does not take from its base unless `_preserve` names them.
NOT_INHERITED = {
    "page", "otherSources", "additionalSources",
    "srd", "srd52", "basicRules", "basicRules2024",
    "reprintedAs", "hasFluff", "hasFluffImages", "hasToken",
}


# Keys that say which entry this is; edits never touch them.
IDENTITY = {"name", "source", "raceName", "raceSource"}
# The extra identity of subclasses and class features (see key_of).
CLASS_KEYS = ("className", "classSource", "subclassShortName", "subclassSource", "level")

# Keys that never count as "the copy changed this" when deciding whether a
# copy takes its base's versions.
META_KEYS = NOT_INHERITED | IDENTITY | {"_file", "_book", "_copy", "_versions", "soundClip", "edition"}

TAG_RE = re.compile(r"(\{@[^}]*\})")
VAR_RE = re.compile(r"\{\{(\w+)\}\}")


class ResolveError(Exception):
    """One entry can't be built."""


# ---------- small helpers ----------

def as_list(value) -> list:
    return value if isinstance(value, list) else [value]


def label(entry: dict) -> str:
    """"Elf (XPHB)" or "High (Elf, PHB)" for subraces, for messages."""
    name = entry.get("name") or "(no name)"
    if "raceName" in entry:
        return f"{name} ({entry.get('raceName')}, {entry.get('source')})"
    return f"{name} ({entry.get('source')})"


def key_of(entry: dict) -> tuple:
    """How a _copy finds its base. Case doesn't matter. A subrace is only
    unique together with its race."""
    k = (str(entry.get("name", "")).lower(), str(entry.get("source", "")).lower())
    if "raceName" in entry or "raceSource" in entry:
        k += (str(entry.get("raceName", "")).lower(), str(entry.get("raceSource", "")).lower())
    # Subclasses and class features are only unique together with their
    # class (and subclass, and level). A copy names all of them too.
    for part in CLASS_KEYS:
        if part in entry:
            k += (part, str(entry[part]).lower())
    return k


def drop_nulls(entry: dict, overwrite: bool = False) -> dict:
    """Remove top-level keys that are null. With `overwrite`, remember them
    as overwrite[key] = True (a subrace removing its race's value)."""
    for k in [k for k, v in entry.items() if v is None]:
        del entry[k]
        if overwrite:
            entry.setdefault("overwrite", {})[k] = True
    return entry


def node_name(node) -> str:
    """A short name for an entries item, for the report."""
    if isinstance(node, dict):
        return node.get("name") or f"({node.get('type', 'block')})"
    return str(node)[:40] + ("…" if len(str(node)) > 40 else "")


# ---------- _mod edits ----------

def find_index(arr: list, replace) -> int | None:
    """Where `replace` points in a list: a name (or the exact string),
    {"index": n} or {"regex": "..."}."""
    if isinstance(replace, dict):
        if "index" in replace:
            i = replace["index"]
            return i if -len(arr) <= i < len(arr) else None
        if "regex" in replace:
            rx = re.compile(replace["regex"], re.I if "i" in replace.get("flags", "") else 0)
            for i, it in enumerate(arr):
                text = it.get("name", "") if isinstance(it, dict) else str(it)
                if rx.search(text):
                    return i
            return None
    for exact in (True, False):
        for i, it in enumerate(arr):
            text = it.get("name") if isinstance(it, dict) else it
            if not isinstance(text, str):
                continue
            if (text == replace) if exact else (text.lower() == str(replace).lower()):
                return i
    return None


def replace_text(value, rx: re.Pattern, new: str):
    """Find-and-replace in every string, but never inside {@tags}."""
    if isinstance(value, str):
        parts = TAG_RE.split(value)
        return "".join(p if TAG_RE.fullmatch(p) else rx.sub(new, p) for p in parts)
    if isinstance(value, list):
        return [replace_text(v, rx, new) for v in value]
    if isinstance(value, dict):
        return {k: (v if k == "type" else replace_text(v, rx, new)) for k, v in value.items()}
    return value


def replace_in_items(value, rx: re.Pattern, new: str, fields: list):
    if not isinstance(value, list):
        return replace_text(value, rx, new)
    out = []
    for it in value:
        if isinstance(it, str):
            out.append(replace_text(it, rx, new) if None in fields else it)
        elif isinstance(it, dict):
            it = dict(it)
            for f in fields:
                if f is not None and f in it:
                    it[f] = replace_text(it[f], rx, new)
            out.append(it)
        else:
            out.append(it)
    return out


def js_replacement(text: str) -> str:
    """JS replacement "$1" -> Python "\\1"."""
    return re.sub(r"\$(\d)", r"\\\1", text.replace("\\", "\\\\"))


def set_path(target: dict, path: str, value) -> None:
    parts = path.split(".")
    for p in parts[:-1]:
        target = target.setdefault(p, {})
    target[parts[-1]] = value


def apply_mod(entry: dict, prop: str, op) -> None:
    """Apply one edit to entry[prop]. Raises ResolveError when it doesn't fit."""
    if op == "remove":
        entry.pop(prop, None)
        return
    if not isinstance(op, dict) or "mode" not in op:
        raise ResolveError(f"edit on '{prop}' has no mode: {json.dumps(op)[:80]}")

    mode = op["mode"]

    if mode == "replaceTxt":
        rx = re.compile(op["replace"], re.I if "i" in op.get("flags", "") else 0)
        new = js_replacement(op.get("with", ""))
        props = [k for k in entry if k not in IDENTITY and not k.startswith("_")] if prop == "*" else [prop]
        # As 5etools does: in a list, plain strings and the text of each item
        # (entries, headerEntries, footerEntries; or the op's own "props")
        # change, but an item's name doesn't: Flying Dagger's "sword" -> "dagger"
        # leaves the "Longsword" action's name for the edit that replaces it.
        fields = op.get("props") or [None, "entries", "headerEntries", "footerEntries"]
        for p in props:
            if p in entry:
                entry[p] = replace_in_items(entry[p], rx, new, fields)
        return

    if mode == "setProp":
        # prop "*" or "_" (the whole entry): op["prop"] is a path from the root
        set_path(entry if prop in ("*", "_") else entry.setdefault(prop, {}), op["prop"], copy.deepcopy(op["value"]))
        return
    if mode == "prefixSuffixStringProp":
        target = entry if prop in ("*", "_") else entry.get(prop)
        path = op.get("prop", "").split(".") if op.get("prop") else []
        for k in path[:-1]:
            target = target.get(k) if isinstance(target, dict) else None
        if path and isinstance(target, dict) and isinstance(target.get(path[-1]), str):
            target[path[-1]] = f"{op.get('prefix', '')}{target[path[-1]]}{op.get('suffix', '')}"
        elif not path and isinstance(entry.get(prop), str):
            entry[prop] = f"{op.get('prefix', '')}{entry[prop]}{op.get('suffix', '')}"
        return

    # Monster edits that work on the whole entry (their prop is "_").
    if mode in ("addSpells", "replaceSpells", "removeSpells"):
        spell_mod(entry, mode, op)
        return
    if mode == "addSkills":
        add_bonuses(entry, "skill", op.get("skills") or {})
        return
    if mode == "addAllSkills":
        add_bonuses(entry, "skill", {k: op.get("skills") for k in SKILL_ABILITY})
        return
    if mode == "addSaves":
        add_bonuses(entry, "save", op.get("saves") or {})
        return
    if mode == "addAllSaves":
        add_bonuses(entry, "save", {k: op.get("saves") for k in ABILITIES})
        return
    if mode == "addSenses":
        add_senses(entry, as_list(op.get("senses")))
        return
    if mode == "maxSize":
        order = ["T", "S", "M", "L", "H", "G"]
        if op.get("max") not in order or any(x not in order for x in entry.get("size", [])):
            raise ResolveError(f"maxSize: unknown size in {entry.get('size')} / {op.get('max')}")
        top = order.index(op["max"])
        sizes = [x for x in sorted(entry.get("size", []), key=order.index) if order.index(x) <= top]
        entry["size"] = sizes or [op["max"]]
        return
    if mode == "scalarMultXp":
        cr = entry.get("cr")
        if isinstance(cr, dict) and cr.get("xp"):
            xp = cr["xp"]
        else:
            xp = CR_XP.get(str(cr.get("cr") if isinstance(cr, dict) else cr))
            if xp is None:
                raise ResolveError(f"scalarMultXp: no XP for CR {cr}")
            entry["cr"] = cr = cr if isinstance(cr, dict) else {"cr": cr}
        v = xp * op["scalar"]
        cr["xp"] = int(v // 1) if op.get("floor") else v
        return
    if mode in ("scalarAddHit", "scalarAddDc"):
        if prop not in entry:
            return
        if mode == "scalarAddHit":
            rx, fn = re.compile(r"\{@hit ([-+]?\d+)\}"), lambda m: f"{{@hit {int(m.group(1)) + op['scalar']}}}"
        else:
            rx, fn = re.compile(r"\{@dc (\d+)(?:\|[^}]+)?\}"), lambda m: f"{{@dc {int(m.group(1)) + op['scalar']}}}"
        entry[prop] = walk_strings(entry[prop], lambda t: rx.sub(fn, t))
        return

    if mode in ("scalarAddProp", "scalarMultProp"):
        # As 5etools: a missing target is skipped; "+5" strings stay strings.
        target = entry.get(prop)
        if not target:
            return
        if not isinstance(target, dict):
            raise ResolveError(f"{mode}: '{prop}' is not an object")
        keys = list(target) if op["prop"] == "*" else [op["prop"]]
        for k in keys:
            try:
                n = float(target.get(k))
            except (TypeError, ValueError):
                raise ResolveError(f"{mode}: '{prop}.{k}' is not a number")
            if mode == "scalarAddProp":
                n += op["scalar"]
            else:
                n *= op["scalar"]
                if op.get("floor"):
                    n = n // 1
            n = int(n) if n == int(n) else n
            target[k] = f"{n:+d}" if isinstance(target.get(k), str) and isinstance(n, int) else n
        return

    # Everything below edits a list.
    arr = entry.setdefault(prop, [])
    if not isinstance(arr, list):
        raise ResolveError(f"{mode}: '{prop}' is not a list")
    items = copy.deepcopy(as_list(op.get("items", [])))

    if mode == "appendArr":
        arr.extend(items)
    elif mode == "prependArr":
        arr[:0] = items
    elif mode == "appendIfNotExistsArr":
        arr.extend(it for it in items if it not in arr)
    elif mode == "insertArr":
        i = op["index"]
        i = len(arr) + i + 1 if i < 0 else i
        arr[i:i] = items
    elif mode in ("replaceArr", "replaceOrAppendArr"):
        i = find_index(arr, op["replace"])
        if i is None:
            if mode == "replaceOrAppendArr":
                arr.extend(items)
                return
            raise ResolveError(f"replaceArr: {json.dumps(op['replace'])} not found in '{prop}'")
        arr[i:i + 1] = items
    elif mode == "renameArr":
        for r in as_list(op.get("renames") or []):
            i = find_index(arr, r.get("rename"))
            if i is None:
                raise ResolveError(f"renameArr: '{r.get('rename')}' not found in '{prop}'")
            arr[i] = {**arr[i], "name": r.get("with")}
    elif mode == "removeArr":
        if "names" in op:
            for name in as_list(op["names"]):
                i = find_index(arr, name)
                if i is None:
                    if op.get("force"):          # "remove it if it's there"
                        continue
                    raise ResolveError(f"removeArr: '{name}' not found in '{prop}'")
                del arr[i]
        for it in as_list(op.get("items", [])) if "items" in op else []:
            if it not in arr:
                raise ResolveError(f"removeArr: {json.dumps(it)[:60]} not found in '{prop}'")
            arr.remove(it)
    else:
        raise ResolveError(f"unknown edit mode '{mode}' on '{prop}'")


SPELL_LISTS = ("will", "constant", "ritual")
SPELL_DICTS = ("daily", "rest", "restLong", "weekly", "monthly", "yearly", "recharge", "charges", "legendary")


def spell_mod(entry: dict, mode: str, op: dict) -> None:
    """addSpells / replaceSpells / removeSpells: edit the monster's first
    spellcasting block, the way 5etools does."""
    blocks = entry.get("spellcasting")
    if not blocks:
        if mode != "addSpells":
            raise ResolveError(f"{mode}: no spellcasting to edit")
        blocks = entry["spellcasting"] = [{"name": "Spellcasting", "type": "spellcasting"}]
    sc = blocks[0]
    if op.get("name"):
        sc = next((b for b in blocks if b.get("name") == op["name"]), None)
        if sc is None:
            raise ResolveError(f"{mode}: no spellcasting named '{op['name']}'")

    def edit(lst: list, payload) -> list:
        lst = list(lst)
        if mode == "addSpells":
            return lst + list(as_list(payload))
        if mode == "removeSpells":
            for x in as_list(payload):
                if x not in lst:
                    raise ResolveError(f"removeSpells: {x} not found")
                lst.remove(x)
            return lst
        for pair in as_list(payload):                      # replaceSpells
            if pair.get("replace") not in lst:
                raise ResolveError(f"replaceSpells: {pair.get('replace')} not found")
            i = lst.index(pair["replace"])
            lst[i:i + 1] = as_list(pair.get("with"))
        return lst

    for lvl, payload in (op.get("spells") or {}).items():
        level = sc.setdefault("spells", {}).setdefault(str(lvl), {"spells": []})
        if isinstance(payload, dict):                      # addSpells may bring slots too
            level.update({k: v for k, v in payload.items() if k != "spells"})
            payload = payload.get("spells", [])
        level["spells"] = edit(level.get("spells", []), payload)
    for key in SPELL_LISTS:
        if key in op:
            sc[key] = edit(sc.get(key, []), op[key])
    for key in SPELL_DICTS:
        for n, payload in (op.get(key) or {}).items():
            d = sc.setdefault(key, {})
            d[n] = edit(d.get(n, []), payload)


SKILL_ABILITY = {
    "athletics": "str", "acrobatics": "dex", "sleight of hand": "dex", "stealth": "dex",
    "arcana": "int", "history": "int", "investigation": "int", "nature": "int", "religion": "int",
    "animal handling": "wis", "insight": "wis", "medicine": "wis", "perception": "wis", "survival": "wis",
    "deception": "cha", "intimidation": "cha", "performance": "cha", "persuasion": "cha",
}
CR_PB = {"0": 2, "1/8": 2, "1/4": 2, "1/2": 2}


def cr_pb(cr) -> int:
    """Proficiency bonus for a challenge rating ("1/4", "17", or {"cr": "17"})."""
    if isinstance(cr, dict):
        cr = cr.get("cr")
    cr = str(cr or "0")
    if cr in CR_PB:
        return CR_PB[cr]
    try:
        return 2 + max(0, (int(cr) - 1) // 4)
    except ValueError:
        return 2


ABILITIES = ("str", "dex", "con", "int", "wis", "cha")
CR_XP = {"0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100,
         "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200,
         "12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000, "17": 18000,
         "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000,
         "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000,
         "30": 155000}


def add_bonuses(entry: dict, key: str, picks: dict) -> None:
    """addSkills / addSaves {"insight": 1}: proficient (2 = expertise), worked
    out from the ability score and the CR's proficiency bonus. As 5etools: an
    existing bonus is only ever raised, never lowered."""
    pb = cr_pb(entry.get("cr"))
    out = entry.setdefault(key, {})
    for name, mult in picks.items():
        ab = SKILL_ABILITY.get(name.lower()) if key == "skill" else name
        if ab not in ABILITIES:
            raise ResolveError(f"add {key}: unknown '{name}'")
        score = entry.get(ab, 10) if isinstance(entry.get(ab), int) else 10
        bonus = (score - 10) // 2 + pb * int(mult)
        try:
            old = int(str(out.get(name)).replace("+", "")) if name in out else None
        except ValueError:
            old = None
        if old is None or old < bonus:
            out[name] = f"{bonus:+d}"


def add_senses(entry: dict, senses: list) -> None:
    """addSenses [{"type": "darkvision", "range": 60}]: added, or a shorter
    one of the same type raised."""
    have = entry.setdefault("senses", [])
    for sense in senses:
        rx = re.compile(rf"{re.escape(sense['type'])} (\d+)", re.I)
        for i, text in enumerate(have):
            m = rx.search(text) if isinstance(text, str) else None
            if m:
                if int(m.group(1)) < sense["range"]:
                    have[i] = f"{sense['type']} {sense['range']} ft."
                break
        else:
            have.append(f"{sense['type']} {sense['range']} ft.")


def walk_strings(value, fn):
    if isinstance(value, str):
        return fn(value)
    if isinstance(value, list):
        return [walk_strings(v, fn) for v in value]
    if isinstance(value, dict):
        return {k: walk_strings(v, fn) for k, v in value.items()}
    return value


def _is_op(x) -> bool:
    return x == "remove" or (isinstance(x, dict) and "mode" in x) or isinstance(x, list)


def apply_mods(entry: dict, mods: dict) -> None:
    """`_mod` edits. Besides {"prop": op}, two forms reach inside a key
    (magic variants edit what they pass on to their items):
      {"inherits": {"namePrefix": op}}   nested edits
      {"inherits.namePrefix": op}         a dotted path
    and a `setProp` without its own "prop" sets the key it sits under."""
    tail = {"_": 1, "*": 2}         # as 5etools: whole-entry edits go last
    for prop, ops in sorted(mods.items(), key=lambda kv: tail.get(kv[0], 0)):
        if isinstance(ops, dict) and "mode" not in ops and ops and all(_is_op(v) for v in ops.values()):
            target = entry.setdefault(prop, {})
            if not isinstance(target, dict):
                raise ResolveError(f"edits inside '{prop}', which is not an object")
            apply_mods(target, ops)
            continue
        target, key = entry, prop
        if "." in prop and prop not in entry:
            *path, key = prop.split(".")
            for k in path:
                target = target.setdefault(k, {})
                if not isinstance(target, dict):
                    raise ResolveError(f"edit on '{prop}': '{k}' is not an object")
        for op in as_list(ops):
            if isinstance(op, dict) and op.get("mode") == "setProp" and "prop" not in op:
                target[key] = copy.deepcopy(op.get("value"))
                continue
            apply_mod(target, key, op)


# ---------- _copy ----------

class CopyResolver:
    """Resolves _copy for one list. Each entry is built once (remembered),
    bases first, so chains work in any file order."""

    def __init__(self, entries: list[dict], list_name: str, problems: list[str], notes: list[str],
                 templates: dict | None = None):
        self.entries = entries
        self.templates = templates or {}     # monster templates ("Skeleton|DMG"), by lower-case (name, source)
        self.list_name = list_name
        self.problems = problems
        self.notes = notes
        self.index: dict[tuple, int] = {}
        self.done: dict[int, dict | None] = {}
        self.building: set[int] = set()
        self.copies = 0
        for i, e in enumerate(entries):
            k = key_of(e)
            if k in self.index:
                problems.append(f"{list_name}: two entries named {label(e)}; copies use the first")
            else:
                self.index[k] = i

    def all(self) -> list[dict]:
        out = []
        for i in range(len(self.entries)):
            built = self.get(i)
            if built is not None:
                out.append(built)
        return out

    def get(self, i: int) -> dict | None:
        """The built entry, or None when it can't be built (reported once)."""
        if i not in self.done:
            try:
                self.done[i] = self.build(i)
            except ResolveError as e:
                self.done[i] = None
                self.problems.append(f"{self.list_name} {label(self.entries[i])}: {e} (left out)")
        return self.done[i]

    def build(self, i: int) -> dict:
        entry = self.entries[i]
        if "_copy" not in entry:
            return copy.deepcopy(entry)

        if i in self.building:
            raise ResolveError("copies itself in a loop")
        self.building.add(i)
        try:
            ref = entry["_copy"]
            base_i = self.index.get(key_of(ref))
            if base_i is None:
                raise ResolveError(f"base {label(ref)} not found")
            if base_i in self.building:
                raise ResolveError(f"loop through {label(ref)}")
            base = self.get(base_i)
            if base is None:
                raise ResolveError(f"base {label(ref)} could not be built")

            preserve = ref.get("_preserve", {})
            mods, roots = self.with_templates(ref)
            out = {k: copy.deepcopy(v) for k, v in base.items()
                   if k not in NOT_INHERITED or preserve.get("*") or preserve.get(k)}
            for k, v in entry.items():
                if k != "_copy":
                    out[k] = copy.deepcopy(v)
            # A template's root values (Skeleton: type undead) replace the
            # base's, but never a value the copy sets itself.
            for root in roots:
                for k, v in root.items():
                    if k not in entry:
                        out[k] = copy.deepcopy(v)
            apply_mods(out, mods)
            self.take_versions(entry, ref, base, out)
            self.copies += 1
            return drop_nulls(out)
        finally:
            self.building.discard(i)


    def with_templates(self, ref: dict) -> tuple[dict, list[dict]]:
        """`_templates` (monsters: "Cat" + the Skeleton template): each
        template's edits are added after the copy's own, as 5etools does.
        Returns (all edits, the templates' root values)."""
        mods = {k: list(as_list(v)) for k, v in (ref.get("_mod") or {}).items()}
        roots = []
        for t in ref.get("_templates") or []:
            tpl = self.templates.get((_low(t.get("name")), _low(t.get("source"))))
            if tpl is None:
                raise ResolveError(f"template {t.get('name')} ({t.get('source')}) not found")
            apply = tpl.get("apply") or {}
            for k, v in (apply.get("_mod") or {}).items():
                mods.setdefault(k, []).extend(copy.deepcopy(as_list(v)))
            if apply.get("_root"):
                roots.append(apply["_root"])
        return mods, roots

    def take_versions(self, entry: dict, ref: dict, base: dict, out: dict) -> None:
        """Does a copy keep its base's versions (subraces)? Decided from the data:
        if the copy itself changes something the versions change (a key they
        set, or a text block they edit), it made its own pick and gets none.
        WoW Gnome replaces "Gnomish Lineage" and sets its own spells, so it
        doesn't get XPHB Gnome's Forest/Rock lineages. A copy that leaves those
        alone keeps them, as versions of the copy (its name and source)."""
        versions = base.get("_versions")
        if not versions or "_versions" in entry:
            return
        out.pop("_versions", None)
        preserve = ref.get("_preserve", {})
        if preserve.get("_versions") or preserve.get("*"):
            out["_versions"] = self.versions_for(versions, entry, base)
            return
        clash = (version_touches(versions) & copy_touches(entry, ref))
        where = f"{self.list_name} {label(entry)}: copy of {label(ref)}"
        if clash:
            self.notes.append(f"{where} changes {', '.join(sorted(clash))} itself, so it doesn't take the base's {len(versions)} version(s)")
        else:
            out["_versions"] = self.versions_for(versions, entry, base)
            self.notes.append(f"{where} takes the base's {len(versions)} version(s)")

    @staticmethod
    def versions_for(versions: list, entry: dict, base: dict) -> list:
        """The base's versions, re-labelled with the copy's name and source
        ("Gnome; Forest Gnome Lineage" -> "<copy name>; Forest Gnome Lineage")."""
        out = copy.deepcopy(versions)
        old_prefix, new_prefix = f"{base.get('name')}; ", f"{entry.get('name')}; "
        for v in out:
            for part in [v.get("_abstract")] if "_abstract" in v else [v]:
                if part is None:
                    continue
                if "source" in part:
                    part["source"] = entry.get("source", part["source"])
                if str(part.get("name", "")).startswith(old_prefix):
                    part["name"] = new_prefix + part["name"][len(old_prefix):]
            for impl in v.get("_implementations", []):
                if "source" in impl:
                    impl["source"] = entry.get("source", impl["source"])
        return out


def mod_targets(mods: dict) -> set[str]:
    """What a set of _mod edits changes: the key, plus "entries:<name>"
    for each named text block it replaces or removes."""
    found = set()
    for prop, ops in (mods or {}).items():
        found.add(prop)
        for op in as_list(ops):
            if not isinstance(op, dict):
                continue
            for target in as_list(op.get("replace", [])) + as_list(op.get("names", [])):
                if isinstance(target, str):
                    found.add(f"{prop}:{target.lower()}")
    return found


def version_touches(versions: list) -> set[str]:
    found = set()
    for v in versions:
        parts = [v["_abstract"], *v.get("_implementations", [])] if "_abstract" in v else [v]
        for part in parts:
            found |= {k for k in part if k not in META_KEYS and k not in ("_mod", "_variables", "_preserve")}
            found |= {t for t in mod_targets(part.get("_mod")) if ":" in t}
    return found


def copy_touches(entry: dict, ref: dict) -> set[str]:
    found = {k for k in entry if k not in META_KEYS}
    found |= {t for t in mod_targets(ref.get("_mod")) if ":" in t}
    return found


# ---------- _versions ----------

def fill_vars(value, variables: dict):
    """Put _variables into {{name}} placeholders. A string that is only
    "{{name}}" takes the variable as it is (it may be a list)."""
    if isinstance(value, str):
        whole = VAR_RE.fullmatch(value)
        if whole and whole.group(1) in variables:
            return copy.deepcopy(variables[whole.group(1)])
        return VAR_RE.sub(lambda m: str(variables.get(m.group(1), m.group(0))), value)
    if isinstance(value, list):
        return [fill_vars(v, variables) for v in value]
    if isinstance(value, dict):
        return {k: fill_vars(v, variables) for k, v in value.items()}
    return value


def leftover_vars(value) -> set[str]:
    found: set[str] = set()
    if isinstance(value, str):
        found.update(VAR_RE.findall(value))
    elif isinstance(value, list):
        for v in value:
            found |= leftover_vars(v)
    elif isinstance(value, dict):
        for v in value.values():
            found |= leftover_vars(v)
    return found


def build_version(base: dict, version: dict) -> dict:
    """base + the version's keys + the version's edits."""
    if not version.get("name"):
        raise ResolveError("a version has no name")
    out = copy.deepcopy(base)
    out.pop("_versions", None)
    out.pop("subraces", None)
    for k, v in version.items():
        if k not in ("_mod", "_preserve"):
            out[k] = copy.deepcopy(v)
    apply_mods(out, version.get("_mod", {}))
    missing = leftover_vars(out)
    if missing:
        raise ResolveError(f"version {version['name']}: template values missing for {', '.join(sorted(missing))}")
    return out


def expand_versions(entry: dict) -> list[dict]:
    """All versions of an entry as full entries, each carrying its nulls
    (removals) as null values so the caller can see them."""
    out = []
    for v in entry.get("_versions", []):
        if "_abstract" in v:
            for impl in v.get("_implementations", []):
                variables = impl.get("_variables", {})
                merged = fill_vars(copy.deepcopy(v["_abstract"]), variables)
                for k, val in impl.items():
                    if k != "_variables":
                        merged[k] = fill_vars(copy.deepcopy(val), variables)
                out.append(build_version(entry, merged))
        else:
            out.append(build_version(entry, v))
    return out


def short_name(version_name: str, race_name: str) -> str:
    """"Elf; Drow Lineage" -> "Drow Lineage". Other names are kept."""
    prefix = f"{race_name}; "
    return version_name[len(prefix):] if version_name.startswith(prefix) else version_name


def version_to_subrace(race: dict, version: dict) -> dict:
    """A full race version, kept as a subrace: only what differs from the
    race. A changed or removed key is marked in `overwrite` (versions
    replace, they don't add). Text blocks the version dropped are listed
    in `entriesRemoved`."""
    sub = {
        "name": short_name(version["name"], race["name"]),
        "source": version.get("source") or race["source"],
        "raceName": race["name"],
        "raceSource": race["source"],
        "fromVersion": True,
    }
    overwrite = {}
    skip = IDENTITY | {"_file", "_versions", "subraces"}
    for k in list(race) + [k for k in version if k not in race]:
        if k in skip:
            continue
        if k == "entries":
            mine, theirs = version.get("entries") or [], race.get("entries") or []
            new = [e for e in mine if e not in theirs]
            gone = [node_name(e) for e in theirs if e not in mine]
            if new:
                sub["entries"] = new
            if gone:
                sub["entriesRemoved"] = gone
        elif version.get(k) is None:
            if race.get(k) is not None:
                overwrite[k] = True
        elif k not in race or race[k] != version[k]:
            sub[k] = copy.deepcopy(version[k])
            if race.get(k) is not None:
                overwrite[k] = True
    if overwrite:
        sub["overwrite"] = overwrite
    # SRD flags are kept even when equal to the race's: a lineage of an SRD
    # race is SRD too, and the SRD set is built per subrace.
    for k in ("srd", "srd52"):
        if version.get(k) is not None:
            sub[k] = version[k]
    sub["_file"] = race.get("_file")
    return sub


# ---------- categories ----------

def resolve_plain(data: dict, lists: list[str], problems: list[str], notes: list[str], stats: dict,
                  templates: dict | None = None) -> dict:
    out = {}
    for name in lists:
        r = CopyResolver(data.get(name, []), name, problems, notes, templates)
        out[name] = r.all()
        stats[name] = {"in": len(r.entries), "out": len(out[name]), "copies": r.copies}
    return out


def text_overwrites_to_removed(sub: dict) -> dict:
    """Subrace text blocks marked data.overwrite = "Age" replace the race's
    block of that name. Write that as entriesRemoved (the same way versions
    say it) and drop the marker."""
    for e in sub.get("entries") or []:
        if isinstance(e, dict) and isinstance(e.get("data"), dict) and "overwrite" in e["data"]:
            name = e["data"].pop("overwrite")
            if not e["data"]:
                del e["data"]
            removed = sub.setdefault("entriesRemoved", [])
            if name not in removed:
                removed.append(name)
    return sub


def race_with_subrace(race: dict, sub: dict) -> dict:
    """The race with a subrace applied: what a subrace's versions are
    written against (they edit the race's text, e.g. "Breath Weapon")."""
    merged = copy.deepcopy(race)
    merged.pop("_versions", None)
    merged.pop("subraces", None)
    removed = set(sub.get("entriesRemoved", []))
    merged["entries"] = [e for e in merged.get("entries") or [] if node_name(e) not in removed]
    for k, v in sub.items():
        if k in IDENTITY or k in ("_versions", "overwrite", "entriesRemoved", "_file"):
            continue
        if k == "entries":
            merged["entries"] += copy.deepcopy(v)
        else:
            merged[k] = copy.deepcopy(v)
    for k in sub.get("overwrite", {}):
        if k not in sub:
            merged.pop(k, None)
    merged["_versions"] = sub["_versions"]
    return merged


def subrace_versions(race: dict, sub: dict) -> list[dict]:
    """The versions of a subrace, each as a subrace of the race: the
    subrace's own keys, plus what the version changes."""
    merged = race_with_subrace(race, sub)
    out = []
    for v in expand_versions(merged):
        res = {k: copy.deepcopy(val) for k, val in sub.items()
               if k not in ("_versions", "entries", "entriesRemoved", "overwrite")}
        res["name"] = v["name"]
        res["source"] = v.get("source") or sub.get("source")
        res["fromVersion"] = True
        overwrite = dict(sub.get("overwrite", {}))
        for k in list(merged) + [k for k in v if k not in merged]:
            if k in IDENTITY or k in ("_file", "_versions", "subraces", "entries"):
                continue
            if v.get(k) is None:
                if merged.get(k) is not None:
                    res.pop(k, None)
                    if race.get(k) is not None:
                        overwrite[k] = True
            elif v[k] != merged.get(k):
                res[k] = copy.deepcopy(v[k])
                if race.get(k) is not None:
                    overwrite[k] = True
        theirs = race.get("entries") or []
        mine = v.get("entries") or []
        new = [e for e in mine if e not in theirs]
        gone = [node_name(e) for e in theirs if e not in mine]
        if new:
            res["entries"] = new
        if gone:
            res["entriesRemoved"] = gone
        if overwrite:
            res["overwrite"] = overwrite
        out.append(res)
    return out


def drop_unused_race_parts(race: dict, key: str = "subraces") -> None:
    """A subrace (or option) must be picked, so a key every one of them
    replaces, or a text block every one removes, is never used: e.g. XPHB
    Elf's per-lineage spell list and its "Elven Lineage" table. Remove those
    from the parent, and the now pointless markers from the children."""
    subs = race.get(key) or []
    if not subs:
        return
    for k in [k for k in race if k not in IDENTITY and k not in ("entries", "subraces", "options", "_file")]:
        if all(s.get("overwrite", {}).get(k) for s in subs):
            del race[k]
            for s in subs:
                s.get("overwrite", {}).pop(k, None)
                if "overwrite" in s and not s["overwrite"]:
                    del s["overwrite"]
    common = set.intersection(*(set(s.get("entriesRemoved", [])) for s in subs))
    if common:
        race["entries"] = [e for e in race.get("entries") or [] if node_name(e) not in common]
        for s in subs:
            s["entriesRemoved"] = [n for n in s["entriesRemoved"] if n not in common]
            if not s["entriesRemoved"]:
                del s["entriesRemoved"]


def resolve_races(data: dict, problems: list[str], notes: list[str], stats: dict) -> dict:
    races_r = CopyResolver(data.get("race", []), "race", problems, notes)
    subs_r = CopyResolver(data.get("subrace", []), "subrace", problems, notes)
    races, subs = races_r.all(), subs_r.all()

    by_race: dict[tuple, list] = {}
    for s in subs:
        s = text_overwrites_to_removed(drop_nulls(s, overwrite=True))
        by_race.setdefault((str(s.get("raceName", "")).lower(), str(s.get("raceSource", "")).lower()), []).append(s)

    out_races, attached, from_versions = [], 0, 0
    for race in races:
        subraces = []
        for s in by_race.pop(key_of({"name": race["name"], "source": race["source"]}), []):
            if not s.get("_versions"):
                s.pop("_versions", None)
                subraces.append(s)
                attached += 1
                continue
            # A subrace with versions is replaced by its versions.
            try:
                built = subrace_versions(race, s)
                subraces += built
                from_versions += len(built)
            except ResolveError as e:
                problems.append(f"subrace {label(s)}: {e} (left out)")

        if race.get("_versions"):
            try:
                built = [version_to_subrace(race, v) for v in expand_versions(race)]
                subraces += built
                from_versions += len(built)
            except ResolveError as e:
                problems.append(f"race {label(race)}: {e} (left out)")
                continue
        race.pop("_versions", None)
        if subraces:
            race["subraces"] = subraces
            drop_unused_race_parts(race)
        out_races.append(race)

    for (name, source), orphans in by_race.items():
        for s in orphans:
            problems.append(f"subrace {label(s)}: race '{name}|{source}' not found (left out)")

    stats["race"] = {"in": len(races_r.entries), "out": len(out_races), "copies": races_r.copies}
    stats["subrace"] = {"in": len(subs_r.entries), "copies": subs_r.copies,
                        "attached": attached, "from_versions": from_versions}
    return {"race": out_races}


def split_option_text(entry: dict, fulls: list[dict], opts: list[dict]) -> None:
    """Text for pick-one options. A text block the entry keeps in EVERY option
    is shared and stays on the entry; every other block belongs to the
    options that keep it, so it moves into them (in the order the option
    has them). Strike of the Giants: each giant's block moves into its own
    option, the shared DC and uses rules stay on the feat."""
    base = entry.get("entries") or []
    common = [b for b in base if all(b in (f.get("entries") or []) for f in fulls)]
    entry["entries"] = common
    for o, f in zip(opts, fulls):
        mine = [b for b in (f.get("entries") or []) if b not in common]
        if mine:
            o["entries"] = mine
        else:
            o.pop("entries", None)
        o.pop("entriesRemoved", None)   # the entry now only has blocks every option keeps


def resolve_with_options(data: dict, list_name: str, problems: list[str], notes: list[str], stats: dict) -> dict:
    """_copy as usual, then each entry's `_versions` become its `options`:
    only what differs from the entry, like subraces. See split_option_text
    for how the text is shared out."""
    r = CopyResolver(data.get(list_name, []), list_name, problems, notes)
    out, made = [], 0
    for e in r.all():
        if e.get("_versions"):
            try:
                fulls = expand_versions(e)
                opts = []
                for v in fulls:
                    o = version_to_subrace(e, v)
                    o.pop("raceName", None)
                    o.pop("raceSource", None)
                    opts.append(o)
                e["options"] = opts
                made += len(opts)
                split_option_text(e, fulls, opts)
                drop_unused_race_parts(e, "options")
            except ResolveError as err:
                problems.append(f"{list_name} {label(e)}: {err} (left out)")
                continue
        e.pop("_versions", None)
        out.append(e)
    stats[list_name] = {"in": len(r.entries), "out": len(out), "copies": r.copies, "options_from_versions": made}
    return {list_name: out}


# ---------- items ----------

ITEM_ENTRY = re.compile(r"^\{#itemEntry ([^}|]+)(?:\|([^}]*))?\}$")
ITEM_VAR = re.compile(r"\{\{\s*(?:(\w+)\s+)?item\.(\w+)\s*\}\}")


def book_name(source) -> str:
    """"XDMG" -> "xdmg": the file a source's entries are written to."""
    return re.sub(r"[^a-z0-9]+", "-", str(source or "unknown").lower()).strip("-") or "unknown"


def _join(values) -> str:
    vals = [str(v) for v in as_list(values)]
    return vals[0] if len(vals) == 1 else ", ".join(vals[:-1]) + " and " + vals[-1] if vals else ""


def fill_item_entries(entries, item: dict, templates: dict, problems: list) -> list:
    """{#itemEntry Armor of Resistance|XDMG} -> that template's text, with
    {{item.resist}} filled from the item ("You have Resistance to fire
    damage…"). Shared rules text, written once in 5etools."""
    def fill(x):
        if isinstance(x, str):
            return ITEM_VAR.sub(lambda m: _join(item.get(m.group(2), f"[{m.group(2)}]")), x)
        if isinstance(x, list):
            return [fill(y) for y in x]
        if isinstance(x, dict):
            return {k: fill(v) for k, v in x.items()}
        return x

    out = []
    for e in entries or []:
        m = ITEM_ENTRY.match(e.strip()) if isinstance(e, str) else None
        if not m:
            out.append(e)
            continue
        key = (m.group(1).strip().lower(), str(m.group(2) or "dmg").strip().lower())
        if key not in templates:
            problems.append(f"item {label(item)}: entry template '{m.group(1)}|{m.group(2)}' not found")
            out.append(e)
            continue
        out += fill(copy.deepcopy(templates[key]))
    return out


def resolve_items(data: dict, config: dict, problems: list[str], notes: list[str], stats: dict) -> dict:
    """Base items, items, magic variants and item groups:
      - a magic variant keeps its book in `inherits.source`; it becomes its
        `source`, so copies can find it and it lands in the right book;
      - `_copy` is resolved per list, like every category;
      - entry templates ({#itemEntry …}) are filled in, and XGE's extra tool
        text (`additionalEntries`) is added to the entry's text;
      - every entry is tagged with its book (its source)."""
    for v in data.get("magicvariant", []):
        if not v.get("source"):
            src = (v.get("inherits") or {}).get("source")
            if src:
                v["source"] = src
            else:
                problems.append(f"magicvariant {v.get('name')}: no source")
    out = resolve_plain(data, config["lists"], problems, notes, stats)

    templates = {(str(t.get("name", "")).lower(), str(t.get("source", "")).lower()): t.get("entriesTemplate") or []
                 for t in data.get("itemEntry", [])}
    for lst in ("baseitem", "item", "itemGroup"):
        for e in out.get(lst, []):
            entries = list(e.get("entries") or []) + list(e.pop("additionalEntries", None) or [])
            if entries:
                e["entries"] = fill_item_entries(entries, e, templates, problems)
    for v in out.get("magicvariant", []):
        inh = v.get("inherits")
        if isinstance(inh, dict) and inh.get("entries"):
            inh["entries"] = fill_item_entries(inh["entries"], {**inh, "name": v.get("name")}, templates, problems)

    for lst in config["lists"]:
        for e in out.get(lst, []):
            e["_book"] = book_name(e.get("source"))
    return out


# ---------- classes ----------

# Raw subclass keys that don't count as "this copy adds something".
SUBCLASS_COPY_ONLY = {"name", "shortName", "source", "className", "classSource", "_copy", "page", "_file",
                      "_book", "hasFluff", "hasFluffImages", "edition", "srd", "srd52", "basicRules",
                      "basicRules2024", "otherSources", "reprintedAs", "fluff"}


def _low(x) -> str:
    return str(x or "").strip().lower()


def class_key(name, source) -> tuple:
    return (_low(name), _low(source) or "phb")


def class_feature_key(ref: str) -> tuple:
    """"Martial Arts|Monk|XPHB|1" -> the key of that classFeature.
    Parts: name|className|classSource|level|source; an empty classSource
    is PHB, an empty source is the class's source."""
    p = (str(ref).split("|") + [""] * 5)[:5]
    cls_src = _low(p[2]) or "phb"
    return (_low(p[0]), _low(p[1]), cls_src, _low(p[3]), _low(p[4]) or cls_src)


def subclass_feature_key(ref: str) -> tuple:
    """"Combat Superiority|Fighter|XPHB|Battle Master|XPHB|3" -> its key.
    Parts: name|className|classSource|subclassShortName|subclassSource|level|source;
    empty sources are PHB, an empty source is the subclass's source."""
    p = (str(ref).split("|") + [""] * 7)[:7]
    cls_src, sub_src = _low(p[2]) or "phb", _low(p[4]) or "phb"
    return (_low(p[0]), _low(p[1]), cls_src, _low(p[3]), sub_src, _low(p[5]), _low(p[6]) or sub_src)


def feature_key_of(entry: dict, sub: bool) -> tuple:
    if sub:
        return (_low(entry.get("name")), _low(entry.get("className")), _low(entry.get("classSource")) or "phb",
                _low(entry.get("subclassShortName")), _low(entry.get("subclassSource")) or "phb",
                _low(entry.get("level")), _low(entry.get("source")))
    return (_low(entry.get("name")), _low(entry.get("className")), _low(entry.get("classSource")) or "phb",
            _low(entry.get("level")), _low(entry.get("source")))


def feature_refs(x, out: list) -> list:
    """Every refClassFeature / refSubclassFeature inside a feature's text,
    as (is_subclass_feature, ref)."""
    if isinstance(x, dict):
        if x.get("type") == "refClassFeature" and x.get("classFeature"):
            out.append((False, x["classFeature"]))
        elif x.get("type") == "refSubclassFeature" and x.get("subclassFeature"):
            out.append((True, x["subclassFeature"]))
        for v in x.values():
            feature_refs(v, out)
    elif isinstance(x, list):
        for v in x:
            feature_refs(v, out)
    return out


def class_feature_list(cls: dict) -> list[str]:
    return [r["classFeature"] if isinstance(r, dict) else r for r in cls.get("classFeatures") or []]


def resolve_classes(data: dict, config: dict, problems: list[str], notes: list[str], stats: dict) -> dict:
    """Classes, subclasses and their features, regrouped per class.

      - `_copy` is resolved per list, like every category.
      - A class without a hit die is not a player class (TCE sidekicks):
        reported and left out, with its subclasses.
      - A copied class with no class features of its own is only a
        reference to another class (WoW Paladin, Hunter, Mage…): it's left
        out. Its subclasses that only copy are left out too; one that adds
        something moves to the real class.
      - A copied subclass placed on a class of the other edition (a 2014
        subclass on a 2024 class) is left out; the original stays on its
        own class. Editions never mix inside a class.
      - A subclass takes its class's edition.
      - Every class gets its own book (`_book` = class id, "fighter-phb"):
        the class, its subclasses and every feature they use, including
        features they share with another class (Death Knight uses
        Paladin's), so each file is complete on its own."""
    raw = {lst: data.get(lst, []) for lst in config["lists"]}
    raw_classes = [copy.deepcopy(e) for e in raw["class"]]
    raw_subs = [copy.deepcopy(e) for e in raw["subclass"]]
    out = resolve_plain(data, config["lists"], problems, notes, stats)

    # Which raw entries were copies (the resolved ones no longer say).
    raw_cls_by_key = {class_key(e.get("name"), e.get("source")): e for e in raw_classes}
    raw_sub_by_key = {(_low(e.get("name")), _low(e.get("source")), _low(e.get("className")),
                       _low(e.get("classSource")) or "phb"): e for e in raw_subs}

    classes = {class_key(c.get("name"), c.get("source")): c for c in out["class"]}
    dropped_classes: dict[tuple, str] = {}
    reference_of: dict[tuple, tuple] = {}
    for k, c in classes.items():
        label_ = f"{c.get('name')} ({c.get('source')})"
        if not c.get("hd"):
            dropped_classes[k] = "no hit die"
            problems.append(f"class {label_}: no hit die, so not a player class (left out with its subclasses)")
            continue
        r = raw_cls_by_key.get(k, {})
        if "_copy" in r:
            own = [ref for ref in class_feature_list(c) if class_feature_key(ref)[1:3] == k]
            if not own:
                target = class_key(r["_copy"].get("name"), r["_copy"].get("source"))
                dropped_classes[k] = "reference"
                reference_of[k] = target
                notes.append(f"class {label_}: only a copy of {r['_copy'].get('name')} ({r['_copy'].get('source')}), "
                             f"left out; its own subclasses move there")
            else:
                notes.append(f"class {label_}: a copy of {r['_copy'].get('name')} ({r['_copy'].get('source')}) "
                             f"with {len(own)} feature(s) of its own: a class of its own")

    sub_feats_own = {}
    for f in raw["subclassFeature"]:
        if "_copy" not in f:
            k = (_low(f.get("subclassShortName")), _low(f.get("subclassSource")) or "phb",
                 _low(f.get("className")), _low(f.get("classSource")) or "phb")
            sub_feats_own[k] = sub_feats_own.get(k, 0) + 1

    kept_subs: dict[tuple, list] = {}
    counts = {"kept": 0, "moved": 0, "copy_on_reference": 0, "other_edition_copy": 0, "class_left_out": 0}
    for s in out["subclass"]:
        ck = class_key(s.get("className"), s.get("classSource"))
        label_ = f"{s.get('name')} ({s.get('source')}, {s.get('className')} {s.get('classSource')})"
        rk = (_low(s.get("name")), _low(s.get("source")), ck[0], ck[1])
        r = raw_sub_by_key.get(rk, {})
        is_copy = "_copy" in r
        adds = bool(set(r) - SUBCLASS_COPY_ONLY) or bool((r.get("_copy") or {}).get("_mod")) or \
            sub_feats_own.get((_low(s.get("shortName")), _low(s.get("source")), ck[0], ck[1]), 0) > 0
        if dropped_classes.get(ck) == "no hit die":
            counts["class_left_out"] += 1
            continue
        if ck in reference_of:
            if is_copy and not adds:
                counts["copy_on_reference"] += 1
                continue
            target = reference_of[ck]
            if target not in classes or target in dropped_classes:
                problems.append(f"subclass {label_}: its class is a copy of a class that isn't kept")
                continue
            moved_from = (s.get("className"), s.get("classSource"))
            s["className"], s["classSource"] = classes[target]["name"], classes[target]["source"]
            move_subclass_features(s, moved_from, out["subclassFeature"])
            notes.append(f"subclass {label_}: moved to {classes[target]['name']} ({classes[target]['source']})")
            counts["moved"] += 1
            ck = target
        elif ck not in classes:
            problems.append(f"subclass {label_}: class not found (left out)")
            continue
        cls = classes[ck]
        edition = cls.get("edition") or "classic"
        if is_copy:
            base_cls = class_key(r["_copy"].get("className"), r["_copy"].get("classSource"))
            base_ed = (classes.get(base_cls) or {}).get("edition") or "classic"
            if base_cls != ck and base_ed != edition:
                counts["other_edition_copy"] += 1
                continue
        if s.get("edition") and s["edition"] != edition:
            notes.append(f"subclass {label_}: edition {s['edition']} on a {edition} class; it takes the class's")
        s["edition"] = edition
        kept_subs.setdefault(ck, []).append(s)
        counts["kept"] += 1
    stats["subclass_rules"] = counts

    cf_index = {feature_key_of(f, False): f for f in out["classFeature"]}
    sf_index = {feature_key_of(f, True): f for f in out["subclassFeature"]}
    books = {lst: [] for lst in config["lists"]}
    used_cf, used_sf = set(), set()
    for ck, cls in classes.items():
        if ck in dropped_classes:
            continue
        book = f"{slug_id(cls.get('name'))}-{_low(cls.get('source'))}"
        found_cf, found_sf = {}, {}

        def take(is_sub: bool, ref: str, owner: str):
            key = subclass_feature_key(ref) if is_sub else class_feature_key(ref)
            index, found = (sf_index, found_sf) if is_sub else (cf_index, found_cf)
            if key in found:
                return
            f = index.get(key)
            if f is None:
                problems.append(f"{owner}: feature '{ref}' not found")
                return
            found[key] = f
            for sub, r in feature_refs(f.get("entries"), []):
                take(sub, r, owner)

        for ref in class_feature_list(cls):
            take(False, ref, f"class {cls.get('name')} ({cls.get('source')})")
        for s in kept_subs.get(ck, []):
            for ref in s.get("subclassFeatures") or []:
                take(True, ref, f"subclass {s.get('name')} ({s.get('source')})")

        for lst, items in (("class", [cls]), ("subclass", kept_subs.get(ck, [])),
                           ("classFeature", found_cf.values()), ("subclassFeature", found_sf.values())):
            for e in items:
                e = copy.deepcopy(e)
                e["_book"] = book
                books[lst].append(e)
        used_cf |= set(found_cf)
        used_sf |= set(found_sf)

    unused = (len(cf_index) - len(used_cf), len(sf_index) - len(used_sf))
    if any(unused):
        notes.append(f"{unused[0]} class feature(s) and {unused[1]} subclass feature(s) belong to nothing kept "
                     f"(copies left out, sidekicks)")
    stats["books"] = {"classes": len(books["class"]), "subclasses": len(books["subclass"])}
    # Which left-out reference class became which class, for the other
    # categories: spells listed for the WoW Mage go on the Wizard's list.
    books["_extra_files"] = {"_references": {
        f"{slug_id(classes[k]['name'])}-{_low(classes[k]['source'])}":
            f"{slug_id(classes[t]['name'])}-{_low(classes[t]['source'])}"
        for k, t in reference_of.items() if t in classes}}
    return books


def move_subclass_features(sub: dict, old_class: tuple, features: list[dict]) -> None:
    """A subclass moved from a reference class to the real one: its own
    features (and the refs pointing at them) move with it, so they are
    named after the class they now belong to."""
    old = (_low(old_class[0]), _low(old_class[1]) or "phb")
    new_name, new_src = sub["className"], sub["classSource"]
    mine = (_low(sub.get("shortName")), _low(sub.get("source")) or "phb")

    def fix_ref(ref: str) -> str:
        p = (str(ref).split("|") + [""] * 7)[:7]
        if (_low(p[1]), _low(p[2]) or "phb") == old and (_low(p[3]), _low(p[4]) or "phb") == mine:
            p[1], p[2] = new_name, new_src
            return "|".join(p).rstrip("|")
        return ref

    def fix_entries(x):
        if isinstance(x, dict):
            if x.get("type") == "refSubclassFeature" and x.get("subclassFeature"):
                x["subclassFeature"] = fix_ref(x["subclassFeature"])
            for v in x.values():
                fix_entries(v)
        elif isinstance(x, list):
            for v in x:
                fix_entries(v)

    sub["subclassFeatures"] = [fix_ref(r) for r in sub.get("subclassFeatures") or []]
    for f in features:
        if ((_low(f.get("className")), _low(f.get("classSource")) or "phb") == old
                and (_low(f.get("subclassShortName")), _low(f.get("subclassSource")) or "phb") == mine):
            f["className"], f["classSource"] = new_name, new_src
            fix_entries(f.get("entries"))


def slug_id(name) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(name).lower().replace("'", "")).strip("-")


# ---------- monsters ----------

def variant_to_versions(m: dict) -> list[dict]:
    """5etools makes a version from every variant inset marked `_version`:
    the monster plus the variant's trait/action (`addAs`) or its named blocks
    (`addHeadersAs`), e.g. "Yuan-ti Nightmare Speaker (Chameleon Skin)".
    The version itself shows no variant insets."""
    out = []
    for it in m.get("variant") or []:
        ver = it.get("_version") if isinstance(it, dict) else None
        if not ver:
            continue
        add = {"name": ver.get("name") or it.get("name"),
               "source": ver.get("source") or it.get("source") or m.get("source"),
               "variant": None}
        if it.get("source") and _low(it["source"]) != _low(m.get("source")):
            # the inset comes from another book (Frost Giant's optional actions
            # are from SKT): the SRD flag of the monster doesn't cover it
            add.update({"srd": None, "srd52": None, "basicRules": None, "basicRules2024": None})
        if ver.get("addAs"):
            item = {k: copy.deepcopy(v) for k, v in it.items() if k not in ("_version", "type", "source", "page")}
            add["_mod"] = {ver["addAs"]: {"mode": "appendArr", "items": item}}
        elif ver.get("addHeadersAs"):
            items = [{k: copy.deepcopy(v) for k, v in e.items() if k not in ("type", "source")}
                     for e in it.get("entries") or [] if isinstance(e, dict) and e.get("name") and e.get("entries")]
            add["_mod"] = {ver["addHeadersAs"]: {"mode": "appendArr", "items": items}}
        else:
            continue
        out.append(add)
    return out


def resolve_monsters(data: dict, config: dict, problems: list[str], notes: list[str], stats: dict,
                     templates: list | None = None) -> dict:
    """Monsters and legendary groups:
      - `_copy` is resolved per list, like every category;
      - every `_versions` entry becomes a monster of its own (a hag "(Coven)",
        a grung colour, a summoned spirit at each spell level), with
        `_version_of` naming the monster it was made from;
      - a monster's legendary group (lair actions, regional effects, mythic
        encounter) is copied into the monster, so each monster stands alone."""
    # A copy doesn't take its base's versions: they are named after the base
    # ("Troll (Loathsome Limbs)"), so a copy would get monsters it isn't.
    copy_keys = {key_of(m) for m in data.get("monster", []) if "_copy" in m and "_versions" not in m}
    tpl = {(_low(t.get("name")), _low(t.get("source"))): t for t in templates or []}
    if not tpl:
        problems.append("monster templates (bestiary/template.json) missing: copies that use them are left out")
    out = resolve_plain(data, config["lists"], problems, notes, stats, tpl)
    notes[:] = [n for n in notes if not n.startswith("monster ")]   # the races rule about copies and versions

    monsters, n_versions, n_variant_versions = [], 0, 0
    # A version made from a variant is named for the monster that first has
    # the variant; a copy that inherits it (Drufi, a Frost Giant) doesn't make
    # a second "Frost Giant (Optional Actions)".
    taken = {(_low(m.get("name")), _low(m.get("source"))) for m in out["monster"]}
    ordered = sorted(out["monster"], key=lambda m: key_of(m) in copy_keys or "_copy" in m)
    variant_versions = {}
    for m in ordered:
        if key_of(m) in copy_keys:
            m.pop("_versions", None)
        vv = []
        for v in variant_to_versions(m):
            k = (_low(v["name"]), _low(v["source"]))
            if k not in taken:
                taken.add(k)
                vv.append(v)
        variant_versions[id(m)] = vv
    for m in out["monster"]:
        versions = []
        if variant_versions[id(m)]:
            m["_versions"] = (m.get("_versions") or []) + variant_versions[id(m)]
            n_variant_versions += len(variant_versions[id(m)])
        if m.get("_versions"):
            try:
                versions = expand_versions(m)
            except ResolveError as e:
                problems.append(f"monster {label(m)}: {e} (versions left out)")
        m.pop("_versions", None)
        monsters.append(m)
        for v in versions:
            v = drop_nulls(v)
            v["_version_of"] = {"name": m.get("name"), "source": m.get("source")}
            v["_book"] = m.get("_book")
            monsters.append(v)
            n_versions += 1

    groups = {(_low(g.get("name")), _low(g.get("source"))): g for g in out.get("legendaryGroup", [])}
    attached, missing = 0, []
    for m in monsters:
        ref = m.pop("legendaryGroup", None)
        if not ref:
            continue
        g = groups.get((_low(ref.get("name")), _low(ref.get("source"))))
        if g is None:
            missing.append(f"{label(m)} -> {ref.get('name')} ({ref.get('source')})")
            continue
        for key in ("lairActions", "regionalEffects", "mythicEncounter"):
            if g.get(key):
                m[key] = copy.deepcopy(g[key])
        attached += 1
    for x in missing:
        problems.append(f"monster {x}: legendary group not found")
    stats["monster_rules"] = {"versions_added": n_versions, "of_them_from_variants": n_variant_versions,
                              "legendary_groups_attached": attached}
    return {"monster": monsters}


def apply_patches(name: str, data: dict, config: dict, problems: list[str], notes: list[str]) -> None:
    """patches/<category>.json: {"Name|SOURCE": {<_mod edits>}}. Fixes for
    mistakes in the 5etools data itself, applied to the raw entry before
    anything else. A patch that no longer fits (5etools fixed it, or changed
    the entry) is reported, never silently skipped."""
    path = PATCHES_PATH / f"{name}.json"
    if not path.is_file():
        return
    try:
        patches = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        problems.append(f"patches/{name}.json is broken JSON (line {e.lineno}); no patches applied")
        return
    used = set()
    for list_name in config["lists"]:
        for entry in data.get(list_name, []):
            key = f"{entry.get('name')}|{entry.get('source')}".lower()
            for pkey, mods in patches.items():
                if pkey.startswith("_") or pkey.lower() != key:
                    continue
                used.add(pkey)
                try:
                    apply_mods(entry, {k: v for k, v in mods.items() if not k.startswith("_")})
                    notes.append(f"patched {entry.get('name')} ({entry.get('source')})")
                except ResolveError as e:
                    problems.append(f"patch for {pkey} no longer fits: {e}")
    for pkey in patches:
        if not pkey.startswith("_") and pkey not in used:
            problems.append(f"patch for {pkey}: entry not found")

    # "_book_editions": {"UA2020SubclassesPt2": "classic"} gives every entry of
    # that book without an edition this edition (for books the data can't tell).
    books = {str(k).lower(): v for k, v in (patches.get("_book_editions") or {}).items()}
    bad = [k for k, v in books.items() if v not in ("classic", "one")]
    if bad:
        problems.append(f"_book_editions: edition must be classic or one ({', '.join(bad)})")
    counts: dict = {}
    for list_name in config["lists"]:
        for entry in data.get(list_name, []):
            src = str(entry.get("source", "")).lower()
            if src in books and src not in bad and not entry.get("edition"):
                entry["edition"] = books[src]
                counts[src] = counts.get(src, 0) + 1
    for src in books:
        if src in counts:
            notes.append(f"edition {books[src]} given to {counts[src]} entries of {src.upper()} (_book_editions)")
        elif src not in bad:
            problems.append(f"_book_editions: no entry without an edition from {src.upper()}")


def load_extracted(name: str, config: dict) -> tuple[dict, dict]:
    """(data, extra files). Split: the books' lists merged into one data
    dict, every entry tagged with its `_book`; files without our lists are
    returned as extra files, to pass through."""
    if not is_split(name) or not (EXTRACTED_PATH / name).is_dir():
        path = EXTRACTED_PATH / f"{name}.json"
        if not path.is_file():
            raise ResolveError(f"extracted/{name}.json missing; run the extractor first")
        try:
            return json.loads(path.read_text(encoding="utf-8")), {}
        except json.JSONDecodeError as e:
            raise ResolveError(f"broken JSON in extracted/{name}.json (line {e.lineno})")
    folder = EXTRACTED_PATH / name
    if not folder.is_dir():
        raise ResolveError(f"extracted/{name}/ missing; run the extractor first")
    data: dict = {}
    extra: dict = {}
    for p in sorted(folder.glob("*.json")):
        try:
            content = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise ResolveError(f"broken JSON in extracted/{name}/{p.name} (line {e.lineno})")
        if not any(k in content for k in config["lists"]):
            extra[p.stem] = content
            continue
        for k, v in content.items():
            if not isinstance(v, list):
                continue
            if k in config["lists"]:
                for e in v:
                    if isinstance(e, dict):
                        e["_book"] = p.stem
            data.setdefault(k, []).extend(v)
    return data, extra


def resolve_category(name: str, config: dict) -> tuple[dict, dict]:
    data, extra = load_extracted(name, config)

    problems: list[str] = []
    notes: list[str] = []
    stats: dict = {}
    apply_patches(name, data, config, problems, notes)
    if config.get("subraces"):
        out = resolve_races(data, problems, notes, stats)
    elif config.get("items"):
        out = resolve_items(data, config, problems, notes, stats)
    elif config.get("classes"):
        out = resolve_classes(data, config, problems, notes, stats)
    elif config.get("monsters"):
        out = resolve_monsters(data, config, problems, notes, stats,
                               (extra.pop("templates", None) or {}).get("monsterTemplate"))
    elif config.get("options"):
        out = resolve_with_options(data, config["lists"][0], problems, notes, stats)
    else:
        out = resolve_plain(data, config["lists"], problems, notes, stats)

    # Lists this stage doesn't handle pass through unchanged.
    for k, v in data.items():
        if k not in config["lists"]:
            out[k] = v
    if extra:
        out["_extra_files"] = {**extra, **out.get("_extra_files", {})}
    return out, {"stats": stats, "problems": problems, "notes": notes}


def save_category(name: str, config: dict, data: dict) -> None:
    """One file, or one file per book plus the passed-through files."""
    remove(RESOLVED_PATH, name)
    if not is_split(name):
        save(RESOLVED_PATH / f"{name}.json", data)
        return
    extra = data.pop("_extra_files", {})
    tables = {k: v for k, v in data.items() if k not in config["lists"]}
    if tables:
        extra["_tables"] = tables
    books: dict[str, dict] = {}
    for k in config["lists"]:
        for e in data.get(k, []):
            book = e.pop("_book", None) or "unknown"
            books.setdefault(book, {}).setdefault(k, []).append(e)
    for book, content in books.items():
        save(RESOLVED_PATH / name / f"{book}.json", content)
    for fname, content in extra.items():
        save(RESOLVED_PATH / name / f"{fname}.json", content)


# ---------- the run ----------

def save(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    os.replace(tmp, path)


def run(only: list[str] | None = None) -> bool:
    unknown = [c for c in (only or []) if c not in CATEGORIES]
    if unknown:
        print(f"Unknown categories: {', '.join(unknown)}. Known: {', '.join(CATEGORIES)}")
        return False

    report = {"categories": {}}
    report_path = RESOLVED_PATH / "_report.json"
    if only and report_path.is_file():
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass
    report["at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    all_ok = True

    for name, config in CATEGORIES.items():
        if only and name not in only:
            continue
        try:
            data, summary = resolve_category(name, config)
            save_category(name, config, data)
            report["categories"][name] = {"status": "ok", **summary}
        except ResolveError as e:
            all_ok = False
            remove(RESOLVED_PATH, name)
            report["categories"][name] = {"status": "error", "error": str(e)}

    save(report_path, report)
    print_report(report, only)
    return all_ok


def print_report(report: dict, only: list[str] | None) -> None:
    print(f"\nResolved to {RESOLVED_PATH}\n")
    for name, r in report["categories"].items():
        if only and name not in only:
            continue
        if r["status"] == "error":
            print(f"  {name:<12} ERROR  {r['error']}  (not written)")
            continue
        for lst, s in r["stats"].items():
            nums = " · ".join(f"{k}: {v}" for k, v in s.items())
            print(f"  {name:<12} {lst:<10} {nums}")
        for p in r["problems"]:
            print(f"  {'':<12} problem  {p}")
        for n in r.get("notes", []):
            print(f"  {'':<12} note     {n}")
        if not r["problems"]:
            print(f"  {'':<12} no problems")
    print("\nDetails in resolved/_report.json.\n")


if __name__ == "__main__":
    sys.exit(0 if run(sys.argv[1:] or None) else 1)
