from random import randint 

DICE_SIZES = {
    "d4": 4,
    "d6": 6,
    "d8": 8,
    "d10": 10,
    "d12": 12,
    "d20": 20,
    "d100": 100,
}

# only used for init for the moment; outdated
def roll_dice(size:int,modifier: int, roll_type:bool=None) -> int:
    if roll_type == None:
        return randint(1, size) + modifier
    
    if roll_type == False:
        roll1 = randint(1, size) + modifier
        roll2 = randint(1, size) + modifier
        return min(roll1,roll2)
        

    if roll_type == True:
        roll1 = randint(1, size) + modifier
        roll2 = randint(1, size) + modifier
        return max(roll1,roll2) 


def roll_save(
    size: int,
    mod: int,
    save_type: str,
    dc: int,
    half_damage: bool,
    damages: list,
    effect_name: str,
    minion_name: str,
):
    """
    Roll a saving throw for one unit.

    save_type: "normal" | "advantage" | "disadvantage"
    half_damage: if True, successful save deals half damage instead of 0.
    damages: list of {dice_count, dice_size, mod, damage_type}
    """
    output = {
        "minion_name": minion_name,
        "effect_name": effect_name,
        "save_mod": mod,
        "dc": dc,
        "result": None,     # "success", "success_half", "fail"
        "roll": None,
        "damages": [],      # list of (amount, damage_type)
    }

    mod = int(mod)

    # Roll d20 according to save_type
    if save_type == "normal":
        roll = randint(1, size)
    elif save_type == "disadvantage":
        roll1 = randint(1, size)
        roll2 = randint(1, size)
        roll = min(roll1, roll2)
    elif save_type == "advantage":
        roll1 = randint(1, size)
        roll2 = randint(1, size)
        roll = max(roll1, roll2)
    else:
        # Fallback to normal if unknown string
        roll = randint(1, size)

    total = roll + mod
    output["roll"] = roll

    if total >= dc:
        # Save succeeded
        if half_damage:
            output["result"] = "success_half"
            output["damages"] = handle_save_damage(damages, half=True)
        else:
            output["result"] = "success"
            output["damages"] = []
    else:
        # Save failed -> full damage
        output["result"] = "fail"
        output["damages"] = handle_save_damage(damages, half=False)

    return output


def handle_save_damage(damages, half: bool = False):
    """
    Calculate damage for a save-based effect.
    If half=True, all damage is halved (integer division).
    """
    result = []
    for damage in damages:
        dice_size = DICE_SIZES[damage["dice_size"]]
        base = roll_damage(
            dice_size=dice_size,
            dice_count=damage["dice_count"],
            mod=damage["mod"],
        )
        if half:
            base = base // 2
        result.append((base, damage["damage_type"]))
    return result

def roll_attack(size,mod,roll_type,attack_name,target_ac,minion_name,damages):

    output = {
        "minion_name":minion_name,
        "attack_name":attack_name,
        "hit_mod":mod,
        "target_ac":target_ac,
        "damages":[],
        "hit_type":None,
        "hit_roll":None,

    }

    mod = int(mod)
    if roll_type == "normal":
        roll = randint(1, size) 
    
    elif roll_type == "disadvantage":
        roll1 = randint(1, size) 
        roll2 = randint(1, size) 
        roll = min(roll1,roll2)
        

    elif roll_type == "advantage":
        roll1 = randint(1, size) 
        roll2 = randint(1, size) 
        roll = max(roll1,roll2)
    

    if roll == 1:
        output["hit_type"] = "crit_miss"
        output["hit_roll"] = roll
        return output
    
    elif roll == 20:
        hit_type = "crit"
        output["hit_type"] = hit_type
        output["hit_roll"] = roll
        output = handle_attack_damage(message=output,damages=damages,hit_type=hit_type)

    elif (roll+mod) >= target_ac:
        hit_type = "hit"
        output["hit_type"] = hit_type
        output["hit_roll"] = roll
        output = handle_attack_damage(message=output,damages=damages,hit_type=hit_type)
    
    else:
        output["hit_type"] = "miss"
        output["hit_roll"] = roll
       

    return output

def handle_attack_damage(message,damages,hit_type):
    for damage in damages:
        dice_size = DICE_SIZES[damage["dice_size"]]
        if hit_type =="hit":
            damage_roll = roll_damage(
                dice_size = dice_size,
                dice_count= damage["dice_count"],
                mod= damage["mod"]
            )

            message["damages"].append((damage_roll,damage['damage_type']))
            
        elif hit_type =="crit":
            damage_roll = roll_damage(
                dice_size = dice_size,
                dice_count= 2*damage["dice_count"],
                mod= damage["mod"]
            )
            message["damages"].append((damage_roll,damage['damage_type']))
            
    return message

def roll_damage(dice_size,dice_count,mod):
    roll_total = 0
    for _ in range(dice_count):
        roll_total += randint(1,dice_size)
    roll_total += mod

    return roll_total

if __name__=="__main__":
    roll = roll_dice(20,3,roll_type=None)
    print(roll)