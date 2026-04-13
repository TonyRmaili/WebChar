import json
from pathlib import Path

class FileHandler:
    
    def load_json(self,filepath):
        file = filepath+".json"
        with open(file,encoding="utf-8") as f:
            data = json.load(f)
        return data

    def load_md(self,filepath):
        with open(filepath, encoding="utf-8") as f:
            data = f.read()
        return data

    def save_json(self,filepath,data):
        file = filepath+".json"
        with open(file,"w",encoding="utf-8") as f:
            json.dump(data,f,indent=4,ensure_ascii=False)


        
    def build_dir_tree(self, path: Path):
        if path.is_file():
            content = self.load_md(str(path))
            return {
                "name": path.name,
                "type": "file",
                "path": str(path),
                "content": content
            }

        return {
            "name": path.name,
            "type": "folder",
            "path": str(path),
            "children": [self.build_dir_tree(child) for child in path.iterdir()]
        }

 
if __name__=="__main__":
    pass