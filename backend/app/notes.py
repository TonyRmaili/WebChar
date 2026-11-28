"""Campaign notes (2026-11-26): the rich-text files of a campaign's Files.

A note is saved as <name>.json:

    {"doc": <the Tiptap document>, "text": <the same note as plain text>}

`doc` is what the editor shows (fonts, colours, tables, images…); `text` is
made here, on every save, for whatever reads notes without the editor: the
DM Assistant today, a search (RAG) later. Images inside a note are files in
the campaign's note_images/ folder; the document only holds their file name
(the `noteImage` node's `file`).

This module knows nothing about users or paths: routers/campaigns.py does
the checking and calls these.
"""

import re

EMPTY_DOC = {"type": "doc", "content": [{"type": "paragraph"}]}

# ─── images ────────────────────────────────────────────────────────────

# The first bytes of each image type we accept. The upload's own name and
# content type are not trusted: a file is an image if its bytes say so.
MAX_IMAGE_BYTES = 10 * 1024 * 1024
IMAGE_SUFFIXES = (".png", ".jpg", ".gif", ".webp")
MEDIA_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp"}


def image_suffix(data: bytes) -> str | None:
    """".png" / ".jpg" / ".gif" / ".webp" if the bytes are that image, else None."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return ".gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


def images_in(doc) -> set[str]:
    """The note_images files a document shows."""
    found = set()

    def walk(node):
        if isinstance(node, dict):
            if node.get("type") == "noteImage" and (node.get("attrs") or {}).get("file"):
                found.add(str(node["attrs"]["file"]))
            for child in node.get("content") or []:
                walk(child)

    walk(doc)
    return found


# ─── document → plain text ─────────────────────────────────────────────

def _inline(node) -> str:
    """The text of a paragraph-like node (its text, hard breaks, images)."""
    out = []
    for child in node.get("content") or []:
        t = child.get("type")
        if t == "text":
            out.append(child.get("text", ""))
        elif t == "hardBreak":
            out.append("\n")
        elif t == "noteImage":
            out.append(_image_text(child))
        elif t == "mention":
            out.append(_link_text(child))
        else:
            out.append(_inline(child))
    return "".join(out)


# What a link points at, in a word, for whoever reads the plain text
# (the assistant): "Thorin (party member)", "Fireball (spell)".
LINK_WORDS = {
    "party": "party member",
    "npc": "NPC",
    "monster": "monster",
    "spell": "spell",
    "item": "item",
    "race": "race",
    "feat": "feat",
    "background": "background",
    "optionalFeature": "class option",
    "reference": "rule",
}


def _link_text(node) -> str:
    """A link: to a note or picture "[[Name]]", to anything else "Name (what it is)".
    Only the link's name: what it points at is not copied in."""
    attrs = node.get("attrs") or {}
    label = attrs.get("label") or attrs.get("id") or ""
    if attrs.get("mentionSuggestionChar") == "[[":
        return f"[[{label}]]"
    word = LINK_WORDS.get(attrs.get("kind") or "")
    return f"{label} ({word})" if word else label


def _image_text(node) -> str:
    alt = ((node.get("attrs") or {}).get("alt") or "").strip()
    return f"[Image: {alt}]" if alt else "[Image]"


def _blocks(nodes, depth: int = 0) -> list[str]:
    """Each block as text; list items carry their marker and nesting."""
    out = []
    pad = "  " * depth
    for node in nodes or []:
        t = node.get("type")
        attrs = node.get("attrs") or {}
        if t == "paragraph":
            out.append(pad + "\t" * int(attrs.get("indent") or 0) + _inline(node))
        elif t == "heading":
            out.append(pad + "#" * int(attrs.get("level") or 1) + " " + _inline(node))
        elif t in ("bulletList", "orderedList", "taskList"):
            start = int(attrs.get("start") or 1)
            items = []
            for i, item in enumerate(node.get("content") or []):
                if t == "bulletList":
                    marker = "- "
                elif t == "orderedList":
                    marker = f"{start + i}. "
                else:
                    marker = "[x] " if (item.get("attrs") or {}).get("checked") else "[ ] "
                parts = _blocks(item.get("content"), depth + 1)
                first = parts[0].strip() if parts else ""
                items.append(pad + marker + first + "".join("\n" + p for p in parts[1:]))
            out.append("\n".join(items))
        elif t == "blockquote":
            out.append("\n".join(pad + "> " + line for b in _blocks(node.get("content")) for line in b.split("\n")))
        elif t == "codeBlock":
            out.append(_inline(node))
        elif t == "horizontalRule":
            out.append(pad + "---")
        elif t == "table":
            rows = []
            for row in node.get("content") or []:
                cells = [" ".join(_blocks(cell.get("content"))).strip() for cell in row.get("content") or []]
                if any(cells):
                    rows.append(pad + " | ".join(cells))
            out.append("\n".join(rows))
        elif t == "details":
            out.extend(_blocks(node.get("content"), depth))
        elif t == "readAloud":
            inner = "\n".join(_blocks(node.get("content")))
            out.append(pad + "Read aloud:\n" + "\n".join(pad + "  " + line for line in inner.split("\n")))
        elif t == "handout":
            title = (attrs.get("title") or "").strip()
            inner = "\n".join(_blocks(node.get("content")))
            head = f"Handout: {title}" if title else "Handout:"
            out.append(pad + head + "\n" + "\n".join(pad + "  " + line for line in inner.split("\n")))
        elif t == "detailsSummary":
            if _inline(node).strip():
                out.append(pad + "▸ " + _inline(node))
        elif t in ("detailsContent", "columns", "column", "listItem", "taskItem"):
            out.extend(_blocks(node.get("content"), depth))
        elif t == "noteImage":
            out.append(pad + _image_text(node))
        elif node.get("content"):
            out.extend(_blocks(node.get("content"), depth))
    return [b for b in out if b.strip()]


