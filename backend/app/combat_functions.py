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



def damage_health(user,character,value):
    char_data = load_character(user,character)

    max_hp = char_data["max_hp"]
    current_hp = char_data["current"]["hp"]
    temp_hp = char_data["current"]["temp_hp"]

    
    new_hp = current_hp + value
    char_data["current"]["hp"] = new_hp

    if char_data["current"]["hp"] < 0:
        char_data["current"]["hp"] = 0

    
    save_character(
        user=user,
        character=character,
        char_data=char_data
    )



def heal_health(user,character,value):
    char_data = load_character(user,character)

    max_hp = char_data["max_hp"]
    current_hp = char_data["current"]["hp"]

    new_hp = current_hp + value
    char_data["current"]["hp"] = new_hp
    if char_data["current"]["hp"] > max_hp:
        char_data["current"]["hp"] = max_hp

    save_character(
        user=user,
        character=character,
        char_data=char_data
    )

     

if __name__ == "__main__":
    heal_health("bisi","Mokrot",value=0)