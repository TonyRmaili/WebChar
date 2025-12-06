import os 
import fitz 
import json
import time, random, string

from dotenv import load_dotenv
from openai import OpenAI
from .schemas.classes import GeneralStats, FeatureList
from .schemas.monsters import MonsterBase

import re
from collections import OrderedDict
from pathlib import Path

class DataHandler:
    def __init__(self):
        # setup
        load_dotenv(override=True)
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(
            api_key=self.api_key
        )

        # templates
        self.user_input = [{"role": "user","content": f""}]
        self.assistant_input = [{"role": "assistant","content": f""}]
        self.system_input = [{"role": "system","content": f""}]
        
        self.reasoning = {"effort" : f""}

        # AI data
        self.models = ["gpt-5-mini"]

        # base paths
        # self.raw_data_path = "AIdata/5etools_data/raw/"
        # self.cleaned_data_path = "AIdata/5etools_data/cleaned/"
        # self.instructions_path = "AIdata/instructions/"

        self.raw_data_path = "5etools_data/raw/"
        self.cleaned_data_path = "5etools_data/cleaned/"
        self.instructions_path = "instructions/"



        self.output_path = "outputs/"
        self.pdf_path = os.path.join(self.output_path,"pdf_extracts")

       
        self.SECTION_RE = re.compile(r'^\{([A-Z_ ]+)\}\s*$', re.MULTILINE)
        self.DOC_START_RE = re.compile(r'^===== DOC_START =====\s*$', re.MULTILINE)
        self.DOC_END_RE   = re.compile(r'^===== DOC_END =====\s*$', re.MULTILINE)

        # constants

        self.CR_STATS = {
        "0":  {"xp": 10,     "pb": 2},
        "1/8": {"xp": 25,     "pb": 2},
        "1/4": {"xp": 50,     "pb": 2},
        "1/2": {"xp": 100,    "pb": 2},

        "1":  {"xp": 200,    "pb": 2},
        "2":  {"xp": 450,    "pb": 2},
        "3":  {"xp": 700,    "pb": 2},
        "4":  {"xp": 1100,   "pb": 2},

        "5":  {"xp": 1800,   "pb": 3},
        "6":  {"xp": 2300,   "pb": 3},
        "7":  {"xp": 2900,   "pb": 3},
        "8":  {"xp": 3900,   "pb": 3},

        "9":  {"xp": 5000,   "pb": 4},
        "10": {"xp": 5900,   "pb": 4},
        "11": {"xp": 7200,   "pb": 4},
        "12": {"xp": 8400,   "pb": 4},

        "13": {"xp": 10000,  "pb": 5},
        "14": {"xp": 11500,  "pb": 5},
        "15": {"xp": 13000,  "pb": 5},
        "16": {"xp": 15000,  "pb": 5},

        "17": {"xp": 18000,  "pb": 6},
        "18": {"xp": 20000,  "pb": 6},
        "19": {"xp": 22000,  "pb": 6},
        "20": {"xp": 25000,  "pb": 6},

        "21": {"xp": 33000,  "pb": 7},
        "22": {"xp": 41000,  "pb": 7},
        "23": {"xp": 50000,  "pb": 7},
        "24": {"xp": 62000,  "pb": 7},

        "25": {"xp": 75000,  "pb": 8},
        "26": {"xp": 90000,  "pb": 8},
        "27": {"xp": 105000, "pb": 8},
        "28": {"xp": 120000, "pb": 8},

        "29": {"xp": 135000, "pb": 9},
        "30": {"xp": 155000, "pb": 9},
    }

        self.class_pagenumbers = {
            "barbarian":[50,56],
            "bard":[58,66],
            "cleric":[68,76],
            "druid":[78,88],
            "fighter":[90,98],
            "monk":[100,106],
            "paladin":[108,116],
            "ranger":[118,126],
            "rogue":[128,136],
            "sorcerer":[138,150],
            "warlock":[152,162],
            "wizard":[164,174],
        }


    # ---------- PDF Methods
    def extract_pdf_pages(self,path):
        document = fitz.open(path+".pdf")
        all_pages = []
        for page_num in range(document.page_count):
            page = document.load_page(page_num)
            text = page.get_text("text")
            all_pages.append({"text":text, "page_num":(page_num+1)})
        return all_pages

    def chunk_pages(self,all_pages,chunk_size,overlap)->list:
        chunked_pages = []
        carry_over = []
        start_page = None
        end_page = None

        for data in all_pages:
            words = carry_over + data["text"].split()  # Include carry_over from previous page
            current_page_num = data["page_num"]
            start = 0

            if start_page is None:
                start_page = current_page_num  # Initialize start_page

            while start < len(words):
                end = min(start + chunk_size, len(words))

                chunk = ' '.join(words[start:end])
                end_page = current_page_num  # Update end_page to the current page number
                page_nums = (start_page, end_page) if start_page != end_page else (start_page,)
                chunked_pages.append({"chunk": chunk, "page_nums": page_nums})

                start += (chunk_size - overlap)

                # If end reaches the length of words, we prepare the carry_over for the next page
                if end == len(words):
                    carry_over = words[start:]
                    start_page = start_page if carry_over else None  # Keep start_page if there's carry_over
                    break

            if start >= len(words):
                carry_over = []
                start_page = None  # Reset start_page if no carry_over

        # Handle any remaining carry_over after the last page
        if carry_over:
            chunked_pages.append({"chunk": ' '.join(carry_over), "page_nums": (start_page, end_page)})

        return chunked_pages

    # ---------- AI Methods
    def openai_response(self,model,instructions,input,reasoning) -> str:
        # self.user_input["content"] = input
        self.reasoning["effort"] = reasoning

        response = self.client.responses.create(
            model=model,
            instructions=instructions,
            input=input,
            reasoning=self.reasoning,
            
        )

        return response.output_text

    def openai_parse(self,model,input,reasoning,text_format):
        self.reasoning["effort"] = reasoning

        response = self.client.responses.parse(
            model=model,
            input=input,
            reasoning=self.reasoning,
            text_format=text_format
        )
        parsed = response.output_parsed

        try:
            return parsed.model_dump()      
        except AttributeError:
            return parsed      

    def openai_embed(self):
        pass

    # ------ General Methods
    def combine_texts(self,input_path,output_path,output_filename):
        combined_doc = ""
        for filename in os.listdir(input_path):
            full_path = os.path.join(input_path, filename)
            if os.path.isfile(full_path):
                document = self.load_data(full_path)
                combined_doc += document
        save_path = os.path.join(output_path,output_filename)
        self.save_as_text(combined_doc,save_path)

    def remove_extension(self,file_name):
        base_name, _ = os.path.splitext(file_name)
        return base_name

    def load_json_data(self,path):
        with open(path,encoding="utf-8") as f:
            data = json.load(f)
        return data
    
    def load_data(self,path,encoding=False):
        if encoding:
            with open(path,encoding="utf-8") as f:
                data = f.read()
        else:
            with open(path) as f:
                data = f.read()
        return data

    def save_as_json(self,data,path,filename):
        os.makedirs(path,exist_ok=True)
        full_path = os.path.join(path,filename+".json")
        with open(full_path,"w",encoding="utf-8") as f:
            json.dump(data,f,indent=4,ensure_ascii=False)

    def save_as_text(self,data,path):
        with open(path,"w",encoding="utf-8") as f:
            f.write(data)

    def base36(self,n: int) -> str:
        chars = "0123456789abcdefghijklmnopqrstuvwxyz"
        if n == 0:
            return "0"
        s = ""
        while n > 0:
            n, r = divmod(n, 36)
            s = chars[r] + s
        return s

    def id_gen(self):
        ts = self.base36(int(time.time() * 1000))
        rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
        return f"{ts}-{rand}"

    # ---------- SPECIFIC METHODS

    def extract_doc_block(self,text: str) -> str:
        """Return only the block between DOC_START and DOC_END if present."""
        start = self.DOC_START_RE.search(text)
        end = self.DOC_END_RE.search(text)
        if start and end and end.start() > start.end():
            return text[start.end():end.start()].strip()
        return text.strip()

    def split_major_sections(self,text: str) -> OrderedDict:
        """
        Split text into sections delimited by lines like {FEATURES}.
        Returns an OrderedDict preserving file order.
        """
        body = self.extract_doc_block(text)
        sections = OrderedDict()
        matches = list(self.SECTION_RE.finditer(body))

        if not matches:
            return sections  # no headers found

        for i, m in enumerate(matches):
            name = m.group(1).strip()
            start = m.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
            content = body[start:end].strip()
            sections[name] = content

        return sections

    def split_file_by_sections(self,path: str | Path) -> OrderedDict:
        """Read file and split into dynamically detected sections."""
        text = Path(path).read_text(encoding="utf-8")
        return self.split_major_sections(text)

    def save_sections(self,sections: OrderedDict, out_dir: str | Path, prefix: str = "") -> None:
        """Save each section to <out_dir>/<prefix><section_name>.txt."""
        out = Path(out_dir)
        out.mkdir(parents=True, exist_ok=True)
        for name, content in sections.items():
            filename = f"{prefix}{name.replace(' ', '_')}.txt"
            Path(out, filename).write_text(content + "\n", encoding="utf-8")

    def append_regional_effects(self):
        monsters_path = os.path.join(self.raw_data_path,"monsters","mm2025.json")
        save_path = os.path.join(self.raw_data_path,"monsters")
        regional_path = os.path.join(self.raw_data_path,"monsters","legendaryGroups.json")
        monsters_data = self.load_json_data(path=monsters_path)
        extra_data = self.load_json_data(path=regional_path)
        extra_data = extra_data["legendaryGroup"]
        
        for monster in monsters_data["monster"]:
            try:
                if monster["legendaryGroup"]:
                    legendary_name = monster["legendaryGroup"]["name"]
                    source = monster["legendaryGroup"]["source"]
                    
                    for effect in extra_data:
                        if effect["source"] == source and effect["name"] == legendary_name:
                            monster["regional_effects"] = effect["regionalEffects"]
            except KeyError:
                continue
        
        self.save_as_json(data=monsters_data,path=save_path,filename="mm2025_regional_effects")

    def add_id_to_monster_effects(self,monster_data):
        try:
            for effects in monster_data["effects"].values():
                if not effects:
                    continue
                else:
                    for effect in effects:
                        if not effect:
                            continue

                        effect["id"] = self.id_gen()

                        if effect["damages"]:
                            for damage in effect["damages"]:
                                damage["id"] = self.id_gen()
                        
                        if effect["attack"]["damages"]:
                            for damage in effect["attack"]["damages"]:
                                damage["id"] = self.id_gen()

                        if effect["save"]["damages"]:
                            for damage in effect["save"]["damages"]:                             
                                damage["id"] = self.id_gen()
                        
            return monster_data

        except KeyError as e:
            print("something whent wrong: ",e)

    def score_to_mod(self,score):
        return (score - 10) // 2

    def add_init_pb_xp_to_monster(self,raw_monster_data,cleaned_monster_data):

        init_coeff = raw_monster_data.get("initiative", {}).get("proficiency", 0)
        cr = raw_monster_data["cr"]
        dex = raw_monster_data["dex"]
                
        dex_mod = self.score_to_mod(dex)
        pb = self.CR_STATS[cr]["pb"]
        xp = self.CR_STATS[cr]["xp"]

        initiative = dex_mod + init_coeff*pb

        cleaned_monster_data["pb"] = pb
        cleaned_monster_data["xp"] = xp
        cleaned_monster_data["initiative"] = initiative
        cleaned_monster_data["amount"] = 1

       
        return cleaned_monster_data

    # ----- LARGE METHODS

    def clean_pages_phase1(self,
                           page_range:tuple,
                           instructions_filename:str,
                           reasoning:str,
                           class_name:str
                           ):
        pdf_data = self.load_json_data(self.pdf_path)
        page_start = page_range[0]
        page_end = page_range[1]

        # for page in pdf_data[page_start:page_end]:
        #     print(page["page_num"])


        instructions_path = os.path.join(self.instructions_path,instructions_filename)
        instruction = self.load_data(path=instructions_path,encoding=True)
        key_dir = "phase1/"
        dir_path = os.path.join(self.output_path,class_name,key_dir)
        os.makedirs(dir_path,exist_ok=True)
        
        for i,page in enumerate(pdf_data[page_start:page_end]):
            resp = self.openai_response(
                model=self.models[0],
                instructions=instruction,
                input=page["text"],
                reasoning=reasoning
            )
            
            save_path = os.path.join(dir_path, f"page_{i+1:03}.md")
            self.save_as_text(data=resp,path=save_path)
            
    def clean_monster(self,raw_monsters_filename,instructions_filename,
                      monster_name,reasoning,
                      ):
        raw_monsters_path = os.path.join(self.raw_data_path,"monsters",raw_monsters_filename)
        raw_monsters_data = self.load_json_data(raw_monsters_path)
        raw_monsters_data = raw_monsters_data["monster"]
        
        instructions_path = os.path.join(self.instructions_path,instructions_filename)
        instructions_data = self.load_data(path=instructions_path,encoding=True)

        for raw_monster in raw_monsters_data:
            if raw_monster["name"] == monster_name:
                selected_monster = raw_monster
        
        input=[
        {"role": "system", "content": instructions_data},
        {"role": "user", "content": json.dumps(selected_monster)}
        ]


        cleaned_monster = self.openai_parse(
            model=self.models[0],
            input=input,
            reasoning=reasoning,
            text_format=MonsterBase
        )

        subfolder_name, _ = os.path.splitext(raw_monsters_filename)
        clean_monsters_path = os.path.join(self.cleaned_data_path,"monsters",subfolder_name)
        os.makedirs(clean_monsters_path,exist_ok=True)

    
        cleaned_monster = self.add_id_to_monster_effects(monster_data=cleaned_monster)
        cleaned_monster = self.add_init_pb_xp_to_monster(raw_monster_data=selected_monster,cleaned_monster_data=cleaned_monster)

        self.save_as_json(data=cleaned_monster,path=clean_monsters_path,filename=monster_name)

        return cleaned_monster

    # ------- Clean Class Methodsx------------

    def extract_class_by_pages(self,class_name):
        path = os.path.join(self.pdf_path,"players_handbook_new.json") 
        pdf_data = self.load_json_data(path)

        start_page, end_page = self.class_pagenumbers[class_name]
        start_page -= 1

        pages = []

        for page in pdf_data[start_page:end_page]:
            pages.append(page["text"])

        return pages
    
    def clean_class_p1(self,class_name):
        pages = self.extract_class_by_pages(class_name=class_name)
        instructions_path = os.path.join(self.instructions_path,"classes","clean_classes_phase01.md")
        instructions = self.load_data(path=instructions_path,encoding=True)

        save_path = os.path.join(self.cleaned_data_path,"classes",class_name,"cleaned_pages")
        os.makedirs(save_path,exist_ok=True)

        for i,page in enumerate(pages):
            input = [
            {"role":"user",
             "content":page}
            ]   
            cleaned_page = self.openai_response(
                model=self.models[0],
                instructions=instructions,
                input=input,
                reasoning="high"
            )

            save_filename = f"page_{i+1:02}.md"
            full_path = os.path.join(save_path,save_filename)
            self.save_as_text(data=cleaned_page,path=full_path)


if __name__=="__main__":
    handler = DataHandler()
    
    start = time.perf_counter()

    handler.clean_class_p1(class_name="barbarian")

    end = time.perf_counter()
    elapsed_minutes = (end - start) / 60
    print(f"Elapsed time: {elapsed_minutes:.2f} minutes")


    



    

