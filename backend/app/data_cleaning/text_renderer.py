"""5etools rich text -> our clean text. Code, not the LLM.

    render(entries, problems) -> str

5etools text is structured data (paragraphs, named blocks, lists, tables)
with a fixed set of {@tag …} markups, so turning it into our text follows
fixed rules:

  - paragraphs are separated by a blank line ("\\n\\n");
  - a named block starts with its name in bold: "**Stonecunning.** Whenever…"
    (a trailing ":" or "." and a leading "Feature: " are dropped from the name);
    a nested named block gets the same treatment;
  - a list is "- item" lines; a named list item is "- **Name.** text";
  - a table is markdown, with its caption on the line above;
  - a tag shows its visible text: {@spell detect thoughts|xphb} -> "Detect
    Thoughts", {@dc 15} -> "DC 15", {@damage 2d6} -> "2d6", and a tag's third
    part is its display text: {@item arrows (20)|phb|20 arrows} -> "20 arrows".

Anything it doesn't know (a node type or a tag) is reported in `problems`
and rendered as plainly as possible, so nothing is lost silently.

Compare with the LLM's old text (no tokens spent):

    py -m app.data_cleaning.text_renderer compare races
"""

import re

DROP_BLOCKS = {"age", "alignment", "suggested characteristics"}
ABILITY = {"str": "Strength", "dex": "Dexterity", "con": "Constitution", "int": "Intelligence",
           "wis": "Wisdom", "cha": "Charisma"}
SMALL_WORDS = {"a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to",
               "with", "without", "upon"}

# ---------- tags ----------

TAG = re.compile(r"\{@(\w+)(?: ([^{}]*))?\}")     # innermost tags first (no braces inside)

# Tags whose visible text is the 3rd part when there is one, else the 1st.
PLAIN = {
    "item", "creature", "condition", "skill", "sense", "action", "variantrule", "hazard", "status", "race",
    "background", "feat", "optfeature", "itemProperty", "itemMastery", "table", "language", "class", "subclass",
    "object", "vehicle", "vehupgrade", "reward", "psionic", "trap", "cult", "boon", "disease", "charoption",
    "recipe", "facility", "legroup", "itemEntry", "classFeatureRef", "spellRef", "bonus",
}
# Tags whose visible text is always the 1st part.
FIRST = {"book", "adventure", "5etools", "filter", "link", "card", "deck", "loader", "area", "footnote",
         "homebrew", "u", "underline", "s", "strike", "sup", "sub", "code", "kbd", "highlight", "note",
         "color", "font", "help", "unit", "s2", "strikeDouble", "underlineDouble", "comic", "comicH1",
         "comicH2", "comicH3", "comicH4", "comicNote", "tip"}
ATK = {"mw": "Melee Weapon Attack:", "rw": "Ranged Weapon Attack:", "ms": "Melee Spell Attack:",
       "rs": "Ranged Spell Attack:", "mw,rw": "Melee or Ranged Weapon Attack:",
       "ms,rs": "Melee or Ranged Spell Attack:", "m": "Melee Attack:", "r": "Ranged Attack:",
       "a": "Area Attack:", "aw": "Area Weapon Attack:", "as": "Area Spell Attack:"}
ATKR = {"m": "Melee Attack Roll:", "r": "Ranged Attack Roll:", "m,r": "Melee or Ranged Attack Roll:"}
FIXED = {"h": "Hit: ", "m": "Miss: ", "hom": "Hit or Miss: ", "actSaveFail": "Failure:",
         "actSaveSuccess": "Success:", "actSaveSuccessOrFail": "Failure or Success:",
         "actTrigger": "Trigger:", "actResponse": "Response:", "dcYourSpellSave": "your spell save DC"}


def title(text: str) -> str:
    """"protection from evil and good" -> "Protection from Evil and Good"."""
    words = text.split(" ")
    out = []
    for i, w in enumerate(words):
        low = w.lower()
        if i and low in SMALL_WORDS:
            out.append(low)
        else:
            out.append(w[:1].upper() + w[1:])
    return " ".join(out)


