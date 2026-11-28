"""The notes search (RAG), 2026-11-27: which notes the DM Assistant reads.

Instead of the DM ticking notes, every question searches the campaign's
notes and sends the few pieces that fit it.

Where it lives: save_files/<user>/rag/, a LanceDB folder with one table,
"notes": a row per chunk (chunker.py) of every note of the user's
campaigns, with its embedding. It is only a copy of the notes' plain text:
if it's ever lost, delete the folder and it is rebuilt on the next question.

Kept up to date lazily: before each question the campaign's notes are cut
again (cheap); chunks whose words haven't changed keep their embedding, only
new or changed ones are embedded (a fraction of a cent). A note moved to
another folder keeps its embeddings (same words); a renamed one is embedded
again, since its name is in every chunk's label. Deleted notes and
campaigns lose their rows.

A question then:
  - a campaign whose notes are small altogether (SEND_ALL_UNDER tokens) is
    sent whole: nothing to choose;
  - otherwise two searches, by meaning (the embeddings) and by words (BM25,
    any language, a letter or two off still matching names), merged; a
    chunk is kept if its meaning is close enough (MATCH_BAR), or if it has
    the words and its meaning is at least near (WORD_BAR); at most TOP_K
    chunks and MAX_CONTEXT tokens. Every candidate's score is logged, so the
    bars can be set from real notes.
"""

import hashlib
import json
import logging
import re
import threading
from pathlib import Path

import lancedb
import pyarrow as pa
from lancedb.index import FTS
from lancedb.query import BooleanQuery, MatchQuery, Occur

from app.rag.chunker import chunk_note, tokens

log = logging.getLogger("uvicorn.error.rag")  # shows in the backend's console

SAVEFILES_PATH = "./app/database/save_files/"
TABLE = "notes"
DIMENSIONS = 1536  # text-embedding-3-small

SEND_ALL_UNDER = 3000  # tokens: a campaign's notes this small are sent whole
TOP_K = 8  # chunks at most
MAX_CONTEXT = 3000  # tokens of notes at most
CANDIDATES = 20  # from each search, before choosing
MATCH_BAR = 0.30  # meaning alone: at least this close (cosine similarity)
WORD_BAR = 0.15  # with the words in it (top WORD_TOP of the word search): at least this close
WORD_TOP = 3
EMBED_BATCH = 256

SCHEMA = pa.schema(
    [
        ("id", pa.string()),  # <path in _files>#<n>
        ("campaign", pa.string()),
        ("path", pa.string()),  # the note's path inside _files, with /
        ("note", pa.string()),  # its name
        ("section", pa.string()),
        ("text", pa.string()),
        ("embedded", pa.string()),  # label + text: embedded and word-indexed
        ("hash", pa.string()),  # of `embedded`: same words, same embedding
        ("vector", pa.list_(pa.float32(), DIMENSIONS)),
    ]
)

# One question at a time per user: refreshing rewrites the campaign's rows.
_locks: dict[str, threading.Lock] = {}
_locks_lock = threading.Lock()


def _lock(user_name: str) -> threading.Lock:
    with _locks_lock:
        return _locks.setdefault(user_name, threading.Lock())


def _table(user_name: str):
    folder = Path(SAVEFILES_PATH) / user_name / "rag"
    folder.mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(folder))
    try:
        return db.open_table(TABLE)
    except (ValueError, FileNotFoundError):
        return db.create_table(TABLE, schema=SCHEMA)


def _quote(value: str) -> str:
    """A string inside a LanceDB filter: 'it''s' (a quote is doubled)."""
    return "'" + value.replace("'", "''") + "'"


