"""
Data shape inspector — prints every key path in a catalogue file, what
types it holds, how often it appears and what the values look like.

Run it on a file, or on a FOLDER to merge every .json inside it into one
report — which is how to see all classes at once:

    python inspect_data.py app/output/races/all_races_final.json
    python inspect_data.py app/output/backgrounds/backgrounds.json
    python inspect_data.py app/output/classes            <- all classes merged

The .json extension is optional. Deep files are easier to read in two
passes: --depth for an overview, then --path to drill into a subtree.

    python inspect_data.py app/output/classes --depth 3
    python inspect_data.py app/output/classes --path one.class.level_progression
    python inspect_data.py races.json --path sub_races --max-samples 20

A file keyed only by edition ({"one": ..., "classic": ...}) keeps the
edition in the path, so one.class.hit_dice and classic.class.hit_dice are
reported separately instead of being merged.

── Reading the report ──────────────────────────────────────────────
PATH        dotted key path. `traits[]` is the list itself, `traits[].name`
            is the `name` key on each item inside it.
PRESENT     how many times the key appeared out of how many times its
            containing object was visited. 3/3 means always present,
            1/3 means optional — the single most useful column, since
            optional keys are what crash code written from one example.
TYPES       every Python type seen at that path. More than one means the
            field changes shape between entries and needs a branch.
VALUES      all distinct values when there are few (an enum), otherwise a
            few samples. Long strings are summarised by length.
"""

import argparse
import json
import os
from collections import Counter


# A string field with at most this many distinct values is treated as an
# enum and every value is listed, which is how you spot things like
# uses.type being one of four fixed words.
ENUM_LIMIT = 12

# Strings longer than this are prose, not identifiers, so only their
# length range is reported.
PROSE_LENGTH = 80


