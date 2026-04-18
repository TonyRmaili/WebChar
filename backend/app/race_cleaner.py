from file_handler import FileHandler
from open_ai_api import OpenAI
import os

class RaceCleaner:
    def __init__(self):
        self.data_path = "../AIData"
        self.instructions_path = os.path.join(self.data_path,"instructions")
        self.five_Etools_data_path = os.path.join(self.data_path,"5etools_data")
        self.raw_data_path = os.path.join(self.five_Etools_data_path,"raw","races")
        self.cleaned_data_path = os.path.join(self.five_Etools_data_path,"cleaned","races")


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

        ]

    def track_keywords(self,race_data,subrace_data):
        race_keywords = []
        subrace_keywords = []


        for race in race_data:
            for key in race.keys():
                if key not in race_keywords:
                    race_keywords.append(key)

        for subrace in subrace_data:
            for key in subrace.keys():
                if key not in subrace_keywords:
                    subrace_keywords.append(key)


        keywords = {
            "races":race_keywords,
            "subraces":subrace_keywords
        }
        savepath = os.path.join(self.raw_data_path,"keywords")
        self.file_handler.save_json(savepath,keywords)

    def load_races(self):
        filepath = os.path.join(self.raw_data_path,"races")
        data = self.file_handler.load_json(filepath)

        race_data = data["race"]
        subrace_data = data["subrace"]

        return {
            "races":race_data,
            "subraces":subrace_data
        }

    def remove_keywords(self,race_data,subrace_data):
        for race in race_data:
            for key in list(race.keys()):
                if key in self.removable_keywords:
                    del race[key]

        for subrace in subrace_data:
            for key in list(subrace.keys()):
                if key in self.removable_keywords:
                    del subrace[key]

         
    def run(self):
        data = self.load_races()
        race_data = data["races"]
        subrace_data = data["subraces"]


        self.remove_keywords(race_data,subrace_data)
        self.track_keywords(race_data,subrace_data)


        all_races = {"race_data":race_data,
                     "subrace_data":subrace_data}
        
        savepath = os.path.join(self.cleaned_data_path,"all_races")
        self.file_handler.save_json(savepath,all_races)



if __name__ == "__main__":
    cleaner = RaceCleaner()
    
    cleaner.run()