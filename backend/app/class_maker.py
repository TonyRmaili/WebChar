import os
import json
import random
import math
from openai import OpenAI
from dotenv import load_dotenv
from collections import Counter

# from dice_handler import generate_ability_scores, score_to_mod, generate_remaining_ability_scores
# from quick_class_schema import QuickClassSchema
# from file_handler import FileHandler

from app.dice_handler import score_to_mod, generate_remaining_ability_scores
from app.quick_class_schema import QuickClassSchema
from app.file_handler import FileHandler

class ClassMaker:
    def __init__(self):
        # paths
        # self.character_data_path = "character_data/"
        self.character_data_path = "./app/character_data/"
        self.classes_data_path = os.path.join(self.character_data_path,"classes_data")
        self.output_test_path = os.path.join(self.character_data_path,"_output_test")
        self.backgrounds_path = os.path.join(self.character_data_path,"backgrounds")
        self.instructions_path = "quick_class_instructions.md"

        # AI config
        load_dotenv(override=True)
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(
            api_key=self.api_key
        )
        self.model = "gpt-5-mini"
        self.reasoning = {"effort" : f""}

        # module inits
        self.schema = QuickClassSchema
        self.file_handler = FileHandler()
        

        # data
        self.char_blueprint = {}


        self.full_class_data_paths = {}
        for name in os.listdir(self.classes_data_path):
            full_path = os.path.join(self.classes_data_path, name)
            if os.path.isdir(full_path):
                self.full_class_data_paths[name] = full_path
                
        

        # constants
        self.score_prio = None

        self.legit_classes = [
            "barbarian",
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

        self.categorized_skills = {
            "str": {
                "Athletics": {"proficient": False, "expertise": False, "check": None}
            },
            "dex": {
                "Acrobatics": {"proficient": False, "expertise": False, "check": None},
                "Sleight of Hand": {"proficient": False, "expertise": False, "check": None},
                "Stealth": {"proficient": False, "expertise": False, "check": None},
            },
            "int": {
                "Arcana": {"proficient": False, "expertise": False, "check": None},
                "History": {"proficient": False, "expertise": False, "check": None},
                "Investigation": {"proficient": False, "expertise": False, "check": None},
                "Nature": {"proficient": False, "expertise": False, "check": None},
                "Religion": {"proficient": False, "expertise": False, "check": None},
            },
            "wis": {
                "Animal Handling": {"proficient": False, "expertise": False, "check": None},
                "Insight": {"proficient": False, "expertise": False, "check": None},
                "Medicine": {"proficient": False, "expertise": False, "check": None},
                "Perception": {"proficient": False, "expertise": False, "check": None},
                "Survival": {"proficient": False, "expertise": False, "check": None},
            },
            "cha": {
                "Deception": {"proficient": False, "expertise": False, "check": None},
                "Intimidation": {"proficient": False, "expertise": False, "check": None},
                "Performance": {"proficient": False, "expertise": False, "check": None},
                "Persuasion": {"proficient": False, "expertise": False, "check": None},
            },
        }

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
            "d6":  {"amount":0, "average":4, "size":6},
            "d8":  {"amount":0, "average":5, "size":8},
            "d10": {"amount":0, "average":6, "size":10},
            "d12": {"amount":0, "average":7, "size":12},
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

        self.feats = {
            "origin":[],
            "general":[],
            "fighting_style":[],
            "epic_boon":[]
        }

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

    def adjust_ability_score_from_bg(self,score_prio):
        bg_scores = self.char_blueprint["background"]["data"]["ability_scores"]
        score_dist_pool = 3
        for ab in score_prio:
            if score_dist_pool <= 0:
                break
            if ab in bg_scores:
                if self.ability_scores[ab]["score"] % 2 == 0:
                    if score_dist_pool >= 2:
                        self.ability_scores[ab]["score"] += 2
                        score_dist_pool -= 2
                    else:
                        self.ability_scores[ab]["score"] += 1
                        score_dist_pool -= 1
                else:
                    self.ability_scores[ab]["score"] += 1
                    score_dist_pool -= 1

    def handle_ability_scores(self,ability_scores):
        grouped_abilities = self.group_primary_abilities()
        remaining_scores = self.count_remaining_ability_scores(ability_scores)
        rolled_ability_scores = generate_remaining_ability_scores(remaining_scores)
        rolled_ability_scores.sort(reverse=True)

        assinged_score_prio = self.assign_score_prio(ability_scores,grouped_abilities)
        
        i = 0
        for ab in assinged_score_prio:
            if ability_scores[ab] is None:
                self.ability_scores[ab]["score"] = rolled_ability_scores[i]
                i += 1
            else:
                self.ability_scores[ab]["score"] = ability_scores[ab]
        
        self.adjust_ability_score_from_bg(assinged_score_prio)
    
        self.char_blueprint["abilities"] = self.ability_scores
        
    def assign_score_prio(self,ability_scores,grouped_abilities):
        score_prio = ability_scores["score_prio"]

        for ab in grouped_abilities:
            if ab[0] not in score_prio:
                score_prio.append(ab[0])
        
        if "con" not in score_prio:
            score_prio.append("con")

        for ab in self.ability_scores.keys():
            if ab not in score_prio:
                score_prio.append(ab)

        self.score_prio = score_prio
        return score_prio
         
    def group_primary_abilities(self):
        primmary_abilities = []
        for cls in self.char_blueprint["classes"]:
            for ability in cls["core_traits"]["primary_abilities"]:
                primmary_abilities.append(ability)
        primmary_abilities = Counter(primmary_abilities).most_common()
        return primmary_abilities
  
    def add_class_data(self):
        for cls in self.char_blueprint["classes"]:
            cls["class_data"] = {}
            cls_name = cls["name"]
            class_path = self.full_class_data_paths[cls_name]
            core_path = os.path.join(class_path,"core_data")
            core_data = self.file_handler.load_json(core_path)

            cls["core_traits"] = core_data["core_traits"]
            cls["caster_type"] = core_data["caster_type"]
            
            for lvl, traits in core_data["levels"].items():
                if int(lvl) <= cls["level"]:
                    if traits:
                        cls["class_data"][lvl] = []
                        for trait in traits:
                            if trait["name"] != "Subclass Feature":
                                trait["feature_type"] = "core"
                                cls["class_data"][lvl].append(trait)

    def handle_class_levels(self,classes_data):
        total_level = 0
        missing_class_levels = []

        # check for assigned levels
        for cls in classes_data:
            if cls["level"]:
                total_level += cls["level"]
            else:
                missing_class_levels.append(cls["name"])

        # early exit
        if not missing_class_levels:
            self.char_blueprint["classes"] = classes_data
            return None

        remaining_levels = 20 - total_level - len(missing_class_levels)
        
        # distribute 1 level to null classes
        for cls in classes_data:
            if not cls["level"]:
                cls["level"] = 1

        self.char_blueprint["classes"] = classes_data
        

        # not enough levels remaining
        if remaining_levels <= 0:
            return None

        # determine extra levels to distribute
        center = remaining_levels//2 
        extra_levels = self.randomize_total_level(min_val=0,max_val=remaining_levels,center=center)

        # distribute extra levels
        while extra_levels > 0:
            class_index = random.randint(0,len(missing_class_levels)-1)  
            class_name = missing_class_levels[class_index]
            
            for cls in self.char_blueprint["classes"]:
                if cls["name"] == class_name:
                    cls["level"] +=1
            extra_levels -= 1

        
        return None

    def handle_background(self,background,backgrounds_data):
        if not background:
            bg_name, bg_data = random.choice(list(backgrounds_data.items()))
            
        else:
            bg_name = background
            bg_data = backgrounds_data[background]

        self.char_blueprint["background"] = {"name":bg_name,"data":bg_data}

    def count_remaining_ability_scores(self,ability_scores) -> int:
        count = 0
        for key,value in ability_scores.items():
            if key == "score_prio":
                continue
            if value:
                count +=1  

        remaining_scores = 6 - count              
        return remaining_scores
    
    def format_int_str_scores(self,ability_scores) -> dict:
        ability_scores["int"] = ability_scores.pop("inte")
        ability_scores["str"] = ability_scores.pop("stre")
        return ability_scores

    def randomize_total_level(self,min_val=1, max_val=20, center=6, spread=3):
        ''' Bell curve algorithm '''
        while True:
            value = int(random.gauss(center, spread))
            if min_val <= value <= max_val:
                return value

    def random_class_picks(self):
        classes = []
        legit_classes = self.legit_classes.copy() 
        multiclass_coeff = 4
        count = 1
        first_class = True
        remaining_levels = 20
        total_levels = 0
        center = 8

        while True:
            if remaining_levels <= 0:
                break
            if count > 1:
                first_class = False
                multiclass_int = random.randint(1,multiclass_coeff)
                if multiclass_int != multiclass_coeff:
                    break
            
            level = self.randomize_total_level(
                min_val=1,
                max_val= remaining_levels,
                center=center,
                spread=3
            )
            

            if level > remaining_levels:
                level = remaining_levels

            class_index = random.randint(0,len(legit_classes)-1)
            
            class_name = legit_classes.pop(class_index)

            class_data = {
            "name": class_name,
            "sub_class": None,
            "level": level,
            "first_class": first_class 
            }

            classes.append(class_data)


            total_levels += level
            count +=1
            center -= 2
            remaining_levels -= level

            if center < 1:
                center = 1

        return classes

    def handle_subclasses(self):
        for cls in self.char_blueprint["classes"]:
            cls_name = cls["name"]
            cls_level = cls["level"]
            subcls_name = cls["sub_class"]
            subclasses_path = os.path.join(self.classes_data_path,cls_name,"sub_classes")
            
            if cls_level >= 3:
                
                # randomize subclass if it's missing
                if not subcls_name:
                    subclasses = os.listdir(subclasses_path)
                    subclass_index = random.randint(0,len(subclasses)-1)
                    subclass = subclasses[subclass_index]
                    subclass_name, ext = os.path.splitext(subclass)
                    subclass_path = os.path.join(subclasses_path,subclass_name)
                    subclass_data = self.file_handler.load_json(subclass_path)
                    cls["sub_class"] = subclass_data["name"]
                
                subclass_name, ext = os.path.splitext(subclass)
                subclass_path = os.path.join(subclasses_path,subclass_name)
                subclass_data = self.file_handler.load_json(subclass_path)

                for lvl , traits in subclass_data["levels"].items():
                    if int(lvl) <= cls_level:
                        for trait in traits:
                            trait["feature_type"] = "sub_class"
                            cls["class_data"][lvl].append(trait)
                        
    def handle_race(self,races_data,race_name,subrace_name):  
        if not race_name:
            race_name, race_data = random.choice(list(races_data.items()))
        
        else:
            race_data = races_data[race_name]

        clean_data = {}
        resistances = []

        clean_data["name"] = race_name
        clean_data["traits"] = race_data["effects"]

        size = random.choice(race_data["sizes"])
        clean_data["size"] = size
        clean_data["movements"] = race_data["speed"]
        clean_data["creature_type"] = race_data["creature_type"]

        clean_data["senses"] = race_data["senses"]

        if race_data["resistances"]:
            for res in race_data["resistances"]:
                if res not in resistances:
                    resistances.append(res)

        if not subrace_name:
            if race_data["sub_races"]:
                subrace_name = random.choice(race_data["sub_races"])["name"]
        
        if subrace_name:
            for subrace in race_data["sub_races"]:
                if subrace_name == subrace["name"]:
                    clean_data["subrace"] = subrace
        else:
            clean_data["subrace"] = None

        try:
            if clean_data["subrace"]:
                if clean_data["subrace"]["resistances"]:
                    for res in clean_data["subrace"]["resistances"]:
                        if res not in resistances:
                            resistances.append(res)
        except KeyError:
            pass

        self.char_blueprint["resistances"] = resistances

        self.char_blueprint["race"] = clean_data

    def handle_feats(self,feats_data,selected_feats):
        feats_count = {
            "origin":1,  
            "general":0,
            "epic_boon":0,
        }
        self.char_blueprint["feats"] = []

        # count max feats for character
        for race_effect in self.char_blueprint["race"]["traits"]:
            if race_effect["name"] == "Versatile":
                feats_count["origin"] += 1


        if self.char_blueprint["background"]["data"]["feat"]:
            if self.char_blueprint["background"]["data"]["feat"] not in selected_feats:
                selected_feats.append(self.char_blueprint["background"]["data"]["feat"])
                

        for cls in self.char_blueprint["classes"]:
            for data in cls["class_data"].values():
                try:
                    for effect in data:
                        if effect["name"] == "Ability Score Improvement":
                            feats_count["general"] += 1
                        elif effect["name"] == "Epic Boon":
                            feats_count["epic_boon"] += 1
                except TypeError:
                    pass

        # add feats from raw
        if selected_feats:
            for feat_name in selected_feats:
                if feat_name in feats_data:
                    feats_data[feat_name]["name"] = feat_name
                    self.char_blueprint["feats"].append(feats_data[feat_name])
                    feats_count[feats_data[feat_name]["category"]] -= 1

        # add remaining feats (change this later for safer eligable listed feats with no while loop)
        for category,count in feats_count.items():
            max_retries = 5
            while count > 0 and max_retries >=0:
                name, data = random.choice(list(feats_data.items()))
                if name not in selected_feats and category == data["category"]:
                    data["name"] = name
                    self.char_blueprint["feats"].append(data)
                    selected_feats.append(name)
                    count -= 1
                max_retries -= 1

    def add_asi_from_feats(self):     
        for feat in self.char_blueprint["feats"]:
            score_dist = 2
            if feat["ability_score_increase"]:
                if feat["ability_score_increase"] == "any":
                    for score in self.score_prio:
                        if score_dist <= 0:
                            break
                        if self.char_blueprint["abilities"][score]["score"] % 2 == 0:
                            if score_dist >= 2:
                                self.char_blueprint["abilities"][score]["score"] += 2
                                score_dist -= 2
                            else:
                                self.char_blueprint["abilities"][score]["score"] += 1
                                score_dist -= 1
                        else:
                            self.char_blueprint["abilities"][score]["score"] += 1
                            score_dist -= 1
                
                else:
                    for score in self.score_prio:
                        if score_dist <= 0:
                            break
                        if score in feat["ability_score_increase"]:
                            if len(feat["ability_score_increase"]) == 1:
                                self.char_blueprint["abilities"][score]["score"] += 2
                                break
                            elif self.char_blueprint["abilities"][score]["score"] % 2 == 0:
                                if score_dist >= 2:
                                    self.char_blueprint["abilities"][score]["score"] += 2
                                    score_dist -= 2
                                else:
                                    self.char_blueprint["abilities"][score]["score"] += 1
                                    score_dist -= 1
                            else:
                                self.char_blueprint["abilities"][score]["score"] += 1
                                score_dist -= 1

    def handle_tool_prof(self):
        pass

    def handle_armor_prof(self):
        pass

    def handle_weapon_prof(self):
        pass

    def handle_saving_throw_prof(self):
        first_class = None
        for cls in self.char_blueprint["classes"]:
            if cls["first_class"]:
                first_class = cls
                break

        saving_throws = first_class["core_traits"]["saving_throw_proficiencies"]

        for ab in saving_throws:
            self.char_blueprint["abilities"][ab]["proficient"] = True

    def handle_pb(self):
        "calc total level"
        total_level = 0
        for cls in self.char_blueprint["classes"]:
            total_level += cls["level"]

        if total_level > 20:
            pb = 6
        pb = self.pb_table[str(total_level)]

        self.char_blueprint["total_level"] = total_level
        self.char_blueprint["pb"] = pb

    def handle_skill_prof(self,selected_skills):
        available_skills = []
        bg_skills = self.char_blueprint["background"]["data"]["skill_proficiencies"]
    
        # races later

        # first class
        first_cls_data = None
        for cls in self.char_blueprint["classes"]:
            if cls["first_class"]:
                first_cls_data = cls
                break

        cls_skills = first_cls_data["core_traits"]["skill_proficiencies"]
        
        for skill in bg_skills:
            if skill not in selected_skills:
                selected_skills.append(skill)
        
        for skill in self.skills:
            if skill not in selected_skills:
                available_skills.append(skill)
        
        for i in range(cls_skills["amount"]):
            if len(available_skills) >= 1:
                skill_index = random.randint(0,len(available_skills)-1)
                skill = available_skills.pop(skill_index)
                selected_skills.append(skill)

        self.char_blueprint["skill_proficiencies"] = selected_skills

    def handle_hit_dice(self):
        for cls in self.char_blueprint["classes"]:
            hit_die = cls["core_traits"]["hit_die"]
            level = cls["level"]
            self.hit_dice[hit_die]["amount"] += level

        self.char_blueprint["hit_dice"] = self.hit_dice

    def calc_ability_score_data(self):
        for ab,data in self.char_blueprint["abilities"].items():
            mod = score_to_mod(data["score"])
            data["mod"] = mod
            data["check"] = mod
            if data["proficient"]:
                data["save"] = mod + self.char_blueprint["pb"]
            else:
                data["save"] = mod 

    def calc_skill_prof_data(self):
        for ab, skills in self.categorized_skills.items():
            mod = self.char_blueprint["abilities"][ab]["mod"]
            for name, data in skills.items():
                if name in self.char_blueprint["skill_proficiencies"]:
                    data["check"] = mod + self.char_blueprint["pb"]
                    data["proficient"] = True
                else:
                    data["check"] = mod 

        self.char_blueprint["skills"] = self.categorized_skills
        print(self.char_blueprint["skill_proficiencies"])
        del self.char_blueprint["skill_proficiencies"]

    def handle_max_hp(self):
        hp_mod = 0
        max_hp = 0
        first_class_die = None
        # adjust hp mod for Tough feat
        for feat in self.char_blueprint["feats"]:
            if feat["name"] == "Tough":
                hp_mod += 2
        
        hp_mod += self.char_blueprint["abilities"]["con"]["mod"]

        for die,data in self.char_blueprint["hit_dice"].items():
            if data["amount"] > 0:
                max_hp += (data["average"] + hp_mod) * data["amount"]


        # adjust for first_class bonus
        for cls in self.char_blueprint["classes"]:
            if cls["first_class"]:
                first_class_die = cls["core_traits"]["hit_die"]
                break

        hp_diff = self.hit_dice[first_class_die]["size"] - self.hit_dice[first_class_die]["average"]
        max_hp += hp_diff

        self.char_blueprint["max_hp"] = max_hp

    def clean_class_data(self):
        "removes Ability Score Improvement trait from class data"

        for cls in self.char_blueprint["classes"]:
            new_class_data = {}

            for lvl, traits in cls["class_data"].items():
                filtered = [
                    trait for trait in traits
                    if trait["name"] != "Ability Score Improvement"
                ]

                if filtered:  # only keep non-empty
                    new_class_data[lvl] = filtered

            cls["class_data"] = new_class_data

    def load_empty_class_data(self):
        empty_filepath = os.path.join(self.output_test_path,"empty_class")
        char_data = self.file_handler.load_json(filepath=empty_filepath)
        return char_data

    def run(self,char_data):
        # paths
        char_filepath = os.path.join(self.output_test_path,"test_class")
        bg_filepath = os.path.join(self.character_data_path,"backgrounds")
        races_filepath = os.path.join(self.character_data_path,"races")
        feats_filepath = os.path.join(self.character_data_path,"feats")

        # data
        # char_data = self.file_handler.load_json(filepath=empty_filepath)
        backgrounds_data = self.file_handler.load_json(filepath=bg_filepath)
        races_data = self.file_handler.load_json(filepath=races_filepath)
        feats_data = self.file_handler.load_json(filepath=feats_filepath)

        # top level data
        classes = char_data["classes"]
        general = char_data["general"]
        skills = char_data["skills"]
        biography = char_data["biography"]
        inventory = char_data["inventory"]
        feats = char_data["feats"]

        ability_scores = char_data["ability_scores"]
        ability_scores = self.format_int_str_scores(ability_scores)


        # nested data
        char_name = general["character_name"]
        background = general["background"]
        race = general["race"]
        subrace = general["subrace"]
        max_hp = general["max_hp"]


        # main
        if not classes or not classes[0]["name"]:
            classes = self.random_class_picks()
            
        if not char_name:
            char_name = "Empty Voidborn"

        self.handle_background(background,backgrounds_data)
        
        self.handle_class_levels(classes)

        self.add_class_data()

        self.handle_ability_scores(ability_scores)

        self.handle_subclasses()

        self.handle_race(races_data,race,subrace)
        
        self.handle_feats(feats_data,feats)

        self.add_asi_from_feats()

        self.handle_pb()

        self.handle_saving_throw_prof()

        self.calc_ability_score_data()

        self.handle_skill_prof(skills)

        self.calc_skill_prof_data()

        self.handle_hit_dice()

        self.clean_class_data()

        if not max_hp:
            self.handle_max_hp()
        else:
            self.char_blueprint["max_hp"] = max_hp

        self.char_blueprint["char_name"] = char_name
        save_path = os.path.join(self.output_test_path,char_name)
        self.file_handler.save_json(save_path,self.char_blueprint)
        return self.char_blueprint
    
if __name__=="__main__":
    class_maker = ClassMaker()
    class_maker.run()
