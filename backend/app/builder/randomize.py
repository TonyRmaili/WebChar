"""The randomizer's number work: ability scores and class levels.

Only fills what the player left open; their own numbers and levels stay.
Every function takes `rng` (a random.Random) so tests can fix the seed.
Rules: claude/character-plan.md "Randomizer rules". Ported from the old
character_adjuster.py (score methods, the modifier-gain allocation),
with the new level rule.
"""

import itertools
import random

ABILITIES = ("str", "dex", "con", "int", "wis", "cha")
STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
POINT_BUY_BUDGET = 27
POINT_BUY_COST = {8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9}
SCORE_CAP = 20
MAX_LEVEL = 20

# Levels: how many NEW classes a character gets. With k classes already,
# the next new one has a 0.4^k chance (so a 2nd class 40%, a 3rd 16%, a
# 4th 6.4%…); with none picked the first class is free. Measured with
# nothing picked: 1 class ≈ 60%, 2 ≈ 24%, 3 ≈ 10% (the old builder's odds).
EXTRA_CLASS_CHANCE = 0.4
# Target "random" with classes already picked: leave the build as it is.
KEEP_AS_IS_CHANCE = 0.25


def mod(score):
    return (int(score) - 10) // 2


# ─── which abilities matter ───────────────────────────────────────

def primary_abilities(classes, base):
    """Main abilities of the character's classes. A class record's
    `primary_ability` is a list of alternatives, all abilities inside one
    needed together: Fighter [["str"], ["dex"]], Monk [["dex", "wis"]].
    Of the alternatives, the one the player's scores already lean on wins."""
    out = []
    for cls in classes:
        groups = [g for g in cls.get("primary_ability") or [] if g]
        if not groups:
            continue
        best = max(groups, key=lambda g: max(base.get(a) or 0 for a in g))
        out += [a for a in best if a not in out]
    return out


def priority(classes, base):
    """(fill order, tiers): main abilities first, then Con, then the rest.
    Tier 0 = main abilities and Con, tier 1 = the rest."""
    main = primary_abilities(classes, base)
    order = main + [a for a in ("con",) if a not in main] + [a for a in ABILITIES if a not in main and a != "con"]
    tiers = {a: 0 if a in main or a == "con" else 1 for a in ABILITIES}
    return order, tiers


# ─── base scores ──────────────────────────────────────────────────

def roll_4d6(rng):
    dice = sorted(rng.randint(1, 6) for _ in range(4))
    return sum(dice[1:])  # drop the lowest


def fill_scores(base, method, order, tiers, rng=random):
    """The player's base scores with the blanks (None) filled:
    standard array → the values they haven't used; point buy → blanks
    start at 8 and the rest of the 27 points is spent; anything else
    (roll, custom) → 4d6 drop the lowest. Best values go first in `order`."""
    scores = {a: base.get(a) for a in ABILITIES}
    blanks = [a for a in order if scores[a] is None]
    if not blanks:
        return scores
    m = str(method or "").lower().replace(" ", "").replace("_", "")
    if "standard" in m:
        pool = list(STANDARD_ARRAY)
        for a in ABILITIES:
            if scores[a] in pool:
                pool.remove(scores[a])
        pool.sort(reverse=True)
        for a in blanks:
            scores[a] = pool.pop(0) if pool else roll_4d6(rng)
    elif "point" in m or "buy" in m:
        spent = sum(POINT_BUY_COST.get(min(15, max(8, scores[a])), 0) for a in ABILITIES if scores[a] is not None)
        for a in blanks:
            scores[a] = 8
        left = POINT_BUY_BUDGET - spent
        while left > 0:
            can = [a for a in blanks if scores[a] < 15 and POINT_BUY_COST[scores[a] + 1] - POINT_BUY_COST[scores[a]] <= left]
            pick = _best_single(can, scores, 1, tiers)
            if not pick:
                break
            left -= POINT_BUY_COST[scores[pick] + 1] - POINT_BUY_COST[scores[pick]]
            scores[pick] += 1
    else:
        rolls = sorted((roll_4d6(rng) for _ in blanks), reverse=True)
        for a, v in zip(blanks, rolls):
            scores[a] = v
    return scores


# ─── placing bonuses ──────────────────────────────────────────────

