from fastapi import FastAPI, HTTPException, Depends, status, Request, Response, Body
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import select, update, delete, insert
from sqlalchemy.exc import IntegrityError
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated
from fastapi import Query
from app.database.models import User,Character
from app.database.schemas import UserSchema,CharacterSchema, QueryRequest, CharacterIn, HealthData,TakeRestData, TakeRestAllData, GrantExperienceAll, MinionEffects,ImportMinion, QuickClassPayload
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
from app.combat_functions import heal_health, damage_health,load_character,on_longrest,on_shortrest,grant_experience
from app.minion_functions import handle_minionEffects,filter_monster_data,get_minion_data
from app.class_maker import ClassMaker


# uvicorn app.main:app --reload


#------------------------Setup-----------------------------
load_dotenv(override=True)

ALGORITHM = os.getenv("ALGORITHM")  
SECRET_KEY = os.getenv("SECRET_KEY")  
ACCESS_TOKEN_EXPIRE_MINUTES = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")  

savefiles_path = "./app/database/save_files/"
fiveEtools_path = os.path.join(os.path.dirname(__file__), "../AIdata/5etools_data/")

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


@app.post("/quick_class", tags=["character"])
def create_quick_class(
    current_user: Annotated[User,Depends(get_current_user)],
    payload: QuickClassPayload
):
    
    char_name = payload.char_name
    prompt = payload.prompt

    class_maker = ClassMaker()

    if not prompt:
        char_data = class_maker.load_empty_class_data()
        if char_name:
            char_data["general"]["character_name"] = char_name
        complete_char_data = class_maker.run(char_data=char_data)
        return complete_char_data
    
    
    if not char_name:
        char_name_missing_prompt = "character_name is missing please generate one."
        prompt += char_name_missing_prompt
        

    instructions_path = "app/quick_class_instructions.md"
   
    with open(instructions_path, encoding="utf-8") as f:
        instructions = f.read()
    
    
    input= [
        {"role": "system", "content": instructions},
        {"role": "user", "content": prompt}
        ]
    
    response = class_maker.openai_parse(
        input=input,
        reasoning="high",
        text_format=class_maker.schema
    )
    

    if char_name:
        response["general"]["character_name"] = char_name
    else:
        char_name = response["general"]["character_name"]

    complete_char_data = class_maker.run(char_data=response)

    return complete_char_data



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


# ------------------------Combat-----------------------------

@app.post("/combat/health", tags=["combat"])
def change_health(
    form_data: HealthData,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
       
):
    try:
        if form_data.value < 0:
            damage_health(
                user=current_user.name,
                character=form_data.name,
                value = form_data.value     
            )

        elif form_data.value > 0:
            heal_health(
                user=current_user.name,
                character=form_data.name,
                value = form_data.value     
            )

        else:
            pass

        updated_char = load_character(current_user.name, form_data.name)
        return {"health": updated_char["health"]}
    except KeyError as e:
        return e 

@app.post("/combat/rest", tags=["combat"])
def take_rest(
    form_data: TakeRestData,
    current_user: Annotated[User, Depends(get_current_user)]  
):
    
    if form_data.rest_type == "long":
        on_longrest(current_user.name,form_data.name)

    elif form_data.rest_type == "short":
        on_shortrest(current_user.name,form_data.name)

    else:
        print("no valid rest type")
    
    # updated_char = load_character(current_user.name, form_data.name)
    return {"ok": True}

@app.post("/combat/rest_all", tags=["combat"])
def take_rest_all(
    form_data: TakeRestAllData,
    current_user: Annotated[User, Depends(get_current_user)]  
):
    
    if form_data.rest_type == "long":
        for character in form_data.characters:
            on_longrest(current_user.name,character["name"])

    elif form_data.rest_type == "short":
        for character in form_data.characters: 
            on_shortrest(current_user.name,character["name"])

    else:
        print("no valid rest type")
    
    return {"ok": True}

@app.post("/combat/experience", tags=["combat"])
def grant_all_exp(
    form_data: GrantExperienceAll,
    current_user: Annotated[User, Depends(get_current_user)]  
):
    user = current_user.name
    
    for character in current_user.characters:
        grant_experience(user=user,character=character,exp=form_data.delta)
    
    return {"ok": True}


# ------------------------Monsters-----------------------------

@app.post("/minions", tags=["monsters"])
def create_minion(
        current_user: Annotated[User, Depends(get_current_user)],
        form_data:dict,
        char_name: str = Query(...),
        db:Session = Depends(get_db)):

    dirr = os.path.join(savefiles_path,current_user.name,"minions",char_name)
    os.makedirs(dirr,exist_ok=True)

    file_name = f'{form_data["name"]}.json'
    savepath = os.path.join(dirr,file_name)
    form_data["file_path"] = savepath

    with open(savepath,"w") as f:
        json.dump(form_data,f,indent=4) 
   
    return savepath

