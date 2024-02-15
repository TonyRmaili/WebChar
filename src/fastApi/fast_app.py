from fastapi import FastAPI
from models import Todo 
# uvicorn fast_app:app --reload ; terminal command
app = FastAPI()


@app.get("/")
async def root():
    return {"message": "yoyo world"}

