"""The numbers a character sheet shows, worked out from the save file.

Nothing here is stored (claude/character-plan.md "Derived numbers are not
stored"): ability totals, saves, skills, proficiency bonus, max HP, AC,
speed, spell slots, spell attack and DC, resources… come from the layers,
the inventory and the class copies every time. The frontend has the same
rules in src/utils/derive.js; both give the same answer for the same file.

Where the numbers come from:

  layers        every layer's `grants`, its features' `modifiers` (a
                toggle's only while it is switched on, `on: true`), and
                the layer's own `modifiers`
  manual layer  {from: "manual", grants, removes, modifiers, custom_skills,
                 slot_overrides, pact_overrides, resources, spell_ability}
                what the player added or changed by hand. `removes` takes
                away what another layer gave ({"skills": ["stealth"],
                "senses": ["darkvision"]}); the slot overrides and
                `resources` replace or add slots and pools.
  inventory     equipped items' `grants`, `modifiers` and features (attuned
                ones only when they need attunement); worn armour / shield for AC
  classes       the character's own copy of each class and subclass record
                it has (hit die, hp, columns, resources, spellcasting), by id

A modifier is {target, add | set | min | base, requires?}:
  add   added on top          set   the final value, whatever else says
  min   at least this         base  an unarmoured AC option (AC only)
Targets: ac, hp_max, pb, initiative, str…cha (the score), save, save.<ab>,
check, check.<ab>, check.<skill>, speed, speed.<type>, senses.<type>, attack,
spell_attack, spell_dc, concentration, damage, spell_damage.

`classes` maps a class or subclass id to its record; when it's not given,
the file's own `classes` copy is used. Formulas go through formulas.py.
"""

import math
import re

try:
    from app.formulas import evaluate
except ImportError:  # run from this folder
    from formulas import evaluate

ABILITIES = ("str", "dex", "con", "int", "wis", "cha")
SCORE_CAP = 20
BODY_ARMOR = {"light", "medium", "heavy"}

SKILLS = {
    "acrobatics": ("Acrobatics", "dex"), "animal_handling": ("Animal Handling", "wis"),
    "arcana": ("Arcana", "int"), "athletics": ("Athletics", "str"),
    "deception": ("Deception", "cha"), "history": ("History", "int"),
    "insight": ("Insight", "wis"), "intimidation": ("Intimidation", "cha"),
    "investigation": ("Investigation", "int"), "medicine": ("Medicine", "wis"),
    "nature": ("Nature", "int"), "perception": ("Perception", "wis"),
    "performance": ("Performance", "cha"), "persuasion": ("Persuasion", "cha"),
    "religion": ("Religion", "int"), "sleight_of_hand": ("Sleight of Hand", "dex"),
    "stealth": ("Stealth", "dex"), "survival": ("Survival", "wis"),
}

# Grant kinds that are plain lists of ids, and where the sheet shows them.
LIST_KINDS = ("skills", "saves", "expertise", "armor", "weapons", "tools", "languages", "weapon_masteries")
DEFENSES = ("resist", "immune", "vulnerable", "condition_immune")

