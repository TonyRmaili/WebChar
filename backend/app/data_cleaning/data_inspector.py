# Run from backend/ after the extractor:
#   py -m app.data_cleaning.data_inspector              every category
#   py -m app.data_cleaning.data_inspector spells races only these
"""Stage 3 of the data pipeline: describe what the extracted data looks like.

For every list in every extracted category (items → item, baseitem, …;
classes → class, subclass, classFeature, …) it writes:

  Keys        every key path in the entries (`ability[].choose.weighted.from[]`),
              how many entries have it, which types its values have, and
              either all its values (when there are few) or a few examples
  Facets      counts per source and edition, and how srd / srd52 /
              basicRules are filled in (true, a name, or missing)
  Copies      _copy entries, and the ones whose original is not in this category
  Rich text   the 5etools text nodes used inside entries (list, table,
              inset…) and the keys each node type has
  Tags        every {@tag} used anywhere, with counts and an example

Rich text (entries, entriesHigherLevel…) is not broken into key paths,
because its nesting is text layout, not data: it is summarised under
"Rich text" instead.

Output, in inspected/:
  <category>.md     the report to read
  <category>.json   the same numbers, for scripts
  _summary.md       one line per list, with links
"""

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXTRACTED_PATH = HERE / "extracted"
INSPECTED_PATH = HERE / "inspected"

# Keys holding 5etools rich text. Their content is summarised as text nodes.
RICH_TEXT_KEYS = {
    "entries",
    "entriesHigherLevel",
    "headerEntries",
    "footerEntries",
    "additionalEntries",
    "entriesTemplate",
}
# Keys whose values are counted in full, whatever their number.
FACET_KEYS = ["source", "edition"]
FLAG_KEYS = ["srd", "srd52", "basicRules", "basicRules2024"]

MAX_DISTINCT = 25  # a path with more distinct values shows examples instead
EXAMPLES = 3
EXAMPLE_LEN = 70

TAG_RE = re.compile(r"\{@(\w+)\s*([^}]*)\}")


def type_name(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, int):
        return "int"
    if isinstance(v, float):
        return "float"
    if isinstance(v, str):
        return "str"
    if isinstance(v, list):
        return "list"
    return "dict"


def short(v) -> str:
    s = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    s = s.replace("\n", " ")
    return s if len(s) <= EXAMPLE_LEN else s[: EXAMPLE_LEN - 1] + "…"


# ---------- statistics for one list ----------

class PathStats:
    def __init__(self):
        self.in_entries = 0  # entries that have this path at least once
        self.types = Counter()
        self.values = Counter()  # scalar values, while there are few
        self.many = False
        self.examples: list[str] = []

    def add(self, v):
        self.types[type_name(v)] += 1
        if isinstance(v, (dict, list)):
            return
        if not self.many:
            self.values[v] += 1
            if len(self.values) > MAX_DISTINCT:
                self.many = True
                self.values.clear()
        ex = short(v)
        if len(self.examples) < EXAMPLES and ex not in self.examples:
            self.examples.append(ex)