_spell_names: dict | None = None


def spell_name(name: str) -> str:
    """A spell's real name ("pass without trace" -> "Pass without Trace"),
    from the extracted spell data; title case when it isn't there."""
    global _spell_names
    if _spell_names is None:
        _spell_names = {}
        try:
            from .data_files import EXTRACTED_PATH, load_json
            for f in sorted((EXTRACTED_PATH / "spells").glob("*.json")):
                for sp in (load_json(f).get("spell") or []):
                    if isinstance(sp, dict) and sp.get("name"):
                        _spell_names.setdefault(sp["name"].lower(), sp["name"])
        except Exception:
            pass
    return _spell_names.get(name.strip().lower()) or title(name)


# Characters you can't see, sometimes left in the 5etools text. Reported so
# we can decide what they should become.
INVISIBLE = re.compile(r"[\u00ad\u200b\u200c\u200d\u2060\ufeff]")


def _part(parts: list, i: int) -> str | None:
    return parts[i] if len(parts) > i and parts[i].strip() else None


def _tag(name: str, body: str | None, problems: list) -> str:
    parts = body.split("|") if body else []
    first = parts[0] if parts else ""
    if name in FIXED:
        return FIXED[name]
    if name in ("b", "bold"):
        return f"**{first}**"
    if name in ("i", "italic"):
        return f"*{first}*"
    if name == "dc":
        return f"DC {first}"
    if name in ("hit", "d20"):
        if _part(parts, 1):
            return parts[1]
        n = first.strip()
        return n if n.startswith(("+", "-")) else f"+{n}"
    if name in ("dice", "damage", "autodice"):
        return _part(parts, 1) or first
    if name in ("scaledamage", "scaledice"):
        return _part(parts, 3) or _part(parts, 2) or first
    if name == "chance":
        return _part(parts, 1) or f"{first} percent"
    if name == "recharge":
        return f"(Recharge {first}–6)" if first and first != "6" else "(Recharge 6)"
    if name == "atk":
        return ATK.get(first, first)
    if name == "atkr":
        return ATKR.get(first, first)
    if name == "ability":
        # {@ability int} -> "Intelligence"; {@ability str 20} -> "Strength 20"
        ab, _, rest = first.partition(" ")
        return " ".join(x for x in (ABILITY.get(ab.lower(), ab), rest) if x)
    if name == "savingThrow":
        ab, _, rest = first.partition(" ")
        return f"{ABILITY.get(ab.lower(), ab)} saving throw" + (f" {rest}" if rest else "")
    if name == "skillCheck":
        sk, _, rest = first.partition(" ")
        return title(sk.replace("_", " ")) + (f" {rest}" if rest else "")
    if name == "actSaveFailBy":
        return f"Failure by {first} or More:"
    if name == "hitYourSpellAttack":
        return first or "your spell attack modifier"
    if name == "actSave":
        return f"{ABILITY.get(first, first)} Saving Throw:"
    if name == "spell":
        return _part(parts, 2) or spell_name(first)
    if name == "quickref":
        return _part(parts, 4) or first
    if name == "classFeature":
        return _part(parts, 5) or first
    if name == "subclassFeature":
        return _part(parts, 7) or first
    if name == "deity":
        return _part(parts, 3) or first
    if name in FIRST:
        return first
    if name not in PLAIN:
        problems.append(f"text: unknown tag @{name}")
    return _part(parts, 2) or first


# A variant's text keeps "{base}" (and friends) where the base item's name
# goes; inside a tag those braces would hide the tag, so they are set aside.
PLACEHOLDER = re.compile(r"\{(base(?:_lower|_damage_type|_damage_type_lower)?)\}")


