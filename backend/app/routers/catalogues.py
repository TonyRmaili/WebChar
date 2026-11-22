import os
import json
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pathlib import Path

from app.file_handler import FileHandler
from app.database.models import User
from app.security import get_current_user

FINAL_PATH = Path(__file__).resolve().parent.parent / "data_cleaning" / "final"
OUTPUT_PATH = "./app/database/public_homebrew/"
SAVEFILES_PATH = "./app/database/save_files/"

router = APIRouter(prefix="/catalogue", tags=["catalogue"])

CurrentUser = Annotated[User, Depends(get_current_user)]

def _resolve_homebrew_path(visibility: str, username: str, catalogue: str) -> str:
    if visibility == "public":
        return os.path.join(OUTPUT_PATH, catalogue)
    if visibility == "private":
        folderpath = os.path.join(SAVEFILES_PATH, username, "homebrew_catalogue")
        os.makedirs(folderpath, exist_ok=True)
        return os.path.join(folderpath, catalogue)
    raise HTTPException(status_code=400, detail=f"Invalid visibility: {visibility}")

def _load_or_empty(path: str) -> list:
    try:
        return FileHandler().load_json(path)
    except FileNotFoundError:
        return []




def load_final(category: str) -> list:
    """final/<category>.json, or final/<category>/<book>.json for the big ones."""
    folder = FINAL_PATH / category
    if folder.is_dir():
        out = []
        for f in sorted(folder.glob("*.json")):
            out += json.loads(f.read_text(encoding="utf-8"))
        return out
    return json.loads((FINAL_PATH / f"{category}.json").read_text(encoding="utf-8"))

def load_homebrew(visibility: str, username: str, category: str) -> list:
    try:
        return FileHandler().load_json(_resolve_homebrew_path(visibility, username, category))
    except FileNotFoundError:
        return []

    
    


#---------------------- Classes -----------------------
@router.get("/classes")
def get_classes(current_user: CurrentUser):
    return {
        "original": load_final("classes"),
        "public_homebrew": load_homebrew("public", current_user.name, "classes"),
        "private_homebrew": load_homebrew("private", current_user.name, "classes"),
    }

@router.get("/subclasses")
def get_subclasses(current_user: CurrentUser):
    return {
        "original": load_final("subclasses"),
        "public_homebrew": load_homebrew("public", current_user.name, "subclasses"),
        "private_homebrew": load_homebrew("private", current_user.name, "subclasses"),
    }

#----------------------- Feats ---------------------------
@router.get("/feats")
def get_feats(current_user: CurrentUser):
    return {
        "original": load_final("feats"),
        "public_homebrew": load_homebrew("public", current_user.name, "feats"),
        "private_homebrew": load_homebrew("private", current_user.name, "feats"),
    }

@router.post("/feats", status_code=status.HTTP_201_CREATED)
def create_feat(
    payload: dict,
    current_user: CurrentUser,
):
    visibility = payload.get("visibility", "private")
    if visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    # Stamp identity + ownership at the boundary.
    payload["id"] = str(uuid.uuid4())
    payload["created_by"] = current_user.name

    filehandler = FileHandler()
    path = _resolve_homebrew_path(visibility, current_user.name, "feats")
    data = _load_or_empty(path)
    data.append(payload)
    filehandler.save_json(path, data)

    return payload  # return the stamped entry so frontend gets the id

@router.put("/feats/{feat_id}")
def update_feat(
    feat_id: str,
    payload: dict,
    current_user: CurrentUser
):
    new_visibility = payload.get("visibility", "private")
    if new_visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    filehandler = FileHandler()
    public_path = _resolve_homebrew_path("public", current_user.name, "feats")
    private_path = _resolve_homebrew_path("private", current_user.name, "feats")

    public_data = _load_or_empty(public_path)
    private_data = _load_or_empty(private_path)

    # Find the entry in either file.
    existing = None
    old_visibility = None
    for entry in public_data:
        if entry.get("id") == feat_id:
            existing = entry
            old_visibility = "public"
            break
    if existing is None:
        for entry in private_data:
            if entry.get("id") == feat_id:
                existing = entry
                old_visibility = "private"
                break

    if existing is None:
        raise HTTPException(status_code=404, detail="Feat not found")

    # Ownership check.
    if existing.get("created_by") != current_user.name:
        raise HTTPException(status_code=403, detail="You can only edit your own homebrew")

    # Preserve identity fields.
    payload["id"] = feat_id
    payload["created_by"] = current_user.name

    # Remove from old file.
    if old_visibility == "public":
        public_data = [e for e in public_data if e.get("id") != feat_id]
        filehandler.save_json(public_path, public_data)
    else:
        private_data = [e for e in private_data if e.get("id") != feat_id]
        filehandler.save_json(private_path, private_data)

    # Add to new file (may be same file if visibility unchanged).
    target_path = _resolve_homebrew_path(new_visibility, current_user.name, "feats")
    target_data = _load_or_empty(target_path)
    target_data.append(payload)
    filehandler.save_json(target_path, target_data)

    return payload

