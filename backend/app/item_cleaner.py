
from file_handler import FileHandler
import os
import re
import copy

class ItemCleaner:
    def __init__(self):
        self.raw_data_path = "../AIdata/5etools_data/raw/"
        self.cleaned_data_path = "../AIdata/5etools_data/cleaned/"
       

        self.raw_items_path = os.path.join(self.raw_data_path,"items")
        self.cleaned_items_path = os.path.join(self.cleaned_data_path,"items")

        self.type_abbre = {}
        self.property_abbre = {}

        self.damage_type_abbre = {
            "O":"force",
            "B":"bludgeoning",
            "P":"piercing",
            "S":"slashing",
            "N":"necrotic",
            "R":"radiant",
            "Y":"psychic",
            "C":"cold"   
        }

        self.removable_keywords = [
            "basicRules2024",
            "srd",
            "srd52",
            "reprintedAs",
            "referenceSources",
            "page",
            "hasFluffImages",
            "classFeatures",
            "basicRules",
            "miscTags",
            "hasRefs",
            "detail1",
            "hasFluff",
            "group",
            "optionalfeatures",
            "reqAttuneAlt",
            "seeAlsoVehicle",
            "scfType",
            "atomicPackContents",
            "otherSources",
            "additionalSources",
            "alias",
            "seeAlsoDeck",
            "weightNote",
            "typeAlt",
            "edition",
            "detail2",
            "dexterityMax",
            "containerCapacity",
            "namePrefix",
            "requires",
            "excludes",
        ]

        self.KEYWORD_KEYS = {
            "tattoo", "poison", "staff", "firearm", "arrow", "axe",
            "needleBlowgun", "bolt", "armor", "club", "dagger", "sword",
            "weapon", "cellEnergy", "bulletFirearm", "polearm", "crossbow",
            "spear", "lance", "hammer", "bow", "mace", "net", "rapier",
            "bulletSling", "ammo",
        }

        self.BONUS_KEYS = {
            "bonusAc": "ac",
            "bonusWeapon": "weapon",
            "bonusWeaponAttack": "weaponAttack",
            "bonusWeaponDamage": "weaponDamage",
            "bonusSpellAttack": "spellAttack",
            "bonusSpellSaveDc": "spellSaveDc",
            "bonusSavingThrow": "savingThrow",
            "bonusSavingThrowConcentration": "savingThrowConcentration",
            "bonusProficiencyBonus": "proficiencyBonus",
            "bonusAbilityCheck": "abilityCheck",
        }


     # ------- Clean Items Section ------------

    def load_items(self,filename, raw:bool= True):
        if raw:
            path = os.path.join(self.raw_items_path, filename)
        else:
            path = os.path.join(self.cleaned_items_path, filename)
        data = FileHandler().load_json(path)

        return data

    def split_items_by_source(self):
        filename = "items"
        path = os.path.join(self.raw_items_path, filename)
        data = FileHandler().load_json(path)

        item_data = data["item"]

        item_source = {}

        for item in item_data:
            if item["source"] not in item_source:
                item_source[item["source"]] = []
            
            item_source[item["source"]].append(item)

        save_path = os.path.join(self.cleaned_items_path,"sourced_items")
        FileHandler().save_json(save_path,item_source)

   
    def remove_item_key(self,keyword,all_items):
        for item in all_items:
            for key in list(item.keys()):
                if key == keyword:
                    del item[key]




    def inspect_entries(self, all_items):
        patterns = {}

        def classify(entry, depth=0):
            if isinstance(entry, str):
                key = f"depth_{depth}_string"
                patterns[key] = patterns.get(key, 0) + 1

            elif isinstance(entry, dict):
                entry_type = entry.get("type", "no_type")
                keys = sorted(entry.keys())
                key = f"depth_{depth}_dict_type={entry_type}_keys={keys}"
                patterns[key] = patterns.get(key, 0) + 1

                # recurse into nested entries
                for sub_key in ("entries", "items", "rows"):
                    if sub_key in entry:
                        for sub in entry[sub_key]:
                            if isinstance(sub, list):  # table rows are lists
                                for cell in sub:
                                    classify(cell, depth + 1)
                            else:
                                classify(sub, depth + 1)

            elif isinstance(entry, list):
                key = f"depth_{depth}_list_len={len(entry)}"
                patterns[key] = patterns.get(key, 0) + 1
                for sub in entry:
                    classify(sub, depth + 1)

        for item in all_items:
            if "entries" not in item:
                continue
            for entry in item["entries"]:
                classify(entry, depth=0)

        for k, v in sorted(patterns.items()):
            print(f"{v:>6}x  {k}")

        return patterns


    def inspect_attached_spells(self, all_items):
        patterns = {}
        for item in all_items:
            spells = item.get("attachedSpells")
            if spells is None:
                continue

            if isinstance(spells, list):
                key = "top_level_list"
            elif isinstance(spells, dict):
                structure = {}
                for k, v in spells.items():
                    if isinstance(v, list):
                        structure[k] = "list"
                    elif isinstance(v, dict):
                        structure[k] = {sk: type(sv).__name__ for sk, sv in v.items()}
                    else:
                        structure[k] = type(v).__name__
                key = str(sorted(structure.items()))
            else:
                key = type(spells).__name__

            patterns[key] = patterns.get(key, 0) + 1

        for k, v in sorted(patterns.items(), key=lambda x: -x[1]):
            print(f"{v:>6}x  {k}")

    def inspect_copy(self, all_items):
        total = 0
        mod_modes = {}
        no_mod = 0
        unresolvable = 0

        item_lookup = {}
        for item in all_items:
            key = (item.get("name"), item.get("source"))
            item_lookup[key] = item

        for item in all_items:
            if "_copy" not in item:
                continue
            total += 1

            copy = item["_copy"]
            source_key = (copy.get("name"), copy.get("source"))

            if source_key not in item_lookup:
                unresolvable += 1

            mod = copy.get("_mod")
            if not mod:
                no_mod += 1
                continue

            for field, ops in mod.items():
                if isinstance(ops, dict):
                    mode = ops.get("mode", "unknown")
                elif isinstance(ops, list):
                    mode = "list_of_ops"
                else:
                    mode = type(ops).__name__
                key = f"{field}.{mode}"
                mod_modes[key] = mod_modes.get(key, 0) + 1

        print(f"Total _copy items: {total}")
        print(f"No _mod (straight copy): {no_mod}")
        print(f"Source item not found: {unresolvable}")
        print(f"\nMod operations:")
        for k, v in sorted(mod_modes.items(), key=lambda x: -x[1]):
            print(f"{v:>6}x  {k}")

    def inspect_ability_structure(self, all_items):
        shapes = {}
        for item in all_items:
            ab = item.get("ability")
            if not ab or not isinstance(ab, dict):
                continue
            structure = {}
            for k, v in ab.items():
                if isinstance(v, list):
                    inner = set(type(x).__name__ for x in v)
                    structure[k] = f"list[{','.join(inner)}]"
                elif isinstance(v, dict):
                    structure[k] = "dict"
                else:
                    structure[k] = type(v).__name__
            key = str(sorted(structure.items()))
            shapes.setdefault(key, []).append(item["name"])

        for key, names in sorted(shapes.items(), key=lambda x: -len(x[1])):
            print(f"{len(names):>4}x  {key}")
            print(f"      e.g. {names[0]}")



    def extract_item_data(self):
        items_data = self.load_items("items") 
        items_base_data = self.load_items("items-base") 
        magicvariants_data = self.load_items("magicvariants")

        # select objects
        magic_items = items_data["item"]
        base_items = items_base_data["baseitem"]
        magic_item_variants = magicvariants_data["magicvariant"]


        #  handle later
        item_property = items_base_data["itemProperty"] # abbrevations
        item_type = items_base_data["itemType"]         # abbrevations
        item_entry = items_base_data["itemEntry"]
        item_mastery = items_base_data["itemMastery"]

        return {
            "magic_items":magic_items,
            "base_items":base_items,
            "magic_item_variants":magic_item_variants,
            "item_property":item_property,
            "item_type":item_type,
            "item_entry":item_entry,
            "item_mastery":item_mastery
            }

    def combine_item_data(self,magic_items,base_items,magic_item_variants):
        all_items = []
        for item in magic_items:
            item["category"] = "magic_item"
            all_items.append(item)

        for item in base_items:
            item["category"] = "base_item"
            all_items.append(item)

        for item in magic_item_variants:
            item["category"] = "magic_item_variant"
            all_items.append(item)

        return all_items
    
    def extract_item_type_abbreviations(self, item_type):
        for obj in item_type:
            name = obj.get("name")
            abbr = obj.get("abbreviation")
            if name and abbr:
                self.type_abbre[abbr] = name

    def extract_item_property_abbreviations(self, item_property):
        for obj in item_property:
            abbr = obj.get("abbreviation")
            if not abbr or abbr in self.property_abbre:
                continue

            if "entries" in obj:
                for entry in obj["entries"]:
                    if isinstance(entry, dict) and "name" in entry:
                        self.property_abbre[abbr] = {
                            "name": entry["name"],
                            "notes": entry.get("entries")
                        }
                        break
            else:
                self.property_abbre[abbr] = {
                    "name": obj.get("name", abbr),
                    "notes": None
                }

    def translate_item_type(self, all_items):
        for item in all_items:
            if "type" in item:
                clean = item["type"].split("|")[0]
                if clean in self.type_abbre:
                    item["type"] = self.type_abbre[clean]

    def translate_item_property(self, all_items):
        for item in all_items:
            if "property" not in item:
                continue

            translated = []
            for prop in item["property"]:
                if isinstance(prop, dict):
                    translated.append(prop)
                    continue

                clean = prop.split("|")[0]
                if clean in self.property_abbre:
                    translated.append(self.property_abbre[clean])
                else:
                    translated.append({"name": clean, "notes": None})

            item["property"] = translated

    def translate_damage_type(self, all_items):
        for item in all_items:
            if "dmgType" in item:
                clean = item["dmgType"].split("|")[0]
                if clean in self.damage_type_abbre:
                    item["dmgType"] = self.damage_type_abbre[clean]
    
    def collect_tags(self, all_items):
        for item in all_items:
            tags = [key for key in self.KEYWORD_KEYS if item.pop(key, None)]
            if tags:
                item["tags"] = tags

    def collect_bonuses(self, all_items):
        for item in all_items:
            bonuses = {}
            for raw_key, clean_key in self.BONUS_KEYS.items():
                val = item.pop(raw_key, None)
                if val is not None:
                    bonuses[clean_key] = val
            if bonuses:
                item["bonuses"] = bonuses

    def flatten_inherits(self, all_items):
        for item in all_items:
            if "inherits" not in item:
                continue

            for key, value in item["inherits"].items():
                if key not in item:
                    item[key] = value
                elif key == "type":
                    item["type"] = value
                elif key == "entries":
                    item["entries"].extend(value)

            del item["inherits"]

    def clean_entry_text(self, text):
        if not isinstance(text, str):
            return text
        text = re.sub(r'\{@dc\s+(\d+)\}', r'DC \1', text)
        text = re.sub(r'\{@dice\s+([^}|]+?)(?:\|[^}]*)?\}', r'\1', text)
        text = re.sub(r'\{@damage\s+([^}|]+?)(?:\|[^}]*)?\}', r'\1', text)
        text = re.sub(r'\{@\w+\s+([^}|]+?)(?:\|[^}]*)?\}', r'\1', text)
        return text

    def flatten_entries(self, all_items):
        for item in all_items:
            if "entries" not in item:
                continue
            item["entries"] = self._flatten_entry_list(item["entries"])

    def _flatten_entry_list(self, entries):
        result = []
        for entry in entries:
            result.extend(self._flatten_entry(entry))
        return result

    def _flatten_entry(self, entry):
        if isinstance(entry, str):
            return [{"text": self.clean_entry_text(entry)}]

        if not isinstance(entry, dict):
            return []

        entry_type = entry.get("type", "")

        # named subsections: entries, inset, section
        if entry_type in ("entries", "inset", "section"):
            flat = []
            name = entry.get("name")
            sub_entries = entry.get("entries", [])

            for i, sub in enumerate(sub_entries):
                children = self._flatten_entry(sub)
                # attach name to first child only
                if i == 0 and name and children:
                    children[0]["name"] = name
                flat.extend(children)
            return flat

        # item (key-value style)
        if entry_type == "item":
            name = entry.get("name", "")
            # "entries" is a list, "entry" is a single string
            if "entries" in entry:
                texts = [self.clean_entry_text(e) for e in entry["entries"] if isinstance(e, str)]
                text = " ".join(texts)
            elif "entry" in entry:
                text = self.clean_entry_text(entry["entry"])
            else:
                text = ""
            return [{"name": name, "text": text}] if text else []

        # list (bullet points)
        if entry_type == "list":
            flat = []
            for li in entry.get("items", []):
                if isinstance(li, str):
                    flat.append({"text": "• " + self.clean_entry_text(li)})
                elif isinstance(li, dict):
                    flat.extend(self._flatten_entry(li))
            return flat

        # table
        if entry_type == "table":
            table_obj = {
                "columns": entry.get("colLabels", []),
                "rows": []
            }
            caption = entry.get("caption")
            if caption:
                table_obj["caption"] = self.clean_entry_text(caption)

            for row in entry.get("rows", []):
                if isinstance(row, list):
                    cleaned = []
                    for cell in row:
                        if isinstance(cell, str):
                            cleaned.append(self.clean_entry_text(cell))
                        elif isinstance(cell, dict) and "entry" in cell:
                            cleaned.append(self.clean_entry_text(cell["entry"]))
                        else:
                            cleaned.append(str(cell))
                    table_obj["rows"].append(cleaned)

            return [{"table": table_obj}]

        # quote
        if entry_type == "quote":
            texts = [self.clean_entry_text(e) for e in entry.get("entries", []) if isinstance(e, str)]
            if texts:
                return [{"text": " ".join(texts)}]

        # cell (stray table cell)
        if entry_type == "cell" and "entry" in entry:
            return [{"text": self.clean_entry_text(entry["entry"])}]

        return []

    def flatten_attached_spells(self, all_items):
        for item in all_items:
            if "attachedSpells" not in item:
                continue

            spells = item["attachedSpells"]

            if isinstance(spells, list):
                item["attachedSpells"] = [s.split("|")[0] for s in spells]
                continue

            if isinstance(spells, dict):
                collected = []
                for key, val in spells.items():
                    if isinstance(val, list):
                        collected.extend(val)
                    elif isinstance(val, dict):
                        for sub in val.values():
                            if isinstance(sub, list):
                                collected.extend(sub)
                    elif isinstance(val, str):
                        collected.append(val)
                item["attachedSpells"] = [s.split("|")[0] for s in collected]

    def flatten_ability(self, all_items):
        ABILITY_KEYS = {"str", "dex", "con", "int", "wis", "cha"}

        for item in all_items:
            if "ability" not in item:
                continue

            raw = item["ability"]
            if not isinstance(raw, dict):
                del item["ability"]
                continue

            result = {}

            # "static" — set ability to a fixed value
            if isinstance(raw.get("static"), dict):
                result["set"] = raw["static"]

            # "choose" — can be list-of-dicts, single dict, or list-of-strings
            choose_raw = raw.get("choose")
            from_list = None
            count = 1
            amount = 1

            if isinstance(choose_raw, list):
                if choose_raw and isinstance(choose_raw[0], dict):
                    entry = choose_raw[0]
                    from_list = entry.get("from")
                    count = entry.get("count", 1)
                    amount = entry.get("amount", 1)
                else:
                    from_list = choose_raw  # direct list
                    count = raw.get("count", 1)
                    amount = raw.get("amount", 1)
            elif isinstance(choose_raw, dict):
                from_list = choose_raw.get("from")
                count = choose_raw.get("count", 1)
                amount = choose_raw.get("amount", 1)

            # Unwrapped shape: {"from": [...], "count": 1, "amount": 2}
            if from_list is None and "from" in raw and "static" not in raw:
                from_list = raw["from"]
                count = raw.get("count", 1)
                amount = raw.get("amount", 1)

            if isinstance(from_list, list):
                cleaned = [s for s in from_list if isinstance(s, str)]
                if cleaned:
                    result["choose"] = cleaned
                    result["count"] = count
                    result["amount"] = amount

            # Flat bonus: {"str": 4}
            bonus = {k: v for k, v in raw.items() if k in ABILITY_KEYS}
            if bonus and "static" not in raw and "from" not in raw and "choose" not in raw:
                result["increase"] = bonus

            if result:
                item["ability"] = result
            else:
                del item["ability"]

    def resolve_copy(self, all_items):
        lookup = {}
        for item in all_items:
            key = (item.get("name"), item.get("source"))
            lookup[key] = item

        for item in all_items:
            if "_copy" not in item:
                continue

            ref = item["_copy"]
            source_key = (ref.get("name"), ref.get("source"))
            source = lookup.get(source_key)

            if not source:
                del item["_copy"]
                continue

            # copy over fields we don't already have
            for k, v in source.items():
                if k not in item and k != "_copy":
                    item[k] = copy.deepcopy(v)

            # apply mods
            mod = ref.get("_mod", {})
            for field, ops in mod.items():
                if field not in item:
                    continue

                if isinstance(ops, list):
                    for op in ops:
                        self._apply_entry_mod(item, field, op)
                elif isinstance(ops, dict):
                    self._apply_entry_mod(item, field, ops)

            del item["_copy"]

    def _apply_entry_mod(self, item, field, op):
        mode = op.get("mode")
        items = op.get("items")
        target = item.get(field, [])

        if not isinstance(target, list):
            return

        if mode == "appendArr":
            if isinstance(items, list):
                target.extend(items)
            else:
                target.append(items)

        elif mode == "insertArr":
            index = op.get("index", -1)
            if index < 0:
                index = max(0, len(target) + index + 1)
            if isinstance(items, list):
                for i, entry in enumerate(items):
                    target.insert(index + i, entry)
            else:
                target.insert(index, items)

        elif mode == "replaceArr":
            replace = op.get("replace", {})
            index = replace.get("index")
            if index is not None and 0 <= index < len(target):
                target.pop(index)
                if isinstance(items, list):
                    for i, entry in enumerate(items):
                        target.insert(index + i, entry)
                else:
                    target.insert(index, items)

        item[field] = target

    def merge_additional_entries(self, all_items):
        for item in all_items:
            if "additionalEntries" not in item:
                continue

            if "entries" in item:
                item["entries"].extend(item["additionalEntries"])
            else:
                item["entries"] = item["additionalEntries"]

            del item["additionalEntries"]

    def run(self):
        data = self.extract_item_data()

        magic_items = data["magic_items"]
        base_items = data["base_items"]
        magic_item_variants= data["magic_item_variants"]
        item_property = data["item_property"]
        item_type = data["item_type"] 
           
         
        self.extract_item_type_abbreviations(item_type)
        self.extract_item_property_abbreviations(item_property)

        all_items = self.combine_item_data(
            magic_items=magic_items,
            base_items=base_items,
            magic_item_variants=magic_item_variants
        )


        self.resolve_copy(all_items)

        self.flatten_inherits(all_items)

        self.merge_additional_entries(all_items)
        

        for keyword in self.removable_keywords:
            self.remove_item_key(keyword=keyword,all_items=all_items)

        self.translate_item_type(all_items)
        self.translate_item_property(all_items)
        self.translate_damage_type(all_items)

        self.collect_bonuses(all_items)
        self.collect_tags(all_items)

        self.flatten_entries(all_items)
        self.flatten_attached_spells(all_items)
        self.flatten_ability(all_items)

        save_path = os.path.join(self.cleaned_items_path, "all_items")
        FileHandler().save_json(save_path,all_items)


if __name__ == "__main__":
    cleaner = ItemCleaner()
    # cleaner.combine_item_data()

    # cleaner.item_keyword_tracker(
    #     "all_items",
    #     True,
    #     True,
    #     "keywords"
    #     )

    cleaner.run()