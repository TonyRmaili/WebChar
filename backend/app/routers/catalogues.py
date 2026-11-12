import os
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.file_handler import FileHandler
from app.database.models import User
from app.security import get_current_user


OUTPUT_PATH = "./app/output/"
SAVEFILES_PATH = "./app/database/save_files/"

router = APIRouter(prefix="/catalogue", tags=["catalogue"])

CurrentUser = Annotated[User, Depends(get_current_user)]

def _resolve_homebrew_path(visibility: str, username: str, catalogue: str) -> str:
    if visibility == "public":
        return os.path.join(OUTPUT_PATH, catalogue, "homebrew")
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


#---------------------- Classes -----------------------
@router.get("/classes")
def get_classes():
    try:
        classes_path = os.path.join(OUTPUT_PATH, "classes")
        filehandler = FileHandler()
        classes_data = {}
        for file in os.listdir(classes_path):
            if not file.endswith(".json"):  
                continue
            name, ext = os.path.splitext(file)
            path = os.path.join(classes_path, name)
            data = filehandler.load_json(path)
            classes_data[name] = data

        return classes_data

    except FileNotFoundError as e:
        print("FileNotFoundError:", e)
        return {"error": str(e)}

#----------------------- Feats ---------------------------
@router.get("/feats")
def get_feats(current_user: CurrentUser):
    try:
        filehandler = FileHandler()
        og_feats_path = os.path.join(OUTPUT_PATH,"feats","feats")
        sources_path = os.path.join(OUTPUT_PATH,"feats","sources")
        categories_path = os.path.join(OUTPUT_PATH,"feats","categories")
        public_path = os.path.join(OUTPUT_PATH,"feats","homebrew")

        og_feats = filehandler.load_json(og_feats_path)
        sources = filehandler.load_json(sources_path)
        categories = filehandler.load_json(categories_path)
        
        try:
            public_data = filehandler.load_json(public_path)
        except FileNotFoundError:
            public_data = []

        try:
            private_path = os.path.join(
                SAVEFILES_PATH, current_user.name, "homebrew_catalogue", "feats"
            )
            private_data = filehandler.load_json(private_path)
        except FileNotFoundError:
            private_data = []

        return {
            "feats": og_feats,
            "public_feats": public_data,
            "private_feats":private_data,
            "sources": sources,
            "categories": categories
        }


    except FileNotFoundError as e:
        print("FileNotFoundError:", e)
        return {"error": str(e)}

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
    try:
        filehandler = FileHandler()
        
        og_backgrounds_path = os.path.join(OUTPUT_PATH,"backgrounds","backgrounds")
        feat_tags_path = os.path.join(OUTPUT_PATH,"backgrounds","feat_tags")
        sources_path = os.path.join(OUTPUT_PATH,"backgrounds","sources")
        public_path = os.path.join(OUTPUT_PATH,"backgrounds","homebrew")

        og_bg_data = filehandler.load_json(og_backgrounds_path)
        feats_data = filehandler.load_json(feat_tags_path)
        sources_data = filehandler.load_json(sources_path)

        try:
            public_data = filehandler.load_json(public_path)
        except FileNotFoundError:
            public_data = []

        try:
            private_path = os.path.join(
                SAVEFILES_PATH, current_user.name, "homebrew_catalogue", "backgrounds"
            )
            private_data = filehandler.load_json(private_path)
        except FileNotFoundError:
            private_data = []

        return {
            "backgrounds": og_bg_data,
            "public_backgrounds": public_data,
            "private_backgrounds":private_data,
            "feats": feats_data,
            "sources": sources_data
        }

    except FileNotFoundError as e:
        print("FileNotFoundError:", e)
        return {"error": str(e)}
    
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
@router.get("/optional_features")
def get_optional_features(current_user: CurrentUser):
    try:
        filehandler = FileHandler()
        og_path = os.path.join(OUTPUT_PATH, "optional_features", "all_features")
        public_path = os.path.join(OUTPUT_PATH, "optional_features", "homebrew")

        og_data = filehandler.load_json(og_path)

        try:
            public_data = filehandler.load_json(public_path)
        except FileNotFoundError:
            public_data = []

        try:
            private_path = os.path.join(
                SAVEFILES_PATH, current_user.name, "homebrew_catalogue", "optional_features"
            )
            private_data = filehandler.load_json(private_path)
        except FileNotFoundError:
            private_data = []

        return {
            "features": og_data,
            "public_features": public_data,
            "private_features": private_data,
        }
    except FileNotFoundError as e:
        print("FileNotFoundError:", e)
        return {"error": str(e)}

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
def get_spells():
    try:
        filehandler = FileHandler()
        
        spells_path = os.path.join(OUTPUT_PATH,"spells","spells")
        area_tags_path = os.path.join(OUTPUT_PATH,"spells","area_tags")
        sources_path = os.path.join(OUTPUT_PATH,"spells","sources")
        schools_path = os.path.join(OUTPUT_PATH,"spells","schools")
        class_list_path = os.path.join(OUTPUT_PATH,"spells","class_list")

        spells_data = filehandler.load_json(spells_path)
        area_tags_data = filehandler.load_json(area_tags_path)
        sources_data = filehandler.load_json(sources_path)
        schools_data = filehandler.load_json(schools_path)
        class_list_data = filehandler.load_json(class_list_path)

        return {
            "spells": spells_data,
            "schools": schools_data,
            "sources": sources_data,
            "area_tags": area_tags_data,
            "class_list": class_list_data
        }


    except FileNotFoundError as e:
        print("FileNotFoundError:", e)
        return {"error": str(e)}