@router.delete("/feats/{feat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feat(
    feat_id: str,
    current_user: CurrentUser
):
    filehandler = FileHandler()
    public_path = _resolve_homebrew_path("public", current_user.name, "feats")
    private_path = _resolve_homebrew_path("private", current_user.name, "feats")

    for path in (public_path, private_path):
        data = _load_or_empty(path)
        for entry in data:
            if entry.get("id") == feat_id:
                if entry.get("created_by") != current_user.name:
                    raise HTTPException(status_code=403, detail="You can only delete your own homebrew")
                new_data = [e for e in data if e.get("id") != feat_id]
                filehandler.save_json(path, new_data)
                return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail="Feat not found")

#----------------------- Backgrounds ------------------------------
@router.get("/backgrounds")
def get_backgrounds(current_user: CurrentUser):
    return {
        "original": load_final("backgrounds"),
        "public_homebrew": load_homebrew("public", current_user.name, "backgrounds"),
        "private_homebrew": load_homebrew("private", current_user.name, "backgrounds"),
    }
  
    
@router.post("/backgrounds", status_code=status.HTTP_201_CREATED)
def create_background(
    payload: dict,
    current_user: CurrentUser
):
    visibility = payload.get("visibility", "private")
    if visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    # Stamp identity + ownership at the boundary.
    payload["id"] = str(uuid.uuid4())
    payload["created_by"] = current_user.name

    filehandler = FileHandler()
    path = _resolve_homebrew_path(visibility, current_user.name, "backgrounds")
    data = _load_or_empty(path)
    data.append(payload)
    filehandler.save_json(path, data)

    return payload  # return the stamped entry so frontend gets the id
    
@router.put("/backgrounds/{background_id}")
def update_background(
    background_id: str,
    payload: dict,
    current_user: CurrentUser
):
    new_visibility = payload.get("visibility", "private")
    if new_visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    filehandler = FileHandler()
    public_path = _resolve_homebrew_path("public", current_user.name, "backgrounds")
    private_path = _resolve_homebrew_path("private", current_user.name, "backgrounds")

    public_data = _load_or_empty(public_path)
    private_data = _load_or_empty(private_path)

    # Find the entry in either file.
    existing = None
    old_visibility = None
    for entry in public_data:
        if entry.get("id") == background_id:
            existing = entry
            old_visibility = "public"
            break
    if existing is None:
        for entry in private_data:
            if entry.get("id") == background_id:
                existing = entry
                old_visibility = "private"
                break

    if existing is None:
        raise HTTPException(status_code=404, detail="Background not found")

    # Ownership check.
    if existing.get("created_by") != current_user.name:
        raise HTTPException(status_code=403, detail="You can only edit your own homebrew")

    # Preserve identity fields.
    payload["id"] = background_id
    payload["created_by"] = current_user.name

    # Remove from old file.
    if old_visibility == "public":
        public_data = [e for e in public_data if e.get("id") != background_id]
        filehandler.save_json(public_path, public_data)
    else:
        private_data = [e for e in private_data if e.get("id") != background_id]
        filehandler.save_json(private_path, private_data)

    # Add to new file (may be same file if visibility unchanged).
    target_path = _resolve_homebrew_path(new_visibility, current_user.name, "backgrounds")
    target_data = _load_or_empty(target_path)
    target_data.append(payload)
    filehandler.save_json(target_path, target_data)

    return payload