def tags(text: str, problems: list) -> str:
    """Every {@tag …} in a string -> its visible text (nested tags work)."""
    text = PLACEHOLDER.sub(lambda m: f"\u0001{m.group(1)}\u0002", str(text))
    for ch in set(INVISIBLE.findall(text)):
        problems.append(f"text: invisible character U+{ord(ch):04X}")
    for _ in range(20):
        new = TAG.sub(lambda m: _tag(m.group(1), m.group(2), problems), text)
        if new == text:
            break
        text = new
    if "{@" in text:
        i = text.index("{@")
        problems.append(f"text: a tag could not be read: '{text[i:i + 60]}'")
    return text.replace("\u0001", "{").replace("\u0002", "}")


# ---------- blocks ----------

def block_name(name: str, problems: list) -> str:
    n = tags(name, problems).strip()
    n = re.sub(r"^Feature:\s*", "", n)
    return n.rstrip(" :.").strip()


def kept_entries(entries) -> list:
    """All text blocks except Age, Alignment and Suggested Characteristics."""
    return [e for e in entries or []
            if not (isinstance(e, dict) and str(e.get("name") or "").strip(" .:").lower() in DROP_BLOCKS)]


def _cell(c, problems: list) -> str:
    if isinstance(c, dict):
        if c.get("type") == "cell":
            roll = c.get("roll")
            if roll:
                pad = (lambda n: f"{n:02d}") if roll.get("pad") else str
                if "exact" in roll:
                    return pad(roll["exact"])
                return f"{pad(roll.get('min'))}–{pad(roll.get('max'))}"
            return _inline(c.get("entry", ""), problems)
        return _inline(c, problems)
    return tags(c, problems) if isinstance(c, str) else str(c)


def _inline(node, problems: list) -> str:
    """A node rendered on one line (table cells, list items)."""
    if isinstance(node, str):
        return tags(node, problems)
    return " ".join(p.replace("\n\n", " ") for p in _blocks(node, problems))


def _table(t: dict, problems: list) -> str:
    lines = []
    if t.get("caption"):
        lines.append(tags(t["caption"], problems))
        lines.append("")
    labels = [_cell(x, problems) for x in t.get("colLabels") or []]
    rows = []
    for r in t.get("rows") or []:
        if isinstance(r, dict) and r.get("type") == "row":
            r = r.get("row") or []
        rows.append([_cell(c, problems) for c in (r if isinstance(r, list) else [r])])
    width = max([len(labels)] + [len(r) for r in rows] + [1])
    if labels:
        lines.append(" | ".join(labels))
        lines.append(" | ".join(["---"] * width))
    for r in rows:
        lines.append(" | ".join(x.replace("\n", " ") for x in r))
    out = "\n".join(lines)
    notes = [tags(f, problems) if isinstance(f, str) else _inline(f, problems) for f in t.get("footnotes") or []]
    return "\n\n".join([out] + notes)


def _list_lines(lst: dict, problems: list, indent: str = "") -> list[str]:
    lines = []
    for it in lst.get("items") or []:
        if isinstance(it, str):
            lines.append(f"{indent}- {tags(it, problems)}")
        elif isinstance(it, dict) and it.get("type") in ("item", "itemSub", "itemSpell"):
            name = block_name(it.get("name") or "", problems)
            texts, subs = [], []
            for x in ([it["entry"]] if "entry" in it else []) + list(it.get("entries") or []):
                if isinstance(x, dict) and x.get("type") == "list":
                    subs += _list_lines(x, problems, indent + "  ")
                else:
                    texts.append(_inline(x, problems))
            head = f"**{name}.** " if name else ""
            lines.append(f"{indent}- {head}{' '.join(texts)}".rstrip())
            lines += subs
        elif isinstance(it, dict) and it.get("type") == "list":
            lines += _list_lines(it, problems, indent + "  ")
        else:
            lines.append(f"{indent}- {_inline(it, problems)}")
    return lines


