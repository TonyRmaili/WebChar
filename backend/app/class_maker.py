import os
import json
import random
import math
from openai import OpenAI
from dotenv import load_dotenv

from .dice_handler import generate_ability_scores, score_to_mod
from .quick_class_schema import QuickClassSchema




class ClassMaker:
    def __init__(self):

        # paths
        self.classes_path = "classes_json/"
        self.output_test_path = os.path.join(self.classes_path,"_output_test")

        self.backgrounds_path = os.path.join(self.classes_path,"backgrounds")

        self.instructions_path = "quick_class_instructions.md"
        
        # AI config
        load_dotenv(override=True)
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(
            api_key=self.api_key
        )
        self.model = "gpt-5-mini"
        self.reasoning = {"effort" : f""}


        self.schema = QuickClassSchema

        # constants
        self.classes = [
            {"barbarian":["Wild Heart","World Tree","Berserker","Zealot"]},
            "bard",
            "cleric",
            "druid",
            "fighter",
            "monk",
            "paladin",
            "ranger",
            "rogue",
            "sorcerer",
            "warlock",
            "wizard"
        ]

        self.skills = [
            "Acrobatics",
            "Animal Handling",
            "Arcana",
            "Athletics",
            "Deception",
            "History",
            "Insight",
            "Intimidation",
            "Investigation",
            "Medicine",
            "Nature",
            "Perception",
            "Performance",
            "Persuasion",
            "Religion",
            "Sleight of Hand",
            "Stealth",
            "Survival"
        ]

        self.spell_slots = {
        "1":  { "1": 2 },
        "2":  { "1": 3 },
        "3":  { "1": 4, "2": 2 },
        "4":  { "1": 4, "2": 3 },
        "5":  { "1": 4, "2": 3, "3": 2 },
        "6":  { "1": 4, "2": 3, "3": 3 },
        "7":  { "1": 4, "2": 3, "3": 3, "4": 1 },
        "8":  { "1": 4, "2": 3, "3": 3, "4": 2 },
        "9":  { "1": 4, "2": 3, "3": 3, "4": 2, "5": 1 },
        "10": { "1": 4, "2": 3, "3": 3, "4": 2, "5": 2 },
        "11": { "1": 4, "2": 3, "3": 3, "4": 2, "5": 2, "6": 1 },
        "12": { "1": 4, "2": 3, "3": 3, "4": 2, "5": 2, "6": 1 },
        "13": { "1": 4, "2": 3, "3": 3, "4": 2, "5": 2, "6": 1, "7": 1 },
        "14": { "1": 4, "2": 3, "3": 3, "4": 2, "5": 2, "6": 1, "7": 1 },
        "15": { "1": 4, "2": 3, "3": 3, "4": 2, "5": 2, "6": 1, "7": 1, "8": 1 },
        "16": { "1": 4, "2": 3, "3": 3, "4": 2, "5": 2, "6": 1, "7": 1, "8": 1 },
        "17": { "1": 4, "2": 3, "3": 3, "4": 2, "5": 2, "6": 1, "7": 1, "8": 1, "9": 1 },
        "18": { "1": 4, "2": 3, "3": 3, "4": 2, "5": 2, "6": 1, "7": 1, "8": 1, "9": 1 },
        "19": { "1": 4, "2": 3, "3": 3, "4": 2, "5": 2, "6": 1, "7": 1, "8": 1, "9": 1 },
        "20": { "1": 4, "2": 3, "3": 3, "4": 2, "5": 2, "6": 1, "7": 1, "8": 1, "9": 1 }
        }

        self.pact_slots = {
            "1":  { "1": 1 },
            "2":  { "1": 2 },
            "3":  { "2": 2 },
            "4":  { "2": 2 },
            "5":  { "3": 2 },
            "6":  { "3": 2 },
            "7":  { "4": 2 },
            "8":  { "4": 2 },
            "9":  { "5": 2 },
            "10": { "5": 2 },
            "11": { "5": 3 },
            "12": { "5": 3 },
            "13": { "5": 3 },
            "14": { "5": 3 },
            "15": { "5": 3 },
            "16": { "5": 3 },
            "17": { "5": 4 },
            "18": { "5": 4 },
            "19": { "5": 4 },
            "20": { "5": 4 }
        }

        self.ability_scores = {
            "str":{
                "score":0,
                "mod":0,
                "check":0,
                "save":0,
                "proficient":False,
                "expertise":False,
            },
            "dex":{
                "score":0,
                "mod":0,
                "check":0,
                "save":0,
                "proficient":False,
                "expertise":False,
            },
            "con":{
                "score":0,
                "mod":0,
                "check":0,
                "save":0,
                "proficient":False,
                "expertise":False,
            },
            "int":{
                "score":0,
                "mod":0,
                "check":0,
                "save":0,
                "proficient":False,
                "expertise":False,
            },
            "wis":{
                "score":0,
                "mod":0,
                "check":0,
                "save":0,
                "proficient":False,
                "expertise":False,
            },
            "cha":{
                "score":0,
                "mod":0,
                "check":0,
                "save":0,
                "proficient":False,
                "expertise":False,
                }
        }
        
        self.hit_dice = {
            "d6":  {"amount":0, "average":4, "size":6, "first_class":False},
            "d8":  {"amount":0, "average":5, "size":8, "first_class":False},
            "d10": {"amount":0, "average":6, "size":10, "first_class":False},
            "d12": {"amount":0, "average":7, "size":12, "first_class":False},
        }
         
        self.pb_table = {
            "1": 2,
            "2": 2,
            "3": 2,
            "4": 2,
            "5": 3,
            "6": 3,
            "7": 3,
            "8": 3,
            "9": 4,
            "10": 4,
            "11": 4,
            "12": 4,
            "13": 5,
            "14": 5,
            "15": 5,
            "16": 5,
            "17": 6,
            "18": 6,
            "19": 6,
            "20": 6,
        }



    def handle_background(self,background_data,output_class,all_selected_skills,all_selected_tools):

        feat = background_data["feat"]
        skills = background_data["skill_proficiencies"]
        tools = background_data["tool_proficiencies"]

        all_selected_skills.update(skills)
        all_selected_tools.update(tools)
        
        output_class["feats"].append(feat)

        return output_class,all_selected_skills,all_selected_tools

    def quick_maker(self,char_name:str,
                    classes_data:list,
                    general_data:dict,
        ):

        save_path = os.path.join(self.output_test_path, char_name)
        output_class = {
            "name" :char_name,
            "file_path": save_path,
            "background":"",
            "classes":[],
            "hit_dice":[],
            "saving_throw_proficiencies":[],
            "weapon_proficiencies":[],
            "armor_proficiencies":[],
            "primary_abilities":[],
            "multiclassing":[],
            "effects":[],
            "caster_level":0,
            "spell_slots":{},
            "feats":[]
        }

        total_level = 0

        all_weapon_prof = set()
        all_armor_prof = set()
        all_selected_skills = set()
        all_selected_tools = set()

        background_name = general_data["background"]
        backgrounds = self.load_json(self.backgrounds_path)
        background_data = backgrounds[background_name]

        output_class["background"] = background_name
        background_abilities = background_data["ability_scores"]

        output_class, all_selected_skills, all_selected_tools = self.handle_background(
            background_data=background_data,
            output_class=output_class,
            all_selected_skills=all_selected_skills,
            all_selected_tools=all_selected_tools
            )

        for cls in classes_data:
            class_name = cls["name"]
            core_data_path = os.path.join(self.classes_path,class_name,"core_data")
            core_data = self.load_json(filepath=core_data_path)

            core_traits = core_data["core_traits"]
            levels = core_data["levels"]
            multiclassing = core_traits["multiclassing"]
            hit_die = core_traits["hit_die"]

            level = cls["level"]

            output_class["classes"].append(cls)


            self.hit_dice[hit_die]["amount"] += level

            output_class["primary_abilities"].append(core_traits["primary_ability"])

    
            weapon_prof = core_traits.get("weapon_proficiencies") or []
            armor_prof = core_traits.get("armor_proficiencies") or []
            saving_throw_prof = core_traits.get("saving_throw_proficiencies") or []

            caster_type = core_data["caster_type"]

            caster_level , spell_slots = self.handle_spellslots(caster_type,level=level)
            output_class["spell_slots"] = spell_slots
            output_class["caster_level"] = caster_level

            if cls["first_class"]:
                output_class["saving_throw_proficiencies"] = saving_throw_prof

                starting_equipment = core_traits["starting_equipment"]
                selected_equipment = self.handle_choices(starting_equipment)
                output_class["starting_equipment"] = selected_equipment

                skill_choices = core_traits["skill_proficiencies"] or []
                selected_skills = self.handle_choices(skill_choices,all_selected_skills)

                tool_choices = core_traits.get("tool_proficiencies") or []
                selected_tools = self.handle_choices(tool_choices,all_selected_tools)

                self.hit_dice[hit_die]["first_class"] = cls["first_class"]

            else:
                weapon_prof = multiclassing.get("weapon_proficiencies") or []
                armor_prof = multiclassing.get("armor_proficiencies") or []
                skill_choices = multiclassing.get("skill_proficiencies") or []
                selected_skills = self.handle_choices(skill_choices,all_selected_skills)

                tool_choices = multiclassing.get("tool_proficiencies") or []
                selected_tools = self.handle_choices(tool_choices,all_selected_tools)


            all_selected_skills.update(selected_skills)
            all_selected_tools.update(selected_tools)
            all_weapon_prof.update(weapon_prof)
            all_armor_prof.update(armor_prof)
            
            total_level += level

            output_class["weapon_proficiencies"] = list(all_weapon_prof)
            output_class["armor_proficiencies"] = list(all_armor_prof)
            output_class["skill_proficiencies"] = list(all_selected_skills)
            output_class["tool_proficiencies"] = list(all_selected_tools)

            output_class = self.add_effects(levels,level,class_name,output_class)

        primary_abilities = output_class["primary_abilities"]

        output_class["hit_dice"] = self.hit_dice
        output_class["total_level"] = total_level

        pb = self.pb_table[str(total_level)]

        self.handle_ability_scores(background_abilities,primary_abilities,output_class["saving_throw_proficiencies"],pb)
        output_class["ability_scores"] = self.ability_scores

        max_hp = self.handle_max_hp()
        output_class["max_hp"] = max_hp

        self.save_json(filepath=save_path,data=output_class)

    def handle_spellslots(self,caster_type,level):
        caster_level = 0
        if caster_type == "full":
            caster_level += level
        elif caster_type == "half":
            caster_level += math.ceil(level / 2)
        
        elif caster_type == "third":
            return caster_level, None

        
        if caster_level == 0:
            return caster_level, None
    
        spell_slots = self.spell_slots[str(caster_level)]
        return caster_level, spell_slots

    def add_effects(self,levels_data,level,class_name,output_class):
        data = {}
        for lvl,effects in levels_data.items():
                if int(lvl) <= level:
                    for effect in effects:
                        effect["class_name"] = class_name
                        effect["level"] = lvl
                        effect["effect_category"] = "class"

                        output_class["effects"].append(effect)
        return output_class

    def handle_choices(self, choices_data, already_selected=None):
        if not choices_data:
            return []

        amount = choices_data["amount"]
        choices = choices_data["choices"]

        if already_selected is None:
            remaining = list(choices)
        else:
            remaining = [c for c in choices if c not in already_selected]

        if amount > len(remaining):
            amount = min(amount, len(remaining))
            random_choices = random.sample(remaining, amount)

        # random.sample guarantees uniqueness
        random_choices = random.sample(remaining, amount)
        return random_choices


    def handle_ability_scores(self, background_abilities, primary_abilities, saving_throw_prof, pb):
        # Roll and sort scores (highest first)
        scores = generate_ability_scores()
        scores = sorted(scores, reverse=True)

        dist_type = "2+1"
        prio_abilities = []
        missing_abilities = []

        # Primary abilities first
        for ability in primary_abilities:
            prio_abilities.append(ability)

        # Then CON if not already included
        if "con" not in prio_abilities:
            prio_abilities.append("con")

        # Remaining abilities (in random order)
        for ability in self.ability_scores.keys():
            if ability not in prio_abilities:
                missing_abilities.append(ability)

        random.shuffle(missing_abilities)
        prio_abilities.extend(missing_abilities)

        # Base assignment: map ability → rolled score using priority order
        ability_scores = {}
        for i, abi in enumerate(prio_abilities):
            ability_scores[abi] = scores[i]

        # Background-priority abilities: keep in prio_abilities order
        bg_prio_abi = []
        for abi in prio_abilities:
            if abi in background_abilities:
                bg_prio_abi.append((abi, ability_scores[abi]))

        # # If no matching background abilities, just store and exit
        # if not bg_prio_abi:
        #     for abi in prio_abilities:
        #         final_score = ability_scores[abi]
        #         self.ability_scores[abi]["score"] = final_score
        #     return ability_scores

        # # Ensure at least 3 entries so the parity logic works
        # while len(bg_prio_abi) < 3:
        #     bg_prio_abi.append(bg_prio_abi[-1])

        # Decide dist_type from parity of the first three background scores
        a0, a1, a2 = (s for _, s in bg_prio_abi[:3])
        if a0 % 2 == 0:
            if a1 % 2 == 1:
                dist_type = "2+1"
            elif a2 % 2 == 1:
                dist_type = "2+0+1"
            else:
                dist_type = "2+1"
        else:
            dist_type = "1+2" if a1 % 2 == 0 else "1+1+1"

        # Apply the chosen distribution to the corresponding abilities
        b0, b1, b2 = (name for name, _ in bg_prio_abi[:3])

        if dist_type == "2+1":
            ability_scores[b0] += 2
            ability_scores[b1] += 1
        elif dist_type == "2+0+1":
            ability_scores[b0] += 2
            ability_scores[b2] += 1
        elif dist_type == "1+2":
            ability_scores[b1] += 2
            ability_scores[b0] += 1
        elif dist_type == "1+1+1":
            ability_scores[b0] += 1
            ability_scores[b1] += 1
            ability_scores[b2] += 1

        # -------------------------------------------------------------------
        # FINAL STEP: Fill self.ability_scores with full data per ability
        # -------------------------------------------------------------------
        for abi in prio_abilities:
            score = ability_scores[abi]
            mod = score_to_mod(score)

            # Base fields
            self.ability_scores[abi]["score"] = score
            self.ability_scores[abi]["mod"] = mod
            self.ability_scores[abi]["check"] = mod

            # Determine proficiency
            is_prof = abi in saving_throw_prof
            self.ability_scores[abi]["proficient"] = is_prof

            # Already stored in your structure, default is False
            has_expertise = self.ability_scores[abi].get("expertise", False)

            # Determine save
            if has_expertise:
                save_value = mod + 2 * pb
            elif is_prof:
                save_value = mod + pb
            else:
                save_value = mod

            self.ability_scores[abi]["save"] = save_value

    def handle_max_hp(self, avg=True):
        max_hp = 0
        mod = self.ability_scores["con"]["mod"]

        for values in self.hit_dice.values():
            size = values["size"]
            amount = values["amount"]
            average = values["average"]
            if amount <= 0:
                continue
            if values["first_class"]:
                amount -= 1
                max_hp += size + mod
                if amount <= 0:
                    continue
                
                for i in range(amount):
                    max_hp += average + mod
            
            else:
                for i in range(amount):
                    max_hp += average + mod
        
        return max_hp

    def openai_parse(self,input,reasoning,text_format):
        self.reasoning["effort"] = reasoning

        response = self.client.responses.parse(
            model=self.model,
            input=input,
            reasoning=self.reasoning,
            text_format=text_format
        )
        parsed = response.output_parsed

        try:
            return parsed.model_dump()      
        except AttributeError:
            return parsed      


    def load_json(self,filepath):
        file = filepath+".json"
        with open(file,encoding="utf-8") as f:
            data = json.load(f)
        return data

    def save_json(self,filepath,data):
        file = filepath+".json"
        with open(file,"w",encoding="utf-8") as f:
            json.dump(data,f,indent=4)
        

    

if __name__=="__main__":
    class_maker = ClassMaker()

    path = class_maker.instructions_path

    with open(path) as f:
        instructions = f.read()

    input=[
        {"role": "system", "content": instructions},
        {"role": "user", "content": "Marlosh the handsome paladin lvl 7 with charisma 17 and strenght 15"}
        ]


    class_test = class_maker.openai_parse(
        input=input,
        reasoning="high",
        text_format=QuickClassSchema
    )

    save_path = os.path.join(class_maker.output_test_path,"test_class")    

    class_maker.save_json(data=class_test,filepath=save_path)

    # classes_data = []
    # barb_class = {
    #     "name":"barbarian",
    #     "sub_class":"Berserker",
    #     "level":4,
    #     "first_class":True
    # }

    # bard_class = {
    #     "name":"bard",
    #     "sub_class":None,
    #     "level":1,
    #     "first_class":False
    # }

    # general_data = {
    #     "race":"orc",
    #     "sub_race":None,
    #     "background":"Soldier",
    # }
    

    # classes_data.append(barb_class)
    # classes_data.append(bard_class)
    
    # class_maker.quick_maker(
    #     char_name="Goop",
    #     classes_data=classes_data,
    #     general_data=general_data
    # )

