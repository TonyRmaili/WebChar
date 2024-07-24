import faiss
import ollama
import numpy as np
import os
import re
import json


def extract_code_from_response(response):
    code = response.split("```")
    code = code[1] if len(code) > 1 else code[0]
    return code


class Embedder:
    '''
    Class to embed code snippets and query them using Ollama API,
    and generate summaries and modifications to the code base/files.
    Comes with essential side functionaliy to save/load index and metadata.

    '''
    def __init__(self):
        self.game_rules_path = "./game_rules/"
        self.database_path = "./vector_dbs/"
        self.summaries_path = "./summaries/"
        self.files = self.list_files()
        self.metadata = []  # List to store metadata

        self.d_emb = 768
        self.d_chat = 4096
        self.index_name = "nomic_index"

        self.model_emb = "nomic-embed-text"
        self.model_chat = "llama3"
        self.load_index()

    def save_index(self):
        faiss.write_index(self.index, self.database_path + self.index_name)
        np.save(self.database_path + self.index_name + "_metadata.npy", self.metadata)
        print(f"Index and metadata saved to {self.index_name}")

    def load_index(self):
        if os.path.exists(self.database_path + self.index_name):
            self.index = faiss.read_index(self.database_path + self.index_name)
            self.metadata = np.load(self.database_path + self.index_name + "_metadata.npy", allow_pickle=True).tolist()
        else:
            self.index = faiss.IndexFlatIP(self.d_emb)
            self.metadata = []
            self.save_index()

    def list_files(self):
        return [f for f in os.listdir(self.game_rules_path) if os.path.isfile(os.path.join(self.game_rules_path, f))]

    def load_file(self, file):
        with open(self.codebase_path + file, "r") as f:
            code = f.read()
            return code


    def parse_code(self, code):
        pattern = re.compile(r"^(def|class) .+?:$", re.MULTILINE)
        matches = [(m.start(), m.end()) for m in pattern.finditer(code)]
        
        # Calculate line numbers for each match
        lines = code.split('\n')
        line_start_positions = [0]
        for line in lines:
            line_start_positions.append(line_start_positions[-1] + len(line) + 1)  # +1 for the newline character

        chunks = []
        for i in range(len(matches)):
            start = matches[i][0]
            end = matches[i + 1][0] if i + 1 < len(matches) else len(code)
            start_line = next(idx for idx, pos in enumerate(line_start_positions) if pos > start) - 1
            end_line = next(idx for idx, pos in enumerate(line_start_positions) if pos > end) - 1
            chunks.append((code[start:end].strip(), start_line, end_line))
        
        return chunks

    def embed_chunks(self, chunks, file_name):
        for chunk, start_line, end_line in chunks:
            response = ollama.embeddings(model=self.model_emb, prompt=chunk)
            embedding = np.array(response["embedding"]).astype('float32')
            if embedding.shape[0] != self.d_emb:
                raise ValueError(f"Embedding dimension mismatch: expected {self.d_emb}, got {embedding.shape[0]}")
            embedding = embedding.reshape(1, -1)
            self.index.add(embedding)
            self.metadata.append({'file': file_name, 'start_line': start_line, 'end_line': end_line})
            print(f"Chunk from {file_name} (lines {start_line}-{end_line}) embedded")

    def embed_file(self, code_index=0):
        code = self.load_file(self.files[code_index])
        chunks = self.parse_code(code)
        self.embed_chunks(chunks, self.files[code_index])
        self.save_index()

    def embed_codebase(self):
        for i in range(len(self.files)):
            self.embed_file(code_index=i)
            print(f"File {i} embedded")
        print("Codebase embedded")

    def query(self, prompt, k=1):
        response = ollama.embeddings(model=self.model_emb, prompt=prompt)
        query_embedding = np.array(response["embedding"]).astype('float32').reshape(1, -1)

        D, I = self.index.search(query_embedding, k)
        results = [{'distance': D[0][j], 'metadata': self.metadata[I[0][j]]} for j in range(k)]
        return results

    def code_summarizer(self, file):
        code = self.load_file(file)
        prompt = f"Summarize this code {code}"
        response = ollama.generate(model=self.model_chat, prompt=prompt)
        response = response["response"]
        
        return response

    def json_save_summary(self, file):
        summary = self.code_summarizer(file)
        json_filename = os.path.splitext(file)[0] + ".json"
        summary_data = {
            "file": file,
            "summary": summary
        }
        with open(self.summaries_path + json_filename , "w") as f:
            json.dump(summary_data, f, indent=4)
        print(f"Summary for {file} saved as JSON")

    def code_modder(self,file_name,prompt=None):
        code = self.load_file(file_name)
        
        if prompt:
            prompt = f"{prompt} {code}"
        else:
            prompt = f"Modify this code {code}"
        
        response = ollama.generate(model=self.model_chat, prompt=prompt)
        response = response["response"]

        response = extract_code_from_response(response)
        
        return response

    def writte_modeded_code_to_file(self, file_name, code):
        with open(self.codebase_path+file_name, "w") as f:
            f.write(code)
        print(f"Modified code written to {file_name}")

        

if __name__ == "__main__":
    emb = Embedder()
    # emb.embed_codebase()
    # for file in emb.files:
    #     emb.json_save_summary(file)

    file_name = "math_functions.py"

    prompt = "Give docstring to all the functions and classes"
    code = emb.code_modder(file_name=file_name ,prompt=prompt)
    print(code)

    emb.writte_modeded_code_to_file(file_name, code)


   
    # emb.parse_code()
    
    # results = emb.query("Were is the divide function?", k=3)
    # for result in results:
    #     print(f"Distance: {result['distance']}, Metadata: {result['metadata']}")

    # for ele in emb.metadata:
    #     print(ele)