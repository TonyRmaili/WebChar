"""The builder's core loop: the saved picks -> the character's layers.

Input: the layers as the file keeps them, at least {from, picks}
(claude/character-plan.md), in order: race, subrace, background, each
class level, any feats, manual. Output: every layer filled from the
catalogue (grants with picks applied, copies of its features and
spells), the starting gear, and what is still open.

    from                                what it reads
    race:<id>                           the race (minus what its subrace `replaces`)
    race:<id>/subrace:<id>              the subrace
    background:<id>                     the background
    feat:<id>                           the feat, its option as a bundle choice "option"
    class:<id>@<n>                      class level n: that progression row; at 1 the
                                        class's own grants (first class) or its
                                        multiclass grants; the subclass's row too
    manual                              left as it is

Feats granted by any layer (a background's origin feat, a class's
fighting style pick) get their own layer, `via` the layer that gave them.
Picks already saved for them are kept.

Nothing here is random: open choices are returned for the wizard or the
randomizer to answer, and building again with those picks fills them in.
"""

import re
from copy import deepcopy

try:
    from app.builder.choices import merge_grants, resolve
except ImportError:  # run from this folder
    from choices import merge_grants, resolve

_CLASS = re.compile(r"^class:([^@/]+)@(\d+)$")
_SUBRACE = re.compile(r"^race:([^/]+)/subrace:(.+)$")
OWNED_SPELLS = {"known", "prepared", "item"}  # "list" only widens a class list


def _row(progression, level):
    return next((r for r in progression or [] if r.get("level") == level), {}) or {}


def _table_at(table, level):
    if not isinstance(table, dict):
        return None
    rows = [int(k) for k in table if str(k).isdigit() and int(k) <= level]
    return table[str(max(rows))] if rows else None


def _gained(table, level):
    """What a level table adds at `level` (the count there minus the one before)."""
    now = _table_at(table, level)
    if not isinstance(now, int):
        return 0
    before = _table_at(table, level - 1)
    return now - (before if isinstance(before, int) else 0)


def _max_spell_level(sc, level):
    """The highest spell level the class's own table gives at `level`."""
    if sc.get("progression") == "pact":
        return _table_at((sc.get("pact") or {}).get("level"), level) or 0
    slots = _table_at(sc.get("slots"), level)
    return len(slots) if isinstance(slots, list) else 0


def _list_from_grants(rec):
    """A subclass caster's list (Eldritch Knight: the Wizard's), from its spell_lists grant."""
    for g in ((rec or {}).get("grants") or {}).get("spell_lists") or []:
        cls = (g.get("filter") or {}).get("class") if isinstance(g, dict) else None
        if cls:
            return cls
    return None


def _at(x):
    return x.get("at") if isinstance(x, dict) and isinstance(x.get("at"), int) else None


def _part_at(grants, choices, n, joins):
    """A record's grants and choices for class level n. When it `joins` at
    n (a class at 1, a subclass when picked): everything not marked for a
    later level. Otherwise only what is marked `at` == n."""
    ok = (lambda a: a is None or a <= n) if joins else (lambda a: a == n)
    g = {}
    for k, v in grants.items():
        if isinstance(v, list):
            keep = [x for x in v if ok(_at(x))]
            if keep:
                g[k] = deepcopy(keep)
        elif joins:
            g[k] = deepcopy(v)
    return g, [c for c in choices if ok(_at(c))]


def _feature_copies(owner, ids, cat):
    out = []
    for fid in ids or []:
        f = cat.feature(owner, fid)
        if f:
            out.append(deepcopy(f))
    return out


def _optional_copy(rec, level):
    """An optional feature (an invocation, a metamagic, a maneuver) as a
    feature copy on the layer that picked it."""
    copy = {"id": rec["id"], "name": rec.get("name"), "text": rec.get("text") or "", "level": level or 1,
            "category": "traits", "optional": True, "feature_types": list(rec.get("feature_types") or []),
            "source": rec.get("source")}
    if isinstance(rec.get("consumes"), dict):
        copy["consumes"] = deepcopy(rec["consumes"])
    for k in ("uses", "action", "toggle", "modifiers"):
        if rec.get(k) is not None:
            copy[k] = deepcopy(rec[k])
    return copy


