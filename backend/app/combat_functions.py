import json
import os

savefile_path = "./app/database/save_files/"

def load_character(user,character):
    character_path = os.path.join(savefile_path, user,"characters",character+".json")
    with open(character_path) as f:
        char_data =json.load(f)
    return char_data

def save_character(user,character,char_data):
    character_path = os.path.join(savefile_path, user,"characters",character+".json")
    with open(character_path, "w") as f:
        json.dump(char_data,f,indent=4)



def damage_health(user, character, value):
    """
    Apply incoming damage (value is already negative) in order:
    barrier → temp_hp → hp.
    None of these can go below zero.
    """
    char_data = load_character(user, character)

    current = char_data.get("health", {})
    hp = current.get("current_hp", 0)
    temp_hp = current.get("temp_hp", 0)
    barrier = current.get("barrier", 0)

    # Convert to positive damage amount
    damage = abs(value)

    # --- 1️⃣ Apply to Barrier first ---
    if barrier >= damage:
        barrier -= damage
        damage = 0
    else:
        damage -= barrier
        barrier = 0

    # --- 2️⃣ Apply to Temp HP ---
    if damage > 0:
        if temp_hp >= damage:
            temp_hp -= damage
            damage = 0
        else:
            damage -= temp_hp
            temp_hp = 0

    # --- 3️⃣ Apply to HP ---
    if damage > 0:
        hp = max(hp - damage, 0)

    # --- Save updated values ---
    char_data["health"]["current_hp"] = hp
    char_data["health"]["temp_hp"] = temp_hp
    char_data["health"]["barrier"] = barrier

    save_character(user=user, character=character, char_data=char_data)
    return char_data


def heal_health(user,character,value):
    char_data = load_character(user,character)

    max_hp = char_data["health"]["max_hp"]
    current_hp = char_data["health"]["current_hp"]

    new_hp = current_hp + value
    char_data["health"]["current_hp"] = new_hp
    if char_data["health"]["current_hp"] > max_hp:
        char_data["health"]["current_hp"] = max_hp

    save_character(
        user=user,
        character=character,
        char_data=char_data
    )
    return char_data

     
def on_shortrest(user,character):
    char_data = load_character(user, character)

    action_types = ["actions","bonus_actions","reactions"]

    # effects
    for action_type in action_types:
        charge_effects(char_data=char_data,
                       action_type=action_type,
                       rest_type="short",
                       character=character,
                       user=user)
        
    # pactslots
    pactslots = char_data["spellbook"]["pactslots"]
    for slots in pactslots:
        slots["slots_current"] = slots["slots_max"]
        
    # traits

    # magic items
    charge_magic_items(char_data=char_data,character=character,
                       user=user,rest_type="short")
   

    
    return char_data




def on_longrest(user,character):
    '''
    always full resets
       
    '''

    char_data = load_character(user, character)

    #  current_hp
    char_data["health"]["current_hp"] = char_data["health"]["max_hp"]
    
    # hit dice
    hit_dice=  char_data["hit_dice"]
    for dice in hit_dice.values():
        dice["current"] = dice["max"]

    # spells
    # pactslots
    pactslots = char_data["spellbook"]["pactslots"]
    for slots in pactslots:
        slots["slots_current"] = slots["slots_max"]

    # spellslots
    spellslots = char_data["spellbook"]["spellslots"]
    for slots in spellslots:
        slots["slots_current"] = slots["slots_max"]

    # innate spells
    innate_spells = char_data["spellbook"]["spells"]
    for spell in innate_spells:
        if spell["innate"]:
            spell["current_charges"] = spell["max_charges"]

    # sorcery points
    char_data["spellbook"]["sorcery_points"]["current_charges"] = char_data["spellbook"]["sorcery_points"]["max_charges"]





    save_character(user=user,character=character,char_data=char_data)


   
    
def on_initiative_roll(user,character):
    print(f'{user} new init roll')


def on_new_turn(user,character):
    print(f'{user} new turn')




def charge_magic_items(char_data,character,user,rest_type):
    items = char_data["inventory"]["magic"]
    
    for item in items:
        if item["charges"]["has"]:
            if rest_type == "short":
                item["charges"]["current_charges"] += item["charges"]["resetAmount"]
                if item["charges"]["current_charges"] > item["charges"]["max_charges"]:
                    item["charges"]["current_charges"] = item["charges"]["max_charges"]
    
    save_character(user=user,character=character,char_data=char_data)

def charge_effects(char_data,action_type,rest_type,user,character):
    for action in char_data["effects"][action_type]:
        if action["charges"]["has"]:
            if rest_type == "short":
                if action["charges"]["resetAmount"] == "full":
                    action["charges"]["current_charges"] = action["charges"]["max_charges"]
                else:
                    action["charges"]["current_charges"] += action["charges"]["resetAmount"]
                    if action["charges"]["current_charges"] > action["charges"]["max_charges"]:
                        action["charges"]["current_charges"] = action["charges"]["max_charges"]

    save_character(user=user,character=character,char_data=char_data)
   

if __name__ == "__main__":
    heal_health("bisi","Mokrot",value=0)