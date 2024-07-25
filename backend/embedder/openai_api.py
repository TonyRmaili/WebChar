from openai import OpenAI
from dotenv import load_dotenv
import os
from pdf_handler import extract_pages , chunk_pages
import faiss
import numpy as np
load_dotenv()

client = OpenAI(
    api_key= os.getenv("OPENAI_API_KEY")
)

def get_embedding(text, model="text-embedding-3-small"):
    text = text.replace("\n", " ")
    response = client.embeddings.create(input = text, model=model).data[0].embedding
    embedding = np.array(response).astype("float32")
    if embedding.shape[0] != 1536:
        raise ValueError
    embedding = embedding.reshape(1,-1)
    return embedding
    


def create_index():
    database_path = "./vector_dbs/"
    index = faiss.IndexFlatIP(1536)
    faiss.write_index(index, database_path + "open_ai_faiss")


def embed_all_chunks(chunks):
    index = faiss.read_index("./vector_dbs/open_ai_faiss")
    for chunk in chunks:
        embedding = get_embedding(text=chunk["chunk"])
        index.add(embedding)

    faiss.write_index(index, "./vector_dbs/open_ai_faiss")


def quary(prompt, k=4):

    index = faiss.read_index("./vector_dbs/open_ai_faiss")
    response = get_embedding(text=prompt)
    query_embedding = np.array(response).astype('float32').reshape(1, -1)
    D, I = index.search(query_embedding, k)
        
    return D, I

if __name__ == "__main__":
    pdf_path = "./game_rules/players_handbook_5e.pdf"

    all_pages = extract_pages(pdf_path)
    chunked_pages = chunk_pages(all_pages)

    
    # embed_all_chunks(chunks=chunked_pages)

    index = faiss.read_index("./vector_dbs/open_ai_faiss")
    print(index.ntotal)

    # resp = quary("how to define events?")
    # D = resp[0]
    # I = resp[1]

    # print(I[0])

    # for i in I[0]:
    #     print(chunked_pages[i]["chunk"])
    #     print()
    #     print()
    #     print()


    # create_index()


    # test_emb = get_embedding(text="hello")
    # print(len(test_emb))



# completion = client.chat.completions.create(
#   model="gpt-4o-mini",
#   messages=[
#     {"role": "system", "content": "You are a poetic assistant, skilled in explaining complex programming concepts with creative flair."},
#     {"role": "user", "content": "Compose a poem that explains the concept of recursion in programming."}
#   ]
# )

# print(completion.choices[0].message)