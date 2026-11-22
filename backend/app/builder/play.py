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

def _uses_keys(ch, short_only):
    """The uses_used keys of every feature and spell a rest gives back."""
    keys = []
    for layer in ch.get("layers") or []:
        frm = layer.get("from")
        for row in (layer.get("features") or []) + (layer.get("spells") or []):
            uses = row.get("uses")
            if not isinstance(uses, dict):
                continue
            reset = uses.get("reset")
            if short_only and reset not in ("short", "turn", "recharge"):
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
            item["charges_used"] = 0
    return ch


def long_rest(ch):
    """Everything back: HP (temp HP ends), every hit die, slots, pools,
    uses and item charges; death saves cleared; exhaustion goes down by 1."""
    st = _state(ch)
    st.update({
        "hp_current": None, "hp_temp": 0,
        "hit_dice_used": {}, "slots_used": {}, "pact_slots_used": {},
        "resources_used": {}, "uses_used": {},
        "death_saves": {"ok": 0, "fail": 0},
        "exhaustion": max(0, _num(st.get("exhaustion")) - 1),
    })
    for item in (ch.get("inventory") or {}).get("items") or []:
        if item.get("charges_used"):
            item["charges_used"] = 0
    return ch


def rest(ch, kind):
    return long_rest(ch) if kind == "long" else short_rest(ch)


# ─── experience ───────────────────────────────────────────────────

def grant_experience(ch, delta):
    """Add (or take away, with a negative delta) XP, never below 0."""
    ch["exp"] = max(0, _num(ch.get("exp")) + _num(delta))
    return ch
