"""Rules that change a character during play: damage, healing, rests and XP.

Every function takes the character's data (the dict from its JSON file),
changes it in place and returns it. Loading and saving the file is the
caller's job (see app/character_files.py: edit_character), so these are
easy to try out on their own:

    data = {"health": {"current_hp": 10, "temp_hp": 3, "barrier": 0}}
    damage_health(data, -5)
    data["health"]   # {"current_hp": 8, "temp_hp": 0, "barrier": 0}

A missing or odd field is skipped instead of stopping the whole rest,
so one broken effect can't block the spell slots after it.
"""


# ---------- small helpers ----------

def _num(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _list(value):
    return value if isinstance(value, list) else []


def _dict(value):
    return value if isinstance(value, dict) else {}


def _charges(row):
    """The charges block of an effect or item, if it has charges."""
    charges = _dict(row).get("charges")
    return charges if isinstance(charges, dict) and charges.get("has") else None


def _refill(charges):
    """Back to the maximum."""
    charges["current_charges"] = _num(charges.get("max_charges"))


def _regain(charges):
    """Regain reset_amount (or everything, if it is "full"), never above the maximum."""
    top = _num(charges.get("max_charges"))
    amount = charges.get("reset_amount")
    if amount == "full":
        charges["current_charges"] = top
    else:
        charges["current_charges"] = min(top, _num(charges.get("current_charges")) + _num(amount))


def _refill_slots(rows):
    for row in _list(rows):
        if isinstance(row, dict) and "slots_max" in row:
            row["slots_current"] = row["slots_max"]


def _refill_innate(spells):
    for spell in _list(spells):
        uses = _dict(spell).get("uses")
        if isinstance(uses, dict) and "max" in uses:
            uses["current"] = uses["max"]


# ---------- health ----------

def damage_health(char_data, value):
    """Damage goes to the barrier first, then temp HP, then HP (not below 0)."""
    health = char_data.setdefault("health", {})
    hp = _num(health.get("current_hp"))
    temp_hp = _num(health.get("temp_hp"))
    barrier = _num(health.get("barrier"))

    damage = abs(_num(value))

    taken = min(barrier, damage)
    barrier -= taken
    damage -= taken

    taken = min(temp_hp, damage)
    temp_hp -= taken
    damage -= taken

    hp = max(hp - damage, 0)

    health["current_hp"] = hp
    health["temp_hp"] = temp_hp
    health["barrier"] = barrier
    return char_data


def heal_health(char_data, value):
    """Healing never goes above max HP plus the max HP modifier."""
    health = char_data.setdefault("health", {})
    max_total = _num(health.get("max_hp")) + _num(health.get("max_hp_mod"))
    health["current_hp"] = min(_num(health.get("current_hp")) + abs(_num(value)), max_total)
    return char_data


# ---------- rests ----------

def on_shortrest(char_data):
    spellbook = _dict(char_data.get("spellbook"))

    # Effects regain their reset amount.
    for effect in _list(char_data.get("effects")):
        charges = _charges(effect)
        if charges:
            _regain(charges)

    # Pact slots come back in full.
    _refill_slots(spellbook.get("pactslots"))

    # Innate spells with limited uses.
    _refill_innate(spellbook.get("spells"))

    # Sorcery points regain their reset amount.
    sorcery = spellbook.get("sorcery_points")
    if isinstance(sorcery, dict):
        _regain(sorcery)

    # Magic items regain their reset amount ("full" = all of them).
    for item in _list(_dict(char_data.get("inventory")).get("magic")):
        charges = _charges(item)
        if charges:
            _regain(charges)

    return char_data


def on_longrest(char_data):
    spellbook = _dict(char_data.get("spellbook"))

    # Hit points back to max.
    health = char_data.get("health")
    if isinstance(health, dict) and "max_hp" in health:
        health["current_hp"] = health["max_hp"]

    # Every hit die back.
    for die in _dict(char_data.get("hit_dice")).values():
        if isinstance(die, dict) and "max" in die:
            die["current"] = die["max"]

    # All slots, innate spells and sorcery points back.
    _refill_slots(spellbook.get("pactslots"))
    _refill_slots(spellbook.get("spellslots"))
    _refill_innate(spellbook.get("spells"))

    sorcery = spellbook.get("sorcery_points")
    if isinstance(sorcery, dict):
        _refill(sorcery)

    # Effects and magic items back to full.
    for effect in _list(char_data.get("effects")):
        charges = _charges(effect)
        if charges:
            _refill(charges)

    for item in _list(_dict(char_data.get("inventory")).get("magic")):
        charges = _charges(item)
        if charges:
            _refill(charges)

    return char_data


# ---------- experience ----------

def grant_experience(char_data, delta):
    """Add (or remove, with a negative delta) experience, never below 0."""
    char_data["exp"] = max(0, _num(char_data.get("exp")) + _num(delta))
    return char_data