"""
The dice engine — every die WebChar rolls is rolled here.

It knows nothing about monsters, minions or campaigns: callers send plain
numbers ("+4 to hit, 1d6+2 piercing, AC 15") and get plain results back.
The frontend "bridges" (tracker, minions, tables…) turn their own things
into those numbers and decide what to do with the results.

Rolls come from `secrets.SystemRandom`, the operating system's
cryptographic random source: fair, and impossible to predict.

Dice expressions (spaces around + and - are fine, letters can be any case):

    d20, 1d20+5, 8d6, 2d6+1d4-1   dice and flat numbers, joined by + or -
    4d6kh3                        keep the highest 3 (kl = keep the lowest)
    2d20kh1                       advantage, written out
    d%                            a d100

Wherever a player rolled real dice, the caller can send the number instead
(`given`), and nothing is rolled for that part.
"""

import re
from collections import Counter
from secrets import SystemRandom

_rng = SystemRandom()

MAX_SIDES = 1000          # no d1001
MAX_DICE = 10_000         # dice in one request, so nobody can stall the server
MAX_TIMES = 1000          # "roll this 1000 times"


class DiceError(ValueError):
    """Something the caller sent can't be rolled. The message says what."""


def die(sides: int) -> int:
    return _rng.randint(1, sides)


# ---------- reading an expression ----------

_TERM = re.compile(r"([+-])?(?:(\d*)d(\d+|%)(?:(kh|kl)(\d+))?|(\d+))")


def parse(expression: str) -> list[dict]:
    """'2d6+3' → [{kind: dice, sign: 1, count: 2, sides: 6, keep: None, keep_n: None},
                  {kind: flat, sign: 1, value: 3}]"""
    # Spaces are fine around + and -, but not inside a part: "2d6 3" is
    # a mistake, not a d63.
    text = re.sub(r"\s*([+-])\s*", r"\1", str(expression or "").strip()).lower()
    if not text:
        raise DiceError("There's nothing to roll")
    if re.search(r"\s", text):
        raise DiceError(f"Put + or - between the parts of {expression}")
    terms, pos = [], 0
    while pos < len(text):
        m = _TERM.match(text, pos)
        if not m or m.end() == pos:
            raise DiceError(f"Can't read '{text[pos:]}' in {expression}")
        if pos > 0 and not m.group(1):
            raise DiceError(f"Put + or - between the parts of {expression}")
        sign = -1 if m.group(1) == "-" else 1
        if m.group(6) is not None:
            terms.append({"kind": "flat", "sign": sign, "value": int(m.group(6))})
        else:
            count = int(m.group(2)) if m.group(2) else 1
            sides = 100 if m.group(3) == "%" else int(m.group(3))
            keep = m.group(4)
            keep_n = int(m.group(5)) if m.group(5) else None
            if count < 1:
                raise DiceError("Roll at least one die")
            if not 2 <= sides <= MAX_SIDES:
                raise DiceError(f"A die needs 2 to {MAX_SIDES} sides")
            if keep and not 1 <= keep_n <= count:
                raise DiceError(f"Can't keep {keep_n} of {count} dice")
            terms.append({"kind": "dice", "sign": sign, "count": count, "sides": sides, "keep": keep, "keep_n": keep_n})
        pos = m.end()
    return terms


def dice_in(terms: list[dict]) -> int:
    return sum(t["count"] for t in terms if t["kind"] == "dice")


def with_mode(terms: list[dict], mode: str) -> list[dict]:
    """Advantage / disadvantage: the first single d20 becomes 2d20 keep one."""
    if mode not in ("advantage", "disadvantage"):
        return terms
    out, done = [], False
    for t in terms:
        if not done and t["kind"] == "dice" and t["sides"] == 20 and t["count"] == 1 and not t["keep"]:
            t = {**t, "count": 2, "keep": "kh" if mode == "advantage" else "kl", "keep_n": 1}
            done = True
        out.append(t)
    return out


# ---------- rolling ----------

