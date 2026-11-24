"""Rules that change a character during play: damage, healing, rests, XP.

Works on the version-2 save file (claude/character-plan.md). Live values
sit in `state` and count what is USED, so a rest mostly clears counts and
never needs to know the maximum:

    state.hp_current      None = at max          state.hp_temp, hp_barrier
    state.hit_dice_used   {"d10": 2}             state.slots_used {"1": 2}
    state.pact_slots_used {"3": 1} by level      state.resources_used {"rage": 1}
    state.uses_used       {"<layer from>#<feature or spell id>": 1}
    inventory item rows   charges_used

Each function changes the dict in place and returns it; loading and
saving the file is the caller's job (character_files.edit_character):

    ch = {"state": {"hp_current": 10, "hp_temp": 3}, ...}
    change_hp(ch, -5)     # temp HP first: hp_temp 0, hp_current 8
"""

try:
    from app.builder.derive import max_hp, resources
except ImportError:  # run from this folder
    from derive import max_hp, resources


import random
import re

LONG_RESETS = (None, "", "long", "long_rest", "dawn", "dusk", "midnight")   # all a long rest now
DICE = re.compile(r"^\s*(\d*)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$")


def _regain_charges(item):
    """An item's charges come back by its `regain`: all (none said), a
    number, or rolled dice ("1d6 + 1")."""
    used = _num(item.get("charges_used"))
    if not used:
        return
    regain = (item.get("charges") or {}).get("regain")
    if regain in (None, "", "all"):
        item["charges_used"] = 0
        return
    if isinstance(regain, int) and not isinstance(regain, bool):
        back = regain
    else:
        m = DICE.match(str(regain))
        if not m:
            item["charges_used"] = 0
            return
        n, die, sign, add = int(m.group(1) or 1), int(m.group(2)), m.group(3), int(m.group(4) or 0)
        back = sum(random.randint(1, die) for _ in range(n)) + (add if sign != "-" else -add)
    item["charges_used"] = max(0, used - max(0, back))


def _num(v, default=0):
    return v if isinstance(v, int) and not isinstance(v, bool) else default


def _state(ch):
    st = ch.get("state")
    if not isinstance(st, dict):
        st = ch["state"] = {}
    return st


# ─── HP ───────────────────────────────────────────────────────────

def current_hp(ch, top=None):
    """The HP the character has now (None in the file means full)."""
    top = max_hp(ch) if top is None else top
    cur = _state(ch).get("hp_current")
    return top if cur is None else max(0, min(_num(cur), top))


def change_hp(ch, delta):
    """delta < 0 is damage: the barrier takes it first, then temp HP, then
    HP (not below 0). delta > 0 is healing, up to the max; any healing
    above 0 HP clears the death saves."""
    st = _state(ch)
    top = max_hp(ch)
    hp = current_hp(ch, top)
    delta = _num(delta)
    if delta < 0:
        dmg = -delta
        for key in ("hp_barrier", "hp_temp"):
            taken = min(_num(st.get(key)), dmg)
            st[key] = _num(st.get(key)) - taken
            dmg -= taken
        hp = max(0, hp - dmg)
    elif delta > 0:
        hp = min(top, hp + delta)
        if hp > 0:
            st["death_saves"] = {"ok": 0, "fail": 0}
    st["hp_current"] = None if hp >= top else hp
    return ch


# ─── rests ────────────────────────────────────────────────────────

def _uses_of(row):
    """A feature's uses, or a spell's free casts (they sit in `granted`)."""
    uses = row.get("uses")
    if not isinstance(uses, dict):
        uses = (row.get("granted") or {}).get("uses")
    return uses if isinstance(uses, dict) else None


def _uses_keys(ch, short_only, never=False):
    """The uses_used keys of every feature and spell a rest gives back
    (with `never`: the ones nothing gives back, "once, then it's gone")."""
    keys = []
    for layer in ch.get("layers") or []:
        frm = layer.get("from")
        for row in (layer.get("features") or []) + (layer.get("spells") or []):
            uses = _uses_of(row)
            if not uses:
                continue
            reset = uses.get("reset")
            if never:
                if reset != "never":
                    continue
            elif short_only and reset not in ("short", "turn", "recharge"):
                continue
            rid = row.get("id") or row.get("spell")
            if rid:
                keys.append(f"{frm}#{rid}")
    return keys


def short_rest(ch):
    """Pact slots back; short-rest uses and pools back; a long-rest pool
    that gives some back on a short rest (`short_rest: 1`) gives that."""
    st = _state(ch)
    st["pact_slots_used"] = {}
    used = dict(st.get("resources_used") or {})
    for r in resources(ch):
        if r["id"] not in used:
            continue
        if r["reset"] == "short":
            used.pop(r["id"])
        elif isinstance(r.get("short_rest"), int) and not isinstance(r.get("short_rest"), bool):
            used[r["id"]] = max(0, _num(used[r["id"]]) - r["short_rest"])
    st["resources_used"] = {k: v for k, v in used.items() if v}
    uses = dict(st.get("uses_used") or {})
    for k in _uses_keys(ch, short_only=True):
        uses.pop(k, None)
    st["uses_used"] = uses
    for item in (ch.get("inventory") or {}).get("items") or []:
        if (item.get("charges") or {}).get("reset") == "short":
            _regain_charges(item)
    return ch


def long_rest(ch):
    """Everything back: HP (temp HP ends), every hit die, slots, pools and
    uses; item charges by their regain (dawn, dusk, midnight count as a
    long rest); death saves cleared; exhaustion goes down by 1."""
    st = _state(ch)
    st.update({
        "hp_current": None, "hp_temp": 0,
        "hit_dice_used": {}, "slots_used": {}, "pact_slots_used": {},
        "resources_used": {},
        # a long rest gives back every use but "once, then it's gone"
        "uses_used": {k: v for k, v in (st.get("uses_used") or {}).items() if k in set(_uses_keys(ch, False, never=True))},
        "death_saves": {"ok": 0, "fail": 0},
        "exhaustion": max(0, _num(st.get("exhaustion")) - 1),
    })
    # charges back by the item's regain; dawn, dusk and midnight are a long rest
    for item in (ch.get("inventory") or {}).get("items") or []:
        if (item.get("charges") or {}).get("reset") in LONG_RESETS:
            _regain_charges(item)
    return ch


def rest(ch, kind):
    return long_rest(ch) if kind == "long" else short_rest(ch)


# ─── experience ───────────────────────────────────────────────────

def grant_experience(ch, delta):
    """Add (or take away, with a negative delta) XP, never below 0."""
    ch["exp"] = max(0, _num(ch.get("exp")) + _num(delta))
    return ch
