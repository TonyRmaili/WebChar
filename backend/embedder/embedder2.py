import faiss
import ollama
import numpy as np
import os
import re
import json
import pymupdf as pdf
from pdf_handler import extract_pages, chunk_pages
import time
from dotenv import load_dotenv
from openai import OpenAI


class Embedder:
    def __init__(self):
        # init env variables and api key
        load_dotenv()

        self.client = OpenAI(
            api_key= os.getenv("OPENAI_API_KEY")
        )
        # paths 
        self.database_path = "./vector_dbs/"
        self.game_rules_path = "./game_rules/"
        self.summaries_path = "./summaries/"

        # embedder dimensions
        self.d_nomic = 768 
        self.d_llama3 = 4096
        self.d_text_embedder_small = 1536

        # models

        self.model_nomic = "nomic-embed-text"
        self.model_llama3= "llama3"
        self.model_openai_small = "text-embedding-3-small"


if __name__ == "__main__":
    pass
