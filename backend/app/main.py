from fastapi import FastAPI, HTTPException, Depends, status, Request, Response, Body
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import select, update, delete, insert
from sqlalchemy.exc import IntegrityError
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated
from fastapi import Query
from app.database.models import User,Character
from app.database.schemas import UserSchema,CharacterSchema, QueryRequest, CharacterIn, DictData
from app.security import hash_password, verify_password, create_access_token, get_current_user
from app.db_setup import init_db, get_db
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta, datetime
from dotenv import load_dotenv
import os
import json
import shutil
from fastapi.responses import JSONResponse
from embedder.xembedder import Embedder
from pathlib import Path
from app.dice_handler import roll_dice



# uvicorn app.main:app --reload

#------------------------Setup-----------------------------
load_dotenv(override=True)

ALGORITHM = os.getenv("ALGORITHM")  
SECRET_KEY = os.getenv("SECRET_KEY")  
ACCESS_TOKEN_EXPIRE_MINUTES = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")  

savefiles_path = "./app/database/save_files/"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db() 
    yield

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    # allow_headers=["*"]
)


@app.middleware("http")
async def csp_middleware(request, call_next):
    resp = await call_next(request)
    if os.getenv("ENV", "development") == "development":
        resp.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-eval'; "       # ← allow eval in DEV
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' http://localhost:5173 http://localhost:8000 ws://localhost:5173;"
        )
    return resp



# ------------------------User-----------------------------

@app.post("/create_account", status_code=status.HTTP_201_CREATED,tags=["user"])
def create_account(user: UserSchema, db: Session = Depends(get_db)):
    hashed_password: str = hash_password(user.password)
    user.password = hashed_password
    try:
        new_user = User(**user.model_dump())
        db.add(new_user)
        db.commit()
        username = new_user.name
        profile_path = savefiles_path + username
        os.makedirs(profile_path,exist_ok=True)

    except IntegrityError:
        raise HTTPException(detail="User already exists", status_code=status.HTTP_400_BAD_REQUEST) # ?Might not be secure?
    
    return new_user

@app.delete("/account",tags=["user"])
def delete_account(current_user: Annotated[User, Depends(get_current_user)],
        db:Session = Depends(get_db)):
    
     # 1) Load the user (extra safety)
    db_user = db.query(User).filter(User.id == current_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    for ch in list(db_user.characters):   # ensure it's a list copy
        db.delete(ch)
    
    db.delete(db_user)
    db.commit()

    # 4) Delete any user-owned files on disk (ignore errors if not present)
    try:
        user_dir = Path(savefiles_path) / current_user.name
        if user_dir.exists():
            shutil.rmtree(user_dir)
    except Exception:
        # Don't fail the request if file cleanup has issues
        pass

    return Response(status_code=204)


@app.post("/login", tags=["user"])
def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: Session = Depends(get_db)):
    user = db.scalars(select(User).where(User.name == form_data.username)).first()
 
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not exist",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Passwords do not match",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=float(ACCESS_TOKEN_EXPIRE_MINUTES))
    access_token = create_access_token(data={"sub": str(user.id)}, expires_delta=access_token_expires)
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me", tags=["user"])
def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user


# ------------------------Characters-----------------------------

@app.post("/character", tags=["characters"])
def create_char(current_user: Annotated[User, Depends(get_current_user)],
        form_data: CharacterIn,db:Session = Depends(get_db)):
    try:
        directory = os.path.join(savefiles_path , current_user.name ,"characters")
        file_name = f"{form_data.name}.json"
        file_path = os.path.join(directory, file_name)
        os.makedirs(directory, exist_ok=True)

        with open(file_path, "w", encoding="utf-8") as json_file:
            json.dump({"name": form_data.name}, json_file, indent=4, ensure_ascii=False)

        character_data = CharacterSchema(
            user_id=current_user.id,
            name=form_data.name,
            file_path=file_path)
        
        db_char = Character(**character_data.model_dump())
        db.add(db_char)
        db.commit()

        return JSONResponse(content={"message": "JSON data saved successfully"}, status_code=200)
    except Exception as e:
        return JSONResponse(content={"message": f"Error: {str(e)}"}, status_code=500)
    

# @app.post("/character", tags=["characters"])
# def create_char(current_user: Annotated[User, Depends(get_current_user)],
#           form_data:dict,db:Session = Depends(get_db)):
#     try:
#         directory = os.path.join(savefiles_path , current_user.name ,"characters")
#         file_name = form_data['name'] + ".json"
#         file_path = os.path.join(directory, file_name)
#         os.makedirs(directory, exist_ok=True)
#         with open(file_path, "w") as json_file:
#             json.dump(form_data, json_file, indent=4)

#         character_data = CharacterSchema(user_id=current_user.id,
#             name=form_data['name'] ,file_path=file_path)
#         db_char = Character(**character_data.model_dump())
#         db.add(db_char)
#         db.commit()

#         return JSONResponse(content={"message": "JSON data saved successfully"}, status_code=200)
#     except Exception as e:
#         return JSONResponse(content={"message": f"Error: {str(e)}"}, status_code=500)



