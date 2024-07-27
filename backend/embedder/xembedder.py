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


    def load_index(self):
        path = self.database_path+self.model["index"]+self.pdf_name
        print(path)
        # if os.path.exists(path):
        #     self.index = faiss.read_index(path)
        # else:
        #    self.index = faiss.IndexFlatIP(self.model["dim"])
        #    faiss.write_index(self.index,path)

    
    def openai_chat(self):
        completion = self.client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a poetic assistant, skilled in explaining complex programming concepts with creative flair."},
            {"role": "user", "content": "Compose a poem that explains the concept of recursion in programming."}
        ]
        )

        print(completion.choices[0].message)

    def open_ai_emb_quary_small(self,text,model):
        text = text.replace("\n", " ")
        response = self.client.embeddings.create(input = text, model=model).data[0].embedding
        embedding = np.array(response).astype("float32")
        if embedding.shape[0] != self.d_text_embedder_small:
            raise ValueError
        embedding = embedding.reshape(1,-1)
        return embedding

    def open_ai_emb_quary_large(self,text):
        text = text.replace("\n", " ")
        response = self.client.embeddings.create(input = text, model=self.model_openai_large).data[0].embedding
        embedding = np.array(response).astype("float32")
        if embedding.shape[0] != self.d_text_embedder_large:
            raise ValueError(f'Embedding dimension mismatch: expected {self.d_text_embedder_large}, got {embedding.shape[0]}')
        embedding = embedding.reshape(1,-1)
        return embedding
    
    def embed_chunks(self,model,chunks):
        self.load_index(model=model)
        
        if model == self.model_nomic:
            for chunk in chunks:
                text = chunk["chunk"]
                response = ollama.embeddings(model=model,prompt=text)
                embedding = np.array(response["embedding"]).astype("float32")
                if embedding.shape[0] != self.d_emb:
                    raise ValueError(f'Embedding dimension mismatch: expected {self.d_emb}, got {embedding.shape[0]}')
                embedding = embedding.reshape(1,-1)
                self.index.add(embedding)
            self.save_index()
        
        elif model == self.model_openai_small or model == self.model_openai_large:
            pass
    
        
if __name__ == "__main__":

    emb = Embedder(pdf_name="players_handbook_5e",
                   model="text-embedding-3-small")
    
    # chunks = emb.chunks
    emb.load_index()

