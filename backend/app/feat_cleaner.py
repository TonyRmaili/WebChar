import os
import json
from open_ai_api import OpenAIApi
from file_handler import FileHandler
from schemas.feats_schema import CleanedFeatLLMData


class FeatCleaner:
    def __init__(self):
        self.file_handler = FileHandler()

        # paths
        self.raw_feats_path = "raw_data/feats"
        self.output_path = "output/feats"
        self.instructions_path = "instructions/feats"

        # constants
        self.removable_keywords = [
            "page",
            "hasFluffImages",
            "reprintedAs",
            "srd52",
            "basicRules2024",
            "repeatableHidden",
            "srd",
            "traitTags",
            "skillToolLanguageProficiencies",
            "additionalSources"

        ]

        self.name_change_keys = {
            "ability": "ability_score_increase",
            "optionalfeatureProgression": "additonal_feature",
            "additionalSpells": "additional_spells"
        }

      

        self.category_rename = {
            "O":"origin",
            "G":"general",
            "FS":"fighting_style",
            "FS:P":"fighting_style",
            "FS:R":"fighting_style",
            "D":"dragon_mark",
            "EB":"epic_boon",  
        }
       
    def load_feats(self,base_path):
        filepath = os.path.join(base_path,"feats")
        data = self.file_handler.load_json(filepath)
        return data
    
    def track_keywords(self,data):
        keywords = []
        for feat in data:
            for key in feat.keys():
                if key not in keywords:
                    keywords.append(key)

        savepath = os.path.join(self.output_path,"keywords")
        self.file_handler.save_json(savepath,keywords)

    def track_values(self,data,key):
        values = []
        for feat in data:
            if key in feat:
                if feat[key] not in values:
                    values.append(feat[key])
            
        print(values)

    def inspect_keys(self,data,key):
        keys = []
        for feat in data:
            if key in feat:
                if isinstance(feat[key],list):
                    for stuff in feat[key]:
                        if isinstance(stuff,dict):
                            for subkey in stuff.keys():
                                if subkey not in keys:
                                    keys.append(subkey)

        print(keys)

    def merge_spellcasting_keys(self,data):
        for feat in data:
            if "prerequisite" in feat:
                for rules in feat["prerequisite"]:
                    for rule in list(rules.keys()):
                        if rule == "spellcastingFeature":
                            del rules["spellcastingFeature"]
                            rules["spellcasting"] = True
                        elif rule == "spellcasting2020":
                            del rules["spellcasting2020"]
                            rules["spellcasting"] = True

    def fix_prerequisite(self, data):
        for feat in data:
            prereqs = feat.get("prerequisite", [])

            for rules in prereqs:

                # spellcasting cleanup
                features = rules.get("feature", [])

                if any(value in ["Spellcasting", "Pact Magic"] for value in features):
                    rules.clear()
                    rules["spellcasting"] = True
                    continue

                # proficiency cleanup
                if "proficiency" in rules:
                    for prof in rules["proficiency"]:
                        if "weaponGroup" in prof:
                            prof["weapon"] = prof.pop("weaponGroup")

                # race cleanup
                if "race" in rules:
                    cleaned_races = []

                    for race in rules["race"]:
                        name = race.get("name")
                        subrace = race.get("subrace")

                        if not name:
                            continue

                        if subrace:
                            cleaned_races.append(f"{name}_{subrace}")
                        else:
                            cleaned_races.append(name)

                    rules["race"] = cleaned_races

    def resolve_versions(self, data):
        for feat in data:
            if "_versions" in feat:
                feat["versions"] = []

                for version in feat["_versions"]:
                    name = version.get("name", "")

                    if ";" in name:
                        result = name.split(";")[-1].strip()
                    else:
                        result = name.strip()

                    feat["versions"].append(result)

                feat.pop("_versions", None)

    def change_keynames(self, data):
        for feat in data:
            for key in list(feat.keys()):
                if key in self.name_change_keys:
                    new_key = self.name_change_keys[key]
                    feat[new_key] = feat.pop(key)
                   
    def rename_categories(self,data):
        for feat in data:
            if "category" in feat:
                feat["category"] = self.category_rename[feat["category"]]

    def remove_keywords(self,data):
        for feat in data:
            for key in list(feat.keys()):
                if key in self.removable_keywords:
                    del feat[key]

    def run_cleaning(self):
        data = self.load_feats(self.raw_feats_path)
        data = data["feat"]

        self.remove_keywords(data)
        self.change_keynames(data)


        self.merge_spellcasting_keys(data)
        self.fix_prerequisite(data)

        self.rename_categories(data)

        self.resolve_versions(data)
        

        savepath = os.path.join(self.output_path,"feats")
        self.file_handler.save_json(savepath,data)


    def run_LLM_cleaning(self,break_counter = 90):
        data = self.load_feats(self.output_path)

        instructions_path = os.path.join(self.instructions_path,"clean_spells_entries.md")
        instructions = self.file_handler.load_md(instructions_path)
        open_ai = OpenAIApi()

        # 265 feats 
        
        counter = 0
        for  feat in data:

            if not "cleaned_data" in feat:

                if counter > break_counter:
                    break

                print(f'processing {feat["name"]} - {feat["source"]}')

                entries = feat.get("entries",[])
                additional_spells = feat.get("additional_spells", None)
            

                if additional_spells:
                    input = [
                        {"role":"user", "content":f"entries: {json.dumps(entries, indent=2)}"},
                        {"role":"user", "content":f"additional spells: {json.dumps(additional_spells, indent=2)}"}
                    ]
                else:
                    input = [
                        {"role":"user", "content":f"entries: {json.dumps(entries, indent=2)}"},
                    ]

                response = open_ai.parse(
                    instructions= instructions,
                    input= input,
                    reasoning="low",
                    text_format=CleanedFeatLLMData
                )

                feat["cleaned_data"] = response

                savepath = os.path.join(self.output_path,"feats")
                self.file_handler.save_json(savepath,data)

                counter += 1


# -------  AFTER LLM CLEANING -----------


    def gather_filter_tags(self,tag,tag_savename):
        loadpath = os.path.join(self.output_path,"feats")
        data = self.file_handler.load_json(loadpath)


        unique_tags = []

        for feat in data:
            if tag in feat:
                if feat[tag] not in unique_tags:
                    unique_tags.append(feat[tag])


        savepath = os.path.join(self.output_path,tag_savename)
        self.file_handler.save_json(savepath, unique_tags)

if __name__ == "__main__":
    cleaner = FeatCleaner()

    # cleaner.run_cleaning()
    # cleaner.run_LLM_cleaning()

    cleaner.gather_filter_tags(
        tag="category",
        tag_savename="categories"
    )

    