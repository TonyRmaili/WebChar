
from file_handler import FileHandler
import os
import re
import copy
import json
from schemas.items_schema import CleanedGenericItem
from open_ai_api import OpenAIApi

class ItemCleaner:
    def __init__(self):
        self.raw_path = "raw_data/items"
        self.output_path = "output/items"
        self.instructions_path = "instructions/items"
       

        self.filehandler = FileHandler()

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
        item_mastery = data["item_mastery"]
           
         
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


    # ----- POST PHASE1 CLEANING ---------------
    def track_toplevel_keywords(self,data):
        unique_keys = []
        for item in data:
            for key in item.keys():
                if key not in unique_keys:
                    unique_keys.append(key)

        savepath = os.path.join(self.output_path,"keywords")
        self.filehandler.save_json(savepath,unique_keys)

    def get_string_values(self,data,key):
        unique_values = []
        for item in data:
            value = item.get(key,None)
            
            if value and value not in unique_values:
                unique_values.append(value)

        print(unique_values)

    def compare_attunments(self,data):      
        gathered = []
        got_tags = []
        got_attun = []

        for item in data:
            attune = item.get("reqAttune",None)
            tags = item.get("reqAttuneTags", None)

            if attune or tags:
                gathered.append(item)

        
        for item in gathered:
            if "reqAttuneTags" in item:
                got_tags.append(item)

        for item in gathered:
            if "reqAttune" in item:
                got_attun.append(item)

        print(len(gathered))
        print(len(got_attun))
        print(len(got_tags))

        
        # values = []
        # for item in gathered:
        #     if "reqAttuneTags" in item:
        #         if item["reqAttune"] not in values:
        #             values.append(item["reqAttune"])


        # print(values)
           
    def gather_generic_variants(self,data):
        generics = []
        for item in data:
            type = item.get("type",None)

            if type == "Generic Variant":
                generics.append(item)
        
        savepath = os.path.join(self.output_path,"generic_variants")
        self.filehandler.save_json(savepath,generics)
    #------------- CLEANERS ------------

    def combine_type_groups(self,data):
        vehicles = ['Vehicle (Space)', 'Vehicle (Water)', 'Vehicle (Land)','Vehicle (Air)']
        tools = ["Artisan's Tools", "Food and Drink"]
        treasures =  ['Treasure (Gemstone)', 'Treasure (Art Object)', 'Treasure (Coinage)']
        for item in data:
            type = item.get("type",None)

            if type == "Trade Bar":
                item["type"] = "Trade Good"

            elif type in vehicles:
                item["type"] = "Vehicle"

            elif type in tools:
                item["type"] = "Tool"

            elif type in treasures:
                item["type"] = "Treasure"

            elif type == "Tack and Harness":
                item["type"] = "Other"

    def split_string(self,data):
        for item in data:
            if "baseItem" in item:
                text = item["baseItem"]
                cleaned = text.split("|")[0]
                item["baseItem"] = cleaned

            if "ammoType" in item:
                text = item["ammoType"]
                cleaned = text.split("|")[0]
                item["ammoType"] = cleaned

    def clean_mastery(self,data):
        for item in data:
            if "mastery" in item:
                mastery = item["mastery"][0]
                if isinstance(mastery,dict):
                    mastery = mastery.get("uid",None)
                    if mastery:
                        clean = mastery.split("|")[0]
                        item["mastery"] = clean     
                else:
                    clean = mastery.split("|")[0]
                    item["mastery"] = clean
    
    def clean_pack_contents(self,data):
        for item in data:
            contents = []
            if "packContents" in item:
                for content in item["packContents"]:
                    if isinstance(content,str):
                        content = content.split("|")[0]
                        contents.append(content)

                    elif isinstance(content,dict):
                        p_item = content.get("item",None)
                        if p_item:
                            content["item"] = p_item.split("|")[0]
                            contents.append(content)

                item["packContents"] = contents
             
    def simplify_property(self,data):
        for item in data:
            properties = []
            if "property" in item:
                for prop in item["property"]:
                    name = prop.get("name",None)
                    if name:
                        properties.append(name)
                del item["property"]
                item["properties"] = properties

    def combine_charges(self,data):
        for item in data:
            recharge = item.get("recharge",None)
            rechargeAmount = item.get("rechargeAmount",None)
            charges = item.get("charges",None)

            charged = {
                "recharges_at":recharge,
                "amount":rechargeAmount,
                "max_charges":charges
            }

            if recharge or rechargeAmount or charges:
                item["charged"] = charged

            if recharge:
                del item["recharge"]
            if rechargeAmount:
                del item["rechargeAmount"]
            if charges:
                del item["charges"]

    def change_keyname(self,data):
        name_changes = {
            "critThreshold": "crit_at"
        }

        for item in data:
            for key,value in list(item.items()):
                if key in name_changes:
                    item[name_changes[key]] = value 
                    del item[key]

    def combine_vehicle_data(self, data):
        keys = [
            "crew",
            "vehAc",
            "vehHp",
            "vehSpeed",
            "capPassenger",
            "capCargo",
            "vehDmgThresh",
            "crewMin",
            "crewMax",
            "travelCost",
            "shippingCost",
        ]

        for item in data:
            if item.get("type") == "Vehicle":
                special = {}
                for key in list(item.keys()):
                    if key in keys:
                        special[key] = item.pop(key)

                if special:
                    item["special"] = special
                
    def combine_mount_data(self,data):
        keys = [
           "carryingCapacity",
            "speed",
        ]

        for item in data:
            if item.get("type") == "Mount":
                special = {}
                for key in list(item.keys()):
                    if key in keys:
                        special[key] = item.pop(key)

                if special:
                    item["special"] = special

    def combine_spell_damage(self,data):
        for item in data:
            if "bonusSpellDamage" in item:
                bonuses = item.get("bonuses",None)
                if bonuses:
                    item["bonuses"]["spellDamage"] = item["bonusSpellDamage"]
                    

                else:
                    item["bonuses"] = {"spellDamage":item["bonusSpellDamage"]}

                del item["bonusSpellDamage"]

    def combine_armor_shield_data(self, data):
        ARMOR_TYPES = {"Light Armor", "Medium Armor", "Heavy Armor"}

        for item in data:
            types = set(item.get("types") or [])
            is_armor = bool(types & ARMOR_TYPES)
            is_shield = "Shield" in types

            if not (is_armor or is_shield):
                continue

            # Preserve any existing special dict; merge new fields in.
            special = dict(item.get("special") or {})

            if is_armor:
                ac = item.pop("ac", None)
                strength = item.pop("strength", None)
                stealth = item.pop("stealth", None)

                if ac is not None:
                    special["base_ac"] = ac
                if strength is not None:
                    special["strength_requirement"] = strength
                if stealth is not None:
                    special["stealth_disadvantage"] = stealth

            if is_shield:
                ac = item.pop("ac", None)
                if ac is not None:
                    special["ac_bonus"] = ac

            if special:
                item["special"] = special

    def rehaul_tags_type_base(self, data):
        TAG_TO_TYPE = {"tattoo": "Tattoo", "poison": "Poison"}
        TAG_TO_BASEITEM = {"staff": "staff"}

        for item in data:
            # ── Promote singular `type` into `types` list ──
            old_type = item.pop("type", None)
            types = set(item.get("types") or [])
            if old_type:
                types.add(old_type)

            # ── Handle tags ──
            tags = item.pop("tags", None) or []
            for tag in tags:
                if tag in TAG_TO_TYPE:
                    types.add(TAG_TO_TYPE[tag])
                elif tag in TAG_TO_BASEITEM and not item.get("baseItem"):
                    item["baseItem"] = TAG_TO_BASEITEM[tag]

            # ── Promote `wondrous: true` into a type, then drop the field ──
            if item.pop("wondrous", None):
                types.add("Wondrous")

            # ── Write the deduped, sorted types list ──
            if types:
                item["types"] = sorted(types)


    

    def _parse_damage_string(self, s):
        """
        Parse a damage string into {amount, dice, mod} components.
        Accepts: '2d6', '1d8+1', '1d4 + 2', '1' (flat), '2D6' (case-insensitive).
        Returns None if unparseable. At least one of {dice, mod} must be present.
        """
        s = s.strip()

        # Pure number: "1", "3"
        if re.fullmatch(r"\d+", s):
            return {"mod": int(s)}

        # Dice with optional mod: "2d6", "1d8+2", "1d4 + 1"
        m = re.fullmatch(r"(\d+)(d\d+)(?:\s*\+\s*(\d+))?", s, re.IGNORECASE)
        if m:
            result = {
                "amount": int(m.group(1)),
                "dice": m.group(2).lower(),
            }
            if m.group(3):
                result["mod"] = int(m.group(3))
            return result

        return None
  
    def compact_damage(self, data):
        # Matches: "2d6", "2d6+1", "1d4 + 1", "1", "3"
        # DAMAGE_PATTERN = re.compile(
        # r"^\s*(?:(\d+)(d\d+))?\s*(?:\+\s*(\d+))?\s*$|^\s*(\d+)\s*$",
        # re.IGNORECASE,
        # )
        failed = []

        for item in data:
            dmg1 = item.pop("dmg1", None)
            dmg_type = item.pop("dmgType", None)
            item.pop("dmg2", None)

            if dmg1 is None:
                if dmg_type is not None:
                    failed.append({
                        "name": item.get("name"),
                        "reason": "dmgType without dmg1",
                        "dmgType": dmg_type,
                    })
                continue

            damage = {}
            if dmg_type:
                damage["type"] = dmg_type.lower()

            parsed = self._parse_damage_string(str(dmg1))
            if parsed is None:
                damage["raw"] = dmg1
                failed.append({
                    "name": item.get("name"),
                    "reason": "could not parse dmg1",
                    "dmg1": dmg1,
                })
            else:
                damage.update(parsed)

            if damage:
                item["damage"] = damage

        if failed:
            print(f"Damage migration: {len(failed)} parsing issues:")
            for f in failed[:20]:
                print(f"  {f['name']}: {f['reason']} — {f}")
            if len(failed) > 20:
                print(f"  ... and {len(failed) - 20} more")


    def run_phase2(self):
        more_removable_keys = [
            "reqAttuneTags",
            "category",
            "grantsProficiency",
            "grantsLanguage",
            "valueRarity",
            "barDimensions",
            "valueExpression",
            "nameSuffix",
            "nameRemove",
            "weightMult",
            "weightExpression",
            "valueMult",
            "barding",
            "_cleaned"
        ]

        loadpath = os.path.join(self.output_path,"all_items")
        data = self.filehandler.load_json(loadpath)

        for item in data:
            for key in list(item.keys()):
                if key in more_removable_keys:
                    del item[key]

        self.combine_type_groups(data)
        self.split_string(data)
        self.simplify_property(data)
        self.combine_charges(data)

        self.clean_mastery(data)
        self.clean_pack_contents(data)
        self.change_keyname(data)
        self.combine_vehicle_data(data)
        self.combine_mount_data(data)
        self.combine_spell_damage(data)
        self.rehaul_tags_type_base(data)
        self.combine_armor_shield_data(data)
        self.compact_damage(data)



        # self.track_toplevel_keywords(data)
        # self.gather_generic_variants(data)
        # self.get_string_values(data,"baseItem")

        savepath = os.path.join(self.output_path,"all_items")
        self.filehandler.save_json(savepath,data)


    def run_LLM_cleaning(self):
        data_path = os.path.join(self.output_path,"all_items")
        data = self.filehandler.load_json(data_path)

        instructions_path = os.path.join(self.instructions_path,"clean_sort_entries_types.md")
        instructions = self.filehandler.load_md(instructions_path)
        open_ai = OpenAIApi()
        # 213 generic variants 
        
        for item in data:
            type = item.get("type",None)
            if type: 
                if type == "Generic Variant" and not item.get("_cleaned"):
                    name = item.get("name",None)
                    entries = item.get("entries",None)

                    print(f"{item['name']}")

                    payload = {
                        "name": name,  
                        "entries": entries,    
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
                        text_format=CleanedGenericItem,
                        timeout= 120.0,
                    )

                    new_types = response["types"]
                    new_types.append("Generic Variant")
                    del item["type"]
                    cleaned_entries = response["entries"]

                    item["types"] = new_types
                    item["entries"] = [{"text": cleaned_entries}]
                    item["_cleaned"] = True

                    self.filehandler.save_json(data_path,data)


    # ---------- Phase 3 -------------

    @staticmethod
    def _normalize_charge_value(value):
        DICE_TAG_PATTERN = re.compile(r"^\s*\{@dice\s+(.+?)\}\s*$")

        # Matches either "NdX [+|- N]" (dice with optional mod) or pure integer "N".
        DICE_VALUE_PATTERN = re.compile(
            r"^\s*(\d+)\s*(d\d+)\s*(?:([+-])\s*(\d+))?\s*$"
            r"|"
            r"^\s*(\d+)\s*$"
        )
        empty = {"fixed": None, "roll": None}

        # Already in the new shape.
        if isinstance(value, dict) and ("fixed" in value or "roll" in value):
            return value

        if value is None:
            return empty

        if isinstance(value, int):
            return {"fixed": value, "roll": None}

        if not isinstance(value, str):
            return empty

        s = value.strip()
        if not s:
            return empty

        # Strip the {@dice ...} wrapper if present.
        m = DICE_TAG_PATTERN.match(s)
        if m:
            s = m.group(1).strip()
            if "|" in s:  # 5etools display alias form: "1d8|d8"
                s = s.split("|", 1)[0].strip()

        m = DICE_VALUE_PATTERN.match(s)
        if not m:
            return None

        amt, die, sign, mod, flat = m.groups()

        # Pure integer string → fixed.
        if flat is not None:
            return {"fixed": int(flat), "roll": None}

        # Dice expression → roll.
        mod_int = 0
        if mod is not None:
            mod_int = int(mod)
            if sign == "-":
                mod_int = -mod_int

        return {
            "fixed": None,
            "roll": {
                "die_type": die,
                "dice_amount": int(amt),
                "mod": mod_int,
            },
        }

    def run_phase3(self):
        loadpath = os.path.join(self.output_path,"all_items")
        data = self.filehandler.load_json(loadpath)

        failures = []
        items = data.values() if isinstance(data, dict) else data

        for item in items:
            charged = item.get("charged")
            if not isinstance(charged, dict):
                continue

            for key in ("amount", "max_charges"):
                original = charged.get(key)
                normalized = self._normalize_charge_value(original)

                if normalized is None:
                    failures.append((item.get("name"), key, original))
                    charged[key] = {"fixed": None, "roll": None}
                else:
                    charged[key] = normalized

        if failures:
            print(f"run_phase3: {len(failures)} unparseable charge values:")
            for name, field, val in failures:
                print(f"  {name!r}.charged.{field} = {val!r}")
        else:
            print("run_phase3: charges normalized cleanly.")

        savepath = os.path.join(self.output_path,"items_phase3")
        self.filehandler.save_json(savepath,data)



               
                    
if __name__ == "__main__":
    cleaner = ItemCleaner()
    
    # cleaner.run()
    # cleaner.run_phase3()

    # cleaner.run_LLM_cleaning()

   