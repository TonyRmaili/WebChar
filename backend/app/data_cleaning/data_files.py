"""Where each stage keeps a category's files.

Small categories are one file per stage:     resolved/races.json
Big ones (SPLIT) are one file per book:      resolved/spells/xphb.json, resolved/spells/phb.json, …

The book is the extracted file's name (extracted/spells/xphb.json -> "xphb").
While a stage works, every entry of a split category carries it as `_book`,
so it can be written back to the right file. `_book` never reaches a
cleaned or final file.

Every stage uses these helpers, so a stage never needs to know whether a
category is split.
"""

import json
import os
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXTRACTED_PATH = HERE / "extracted"
RESOLVED_PATH = HERE / "resolved"
CLEANED_PATH = HERE / "cleaned"
LLM_PATH = HERE / "llm"
FINAL_PATH = HERE / "final"

# Categories kept as one file per book in every stage after extract.
SPLIT = {"spells", "items", "classes", "subclasses", "monsters"}


def is_split(category: str) -> bool:
    return category in SPLIT


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data, indent: int = 4) -> None:
    """Write via a temp file, so a crash never leaves half a file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=indent, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


def remove(stage: Path, category: str) -> None:
    """A category's old output in a stage, in either form."""
    (stage / f"{category}.json").unlink(missing_ok=True)
    shutil.rmtree(stage / category, ignore_errors=True)


def exists(stage: Path, category: str) -> bool:
    return (stage / f"{category}.json").is_file() or (stage / category).is_dir()


def book_files(stage: Path, category: str) -> list[Path]:
    folder = stage / category
    return sorted(p for p in folder.glob("*.json") if not p.name.startswith("_")) if folder.is_dir() else []


# ---------- resolved: {list_key: [entries]} per file ----------

def read_entries(stage: Path, category: str, list_key: str) -> list[dict]:
    """All entries of one list. Split: from every book file, each tagged
    with `_book`. Files without that list (e.g. spell_sources.json) are
    skipped."""
    if not is_split(category):
        path = stage / f"{category}.json"
        return load_json(path).get(list_key, []) if path.is_file() else []
    out = []
    for p in book_files(stage, category):
        for e in load_json(p).get(list_key, []) or []:
            e["_book"] = p.stem
            out.append(e)
    return out


def read_extra(stage: Path, category: str, name: str):
    """A whole file kept next to the books, e.g. spell_sources.json."""
    path = stage / category / f"{name}.json"
    return load_json(path) if path.is_file() else None


# ---------- cleaned / final: a plain list per file ----------

def write_list(stage: Path, category: str, entries: list[dict], suffix: str = "") -> list[str]:
    """Write a list of entries; split categories are grouped by `_book`
    (which is removed). Returns the files written (relative names)."""
    name = category + suffix
    if not is_split(category):
        save_json(stage / f"{name}.json", [_without_book(e) for e in entries])
        return [f"{name}.json"]
    by_book: dict[str, list] = {}
    for e in entries:
        by_book.setdefault(e.get("_book") or "unknown", []).append(_without_book(e))
    shutil.rmtree(stage / name, ignore_errors=True)
    for book, es in by_book.items():
        save_json(stage / name / f"{book}.json", es)
    return [f"{name}/{b}.json" for b in sorted(by_book)]


def read_list(stage: Path, category: str) -> list[dict]:
    """The reverse of write_list: split entries come back with `_book`.
    Also reads a split folder like final/spells_srd/."""
    if not is_split(category) and not (stage / category).is_dir():
        path = stage / f"{category}.json"
        return load_json(path) if path.is_file() else []
    out = []
    for p in book_files(stage, category):
        for e in load_json(p):
            e["_book"] = p.stem
            out.append(e)
    return out


def _without_book(e: dict) -> dict:
    return {k: v for k, v in e.items() if k != "_book"}


# ---------- llm answers: {job id: record} per file ----------

def read_cache(category: str) -> dict:
    if not is_split(category):
        path = LLM_PATH / f"{category}.json"
        return load_json(path) if path.is_file() else {}
    out = {}
    for p in book_files(LLM_PATH, category):
        out.update(load_json(p))
    return out


def save_cache_record(category: str, jid: str, record: dict, book: str | None = None) -> None:
    """Save one answer right away. Split categories only rewrite one book's
    file, so a save stays fast with thousands of answers."""
    path = LLM_PATH / category / f"{book or 'unknown'}.json" if is_split(category) else LLM_PATH / f"{category}.json"
    cache = load_json(path) if path.is_file() else {}
    cache[jid] = record
    save_json(path, cache, indent=2)
