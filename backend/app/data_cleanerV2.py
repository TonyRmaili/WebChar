
from file_handler import FileHandler
import os

class DataCleaner:
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
            'page',
            'hasFluffImages',
            'referenceSources',
            'srd',
            'srd52',
            'basicRules2024',
            'classFeatures',
            'basicRules',
            'miscTags', 
            'detail1', 
            'hasRefs',
            'hasFluff',
            'optionalfeatures',
            'scfType',
            'seeAlsoVehicle', 
            'atomicPackContents',
            'otherSources', 
            'additionalSources', 
            'alias',
            'seeAlsoDeck',
            'valueRarity',
            'barDimensions',
            'reqAttuneAlt',
            'typeAlt',
            'detail2',
            'dexterityMax',
            'weightNote'
            ]

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

    def item_keyword_tracker(self,filename,raw_in,raw_out,save_filename):
        data = self.load_items(filename,raw_in)
        key_words = []

        # data = data["item"]
        for item in data:
            for key in item.keys():
                if key not in key_words:
                    key_words.append(key)

        if raw_out:
            save_path = os.path.join(self.raw_items_path,save_filename)
        else:
            save_path = os.path.join(self.cleaned_items_path,save_filename)

        FileHandler().save_json(save_path,key_words)

    def remove_item_key(self,keyword):
        filename = "items_removed_keys"
        path = os.path.join(self.raw_items_path, filename)
        data = FileHandler().load_json(path)

        

        for item in data:
            for key in list(item.keys()):
                if key == keyword:
                    del item[key]

        save_path = os.path.join(self.raw_items_path,"items_removed_keys")
        FileHandler().save_json(save_path,data)


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
    


    def run_item_cleaning(self):
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

        self.translate_item_type(all_items)
        self.translate_item_property(all_items)
        self.translate_damage_type(all_items)
        

        save_path = os.path.join(self.raw_items_path, "all_items")
        FileHandler().save_json(save_path,all_items)


if __name__ == "__main__":
    cleaner = DataCleaner()
    # cleaner.combine_item_data()

    # cleaner.item_keyword_tracker(
    #     "all_items",
    #     True,
    #     True,
    #     "keywords"
    #     )

    cleaner.run_item_cleaning()