# Multiclass spell slots by caster level (the shared table), 1st..9th.
MULTICLASS_SLOTS = [
    [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
    [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
    [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
    [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
]
_CLASS_FROM = re.compile(r"^class:([^@/]+)@(\d+)$")


def _is_n(v):
    return isinstance(v, int) and not isinstance(v, bool)


def _num(v, default=0):
    return v if _is_n(v) else default


def _table(table, level):
    """A level table's row for `level` (the highest row at or below it)."""
    if not isinstance(table, dict):
        return table
    rows = [int(k) for k in table if str(k).isdigit() and int(k) <= level]
    return table[str(max(rows))] if rows else None


def _union(a, b):
    out = list(a or [])
    for x in b or []:
        if x not in out:
            out.append(x)
    return out


def _layers(ch):
    return [l for l in ch.get("layers") or [] if isinstance(l, dict)]


def manual_layer(ch):
    """The player's own layer (an empty one when there is none yet)."""
    return next((l for l in _layers(ch) if l.get("from") == "manual"), {"from": "manual"})


def _classes_of(ch, classes):
    return classes if classes is not None else (ch.get("classes") or {})


# ─── classes and levels ───────────────────────────────────────────

def class_levels(ch):
    """[(class id, level, subclass id or None)] in the order taken.
    Each class level is its own layer, `from: "class:<id>@<level>"`; the
    subclass is the `subclass` grant one of them got from its pick."""
    out = {}
    for layer in _layers(ch):
        m = _CLASS_FROM.match(str(layer.get("from") or ""))
        if not m:
            continue
        cid, lvl = m.group(1), int(m.group(2))
        cur = out.setdefault(cid, {"level": 0, "subclass": None})
        cur["level"] = max(cur["level"], lvl)
        sub = (layer.get("grants") or {}).get("subclass")
        if sub:
            cur["subclass"] = sub
    return [(cid, v["level"], v["subclass"]) for cid, v in out.items()]


def total_level(ch):
    return sum(lvl for _, lvl, _ in class_levels(ch))


def proficiency_bonus(level):
    return 2 + (max(1, level) - 1) // 4


# ─── grants: what every layer gives, minus what the player removed ─

def _working_items(ch):
    """Items that count: equipped, and attuned when they need it."""
    for item in (ch.get("inventory") or {}).get("items") or []:
        if not isinstance(item, dict) or not item.get("equipped"):
            continue
        if (item.get("attunement") or {}).get("required") and not item.get("attuned"):
            continue
        yield item


def _toggled_on(layer):
    """The toggles switched on among a layer's (or an item's) features,
    and among its spells' (Mage Armor, Shield, Bless while they're on)."""
    for f in layer.get("features") or []:
        t = f.get("toggle")
        if f.get("on") and f.get("active") is not False and not f.get("removed") and isinstance(t, dict):
            yield t
    for s in layer.get("spells") or []:
        if not isinstance(s, dict) or s.get("removed"):
            continue
        for f in s.get("features") or []:
            t = f.get("toggle") if isinstance(f, dict) else None
            if f.get("on") and isinstance(t, dict):
                yield t


def granted(ch):
    """Every layer's grants put together (lists joined, speed and senses
    the highest), then the manual layer's `removes` taken away.
    Returns (grants, removed): `removed` lists what was really taken away."""
    lists = {k: [] for k in LIST_KINDS}
    speed, senses, senses_bonus = {}, {}, {}
    defenses = {k: [] for k in DEFENSES}

    def add(g):
        for k in LIST_KINDS:
            lists[k] = _union(lists[k], g.get(k))
        for target, src in ((speed, g.get("speed")), (senses, g.get("senses"))):
            for k, v in (src or {}).items():
                old = target.get(k)
                if _is_n(old) and _is_n(v):
                    target[k] = max(old, v)  # grants set: the highest wins
                elif old is None or (_is_n(v) and not _is_n(old)):
                    target[k] = v  # a number beats "walk" or a flag
        for k, v in (g.get("senses_bonus") or {}).items():
            senses_bonus[k] = senses_bonus.get(k, 0) + _num(v)
        for k in DEFENSES:
            defenses[k] = _union(defenses[k], (g.get("defenses") or {}).get(k))

    for layer in _layers(ch):
        add(layer.get("grants") or {})
        for t in _toggled_on(layer):
            add(t.get("grants") or {})
    for item in _working_items(ch):  # boots of speed, a ring of resistance…
        add(item.get("grants") or {})
        for t in _toggled_on(item):
            add(t.get("grants") or {})

    removes = manual_layer(ch).get("removes") or {}
    removed = {}
    for k in LIST_KINDS:
        gone = [x for x in lists[k] if x in (removes.get(k) or [])]
        if gone:
            removed[k] = gone
            lists[k] = [x for x in lists[k] if x not in gone]
    for k, target in (("speed", speed), ("senses", senses)):
        gone = [x for x in removes.get(k) or [] if x in target]
        if gone:
            removed[k] = gone
            for x in gone:
                target.pop(x, None)
    for k in DEFENSES:
        gone = [x for x in defenses[k] if x in ((removes.get("defenses") or {}).get(k) or [])]
        if gone:
            removed.setdefault("defenses", {})[k] = gone
            defenses[k] = [x for x in defenses[k] if x not in gone]

    return {**lists, "speed": speed, "senses": senses, "senses_bonus": senses_bonus, "defenses": defenses}, removed


# ─── ability scores ───────────────────────────────────────────────

def base_scores(ch):
    """Base score + every layer's ability grants (the manual layer's too).
    20 at most, unless a grant raises the ceiling (`ability_max`)."""
    base = (ch.get("abilities") or {}).get("base") or {}
    scores = {a: _num(base.get(a), 10) for a in ABILITIES}
    caps = {a: SCORE_CAP for a in ABILITIES}
    for layer in _layers(ch):
        g = layer.get("grants") or {}
        for a, n in (g.get("ability") or {}).items():
            if a in scores:
                scores[a] += _num(n)
        for a, n in (g.get("ability_max") or {}).items():
            if a in caps:
                caps[a] = max(caps[a], _num(n, SCORE_CAP))
    return {a: min(scores[a], caps[a]) for a in ABILITIES}


def mod(score):
    return (score - 10) // 2


def words(ch, scores, cls=None, class_level=None, spell_ability=None):
    """The words a formula may use, for this character (and one of its classes).
    A class's table columns are added as words (sneak_attack: "3d6")."""
    level = total_level(ch)
    w = {"level": level, "pb": proficiency_bonus(level)}
    for a in ABILITIES:
        w[a] = scores[a]
        w[f"{a}_mod"] = mod(scores[a])
    if cls is not None and class_level is not None:
        w["class_level"] = class_level
        for col in cls.get("columns") or []:
            v = _table(col.get("values"), class_level)
            if v is not None:
                w[col["id"]] = v
        spell_ability = spell_ability or (cls.get("spellcasting") or {}).get("ability")
    if spell_ability in ABILITIES:
        w["spell_mod"] = w[f"{spell_ability}_mod"]
    return w


# ─── modifiers from everywhere ────────────────────────────────────

def _class_context(ch, classes, frm):
    m = _CLASS_FROM.match(str(frm or ""))
    if not m:
        return None, None
    lvl = next((l for c, l, _ in class_levels(ch) if c == m.group(1)), None)
    return classes.get(m.group(1)), lvl


def active_modifiers(ch, classes, scores):
    """[(modifier, words)] that apply now: every layer's own `modifiers`
    (the manual layer's are the player's), every feature's, a toggle's
    while it is switched on (`on: true` on the copy), and equipped items'
    (attuned ones only when they need it)."""
    out = []
    for layer in _layers(ch):
        cls, lvl = _class_context(ch, classes, layer.get("from"))
        w = words(ch, scores, cls, lvl)
        for m in layer.get("modifiers") or []:
            out.append((m, w))
        for f in layer.get("features") or []:
            if f.get("active") is False or f.get("removed"):  # hidden, or taken off the sheet
                continue
            for m in f.get("modifiers") or []:
                out.append((m, w))
        for t in _toggled_on(layer):
            for m in t.get("modifiers") or []:
                out.append((m, w))
    w = words(ch, scores)
    for item in _working_items(ch):
        for m in item.get("modifiers") or []:
            out.append((m, w))
        for f in item.get("features") or []:
            if f.get("active") is False or f.get("removed"):  # hidden, or taken off the sheet
                continue
            for m in f.get("modifiers") or []:
                out.append((m, w))
        for t in _toggled_on(item):
            for m in t.get("modifiers") or []:
                out.append((m, w))
    return [(m, w) for m, w in out if isinstance(m, dict)]


def _value(v, w):
    got = evaluate(v, w, w.get("class_level") or w.get("level"))
    return got if isinstance(got, int) else None  # dice don't add to a fixed number


def _apply(total, mods, targets):
    """`add`s, then `min`s, then `set`s of the modifiers aimed at `targets`."""
    hits = [(m, w) for m, w in mods if m.get("target") in targets]
    for m, w in hits:
        if m.get("add") is not None:
            total += _value(m["add"], w) or 0
    for m, w in hits:
        if m.get("min") is not None:
            got = _value(m["min"], w)
            if got is not None:
                total = max(total, got)
    for m, w in hits:
        if m.get("set") is not None:
            got = _value(m["set"], w)
            if got is not None:
                total = got
    return total


def ability_scores(ch, classes=None, mods=None):
    """Final scores: the base and grants, then score modifiers (an item's
    "your Strength is 19", a hand-written +1)."""
    classes = _classes_of(ch, classes)
    scores = base_scores(ch)
    mods = mods if mods is not None else active_modifiers(ch, classes, scores)
    return {a: _apply(scores[a], mods, (a,)) for a in ABILITIES}


# ─── HP ───────────────────────────────────────────────────────────

def max_hp(ch, classes=None, scores=None, mods=None):
    """Per class level, by its key ("class:<id>@<n>"): a number the player
    set (`hp.set`, the HP that level gave, nothing added), else a roll
    (`hp.rolls`) + Con mod, else the first class's first level `hp.first`
    and every other level `hp.per_level` (the average). A level never
    gives less than 1. Then every `hp_max` modifier (Tough, Dwarven
    Toughness). Mode "manual" replaces all of it with `hp.manual`."""
    classes = _classes_of(ch, classes)
    scores = scores or ability_scores(ch, classes)
    mods = mods if mods is not None else active_modifiers(ch, classes, scores)
    hp = ch.get("hp") or {}
    w = words(ch, scores)
    if hp.get("mode") == "manual" and isinstance(hp.get("manual"), int):
        total = hp["manual"]
    else:
        total = 0
        rolls = hp.get("rolls") or {}
        sets = hp.get("set") or {}
        first = True
        for cid, lvl, _ in class_levels(ch):
            rec = (classes.get(cid) or {}).get("hp") or {}
            for n in range(1, lvl + 1):
                key = f"class:{cid}@{n}"
                if _is_n(sets.get(key)):
                    gained = int(sets[key])
                    first = False
                elif first:
                    gained = _value(rec.get("first"), w)
                    first = False
                elif _is_n(rolls.get(key)):
                    gained = int(rolls[key]) + w["con_mod"]
                else:
                    gained = _value(rec.get("per_level"), w)
                total += max(1, gained or 0)
    return max(0, _apply(total, mods, ("hp_max",)))


# ─── AC (data-model §2 "AC") ──────────────────────────────────────

def armor_class(ch, classes=None, scores=None, mods=None):
    """Worn armour (or 10 + Dex), or a `base` (Mage Armor, Unarmored
    Defense) when that's higher, worn armour or not (the player's choice:
    the higher one counts); + shield and every `add` whose `requires` is
    met, then `min`, then `set`."""
    classes = _classes_of(ch, classes)
    scores = scores or ability_scores(ch, classes)
    mods = mods if mods is not None else active_modifiers(ch, classes, scores)
    dex = mod(scores["dex"])
    items = [i for i in (ch.get("inventory") or {}).get("items") or [] if i.get("equipped") and i.get("armor")]
    body = next((i for i in items if (i["armor"].get("category") or "") in BODY_ARMOR), None)
    shield = next((i for i in items if i["armor"].get("category") == "shield"), None)
    state = {"armor": bool(body), "no_armor": not body, "shield": bool(shield), "no_shield": not shield}
    def met(m):
        reqs = m.get("requires") or []
        if m.get("base") is not None:  # a base competes with the armour: the higher one wins
            reqs = [r for r in reqs if r not in ("armor", "no_armor")]
        return all(state.get(r, False) for r in reqs)

    mods = [(m, mw) for m, mw in mods if m.get("target") == "ac" and met(m)]

    if body:
        a = body["armor"]
        cap = a.get("dex_cap")
        ac = _num(a.get("base"), 10) + (dex if cap is None else min(dex, cap))
    else:
        ac = 10 + dex
    for m, mw in mods:
        if m.get("base") is not None:
            ac = max(ac, _value(m["base"], mw) or 0)
    if shield:
        ac += _num(shield["armor"].get("base"), 2)
    return _apply(ac, mods, ("ac",))


# ─── spell slots ──────────────────────────────────────────────────

def _caster_share(progression, level):
    return {
        "full": level,
        "half": level // 2,
        "half_up": math.ceil(level / 2),
        "third": level // 3,
    }.get(progression, 0)


def book_slots(ch, classes=None):
    """The slots the class levels give: ([per spell level 1..9], pact or None).
    One slot-casting class reads its own table; two or more add up their
    caster levels on the shared table. Pact Magic stays separate."""
    classes = _classes_of(ch, classes)
    casting = []  # (record's spellcasting, class level)
    pact = None
    for cid, lvl, sub in class_levels(ch):
        for rec in (classes.get(cid), classes.get(sub) if sub else None):
            sc = (rec or {}).get("spellcasting") or {}
            prog = sc.get("progression")
            if prog == "pact":
                p = sc.get("pact") or {}
                count, slot_level = _table(p.get("slots"), lvl), _table(p.get("level"), lvl)
                if count and slot_level:
                    pact = {"count": count, "level": slot_level}
            elif prog:
                casting.append((sc, lvl))
    if len(casting) == 1:
        sc, lvl = casting[0]
        slots = _table(sc.get("slots"), lvl) or []
    else:
        caster_level = sum(_caster_share(sc.get("progression"), lvl) for sc, lvl in casting)
        slots = MULTICLASS_SLOTS[min(caster_level, 20) - 1] if caster_level > 0 else []
    return list(slots), pact


def _level_map(over):
    """The player's slot numbers {"3": 2} → {3: 2}, levels 1–9 only."""
    out = {}
    for k, v in (over or {}).items():
        if str(k).isdigit() and 1 <= int(k) <= 9 and _is_n(v):
            out[int(k)] = max(0, v)
    return out


def spell_slots(ch, classes=None):
    """{"slots": [count per spell level 1..9, trailing zeros dropped],
        "pact": [{"level", "count"}] by level,
        "book": the same two as the class levels give them}.
    The player's own numbers (the manual layer's `slot_overrides` and
    `pact_overrides`, {"<level>": count}) replace the book's for that
    level: any character can have any slots, pact slots at any levels."""
    classes = _classes_of(ch, classes)
    book, pact = book_slots(ch, classes)
    book_pact = {pact["level"]: pact["count"]} if pact else {}
    man = manual_layer(ch)
    over, pover = _level_map(man.get("slot_overrides")), _level_map(man.get("pact_overrides"))
    slots = [over.get(i, book[i - 1] if i <= len(book) else 0) for i in range(1, 10)]
    while slots and not slots[-1]:
        slots.pop()
    pacts = {lvl: n for lvl, n in {**book_pact, **pover}.items() if n > 0}
    return {
        "slots": slots,
        "pact": [{"level": l, "count": pacts[l]} for l in sorted(pacts)],
        "book": {"slots": list(book), "pact": [{"level": l, "count": book_pact[l]} for l in sorted(book_pact)]},
    }


# ─── resources (Rage, Focus Points, Superiority Dice…) ────────────

def resources(ch, classes=None, scores=None):
    """Every class and subclass pool, worked out at that class's level, then
    the player's own pools and changes (the manual layer's `resources`):
    [{id, name, max, die, reset, short_rest, owner, book_max, own, edited}].
    A pool two records share (the same id) is listed once, the larger max."""
    classes = _classes_of(ch, classes)
    scores = scores or ability_scores(ch, classes)
    out = {}
    for cid, lvl, sub in class_levels(ch):
        cls = classes.get(cid) or {}
        for rec_id in (cid, sub):
            rec = classes.get(rec_id) if rec_id else None
            if not rec:
                continue
            w = words(ch, scores, cls, lvl, (rec.get("spellcasting") or {}).get("ability"))
            for r in rec.get("resources") or []:
                if not isinstance(r, dict) or not r.get("id"):
                    continue
                top = evaluate(r.get("max"), w, lvl)
                top = top if isinstance(top, int) else 0
                die = evaluate(r.get("die"), w, lvl) if r.get("die") is not None else None
                old = out.get(r["id"])
                if old and old["max"] >= top:
                    continue
                out[r["id"]] = {
                    "id": r["id"], "name": r.get("name") or r["id"], "max": max(0, top),
                    "die": die if isinstance(die, str) else None,
                    "reset": r.get("reset") or "long", "short_rest": r.get("short_rest", "all"),
                    "owner": rec_id, "book_max": max(0, top), "own": False, "edited": False,
                }
    # The player's pools: their own ones, and changes to the classes' ones
    # (same id: only the fields written replace the book's; removed: true hides it).
    w = words(ch, scores)
    for r in manual_layer(ch).get("resources") or []:
        if not isinstance(r, dict) or not r.get("id"):
            continue
        rid = r["id"]
        if r.get("removed"):
            out.pop(rid, None)
            continue
        own = rid not in out
        cur = dict(out.get(rid) or {"id": rid, "name": rid, "max": 0, "die": None, "reset": "long",
                                     "short_rest": "all", "owner": "manual", "book_max": None})
        if r.get("name"):
            cur["name"] = r["name"]
        if r.get("max") is not None:
            got = evaluate(r["max"], w, w["level"])
            cur["max"] = max(0, got) if _is_n(got) else cur["max"]
        if r.get("die") is not None:
            got = evaluate(r["die"], w, w["level"])
            cur["die"] = got if isinstance(got, str) else None
        for k in ("reset", "short_rest"):
            if r.get(k) is not None:
                cur[k] = r[k]
        cur["own"] = own
        cur["edited"] = not own
        out[rid] = cur
    return list(out.values())


# ─── everything at once ───────────────────────────────────────────

def derive(ch, classes=None):
    """Every number the sheet shows, in one dict (the same keys as derive.js)."""
    classes = _classes_of(ch, classes)
    level = total_level(ch)
    raw = base_scores(ch)
    mods = active_modifiers(ch, classes, raw)
    scores = {a: _apply(raw[a], mods, (a,)) for a in ABILITIES}
    mods = active_modifiers(ch, classes, scores)  # formulas see the final scores
    g, removed = granted(ch)
    w = words(ch, scores)

    pb = _apply(proficiency_bonus(level), mods, ("pb",))
    expertise = set(g["expertise"])

    abilities = {}
    for a in ABILITIES:
        m = mod(scores[a])
        prof = a in g["saves"]
        abilities[a] = {
            "score": scores[a], "mod": m,
            "check": _apply(m, mods, ("check", f"check.{a}")),
            "save": _apply(m + (pb if prof else 0), mods, ("save", f"save.{a}")),
            "save_prof": prof,
        }

    custom = manual_layer(ch).get("custom_skills") or {}
    skill_defs = {k: {"label": label, "ability": ab, "custom": False} for k, (label, ab) in SKILLS.items()}
    for k, v in custom.items():
        if isinstance(v, dict) and v.get("ability") in ABILITIES:
            skill_defs[k] = {"label": v.get("label") or k, "ability": v["ability"], "custom": True}
    skills = {}
    for k, d in skill_defs.items():
        prof = 2 if k in expertise and k in g["skills"] else 1 if k in g["skills"] else 0
        total = _apply(mod(scores[d["ability"]]) + pb * prof, mods, ("check", f"check.{d['ability']}", f"check.{k}"))
        skills[k] = {**d, "prof": prof, "total": total, "passive": 10 + total}

    speed = {}
    for k, v in g["speed"].items():
        speed[k] = v
    for k, v in list(speed.items()):
        if v == "walk":
            speed[k] = speed.get("walk") if isinstance(speed.get("walk"), int) else 0
    for k in [k for k, v in speed.items() if _is_n(v)]:
        speed[k] = max(0, _apply(speed[k], mods, (f"speed.{k}",) + (("speed",) if k == "walk" else ())))
    senses = dict(g["senses"])
    for k, n in g["senses_bonus"].items():
        senses[k] = _num(senses.get(k)) + n
    for k in [k for k, v in senses.items() if _is_n(v)]:
        senses[k] = max(0, _apply(senses[k], mods, (f"senses.{k}",)))

    casting = []
    for cid, lvl, sub in class_levels(ch):
        for rec_id in (cid, sub):
            sc = ((classes.get(rec_id) or {}).get("spellcasting") or {}) if rec_id else {}
            ab = sc.get("ability")
            if ab in ABILITIES:
                m = mod(scores[ab])
                casting.append({
                    "owner": rec_id, "name": (classes.get(rec_id) or {}).get("name") or rec_id, "ability": ab,
                    "attack": _apply(pb + m, mods, ("spell_attack",)),
                    "dc": _apply(8 + pb + m, mods, ("spell_dc",)),
                })

    own_ab = manual_layer(ch).get("spell_ability")
    if own_ab in ABILITIES:  # spells with no class (anyone can have them)
        m = mod(scores[own_ab])
        casting.append({
            "owner": "manual", "name": "Your own", "ability": own_ab,
            "attack": _apply(pb + m, mods, ("spell_attack",)),
            "dc": _apply(8 + pb + m, mods, ("spell_dc",)),
        })

    class_rows, hit_dice = [], {}
    for cid, lvl, sub in class_levels(ch):
        rec = classes.get(cid) or {}
        die = rec.get("hit_die") or "d8"
        hit_dice[die] = hit_dice.get(die, 0) + lvl
        class_rows.append({
            "id": cid, "name": rec.get("name") or cid, "level": lvl, "hit_die": die,
            "edition": rec.get("edition"), "subclass": sub,
            "subclass_name": (classes.get(sub) or {}).get("name") if sub else None,
        })

    return {
        "level": level,
        "pb": pb,
        "classes": class_rows,
        "abilities": abilities,
        "skills": skills,
        "initiative": _apply(mod(scores["dex"]), mods, ("initiative",)),
        "hp_max": max_hp(ch, classes, scores, mods),
        "ac": armor_class(ch, classes, scores, mods),
        "speed": speed,
        "senses": senses,
        "defenses": g["defenses"],
        "proficiencies": {k: g[k] for k in ("armor", "weapons", "tools", "languages", "weapon_masteries")},
        "hit_dice": hit_dice,
        "spell_slots": spell_slots(ch, classes),
        "spellcasting": casting,
        "attacks": {
            "melee": _apply(pb + w["str_mod"], mods, ("attack",)),
            "ranged": _apply(pb + w["dex_mod"], mods, ("attack",)),
        },
        "concentration": _apply(abilities["con"]["save"], mods, ("concentration",)),
        "bonuses": {  # what every attack / spell / hit gets on top (features and weapons use them)
            "attack": _apply(0, mods, ("attack",)),
            "spell_attack": _apply(0, mods, ("spell_attack",)),
            "spell_dc": _apply(0, mods, ("spell_dc",)),
            "damage": _apply(0, mods, ("damage",)),
            "spell_damage": _apply(0, mods, ("spell_damage",)),
        },
        "resources": resources(ch, classes, scores),
        "removed": removed,
    }
