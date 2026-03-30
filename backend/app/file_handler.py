import os
import json


class FileHandler:
    def __init__(self):
        pass

    
    def load_json(self,filepath):
        file = filepath+".json"
        with open(file,encoding="utf-8") as f:
            data = json.load(f)
        return data

    def save_json(self,filepath,data):
        file = filepath+".json"
        with open(file,"w",encoding="utf-8") as f:
            json.dump(data,f,indent=4,ensure_ascii=False)
        



if __name__=="__main__":
    pass