#----------------------- Monsters ------------------------------
@router.get("/monsters")
def get_monsters(current_user: CurrentUser):
    try:
        data = {
            "monsters": {},
            "environments": None,
            "traits": None,
            "types": None,
            "sizes": None,
            "senses": None,
            "public_monsters": [],
            "private_monsters": [],
        }
        filehandler = FileHandler()
        monsters_path = os.path.join(OUTPUT_PATH, "monsters")
        cleaned_path = os.path.join(monsters_path, "stripped_source_books")
        for file in os.listdir(cleaned_path):
            name, ext = os.path.splitext(file)
            path = os.path.join(cleaned_path, name)
            feature_data = filehandler.load_json(path)
            data["monsters"][name] = feature_data

        env_path = os.path.join(monsters_path, "environment_tags")
        traits_path = os.path.join(monsters_path, "trait_tags")
        types_path = os.path.join(monsters_path, "type_tags")
        sizes_path = os.path.join(monsters_path, "size_tags")
        senses_path = os.path.join(monsters_path, "senses_tags")

        data["environments"] = filehandler.load_json(env_path)
        data["types"] = filehandler.load_json(types_path)
        data["traits"] = filehandler.load_json(traits_path)
        data["sizes"] = filehandler.load_json(sizes_path)
        data["senses"] = filehandler.load_json(senses_path)

        # Homebrew lives in separate files and may not exist yet.
        # _load_or_empty already swallows FileNotFoundError → [].
        data["public_monsters"] = _load_or_empty(
            _resolve_homebrew_path("public", current_user.name, "monsters")
        )
        data["private_monsters"] = _load_or_empty(
            _resolve_homebrew_path("private", current_user.name, "monsters")
        )

        return data

    except FileNotFoundError as e:
        print("FileNotFoundError:", e)
        return {"error": str(e)}
    
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
    try:
        filehandler = FileHandler()
        og_path = os.path.join(OUTPUT_PATH,"items","all_items")
        public_path = os.path.join(OUTPUT_PATH,"items","homebrew")

        og_data = filehandler.load_json(og_path)

        try:
            public_data = filehandler.load_json(public_path)
        except FileNotFoundError:
            public_data = []

        try:
            private_path = os.path.join(
                SAVEFILES_PATH, current_user.name, "homebrew_catalogue", "items"
            )
            private_data = filehandler.load_json(private_path)
        except FileNotFoundError:
            private_data = []

        return {
            "original": og_data,
            "public_homebrew": public_data,
            "private_homebrew": private_data
        }
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Item data not found")
    
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
    try:
        filehandler = FileHandler()
        og_path = os.path.join(OUTPUT_PATH, "races", "all_races_final")
        public_homebrew_path = os.path.join(OUTPUT_PATH, "races", "homebrew")

        og_data = filehandler.load_json(og_path)

        try:
            public_homebrew_data = filehandler.load_json(public_homebrew_path)
        except FileNotFoundError:
            public_homebrew_data = []

        try:
            private_homebrew_path = os.path.join(
                SAVEFILES_PATH, current_user.name, "homebrew_catalogue", "races"
            )
            private_homebrew_data = filehandler.load_json(private_homebrew_path)
        except FileNotFoundError:
            private_homebrew_data = []

        return {
            "original": og_data,
            "public_homebrew": public_homebrew_data,
            "private_homebrew": private_homebrew_data,
        }
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Race data not found")

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