@router.delete("/backgrounds/{background_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_background(
    background_id: str,
    current_user: CurrentUser
):
    filehandler = FileHandler()
    public_path = _resolve_homebrew_path("public", current_user.name, "backgrounds")
    private_path = _resolve_homebrew_path("private", current_user.name, "backgrounds")

    for path in (public_path, private_path):
        data = _load_or_empty(path)
        for entry in data:
            if entry.get("id") == background_id:
                if entry.get("created_by") != current_user.name:
                    raise HTTPException(status_code=403, detail="You can only delete your own homebrew")
                new_data = [e for e in data if e.get("id") != background_id]
                filehandler.save_json(path, new_data)
                return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail="Background not found")

#----------------------- Optional Features ------------------------------
@router.get("/optionalfeatures")
def get_optional_features(current_user: CurrentUser):
    return {
        "original": load_final("optionalfeatures"),
        "public_homebrew": load_homebrew("public", current_user.name, "optionalfeatures"),
        "private_homebrew": load_homebrew("private", current_user.name, "optionalfeatures"),
    }

@router.post("/optional_features", status_code=status.HTTP_201_CREATED)
def create_optional_feature(
    payload: dict,
    current_user: CurrentUser
):
    visibility = payload.get("visibility", "private")
    if visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    payload["id"] = str(uuid.uuid4())
    payload["created_by"] = current_user.name

    filehandler = FileHandler()
    path = _resolve_homebrew_path(visibility, current_user.name, "optional_features")
    data = _load_or_empty(path)
    data.append(payload)
    filehandler.save_json(path, data)
    return payload

@router.put("/optional_features/{feature_id}")
def update_optional_feature(
    feature_id: str,
    payload: dict,
    current_user: CurrentUser
):
    new_visibility = payload.get("visibility", "private")
    if new_visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    filehandler = FileHandler()
    public_path = _resolve_homebrew_path("public", current_user.name, "optional_features")
    private_path = _resolve_homebrew_path("private", current_user.name, "optional_features")
    public_data = _load_or_empty(public_path)
    private_data = _load_or_empty(private_path)

    existing = None
    old_visibility = None
    for entry in public_data:
        if entry.get("id") == feature_id:
            existing = entry
            old_visibility = "public"
            break
    if existing is None:
        for entry in private_data:
            if entry.get("id") == feature_id:
                existing = entry
                old_visibility = "private"
                break

    if existing is None:
        raise HTTPException(status_code=404, detail="Optional feature not found")
    if existing.get("created_by") != current_user.name:
        raise HTTPException(status_code=403, detail="You can only edit your own homebrew")

    payload["id"] = feature_id
    payload["created_by"] = current_user.name

    if old_visibility == "public":
        public_data = [e for e in public_data if e.get("id") != feature_id]
        filehandler.save_json(public_path, public_data)
    else:
        private_data = [e for e in private_data if e.get("id") != feature_id]
        filehandler.save_json(private_path, private_data)

    target_path = _resolve_homebrew_path(new_visibility, current_user.name, "optional_features")
    target_data = _load_or_empty(target_path)
    target_data.append(payload)
    filehandler.save_json(target_path, target_data)
    return payload

@router.delete("/optional_features/{feature_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_optional_feature(
    feature_id: str,
    current_user: CurrentUser
):
    filehandler = FileHandler()
    public_path = _resolve_homebrew_path("public", current_user.name, "optional_features")
    private_path = _resolve_homebrew_path("private", current_user.name, "optional_features")

    for path in (public_path, private_path):
        data = _load_or_empty(path)
        for entry in data:
            if entry.get("id") == feature_id:
                if entry.get("created_by") != current_user.name:
                    raise HTTPException(status_code=403, detail="You can only delete your own homebrew")
                new_data = [e for e in data if e.get("id") != feature_id]
                filehandler.save_json(path, new_data)
                return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail="Optional feature not found")

#----------------------- Spells ------------------------------
@router.get("/spells")
def get_spells(current_user: CurrentUser):
    return {
        "original": load_final("spells"),
        "public_homebrew": load_homebrew("public", current_user.name, "spells"),
        "private_homebrew": load_homebrew("private", current_user.name, "spells"),
    }


@router.post("/spells", status_code=status.HTTP_201_CREATED)
def create_spell(
    payload: dict,
    current_user: CurrentUser
):
    visibility = payload.get("visibility", "private")
    if visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    # Stamp identity + ownership at the boundary.
    payload["id"] = str(uuid.uuid4())
    payload["created_by"] = current_user.name
    payload["source"] = "HOMEBREW"

    filehandler = FileHandler()
    path = _resolve_homebrew_path(visibility, current_user.name, "spells")
    data = _load_or_empty(path)
    data.append(payload)
    filehandler.save_json(path, data)

    return payload  # return the stamped entry so frontend gets the id

