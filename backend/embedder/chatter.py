from openai import OpenAI
import ollama
import faiss
import os
import json
from dotenv import load_dotenv
from pdf_handler import PdfHandler
from random import randint


class Conversation:
    def __init__(self):
        load_dotenv()
        self.client = OpenAI(
            api_key= os.getenv("OPENAI_API_KEY")
        )

        self.pdf = PdfHandler("players_handbook_5e")
        self.chunks = self.pdf.load_chunks()
        self.chunk = self.chunks[46]["chunk"]
        
        self.log_path = "./conversation_log/"
        

        self.assistant_role = {
            "role": "system", 
            "content": "You are a game rule interpreter that summaries chunks of game rules based on the query"}

        with open("model_dump.json", "r") as f:
            self.model_dump = json.load(f)
        
        self.model = "gpt-4o-mini"

    def chat(self,messages):
        
        assistant_resp = '''
    In the context of a fantasy game, various races experience differing social perceptions:

1. **Half-Elf**: Generally viewed with curiosity and intrigue. Their arrival sparks gossip and furtive glances, but typically does not provoke direct confrontation or overt questions from others.      

2. **Half-Orc**: Often assumed to be aggressive and prone to violence. People exhibit caution around half-orcs, with shopkeepers taking precautions to protect goods and patrons leaving taverns to avoid potential conflicts.

3. **Tiefling**: Faces a significant social stigma rooted in fear due to their infernal heritage. Their appearance triggers instinctive reactions, such as making protective signs or avoiding proximity, and shops may refuse them entry altogether.

Each race influences interactions differently, affecting how characters navigate social environments within the game.
'''

        sec_ass_resp = '''
Determining which race is "better" among half-elves, half-orcs, and tieflings depends on the context of the game and the player's goals. Each race has its unique traits and characteristics:

1. **Half-Elf**: Typically benefit from versatility, often having a mix of human adaptability and elven grace. They usually possess enhanced charisma and the ability to adapt to various roles or classes. Their social acceptance, although mixed, allows for easier integration into various groups.

2. **Half-Orc**: Generally favored for their physical prowess and resilience, making them formidable in combat. Their association with aggression can offer storytelling opportunities, and they often excel in melee roles. However, their social stigma may lead to challenges in interactions.

3. **Tiefling**: Often characterized by strong magical abilities and charisma, tieflings are well-suited for spellcasting classes. Their unique heritage can create intriguing narrative possibilities, though their social stigma may lead to avoidance or hostility from others.

Ultimately, the "better" race will vary depending on individual playstyle, character build preferences, and the narrative tone of the campaign. Players should consider their desired role and how each race's strengths align with their character concept.
'''

        # messages = [
        #     self.assistant_role,
        #     {"role":"user","content":self.chunk},
        #     {"role":"assistant","content":assistant_resp},
        #     {"role":"user","content":"which race is better of the ones mentioned?"},
        #     {"role":"assistant","content":sec_ass_resp},
        #     {"role":"user","content":"who has the worst social stigma?"}
        # ]
        
        resp = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
        
        )

        resp = resp.choices[0].message.content
        return resp

    def load_messages(self):
        if not os.path.exists(self.log_path+"messages.json"):
            messages = [
                self.assistant_role,
            ]
            with open(self.log_path+"messages.json",'w') as f:
                json.dump(messages,f,indent=4)

        with open(self.log_path+"messages.json") as f:
                messages= json.load(f)
        
        return messages

    def adv_chat(self,prompt):
        messages = self.load_messages()
        prompt = {"role":"user","content":[
                {"type":"text","text":prompt},
                {"type":"text","text":self.chunk}
        ]}
        messages.append(prompt)
        # response = self.client.chat.completions.create(
        #     model=self.model,
        #     messages=messages
        # )
        # response = response.choices[0].message.content
        return messages




if __name__ == "__main__":
    con = Conversation()
    print(con.adv_chat("question"))

