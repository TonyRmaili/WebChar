from file_handler import FileHandler
from open_ai_api import OpenAIApi
import os
import copy
import re
from schemas.races_schema import Race
import json

# print(json.dumps(Race.model_json_schema(), indent=2))


class RaceCleaner:
    def __init__(self):
        self.data_path = "../AIData"
        self.instructions_path = os.path.join(self.data_path, "instructions")
        self.five_Etools_data_path = os.path.join(self.data_path, "5etools_data")
        self.raw_data_path = os.path.join(self.five_Etools_data_path, "raw", "races")
        self.cleaned_data_path = os.path.join(self.five_Etools_data_path, "cleaned", "races")

        self.instructions_path = "instructions/races"

        self.race_instructions_path = os.path.join(self.instructions_path,"clean_races.md")
        self.race_input_example_path = os.path.join(self.instructions_path,"race_cleaner_example_input")
        self.race_output_example_path = os.path.join(self.instructions_path,"race_cleaner_example_output")

        self.file_handler = FileHandler()

        self.removable_keywords = [
            "soundClip",
            "page",
            "otherSources",
            "reprintedAs",
            "hasFluff",
            "hasFluffImages",
            "lineage",
            "heightAndWeight",
            "edition",
            "sizeEntry",
            "creatureTypeTags",
            "srd",
            "srd52",
            "basicRules2024",
            "basicRules",
            "additionalSources",
            "alias",
            "traitTags",
        ]


    # ─────────────────────────────────────────────
    # Loading / tracking
    # ─────────────────────────────────────────────

    def load_races(self):
        filepath = os.path.join(self.raw_data_path, "races")
        data = self.file_handler.load_json(filepath)
        return {
            "races": data["race"],
            "subraces": data["subrace"],
        }

    def track_keywords(self, race_data):
        race_keywords = []
        for race in race_data:
            for key in race.keys():
                if key not in race_keywords:
                    race_keywords.append(key)

        savepath = os.path.join(self.raw_data_path, "keywords")
        self.file_handler.save_json(savepath, race_keywords)


    # ─────────────────────────────────────────────
    # Cleanup helpers
    # ─────────────────────────────────────────────

    def remove_keywords(self, race_data, subrace_data):
        for race in race_data:
            for key in list(race.keys()):
                if key in self.removable_keywords:
                    del race[key]

        for subrace in subrace_data:
            for key in list(subrace.keys()):
                if key in self.removable_keywords:
                    del subrace[key]


    # ─────────────────────────────────────────────
    # _copy resolution
    # ─────────────────────────────────────────────

    def resolve_copy(self, race_data, subrace_data):
        """
        For every entry with a _copy reference:
          1. Pull any fields from the source race that are missing on this entry.
          2. Apply _mod operations to the entries array (replaceArr, appendArr).
          3. Delete _copy so the entry is self-sufficient.
        """
        lookup = {}
        for entry in race_data:
            lookup[(entry.get("name"), entry.get("source"))] = entry
        for entry in subrace_data:
            lookup[(entry.get("name"), entry.get("source"))] = entry

        all_entries = race_data + subrace_data

        for entry in all_entries:
            if "_copy" not in entry:
                continue

            ref = entry["_copy"]
            source_key = (ref.get("name"), ref.get("source"))
            source = lookup.get(source_key)

            if source is None:
                print(f"Orphan _copy: {entry.get('name')} -> {source_key}")
                del entry["_copy"]
                continue

            # Pull missing fields from source
            for k, v in source.items():
                if k in ("_copy",):
                    continue
                if k not in entry:
                    entry[k] = copy.deepcopy(v)

            # Apply _mod operations to entries
            mod = ref.get("_mod", {})
            entry_ops = mod.get("entries")
            if entry_ops:
                ops_list = entry_ops if isinstance(entry_ops, list) else [entry_ops]
                for op in ops_list:
                    self._apply_entries_mod(entry, op)

            del entry["_copy"]

    def _apply_entries_mod(self, entry, op):
        mode = op.get("mode")
        payload = op.get("items")
        target = entry.get("entries", [])

        if not isinstance(target, list):
            return

        if mode == "appendArr":
            if isinstance(payload, list):
                target.extend(payload)
            else:
                target.append(payload)

        elif mode == "replaceArr":
            replace = op.get("replace")
            replace_index = None

            if isinstance(replace, dict):
                replace_index = replace.get("index")
            elif isinstance(replace, str):
                for i, el in enumerate(target):
                    if isinstance(el, dict) and el.get("name") == replace:
                        replace_index = i
                        break

            if replace_index is not None and 0 <= replace_index < len(target):
                target.pop(replace_index)
                if isinstance(payload, list):
                    for i, p in enumerate(payload):
                        target.insert(replace_index + i, p)
                else:
                    target.insert(replace_index, payload)

        entry["entries"] = target


    # ─────────────────────────────────────────────
    # _versions resolution
    # ─────────────────────────────────────────────

    def resolve_versions(self, race_data, subrace_data):
        """
        Expand _versions into entries in the race's `subraces` array.
        Each version becomes a subrace containing ONLY the fields it declares
        or overrides — shared data stays on the parent.
        """
        for entry in race_data + subrace_data:
            versions = entry.pop("_versions", None)
            if not versions:
                continue

            if "subraces" not in entry:
                entry["subraces"] = []

            for version in versions:
                if "_abstract" in version and "_implementations" in version:
                    for impl in version["_implementations"]:
                        sub = self._build_subrace_from_abstract(version["_abstract"], impl)
                        entry["subraces"].append(sub)
                else:
                    sub = self._build_subrace_from_mod(version)
                    entry["subraces"].append(sub)

    def _build_subrace_from_abstract(self, abstract, impl):
        variables = impl.get("_variables", {})
        subrace = {}

        if "name" in abstract:
            subrace["name"] = self._substitute_vars(abstract["name"], variables)

        if "source" in impl:
            subrace["source"] = impl["source"]
        elif "source" in abstract:
            subrace["source"] = abstract["source"]

        mod = abstract.get("_mod", {})
        entries_from_mod = []
        for field, ops in mod.items():
            if field != "entries":
                continue
            ops_list = ops if isinstance(ops, list) else [ops]
            for op in ops_list:
                items = op.get("items")
                if items is None:
                    continue
                items_list = items if isinstance(items, list) else [items]
                for it in items_list:
                    substituted = self._substitute_in_obj(it, variables)
                    entries_from_mod.append(substituted)

        if entries_from_mod:
            subrace["entries"] = entries_from_mod

        for k, v in impl.items():
            if k in ("_variables", "_mod", "source"):
                continue
            subrace[k] = self._substitute_in_obj(copy.deepcopy(v), variables)

        return subrace

    def _build_subrace_from_mod(self, version):
        subrace = {}

        if "name" in version:
            subrace["name"] = version["name"]
        if "source" in version:
            subrace["source"] = version["source"]

        mod = version.get("_mod", {})
        entries_from_mod = []
        for field, ops in mod.items():
            if field != "entries":
                continue
            ops_list = ops if isinstance(ops, list) else [ops]
            for op in ops_list:
                items = op.get("items")
                if items is None:
                    continue
                items_list = items if isinstance(items, list) else [items]
                entries_from_mod.extend(copy.deepcopy(items_list))

        if entries_from_mod:
            subrace["entries"] = entries_from_mod

        for k, v in version.items():
            if k in ("name", "source", "_mod", "_abstract", "_implementations", "overwrite"):
                continue
            subrace[k] = copy.deepcopy(v)

        return subrace

    def _substitute_vars(self, text, variables):
        if not isinstance(text, str):
            return text

        def replace(match):
            key = match.group(1).strip()
            return str(variables.get(key, match.group(0)))

        return re.sub(r"\{\{(\w+)\}\}", replace, text)

    def _substitute_in_obj(self, obj, variables):
        if isinstance(obj, str):
            return self._substitute_vars(obj, variables)
        if isinstance(obj, list):
            return [self._substitute_in_obj(x, variables) for x in obj]
        if isinstance(obj, dict):
            return {k: self._substitute_in_obj(v, variables) for k, v in obj.items()}
        return obj


    # ─────────────────────────────────────────────
    # Subrace pairing
    # ─────────────────────────────────────────────

    def pair_subraces(self, race_data, subrace_data):
        race_lookup = {(r["name"], r["source"]): r for r in race_data}

        for race in race_data:
            if "subraces" not in race:
                race["subraces"] = []

            # Drop color-variant subraces that are covered by the parent's ancestry table
            race["subraces"] = [
                s for s in race["subraces"]
                if not self._is_color_variant_covered_by_table(s)
            ]

        for sub in subrace_data:
            key = (sub.get("raceName"), sub.get("raceSource"))
            parent = race_lookup.get(key)
            if parent is None:
                continue

            # Drop nested color variants — parent's ancestry table covers them
            sub.pop("subraces", None)

            # Skip wrappers with no name (they're just containers from _versions expansion)
            if not sub.get("name"):
                continue

            # Drop color variants already covered by parent's ancestry table
            if self._is_color_variant_covered_by_table(sub):
                continue

            parent["subraces"].append(sub)

        return race_data

    def _is_color_variant_covered_by_table(self, subrace):
        """
        A subrace is 'table-covered' if its only meaningful data is a resist
        + a Breath Weapon / Damage Resistance entry. The parent's ancestry
        table already captures this information.
        """
        skip_keys = {"name", "source", "raceName", "raceSource"}
        meaningful_keys = set(subrace.keys()) - skip_keys

        if not meaningful_keys.issubset({"resist", "entries"}):
            return False

        entries = subrace.get("entries", [])
        if not entries:
            return False

        allowed_names = {"Breath Weapon", "Damage Resistance"}
        for e in entries:
            if not isinstance(e, dict):
                return False
            if e.get("name") not in allowed_names:
                return False
        return True


    # ─────────────────────────────────────────────
    # Orchestration
    # ─────────────────────────────────────────────

    def run_raw_cleaning(self):
        data = self.load_races()
        race_data = data["races"]
        subrace_data = data["subraces"]

        self.remove_keywords(race_data, subrace_data)

        # 1. Resolve _copy first so versions see a complete parent
        self.resolve_copy(race_data, subrace_data)

        # 2. Expand _versions into subraces
        self.resolve_versions(race_data, subrace_data)

        # 3. Pair top-level subraces with their parent races;
        #    drops nested variants and table-covered color variants
        race_data = self.pair_subraces(race_data, subrace_data)

        savepath = os.path.join(self.cleaned_data_path, "all_races")
        self.file_handler.save_json(savepath, race_data)

    def test_run(self,name,source):
        instructions = self.file_handler.load_md(self.race_instructions_path)
        input_example = self.file_handler.load_json(self.race_input_example_path)
        output_example = self.file_handler.load_json(self.race_output_example_path)

        # Load the race you want to test on
        all_races = self.file_handler.load_json(os.path.join(self.cleaned_data_path, "all_races"))
        target_race = next(
            (r for r in all_races if r["name"] == name and r["source"] == source),
            None,
        )
        if target_race is None:
            print("Target race not found")
            return

        # Build the full instruction: base rules + few-shot example
        full_instructions = (
            f"{instructions}\n\n"
            f"# Example input\n"
            f"{json.dumps(input_example, indent=2)}\n\n"
            f"# Example output\n"
            f"{json.dumps(output_example, indent=2)}"
        )

        # The input is just the target race as JSON
        user_input = (
            f"# Target input\n"
            f"{json.dumps(target_race, indent=2)}\n\n"
            f"Return only the JSON output for the target input."
        )

        open_ai = OpenAIApi()

        response = open_ai.parse(
            instructions=full_instructions,
            input=user_input,
            reasoning="medium",
            text_format=Race,
        )

        # Save for inspection
        filename = name + "_" + source
        savepath = os.path.join("output/races", filename)
        self.file_handler.save_json(savepath, response)
        print(f"Saved to {savepath}.json")

    def run_llm_cleaning(self):
        instructions = self.file_handler.load_md(self.race_instructions_path)
        input_example = self.file_handler.load_json(self.race_input_example_path)
        output_example = self.file_handler.load_json(self.race_output_example_path)

        raw_races = self.file_handler.load_json(os.path.join(self.cleaned_data_path, "all_races"))

        output_path = "output/races/all_races_final"
        cleaned_races = self.file_handler.load_json(output_path)

        open_ai = OpenAIApi()

        full_instructions = (
            f"{instructions}\n\n"
            f"# Example input\n"
            f"{json.dumps(input_example, indent=2)}\n\n"
            f"# Example output\n"
            f"{json.dumps(output_example, indent=2)}"
        )

        start_index = cleaned_races.get("index", -1) + 1

        for i, race in enumerate(raw_races):
            if i < start_index:
                continue

            print(f"[{i+1}/{len(raw_races)}] {race.get('name')}/{race.get('source')}")

            user_input = (
                f"# Target input\n"
                f"{json.dumps(race, indent=2)}\n\n"
                f"Return only the JSON output for the target input."
            )

            try:
                response = open_ai.parse(
                    instructions=full_instructions,
                    input=user_input,
                    reasoning="medium",
                    text_format=Race,
                )
            except Exception as e:
                print(f"  FAILED: {e}")
                # Don't advance the index — next run will retry this race
                self.file_handler.save_json(output_path, cleaned_races)
                continue

            cleaned_races["races"].append(response)
            cleaned_races["index"] = i

            self.file_handler.save_json(output_path, cleaned_races)

        print(f"\nDone. Processed {len(cleaned_races['races'])} races.")

  

if __name__ == "__main__":
    cleaner = RaceCleaner()
    cleaner.run_llm_cleaning()