@app.get("/minions", tags=["monsters"])
def get_minions(
    current_user: Annotated[User, Depends(get_current_user)],
    char_name: str = Query(...)
    ):
    
    minions_path = os.path.join(savefiles_path,current_user.name,"minions",char_name)
    minions = []
    try:
        for filename in os.listdir(minions_path):
            filepath = os.path.join(minions_path, filename)
            if os.path.isfile(filepath):

                with open(filepath) as f:
                    data = json.load(f)
                minions.append(data)
    except FileNotFoundError as e:
        return []
    return minions


@app.put("/minions",tags=["monsters"])
def update_minion(
    current_user: Annotated[User, Depends(get_current_user)],
    form_data:dict,
    char_name: str = Query(...)
    
):
    minion_path = os.path.join(savefiles_path,current_user.name,"minions",char_name,f"{form_data["name"]}.json")
    with open(minion_path, "w") as f:
        json.dump(form_data,f,indent=4)

    return form_data

@app.delete("/minions", tags=["monsters"])
def delete_minion(
    current_user: Annotated[User, Depends(get_current_user)],
    char_name: str = Query(...),
    form_data: dict = Body(...)
):
    
    minion_path = os.path.join(
        savefiles_path,
        current_user.name,
        "minions",
        char_name,
        f"{form_data.get('name')}.json"
    )

    if not os.path.exists(minion_path):
        raise HTTPException(status_code=404, detail=f"Minion not found: {form_data.get('name')}")

    try:
        os.remove(minion_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete minion: {e}")

    return {"status": "success", "deleted": form_data.get("name")}

@app.get("/monsters/get_all_names", tags=["monsters"])
def get_all_monster_names(
    current_user: Annotated[User, Depends(get_current_user)],
):
    monster_names = filter_monster_data()

    return monster_names

@app.post("/minions/import", tags=["monsters"])
def import_minion(
    current_user: Annotated[User, Depends(get_current_user)],
    selected_minion: ImportMinion,
    char_name: str = Query(...)
):
    minion_data = get_minion_data(selected_minion.data,current_user.name,char_name)
    return minion_data

    

 

# ------------------------Dice-----------------------------
@app.post("/dice", tags=["dice"])
def handle_dice_payload(
    current_user: Annotated[User, Depends(get_current_user)],
    dice: list[dict]
):
    
    print(dice)

    return {"dice handled":dice}

@app.post("/dice/minion_effects", tags=["dice"])
def catch_minion_effects(
    current_user: Annotated[User, Depends(get_current_user)],
    payload: MinionEffects
):
    
    messages = handle_minionEffects(payload)

    return messages




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

# ------------------------5etools Data-----------------------------

@app.get("/5etools/spells/filenames",tags=["5etools"])
def get_spell_filenames():

    path = os.path.join(fiveEtools_path,"spells/")
    path = os.path.abspath(path)

    try:
        filenames = [
        os.path.splitext(f)[0]
        for f in os.listdir(path)
        if os.path.isfile(os.path.join(path, f))
    ]

        return filenames
    
    except FileNotFoundError:
        return {"file not found"}
    

@app.get("/5etools/spells/load_spells/{file_name}",tags=["5etools"])
def get_spells(file_name):

    path = os.path.join(fiveEtools_path,"spells/",file_name+".json")
    path = os.path.abspath(path)

    with open(path) as f:
        spells_data = json.load(f)
    
    spells_data = spells_data["spell"]
    spell_names = []
    for spell in spells_data:
        spell_names.append(spell["name"])

    return spell_names

@app.get("/5etools/spells/select_spell/{file_name}/{spell_name}",tags=["5etools"])
def select_spell(file_name,spell_name):
    print(file_name)
    print(spell_name)
   
    file_path = os.path.join(fiveEtools_path,"spells/",file_name+".json")
    file_path = os.path.abspath(file_path)

    with open(file_path) as f:
        spells_data = json.load(f)

    spells_data = spells_data["spell"]

    
    
    for spell in spells_data:
        if spell["name"] == spell_name:
            spell = clean_spell(spell)
            return spell

 
@app.get("/5etools/races",tags=["5etools"])
def get_races():
    try:
        with open("./app/database/5etools_json/races.json") as f:
            races = json.load(f)
        
        return [races["race"],races["subrace"]]
    
    except FileNotFoundError:
        return {"file not found"}

 

