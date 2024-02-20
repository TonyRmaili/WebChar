from fastapi import FastAPI
from models import Todo
from sqlalchemy.connect import Person


# uvicorn fast_app:app --reload ; terminal command
app = FastAPI()


@app.get("/")
async def root():
    return {"message": "yoyo world"}