# Class features point at other features ({"type": "refClassFeature"}). How
# those are shown depends on who asks, so the class cleaner sets this while it
# renders: a function (kind, ref) -> list of paragraphs. Without it they are
# reported as unknown blocks.
REFS = None


def _ref_name(ref: str) -> str:
    return str(ref).split("|")[0].strip()


def _ref_paras(node: dict, problems: list) -> list[str]:
    t = node.get("type")
    ref = node.get("classFeature") or node.get("subclassFeature") or node.get("optionalfeature") \
        or node.get("feat") or ""
    if t in ("refOptionalfeature", "refFeat"):
        # an option from the optional-features or feats catalogue: shown by name
        return [f"- {title(_ref_name(ref))}"]
    if REFS is None:
        problems.append(f"text: '{t}' outside a class")
        return [f"**{_ref_name(ref)}.**"]
    return REFS(t, ref)


def _group_lines(paras: list) -> list[str]:
    """Consecutive optional-feature names become one list."""
    out, prev_ref = [], False
    for p, is_ref in paras:
        if is_ref and prev_ref and out:
            out[-1] += "\n" + p
        else:
            out.append(p)
        prev_ref = is_ref
    return out


def _children(children: list, problems: list) -> list[str]:
    paras = []
    for ch in children:
        is_ref = isinstance(ch, dict) and ch.get("type") in ("refOptionalfeature", "refFeat")
        paras += [(p, is_ref) for p in _blocks(ch, problems)]
    return _group_lines(paras)


def _named(name: str | None, children: list, problems: list) -> list[str]:
    """A named block: its name in bold before the first paragraph."""
    paras = _children(children, problems)
    if not name:
        return paras
    n = block_name(name, problems)
    if not n:
        return paras
    if children and isinstance(children[0], str) and paras:
        paras[0] = f"**{n}.** {paras[0]}"
        return paras
    return [f"**{n}.**"] + paras


def _blocks(node, problems: list) -> list[str]:
    """One node -> a list of paragraphs."""
    if isinstance(node, str):
        t = tags(node, problems).strip()
        return [t] if t else []
    if isinstance(node, list):
        return _children(node, problems)
    if not isinstance(node, dict):
        return [str(node)]
    t = node.get("type", "entries")
    if t in ("entries", "inset", "insetReadaloud", "variant", "variantInner", "variantSub", "section", "options"):
        return _named(node.get("name"), list(node.get("entries") or []), problems)
    if t == "list":
        lines = _list_lines(node, problems)
        return ["\n".join(lines)] if lines else []
    if t == "table":
        return [_table(node, problems)]
    if t == "tableGroup":
        return [_table(x, problems) for x in node.get("tables") or []]
    if t == "quote":
        paras = [f"*{p}*" for p in _blocks(list(node.get("entries") or []), problems)]
        if node.get("by"):
            paras.append(f"— {tags(node['by'], problems)}" + (f", {tags(node['from'], problems)}" if node.get("from") else ""))
        return paras
    if t in ("inline", "inlineBlock"):
        return ["".join(_inline(x, problems) for x in node.get("entries") or [])]
    if t in ("item", "itemSub", "itemSpell"):
        return _list_lines({"items": [node]}, problems)
    if t == "link":
        return [tags(node.get("text", ""), problems)]
    if t == "abilityDc":
        ab = " or ".join(ABILITY.get(a, a) for a in node.get("attributes") or [])
        return [f"**{node.get('name', 'Spell')} save DC** = 8 + your proficiency bonus + your {ab} modifier"]
    if t == "abilityAttackMod":
        ab = " or ".join(ABILITY.get(a, a) for a in node.get("attributes") or [])
        return [f"**{node.get('name', 'Spell')} attack modifier** = your proficiency bonus + your {ab} modifier"]
    if t in ("refClassFeature", "refSubclassFeature", "refOptionalfeature", "refFeat"):
        return _ref_paras(node, problems)
    if t == "spellcasting":
        return _spellcasting_block(node, problems)
    if t == "statblock":
        return [f"**{tags(node.get('displayName') or node.get('name', ''), problems)}** (stat block)"]
    if t in ("hr", "image", "gallery", "pagebreak"):
        return []
    problems.append(f"text: unknown block type '{t}'")
    return _named(node.get("name"), list(node.get("entries") or node.get("items") or []), problems)


