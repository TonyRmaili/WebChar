from openai import OpenAI
import ollama
import faiss
import os
import json
from dotenv import load_dotenv
from pdf_handler import PdfHandler
from random import randint


class Conversation:
    def __init__(self,syste_role,init_quary):
        load_dotenv()
        self.client = OpenAI(
            api_key= os.getenv("OPENAI_API_KEY")
        )
        self.log_path = "./conversation_log/"

       
        self.role_system = {
            "role":"system",
            "content": syste_role
            
        }
        self.quary = {
            "role":"user",
            "content":init_quary
        }
        self.response = {
            "role":"assistant",
            "content":[
                
            ]
        }


        self.messages = [
            self.role_system,
            self.quary
        ]


    def save_log(self,file_name):
        path = self.log_path+file_name
        with open(path) as f:
            json.dump(self.messages,f,indent=4)

if __name__ == "__main__":

    text = PdfHandler("players_handbook_5e")
    text = text.load_chunks()
    text = text[67]["chunk"]

    
    conv = Conversation(
        syste_role= '''You are a game rule interpreter, 
        prepared to answer any questions from the retrived text or 
        summarize the text if no question is asked.
        ''',
        init_quary= text
    )

    print(conv.messages)