@app.delete("/character/{char_name}",status_code=status.HTTP_204_NO_CONTENT,tags=["characters"])
def delete_char_name(current_user: Annotated[User, Depends(get_current_user)],
    char_name:str, db:Session = Depends(get_db)):
    # delete from database
    db_char = db.scalars(select(Character).where(
        Character.name == char_name)).first()
    if db_char is None:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(db_char)
    db.commit()

    # delete from backend
    try:
        char_path = os.path.join(savefiles_path,current_user.name,"characters",char_name+".json")
       
        os.remove(char_path)
    except FileNotFoundError as e:
        print(e)
    return {}


@app.get("/character", status_code=200,tags=["characters"])
def list_all_chars(db: Session = Depends(get_db)):
    chars = db.scalars(select(Character)
    .options(selectinload(Character.pictures))).all()
    print(chars)
    if not chars:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No users found")
    return chars


@app.post("/character/{char_id}" , tags=["characters"])
def toggle_active_char(
    current_user: Annotated[User,Depends(get_current_user)],
    char_id:int,
    db:Session = Depends(get_db)
    ):
    char = db.scalar(select(Character).where(Character.id == char_id, Character.user_id == current_user.id))
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    char.active = not char.active
    db.commit()
    db.refresh(char)
    return {"id": char.id, "active": char.active}


@app.post("/update_character", tags=["characters"])
def update_char(
    form_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
    
):
    charpath = os.path.join(savefiles_path,current_user.name,"characters",form_data["name"]+".json")

    with open(charpath,'w') as f:
        json.dump(form_data,f,indent=4)


    return {"ok": True}


@app.get("/character/file/{char_id}" , tags=["characters"])
def get_char_file(
    char_id:int,
    current_user: Annotated[User,Depends(get_current_user)],
    db:Session = Depends(get_db),
):
    char = db.scalar(select(Character).where(Character.id == char_id, Character.user_id == current_user.id))
    with open(char.file_path) as f:
        char_file = json.load(f)
    
    return char_file



# ------------------------Party-----------------------------

@app.post("/create_party", tags=["party"])
def create_party(current_user: Annotated[User, Depends(get_current_user)],
          form_data:dict,db:Session = Depends(get_db)):
    try:
       
        directory = os.path.join(savefiles_path + current_user.name, "parties")
        file_name =  form_data["name"] +".json"
        file_path = os.path.join(directory, file_name)
        os.makedirs(directory, exist_ok=True)
        with open(file_path, "w") as json_file:
            json.dump(form_data, json_file, indent=4)

        return JSONResponse(content={"message": "JSON data saved successfully"}, status_code=200)
    except Exception as e:
        return JSONResponse(content={"message": f"Error: {str(e)}"}, status_code=500)
    
@app.get("/party", tags=["party"])
def get_party(
    current_user: Annotated[User, Depends(get_current_user)],
):
    try:
        parties = []
        parties_path = os.path.join(savefiles_path, current_user.name, "parties")
        if not os.path.isdir(parties_path):
            return []

        for filename in os.listdir(parties_path):
            if not filename.endswith(".json"):
                continue
            party_path = os.path.join(parties_path, filename)
            try:
                with open(party_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    parties.append(data)
            except Exception:
                continue

        return parties
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/parties/{party_name}", tags=["party"], status_code=204)
def delete_party(
    party_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
):
    base_dir = Path(savefiles_path) / current_user.name / "parties"
    file_path = (base_dir / f"{party_name}.json").resolve()

    # prevent traversal
    if base_dir.resolve() not in file_path.parents:
        raise HTTPException(status_code=400, detail="Invalid party name")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Party not found")

    file_path.unlink()
    return Response(status_code=204)


# ------------------------Dice-----------------------------
@app.post("/dice_roll/{diceSize}", tags=["dice"])
def roll_initiative(
    diceSize: int,
    current_user: Annotated[User, Depends(get_current_user)],
    form_data: list  = Body(...), 
):
    try:
        for monster in form_data:
            modifier = monster["initiativeBonus"]
            roll_type = monster["roll_type"]
            roll = roll_dice(size=diceSize,modifier=modifier,roll_type=roll_type)
            monster["initiative"] = roll 

        return form_data 
    except Exception as e:
        return {"error": str(e)}
    


# ------------------------Embeddings-----------------------------

@app.post("/query", tags=["embeddings"])
def post_query(query: QueryRequest, pdf_name="players_handbook_5e"):
    emb = Embedder(pdf_name=pdf_name,model="text-embedding-3-small")
    emb.query(prompt=query.question)
    summary = emb.get_summary()
    
    return {"answer": summary}

# ------------------------Other-----------------------------

@app.get("/races",tags=["5etools"])
def get_races():
    try:
        with open("./app/database/5etools_json/races.json") as f:
            races = json.load(f)
        
        return [races["race"],races["subrace"]]
    
    except FileNotFoundError:
        return {"file not found"}

