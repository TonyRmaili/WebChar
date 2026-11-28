import json
from pathlib import Path
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

    # Pictures (and any other file that isn't text) are bytes, not
    # characters: "wb" / "rb" open the file in binary mode, so nothing is
    # changed on the way (no encoding, no line endings).
    def save_bytes(self, filepath, data: bytes):
        with open(filepath, "wb") as f:
            f.write(data)

    def load_bytes(self, filepath) -> bytes:
        with open(filepath, "rb") as f:
            return f.read()


        
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