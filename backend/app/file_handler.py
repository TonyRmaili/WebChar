import json
from pathlib import Path
from fastapi import HTTPException
import re

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
    
    def save_md(self,filepath,data):
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(data)


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


    def unique_destination(self,target: Path) -> Path:
        """Append (1), (2), ... to the stem until the path doesn't exist."""
        if not target.exists():
            return target
        stem = target.stem if target.suffix else target.name
        suffix = target.suffix
        parent = target.parent
        counter = 1
        while True:
            candidate = parent / f"{stem} ({counter}){suffix}"
            if not candidate.exists():
                return candidate
            counter += 1


    def validate_campaign_path(self,savefiles_path, user_name: str, path: Path) -> Path:
        """Ensure path is inside this user's campaigns dir. Returns resolved path."""
        user_root = (Path(savefiles_path) / user_name / "campaigns").resolve()
        resolved = path.resolve()
        try:
            resolved.relative_to(user_root)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid path")
        return resolved


    def same_subtree(self,savefiles_path,user_name: str, a: Path, b: Path) -> bool:
        """True if both paths are on the same side of the prompts/ boundary."""
        user_root = (Path(savefiles_path) / user_name / "campaigns").resolve()
        a_rel = a.resolve().relative_to(user_root).parts
        b_rel = b.resolve().relative_to(user_root).parts
        # parts[0] = campaign name, parts[1] = "prompts" or something else
        a_in_prompts = len(a_rel) > 1 and a_rel[1] == "prompts"
        b_in_prompts = len(b_rel) > 1 and b_rel[1] == "prompts"
        return a_in_prompts == b_in_prompts

    def slugify_response(self,content: str, max_len: int = 50) -> str:
        """First line of content → markdown-stripped slug for filenames."""
        first_line = content.strip().split("\n", 1)[0]
        # Strip common markdown: **bold**, *italic*, `code`, #, >, -, [link](url)
        cleaned = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", first_line)  # links
        cleaned = re.sub(r"[*_`#>\-]+", " ", cleaned)                   # markers
        cleaned = re.sub(r"[^a-zA-Z0-9\s]+", " ", cleaned)              # other punct
        slug = re.sub(r"\s+", "-", cleaned).strip("-").lower()
        return (slug[:max_len] or "response")



 
if __name__=="__main__":
    pass