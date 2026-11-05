import os
from file_handler import FileHandler
from open_ai_api import OpenAIApi
from schemas.optional_features_schema import CleanedOptionalFeatureLLMData
import json

class OptionalCleaner:
    def __init__(self):
        self.raw_path = "raw_data/optional_features/optionalfeatures"
        self.output_path = "output/optional_features"
        self.instructions_path = "instructions/optional_features"
        self.filehandler = FileHandler()


        self.removable_keywords = [
            "page",
            "srd",
            "reprintedAs",
            "srd52",
            "isClassFeatureVariant",
            "otherSources",
            "hasFluffImages",
        ]

        self.feature_type_abbrevations = {
            'EI':      'eldritch_invocation',
            'MV:B':     'maneuver',
            'AI':       'artificer_infusion',
            'FS:F':    'fighting_style',
            'FS:R':    'fighting_style',
            'FS:P':   'fighting_style',
            'FS:B':   'fighting_style',
            'AS':      'arcane_shot'   ,
            'ED':      'elemental_discipline',
            'MM':      'metamagic',
            'RP':      'renown_perk',
            'RN':     'knight_rune',
            'PB':     'pact_boon'
        }


    def track_toplevel_keywords(self, data):
        keywords = []
        for op in data:
            for key in op.keys():
                if key not in keywords:
                    keywords.append(key)

        savepath = os.path.join(self.output_path,"keywords")
        self.filehandler.save_json(savepath,keywords)

    def inspect_feature_type(self,data):
        unique_features = []
        for op in data:
            types = op.get("featureType", None)
            if len(types) > 1:
                print(op["name"])

            # for type in types:
            #     if type not in unique_features:
            #         unique_features.append(type)

        
        # print(unique_features)

    def inspect_prereq(self, data):
        """Recursively scan all prerequisite objects and report their full structure."""
        from collections import defaultdict

        paths = defaultdict(lambda: {"count": 0, "types": set(), "samples": set()})
        wrapper_lengths = defaultdict(int)
        total = 0

        def walk(node, path):
            info = paths[path]
            info["count"] += 1
            info["types"].add(type(node).__name__)

            if isinstance(node, dict):
                for k, v in node.items():
                    walk(v, f"{path}.{k}" if path else k)
            elif isinstance(node, list):
                for el in node:
                    walk(el, f"{path}[]")
            else:
                if node is not None and len(info["samples"]) < 8:
                    info["samples"].add(str(node)[:60])

        for op in data:
            prereq = op.get("prerequisite")
            if not prereq:
                continue
            total += 1

            if not isinstance(prereq, list):
                print(f"WARNING: non-list prerequisite on '{op.get('name', '?')}': {type(prereq).__name__}")
                continue

            wrapper_lengths[len(prereq)] += 1
            for clause in prereq:
                if not isinstance(clause, dict):
                    print(f"WARNING: non-dict clause on '{op.get('name', '?')}': {type(clause).__name__}")
                    continue
                walk(clause, "")

        print("\n=== Prerequisite Scan ===")
        print(f"Entries with prerequisite: {total}")
        print(f"Wrapper list lengths: {dict(wrapper_lengths)}")
        print(f"\n{'PATH':<45} {'COUNT':>6}  {'TYPES':<14}  SAMPLES")
        print("-" * 110)
        for path in sorted(paths.keys()):
            info = paths[path]
            types_str = ",".join(sorted(info["types"]))
            samples_str = " | ".join(sorted(info["samples"]))[:50] if info["samples"] else ""
            label = path or "<clause root>"
            print(f"{label:<45} {info['count']:>6}  {types_str:<14}  {samples_str}")
                        
    def inspect_key(self,data,keyname):
        for op in data:
            if keyname in op:
                if isinstance(op[keyname],list):
                    if len(op[keyname]) > 1:
                        print(op['name'])

    def inspect_additional_spells(self, data):
        """Recursively scan all additionalSpells objects and report their full structure."""
        from collections import defaultdict

        paths = defaultdict(lambda: {"count": 0, "types": set(), "samples": set()})
        wrapper_lengths = defaultdict(int)
        total = 0

        def walk(node, path):
            info = paths[path]
            info["count"] += 1
            info["types"].add(type(node).__name__)

            if isinstance(node, dict):
                for k, v in node.items():
                    walk(v, f"{path}.{k}" if path else k)
            elif isinstance(node, list):
                for el in node:
                    walk(el, f"{path}[]")
            else:
                if node is not None and len(info["samples"]) < 8:
                    info["samples"].add(str(node)[:60])

        for op in data:
            add_spells = op.get("additionalSpells")
            if not add_spells:
                continue
            total += 1

            # 5etools wraps additionalSpells in a list — check whether length is always 1
            if isinstance(add_spells, list):
                wrapper_lengths[len(add_spells)] += 1
                for clause in add_spells:
                    if not isinstance(clause, dict):
                        print(f"WARNING: non-dict clause on '{op.get('name', '?')}': {type(clause).__name__}")
                        continue
                    walk(clause, "")
            elif isinstance(add_spells, dict):
                wrapper_lengths["unwrapped_dict"] += 1
                walk(add_spells, "")
            else:
                print(f"WARNING: unexpected additionalSpells type on '{op.get('name', '?')}': {type(add_spells).__name__}")

        print("\n=== AdditionalSpells Scan ===")
        print(f"Entries with additionalSpells: {total}")
        print(f"Wrapper list lengths: {dict(wrapper_lengths)}")
        print(f"\n{'PATH':<55} {'COUNT':>6}  {'TYPES':<18}  SAMPLES")
        print("-" * 120)
        for path in sorted(paths.keys()):
            info = paths[path]
            types_str = ",".join(sorted(info["types"]))
            samples_str = " | ".join(sorted(info["samples"]))[:50] if info["samples"] else ""
            label = path or "<clause root>"
            print(f"{label:<55} {info['count']:>6}  {types_str:<18}  {samples_str}")


    # ----------- Main Methods -----------------
    def sort_by_feature_type(self,data):
        types_data = {}
        for op in data:
            types = op.get("featureType", None)
            type = types[0]
            type = self.feature_type_abbrevations[type]

            del op["featureType"]
            types_data.setdefault(type, []).append(op)

        for name, op_data in types_data.items():
            path = os.path.join(self.output_path, "feature_types")
            os.makedirs(path,exist_ok=True)
            path = os.path.join(path,name)
            self.filehandler.save_json(path, op_data)
               
    def remove_keywords(self,data):
        for op in data:
            for key in list(op.keys()):
                if key in self.removable_keywords:
                    del op[key]

    def clean_prereq(self, data):
        for op in data:
            raw = op.get("prerequisite")
            if not raw:
                continue

            clause = raw[0]
            cleaned = {}
            other = []

            # level — flatten class/subclass to plain names, rename level.level -> value
            if "level" in clause:
                lv = clause["level"]
                level_obj = {"value": lv["level"]}
                if "class" in lv:
                    level_obj["class"] = lv["class"]["name"]
                if "subclass" in lv:
                    level_obj["subclass"] = lv["subclass"]["name"]
                cleaned["level"] = level_obj

            # optional features — strip |source, title-case; merge pact boons in
            opt_features = []
            if "optionalfeature" in clause:
                for ref in clause["optionalfeature"]:
                    opt_features.append(ref.split("|")[0].strip().title())
            if "pact" in clause:
                opt_features.append(f"Pact of the {clause['pact']}")
            if opt_features:
                cleaned["optionalFeatures"] = opt_features

            # spells — exact named spells only; filter clauses and fuzzy refs go to other
            spells = []
            if "spell" in clause:
                for entry in clause["spell"]:
                    if isinstance(entry, str):
                        name = entry.split("|")[0].split("#")[0].strip()
                        if "/" in name:
                            other.append(f"{name.replace('/', ' or ')} spell")
                        elif name:
                            spells.append(name.title())
                    elif isinstance(entry, dict):
                        desc = entry.get("entrySummary") or entry.get("entry")
                        if desc:
                            other.append(desc)
            if spells:
                cleaned["spells"] = spells

            # items — always free-text descriptions
            if "item" in clause:
                other.extend(clause["item"])

            # otherSummary — keep clean entrySummary, drop the 5etools-tagged entry
            if "otherSummary" in clause:
                summary = clause["otherSummary"].get("entrySummary") or clause["otherSummary"].get("entry")
                if summary:
                    other.append(summary)

            if other:
                cleaned["other"] = other

            op["prerequisite"] = cleaned

    def clean_skills(self,data):
        for op in data:
            skill_proficiencies = []
            if "skillProficiencies" in op:
                for skill in op["skillProficiencies"][0].keys():
                    skill_proficiencies.append(skill)

                del op["skillProficiencies"]

                op["skill_proficiencies"] = skill_proficiencies


    def run_pre_LLM(self):
        data = self.filehandler.load_json(self.raw_path)["optionalfeature"]

        self.remove_keywords(data)
        self.clean_prereq(data)
        self.clean_skills(data)

        self.sort_by_feature_type(data)


    def run_LLM_cleaning(self,feature_type,token_limit = 700000):

        instructions_path = os.path.join(self.instructions_path, "clean_entries_spells.md")
        instructions = self.filehandler.load_md(instructions_path)

        uncleaned_features_path = os.path.join(self.output_path,"feature_types")
        uncleaned_filepath = os.path.join(uncleaned_features_path,feature_type)
        data = self.filehandler.load_json(uncleaned_filepath)

        
        total_tokens = 0
        for i, feature in enumerate(data):
            if total_tokens >= token_limit:
                break
            
            cleaned_path = os.path.join(self.output_path,"cleaned_features",feature_type)

            try:
                cleaned_data = self.filehandler.load_json(cleaned_path)

            except FileNotFoundError:
                cleaned_data = []

            print(f"{feature['name']}-{feature['source']} : {i+1}/{len(data)}")
            print(f"tokens {total_tokens}/{token_limit}")

            open_ai = OpenAIApi()

            entries = feature.get("entries",None)
            spells = feature.get("additionalSpells",None)


            payload = {
                "entries": entries,
                "additional_spells": spells,  # may be None
            }

            input = [
                {
                    "role": "user",
                    "content": json.dumps(payload, ensure_ascii=False),
                }
            ]

            response, tokens = open_ai.parse(
                instructions=instructions,
                input=input,
                reasoning="low",
                text_format=CleanedOptionalFeatureLLMData,
                timeout= 120.0,
            )

            if entries:
                del feature["entries"]

            if spells:
                del feature["additionalSpells"]

            feature.update(response)

            cleaned_data.append(feature)

            self.filehandler.save_json(cleaned_path,cleaned_data)
            total_tokens += tokens


    # -------- POST LLM ----------


    def remove_none_values(self):
        loadpath = os.path.join(self.output_path,"cleaned_features")
        savefolder = os.path.join(self.output_path,"stripped_features")
        os.makedirs(savefolder,exist_ok=True)
       
        for file in os.listdir(loadpath):
            name, ext = os.path.splitext(file)
            path = os.path.join(loadpath,name)

            data = self.filehandler.load_json(path)
        
            for feature in data:
                for key,val in list(feature.items()):
                    if not val:
                        del feature[key]

            savepath = os.path.join(savefolder,name)
            self.filehandler.save_json(savepath,data)


    def gather_features(self):
        loadpath = os.path.join(self.output_path,"cleaned_features")

        all_features = []

        for file in os.listdir(loadpath):
            name, ext = os.path.splitext(file)
            path = os.path.join(loadpath,name)

            data = self.filehandler.load_json(path)

            for feature in data:
                feature["feature_type"] = name

                all_features.append(feature)

        savepath = os.path.join(self.output_path,"all_features")
        self.filehandler.save_json(savepath,all_features)
        


    


if __name__ == "__main__":
    cleaner = OptionalCleaner()

    # cleaner.run_pre_LLM()

    # cleaner.run_LLM_cleaning(feature_type="renown_perk")

    cleaner.gather_features()