def type_name(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "str"
    if isinstance(value, list):
        return "list"
    if isinstance(value, dict):
        return "dict"
    return type(value).__name__


def new_record():
    return {
        "count": 0,          # times this path appeared
        "visits": 0,         # times this path's own object was walked into
        "types": Counter(),
        "values": [],        # distinct scalar values, capped while collecting
        "truncated": False,  # more distinct values than we kept
        "str_lengths": [],
        "list_lengths": [],
    }


class Inspector:
    def __init__(self, max_values=ENUM_LIMIT, keep_values=5000):
        self.stats = {}
        # How many distinct values to PRINT. keep_values is only the
        # internal collection cap, which stays generous so raising the
        # print limit never needs a re-run.
        self.max_values = max_values
        self.keep_values = keep_values
        self.root_entries = 0

    def record(self, path):
        if path not in self.stats:
            self.stats[path] = new_record()
        return self.stats[path]

    def note_value(self, record, value):
        record["types"][type_name(value)] += 1

        if isinstance(value, str):
            record["str_lengths"].append(len(value))

        if isinstance(value, list):
            record["list_lengths"].append(len(value))
            return

        if isinstance(value, dict):
            return

        # Scalars: keep distinct values so enums reveal themselves.
        if value in record["values"]:
            return
        if len(record["values"]) < self.keep_values:
            record["values"].append(value)
        else:
            record["truncated"] = True

    def walk(self, node, path=""):
        if isinstance(node, dict):
            # Visiting this object means every key below it had a chance
            # to be present, which is the denominator for PRESENT.
            self.record(path)["visits"] += 1

            for key, value in node.items():
                child = f"{path}.{key}" if path else key
                record = self.record(child)
                record["count"] += 1
                self.note_value(record, value)
                self.walk(value, child)

        elif isinstance(node, list):
            item_path = f"{path}[]"
            for item in node:
                record = self.record(item_path)
                record["count"] += 1
                self.note_value(record, item)
                self.walk(item, item_path)

    def parent_total(self, path):
        """
        How many times this path's container was seen, so PRESENT reads
        as "appeared / could have appeared".
        """
        if "." not in path and not path.endswith("[]"):
            return self.root_entries

        if path.endswith("[]"):
            parent = path[:-2]
            return self.stats.get(parent, {}).get("count", 0) or self.root_entries

        parent = path.rsplit(".", 1)[0]
        parent_record = self.stats.get(parent)
        if not parent_record:
            return self.root_entries
        # A list parent is counted per item, a dict parent per visit.
        return parent_record["visits"] or parent_record["count"]

    def describe_values(self, record):
        """
        A field can hold more than one kind of thing, so this reports
        every part rather than the first one that matches.

        That matters: level_progression[].spell_slots is list|null, and an
        earlier version reported only "always: null" from the null side
        while silently hiding the 1200 integers on the list side.
        """
        kinds = set(record["types"])
        parts = []

        if record["list_lengths"]:
            low = min(record["list_lengths"])
            high = max(record["list_lengths"])
            empties = sum(1 for n in record["list_lengths"] if n == 0)
            text = f"len {low}" if low == high else f"len {low}-{high}"
            if empties:
                text += f", {empties} empty"
            parts.append(text)

        # A container that is sometimes missing entirely: worth saying
        # outright, since "always: null" reads as if it were never set.
        if record["values"] == [None] and kinds - {"null"}:
            parts.append("sometimes null")

        # Long strings are normally summarised by length, but raising
        # --max-samples is an explicit request to see them, so honour it.
        elif (record["str_lengths"] and max(record["str_lengths"]) > PROSE_LENGTH
                and self.max_values <= ENUM_LIMIT):
            parts.append(f"<text {min(record['str_lengths'])}-{max(record['str_lengths'])} chars>")

        elif record["values"]:
            shown = sorted(record["values"], key=lambda v: str(v))

            if len(shown) <= self.max_values and not record["truncated"]:
                label = "enum: " if len(shown) > 1 else "always: "
                parts.append(label + ", ".join(json.dumps(v) for v in shown))
            else:
                kept = shown[:self.max_values]
                more = (" … +many more" if record["truncated"]
                        else f" … +{len(shown) - len(kept)} more")
                parts.append(", ".join(json.dumps(v) for v in kept) + more)

        return " · ".join(parts)

    def report(self, only_path=None, max_depth=None):
        lines = []
        paths = sorted(p for p in self.stats if p)

        if only_path:
            prefix = only_path.rstrip(".")
            paths = [p for p in paths if p == prefix or p.startswith(prefix)]

        if max_depth:
            # Depth is how many dotted segments a path has; the []
            # markers are part of a segment, not a level of their own.
            paths = [p for p in paths if p.replace("[]", "").count(".") + 1 <= max_depth]

        width = min(max((len(p) for p in paths), default=4) + 2, 76)

        lines.append(f"{'PATH'.ljust(width)}{'PRESENT'.ljust(11)}{'TYPES'.ljust(16)}VALUES")
        lines.append("-" * (width + 11 + 16 + 40))

        for path in paths:
            record = self.stats[path]

            if path.endswith("[]"):
                # A list ITEM has no "could have appeared" count — every item
                # that exists appeared. A ratio here would be nonsense, so
                # report the raw tally instead.
                present = f"{record['count']} items"
            else:
                total = self.parent_total(path)
                present = f"{record['count']}/{total}" if total else str(record["count"])
                # Mark the ones most likely to bite: present sometimes, not always.
                if total and record["count"] < total:
                    present += " ?"

            types = "|".join(
                name for name, _ in record["types"].most_common()
            )

            # A path longer than the column still needs a gap after it, or
            # it runs straight into the next column.
            label = path.ljust(width) if len(path) < width else path + "  "

            lines.append(
                label
                + present.ljust(11)
                + types.ljust(16)
                + self.describe_values(record)
            )

        return "\n".join(lines)


# A dict file keyed ONLY by these is an edition split (the class files),
# where keeping the key in the path is more useful than merging.
EDITION_KEYS = {"one", "classic"}


def load_one(path):
    candidates = [path]
    if not path.endswith(".json"):
        candidates.append(path + ".json")

    for candidate in candidates:
        if os.path.isfile(candidate):
            with open(candidate, "r", encoding="utf-8") as handle:
                return json.load(handle), candidate

    raise SystemExit(f"not found: {' or '.join(candidates)}")


def gather(path):
    """
    Every file to inspect, as [(label, data)].

    A folder means "merge every .json inside", which is how the class
    files — one per class — get reported as a single combined shape.
    """
    if os.path.isdir(path):
        files = sorted(name for name in os.listdir(path) if name.endswith(".json"))
        if not files:
            raise SystemExit(f"no .json files in {path}")
        loaded = []
        for name in files:
            with open(os.path.join(path, name), "r", encoding="utf-8") as handle:
                loaded.append((name, json.load(handle)))
        return loaded

    data, name = load_one(path)
    return [(name, data)]


def entries_for(data):
    """The list of records to walk, plus a description of the root shape."""
    if isinstance(data, list):
        return data, f"list of {len(data)} entries"

    if isinstance(data, dict):
        keys = set(data)
        if keys and keys <= EDITION_KEYS:
            # Walk the whole dict as one record so "one" and "classic"
            # stay visible as path prefixes.
            return [data], f"editions: {', '.join(sorted(keys))}"
        shape = f"dict with {len(data)} top-level keys: {', '.join(list(data)[:8])}"
        if len(data) > 8:
            shape += ", …"
        return list(data.values()), shape

    raise SystemExit(f"root is a {type_name(data)}, expected a list or dict")


def main():
    parser = argparse.ArgumentParser(description="Inspect a catalogue file's key structure.")
    parser.add_argument("file", help="path to a JSON file (.json optional) or a folder of them")
    parser.add_argument("--path", help="only report this subtree, e.g. traits or one.class")
    parser.add_argument("--depth", type=int,
                        help="only report paths this many levels deep or less")
    parser.add_argument("--max-samples", type=int, default=ENUM_LIMIT,
                        help=f"distinct values to PRINT per key (default {ENUM_LIMIT}); "
                             f"raise it to dump a long value list in full")
    args = parser.parse_args()

    sources = gather(args.file)
    inspector = Inspector(max_values=args.max_samples)

    total_entries = 0
    shapes = []

    for label, data in sources:
        entries, shape = entries_for(data)
        shapes.append((label, shape))
        total_entries += len(entries)
        for entry in entries:
            inspector.walk(entry)

    inspector.root_entries = total_entries

    if len(sources) == 1:
        label, shape = shapes[0]
        print(f"=== {label} ===")
        print(f"root: {shape}")
    else:
        print(f"=== {args.file} — {len(sources)} files merged ===")
        print(f"root: {total_entries} entries total")
        for label, shape in shapes:
            print(f"  {label}: {shape}")

    print()
    print(inspector.report(only_path=args.path, max_depth=args.depth))
    print()
    print("'?' marks a key that is sometimes absent. Two types on one row means "
          "the field changes shape between entries.")


if __name__ == "__main__":
    main()