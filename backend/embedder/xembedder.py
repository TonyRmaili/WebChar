import faiss
import ollama
import numpy as np
import os
import re
import json
import pymupdf as pdf
import time
from dotenv import load_dotenv
from openai import OpenAI
from pdf_handler import PdfHandler

class Embedder:
    def __init__(self,pdf_name,model):
        # init env variables and api key
        load_dotenv()
        self.pdf_name = pdf_name # without .json
        self.chunks = PdfHandler(self.pdf_name+".pdf").load_chunks()
        

        self.client = OpenAI(
            api_key= os.getenv("OPENAI_API_KEY")
        )
        # paths 
        self.database_path = "./vector_dbs/"
        self.game_rules_path = "./game_rules/"
        self.summaries_path = "./summaries/"

        #embedder dimensions models
        self.nomic = {"model":"nomic-embed-text",
                      "dim":768, "index":"nomic/"
                      }
        
        self.llama3 = {"model":"llama3",
                      "dim":4096, "index": "llama3/"
                      }
        

        self.text_small = {"model":"text-embedding-3-small",
                      "dim":1536, "index":"text_small/"  
                      }
        
        self.text_large = {"model":"text-embedding-3-large",
                      "dim":3072,  "index":"text_large/"
                      }

        self.models = [self.nomic,self.llama3,self.text_small,self.text_large]


        for name in self.models:
            if model == name["model"]:
                self.model = name

        self.path = self.database_path + self.model["index"] + self.pdf_name

        self.load_index()

    def load_index(self):
        # Create directories if they don't exist
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        
        if os.path.exists(self.path):
            self.index = faiss.read_index(self.path)
        else:
            self.index = faiss.IndexFlatIP(self.model["dim"])
            faiss.write_index(self.index, self.path)

    def embed_chunks(self):
        for chunk in self.chunks:
            text = chunk["chunk"]
            text = text.replace("\n", " ")

            if self.model == self.text_small or self.model == self.text_large:
                response = self.client.embeddings.create(input= text,model=self.model["model"]).data[0].embedding
                embedding = np.array(response).astype("float32").reshape(1,-1)

            else:
                response = ollama.generate(model=self.model["model"],prompt=text)
                embedding = np.array(response["embedding"]).astype("float32").reshape(1,-1)
            
            self.index.add(embedding)
        
        faiss.write_index(self.index,self.path)
       
    
    def query(self,prompt, k=4):
        self.prompt = prompt
        if self.model == self.text_small or self.model == self.text_large:
            response = self.client.embeddings.create(input= prompt,model=self.model["model"]).data[0].embedding
            embedding = np.array(response).astype("float32").reshape(1,-1)

        else:
            response = ollama.embeddings(model=self.model["model"],prompt=prompt)
            embedding = np.array(response["embedding"]).astype("float32").reshape(1,-1)

        D, I = self.index.search(embedding,k)
        self.I = I
        return D, I
        
    def get_summary(self):
        model = "gpt-4o-mini"
        chunks = []
        for i in self.I[0]:
            chunk = {"type":"text","text":self.chunks[i]["chunk"]}
            chunks.append(chunk)

        messages = [
            {"role": "system", "content": "You are a game rule interpreter that summaries chunks of game rules based on the quary"},
            {"role":"user","content":[
                {"type":"text", "text":self.prompt},
                *chunks
            ]}
        ]
        
        response = self.client.chat.completions.create(
            model=model,
            messages=messages
        )
        response = response.choices[0].message.content
        return response

    
        
if __name__ == "__main__":
    text_small = "text-embedding-3-small"
    text_large = "text-embedding-3-large"
    nomic = "nomic-embed-text"
    emb = Embedder(pdf_name="players_handbook_5e",
                   model=text_large)
    D,I =emb.query(prompt="how to create a new character?")
    print(D,I)


    
    summary = emb.get_summary()
    print(summary)
    

    # chunks = emb.chunks
    # emb.embed_chunks()
    # print(emb.index.ntotal)
    
