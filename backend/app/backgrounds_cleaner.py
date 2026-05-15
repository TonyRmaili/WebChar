import os
import json
from open_ai_api import OpenAIApi
from file_handler import FileHandler
from pydantic import BaseModel


class EntriesData(BaseModel):
    entries: str


class BackgroundCleaner:
    def __init__(self):
        self.file_handler = FileHandler()

        # paths
        self.raw_bg_path = "raw_data/backgrounds"
        self.output_path = "output/backgrounds"
        self.instructions_path = "instructions/backgrounds"

        self.removable_keywords = [
            "page",
             "hasFluff",
            "hasFluffImages",
            "srd",
            "basicRules",
            "reprintedAs",
            "srd52",
            "basicRules2024",
            "fromFeature",
            "additionalSources",
            "otherSources"

        ]

        self.renameable_keywords = {
            "skillProficiencies": "skill_proficiencies",
            "toolProficiencies": "tool_proficiencies",
            "startingEquipment":"starting_equipment",
            "languageProficiencies":"language_proficiencies",
            "_copy":"copy",
            "additionalSpells":"additional_spells",
        }

        self.skills = [
            "acrobatics",
            "animal handling",
            "arcana",
            "athletics",
            "deception",
            "history",
            "insight",
            "investigation",
            "intimidation",
            "medicine",
            "nature",
            "perception",
            "performance",
            "religion",
            "persuasion",
            "sleight of hand",
            "stealth",
            "survival",
        ]


    def track_toplevel_keywords(self,data):
        keywords = []
        for bg in data:
            for key in bg.keys():
                if key not in keywords:
                    keywords.append(key)

        savepath = os.path.join(self.raw_bg_path,"keywords")
        self.file_handler.save_json(savepath,keywords)
    
    def inspect_object(self,data,obj):
        keys = []
        for bg in data:
            if obj in bg:
                for pack in bg[obj]:
                    for key in pack.keys():
                        if key not in keys:
                            keys.append(key)

        print(keys)



    def remove_keywords(self,data):
        for bg in data:
            for key in list(bg.keys()):
                if key in self.removable_keywords:
                    del bg[key]

    def rename_keywords(self,data):
        for bg in data:
            for key in list(bg.keys()):
                if key in self.renameable_keywords:
                    new_key = self.renameable_keywords[key]
                    bg[new_key] = bg.pop(key)
                   
    def flatten_ability_score_increase(self,data):
        for bg in data:
            abilities = bg.get("ability",None)

            if abilities:
                abilities = abilities[0]["choose"]["weighted"]["from"]
                bg["ability_score_increase"] = abilities
                bg.pop("ability")

    def flatten_feats(self, data):
        for bg in data:
            raw_feats = bg.get("feats", None)

            flattened_feats = []

            if raw_feats:
                for feat_group in raw_feats:
                    for feat_name in feat_group.keys():
                        clean_name = feat_name.split("|")[0].strip().lower()
                        flattened_feats.append(clean_name)

                bg["feats"] = flattened_feats

    def flatten_skill_proficiencies(self, data):
        for bg in data:
            if "skill_proficiencies" not in bg:
                continue

            result = {
                "fixed": [],
                "choose": None
            }

            for prof_block in bg["skill_proficiencies"]:
                for key, value in prof_block.items():

                    # fixed skill
                    if value is True:
                        result["fixed"].append(key.lower())

                    # any:X  -> choose from all skills
                    elif key == "any":
                        result["choose"] = {
                            "from": self.skills,
                            "count": value
                        }

                    # existing choose structure
                    elif key == "choose":
                        choose_from = [
                            skill.lower()
                            for skill in value.get("from", [])
                        ]

                        result["choose"] = {
                            "from": choose_from,
                            "count": value.get("count", 1)
                        }

            bg["skill_proficiencies"] = result

    def flatten_tool_proficiencies(self, data):
        ANY_TOOL_GROUPS = {
            "anyArtisansTool": "artisan's tools",
            "anyGamingSet": "gaming set",
            "anyMusicalInstrument": "musical instrument",
        }

        for bg in data:

            if "tool_proficiencies" not in bg:
                continue

            result = {
                "fixed": [],
                "choose": None
            }

            for prof_block in bg["tool_proficiencies"]:

                for key, value in prof_block.items():

                    clean_key = ANY_TOOL_GROUPS.get(key, key).lower()

                    # fixed tool proficiency
                    if value is True:
                        result["fixed"].append(clean_key)

                    # any grouped tool choice, e.g. anyGamingSet: 1
                    elif key in ANY_TOOL_GROUPS:
                        result["choose"] = {
                            "from": [ANY_TOOL_GROUPS[key]],
                            "count": value
                        }

                    # existing choose structure
                    elif key == "choose":
                        choose_from = [
                            ANY_TOOL_GROUPS.get(tool, tool).lower()
                            for tool in value.get("from", [])
                        ]

                        result["choose"] = {
                            "from": choose_from,
                            "count": value.get("count", 1)
                        }

            bg["tool_proficiencies"] = result                 

    def flatten_language_proficiencies(self, data):
        ANY_LANGUAGE_GROUPS = {
            "anyStandard": "standard"
        }

        for bg in data:

            if "language_proficiencies" not in bg:
                continue

            result = {
                "fixed": [],
                "choose": None
            }

            for prof_block in bg["language_proficiencies"]:

                for key, value in prof_block.items():

                    clean_key = ANY_LANGUAGE_GROUPS.get(key, key).lower()

                    # fixed language proficiency
                    if value is True:
                        result["fixed"].append(clean_key)

                    # any standard language choice, e.g. anyStandard: 2
                    elif key in ANY_LANGUAGE_GROUPS:
                        result["choose"] = {
                            "from": [ANY_LANGUAGE_GROUPS[key]],
                            "count": value
                        }

                    # existing choose structure
                    elif key == "choose":
                        choose_from = [
                            ANY_LANGUAGE_GROUPS.get(lang, lang).lower()
                            for lang in value.get("from", [])
                        ]

                        result["choose"] = {
                            "from": choose_from,
                            "count": value.get("count", 1)
                        }

            bg["language_proficiencies"] = result


    def run_cleaning(self):
        loadpath = os.path.join(self.raw_bg_path,"backgrounds")
        data = self.file_handler.load_json(loadpath)

        data = data["background"]
        
        self.remove_keywords(data)
        self.rename_keywords(data)

        self.flatten_ability_score_increase(data)
        self.flatten_feats(data)
        self.flatten_skill_proficiencies(data)
        self.flatten_tool_proficiencies(data)
        self.flatten_language_proficiencies(data)

        # remove the copy bg
        data[:] = [bg for bg in data if "copy" not in bg]

        savepath = os.path.join(self.output_path,"backgrounds")
        self.file_handler.save_json(savepath,data)

    def run_LLM_cleaning(self):
        loadpath = os.path.join(self.output_path,"backgrounds")
        data = self.file_handler.load_json(loadpath)
        
        instructions_path = os.path.join(self.instructions_path,"clean_entries.md")
        instructions = self.file_handler.load_md(instructions_path)

        open_ai = OpenAIApi()

        # 131 bgs

        for i, bg in enumerate(data):
            if not "cleaned_entries" in bg:
                
                print(f"{bg["name"]} {i+1}/{len(data)}")
                entries = bg.get("entries", [])

                input = [
                        {"role":"user", "content":f"entries: {json.dumps(entries, indent=2)}"},
                    ]

                response = open_ai.parse(
                    instructions= instructions,
                    input= input,
                    reasoning="low",
                    text_format=EntriesData
                )

                bg["cleaned_entries"] = response

                savepath = os.path.join(self.output_path,"backgrounds")
                self.file_handler.save_json(savepath,data)



if __name__ == "__main__":
    cleaner = BackgroundCleaner()

    # cleaner.run_cleaning()

    cleaner.run_LLM_cleaning()