def roll_terms(terms: list[dict], *, crit: bool = False, crit_rule: str = "double_dice") -> dict:
    """Roll parsed terms. A crit doubles the dice (the rule), or with
    crit_rule "max_plus_roll" gives each die its maximum plus a normal roll.
    Flat numbers are never doubled.

    → {total, terms: [{kind: dice, sides, rolls: [..], kept: [bool..], subtotal, faces: {6: 3, …}},
                      {kind: flat, subtotal}]}"""
    out, total = [], 0
    for t in terms:
        if t["kind"] == "flat":
            sub = t["sign"] * t["value"]
            out.append({"kind": "flat", "subtotal": sub})
            total += sub
            continue
        sides, count = t["sides"], t["count"]
        if crit and crit_rule == "max_plus_roll":
            rolls = [sides] * count + [die(sides) for _ in range(count)]
        else:
            rolls = [die(sides) for _ in range(count * 2 if crit else count)]
        kept = [True] * len(rolls)
        if t["keep"]:
            n = t["keep_n"] * (2 if crit else 1)
            order = sorted(range(len(rolls)), key=lambda i: rolls[i], reverse=t["keep"] == "kh")
            keep = set(order[:n])
            kept = [i in keep for i in range(len(rolls))]
        sub = t["sign"] * sum(r for r, k in zip(rolls, kept) if k)
        out.append({
            "kind": "dice",
            "sides": sides,
            "rolls": rolls,
            "kept": kept,
            "subtotal": sub,
            "faces": dict(sorted(Counter(r for r, k in zip(rolls, kept) if k).items())),
        })
        total += sub
    return {"total": total, "terms": out}


def roll(expression: str, *, mode: str = "normal", crit: bool = False, crit_rule: str = "double_dice") -> dict:
    """One expression, rolled once → {expression, total, terms}."""
    terms = with_mode(parse(expression), mode)
    if dice_in(terms) * (2 if crit else 1) > MAX_DICE:
        raise DiceError(f"That's more than {MAX_DICE:,} dice")
    return {"expression": expression, **roll_terms(terms, crit=crit, crit_rule=crit_rule)}


def d20(mode: str = "normal", given: int | None = None) -> dict:
    """A d20 for an attack or a save → {rolls: [..], natural, given}.
    `given`: the number a player rolled at the table."""
    if given is not None:
        if not 1 <= int(given) <= 20:
            raise DiceError("A d20 shows 1 to 20")
        return {"rolls": [int(given)], "natural": int(given), "given": True}
    if mode == "advantage":
        rolls = [die(20), die(20)]
        return {"rolls": rolls, "natural": max(rolls), "given": False}
    if mode == "disadvantage":
        rolls = [die(20), die(20)]
        return {"rolls": rolls, "natural": min(rolls), "given": False}
    r = die(20)
    return {"rolls": [r], "natural": r, "given": False}


# ---------- damage ----------

def roll_damage(parts: list[dict], *, crit: bool = False, crit_rule: str = "double_dice") -> dict:
    """parts: [{dice: "8d6", type: "fire", given: None | 28}]
    → {parts: [{type, dice, amount, given, roll}], by_type: {fire: 28}}"""
    out, by_type = [], {}
    for p in parts:
        kind = str(p.get("type") or "untyped").lower()
        if p.get("given") is not None:
            amount, rolled = max(0, int(p["given"])), None
        else:
            rolled = roll(p["dice"], crit=crit, crit_rule=crit_rule)
            amount = max(0, rolled["total"])
        out.append({"type": kind, "dice": p.get("dice"), "amount": amount, "given": p.get("given") is not None, "roll": rolled})
        by_type[kind] = by_type.get(kind, 0) + amount
    return {"parts": out, "by_type": by_type}


def settle_defenses(defenses: dict | None) -> tuple[set, set, set]:
    """Resistance and vulnerability to the same type cancel; immunity beats both."""
    d = defenses or {}
    low = lambda key: {str(x).lower() for x in (d.get(key) or [])}
    res, imm, vul = low("resistances"), low("immunities"), low("vulnerabilities")
    both = res & vul
    res, vul = res - both - imm, vul - both - imm
    return res, imm, vul


def after_defenses(by_type: dict, defenses: dict | None, *, half: bool = False) -> dict:
    """Damage by type → what the target really takes.
    half: a successful save halves it first (rounded down), then defenses.
    → {by_type: {fire: 7}, total, notes: ["resists fire"]}"""
    res, imm, vul = settle_defenses(defenses)
    out, notes = {}, []
    for kind, amount in by_type.items():
        if half:
            amount //= 2
        if kind in imm:
            notes.append(f"immune to {kind}")
            amount = 0
        elif kind in res:
            notes.append(f"resists {kind}")
            amount //= 2
        elif kind in vul:
            notes.append(f"vulnerable to {kind}")
            amount *= 2
        out[kind] = amount
    return {"by_type": out, "total": sum(out.values()), "notes": notes}


# ---------- whole requests ----------

