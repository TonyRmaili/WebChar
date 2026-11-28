# Run from backend/:
#   py -m app.data_cleaning.data_extracter              every category
#   py -m app.data_cleaning.data_extracter spells items only these
"""Stage 1 of the data pipeline: pull the files we use out of 5etools' data/.

data/ is the folder from the 5etools zip, replaced whole on every update.
Each category below lists the files it reads. Every top-level list in
those files is kept (only `_meta` is dropped), and every entry gets a
`_file` tag (e.g. "spells/spells-xphb.json") so later stages know where
it came from.

Two ways a category is written:

  merged (default)   one file:     extracted/items.json
  split              one per file: extracted/spells/xphb.json, extracted/spells/phb.json, …
                     (the pattern's prefix "spells-" is dropped from the name;
                      `whole` files keep their own name: extracted/spells/spell_sources.json)

Problems are collected, not crashed on. A category with a missing file,
a pattern that matches nothing, or broken JSON is not written, and its
old extracted output is removed so nothing stale is left behind. The
other categories still run. At the end a report is printed and saved to
extracted/_report.json (with counts per file).
"""

import fnmatch
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_PATH = HERE / "data"
EXTRACTED_PATH = HERE / "extracted"

# Paths are relative to data/. `*` matches any characters, so a new book
# (spells-new.json) is picked up without touching this table.
#   lists: files whose top-level lists are kept
#   whole: files kept as they are (minus _meta), under the given name
#   skip:  files the patterns would match but we don't want,
#          e.g. "skip": ["class/class-sidekick.json"]
#   split: True = one extracted file per raw file (in a folder)
CATEGORIES = {
    "backgrounds": {"lists": ["backgrounds.json"]},
    "races": {"lists": ["races.json"]},
    "feats": {"lists": ["feats.json"]},
    "optionalfeatures": {"lists": ["optionalfeatures.json"]},
    # Book and adventure info (names, publication dates). Not a category to
    # clean: the cleaners read it to tell a book's edition when the entries
    # don't say (published on/after the 2024 Player's Handbook = "one").
    "books": {"lists": ["books.json", "adventures.json"]},
    "items": {"lists": ["items.json", "items-base.json", "magicvariants.json"]},
    "spells": {
        "lists": ["spells/spells-*.json"],
        "whole": {"spell_sources": "spells/sources.json"},
        "split": True,
    },
    "monsters": {
        "lists": ["bestiary/bestiary-*.json", "bestiary/legendarygroups.json"],
        # Templates ("Skeleton", "Half-Red Dragon") that some monsters are built with
        "whole": {"templates": "bestiary/template.json"},
        "split": True,
    },
    "classes": {
        "lists": ["class/class-*.json"],
        "split": True,
    },
    # The reference catalogues (text only, no LLM step; cleaners/reference_cleaner.py).
    "rules": {"lists": ["actions.json", "conditionsdiseases.json", "senses.json", "skills.json", "variantrules.json"]},
    "lore": {"lists": ["deities.json", "languages.json", "cultsboons.json"]},
    "toolkit": {"lists": ["trapshazards.json", "objects.json", "vehicles.json", "rewards.json", "bastions.json",
                          "charcreationoptions.json"]},
}

DROP_KEYS = {"_meta"}


class ExtractError(Exception):
    """A problem that stops one category from being written."""


# ---------- files ----------

def rel(path: Path) -> str:
    """data/spells/spells-xphb.json -> "spells/spells-xphb.json"."""
    return path.relative_to(DATA_PATH).as_posix()


def find_files(pattern: str, skip: list[str]) -> list[Path]:
    """Files under data/ matching one pattern, sorted by name.

    A pattern without `*` must exist; a pattern with `*` must match
    at least one file."""
    folder = (DATA_PATH / pattern).parent
    name_pattern = Path(pattern).name

    if not folder.is_dir():
        raise ExtractError(f"folder missing: data/{Path(pattern).parent.as_posix()}")

    matches = sorted(p for p in folder.iterdir() if p.is_file() and fnmatch.fnmatch(p.name, name_pattern))
    matches = [p for p in matches if rel(p) not in skip]

    if not matches:
        what = "file missing" if "*" not in pattern else "no files match"
        raise ExtractError(f"{what}: data/{pattern}")
    return matches


def split_name(path: Path, pattern: str) -> str:
    """The extracted file's name in split mode: the raw name without the
    pattern's prefix. spells-xphb.json (from spells-*.json) -> "xphb"."""
    stem = path.stem
    name_pattern = Path(pattern).name
    if "*" in name_pattern:
        prefix = name_pattern.split("*", 1)[0]
        if stem.startswith(prefix) and len(stem) > len(prefix):
            return stem[len(prefix):]
    return stem


def load(path: Path) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ExtractError(f"broken JSON in data/{rel(path)} (line {e.lineno}): {e.msg}")
    except OSError as e:
        raise ExtractError(f"can't read data/{rel(path)}: {e.strerror}")
    if not isinstance(data, dict):
        raise ExtractError(f"data/{rel(path)} is not a JSON object")
    return data


def save(path: Path, data) -> None:
    """Write via a temp file, so a crash never leaves half a file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    os.replace(tmp, path)


def remove_output(name: str) -> None:
    """Remove a category's old output, in either form."""
    (EXTRACTED_PATH / f"{name}.json").unlink(missing_ok=True)
    shutil.rmtree(EXTRACTED_PATH / name, ignore_errors=True)


# ---------- reading one raw file ----------

