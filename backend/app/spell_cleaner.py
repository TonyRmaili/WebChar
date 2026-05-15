import os
import json
from open_ai_api import OpenAIApi
from file_handler import FileHandler
from schemas.spells_schema import SpellCleaned


class SpellCleaner:
    def __init__(self):
        self.file_handler = FileHandler()

        # paths
        self.raw_path = "raw_data/spells"
        self.output_path = "output/spells"
        self.instructions_path = "instructions/spells"


        self.removable_keywords = [
            "page",
            "referenceSources",
            "miscTags",
            "hasFluffImages",
            "otherSources",
            "reprintedAs",
            "srd",
            "basicRules",
            "alias",
            "hasFluff",
            "additionalSources",
            "srd52",
            "basicRules2024",
        ]


        self.school_rename = {
            "C": "conjuration",
            "T": "transmutation",
            "I": "illusion",
            "E": "enchantment",
            "V": "evocation",
            "A": "abjuration",
            "N": "necromancy",
            "D": "divination"
        }

        self.area_tags_rename = {
            "ST": "single_target",
            "MT": "multiple_targets",
            "S": "sphere",
            "L": "line",
            "N": "cone",
            "C": "cube",
            "Y": "cylinder",
            "W": "wall",
            "R": "radius",
            "Q": "square",
            "H": "hemisphere",
        }

        self.spell_attack_rename = {
            "R": "ranged",
            "M": "melee"
        }

    def list_toplevel_keywords(self,data):
        keywords = []
        for spell in data:
            for key in spell.keys():
                if key not in keywords:
                    keywords.append(key)

        savepath = os.path.join(self.output_path,"keywords")
        self.file_handler.save_json(savepath,keywords)

    def list_nested_data(self,data,name):
        names = []
        for spell in data:
            if name in spell:
                for value in spell[name]:
                    if value not in names:
                        names.append(value)

        print(names)

    def gather_spell_sources(self):
        spells = []

        for file in os.listdir(self.raw_path):
            if file != "sources.json":
                name, ext = os.path.splitext(file)
                path = os.path.join(self.raw_path,name)

                data = self.file_handler.load_json(path)
                data = data["spell"]

                for spell in data:
                    spells.append(spell)

        return spells

    def remove_keywords(self,data):
        for spell in data:
            for key in list(spell.keys()):
                if key in self.removable_keywords:
                    del spell[key]

    def rename_schools(self,data):
        for spell in data:
            if "school" in spell:
                new_name = self.school_rename[spell["school"]]
                spell["school"] = new_name 

    def rename_area_tags(self,data):
        for spell in data:
            if "areaTags" in spell:
                spell["area_tags"] = []
                for tag in spell["areaTags"]:
                    new_tag = self.area_tags_rename[tag]
                    spell["area_tags"].append(new_tag)

                spell.pop("areaTags")

    def rename_spell_attack(self,data):
        for spell in data:
            if "spellAttack" in spell:
                spell["spell_attack"] = []
                for tag in spell["spellAttack"]:
                    new_tag = self.spell_attack_rename[tag]
                    spell["spell_attack"].append(new_tag)

                spell.pop("spellAttack")

    def flatten_meta(self,data):
        for spell in data:
            if "meta" in spell:
                for key,value in spell["meta"].items():
                    spell[key] = value

                spell.pop("meta")

    def gather_filter_tags(self,data,tag,tag_savename):
        unique_tags = []

        for spell in data:
            if tag in spell:
                if spell[tag] not in unique_tags:
                    unique_tags.append(spell[tag])


        savepath = os.path.join(self.output_path,tag_savename)
        self.file_handler.save_json(savepath, unique_tags)

    # 936 spells
    def run_cleaning(self):
        data = self.gather_spell_sources()

        self.remove_keywords(data)
        self.rename_schools(data)
        self.rename_area_tags(data)
        self.rename_spell_attack(data)

        self.flatten_meta(data)

        self.gather_filter_tags(data,"source","sources")
        self.gather_filter_tags(data,"school","schools")

        savepath = os.path.join(self.output_path,"spells")
        self.file_handler.save_json(savepath, data)
        

    def run_LLM_cleaning(self,break_counter = 25):
        # Timed out
        # Banishing Smite

        data_path = os.path.join(self.output_path,"spells")
        data = self.file_handler.load_json(data_path)

        instructions_path = os.path.join(self.instructions_path,"clean_entries.md")
        instructions = self.file_handler.load_md(instructions_path)

        open_ai = OpenAIApi()

        counter = 0
        for spell in data:

            if  counter > break_counter:
                break

            if "cleaned_data" in spell:
                continue

            print(f'cleaning {spell["name"]} {counter+1}/{len(data)}')

            entries = spell.get("entries",None)
            higher_levels = spell.get("entriesHigherLevel", None)

            if higher_levels:
                input = [
                    {"role":"user", "content":f"entries: {json.dumps(entries, indent=2)}"},
                    {"role":"user", "content":f"entriesHigherLevel: {json.dumps(higher_levels, indent=2)}"}
                ]
            else:
                input = [
                    {"role":"user", "content":f"entries: {json.dumps(entries, indent=2)}"},
                ]

            try:
                response = open_ai.parse(
                    instructions= instructions,
                    input= input,
                    reasoning="low",
                    text_format=SpellCleaned,
                    timeout=120.0
                )

                spell["cleaned_data"] = response

                self.file_handler.save_json(data_path,data)

                counter +=1

            except Exception as e:
                print(f"Failed on {spell['name']}: {e}")
                continue



if __name__ == "__main__":
    cleaner = SpellCleaner()

    # cleaner.run_cleaning()
    cleaner.run_LLM_cleaning()