@router.put("/spells/{spell_id}")
def update_spell(
    spell_id: str,
    payload: dict,
    current_user: CurrentUser
):
    new_visibility = payload.get("visibility", "private")
    if new_visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    filehandler = FileHandler()
    public_path = _resolve_homebrew_path("public", current_user.name, "spells")
    private_path = _resolve_homebrew_path("private", current_user.name, "spells")

    public_data = _load_or_empty(public_path)
    private_data = _load_or_empty(private_path)

    # Find the entry in either file.
    existing = None
    old_visibility = None
    for entry in public_data:
        if entry.get("id") == spell_id:
            existing = entry
            old_visibility = "public"
            break
    if existing is None:
        for entry in private_data:
            if entry.get("id") == spell_id:
                existing = entry
                old_visibility = "private"
                break

    if existing is None:
        raise HTTPException(status_code=404, detail="Spell not found")

    # Ownership check.
    if existing.get("created_by") != current_user.name:
        raise HTTPException(status_code=403, detail="You can only edit your own homebrew")

    # Preserve identity fields.
    payload["id"] = spell_id
    payload["created_by"] = current_user.name
    payload["source"] = "HOMEBREW"

    # Remove from old file.
    if old_visibility == "public":
        public_data = [e for e in public_data if e.get("id") != spell_id]
        filehandler.save_json(public_path, public_data)
    else:
        private_data = [e for e in private_data if e.get("id") != spell_id]
        filehandler.save_json(private_path, private_data)

    # Add to new file (may be the same file if visibility is unchanged).
    target_path = _resolve_homebrew_path(new_visibility, current_user.name, "spells")
    target_data = _load_or_empty(target_path)
    target_data.append(payload)
    filehandler.save_json(target_path, target_data)

    return payload

@router.delete("/spells/{spell_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_spell(
    spell_id: str,
    current_user: CurrentUser
):
    filehandler = FileHandler()
    public_path = _resolve_homebrew_path("public", current_user.name, "spells")
    private_path = _resolve_homebrew_path("private", current_user.name, "spells")

    for path in (public_path, private_path):
        data = _load_or_empty(path)
        for entry in data:
            if entry.get("id") == spell_id:
                if entry.get("created_by") != current_user.name:
                    raise HTTPException(status_code=403, detail="You can only delete your own homebrew")
                new_data = [e for e in data if e.get("id") != spell_id]
                filehandler.save_json(path, new_data)
                return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail="Spell not found")


#----------------------- Monsters ------------------------------
@router.get("/monsters")
def get_monsters(current_user: CurrentUser):
    return {
            "original": load_final("monsters"),
            "public_homebrew": load_homebrew("public", current_user.name, "monsters"),
            "private_homebrew": load_homebrew("private", current_user.name, "monsters"),
        }
    
@router.post("/monsters", status_code=status.HTTP_201_CREATED)
def create_monster(
    payload: dict,
    current_user: CurrentUser
):
    visibility = payload.get("visibility", "private")
    if visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    # Stamp identity + ownership at the boundary.
    payload["id"] = str(uuid.uuid4())
    payload["created_by"] = current_user.name
    payload["source"] = "HOMEBREW"

    filehandler = FileHandler()
    path = _resolve_homebrew_path(visibility, current_user.name, "monsters")
    data = _load_or_empty(path)
    data.append(payload)
    filehandler.save_json(path, data)

    return payload  # return the stamped entry so frontend gets the id

