import os
from file_handler import FileHandler
from open_ai_api import OpenAIApi


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


        self.renamable_keywords = {
            "hd":"hit_dice",
            "proficiency":"saving_throw_proficiency",
        }

    


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

            save_path = os.path.join(self.output_path,name)
            self.file_handler.save_json(save_path,data)



if __name__ == "__main__":
    cleaner = ClassCleaner()    
    cleaner.run_cleaning()
    