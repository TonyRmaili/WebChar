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
       
        self.class_paths = {}
        for file in os.listdir(self.raw_classes_path):
            name, ext = os.path.splitext(file)
            self.class_paths[name] = os.path.join(self.raw_classes_path,name)
        
        # constants
        self.unique_sources = {}



    def _remove_toplevel_key(self,keyname,class_data):
        try:
            del class_data[keyname]
        except KeyError:
            pass

        return class_data

    def extract_unique_sources(self, class_data):
        unique_sources = []
        
        for key, value in class_data.items():

            for obj in value:
                source = obj["source"]
                if source not in unique_sources:
                    unique_sources.append(source)
        
        return unique_sources

    
    
    

    def run_cleaning(self):
        for name, path in self.class_paths.items():
            data = self.file_handler.load_json(path)
            sources = self.extract_unique_sources(class_data= data)
            self.unique_sources[name] = sources



        


if __name__ == "__main__":
    cleaner = ClassCleaner()    
    cleaner.run_cleaning()