SPELL_GROUP_LABELS = {"will": "At will", "constant": "Constant", "ritual": "Rituals"}
SPELL_PER = {"daily": "day", "rest": "short rest", "restLong": "long rest", "weekly": "week", "yearly": "year"}


def _spellcasting_block(node: dict, problems: list) -> list[str]:
    """A spellcasting block written inside a trait: its header, then one
    line per group ("1/day each: Darkness, Faerie Fire")."""
    paras = _named(node.get("name"), list(node.get("headerEntries") or []), problems)
    lines = []
    for key, label in SPELL_GROUP_LABELS.items():
        if node.get(key):
            lines.append(f"- {label}: " + ", ".join(tags(x, problems) for x in node[key] if isinstance(x, str)))
    for key, per in SPELL_PER.items():
        for n, lst in (node.get(key) or {}).items():
            each = " each" if str(n).endswith("e") else ""
            lines.append(f"- {str(n).rstrip('e')}/{per}{each}: " + ", ".join(tags(x, problems) for x in lst if isinstance(x, str)))
    for lvl, d in (node.get("spells") or {}).items():
        label = "Cantrips (at will)" if str(lvl) == "0" else f"Level {lvl}" + (f" ({d['slots']} slots)" if d.get("slots") else "")
        lines.append(f"- {label}: " + ", ".join(tags(x, problems) for x in d.get("spells") or [] if isinstance(x, str)))
    if lines:
        paras.append("\n".join(lines))
    return paras + _blocks(list(node.get("footerEntries") or []), problems)


def render(entries, problems: list | None = None) -> str:
    """A list of 5etools entries -> one clean text."""
    problems = [] if problems is None else problems
    return "\n\n".join(p for p in _blocks(list(entries or []), problems) if p.strip())


# ---------- compare with the old LLM text ----------

def compare(category: str, show: int = 10) -> None:
    import difflib

    from .data_files import CLEANED_PATH, read_cache, read_list

    cache = read_cache(category)
    same, close, differ = 0, [], []

    def check(e):
        nonlocal same
        rec = cache.get(e["id"])
        old = ((rec or {}).get("output") or {}).get("text")
        if old is None or e.get("text") is None:
            return
        if old.strip() == e["text"].strip():
            same += 1
            return
        ratio = difflib.SequenceMatcher(None, old, e["text"]).ratio()
        (close if ratio >= 0.97 else differ).append((ratio, e["id"], old, e["text"]))

    for e in read_list(CLEANED_PATH, category):
        check(e)
        for child in (e.get("subraces") or []) + (e.get("options") or []):
            check(child)
    total = same + len(close) + len(differ)
    print(f"\n{category}: {total} entries with an LLM text")
    print(f"  identical: {same}   nearly (97%+): {len(close)}   different: {len(differ)}\n")
    for ratio, jid, old, new in sorted(differ)[:show] + sorted(close)[:max(0, show - len(differ))]:
        print(f"--- {jid}  ({ratio:.0%} the same)")
        for line in difflib.unified_diff(old.split("\n"), new.split("\n"), "llm", "code", lineterm="", n=0):
            if not line.startswith(("---", "+++", "@@")):
                print("   ", line[:200])
        print()


if __name__ == "__main__":
    import sys
    if len(sys.argv) >= 3 and sys.argv[1] == "compare":
        for cat in sys.argv[2:]:
            compare(cat)
    else:
        print("usage: py -m app.data_cleaning.text_renderer compare <category> [<category> …]")