class ListStats:
    """Everything the report says about one list (e.g. items → item)."""

    def __init__(self):
        self.count = 0
        self.paths: dict[str, PathStats] = defaultdict(PathStats)
        self.facets = {k: Counter() for k in FACET_KEYS}
        self.flags = {k: Counter() for k in FLAG_KEYS}
        self.source_editions: dict[str, Counter] = defaultdict(Counter)
        self.node_types = Counter()
        self.node_keys: dict[str, Counter] = defaultdict(Counter)
        self.tags = Counter()
        self.tag_examples: dict[str, str] = {}
        self.copies: list[tuple[str, str]] = []  # (name, source) of the original

    # -- one entry --
    def add_entry(self, entry):
        self.count += 1
        if not isinstance(entry, dict):
            self.paths["(entry is not an object)"].add(entry)
            return

        seen: set[str] = set()
        self._walk(entry, "", seen)
        for p in seen:
            self.paths[p].in_entries += 1

        for k in FACET_KEYS:
            self.facets[k][str(entry.get(k, "(missing)"))] += 1
        for k in FLAG_KEYS:
            v = entry.get(k, None)
            bucket = "(missing)" if k not in entry else "true" if v is True else "false" if v is False else f"a name ({type_name(v)})"
            self.flags[k][bucket] += 1
        self.source_editions[str(entry.get("source", "(missing)"))][str(entry.get("edition", "(none)"))] += 1

        copy = entry.get("_copy")
        if isinstance(copy, dict):
            self.copies.append((str(copy.get("name", "")), str(copy.get("source", ""))))

    def _walk(self, v, path: str, seen: set):
        if path:
            self.paths[path].add(v)
            seen.add(path)
        if isinstance(v, dict):
            for k, child in v.items():
                p = f"{path}.{k}" if path else k
                if k in RICH_TEXT_KEYS:
                    self.paths[p].add(child)
                    seen.add(p)
                    self._rich(child)
                else:
                    self._walk(child, p, seen)
        elif isinstance(v, list):
            for item in v:
                self._walk(item, f"{path}[]", seen)
        elif isinstance(v, str):
            self._scan_tags(v)

    # -- rich text --
    # Items of a list are text nodes. An object that is the value of a key
    # (like a node's `data: {isFeature: true}`) is metadata, not a node:
    # it is searched for tags but not counted.
    def _rich(self, v, is_node: bool = True):
        if isinstance(v, str):
            self._scan_tags(v)
        elif isinstance(v, list):
            for item in v:
                self._rich(item, True)
        elif isinstance(v, dict):
            if is_node:
                node = str(v.get("type", "(no type)"))
                self.node_types[node] += 1
                for k in v:
                    self.node_keys[node][k] += 1
            for child in v.values():
                self._rich(child, False)

    def _scan_tags(self, s: str):
        for m in TAG_RE.finditer(s):
            tag = m.group(1)
            self.tags[tag] += 1
            if tag not in self.tag_examples:
                self.tag_examples[tag] = short(m.group(0))

    # -- output --
    def to_json(self, missing_copies: list) -> dict:
        return {
            "count": self.count,
            "paths": {
                p: {
                    "in_entries": s.in_entries,
                    "types": dict(s.types),
                    "values": None if s.many else {str(k): n for k, n in s.values.items()},
                    "examples": s.examples,
                }
                for p, s in sorted(self.paths.items())
            },
            "facets": {k: dict(c.most_common()) for k, c in self.facets.items()},
            "flags": {k: dict(c) for k, c in self.flags.items()},
            "source_editions": {s: dict(c) for s, c in sorted(self.source_editions.items())},
            "copies": {"count": len(self.copies), "missing_originals": missing_copies},
            "rich_text": {t: {"count": n, "keys": dict(self.node_keys[t])} for t, n in self.node_types.most_common()},
            "tags": {t: {"count": n, "example": self.tag_examples[t]} for t, n in self.tags.most_common()},
        }


# ---------- reading the extracted data ----------

def load_category(name: str) -> dict[str, list]:
    """{list key: all entries} for one category, merged across split files."""
    merged_file = EXTRACTED_PATH / f"{name}.json"
    folder = EXTRACTED_PATH / name
    files = [merged_file] if merged_file.is_file() else sorted(folder.glob("*.json"))

    lists: dict[str, list] = defaultdict(list)
    for f in files:
        data = json.loads(f.read_text(encoding="utf-8"))
        for key, value in data.items():
            if isinstance(value, list):
                lists[key].extend(value)
    return lists


def find_categories() -> list[str]:
    names = set()
    for p in EXTRACTED_PATH.iterdir():
        if p.is_dir():
            names.add(p.name)
        elif p.suffix == ".json" and not p.name.startswith("_"):
            names.add(p.stem)
    return sorted(names)


# ---------- the markdown report ----------

def cell(s) -> str:
    return str(s).replace("|", "\\|")


def fmt_counter(c: dict, limit: int = 40) -> str:
    items = list(c.items())
    text = " · ".join(f"{cell(k)} {n}" for k, n in items[:limit])
    return text + (f" · … {len(items) - limit} more" if len(items) > limit else "")


