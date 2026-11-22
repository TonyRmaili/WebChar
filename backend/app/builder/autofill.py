"""The randomizer's main loop: fill whatever the player left open, then build.

complete(character_input, cat, rng) takes what the wizard sends:

    {"layers": [{from, picks}, …],          what the player picked (may be empty)
     "abilities": {"method", "base"},        blanks are None
     "hp": {"mode", "rolls"},
     "target_level": None | 5 | "random"}

and returns the same shape with every gap filled: a race (and subrace),
a background, class levels up to the target (claude/character-plan.md
"Randomizer rules"), base scores, and an answer for every open choice.
Picks the player made are never changed. Building the result
(build.build) then gives a finished character with nothing open.

New race, background and classes are 2024 ("one") entries. A new class
must be one the character qualifies for (`multiclass.requires`).
Spells, feats and proficiencies already on the character are not picked
twice (a feat marked `repeatable` can be).
"""

import random
import re

try:
    from app.builder.build import build
    from app.builder.derive import ability_scores
    from app.builder.groups import members
    from app.builder.options import candidates
    from app.builder.prereqs import state_of
    from app.builder.randomize import fill_scores, pick_ability_choice, priority, spread_levels, target_total
except ImportError:  # run from this folder
    from build import build
    from derive import ability_scores
    from groups import members
    from options import candidates
    from prereqs import state_of
    from randomize import fill_scores, pick_ability_choice, priority, spread_levels, target_total

RANDOM_EDITION = "one"
_CLASS = re.compile(r"^class:([^@/]+)@(\d+)$")
MAX_ROUNDS = 10  # a choice can open new ones (a subclass, a feat's options)


def _levels(layers):
    out = {}
    for l in layers:
        m = _CLASS.match(str(l.get("from") or ""))
        if m:
            out[m.group(1)] = max(out.get(m.group(1), 0), int(m.group(2)))
    return out


def _qualifies(cls, scores):
    """Any one group of `multiclass.requires` met (all abilities in it)."""
    groups = ((cls or {}).get("multiclass") or {}).get("requires") or []
    return not groups or any(all(scores.get(a, 0) >= n for a, n in g.items()) for g in groups)


def _have(built):
    """Everything the character has so far, per grant kind (for no repeats)."""
    have = {}
    for l in built["layers"]:
        for kind, v in (l.get("grants") or {}).items():
            if kind == "spells":
                have.setdefault("spells", set()).update(g.get("spell") for g in v if isinstance(g, dict))
            elif kind == "feats":
                have.setdefault("feats", set()).update(g.get("feat") if isinstance(g, dict) else g for g in v)
            elif isinstance(v, list):
                have.setdefault(kind, set()).update(x for x in v if isinstance(x, str))
    return have


