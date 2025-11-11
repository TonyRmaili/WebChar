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

def grant_experience(user, character, exp):
    char_data = load_character(user=user, character=character.name)
    char_data["exp"] = char_data.get("exp", 0) + exp
    save_character(user=user, character=character.name, char_data=char_data)

def damage_health(user, character, value):
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

    try:
        max_hp = char_data["health"]["max_hp"]
        current_hp = char_data["health"]["current_hp"]
        max_hp_total = max_hp + char_data["health"]["max_hp_mod"]

        new_hp = current_hp + value
        char_data["health"]["current_hp"] = new_hp
        if char_data["health"]["current_hp"] > max_hp_total:
            char_data["health"]["current_hp"] = max_hp_total

        save_character(
            user=user,
            character=character,
            char_data=char_data
        )
        return char_data
    except KeyError as e:
        return e

def on_shortrest(user,character):
    char_data = load_character(user, character)
    
    # effects
    try:
        effects = char_data["effects"]
        for effect in effects:
            
            if effect["charges"]["has"]:
                effect["charges"]["current_charges"] += effect["charges"]["reset_amount"]
                if effect["charges"]["current_charges"] > effect["charges"]["max_charges"]:
                    effect["charges"]["current_charges"] = effect["charges"]["max_charges"]
            
    except KeyError as e:
        print(e)
    except TypeError as e:
        print(e) 
    
    # spells
    # pactslots
    try:
        pactslots = char_data["spellbook"]["pactslots"]
        for slots in pactslots:
            slots["slots_current"] = slots["slots_max"]
        
    except KeyError as e:
        print(e)
    except TypeError as e:
            print(e)  
    
    # innate spells
    try:
        spells = char_data["spellbook"]["spells"]
        for spell in spells:
            if spell["innate"]:
                try:
                    spell["current_charges"] += spell["reset_amount"]
                    if spell["current_charges"] > spell["max_charges"]:
                        spell["current_charges"] = spell["max_charges"]
                except TypeError as e:
                    pass
                except KeyError as e:
                    pass
    except KeyError as e:
        print(e)
    except TypeError as e:
        print(e)  

    # sorcery points
    try:
        char_data["spellbook"]["sorcery_points"]["current_charges"] += char_data["spellbook"]["sorcery_points"]["reset_amount"]
        if char_data["spellbook"]["sorcery_points"]["current_charges"] > char_data["spellbook"]["sorcery_points"]["max_charges"]:
            char_data["spellbook"]["sorcery_points"]["current_charges"] = char_data["spellbook"]["sorcery_points"]["max_charges"]
    except KeyError as e:
        print(e) 
    except TypeError as e:
        print(e)
    
    
    # magic items
    try:
        charge_magic_items(char_data=char_data,character=character,user=user)
    except KeyError as e:
        print(e)
    except TypeError as e:
        print(e)


    save_character(user=user,character=character,char_data=char_data)
    return char_data
    
def on_longrest(user,character):
    char_data = load_character(user, character)
    
    # current_hp
    try:
        char_data["health"]["current_hp"] = char_data["health"]["max_hp"]
    except KeyError as e:
        print(e)
    except TypeError as e:
        print(e)
    
    # hit dice
    try:
        hit_dice=  char_data["hit_dice"]
        for dice in hit_dice.values():
            dice["current"] = dice["max"]
    except KeyError as e:
        print(e)
    except TypeError as e:
        print(e)

    # spells
    # pactslots
    try:
        pactslots = char_data["spellbook"]["pactslots"]
        for slots in pactslots:
            slots["slots_current"] = slots["slots_max"]
    except KeyError as e:
        print(e)
    except TypeError as e:
        print(e)
    
    # spellslots
    try:
        spellslots = char_data["spellbook"]["spellslots"]
        for slots in spellslots:
            slots["slots_current"] = slots["slots_max"]
    except KeyError as e:
        print(e)
    except TypeError as e:
        print(e) 
    
    # innate spells
    try:
        innate_spells = char_data["spellbook"]["spells"]
        for spell in innate_spells:
            if spell["innate"]:
                try:
                    spell["current_charges"] = spell["max_charges"]
                except KeyError as e:
                    print(e)
                except TypeError as e:
                    print(e) 
    except KeyError as e:
        print(e)
    except TypeError as e:
        print(e) 
    
    # sorcery points
    try:
        char_data["spellbook"]["sorcery_points"]["current_charges"] = char_data["spellbook"]["sorcery_points"]["max_charges"]
    except KeyError as e:
        print(e)
    except TypeError as e:
        print(e)  

    # effects
    try: 
        effects = char_data["effects"]
        for effect in effects:
            if effect["charges"]["has"]:
                effect["charges"]["current_charges"] = effect["charges"]["max_charges"]
    except KeyError as e:
        print(e)
    except TypeError as e:
        print(e)  
    
    # magic items
    try:
        items = char_data["inventory"]["magic"]
        for item in items:
            if item["charges"]["has"]:
                item["charges"]["current_charges"] = item["charges"]["max_charges"]
    except KeyError as e:
        print(e)
    except TypeError as e:
        print(e)  
    
    save_character(user=user,character=character,char_data=char_data)
      
def charge_magic_items(char_data,character,user):
    items = char_data["inventory"]["magic"]
    for item in items:
        if item["charges"]["has"]:
            if item["charges"]["reset_amount"] == "full":
                item["charges"]["current_charges"] = item["charges"]["max_charges"]
            else:
                item["charges"]["current_charges"] += item["charges"]["reset_amount"]
                if item["charges"]["current_charges"] > item["charges"]["max_charges"]:
                    item["charges"]["current_charges"] = item["charges"]["max_charges"]

    save_character(user=user,character=character,char_data=char_data)


   

if __name__ == "__main__":
    heal_health("bisi","Mokrot",value=0)