@router.put("/monsters/{monster_id}")
def update_monster(
    monster_id: str,
    payload: dict,
    current_user: CurrentUser
):
    new_visibility = payload.get("visibility", "private")
    if new_visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    filehandler = FileHandler()
    public_path = _resolve_homebrew_path("public", current_user.name, "monsters")
    private_path = _resolve_homebrew_path("private", current_user.name, "monsters")

    public_data = _load_or_empty(public_path)
    private_data = _load_or_empty(private_path)

    # Find the entry in either file.
    existing = None
    old_visibility = None
    for entry in public_data:
        if entry.get("id") == monster_id:
            existing = entry
            old_visibility = "public"
            break
    if existing is None:
        for entry in private_data:
            if entry.get("id") == monster_id:
                existing = entry
                old_visibility = "private"
                break

    if existing is None:
        raise HTTPException(status_code=404, detail="Monster not found")

    # Ownership check.
    if existing.get("created_by") != current_user.name:
        raise HTTPException(status_code=403, detail="You can only edit your own homebrew")

    # Preserve identity fields.
    payload["id"] = monster_id
    payload["created_by"] = current_user.name
    payload["source"] = "HOMEBREW"

    # Remove from old file.
    if old_visibility == "public":
        public_data = [e for e in public_data if e.get("id") != monster_id]
        filehandler.save_json(public_path, public_data)
    else:
        private_data = [e for e in private_data if e.get("id") != monster_id]
        filehandler.save_json(private_path, private_data)

    # Add to new file (may be the same file if visibility is unchanged).
    target_path = _resolve_homebrew_path(new_visibility, current_user.name, "monsters")
    target_data = _load_or_empty(target_path)
    target_data.append(payload)
    filehandler.save_json(target_path, target_data)

    return payload

@router.delete("/monsters/{monster_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_monster(
    monster_id: str,
    current_user: CurrentUser
):
    filehandler = FileHandler()
    public_path = _resolve_homebrew_path("public", current_user.name, "monsters")
    private_path = _resolve_homebrew_path("private", current_user.name, "monsters")

    for path in (public_path, private_path):
        data = _load_or_empty(path)
        for entry in data:
            if entry.get("id") == monster_id:
                if entry.get("created_by") != current_user.name:
                    raise HTTPException(status_code=403, detail="You can only delete your own homebrew")
                new_data = [e for e in data if e.get("id") != monster_id]
                filehandler.save_json(path, new_data)
                return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail="Monster not found")




#----------------------- Items ------------------------------
@router.get("/items")
def get_items(current_user: CurrentUser):
   return {
        "original": load_final("items"),
        "public_homebrew": load_homebrew("public", current_user.name, "items"),
        "private_homebrew": load_homebrew("private", current_user.name, "items"),
    }

@router.post("/items", status_code=status.HTTP_201_CREATED)
def create_item(
    payload: dict,
    current_user: CurrentUser
):
    visibility = payload.get("visibility", "private")
    if visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    # Stamp identity + ownership at the boundary.
    payload["id"] = str(uuid.uuid4())
    payload["created_by"] = current_user.name

    filehandler = FileHandler()
    path = _resolve_homebrew_path(visibility, current_user.name,"items")
    data = _load_or_empty(path)
    data.append(payload)
    filehandler.save_json(path, data)

    return payload  # return the stamped entry so frontend gets the id

@router.put("/items/{item_id}")
def update_item(
    item_id: str,
    payload: dict,
    current_user: CurrentUser 
):
    new_visibility = payload.get("visibility", "private")
    if new_visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    filehandler = FileHandler()
    public_path = _resolve_homebrew_path("public", current_user.name,"items")
    private_path = _resolve_homebrew_path("private", current_user.name,"items")

    public_data = _load_or_empty(public_path)
    private_data = _load_or_empty(private_path)

    # Find the entry in either file.
    existing = None
    old_visibility = None
    for entry in public_data:
        if entry.get("id") == item_id:
            existing = entry
            old_visibility = "public"
            break
    if existing is None:
        for entry in private_data:
            if entry.get("id") == item_id:
                existing = entry
                old_visibility = "private"
                break

    if existing is None:
        raise HTTPException(status_code=404, detail="Item not found")

    # Ownership check.
    if existing.get("created_by") != current_user.name:
        raise HTTPException(status_code=403, detail="You can only edit your own homebrew")

    # Preserve identity fields.
    payload["id"] = item_id
    payload["created_by"] = current_user.name

    # Remove from old file.
    if old_visibility == "public":
        public_data = [e for e in public_data if e.get("id") != item_id]
        filehandler.save_json(public_path, public_data)
    else:
        private_data = [e for e in private_data if e.get("id") != item_id]
        filehandler.save_json(private_path, private_data)

    # Add to new file (may be same file if visibility unchanged).
    target_path = _resolve_homebrew_path(new_visibility, current_user.name, "items")
    target_data = _load_or_empty(target_path)
    target_data.append(payload)
    filehandler.save_json(target_path, target_data)

    return payload