def _total_level(skeleton):
    levels = {}
    for layer in skeleton:
        m = _CLASS.match(str(layer.get("from") or ""))
        if m:
            levels[m.group(1)] = max(levels.get(m.group(1), 0), int(m.group(2)))
    return sum(levels.values())


def _drop_replaced(part, kinds):
    """A subrace's `replaces`: the race's grants and choices of those kinds go."""
    if not kinds:
        return part
    grants = {k: v for k, v in (part.get("grants") or {}).items() if k not in kinds}
    choices = [c for c in part.get("choices") or [] if c.get("grant") not in kinds and c.get("id") not in kinds]
    return {**part, "grants": grants, "choices": choices}


def _feat_part(feat):
    """A feat; its options (Magic Initiate's Cleric/Druid/Wizard) become a
    bundle choice "option", each option holding only what differs."""
    part = {"grants": feat.get("grants"), "choices": list(feat.get("choices") or []), "features": list(feat.get("features") or [])}
    if feat.get("options"):
        part["choices"].append({"type": "bundle", "id": "option", "label": "Option", "options": feat["options"]})
    return part


class _Builder:
    def __init__(self, skeleton, cat, base_scores=None):
        self.cat = cat
        self.base_scores = base_scores
        self.skeleton = [dict(l) for l in skeleton or []]
        self.level = _total_level(self.skeleton)
        self.saved = {l.get("from"): l for l in self.skeleton}
        self.layers, self.items, self.currency = [], [], {}
        self.open, self.problems, self.choices = [], [], []
        self.first_class = next((m.group(1) for l in self.skeleton for m in [_CLASS.match(str(l.get("from") or ""))] if m), None)
        self.subclass = {}  # class id -> subclass id, as levels are read

    # ── one layer ──

    def part_for(self, layer):
        frm = str(layer.get("from") or "")
        cat = self.cat
        m = _SUBRACE.match(frm)
        if m:
            _, sub = cat.race_and_subrace(m.group(1), m.group(2))
            return sub, sub, None
        if frm.startswith("race:"):
            race = cat.get("races", frm[5:])
            sub_layer = next((l for l in self.skeleton if str(l.get("from", "")).startswith(frm + "/subrace:")), None)
            replaces = []
            if sub_layer:
                _, sub = cat.race_and_subrace(frm[5:], sub_layer["from"].split("/subrace:", 1)[1])
                replaces = (sub or {}).get("replaces") or []
            return race, _drop_replaced(race or {}, replaces), None
        if frm.startswith("background:"):
            bg = cat.get("backgrounds", frm[11:])
            return bg, bg, None
        if frm.startswith("feat:"):
            feat = cat.get("feats", frm[5:])
            return feat, _feat_part(feat or {}), None
        m = _CLASS.match(frm)
        if m:
            return self.class_part(m.group(1), int(m.group(2)), layer)
        return None, None, None

    def class_part(self, cid, n, layer):
        cls = self.cat.get("classes", cid)
        if not cls:
            return None, None, None
        row = _row(cls.get("progression"), n)
        part = {"grants": deepcopy(row.get("grants") or {}), "choices": list(row.get("choices") or []),
                "features": _feature_copies(cls, row.get("features"), self.cat)}
        # The class's own grants and choices come at level 1, except the
        # ones marked with a later class level (`at`: a 2014 Bard's Magical
        # Secrets at 10), which come with that level.
        start = cls if cid == self.first_class else (cls.get("multiclass") or {})
        g, c = _part_at(start.get("grants") or {}, start.get("choices") or [], n, n == 1)
        merge_grants(part["grants"], g)
        if n == 1 and cid == self.first_class and cls.get("saves"):
            merge_grants(part["grants"], {"saves": cls["saves"]})
        part["choices"] = c + part["choices"]
        # The subclass: picked on this level (its pool grants "subclass") or before.
        picked = next((v for c in row.get("choices") or [] if c.get("grant") == "subclass"
                       for v in [(layer.get("picks") or {}).get(c["id"])] if v), None)
        if isinstance(picked, list):
            picked = picked[0] if picked else None
        sub = self.cat.get("subclasses", picked or self.subclass.get(cid))
        if sub:
            # The subclass's grants and choices: the ones reached when it's
            # picked come with that level; one marked with a later class
            # level (`at`: a domain's 5th-level spells) comes with that level.
            if picked:
                self.subclass[cid] = sub["id"]
            g, c = _part_at(sub.get("grants") or {}, sub.get("choices") or [], n, bool(picked))
            merge_grants(part["grants"], g)
            part["choices"] += c
            srow = _row(sub.get("progression"), n)
            merge_grants(part["grants"], srow.get("grants") or {})
            part["choices"] += list(srow.get("choices") or [])
            part["features"] += _feature_copies(sub, srow.get("features"), self.cat)
        part["choices"] += self.spell_choices(cid, cls, sub, n, layer)
        return cls, part, n

    # ── a class's own spells ──
    # The class data gives counts as level tables, not as choices, so each
    # class level gets pool choices for what it adds there (the count at
    # this level minus the count at the last):
    #   class_cantrips   from `cantrips`
    #   class_spells     from `known` (2014 known casters), else the
    #                    spellbook (`spellbook: {first, per_level}`: a
    #                    Wizard writes 6 spells at level 1 and 2 more each
    #                    level), else `prepared`
    # Class spells land on the sheet prepared, up to the class's prepared
    # count (character.settle_prepared); the sheet's diamond changes any.
    # A count written as a formula (2014 Cleric, Druid, Paladin, Wizard:
    # "class_level + wis_mod") needs the ability scores, so that choice is
    # added once the layers are built, on the class's first level, and
    # grows when the count does (spells_by_formula).

    def spell_choices(self, cid, cls, sub, n, layer):
        out = []
        for rec in (cls, sub):
            sc = (rec or {}).get("spellcasting") or {}
            if not sc.get("progression"):
                continue
            lst = sc.get("list") or _list_from_grants(rec) or _list_from_grants(cls)

            def add(choice_id, label, count, levels):
                if count and count > 0 and levels:
                    out.append({"type": "pool", "grant": "spells", "class": cid, "how": "prepared",
                                "id": choice_id, "label": label, "count": count,
                                "from": {"spell_level": levels, "class": lst} if lst else {"spell_level": levels}})

            add("class_cantrips", "Cantrips", _gained(sc.get("cantrips"), n), [0])
            levels = list(range(1, _max_spell_level(sc, n) + 1))
            book = sc.get("spellbook")
            if isinstance(sc.get("known"), dict):
                add("class_spells", "Spells", _gained(sc["known"], n), levels)
            elif isinstance(book, dict):
                add("class_spells", "Spellbook", (book.get("first") or 0) if n == 1 else (book.get("per_level") or 0), levels)
            elif isinstance(sc.get("prepared"), dict):
                add("class_spells", "Spells", _gained(sc["prepared"], n), levels)
        return out

    def spells_by_formula(self, base_scores):
        try:
            from app.builder.derive import ability_scores, words, class_levels
            from app.formulas import evaluate
        except ImportError:
            from derive import ability_scores, words, class_levels
            from formulas import evaluate
        ch = {"abilities": {"base": base_scores or {}}, "layers": self.layers}
        scores = ability_scores(ch)
        for cid, lvl, sub in class_levels(ch):
            for rec in (self.cat.get("classes", cid), self.cat.get("subclasses", sub) if sub else None):
                sc = (rec or {}).get("spellcasting") or {}
                if isinstance(sc.get("spellbook"), dict):  # a Wizard's picks follow its book, not the formula
                    continue
                formula = next((sc[k] for k in ("known", "prepared") if isinstance(sc.get(k), str)), None)
                top = _max_spell_level(sc, lvl)
                if not formula or top < 1:
                    continue
                count = evaluate(formula, words(ch, scores, rec, lvl))
                first = next((l for l in self.layers if l.get("from") == f"class:{cid}@1"), None)
                if not isinstance(count, int) or count < 1 or not first:
                    continue
                lst = sc.get("list") or _list_from_grants(rec)
                levels = list(range(1, top + 1))
                choice = {"type": "pool", "id": "class_spells", "label": "Spells", "grant": "spells", "how": "prepared",
                          "class": cid, "count": count,
                          "from": {"spell_level": levels, "class": lst} if lst else {"spell_level": levels}}
                r = resolve({"choices": [choice]}, first.get("picks") or {})
                merge_grants(first["grants"], {"spells": r["grants"].get("spells") or []})
                first["spells"] += self.spell_copies(r["grants"].get("spells"))
                self.open += [{"from": first["from"], **o} for o in r["open"]]
                self.choices += [{"from": first["from"], **c} for c in r["choices"]]
                self.problems += [{"from": first["from"], **p} for p in r["problems"]]

    def fill(self, layer, picks_extra=None):
        frm = layer.get("from")
        if frm == "manual" or not frm:
            self.layers.append(layer)
            return
        record, part, class_level = self.part_for(layer)
        if record is None:
            self.problems.append({"from": frm, "problem": "not in the catalogue"})
            self.layers.append(layer)
            return
        picks = dict(layer.get("picks") or {})
        # Race picks (a spellcasting ability) are seen by the subrace too.
        r = resolve(part, {**(picks_extra or {}), **picks}, level=None if class_level else self.level)
        grants = r["grants"]
        # Optional features it picked (invocations, metamagic, maneuvers…):
        # each becomes a feature copy on this layer, and what it grants
        # (Armor of Shadows' Mage Armor) and asks (Pact of the Tome's
        # cantrips, picked under "feature:<id>/…") counts here too.
        opt_recs = [self.cat.get("optionalfeatures", o if isinstance(o, str) else (o or {}).get("optional_feature") or (o or {}).get("id"))
                    for o in grants.get("optional_features") or []]
        opt_recs = [o for o in opt_recs if o]
        if opt_recs:
            r2 = resolve({"features": [{"id": o["id"], "grants": o.get("grants"), "choices": o.get("choices")} for o in opt_recs]},
                         {**(picks_extra or {}), **picks}, level=None)
            merge_grants(grants, r2["grants"])
            for k in ("open", "choices", "problems"):
                r[k] += r2[k]
        out = {"from": frm, "picks": picks, "grants": {k: v for k, v in grants.items() if k not in ("items", "currency")}}
        if layer.get("via"):
            out["via"] = layer["via"]
        if record.get("name"):
            out["label"] = record["name"] + (f" {class_level}" if class_level else "")
        # Feature copies: a class level's own; elsewhere up to the character level.
        feats = part.get("features") or []
        out["features"] = [deepcopy(f) for f in feats if class_level or (f.get("level") or 1) <= max(1, self.level)]
        out["features"] += [_optional_copy(o, class_level) for o in opt_recs]
        # A class level's spells are its own (no character-level gate).
        out["spells"] = self.spell_copies(grants.get("spells"), None if class_level else self.level)
        for it in grants.get("items") or []:
            self.items.append(self.item_copy(it, frm))
        for k, v in (grants.get("currency") or {}).items():
            self.currency[k] = self.currency.get(k, 0) + v
        for o in r["open"]:
            self.open.append({"from": frm, **o})
        for c in r["choices"]:
            self.choices.append({"from": frm, **c})
        for p in r["problems"]:
            self.problems.append({"from": frm, **p})
        self.layers.append(out)
        # Feats it grants get their own layers.
        for g in grants.get("feats") or []:
            fid = g.get("feat") if isinstance(g, dict) else g
            if not fid:
                continue
            ffrom = f"feat:{fid}"
            saved = self.saved.get(ffrom) or {}
            fpicks = dict(saved.get("picks") or {})
            if isinstance(g, dict) and g.get("option"):
                fpicks.setdefault("option", g["option"])
            if not any(l.get("from") == ffrom for l in self.layers):
                self.fill({"from": ffrom, "via": frm, "picks": fpicks})

    def spell_copies(self, grants, level=None):
        """Spell copies for spell grants; with `level` (the character's),
        the ones that unlock later are left out."""
        out = []
        for g in grants or []:
            if not isinstance(g, dict) or g.get("how") not in OWNED_SPELLS:
                continue
            at = g.get("at")
            if level is not None and isinstance(at, int) and at > max(1, level):
                continue
            rec = self.cat.get("spells", g.get("spell"))
            copy = deepcopy(rec) if rec else {"id": g.get("spell"), "name": g.get("spell")}
            copy["granted"] = {k: deepcopy(v) for k, v in g.items() if k != "spell"}
            # The same spell twice on one layer is one spell: a pick and a
            # subclass's always-prepared grant (the grant wins), or "always
            # prepared" and "cast it once for free" (Transmuter's Alter
            # Self: the one with the free casts wins; slots work too).
            twin = next((i for i, o in enumerate(out) if o.get("id") == copy.get("id")
                         and not (o["granted"].get("uses") and copy["granted"].get("uses"))), None)
            if twin is None:
                out.append(copy)
            else:
                old, new = out[twin]["granted"], copy["granted"]
                if (new.get("uses") and not old.get("uses")) or (not old.get("uses") and new.get("how") != "known" and old.get("how") == "known"):
                    out[twin] = copy
        return out

    def item_copy(self, grant, frm):
        rec = self.cat.get("items", grant.get("item")) if isinstance(grant.get("item"), str) else None
        copy = deepcopy(rec) if rec else {"name": grant.get("name") or str(grant.get("item") or "Item")}
        if grant.get("name"):
            copy["name"] = grant["name"]
        # `item` is the catalogue id; the row gets its own `id` when saved.
        copy.update({"item": rec["id"] if rec else None, "from": frm, "qty": grant.get("qty") or 1})
        copy.pop("id", None)
        return copy

    def run(self):
        race_picks = {}
        for layer in self.skeleton:
            frm = str(layer.get("from") or "")
            if frm.startswith("feat:") and (layer.get("via") or any(l.get("from") == frm for l in self.layers)):
                continue  # rebuilt from the layer that grants it
            if frm.startswith("race:") and "/subrace:" not in frm:
                race_picks = dict(layer.get("picks") or {})
            self.fill(layer, race_picks if _SUBRACE.match(frm) else None)
        self.spells_by_formula(self.base_scores)
        equip_best(self.items, self.layers)
        return {"layers": self.layers, "items": self.items, "currency": self.currency, "open": self.open,
                "problems": self.problems, "choices": self.choices}


def equip_best(items, layers):
    """Wear the best body armour the character is proficient with, and a
    shield if it has one and can use it (the player can change it)."""
    prof = set()
    for l in layers:
        prof.update((l.get("grants") or {}).get("armor") or [])
    armour = [i for i in items if (i.get("armor") or {}).get("category") in ("light", "medium", "heavy")
              and i["armor"]["category"] in prof]
    if armour:
        max(armour, key=lambda i: i["armor"].get("base") or 0)["equipped"] = True
    shield = next((i for i in items if (i.get("armor") or {}).get("category") == "shield"), None)
    if shield and ("shields" in prof or "shield" in prof):
        shield["equipped"] = True


def build(skeleton, cat, base_scores=None):
    """See the module notes. Returns {layers, items, currency, open, problems, choices}.
    `base_scores` (the player's base ability scores) are only needed for a
    class spell count written as a formula."""
    return _Builder(skeleton, cat, base_scores).run()
