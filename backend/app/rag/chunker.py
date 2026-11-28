"""A note → chunks for the notes search (RAG), 2026-11-27.

A chunk is a piece of a note small enough to have one clear meaning (about
TARGET tokens), with a label saying where it came from. The label goes into
the embedding and the keyword index with the text, so even a chunk that only
says "he waits under the throne" carries "Villains · The Lich's Lair".

How a note is cut, best first:
  1. Headings (Title / Heading / Subheading) start a new section and a new
     chunk.
  2. Within a section, whole blocks are gathered until about TARGET tokens:
     paragraphs, lists, read-aloud boxes, handouts, tables, columns. A block
     is not cut while it stays under HARD.
  3. Only a block over HARD on its own is cut: a table by rows (header row
     repeated), a box or list by its parts, a paragraph at sentence ends,
     and a "sentence" that never ends at word gaps (or, in languages
     written without spaces, by length). The pieces overlap by one sentence.
  4. A chunk under MIN joins the chunk before (or after) it in the same
     section. A tiny section stays on its own. Never across notes.

Notes are often messy: no headings, one wall of text, many languages. Then
rules 1-2 do little and 3 does the work; the note's name in the label is
the context.
"""

import re

from app.notes import _blocks, _inline

TARGET = 400  # tokens: aim
HARD = 800  # tokens: a single block over this is cut
MIN = 60  # tokens: smaller chunks join a neighbour of their section

# Letters that are a word each, more or less (Chinese, Japanese, Korean).
_WIDE = re.compile(r"[぀-ヿ㐀-鿿가-힯豈-﫿]")
# A sentence ends at . ! ? … (then a space) or 。！？ (no space needed), or a line break.
_SENTENCE_END = re.compile(r"(?<=[.!?…])\s+|(?<=[。！？])|\n+")


def tokens(text: str) -> int:
    """A cheap estimate of OpenAI tokens: about 4 letters each in most
    languages, about one per letter in Chinese, Japanese and Korean."""
    wide = len(_WIDE.findall(text))
    return max(1, wide + round((len(text) - wide) / 4))


def _text_of(node) -> str:
    return "\n".join(_blocks([node]))


def _pack(parts: list[str], prefix: str = "", overlap: int = 0, joiner: str = "\n") -> list[str]:
    """Parts in order, gathered into pieces of about TARGET tokens. Each piece
    starts with `prefix` (a table's header row, a box's name) and repeats the
    last `overlap` parts of the piece before it."""
    out, cur = [], []
    for p in parts:
        if cur and tokens(prefix + joiner.join(cur + [p])) > TARGET:
            out.append(prefix + joiner.join(cur))
            keep = cur[-overlap:] if overlap else []
            # Overlap is a sentence or two, never a whole piece.
            cur = keep if keep and tokens(joiner.join(keep)) <= TARGET // 4 else []
        cur.append(p)
    if cur:
        out.append(prefix + joiner.join(cur))
    return out


def _cut_words(text: str) -> list[str]:
    """A "sentence" over HARD: at word gaps, or by length when there are none."""
    words = text.split()
    if len(words) > 1:
        return _pack(words, joiner=" ")
    step = TARGET * 2  # letters; wide letters are about a token each
    return [text[i : i + step] for i in range(0, len(text), step)]


def _cut_text(text: str) -> list[str]:
    """Plain text over HARD: at sentence ends, one sentence of overlap."""
    sentences = []
    for s in _SENTENCE_END.split(text):
        s = s.strip()
        if s:
            sentences.extend(_cut_words(s) if tokens(s) > HARD else [s])
    return _pack(sentences, overlap=1, joiner=" ")


def _cut_block(node) -> list[str]:
    """A block over HARD, in pieces."""
    t = node.get("type")
    if t == "table":
        rows = [" | ".join(" ".join(_blocks(c.get("content"))).strip() for c in r.get("content") or []) for r in node.get("content") or []]
        return _pack(rows[1:], prefix=rows[0] + "\n", overlap=1) if len(rows) > 1 else _cut_text(rows[0] if rows else "")
    if t in ("paragraph", "heading", "codeBlock"):
        return _cut_text(_inline(node))
    # a box, list, quote, columns, folding section: by its parts
    whole = _text_of(node)
    head = whole.split("\n", 1)[0] + "\n" if t in ("readAloud", "handout") else ""
    inner = node.get("content") or []
    if t == "columns":
        inner = [b for col in inner for b in col.get("content") or []]
    if not inner:
        return _cut_text(whole)
    pieces = []
    for child in inner:
        txt = _text_of(child)
        if txt.strip():
            pieces.extend(_cut_block(child) if tokens(txt) > HARD else [txt])
    return _pack(pieces, prefix=head)


def chunk_note(doc: dict, campaign: str, note: str) -> list[dict]:
    """[{ "section", "text", "embedded", "tokens" }]; `embedded` is the label
    and the text, what gets embedded and keyword-indexed."""
    sections: list[tuple[str, list[str]]] = []
    path: list[str] = []
    for node in (doc or {}).get("content") or []:
        if node.get("type") == "heading":
            level = int((node.get("attrs") or {}).get("level") or 1)
            title = _inline(node).strip()
            path = path[: level - 1] + [title]
            shown = [p for p in path if p and p != note]  # the note's own title is in the label already
            sections.append((" › ".join(shown), []))
            continue
        if not sections:
            sections.append(("", []))
        txt = _text_of(node)
        if txt.strip():
            sections[-1][1].extend(_cut_block(node) if tokens(txt) > HARD else [txt])

    chunks = []
    for name, blocks in sections:
        for piece in _pack(blocks):
            chunks.append({"section": name, "text": piece})

    i = 0
    while i < len(chunks):
        c = chunks[i]
        if tokens(c["text"]) < MIN:
            same = [j for j in (i - 1, i + 1) if 0 <= j < len(chunks) and chunks[j]["section"] == c["section"]]
            if same:
                j = same[0]
                a, b = (chunks[j], c) if j < i else (c, chunks[j])
                lo = min(i, j)
                chunks[lo : lo + 2] = [{"section": a["section"], "text": a["text"] + "\n" + b["text"]}]
                i = lo
                continue
        i += 1

    for c in chunks:
        label = f"Campaign: {campaign} · Note: {note}" + (f" · Section: {c['section']}" if c["section"] else "")
        c["embedded"] = f"{label}\n{c['text']}"
        c["tokens"] = tokens(c["embedded"])
    return chunks