def _hash(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def _note_text(path: Path) -> str:
    try:
        return json.loads(path.read_text(encoding="utf-8")).get("text", "")
    except (OSError, json.JSONDecodeError, AttributeError):
        return ""


def _campaign_chunks(campaign: str, files_root: Path) -> list[dict]:
    """Every chunk of every note of the campaign, as rows (without vectors)."""
    rows = []
    for path in sorted(files_root.rglob("*.json")):
        try:
            doc = json.loads(path.read_text(encoding="utf-8")).get("doc")
        except (OSError, json.JSONDecodeError, AttributeError):
            continue
        rel = path.relative_to(files_root).as_posix()
        for n, c in enumerate(chunk_note(doc, campaign, path.stem)):
            rows.append(
                {
                    "id": f"{rel}#{n}",
                    "campaign": campaign,
                    "path": rel,
                    "note": path.stem,
                    "section": c["section"],
                    "text": c["text"],
                    "embedded": c["embedded"],
                    "hash": _hash(c["embedded"]),
                    "tokens": c["tokens"],
                }
            )
    return rows


def _refresh(table, campaign: str, files_root: Path, campaigns: set[str], embed) -> tuple[list[dict], int]:
    """Bring the campaign's rows up to date. Returns its chunks and the tokens
    spent embedding."""
    wanted = _campaign_chunks(campaign, files_root)
    stored = table.to_arrow().to_pylist() if table.count_rows() else []

    gone = {r["campaign"] for r in stored} - campaigns
    if gone:  # campaigns deleted or renamed since
        table.delete(" OR ".join(f"campaign = {_quote(c)}" for c in gone))

    mine = [r for r in stored if r["campaign"] == campaign]
    if sorted((r["id"], r["hash"]) for r in mine) == sorted((r["id"], r["hash"]) for r in wanted):
        for w, r in zip(sorted(wanted, key=lambda x: x["id"]), sorted(mine, key=lambda x: x["id"])):
            w["vector"] = r["vector"]
        return wanted, 0

    known = {r["hash"]: r["vector"] for r in stored}  # any campaign: a copied note costs nothing
    todo = [w for w in wanted if w["hash"] not in known]
    spent = 0
    for i in range(0, len(todo), EMBED_BATCH):
        batch = todo[i : i + EMBED_BATCH]
        vectors, used = embed([w["embedded"] for w in batch])
        spent += used
        for w, v in zip(batch, vectors):
            known[w["hash"]] = v
    for w in wanted:
        w["vector"] = known[w["hash"]]

    table.delete(f"campaign = {_quote(campaign)}")
    if wanted:
        table.add([{k: w[k] for k in SCHEMA.names} for w in wanted])
    if table.count_rows():
        # Any language: ICU finds the words (also where there are no spaces),
        # no English-only stemming or stop words, "ö" also found as "o".
        table.create_index("embedded", config=FTS(base_tokenizer="icu", stem=False, remove_stop_words=False, ascii_folding=True), replace=True)
    log.info("rag: %s: %d chunks, %d embedded (%d tokens)", campaign, len(wanted), len(todo), spent)
    return wanted, spent


def _fuzziness(term: str) -> int:
    """Letters that may differ: names are long and often half remembered."""
    return 2 if len(term) >= 8 else 1 if len(term) >= 5 else 0


def _cosine(a, b) -> float:
    # OpenAI embeddings have length 1, so the dot product is the cosine.
    return float(sum(x * y for x, y in zip(a, b)))


def find_notes(user_name: str, campaign: str, files_root: Path, campaigns_root: Path, question: str, embed) -> dict:
    """What the assistant should read for `question`.

    embed(texts) → (vectors, tokens spent). Returns
      { "mode": "none" | "all" | "search",
        "pieces": [{ "name", "text" }]          what goes to the assistant,
        "sources": [{ "note", "path", "sections", "score", "words" }],
        "spent": tokens spent embedding }
    """
    with _lock(user_name):
        table = _table(user_name)
        campaigns = {p.name for p in campaigns_root.iterdir() if p.is_dir()} if campaigns_root.is_dir() else {campaign}
        chunks, spent = _refresh(table, campaign, files_root, campaigns, embed)

        if not chunks:
            return {"mode": "none", "pieces": [], "sources": [], "spent": spent}

        if sum(c["tokens"] for c in chunks) < SEND_ALL_UNDER:
            # Each note whole, as its plain text (with its headings, which
            # the chunks only keep in their labels).
            paths = list(dict.fromkeys(c["path"] for c in chunks))
            names = {c["path"]: c["note"] for c in chunks}
            return {
                "mode": "all",
                "pieces": [{"name": names[p], "text": _note_text(files_root / p)} for p in paths],
                "sources": [{"note": names[p], "path": p, "sections": [], "score": None, "words": False} for p in paths],
                "spent": spent,
            }

        vectors, used = embed([question])
        spent += used
        qvec = vectors[0]
        where = f"campaign = {_quote(campaign)}"

        by_meaning = table.search(qvec).distance_type("cosine").where(where, prefilter=True).limit(CANDIDATES).to_list()
        terms = list(dict.fromkeys(re.findall(r"\w+", question.lower())))
        by_words = []
        if terms:
            words = BooleanQuery([(Occur.SHOULD, MatchQuery(t, "embedded", fuzziness=_fuzziness(t))) for t in terms])
            by_words = table.search(words, query_type="fts").where(where, prefilter=True).limit(CANDIDATES).to_list()

        # Merge the two lists (reciprocal rank fusion: near the top of either counts).
        found: dict[str, dict] = {}
        for rank, r in enumerate(by_meaning):
            found.setdefault(r["id"], {**r, "rrf": 0.0, "word_rank": None})["rrf"] += 1 / (60 + rank)
        for rank, r in enumerate(by_words):
            f = found.setdefault(r["id"], {**r, "rrf": 0.0, "word_rank": None})
            f["rrf"] += 1 / (60 + rank)
            f["word_rank"] = rank
        for f in found.values():
            f["score"] = _cosine(qvec, f["vector"])

        kept, total = [], 0
        for f in sorted(found.values(), key=lambda f: -f["rrf"]):
            with_words = f["word_rank"] is not None and f["word_rank"] < WORD_TOP
            ok = f["score"] >= MATCH_BAR or (with_words and f["score"] >= WORD_BAR)
            size = tokens(f["embedded"])
            if ok and len(kept) < TOP_K and total + size <= MAX_CONTEXT:
                kept.append(f)
                total += size
                verdict = "kept"
            else:
                verdict = "cut" if not ok else "no room"
            log.info(
                "rag: %.2f meaning · words %s · %s · %s%s",
                f["score"],
                "-" if f["word_rank"] is None else f"#{f['word_rank'] + 1}",
                verdict,
                f["note"],
                f" › {f['section']}" if f["section"] else "",
            )

        sources: dict[str, dict] = {}
        for f in kept:
            s = sources.setdefault(f["path"], {"note": f["note"], "path": f["path"], "sections": [], "score": 0.0, "words": False})
            if f["section"] and f["section"] not in s["sections"]:
                s["sections"].append(f["section"])
            s["score"] = round(max(s["score"], f["score"]), 2)
            s["words"] = s["words"] or f["word_rank"] is not None
        return {
            "mode": "search",
            "pieces": [{"name": f["note"] + (f" › {f['section']}" if f["section"] else ""), "text": f["text"]} for f in kept],
            "sources": sorted(sources.values(), key=lambda s: -s["score"]),
            "spent": spent,
        }
