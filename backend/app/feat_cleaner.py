import os
import json
from open_ai_api import OpenAIApi
from file_handler import FileHandler

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
            "optionalfeatureProgression": "additonal_feature"
        }

        self.troublesome_keywords = [
            "optionalfeatureProgression",
            "_versions"
        ]

        
    
    def load_feats(self):
        filepath = os.path.join(self.raw_feats_path,"feats")
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

    def fix_feature_prerequisite(self, data):
        for feat in data:
            prereqs = feat.get("prerequisite", [])

            for rules in prereqs:
                features = rules.get("feature", [])

                if any(value in ["Spellcasting", "Pact Magic"] for value in features):
                    rules.clear()
                    rules["spellcasting"] = True


    def change_keynames(self, data):
        for feat in data:
            for key in list(feat.keys()):
                if key in self.name_change_keys:
                    new_key = self.name_change_keys[key]
                    feat[new_key] = feat.pop(key)
                    


    def remove_keywords(self,data):
        for feat in data:
            for key in list(feat.keys()):
                if key in self.removable_keywords:
                    del feat[key]

    def run_cleaning(self):
        data = self.load_feats()
        data = data["feat"]

        self.remove_keywords(data)
        self.change_keynames(data)


        self.merge_spellcasting_keys(data)
        self.fix_feature_prerequisite(data)


        

        savepath = os.path.join(self.output_path,"feats")
        self.file_handler.save_json(savepath,data)



if __name__ == "__main__":
    cleaner = FeatCleaner()

    cleaner.run_cleaning()

    