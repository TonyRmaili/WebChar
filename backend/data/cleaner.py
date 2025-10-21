import os 
import time
from dotenv import load_dotenv
from openai import OpenAI
from schemas.monsters import MonsterBase
import json
from pydantic import BaseModel


class Cleaner:
    def __init__(self):
        # setup
        load_dotenv(override=True)
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.client = OpenAI(
            api_key=self.api_key
        )

        # paths

        self.output_path = "outputs/"
        self.data_path = "5etools_data/"
        self.instructions_path = "instructions/"


    def load_instruction(self):
        path = "system_prompts/"
        filename = "clean_monsterblock.md"

        fullpath = os.path.join(path,filename)
        with open(fullpath ,encoding="utf-8") as f:
            data = f.read()

        return data
    

    def load_monster(self):
        path = "../app/database/monsters/mm2025.json"
        with open(path) as f:
            data = json.load(f)
        return data
    

    def chat(self,model,instructions,input,reasoning,text_format):
        response = self.client.responses.parse(
            model=model,
            instructions=instructions,
            input=input,
            reasoning=reasoning,
            text_format=text_format
        )
        parsed = response.output_parsed


        try:
            return parsed.model_dump()      # dict
        except AttributeError:
            return parsed      



if __name__ == '__main__':
    cleaner = Cleaner()

    instructions = cleaner.load_instruction()
    monsters = cleaner.load_monster()
    monster = monsters["monster"][69]

    input = [{
            "role": "user",
            "content": f"{monster}",
        }]
    
    cleaned_monster = cleaner.chat(
        model="gpt-5-mini",
        instructions=instructions,
        input=input,
        reasoning={ "effort": "high" },
        text_format=MonsterBase
    )

    savepath = "outputs/monster1.json"
    with open(savepath,"w") as f:
        json.dump(cleaned_monster,f,indent=4)