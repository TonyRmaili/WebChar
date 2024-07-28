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
        
        if self.model == self.text_small or self.model == self.text_large:
            response = self.client.embeddings.create(input= prompt,model=self.model["model"]).data[0].embedding
            embedding = np.array(response).astype("float32").reshape(1,-1)

        else:
            response = ollama.embeddings(model=self.model["model"],prompt=prompt)
            embedding = np.array(response["embedding"]).astype("float32").reshape(1,-1)

        D, I = self.index.search(embedding,k)

        return D, I
        
    
        


    def open_ai_emb_quary_large(self,text):
        text = text.replace("\n", " ")
        response = self.client.embeddings.create(input = text, model=self.model_openai_large).data[0].embedding
        embedding = np.array(response).astype("float32")
        if embedding.shape[0] != self.d_text_embedder_large:
            raise ValueError(f'Embedding dimension mismatch: expected {self.d_text_embedder_large}, got {embedding.shape[0]}')
        embedding = embedding.reshape(1,-1)
        return embedding
    
    def openai_chat(self):
        completion = self.client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a poetic assistant, skilled in explaining complex programming concepts with creative flair."},
            {"role": "user", "content": "Compose a poem that explains the concept of recursion in programming."}
        ]
        )

        print(completion.choices[0].message)

        
    
        
if __name__ == "__main__":
    text_small = "text-embedding-3-small"
    text_large = "text-embedding-3-large"
    nomic = "nomic-embed-text"
    emb = Embedder(pdf_name="players_handbook_5e",
                   model=nomic)
    D,I =emb.query(prompt="To do so, you can take the Ready action on your turn so that you can act later in the round using your reaction. First, you decide what perceivable circum stance will trigger your reaction. Then, you choose the action you will take in response to that trigger, or you choose to move up to your speed in response to it. Examples include “If the cultist steps on the trapdoor, I’ll pull the lever that opens it,” and “If the goblin steps next to me, I move away.” W hen the trigger occurs, you can either take your reaction right after the trigger finishes or ignore the trigger. Rem em ber that you can take only one reaction per ",
              )
    print(D,I)

    for i in I[0]:
        print(emb.chunks[i]["chunk"])
        print()
        print()
        print()

    # chunks = emb.chunks
    # emb.embed_chunks()
    # print(emb.index.ntotal)
    
    
