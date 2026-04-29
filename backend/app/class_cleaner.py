import os
from file_handler import FileHandler
from open_ai_api import OpenAIApi
from schemas.classes_schema import CleanedFeature
import re
import json

class ClassCleaner:
    def __init__(self):
        
        self.file_handler = FileHandler()

        # paths
        self.raw_classes_path = "raw_data/classes"
        self.output_path = "output/classes"
        self.instructions_path = "instructions/classes"

        self.rename_files()
       
        self.class_paths = {}
        for file in os.listdir(self.raw_classes_path):
            name, ext = os.path.splitext(file)
            self.class_paths[name] = os.path.join(self.raw_classes_path,name)
        
        # constants
        self._TAG_PATTERN = re.compile(r"\{@\w+\s+([^|}]+)(?:\|[^}]*)?\}")

        self.removable_toplevel_keywords = [
            "page",
            "srd",
            "basicRules",
            "reprintedAs",
            "hasFluff",
            "hasFluffImages",
            "subclassTitle",
            "srd52",
            "basicRules2024",
            "classFeatures",
            "subclassFeatures",
            "otherSources",
            "featProgression"
        ]

        self.removable_nested_keywords = [
            "source",
            "className",
            "classSource",
            "shortName",
            "edition",
            "subclassShortName",
            "subclassSource",
            "header"
        ]
        
        self.removable_progression_keys = [
            "cantripProgression",
            "spellsKnownProgression",
            "spellsKnownProgressionFixedByLevel",
            "preparedSpellsProgression"  
        ]

        self.renamable_keywords = {
            "hd":"hit_dice",
            "proficiency":"saving_throw_proficiency",
        }

        
    def _strip_markup(self, text):
        """Convert '{@filter Cantrips|spells|level=0}' -> 'Cantrips'."""
        if not isinstance(text, str):
            return text
        return self._TAG_PATTERN.sub(r"\1", text).strip()

    def _label_to_key(self, label):
        """Turn a column label like 'Cantrips Known' into 'cantrips_known'."""
        cleaned = self._strip_markup(label)
        return re.sub(r"\W+", "_", cleaned).strip("_").lower()

    def _assemble_progression(self, spell_slot_rows, extras_columns, features_by_level):
        progression = []
        for level in range(1, 21):
            idx = level - 1
            progression.append({
                "level": level,
                "proficiency_bonus": 2 + (level - 1) // 4,
                "feature_names": features_by_level.get(level, []),
                "spell_slots": (
                    spell_slot_rows[idx]
                    if spell_slot_rows and idx < len(spell_slot_rows)
                    else None
                ),
                "extras": {
                    key: (values[idx] if idx < len(values) else None)
                    for key, values in extras_columns
                },
            })
        return progression

    def _clean_cell(self, value):
        """Strip 5etools markup from string cell values; leave other types alone."""
        if isinstance(value, str):
            return self._strip_markup(value)
        return value

    def _extract_table_groups(self, table_groups):
        """Pull spell slot rows and 'extras' columns out of a table_groups array."""
        spell_slot_rows = None
        extras_columns = []
        for group in table_groups or []:
            if "rowsSpellProgression" in group:
                spell_slot_rows = group["rowsSpellProgression"]
            elif "rows" in group:
                labels = group.get("colLabels", [])
                rows = group.get("rows", [])
                for col_index, label in enumerate(labels):
                    key = self._label_to_key(label)
                    values = [
                        self._clean_cell(row[col_index]) if col_index < len(row) else None
                        for row in rows
                    ]
                    extras_columns.append((key, values))
        return spell_slot_rows, extras_columns

    def build_level_progression(self, class_obj, class_features):
        spell_slot_rows, extras_columns = self._extract_table_groups(
            class_obj.get("classTableGroups", [])
        )

        features_by_level = {}
        for feat in class_features:
            lvl = feat.get("level")
            if lvl is None:
                continue
            features_by_level.setdefault(lvl, []).append(feat["name"])

        class_obj["level_progression"] = self._assemble_progression(
            spell_slot_rows, extras_columns, features_by_level
        )

        class_obj.pop("classTableGroups", None)
        self._drop_progression_keys(class_obj)

    def build_subclass_progression(self, subclass):
        table_groups = subclass.get("subclassTableGroups") or subclass.get("classTableGroups")
        if not table_groups:
            return

        spell_slot_rows, extras_columns = self._extract_table_groups(table_groups)

        features_by_level = {}
        for feat in subclass.get("features", []):
            lvl = feat.get("level")
            if lvl is None:
                continue
            features_by_level.setdefault(lvl, []).append(feat["name"])

        subclass["level_progression"] = self._assemble_progression(
            spell_slot_rows, extras_columns, features_by_level
        )

        subclass.pop("subclassTableGroups", None)
        subclass.pop("classTableGroups", None)
        self._drop_progression_keys(subclass)


    def _drop_progression_keys(self, obj):
        for key in self.removable_progression_keys:
            obj.pop(key, None)

    def rename_files(self, prefix = "class-"):
        for filename in os.listdir(self.raw_classes_path):
            if filename.startswith(prefix):
                old_path = os.path.join(self.raw_classes_path, filename)
                new_path = os.path.join(self.raw_classes_path, filename[len(prefix):])
                os.rename(old_path, new_path)

    def remove_toplevel_key(self,keyname,class_data):
        try:
            del class_data[keyname]
        except KeyError:
            pass

        return class_data

    def remove_keywords(self,data,toplevel=True):
        if toplevel:
            removable_keys = self.removable_toplevel_keywords
        else:
            removable_keys = self.removable_nested_keywords

        for entry in data:
            for key in list(entry.keys()):
                if key in removable_keys:
                    del entry[key]

    def rename_keywords(self, data):
        for key in list(data.keys()):
            if key in self.renamable_keywords:
                data[self.renamable_keywords[key]] = data[key]
                del data[key]

    def adjust_hitdice(self,data):
        die = "d"+str(data["hit_dice"]["faces"])
        data["hit_dice"] = die

    def track_keywords(self,full_data):
        keywords = {}
        for edition, values in full_data.items():
            keywords[edition] = []
            class_data = values["class"]
            subclass_data = values["subclasses"]
            class_features_data = values["class_features"]

            for key in class_data.keys():
                if key not in keywords[edition]:
                    keywords[edition].append(key)

        save_path = os.path.join(self.output_path,class_data["name"]+"_keywords")
        self.file_handler.save_json(save_path,keywords)

    def pair_data(self,class_data,subclass_data,class_feature,subclass_feature):
        top_object = {}
        for cls in class_data:
            cls_edition = cls["edition"]
            cls_source = cls["source"]

            top_object[cls_edition] = {
                "class":cls,
                "subclasses":[],
                "class_features":[],
                "subclass_features":[]
                }
            
            for subcls in subclass_data:
                if subcls["classSource"] == cls_source:
                    if "_copy" not in subcls:
                        top_object[cls_edition]["subclasses"].append(subcls)
                
                
            for cls_feat in class_feature:
                if cls_feat["classSource"] == cls_source:
                    if "_copy" not in cls_feat:
                        top_object[cls_edition]["class_features"].append(cls_feat)
            
            for subcls_feat in subclass_feature:
                if subcls_feat["classSource"] == cls_source:
                    if "_copy" not in subcls_feat:
                        top_object[cls_edition]["subclass_features"].append(subcls_feat)
            
       
        return top_object
        
    def pair_subclasses(self,data):
        for subclass in data["subclasses"]:
            subclass["features"] = []
            subclass_name = subclass["shortName"]

            for feature in data["subclass_features"]:
                if feature["subclassShortName"] == subclass_name:
                    subclass["features"].append(feature)

        del data["subclass_features"]
            
    def run_cleaning(self):
        for name, path in self.class_paths.items():
            data = self.file_handler.load_json(path)

            self.remove_toplevel_key(keyname="_meta",class_data= data)
    
            class_data = data["class"]
            subclass_data = data["subclass"]
            class_feature = data["classFeature"] 
            subclass_feature = data["subclassFeature"]

            self.remove_keywords(class_data)
            self.remove_keywords(subclass_data)
            self.remove_keywords(class_feature)
            self.remove_keywords(subclass_feature)

            

            data = self.pair_data(
                class_data, 
                subclass_data,
                class_feature,
                subclass_feature,
            )
            
           
            for edition_data in data.values():
                self.pair_subclasses(edition_data)


            for edition_data in data.values():
                self.remove_keywords(edition_data["subclasses"], toplevel=False)
                self.remove_keywords(edition_data["class_features"], toplevel=False)
                for subcls in edition_data["subclasses"]:
                    self.remove_keywords(subcls.get("features", []), toplevel=False)

                self.rename_keywords(edition_data["class"])
                self.adjust_hitdice(edition_data["class"])
                
                # build per-level progression tables
                self.build_level_progression(
                    edition_data["class"],
                    edition_data["class_features"],
                )
                for subcls in edition_data["subclasses"]:
                    self.build_subclass_progression(subcls)


            # self.track_keywords(data)
            save_path = os.path.join(self.output_path,name)
            self.file_handler.save_json(save_path,data)


    def run_feature_LLM_cleaning(self):
        open_ai = OpenAIApi()
        instr_path = os.path.join(self.instructions_path,"feature_cleaning.md")
        instructions = self.file_handler.load_md(instr_path)

        for file in os.listdir(self.output_path):
            name, ext = os.path.splitext(file)
            filepath = os.path.join(self.output_path,name)
            data = self.file_handler.load_json(filepath)

            print(f"processing {name}")

            for edition, values in data.items():
                if edition != "classic":
                    print(f"edition {edition}")

                    for i,feature in enumerate(values["class_features"]):

                        print(f"feature {feature["name"]} {i+1}/{len(values["class_features"])}")
                        if feature["name"] != "Ability Score Improvement":
                            input = [
                                {"role":"user", "content":json.dumps(feature, indent=2)}
                            ]

                            response = open_ai.parse(
                                instructions= instructions,
                                input= input,
                                reasoning="high",
                                text_format=CleanedFeature
                            )

                            feature["clean_entries"] = response

                            self.file_handler.save_json(filepath, data)

                for subclass in values["subclasses"]:
                    print(f"processing subclass {subclass["name"]}")

                    for i, feature in enumerate(subclass["features"]):
                        print(f"feature {feature["name"]} {i+1}/{len(subclass["features"])}")
                        input = [
                            {"role":"user", "content":json.dumps(feature, indent=2)}
                        ]

                        response = open_ai.parse(
                            instructions= instructions,
                            input= input,
                            reasoning="high",
                            text_format=CleanedFeature
                        )

                        feature["clean_entries"] = response

                        self.file_handler.save_json(filepath, data)
        
        print("done")

                        


if __name__ == "__main__":
    cleaner = ClassCleaner()    
    # cleaner.run_cleaning()
    cleaner.run_feature_LLM_cleaning()
    