def list_markdown(category: str, key: str, data: dict) -> str:
    n = data["count"]
    out = [f"## {category} → `{key}` · {n} entries", ""]

    out += ["### Keys", "", "| path | in entries | types | values / examples |", "|---|---|---|---|"]
    for path, s in data["paths"].items():
        pct = f"{s['in_entries']} ({round(100 * s['in_entries'] / n) if n else 0}%)"
        types = " · ".join(f"{t} {c}" for t, c in s["types"].items())
        if s["values"]:
            vals = " · ".join(f"`{cell(short(v))}` {c}" for v, c in sorted(s["values"].items(), key=lambda kv: -kv[1]))
        else:
            vals = " · ".join(f"`{cell(e)}`" for e in s["examples"])
            if s["values"] is None:
                vals = "many, e.g. " + vals
        out.append(f"| `{cell(path)}` | {pct} | {types} | {vals} |")

    out += ["", "### Facets", ""]
    for k, c in data["facets"].items():
        out.append(f"- **{k}:** {fmt_counter(c)}")
    for k, c in data["flags"].items():
        out.append(f"- **{k}:** {fmt_counter(c)}")

    out += ["", "**Editions per source**", "", "| source | editions |", "|---|---|"]
    for src, eds in data["source_editions"].items():
        out.append(f"| {cell(src)} | {fmt_counter(eds)} |")

    copies = data["copies"]
    out += ["", "### Copies", "", f"{copies['count']} entries use `_copy`."]
    if copies["missing_originals"]:
        out.append(f"Originals not found in {category}: " + ", ".join(f"`{cell(m)}`" for m in copies["missing_originals"]))

    if data["rich_text"]:
        out += ["", "### Rich text nodes", "", "| type | count | keys |", "|---|---|---|"]
        for t, r in data["rich_text"].items():
            out.append(f"| `{cell(t)}` | {r['count']} | {fmt_counter(r['keys'], 20)} |")

    if data["tags"]:
        out += ["", "### Tags", "", "| tag | count | example |", "|---|---|---|"]
        for t, r in data["tags"].items():
            out.append(f"| `{cell(t)}` | {r['count']} | `{cell(r['example'])}` |")

    return "\n".join(out) + "\n"


# ---------- the run ----------

def inspect_category(name: str) -> dict:
    lists = load_category(name)

    # Every (name, source) in the category, per list, to check _copy targets.
    index = {key: {(str(e.get("name", "")).lower(), str(e.get("source", "")).lower()) for e in entries if isinstance(e, dict)}
             for key, entries in lists.items()}
    everything = set().union(*index.values()) if index else set()

    result = {}
    for key, entries in lists.items():
        stats = ListStats()
        for e in entries:
            stats.add_entry(e)
        missing = sorted({f"{n}|{s}" for n, s in stats.copies if (n.lower(), s.lower()) not in everything})
        result[key] = stats.to_json(missing)
    return result


def run(only: list[str] | None = None) -> bool:
    if not EXTRACTED_PATH.is_dir():
        print(f"No extracted folder at {EXTRACTED_PATH}. Run the extractor first.")
        return False

    categories = find_categories()
    unknown = [c for c in (only or []) if c not in categories]
    if unknown:
        print(f"Not extracted: {', '.join(unknown)}. Found: {', '.join(categories)}")
        return False

    INSPECTED_PATH.mkdir(exist_ok=True)
    summary = ["# Inspected data", "", "| category | list | entries | key paths | copies | missing originals |", "|---|---|---|---|---|---|"]

    for name in categories:
        if only and name not in only:
            continue
        try:
            result = inspect_category(name)
        except (OSError, json.JSONDecodeError) as e:
            print(f"  {name:<17} ERROR  {e}")
            continue

        (INSPECTED_PATH / f"{name}.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        md = [f"# {name}", ""] + [list_markdown(name, key, data) for key, data in result.items()]
        (INSPECTED_PATH / f"{name}.md").write_text("\n".join(md), encoding="utf-8")

        for key, data in result.items():
            c = data["copies"]
            summary.append(f"| [{name}]({name}.md) | `{key}` | {data['count']} | {len(data['paths'])} | {c['count']} | {len(c['missing_originals'])} |")
            print(f"  {name:<17} {key:<26} {data['count']:>5} entries · {len(data['paths']):>4} key paths · {c['count']} copies")

    if not only:
        (INSPECTED_PATH / "_summary.md").write_text("\n".join(summary) + "\n", encoding="utf-8")
    print(f"\nReports in {INSPECTED_PATH}\n")
    return True


if __name__ == "__main__":
    sys.exit(0 if run(sys.argv[1:] or None) else 1)