def resolve_saves(req: dict) -> dict:
    """Many targets save against one effect (a Fireball on 15 monsters).

    req: {dc, on_success: "half" | "none", damage: [parts], damage_roll: "once" | "each",
          crit_rule, targets: [{key, name, save_bonus, mode, given, defenses}]}

    Damage is rolled once for everyone (the rule) unless damage_roll is "each".
    Every target gets both outcomes worked out — `if_failed` and `if_passed`
    — so the DM can overturn a single result without rolling again."""
    dc = int(req["dc"])
    parts = req.get("damage") or []
    each = req.get("damage_roll") == "each"
    half = req.get("on_success", "half") == "half"
    shared = None if each or not parts else roll_damage(parts)

    targets = []
    for t in req.get("targets") or []:
        d = d20(t.get("mode", "normal"), t.get("given"))
        total = d["natural"] + int(t.get("save_bonus") or 0)
        dmg = (roll_damage(parts) if each else shared) if parts else {"parts": [], "by_type": {}}
        failed = after_defenses(dmg["by_type"], t.get("defenses"))
        passed = after_defenses(dmg["by_type"], t.get("defenses"), half=True) if half else {"by_type": {}, "total": 0, "notes": []}
        targets.append({
            "key": t.get("key"),
            "name": t.get("name"),
            "mode": t.get("mode", "normal"),
            "d20": d,
            "bonus": int(t.get("save_bonus") or 0),
            "total": total,
            "passed": total >= dc,
            "damage": dmg if each else None,
            "if_failed": failed,
            "if_passed": passed,
        })
    return {
        "dc": dc,
        "damage": shared,
        "targets": targets,
        "passed": sum(1 for t in targets if t["passed"]),
        "failed": sum(1 for t in targets if not t["passed"]),
    }


def resolve_attacks(req: dict) -> dict:
    """Volleys of attacks (27 skeleton archers at one target, or 2 attacks at
    each of 5 goblins).

    req: {crit_rule, volleys: [{key, name, count, to_hit, mode, crit_on,
          damage: [parts], ac, defenses}]}

    A natural 1 always misses; a natural crit_on or higher (20 unless said
    otherwise) always hits and is a crit. Defenses count per hit, as the
    rules say, then everything is added up."""
    crit_rule = req.get("crit_rule", "double_dice")
    volleys = req.get("volleys") or []
    if sum(int(v.get("count") or 1) for v in volleys) > MAX_TIMES:
        raise DiceError(f"That's more than {MAX_TIMES} attacks")

    out = []
    for v in volleys:
        ac = int(v.get("ac") or 10)
        bonus = int(v.get("to_hit") or 0)
        crit_on = int(v.get("crit_on") or 20)
        attacks, raw, final = [], Counter(), Counter()
        for _ in range(max(1, int(v.get("count") or 1))):
            d = d20(v.get("mode", "normal"))
            total = d["natural"] + bonus
            if d["natural"] == 1:
                result = "fumble"
            elif d["natural"] >= crit_on:
                result = "crit"
            else:
                result = "hit" if total >= ac else "miss"
            row = {"d20": d, "total": total, "result": result, "damage": None, "taken": None}
            if result in ("hit", "crit"):
                dmg = roll_damage(v.get("damage") or [], crit=result == "crit", crit_rule=crit_rule)
                taken = after_defenses(dmg["by_type"], v.get("defenses"))
                row["damage"], row["taken"] = dmg, taken
                raw.update(dmg["by_type"])
                final.update(taken["by_type"])
            attacks.append(row)
        count = Counter(a["result"] for a in attacks)
        out.append({
            "key": v.get("key"),
            "name": v.get("name"),
            "ac": ac,
            "to_hit": bonus,
            "mode": v.get("mode", "normal"),
            "attacks": attacks,
            "hits": count["hit"] + count["crit"],
            "crits": count["crit"],
            "misses": count["miss"] + count["fumble"],
            "fumbles": count["fumble"],
            "rolled": dict(raw),
            "taken": dict(final),
            "total": sum(final.values()),
        })
    return {"volleys": out}


# ---------- character creation (was dice_handler.py) ----------

def score_to_mod(score: int) -> int:
    return (score - 10) // 2


def roll_4d6_drop_lowest() -> int:
    """Four d6, the lowest one dropped."""
    rolls = [die(6) for _ in range(4)]
    return sum(rolls) - min(rolls)


def generate_ability_scores() -> list[int]:
    """Seven 4d6-drop-lowest totals with the lowest dropped: six scores."""
    return generate_remaining_ability_scores(6)


def generate_remaining_ability_scores(remaining_scores: int) -> list[int]:
    """X+1 totals with the lowest dropped: X scores."""
    totals = [roll_4d6_drop_lowest() for _ in range(remaining_scores + 1)]
    totals.remove(min(totals))
    return totals