def _best_single(options, scores, amount, tiers, caps=None):
    """The best ability for `amount` points: main abilities first, then
    the biggest modifier gain, then the higher score."""
    best, rank = None, None
    for a in options:
        cap = (caps or {}).get(a, SCORE_CAP)
        if scores[a] >= cap:
            continue
        gain = mod(min(scores[a] + amount, cap)) - mod(scores[a])
        r = (tiers.get(a, 1), -gain, -scores[a])
        if rank is None or r < rank:
            best, rank = a, r
    return best


def place_amounts(options, amounts, scores, tiers, caps=None):
    """Hand `amounts` ([2, 1]) to different abilities from `options`, the
    way that gains the most modifiers (searched fully: six abilities, at
    most three amounts). With Int 15 and Con 8, +2/+1 goes Con +2, Int +1.
    Returns {ability: amount}."""
    amounts = sorted((a for a in amounts if a), reverse=True)
    cands = [a for a in dict.fromkeys(options) if a in ABILITIES]
    for width in range(min(len(amounts), len(cands)), 0, -1):
        best, rank = None, None
        for combo in itertools.permutations(cands, width):
            gain = tier_sum = top = 0
            ok = True
            for a, n in zip(combo, amounts[:width]):
                cap = (caps or {}).get(a, SCORE_CAP)
                if scores[a] >= cap:
                    ok = False
                    break
                raised = min(scores[a] + n, cap)
                gain += mod(raised) - mod(scores[a])
                tier_sum += tiers.get(a, 1)
                top += raised if tiers.get(a, 1) == 0 else 0
            r = (gain, -tier_sum, top)
            if ok and (rank is None or r > rank):
                best, rank = dict(zip(combo, amounts[:width])), r
        if best:
            return best
    return {}


def pick_ability_choice(choice, scores, tiers, caps=None):
    """A pick for an ability choice ({from, bonus_sets}) as choices.resolve
    takes it: {"con": 2, "int": 1}. Tries every bonus set, keeps the best."""
    options = choice.get("from") or list(ABILITIES)
    best, rank = {}, None
    for bonus_set in choice.get("bonus_sets") or [[1]]:
        placed = place_amounts(options, bonus_set, scores, tiers, caps)
        if len(placed) < len(bonus_set):
            continue
        gain = sum(mod(min(scores[a] + n, (caps or {}).get(a, SCORE_CAP))) - mod(scores[a]) for a, n in placed.items())
        r = (gain, -sum(tiers.get(a, 1) for a in placed))
        if rank is None or r > rank:
            best, rank = placed, r
    return best


# ─── class levels ─────────────────────────────────────────────────

def target_total(assigned, target, rng=random):
    """The total level to reach. A number is a cap (every spare level is
    spent); "random" rolls one, favouring low levels; None changes nothing."""
    if target is None or isinstance(target, bool):
        return assigned
    if isinstance(target, (int, float)):
        return max(assigned, min(int(target), MAX_LEVEL))
    if assigned >= MAX_LEVEL or (assigned > 0 and rng.random() < KEEP_AS_IS_CHANCE):
        return assigned
    levels = list(range(max(1, assigned + 1), MAX_LEVEL + 1))
    return rng.choices(levels, weights=[MAX_LEVEL + 1 - lv for lv in levels], k=1)[0]


def spread_levels(levels, target, new_classes, rng=random):
    """`levels`: {class id: level} the player picked (kept, in order).
    First decide how many new classes join (from `new_classes`, the ids
    the character qualifies for; each one rarer than the last, see
    EXTRA_CLASS_CHANCE). Each new class gets 1 level; every other spare
    level goes to any of the classes, all equally likely, so the picked
    classes get most of them and all the spare levels can still end up in
    one new class. Returns the new {class id: level}, in the order taken."""
    out = dict(levels)
    spare = target - sum(out.values())
    if spare <= 0:
        return out
    pool = [c for c in new_classes if c not in out]
    rng.shuffle(pool)
    new = []
    if not out and pool:
        new.append(pool.pop())
    while pool and len(new) < spare and rng.random() < EXTRA_CLASS_CHANCE ** (len(out) + len(new)):
        new.append(pool.pop())
    for cls in new:
        out[cls] = 1
    for _ in range(spare - len(new)):
        if not out:
            break
        out[rng.choice(list(out))] += 1
    return out