class _Filler:
    def __init__(self, data, cat, rng):
        self.cat, self.rng = cat, rng
        self.layers = [dict(l, picks=dict(l.get("picks") or {})) for l in data.get("layers") or []]
        self.abilities = dict(data.get("abilities") or {})
        self.hp = dict(data.get("hp") or {"mode": "average"})
        self.target = data.get("target_level")

    def has(self, prefix):
        return any(str(l.get("from", "")).startswith(prefix) for l in self.layers)

    def pick_one(self, records):
        pool = [r for r in records if r.get("edition", "one") == RANDOM_EDITION] or list(records)
        return self.rng.choice(pool) if pool else None

    # ── origin ──

    def origin(self):
        if not self.has("race:"):
            race = self.pick_one(self.cat.all("races"))
            if race:
                self.layers.insert(0, {"from": f"race:{race['id']}", "picks": {}})
        race_layer = next((l for l in self.layers if str(l["from"]).startswith("race:") and "/subrace:" not in l["from"]), None)
        if race_layer and not self.has(race_layer["from"] + "/subrace:"):
            race = self.cat.get("races", race_layer["from"][5:])
            subs = (race or {}).get("subraces") or []
            if subs:
                sub = self.rng.choice(subs)
                i = self.layers.index(race_layer)
                self.layers.insert(i + 1, {"from": f"{race_layer['from']}/subrace:{sub['id']}", "picks": {}})
        if not self.has("background:"):
            bg = self.pick_one(self.cat.all("backgrounds"))
            if bg:
                at = max((i + 1 for i, l in enumerate(self.layers) if str(l["from"]).startswith("race:")), default=0)
                self.layers.insert(at, {"from": f"background:{bg['id']}", "picks": {}})

    # ── classes, scores, HP ──

    def classes_and_scores(self):
        levels = _levels(self.layers)
        base = dict((self.abilities.get("base") or {}))
        classes = [self.cat.get("classes", c) for c in levels]
        if not levels:  # nothing picked: the first class is free
            first = self.pick_one(self.cat.all("classes"))
            if first:
                levels = {first["id"]: 0}
                classes = [first]
        order, tiers = priority([c for c in classes if c], base)
        scores = fill_scores(base, self.abilities.get("method"), order, tiers, self.rng)
        self.abilities["base"] = scores

        assigned = sum(levels.values())
        target = target_total(assigned, self.target, self.rng) if self.target is not None else assigned
        target = max(target, 1, assigned)
        qualify = [c["id"] for c in self.cat.all("classes")
                   if c.get("edition", "one") == RANDOM_EDITION and c.get("hit_die") and _qualifies(c, scores)]
        if levels and list(levels.values())[0] == 0:  # the free first class takes level 1
            levels = {k: 1 for k in levels}
        new_levels = spread_levels(levels, target, qualify, self.rng)
        have = _levels(self.layers)
        for cid, lvl in new_levels.items():
            for n in range(have.get(cid, 0) + 1, lvl + 1):
                self.layers.append({"from": f"class:{cid}@{n}", "picks": {}})
                if self.hp.get("mode") == "roll":
                    die = int(str((self.cat.get("classes", cid) or {}).get("hit_die") or "d8")[1:])
                    self.hp.setdefault("rolls", {}).setdefault(f"class:{cid}@{n}", self.rng.randint(1, die))
        return tiers

    # ── open choices ──

    def candidates(self, choice, have):
        return candidates(choice, self.cat, have, self.state, legal=True)

    def answer(self, o, have, scores, tiers):
        ch = o["choice"]
        if ch.get("type") == "bundle" or ch.get("options"):
            return self.rng.choice(ch["options"])["id"]
        if ch.get("type") == "ability" or ch.get("bonus_sets"):
            return pick_ability_choice(ch, scores, tiers)
        pool = self.candidates(ch, have)
        n = min(o["missing"], len(pool))
        return self.rng.sample(pool, n) if n else None

    @staticmethod
    def _ordered(first, rest, progressed):
        yield from first
        if not first or not progressed():
            yield from rest

    def fill_choices(self, tiers, only=None):
        """Answer the open choices, round after round. `only(from, layers)`
        limits it to some layers (the leveler: the new level's)."""
        by_from = {l["from"]: l for l in self.layers}
        for _ in range(MAX_ROUNDS):
            built = build(self.layers, self.cat, self.abilities.get("base"))
            if not built["open"]:
                return built
            have = _have(built)
            scores = ability_scores({"abilities": self.abilities, "layers": built["layers"]})
            self.state = state_of(built, self.abilities.get("base"), self.cat)
            progress = False
            todo = [o for o in built["open"] if only is None or only(o["from"], built["layers"])]
            # Subclasses and feats first, on a round of their own: what they
            # grant (a domain's spells, a feat's spells) is then known before
            # spells are picked, so a pick never repeats a granted spell.
            first = [o for o in todo if o["choice"].get("grant") in ("subclass", "feats")]
            rest = [o for o in todo if o not in first]
            # (when none of them can be answered, the rest go this round)
            for o in self._ordered(first, rest, lambda: progress):
                layer = by_from.get(o["from"])
                if layer is None:  # a feat layer the build added: keep its picks with the rest
                    layer = {"from": o["from"], "via": next((l.get("via") for l in built["layers"] if l["from"] == o["from"]), None), "picks": {}}
                    self.layers.append(layer)
                    by_from[o["from"]] = layer
                old = layer["picks"].get(o["path"])
                got = self.answer(o, have, scores, tiers)
                if got in (None, [], {}):
                    continue
                if isinstance(old, list) and isinstance(got, list):  # a pool partly picked: keep the player's
                    count = o["choice"].get("count") or 1
                    got = (old + [g for g in got if g not in old])[:count]
                layer["picks"][o["path"]] = got
                if o["choice"].get("grant") == "feats" and isinstance(got, list):
                    for fid in got:  # a boon picked now closes the door on a second one this round
                        c = (self.cat.get("feats", fid) or {}).get("category")
                        if c:
                            self.state["feat_categories"].add(c)
                if isinstance(got, list):
                    have.setdefault(o["choice"].get("grant") if isinstance(o["choice"].get("grant"), str) else "skills", set()).update(got)
                progress = True
            if not progress:
                return built
        return build(self.layers, self.cat, self.abilities.get("base"))

    def run(self):
        self.origin()
        tiers = self.classes_and_scores()
        built = self.fill_choices(tiers)
        return {"layers": self.layers, "abilities": self.abilities, "hp": self.hp, "built": built}


def complete(data, cat, rng=None):
    """See the module notes. Returns {layers, abilities, hp, built}: the
    filled-in picks to save, and the build made from them."""
    return _Filler(data, cat, rng or random.Random()).run()
