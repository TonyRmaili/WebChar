import os
import json
import random
import math
from openai import OpenAI
from dotenv import load_dotenv
from collections import Counter

from dice_handler import generate_ability_scores, score_to_mod, generate_remaining_ability_scores
from quick_class_schema import QuickClassSchema
from file_handler import FileHandler

# from app.dice_handler import generate_ability_scores, score_to_mod
# from app.quick_class_schema import QuickClassSchema


class ClassMaker:
    def __init__(self):

        # paths
        self.character_data_path = "character_data/"
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
        self.classes = [
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



    def adjust_ability_score_from_bg(self,score_prio):
        bg_scores = self.char_blueprint["background"]["data"]["ability_scores"]
        score_dist_pool = 3
        for ab in score_prio:
            if score_dist_pool <= 0:
                break
            if ab in bg_scores:
                print(f"{ab} {self.ability_scores[ab]['score']}")
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
            cls_name = cls["name"]
            class_path = self.full_class_data_paths[cls_name]
            core_path = os.path.join(class_path,"core_data")
            core_data = self.file_handler.load_json(core_path)

            cls["core_traits"] = core_data["core_traits"]
            cls["caster_type"] = core_data["caster_type"]
            
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

    def random_class_picks(self,total_level):
        pass

    def run(self):
        # paths
        char_filepath = os.path.join(self.output_test_path,"test_class")
        empty_filepath = os.path.join(self.output_test_path,"empty_class")
        bg_filepath = os.path.join(self.character_data_path,"backgrounds")
        races_filepath = os.path.join(self.character_data_path,"races")
        feats_filepath = os.path.join(self.character_data_path,"feats")


        # data
        char_data = self.file_handler.load_json(filepath=char_filepath)
        backgrounds_data = self.file_handler.load_json(filepath=bg_filepath)
        races_data = self.file_handler.load_json(filepath=races_filepath)
        feats_data = self.file_handler.load_json(filepath=feats_filepath)


        # top level data
        classes = char_data["classes"]
        general = char_data["general"]
        skills = char_data["skills"]
        biography = char_data["biography"]
        inventory = char_data["inventory"]

        ability_scores = char_data["ability_scores"]
        ability_scores = self.format_int_str_scores(ability_scores)


        # nested data
        char_name = general["character_name"]
        background = general["background"]


        # main
        self.handle_background(background,backgrounds_data)
        
        self.handle_class_levels(classes)

        self.add_class_data()

        self.handle_ability_scores(ability_scores)

        save_path = os.path.join(self.output_test_path,char_name)
        self.file_handler.save_json(save_path,self.char_blueprint)
    
if __name__=="__main__":
    class_maker = ClassMaker()
    class_maker.run()
