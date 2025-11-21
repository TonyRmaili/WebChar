
import os
import json
from collections import defaultdict
from .dice_handler import roll_attack, roll_save

# Simple label tags you can color in the frontend
HIT_LABEL = {
    "hit": "[HIT]",
    "miss": "[MISS]",
    "crit": "[CRIT]",
    "crit_miss": "[CRIT MISS]",
}

SAVE_LABEL = {
    "success": "[SAVE]",
    "success_half": "[SAVE (HALF)]",
    "fail": "[FAIL]",
}


def handle_minionEffects(payload):
    minions = payload.minion_effects
    target_ac = payload.target_ac
    target_save_mod = payload.target_save_mod
    target_roll_type = payload.target_roll_type
    minions_roll_type = payload.minions_roll_type

    saves = []
    attacks = []

    for minion in minions:
        minion_name = minion["minion_name"]
        minion_path = minion["minion_path"]
        units = minion["units"]

        for category, effects in minion["effects_by_category"].items():
            for effect in effects:
                # --- ATTACKS ---
                attack_outputs = handle_attacks(
                    effect,
                    target_ac,
                    minions_roll_type,
                    units,
                    minion_name,
                )
                if attack_outputs:
                    attacks.extend(attack_outputs)

                # --- SAVES ---
                save_outputs = handle_saves(
                    effect,
                    target_save_mod,
                    target_roll_type,
                    units,
                    minion_name,
                )
                if save_outputs:
                    saves.extend(save_outputs)

    return format_minion_results({"attacks": attacks,"saves": saves})

def handle_saves(effect, target_save_mod, target_roll_type, units, minion_name):
    # Only effects that involve a save
    if effect["effect_type"] not in ("save", "attack_and_save"):
        return []

    save_block = effect["save"]
    dc = save_block["dc_bonus"]
    half_damage = bool(save_block.get("half_damage", False))
    damages = save_block["damages"]
    effect_name = effect["name"]

    results = []

    for unit in units:
        if not unit.get("selected"):
            continue

        output = roll_save(
            size=20,
            mod=target_save_mod,
            save_type=target_roll_type,
            dc=dc,
            half_damage=half_damage,
            damages=damages,
            effect_name=effect_name,
            minion_name=minion_name,
        )
        output["unit_id"] = unit["id"]
        results.append(output)

    return results

def handle_attacks(effect, target_ac, minions_roll_type, units, minion_name):
    """
    Return a list of attack results (one per selected unit) for this effect.
    If the effect is not an attack-type, return an empty list.
    """
    if effect["effect_type"] not in ("attack", "attack_and_save"):
        return []

    to_hit = effect["attack"]["hit_bonus"]
    attack_name = effect["name"]
    damages = effect["attack"]["damages"]

    results = []

    for unit in units:
        if not unit.get("selected"):
            continue

        output = roll_attack(
            size=20,
            mod=to_hit,
            roll_type=minions_roll_type,
            attack_name=attack_name,
            target_ac=target_ac,
            minion_name=minion_name,
            damages=damages,
        )
        output["unit_id"] = unit["id"]
        results.append(output)

    return results

def format_damage_list(damages):
    """
    damages is a list of [amount, damage_type]
    """
    if not damages:
        return "no damage"
    parts = []
    for amount, dtype in damages:
        tag = f"[{dtype.upper()}]"  # damage-type tag
        parts.append(f"{tag} {amount}")
    return ", ".join(parts)

def format_minion_results(summary: dict) -> str:
    """
    summary: {
      "attacks": [...],
      "saves": [...]
    }
    Returns a multi-line string.
    """
    attacks = summary.get("attacks", [])
    saves = summary.get("saves", [])

    # --- Group per minion -> unit -> {attacks:[], saves:[]} ---
    grouped = defaultdict(lambda: defaultdict(lambda: {"attacks": [], "saves": []}))

    for atk in attacks:
        m = atk["minion_name"]
        u = atk["unit_id"]
        grouped[m][u]["attacks"].append(atk)

    for sv in saves:
        m = sv["minion_name"]
        u = sv["unit_id"]
        grouped[m][u]["saves"].append(sv)

    # --- Damage totals by type (attacks + saves) ---
    damage_by_type = defaultdict(int)

    for atk in attacks:
        for amount, dtype in atk.get("damages", []):
            damage_by_type[dtype] += amount

    for sv in saves:
        for amount, dtype in sv.get("damages", []):
            damage_by_type[dtype] += amount

    total_damage = sum(damage_by_type.values())

    # --- Build output lines ---
    lines = []

    # Minions in alphabetical order
    for minion_name in sorted(grouped.keys()):
        lines.append(f"=== {minion_name} ===")

        units = grouped[minion_name]
        # Sort units by unit_id for stable order
        for unit_id in sorted(units.keys()):
            data = units[unit_id]
            unit_attacks = data["attacks"]
            unit_saves = data["saves"]

            lines.append(f"  Unit {unit_id}:")

            # Attacks
            if unit_attacks:
                lines.append("    Attacks:")
                for atk in unit_attacks:
                    hit_type = atk["hit_type"]
                    label = HIT_LABEL.get(hit_type, f"[{hit_type.upper()}]")
                    roll = atk["hit_roll"]
                    mod = int(atk["hit_mod"])
                    total_roll = roll + mod
                    target_ac = atk["target_ac"]
                    dmg_str = format_damage_list(atk.get("damages", []))
                    attack_name = atk["attack_name"]

                    lines.append(
                        f"      {label} {attack_name} "
                        f"(roll {roll} + {mod} = {total_roll} vs AC {target_ac}) → {dmg_str}"
                    )
            else:
                lines.append("    Attacks: none")

            # Saves
            if unit_saves:
                lines.append("    Saves:")
                for sv in unit_saves:
                    result = sv["result"]
                    label = SAVE_LABEL.get(result, f"[{result.upper()}]")
                    roll = sv["roll"]
                    mod = int(sv["save_mod"])
                    total_roll = roll + mod
                    dc = sv["dc"]
                    dmg_str = format_damage_list(sv.get("damages", []))
                    effect_name = sv["effect_name"]

                    lines.append(
                        f"      {label} {effect_name} "
                        f"(roll {roll} + {mod} = {total_roll} vs DC {dc}) → {dmg_str}"
                    )
            else:
                lines.append("    Saves: none")

            lines.append("")  # blank line between units

        lines.append("")  # blank line between minions

    # --- Damage totals section ---
    lines.append("=== DAMAGE TOTALS BY TYPE ===")
    if damage_by_type:
        for dtype in sorted(damage_by_type.keys()):
            tag = f"[{dtype.upper()}]"
            lines.append(f"  {tag} {damage_by_type[dtype]}")
        lines.append(f"  TOTAL: {total_damage}")
    else:
        lines.append("  No damage dealt.")

    return "\n".join(lines)


if __name__=="__main__":

    with open("minion_effects.json") as f:
        test_data = json.load(f)


    handle_minionEffects(payload=test_data)

    
