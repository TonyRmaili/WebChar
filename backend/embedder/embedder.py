import faiss
import ollama
import numpy as np
import os
import re
import json
import pymupdf as pdf
from pdf_handler import extract_pages, chunk_pages
import time

class Embedder:
    def __init__(self):
        self.game_rules_path = "./game_rules/"
        self.database_path = "./vector_dbs/"
        self.summaries_path = "./summaries/"

        self.d_emb = 768
        self.d_chat = 4096
        self.index_name = "nomic_index"

        self.model_emb = "nomic-embed-text"
        self.model_chat = "llama3"

        self.load_index()

    def load_index(self):
        if os.path.exists(self.database_path + self.index_name):
            self.index = faiss.read_index(self.database_path + self.index_name)
            
        else:
            self.index = faiss.IndexFlatIP(self.d_emb)
            self.save_index()
    
    def save_index(self):
        faiss.write_index(self.index, self.database_path + self.index_name)
        
        print(f"Index and metadata saved to {self.index_name}")



    def embed_chunks(self,chunks):
        for chunk in chunks:
            text = chunk["chunk"]
            response = ollama.embeddings(model=self.model_emb,prompt=text)
            embedding = np.array(response["embedding"]).astype("float32")
            if embedding.shape[0] != self.d_emb:
                raise ValueError(f'Embedding dimension mismatch: expected {self.d_emb}, got {embedding.shape[0]}')
            embedding = embedding.reshape(1,-1)
            self.index.add(embedding)
        
        self.save_index()

    def quary(self,promt,k=10):
        response = ollama.embeddings(model=self.model_emb,prompt=promt)

        query_embedding = np.array(response["embedding"]).astype('float32').reshape(1, -1)

        D, I = self.index.search(query_embedding, k)
        
        return D, I


    def test_embed(self,chunk):
        text = chunk["chunk"]
        response = ollama.embeddings(model=self.model_emb,prompt=text)
        embedding = np.array(response["embedding"]).astype("float32")
        if embedding.shape[0] != self.d_emb:
            raise ValueError(f'Embedding dimension mismatch: expected {self.d_emb}, got {embedding.shape[0]}')
        embedding = embedding.reshape(1,-1)
        return embedding
    
            
        
        


if __name__ == "__main__":
    start_time = time.time()
    pdf_path = "./game_rules/players_handbook_5e.pdf"
    emb = Embedder()

    # emb.index.reset()
    
    print("index size",emb.index.ntotal)
    all_pages=extract_pages(pdf_path=pdf_path)
    chunks = chunk_pages(all_pages=all_pages)

    random_chunk = chunks[56]

    print(emb.test_embed(random_chunk))

    
    
    

    # resp = emb.quary("how does fireball spell work?")
    # D = resp[0]
    # I = resp[1]

    # print(I[0])

    # for i in I[0]:
    #     print(chunks[i]["chunk"])
    #     print()
    #     print()
    #     print()


    end_time = time.time()
    elapsed_time = end_time - start_time
    elapsed_time = round(elapsed_time, 2)
    print("elapsed time in sec",elapsed_time)


    
        
    