def read_lists(path: Path, warnings: list[str]) -> dict:
    """The kept content of one raw file: every list (entries tagged with
    `_file`), plus anything that isn't a list under `_other`."""
    source_file = rel(path)
    out: dict = {}
    for key, value in load(path).items():
        if key in DROP_KEYS:
            continue
        if isinstance(value, list):
            for entry in value:
                if isinstance(entry, dict):
                    entry["_file"] = source_file
            out[key] = value
        else:
            out.setdefault("_other", {})[key] = value
            warnings.append(f"'{key}' in data/{source_file} is not a list; kept under _other")
    return out


def count(content: dict) -> dict:
    """{list key: number of entries} for one file's content."""
    return {k: len(v) for k, v in content.items() if isinstance(v, list)}


# ---------- one category ----------

def extract_category(name: str, config: dict) -> tuple[dict, dict]:
    """Build one category.

    Returns (outputs, summary): outputs maps a path inside extracted/
    to the data to write there. Raises ExtractError when the category
    can't be built."""
    skip = config.get("skip", [])
    split = config.get("split", False)
    summary = {"files": {}, "counts": {}, "warnings": []}
    outputs: dict[str, dict] = {}
    merged: dict = {}

    # Collect the files first; the same file reached by two patterns is read once.
    files: list[tuple[Path, str]] = []
    for pattern in config.get("lists", []):
        for path in find_files(pattern, skip):
            if any(path == p for p, _ in files):
                summary["warnings"].append(f"data/{rel(path)} matched twice, read once")
            else:
                files.append((path, pattern))

    for path, pattern in files:
        content = read_lists(path, summary["warnings"])
        summary["files"][rel(path)] = count(content)

        if split:
            out = f"{name}/{split_name(path, pattern)}.json"
            if out in outputs:
                raise ExtractError(f"two raw files would both be written to extracted/{out}")
            outputs[out] = content
        else:
            for key, value in content.items():
                if key == "_other":
                    merged.setdefault("_other", {})[rel(path)] = value
                else:
                    merged.setdefault(key, []).extend(value)

    for out_key, pattern in config.get("whole", {}).items():
        path = find_files(pattern, skip)[0]
        content = {k: v for k, v in load(path).items() if k not in DROP_KEYS}
        summary["files"][rel(path)] = "whole file"
        if split:
            outputs[f"{name}/{out_key}.json"] = content
        else:
            merged[out_key] = content

    if not split:
        outputs[f"{name}.json"] = merged

    # Totals and a check for entries without a name or source.
    totals: dict[str, int] = {}
    unnamed: dict[str, int] = {}
    for content in outputs.values():
        for key, value in content.items():
            if not isinstance(value, list):
                continue
            totals[key] = totals.get(key, 0) + len(value)
            missing = sum(1 for e in value if not (isinstance(e, dict) and e.get("name") and e.get("source")))
            if missing:
                unnamed[key] = unnamed.get(key, 0) + missing
    summary["counts"] = totals
    for key, n in unnamed.items():
        summary["warnings"].append(f"{n} '{key}' entries have no name or source")

    return outputs, summary


# ---------- the run ----------

class DataExtracter:
    def __init__(self, categories: dict = CATEGORIES):
        self.categories = categories

    def run(self, only: list[str] | None = None) -> bool:
        """Extract the categories (all, or `only` these). Returns True when
        every category was written."""
        if not DATA_PATH.is_dir():
            print(f"No data folder at {DATA_PATH}. Unzip 5etools' data/ there first.")
            return False

        unknown = [c for c in (only or []) if c not in self.categories]
        if unknown:
            print(f"Unknown categories: {', '.join(unknown)}. Known: {', '.join(self.categories)}")
            return False

        # A run of only some categories updates their part of the report and
        # keeps the rest from the last run.
        report = {"categories": {}}
        report_path = EXTRACTED_PATH / "_report.json"
        if only and report_path.is_file():
            try:
                report = json.loads(report_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                pass
        report["at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        all_ok = True

        for name, config in self.categories.items():
            if only and name not in only:
                continue
            try:
                outputs, summary = extract_category(name, config)
                # Replace the whole old output (also when switching merged <-> split).
                remove_output(name)
                for out, data in outputs.items():
                    save(EXTRACTED_PATH / out, data)
                written = f"extracted/{name}/ ({len(outputs)} files)" if config.get("split") else f"extracted/{name}.json"
                report["categories"][name] = {"status": "ok", "written": written, **summary}
            except ExtractError as e:
                all_ok = False
                # Leave nothing stale behind: an old file would look current.
                remove_output(name)
                report["categories"][name] = {"status": "error", "error": str(e)}

        save(report_path, report)
        print_report(report, only)
        return all_ok


def print_report(report: dict, only: list[str] | None = None) -> None:
    print(f"\nExtracted to {EXTRACTED_PATH}\n")
    for name, r in report["categories"].items():
        if only and name not in only:
            continue
        if r["status"] == "error":
            print(f"  {name:<17} ERROR  {r['error']}  (not written)")
            continue
        counts = " · ".join(f"{k}: {v}" for k, v in r["counts"].items())
        print(f"  {name:<17} ok     {len(r['files'])} file(s) → {r['written']}")
        print(f"  {'':<17}        {counts}")
        for w in r["warnings"]:
            print(f"  {'':<17} note   {w}")
    print("\nCounts per raw file are in extracted/_report.json.\n")


if __name__ == "__main__":
    ok = DataExtracter().run(only=sys.argv[1:] or None)
    sys.exit(0 if ok else 1)