@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: str,
    current_user: CurrentUser
):
    filehandler = FileHandler()
    public_path = _resolve_homebrew_path("public", current_user.name,"items")
    private_path = _resolve_homebrew_path("private", current_user.name, "items")

    for path in (public_path, private_path):
        data = _load_or_empty(path)
        for entry in data:
            if entry.get("id") == item_id:
                if entry.get("created_by") != current_user.name:
                    raise HTTPException(status_code=403, detail="You can only delete your own homebrew")
                new_data = [e for e in data if e.get("id") != item_id]
                filehandler.save_json(path, new_data)
                return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail="Item not found")

#----------------------- Races ------------------------------
@router.get("/races")
def get_races(current_user: CurrentUser):
    return {
        "original": load_final("races"),
        "public_homebrew": load_homebrew("public", current_user.name, "races"),
        "private_homebrew": load_homebrew("private", current_user.name, "races"),
    }


@router.post("/races", status_code=status.HTTP_201_CREATED)
def create_race(
    payload: dict,
    current_user: CurrentUser
):
    visibility = payload.get("visibility", "private")
    if visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    # Stamp identity + ownership at the boundary.
    payload["id"] = str(uuid.uuid4())
    payload["created_by"] = current_user.name

    filehandler = FileHandler()
    path = _resolve_homebrew_path(visibility, current_user.name,"races")
    data = _load_or_empty(path)
    data.append(payload)
    filehandler.save_json(path, data)

    return payload  # return the stamped entry so frontend gets the id

@router.put("/races/{race_id}")
def update_race(
    race_id: str,
    payload: dict,
    current_user: CurrentUser
):
    new_visibility = payload.get("visibility", "private")
    if new_visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")

    filehandler = FileHandler()
    public_path = _resolve_homebrew_path("public", current_user.name, "races")
    private_path = _resolve_homebrew_path("private", current_user.name, "races")

    public_data = _load_or_empty(public_path)
    private_data = _load_or_empty(private_path)

    # Find the entry in either file.
    existing = None
    old_visibility = None
    for entry in public_data:
        if entry.get("id") == race_id:
            existing = entry
            old_visibility = "public"
            break
    if existing is None:
        for entry in private_data:
            if entry.get("id") == race_id:
                existing = entry
                old_visibility = "private"
                break

    if existing is None:
        raise HTTPException(status_code=404, detail="Race not found")

    # Ownership check.
    if existing.get("created_by") != current_user.name:
        raise HTTPException(status_code=403, detail="You can only edit your own homebrew")

    # Preserve identity fields.
    payload["id"] = race_id
    payload["created_by"] = current_user.name

    # Remove from old file.
    if old_visibility == "public":
        public_data = [e for e in public_data if e.get("id") != race_id]
        filehandler.save_json(public_path, public_data)
    else:
        private_data = [e for e in private_data if e.get("id") != race_id]
        filehandler.save_json(private_path, private_data)

    # Add to new file (may be same file if visibility unchanged).
    target_path = _resolve_homebrew_path(new_visibility, current_user.name, "races")
    target_data = _load_or_empty(target_path)
    target_data.append(payload)
    filehandler.save_json(target_path, target_data)

    return payload

@router.delete("/races/{race_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_race(
    race_id: str,
    current_user: CurrentUser
):
    filehandler = FileHandler()
    public_path = _resolve_homebrew_path("public", current_user.name,"races")
    private_path = _resolve_homebrew_path("private", current_user.name, "races")

    for path in (public_path, private_path):
        data = _load_or_empty(path)
        for entry in data:
            if entry.get("id") == race_id:
                if entry.get("created_by") != current_user.name:
                    raise HTTPException(status_code=403, detail="You can only delete your own homebrew")
                new_data = [e for e in data if e.get("id") != race_id]
                filehandler.save_json(path, new_data)
                return Response(status_code=status.HTTP_204_NO_CONTENT)

    raise HTTPException(status_code=404, detail="Race not found")


#----------------------- Rules ------------------------------

@router.get("/rules")
def get_rules(current_user: CurrentUser):

    return {
        "original": load_final("actions"),
        # "public_homebrew": load_homebrew("public", current_user.name, "races"),
        # "private_homebrew": load_homebrew("private", current_user.name, "races"),
    }