def doc_to_text(doc) -> str:
    """The note as plain text: headings with #, list markers, tables as a | b, images as [Image: …]."""
    return "\n\n".join(_blocks((doc or {}).get("content")))


# ─── Markdown → document (the assistant's answers saved as notes) ─────

_INLINE = re.compile(r"(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`)")


def _text_nodes(text: str) -> list[dict]:
    """**bold**, *italic*, `code` as marks; the rest as plain text."""
    out = []
    for part in _INLINE.split(text):
        if not part:
            continue
        if part.startswith(("**", "__")) and len(part) > 4:
            out.append({"type": "text", "text": part[2:-2], "marks": [{"type": "bold"}]})
        elif part.startswith("`"):
            out.append({"type": "text", "text": part[1:-1], "marks": [{"type": "code"}]})
        elif part[0] in "*_" and len(part) > 2:
            out.append({"type": "text", "text": part[1:-1], "marks": [{"type": "italic"}]})
        else:
            out.append({"type": "text", "text": part})
    return out


def _para(text: str) -> dict:
    nodes = _text_nodes(text)
    return {"type": "paragraph", "content": nodes} if nodes else {"type": "paragraph"}


# The line under a table's header: | --- | :---: | ---: |
_TABLE_RULE = re.compile(r"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$")


def _cells(line: str) -> list[str]:
    """ "| a | b |" → ["a", "b"]; "\\|" stays a | inside a cell."""
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|") and not line.endswith("\\|"):
        line = line[:-1]
    return [c.strip().replace("\\|", "|") for c in re.split(r"(?<!\\)\|", line)]


def _table(header: str, rows: list[str]) -> dict:
    """A note table: the header row in bold header cells, every row as wide as the header."""
    head = _cells(header)
    width = len(head)

    def row(cells: list[str], kind: str) -> dict:
        cells = (cells + [""] * width)[:width]
        return {"type": "tableRow", "content": [{"type": kind, "content": [_para(c)]} for c in cells]}

    return {"type": "table", "content": [row(head, "tableHeader")] + [row(_cells(r), "tableCell") for r in rows]}


def markdown_to_doc(md: str) -> dict:
    """Headings, bullet and numbered lists, tables, quotes, rules and paragraphs."""
    content: list[dict] = []
    para: list[str] = []
    lst: dict | None = None

    def flush_para():
        nonlocal para
        if para:
            content.append(_para(" ".join(s.strip() for s in para)))
            para = []

    def flush_list():
        nonlocal lst
        if lst:
            content.append(lst)
            lst = None

    lines = (md or "").replace("\r\n", "\n").split("\n")
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        i += 1
        # A table: a row with |, then the --- line under it, then rows until one has no |.
        if "|" in stripped and i < len(lines) and _TABLE_RULE.match(lines[i].strip()):
            flush_para()
            flush_list()
            i += 1
            rows = []
            while i < len(lines) and "|" in lines[i]:
                rows.append(lines[i])
                i += 1
            content.append(_table(stripped, rows))
            continue
        heading = re.match(r"^(#{1,6})\s+(.*)$", stripped)
        bullet = re.match(r"^[-*+]\s+(.*)$", stripped)
        number = re.match(r"^(\d+)[.)]\s+(.*)$", stripped)
        if not stripped:
            flush_para()
            flush_list()
        elif heading:
            flush_para()
            flush_list()
            content.append({"type": "heading", "attrs": {"level": min(len(heading.group(1)), 3)}, "content": _text_nodes(heading.group(2)) or None})
        elif re.match(r"^(-{3,}|\*{3,}|_{3,})$", stripped):
            flush_para()
            flush_list()
            content.append({"type": "horizontalRule"})
        elif bullet or number:
            flush_para()
            kind = "bulletList" if bullet else "orderedList"
            if not lst or lst["type"] != kind:
                flush_list()
                lst = {"type": kind, "content": []}
                if number:
                    lst["attrs"] = {"start": int(number.group(1))}
            text = bullet.group(1) if bullet else number.group(2)
            lst["content"].append({"type": "listItem", "content": [_para(text)]})
        elif stripped.startswith(">"):
            flush_para()
            flush_list()
            content.append({"type": "blockquote", "content": [_para(stripped.lstrip("> "))]})
        else:
            flush_list()
            para.append(stripped)
    flush_para()
    flush_list()
    for node in content:  # a heading with no text has no "content"
        if node.get("content") is None:
            node.pop("content", None)
    return {"type": "doc", "content": content or [{"type": "paragraph"}]}


def note_file(doc: dict) -> dict:
    """What a note's .json holds."""
    return {"doc": doc, "text": doc_to_text(doc)}
