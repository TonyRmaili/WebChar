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


# ── Fast list responses (2026-11-24) ──────────────────────────────────
# The book data is big (monsters: 113 files, 16 MB as JSON). Reading and
# parsing it on every request took ~1 s, and FastAPI's jsonable_encoder
# another ~2.4 s. So the book part is kept here already written as JSON
# bytes, made again only when one of its files changes (the finalizer
# writes them), and the response is put together from bytes. The homebrew
# lists are small and read fresh every time. (Responses are gzipped by the
# middleware in main.py.)

_FINAL_BYTES: dict = {}   # category -> (files' (name, mtime, size), JSON bytes)


def _final_files(category: str) -> list:
    folder = FINAL_PATH / category
    if folder.is_dir():
        return sorted(folder.glob("*.json"))
    return [FINAL_PATH / f"{category}.json"]


def final_bytes(category: str) -> bytes:
    """final/<category> as compact JSON bytes, cached until a file changes."""
    stamp = tuple((f.name, f.stat().st_mtime_ns, f.stat().st_size) for f in _final_files(category))
    hit = _FINAL_BYTES.get(category)
    if hit and hit[0] == stamp:
        return hit[1]
    raw = json.dumps(load_final(category), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    _FINAL_BYTES[category] = (stamp, raw)
    return raw


def _dumps(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def catalogue_list(category: str, username: str) -> Response:
    """{"original", "public_homebrew", "private_homebrew"} for a catalogue's page."""
    hb = category
    body = b"".join([
        b'{"original":', final_bytes(category),
        b',"public_homebrew":', _dumps(load_homebrew("public", username, hb)),
        b',"private_homebrew":', _dumps(load_homebrew("private", username, hb)),
        b"}",
    ])
    return Response(content=body, media_type="application/json")

    
    


#---------------------- Classes -----------------------
@router.get("/classes")
def get_classes(current_user: CurrentUser):
    return catalogue_list("classes", current_user.name)

@router.get("/subclasses")
def get_subclasses(current_user: CurrentUser):
    return catalogue_list("subclasses", current_user.name)

# Classes and subclasses are saved like every homebrew catalogue (see
# races): POST stamps a new id and the owner, PUT keeps them and may
# move the record between public and private, DELETE only your own.
# A class's subclass pick ({"grant": "subclass"}) lists the subclasses
# whose class_id is the class's own id, which a new class only gets here.

def _point_subclass_pick(cls: dict) -> None:
    for row in cls.get("progression") or []:
        for choice in row.get("choices") or []:
            if choice.get("grant") == "subclass":
                choice["from"] = cls["id"]


def _create_homebrew(category: str, payload: dict, user: str) -> dict:
    visibility = payload.get("visibility", "private")
    if visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")
    payload["id"] = str(uuid.uuid4())
    payload["created_by"] = user
    if category == "classes":
        _point_subclass_pick(payload)
    path = _resolve_homebrew_path(visibility, user, category)
    data = _load_or_empty(path)
    data.append(payload)
    FileHandler().save_json(path, data)
    return payload


def _update_homebrew(category: str, entry_id: str, payload: dict, user: str, what: str) -> dict:
    new_visibility = payload.get("visibility", "private")
    if new_visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")
    filehandler = FileHandler()
    found = None
    for visibility in ("public", "private"):
        path = _resolve_homebrew_path(visibility, user, category)
        data = _load_or_empty(path)
        entry = next((e for e in data if e.get("id") == entry_id), None)
        if entry is not None:
            found = (path, data, entry)
            break
    if found is None:
        raise HTTPException(status_code=404, detail=f"{what} not found")
    path, data, entry = found
    if entry.get("created_by") != user:
        raise HTTPException(status_code=403, detail="You can only edit your own homebrew")
    payload["id"] = entry_id
    payload["created_by"] = user
    if category == "classes":
        _point_subclass_pick(payload)
    filehandler.save_json(path, [e for e in data if e.get("id") != entry_id])
    target = _resolve_homebrew_path(new_visibility, user, category)
    target_data = _load_or_empty(target)
    target_data.append(payload)
    filehandler.save_json(target, target_data)
    return payload


def _delete_homebrew(category: str, entry_id: str, user: str, what: str) -> Response:
    for visibility in ("public", "private"):
        path = _resolve_homebrew_path(visibility, user, category)
        data = _load_or_empty(path)
        entry = next((e for e in data if e.get("id") == entry_id), None)
        if entry is not None:
            if entry.get("created_by") != user:
                raise HTTPException(status_code=403, detail="You can only delete your own homebrew")
            FileHandler().save_json(path, [e for e in data if e.get("id") != entry_id])
            return Response(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(status_code=404, detail=f"{what} not found")


@router.post("/classes", status_code=status.HTTP_201_CREATED)
def create_class(payload: dict, current_user: CurrentUser):
    return _create_homebrew("classes", payload, current_user.name)

@router.put("/classes/{class_id}")
def update_class(class_id: str, payload: dict, current_user: CurrentUser):
    return _update_homebrew("classes", class_id, payload, current_user.name, "Class")

@router.delete("/classes/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class(class_id: str, current_user: CurrentUser):
    return _delete_homebrew("classes", class_id, current_user.name, "Class")

@router.post("/subclasses", status_code=status.HTTP_201_CREATED)
def create_subclass(payload: dict, current_user: CurrentUser):
    return _create_homebrew("subclasses", payload, current_user.name)

@router.put("/subclasses/{subclass_id}")
def update_subclass(subclass_id: str, payload: dict, current_user: CurrentUser):
    return _update_homebrew("subclasses", subclass_id, payload, current_user.name, "Subclass")

@router.delete("/subclasses/{subclass_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subclass(subclass_id: str, current_user: CurrentUser):
    return _delete_homebrew("subclasses", subclass_id, current_user.name, "Subclass")

#----------------------- Feats ---------------------------
@router.get("/feats")
def get_feats(current_user: CurrentUser):
    return catalogue_list("feats", current_user.name)

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
    return catalogue_list("backgrounds", current_user.name)
  
    
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
    return catalogue_list("optionalfeatures", current_user.name)

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
    return catalogue_list("spells", current_user.name)


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
    return catalogue_list("monsters", current_user.name)
    
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
    return catalogue_list("items", current_user.name)

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
    return catalogue_list("races", current_user.name)


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


#----------------------- Rules, Lore, Toolkit ------------------------------
# The reference catalogues (2026-11-25): text-only entries (final/rules.json,
# lore.json, toolkit.json; data_cleaning/cleaners/reference_cleaner.py), each
# with a `kind` (action, deity, trap…). Their homebrew is kept like every
# other catalogue's: private per user, public shared. One set of handlers
# serves all three.

REFERENCE_CATALOGUES = ("rules", "lore", "toolkit")


def _create_entry(category: str, payload: dict, username: str) -> dict:
    visibility = payload.get("visibility", "private")
    if visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")
    payload["id"] = str(uuid.uuid4())
    payload["created_by"] = username
    path = _resolve_homebrew_path(visibility, username, category)
    data = _load_or_empty(path)
    data.append(payload)
    FileHandler().save_json(path, data)
    return payload


def _update_entry(category: str, entry_id: str, payload: dict, username: str) -> dict:
    new_visibility = payload.get("visibility", "private")
    if new_visibility not in ("public", "private"):
        raise HTTPException(status_code=400, detail="visibility must be 'public' or 'private'")
    filehandler = FileHandler()
    for visibility in ("public", "private"):
        path = _resolve_homebrew_path(visibility, username, category)
        data = _load_or_empty(path)
        existing = next((e for e in data if e.get("id") == entry_id), None)
        if existing is None:
            continue
        if existing.get("created_by") != username:
            raise HTTPException(status_code=403, detail="You can only edit your own homebrew")
        payload["id"] = entry_id
        payload["created_by"] = username
        # Out of its old file, into the one its visibility says (may be the same).
        filehandler.save_json(path, [e for e in data if e.get("id") != entry_id])
        target = _resolve_homebrew_path(new_visibility, username, category)
        target_data = _load_or_empty(target)
        target_data.append(payload)
        filehandler.save_json(target, target_data)
        return payload
    raise HTTPException(status_code=404, detail="Entry not found")


def _delete_entry(category: str, entry_id: str, username: str) -> Response:
    for visibility in ("public", "private"):
        path = _resolve_homebrew_path(visibility, username, category)
        data = _load_or_empty(path)
        for entry in data:
            if entry.get("id") == entry_id:
                if entry.get("created_by") != username:
                    raise HTTPException(status_code=403, detail="You can only delete your own homebrew")
                FileHandler().save_json(path, [e for e in data if e.get("id") != entry_id])
                return Response(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(status_code=404, detail="Entry not found")


def _reference_routes(category: str) -> None:
    """GET / POST / PUT / DELETE /catalogue/<category> for one reference catalogue."""

    @router.get(f"/{category}", name=f"get_{category}")
    def get_list(current_user: CurrentUser):
        return catalogue_list(category, current_user.name)

    @router.post(f"/{category}", status_code=status.HTTP_201_CREATED, name=f"create_{category}")
    def create(payload: dict, current_user: CurrentUser):
        return _create_entry(category, payload, current_user.name)

    @router.put(f"/{category}/{{entry_id}}", name=f"update_{category}")
    def update(entry_id: str, payload: dict, current_user: CurrentUser):
        return _update_entry(category, entry_id, payload, current_user.name)

    @router.delete(f"/{category}/{{entry_id}}", status_code=status.HTTP_204_NO_CONTENT, name=f"delete_{category}")
    def delete(entry_id: str, current_user: CurrentUser):
        return _delete_entry(category, entry_id, current_user.name)


for _category in REFERENCE_CATALOGUES:
    _reference_routes(_category)
