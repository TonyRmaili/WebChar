import os
from file_handler import FileHandler
from open_ai_api import OpenAIApi
import re
import copy
from collections import defaultdict, Counter
import json
from schemas.monsters_schema import CleanedData, Effects

class _CycleError(Exception):
    pass


class MonsterCleaner:
    def __init__(self):
        self.raw_path = "raw_data/monsters"
        self.output_path = "output/monsters"
        self.instructions_path = "instructions/monsters"
        self.filehandler = FileHandler()


        self._AT_TAG = re.compile(r"\{@\w+\s+([^}]+)\}")
        self._SENSE_RE = re.compile(r"^([A-Za-z]+)\s+(\d+)\s*ft", re.IGNORECASE)

        self.removable_keywords = [
            "miscTags",
            "hasToken",
            "hasFluff",
            "hasFluffImages",
            "page",
            "tokenCredit",
            "tokenCustom",
            "srd52",
            "srd",
            "basicRules2024",
            "basicRules",
            "soundClip",
            "otherSources",         
            "altArt",
            "referenceSources",
            "shortName",
            "isReprinted",
            "reprintedAs",
            "dragonAge",
            "languageTags",
            "senseTags",
            "spellcastingTags",
            "isNamedCreature",
            "damageTagsLegendary",
            "alignmentPrefix",
            "group",
            "alias",
            "dragonCastingColor",
            "sizeNote",
            "damageTags",
            "damageTagsSpell",
            "pbNote"


        ]

        self.sizes = {
            "L": "Large",
            "M": "Medium",
            "S": "Small",
            "H": "Huge",
            "T": "Tiny",
            "G": "Gargantuan"        
        }

        self.alignments = {
            "C": "Chaotic",
            "L": "Lawful",
            "N": "Neutral",
            "G": "Good",
            "E": "Evil",
            "U": "Unaligned",
            "A": "Any"
        }


        self.CR_STATS = {
            "0":  {"xp": 10,     "pb": 2},
            "1/8":{"xp": 25,     "pb": 2},
            "1/4":{"xp": 50,     "pb": 2},
            "1/2":{"xp": 100,    "pb": 2},

            "1":  {"xp": 200,    "pb": 2},
            "2":  {"xp": 450,    "pb": 2},
            "3":  {"xp": 700,    "pb": 2},
            "4":  {"xp": 1100,   "pb": 2},

            "5":  {"xp": 1800,   "pb": 3},
            "6":  {"xp": 2300,   "pb": 3},
            "7":  {"xp": 2900,   "pb": 3},
            "8":  {"xp": 3900,   "pb": 3},

            "9":  {"xp": 5000,   "pb": 4},
            "10": {"xp": 5900,   "pb": 4},
            "11": {"xp": 7200,   "pb": 4},
            "12": {"xp": 8400,   "pb": 4},

            "13": {"xp": 10000,  "pb": 5},
            "14": {"xp": 11500,  "pb": 5},
            "15": {"xp": 13000,  "pb": 5},
            "16": {"xp": 15000,  "pb": 5},

            "17": {"xp": 18000,  "pb": 6},
            "18": {"xp": 20000,  "pb": 6},
            "19": {"xp": 22000,  "pb": 6},
            "20": {"xp": 25000,  "pb": 6},

            "21": {"xp": 33000,  "pb": 7},
            "22": {"xp": 41000,  "pb": 7},
            "23": {"xp": 50000,  "pb": 7},
            "24": {"xp": 62000,  "pb": 7},

            "25": {"xp": 75000,  "pb": 8},
            "26": {"xp": 90000,  "pb": 8},
            "27": {"xp": 105000, "pb": 8},
            "28": {"xp": 120000, "pb": 8},

            "29": {"xp": 135000, "pb": 9},
            "30": {"xp": 155000, "pb": 9},
        }


    # inspect methods
    def inspect_dict_key(self,data,keyname):
        unique_keys = []
        for mon in data:
            if keyname in mon:
                if isinstance(mon[keyname],dict):
                    for key, val in mon[keyname].items():
                        if key not in unique_keys:
                            unique_keys.append(key)

                elif isinstance(mon[keyname],int):
                    print(mon["name"],mon["source"])
                elif isinstance(mon[keyname],list):
                    print(mon["name"],mon["source"])

        print(unique_keys)

    def inspect_list_key(self,data,keyname):
        unique_keys = []
        for mon in data:
            if keyname in mon:
                if isinstance(mon[keyname],list):
                    for val in mon[keyname]:
                        if val not in unique_keys:
                            unique_keys.append(val)

        print(unique_keys)

    def track_toplevel_keywords(self, data):
        keywords = []
        for mon in data:
            for key in mon.keys():
                if key not in keywords:
                    keywords.append(key)

        # savepath = os.path.join(self.output_path,"keywords")
        # self.filehandler.save_json(savepath,keywords)


        print(keywords)

    def scan_notes(self, data):
        counts   = Counter()
        shapes   = Counter()
        examples = {"actionNote": [], "reactionNote": []}

        for mon in data:
            for key in ("actionNote", "reactionNote"):
                val = mon.get(key)
                if val is None:
                    continue
                counts[key] += 1
                shapes[(key, type(val).__name__)] += 1
                if len(examples[key]) < 6:
                    examples[key].append((mon.get("name"), mon.get("source"), val))

        print("=== action/reaction note scan ===\n")
        print("presence counts:")
        for k, n in counts.items():
            print(f"  {k:<14} {n}")
        print("\nshapes:")
        for (k, t), n in shapes.items():
            print(f"  {k:<14} {t:<10} {n}")
        for key, exs in examples.items():
            if not exs: continue
            print(f"\nexamples — {key}:")
            for name, src, val in exs:
                v = val if isinstance(val, str) else repr(val)
                v = v if len(v) < 200 else v[:200] + "…"
                print(f"  ({name!r}, {src!r}): {v}")

    def scan_copies(self, data):
            """Inspect-only. Reports the shape of every _copy/_mod in the data
            so the resolver can be written against what actually exists."""

            # build the lookup the resolver will use: (name, source) -> monster
            index = {}
            for mon in data:
                index[(mon.get("name"), mon.get("source"))] = mon

            copies          = [m for m in data if "_copy" in m]
            mode_targets    = defaultdict(set)      # mode -> {target keys it acts on}
            mode_counts     = Counter()             # mode -> how many times seen
            items_shapes    = defaultdict(Counter)  # mode -> {"single","list","absent"}
            replacetxt_pats = []                    # every replaceTxt replace/with pair
            wildcard_modes  = set()                 # modes ever used with "*" target
            missing_bases   = []                    # copies whose base isn't loaded
            chained         = []                    # base that itself has _copy
            no_mod          = []                    # _copy with no _mod (pure inherit)
            top_level_keys  = Counter()             # child keys that overlay the base

            for mon in copies:
                cp   = mon["_copy"]
                ident = (mon.get("name"), mon.get("source"))
                base_key = (cp.get("name"), cp.get("source"))

                base = index.get(base_key)
                if base is None:
                    missing_bases.append({"child": ident, "wanted_base": base_key})
                elif "_copy" in base:
                    chained.append({"child": ident, "base": base_key})

                # which of the child's own keys would overlay the base
                for k in mon:
                    if k not in ("_copy",):
                        top_level_keys[k] += 1

                mod = cp.get("_mod")
                if not mod:
                    no_mod.append(ident)
                    continue

                for target, instr in mod.items():
                    instr_list = instr if isinstance(instr, list) else [instr]
                    for step in instr_list:
                        if not isinstance(step, dict):
                            mode_counts["<non-dict instruction>"] += 1
                            continue
                        mode = step.get("mode", "<no mode key>")
                        mode_counts[mode] += 1
                        mode_targets[mode].add(target)
                        if target == "*":
                            wildcard_modes.add(mode)

                        if "items" in step:
                            it = step["items"]
                            shape = "list" if isinstance(it, list) else "single"
                            items_shapes[mode][shape] += 1
                        else:
                            items_shapes[mode]["absent"] += 1

                        if mode == "replaceTxt":
                            replacetxt_pats.append({
                                "replace": step.get("replace"),
                                "with":    step.get("with"),
                                "target":  target,
                                "flags":   step.get("flags"),
                            })

            # ---- report ----
            print("=== _copy scan ===")
            print(f"total monsters:        {len(data)}")
            print(f"monsters with _copy:   {len(copies)}")
            print(f"  of those, no _mod:   {len(no_mod)} (pure inherit + overlay)")
            print()

            print("--- _mod modes (count) ---")
            for mode, n in mode_counts.most_common():
                print(f"  {mode:<22} {n:>4}   targets={sorted(mode_targets[mode])}")
            print()

            print("--- items shape per mode ---")
            for mode, shapes in items_shapes.items():
                print(f"  {mode:<22} {dict(shapes)}")
            print()

            print(f"--- modes ever used with '*' wildcard target ---\n  {sorted(wildcard_modes)}")
            print()

            print("--- replaceTxt patterns ---")
            for p in replacetxt_pats:
                print(f"  target={p['target']!r}  /{p['replace']}/ -> {p['with']!r}  flags={p['flags']}")
            print()

            print(f"--- child top-level keys that overlay base (freq) ---")
            for k, n in top_level_keys.most_common():
                print(f"  {k:<22} {n:>4}")
            print()

            print(f"--- copy-of-copy chains (expected: none) ---  {len(chained)}")
            for c in chained:
                print(f"  {c}")
            print()

            print(f"--- copies whose base is NOT loaded (will be deleted) ---  {len(missing_bases)}")
            for m in missing_bases:
                print(f"  {m}")
            print()

            return {
                "modes":          dict(mode_counts),
                "mode_targets":   {k: sorted(v) for k, v in mode_targets.items()},
                "items_shapes":   {k: dict(v) for k, v in items_shapes.items()},
                "wildcard_modes": sorted(wildcard_modes),
                "replacetxt":     replacetxt_pats,
                "missing_bases":  missing_bases,
                "chained":        chained,
                "no_mod":         no_mod,
            }

    def scan_copy_unknowns(self, data):
        index = {(m.get("name"), m.get("source")): m for m in data}
        OPAQUE = {"replaceSpells", "addSpells", "removeSpells", "addSkills", "setProp"}

        for mon in data:
            cp = mon.get("_copy")
            if not cp or "_mod" not in cp:
                continue
            for target, instr in cp["_mod"].items():
                steps = instr if isinstance(instr, list) else [instr]
                for step in steps:
                    # Tier 3: non-dict instruction (string shorthand?)
                    if not isinstance(step, dict):
                        print(f"[NON-DICT] {(mon['name'], mon['source'])} "
                            f"target={target!r} value={step!r}")
                        continue
                    # Tier 2: opaque _-targeted modes
                    if step.get("mode") in OPAQUE:
                        print(f"[{step['mode']}] {(mon['name'], mon['source'])} "
                            f"target={target!r}\n"
                            f"{json.dumps(step, indent=2, ensure_ascii=False)}\n")

    def scan_legendary_copies(self, data):
        """Inspect-only. data = the list of entries in the legendary/lair file."""
        index = {(m.get("name"), m.get("source")): m for m in data}

        copies      = [m for m in data if "_copy" in m]
        mode_counts = Counter()
        mode_tgts   = defaultdict(set)
        item_shapes = defaultdict(Counter)
        chained     = []
        missing     = []
        no_mod      = []

        for mon in copies:
            cp    = mon["_copy"]
            ident = (mon.get("name"), mon.get("source"))
            bkey  = (cp.get("name"), cp.get("source"))

            base = index.get(bkey)
            if base is None:
                missing.append({"child": ident, "wanted": bkey})
            elif "_copy" in base:
                chained.append({"child": ident, "base": bkey})

            mod = cp.get("_mod")
            if not mod:
                no_mod.append(ident)
                continue

            for target, instr in mod.items():
                for step in (instr if isinstance(instr, list) else [instr]):
                    if not isinstance(step, dict):
                        mode_counts[f"<non-dict: {step!r}>"] += 1
                        continue
                    m = step.get("mode", "<no mode>")
                    mode_counts[m] += 1
                    mode_tgts[m].add(target)
                    if "items" in step:
                        it = step["items"]
                        item_shapes[m]["list" if isinstance(it, list) else "single"] += 1
                    else:
                        item_shapes[m]["absent"] += 1

        print("=== legendary/lair _copy scan ===")
        print(f"entries: {len(data)}  with _copy: {len(copies)}  no _mod: {len(no_mod)}\n")
        print("--- modes ---")
        for m, n in mode_counts.most_common():
            print(f"  {m:<22} {n:>3}  targets={sorted(mode_tgts[m])}")
        print("\n--- item shapes ---")
        for m, s in item_shapes.items():
            print(f"  {m:<22} {dict(s)}")
        print(f"\n--- chains (copy-of-copy) --- {len(chained)}")
        for c in chained: print(f"  {c}")
        print(f"\n--- missing bases (would be dropped) --- {len(missing)}")
        for x in missing: print(f"  {x}")

    def scan_gear(self, data):
        from collections import Counter
        elem_types  = Counter()        # type name of each list element
        part_counts = Counter()        # how many '|'-separated parts the strings have
        examples    = {1: [], 3: [], 4: [], "dict": [], "other": []}
        both_keys   = []               # monsters with both gear AND attachedItems
        overlap     = []               # the items that overlap, if any

        for mon in data:
            gear   = mon.get("gear")
            attach = mon.get("attachedItems")
            ident  = (mon.get("name"), mon.get("source"))

            if gear and attach:
                both_keys.append(ident)
                shared = set(gear) & set(attach)
                if shared:
                    overlap.append({"monster": ident, "shared": list(shared)})

            for key in ("gear", "attachedItems"):
                for el in mon.get(key) or []:
                    if isinstance(el, str):
                        n = len(el.split("|"))
                        part_counts[n] += 1
                        if n != 2 and len(examples.get(n, [])) < 5:
                            examples.setdefault(n, []).append((ident, key, el))
                    elif isinstance(el, dict):
                        elem_types["dict"] += 1
                        if len(examples["dict"]) < 5:
                            examples["dict"].append((ident, key, el))
                    else:
                        elem_types["other"] += 1
                        if len(examples["other"]) < 5:
                            examples["other"].append((ident, key, type(el).__name__))

                if mon.get(key) is not None:
                    elem_types[f"{key}:present"] += 1

        print("=== gear / attachedItems scan ===\n")
        print("presence counts:")
        for k, n in elem_types.most_common():
            print(f"  {k:<22} {n}")
        print("\nstring '|'-part counts:")
        for n, c in sorted(part_counts.items()):
            print(f"  {n} parts: {c}")
        for n, exs in examples.items():
            if not exs: continue
            print(f"\nexamples for {n}-part / {n}:")
            for e in exs:
                print(f"  {e}")
        print(f"\nmonsters with BOTH keys: {len(both_keys)}")
        for b in both_keys[:10]:
            print(f"  {b}")
        print(f"\noverlapping items across both keys: {len(overlap)}")
        for o in overlap[:10]:
            print(f"  {o}")

    def scan_variants_versions(self, data):
        from collections import Counter, defaultdict

        has_variant   = 0
        has_versions  = 0
        both          = 0
        variant_only  = []
        versions_only = []

        variant_inner_types = Counter()   # type field of variant blocks
        variant_keys        = Counter()   # other keys on a variant entry
        versions_keys       = Counter()   # keys on a _versions entry
        versions_mod_modes  = Counter()
        versions_mod_tgts   = defaultdict(set)
        pairings            = []          # per-monster (variant names, version names)
        name_overlap        = Counter()   # exact, prefix, none
        base_field          = Counter()   # does _versions specify a base?

        for mon in data:
            v   = mon.get("variant")
            ver = mon.get("_versions")
            if v is not None and isinstance(v, list):   has_variant  += 1
            if ver is not None and isinstance(ver, list): has_versions += 1

            if v and ver:
                both += 1
                v_names   = [x.get("name") for x in v if isinstance(x, dict)]
                ver_names = [x.get("name") for x in ver if isinstance(x, dict)]
                pairings.append({
                    "monster":  (mon.get("name"), mon.get("source")),
                    "variants": v_names,
                    "versions": ver_names,
                })
                # how do their names relate?
                for vn in v_names:
                    if not vn: continue
                    if vn in ver_names:
                        name_overlap["exact"] += 1
                    elif any(vn.rstrip("s") in ven or ven in vn for ven in ver_names if ven):
                        name_overlap["prefix_or_contains"] += 1
                    else:
                        name_overlap["no_match"] += 1
            elif v and not ver:
                variant_only.append((mon.get("name"), mon.get("source")))
            elif ver and not v:
                versions_only.append((mon.get("name"), mon.get("source")))

            for entry in (v or []):
                if not isinstance(entry, dict): continue
                variant_inner_types[entry.get("type")] += 1
                for k in entry: variant_keys[k] += 1

            for entry in (ver or []):
                if not isinstance(entry, dict): continue
                for k in entry: versions_keys[k] += 1
                # does it specify its own base?
                base_field["has_source" if "source" in entry else "no_source"] += 1
                mod = entry.get("_mod") or {}
                for target, instr in mod.items():
                    for step in (instr if isinstance(instr, list) else [instr]):
                        if isinstance(step, dict):
                            versions_mod_modes[step.get("mode")] += 1
                            versions_mod_tgts[step.get("mode")].add(target)
                        else:
                            versions_mod_modes[f"<non-dict: {step!r}>"] += 1

        print("=== variant / _versions scan ===\n")
        print(f"with variant:   {has_variant}")
        print(f"with _versions: {has_versions}")
        print(f"with BOTH:      {both}")
        print(f"variant only:   {len(variant_only)}  e.g. {variant_only[:6]}")
        print(f"versions only:  {len(versions_only)} e.g. {versions_only[:6]}")
        print()

        print("--- variant block: inner 'type' field ---")
        for t, n in variant_inner_types.most_common(): print(f"  {t!r:<14} {n}")
        print("\n--- variant block: keys present ---")
        for k, n in variant_keys.most_common(): print(f"  {k:<18} {n}")

        print("\n--- _versions block: keys present ---")
        for k, n in versions_keys.most_common(): print(f"  {k:<18} {n}")
        print(f"\n--- _versions: own source field ---")
        for k, n in base_field.items(): print(f"  {k}: {n}")

        print("\n--- _versions _mod modes ---")
        for m, n in versions_mod_modes.most_common():
            print(f"  {m!r:<22} {n}  targets={sorted(versions_mod_tgts.get(m, []))}")

        print(f"\n--- name overlap (variant vs versions, on monsters with both) ---")
        for k, n in name_overlap.most_common(): print(f"  {k}: {n}")

        print(f"\n--- sample pairings ---")
        for p in pairings[:8]:
            print(f"  {p['monster']}:")
            print(f"     variant : {p['variants']}")
            print(f"     versions: {p['versions']}")

    def scan_rename_arr(self, data):
        """Quick peek at renameArr payload shape before implementing it."""
        seen = 0
        for mon in data:
            for v in mon.get("_versions") or []:
                for target, instr in (v.get("_mod") or {}).items():
                    for step in (instr if isinstance(instr, list) else [instr]):
                        if isinstance(step, dict) and step.get("mode") == "renameArr":
                            print(f"{mon['name']} -> {v['name']}: target={target}")
                            print(json.dumps(step, indent=2))
                            seen += 1
                            if seen >= 3:
                                return

    def scan_version_variant_values(self, data):
        null_count, nonnull = 0, []
        for mon in data:
            for v in mon.get("_versions") or []:
                if "variant" not in v:
                    continue
                if v["variant"] is None:
                    null_count += 1
                else:
                    nonnull.append({
                        "parent":  (mon.get("name"), mon.get("source")),
                        "version": v.get("name"),
                        "variant": v["variant"],
                    })

        print(f"variant: null     : {null_count}")
        print(f"variant: non-null : {len(nonnull)}")
        for n in nonnull[:5]:
            print(f"  {n['parent']} -> {n['version']}:")
            print(f"    {n['variant']}")

    def scan_spellcasting(self, data):
        """Reports the full shape of spellcasting across the dataset.
        Run before designing the Pydantic schema."""

        monsters_with_sc = 0
        blocks_per_mon   = Counter()        # 0, 1, 2, 3 spellcasting entries
        block_types      = Counter()        # the `type` field on each block
        block_keys       = Counter()        # every top-level key seen on a block
        block_key_per_type = defaultdict(Counter)

        bucket_keys      = Counter()        # `will`, `daily`, `spells`, ...
        daily_subkeys    = Counter()        # "1", "3", "1e", "3e", ...
        spells_subkeys   = Counter()        # spell level keys: "0", "1", ... "9"
        spells_inner     = Counter()        # keys inside spells.{lvl}: slots, spells, lower
        will_item_shape  = Counter()        # str vs dict for will entries
        daily_item_shape = Counter()
        spells_item_shape= Counter()

        header_dc_pattern = 0               # blocks whose headerEntries contains "{@dc"
        header_hit_pattern = 0              # blocks whose headerEntries contains "{@hit"
        ability_values   = Counter()
        display_as_seen  = []

        weird_keys       = defaultdict(list)  # any key we don't recognize -> examples
        KNOWN_BLOCK_KEYS = {
            "name", "type", "headerEntries", "footerEntries",
            "ability", "displayAs", "hidden",
            "will", "daily", "rest", "spells", "ritual", "weekly", "yearly",
            "chargesItem",
        }

        def _classify_item(item, bag, shape):
            if isinstance(item, str):
                shape["str"] += 1
            elif isinstance(item, dict):
                shape["dict"] += 1
                bag.update(item.keys())
            else:
                shape[type(item).__name__] += 1

        will_dict_keys   = Counter()
        daily_dict_keys  = Counter()
        spells_dict_keys = Counter()

        for mon in data:
            sc = mon.get("spellcasting")
            if not sc:
                continue
            monsters_with_sc += 1
            if not isinstance(sc, list):
                blocks_per_mon["<not_a_list>"] += 1
                continue
            blocks_per_mon[len(sc)] += 1

            for block in sc:
                if not isinstance(block, dict):
                    continue
                block_types[block.get("type", "<missing>")] += 1
                t = block.get("type", "<missing>")
                for k in block.keys():
                    block_keys[k] += 1
                    block_key_per_type[t][k] += 1
                    if k not in KNOWN_BLOCK_KEYS and len(weird_keys[k]) < 3:
                        weird_keys[k].append((mon.get("name"), mon.get("source")))

                # ability
                if "ability" in block:
                    ability_values[block["ability"]] += 1

                # header DC / hit
                header = " ".join(block.get("headerEntries") or [])
                if "{@dc" in header: header_dc_pattern += 1
                if "{@hit" in header: header_hit_pattern += 1

                # displayAs
                if "displayAs" in block and len(display_as_seen) < 5:
                    display_as_seen.append((mon.get("name"), mon.get("source"),
                                            block["displayAs"]))

                # buckets
                for bk in block:
                    if bk in ("name","type","headerEntries","footerEntries",
                            "ability","displayAs","hidden","chargesItem"):
                        continue
                    bucket_keys[bk] += 1

                # will: list of items
                if isinstance(block.get("will"), list):
                    for it in block["will"]:
                        _classify_item(it, will_dict_keys, will_item_shape)

                # daily: { "1": [...], "3e": [...], ... }
                daily = block.get("daily")
                if isinstance(daily, dict):
                    for k, lst in daily.items():
                        daily_subkeys[k] += 1
                        if isinstance(lst, list):
                            for it in lst:
                                _classify_item(it, daily_dict_keys, daily_item_shape)

                # spells: { "0": {...}, "1": {...}, ... }
                spells = block.get("spells")
                if isinstance(spells, dict):
                    for lvl, lvl_block in spells.items():
                        spells_subkeys[lvl] += 1
                        if isinstance(lvl_block, dict):
                            spells_inner.update(lvl_block.keys())
                            lst = lvl_block.get("spells", [])
                            if isinstance(lst, list):
                                for it in lst:
                                    _classify_item(it, spells_dict_keys, spells_item_shape)

        print("=== spellcasting scan ===\n")
        print(f"monsters with spellcasting: {monsters_with_sc}")
        print(f"\nblocks per monster (count distribution):")
        for k, n in blocks_per_mon.most_common():
            print(f"  {k}: {n}")

        print(f"\nblock 'type' field values:")
        for t, n in block_types.most_common():
            print(f"  {t!r:<22} {n}")

        print(f"\nall block keys (count):")
        for k, n in block_keys.most_common():
            marker = "" if k in KNOWN_BLOCK_KEYS else "  <-- UNEXPECTED"
            print(f"  {k:<18} {n}{marker}")

        print(f"\nblock keys broken down by block type:")
        for t, keys in block_key_per_type.items():
            print(f"  type={t!r}")
            for k, n in keys.most_common():
                print(f"    {k:<16} {n}")

        print(f"\nbucket keys (top-level usage buckets seen on blocks):")
        for k, n in bucket_keys.most_common():
            print(f"  {k:<12} {n}")

        print(f"\n'daily' subkeys ('1', '3', '1e', '3e', ...):")
        for k, n in daily_subkeys.most_common():
            print(f"  {k!r:<6} {n}")

        print(f"\n'spells' subkeys (spell level keys):")
        for k, n in sorted(spells_subkeys.items()):
            print(f"  level {k}: {n}")

        print(f"\nkeys inside spells.{{level}}:")
        for k, n in spells_inner.most_common():
            print(f"  {k:<8} {n}")

        print(f"\nitem shapes — will:    {dict(will_item_shape)}")
        print(f"item shapes — daily:   {dict(daily_item_shape)}")
        print(f"item shapes — spells:  {dict(spells_item_shape)}")

        if will_dict_keys or daily_dict_keys or spells_dict_keys:
            print(f"\nkeys seen on DICT-shaped items (when items aren't bare strings):")
            if will_dict_keys:   print(f"  will:   {dict(will_dict_keys)}")
            if daily_dict_keys:  print(f"  daily:  {dict(daily_dict_keys)}")
            if spells_dict_keys: print(f"  spells: {dict(spells_dict_keys)}")

        print(f"\nheaderEntries contains DC pattern: {header_dc_pattern}")
        print(f"headerEntries contains hit pattern: {header_hit_pattern}")

        print(f"\nability field values:")
        for ab, n in ability_values.most_common():
            print(f"  {ab!r:<8} {n}")

        if display_as_seen:
            print(f"\n'displayAs' samples (cross-reference to another monster?):")
            for ex in display_as_seen:
                print(f"  {ex}")

        if weird_keys:
            print(f"\nUNEXPECTED block keys with sample monsters:")
            for k, exs in weird_keys.items():
                print(f"  {k!r}: {exs}")


    def scan_multiblock_compatibility(self, data):
        same, different = 0, []
        for mon in data:
            sc = mon.get("spellcasting") or []
            if len(sc) < 2:
                continue
            abilities = {b.get("ability") for b in sc if isinstance(b, dict)}
            if len(abilities) == 1:
                same += 1
            else:
                different.append({
                    "monster":   (mon.get("name"), mon.get("source")),
                    "abilities": sorted(a or "<none>" for a in abilities),  # <-- fix
                })
        print(f"multi-block with SAME ability across all blocks: {same}")
        print(f"multi-block with DIFFERENT abilities: {len(different)}")
        for d in different[:15]:
            print(f"  {d}")

    # Main methods
    def gather_all_monsters(self):
        monsters = []
        for file in os.listdir(self.raw_path):
            name ,ext = os.path.splitext(file)

            if name != "legendarygroups":
                path = os.path.join(self.raw_path,name)


                data = self.filehandler.load_json(path)

               
                for monster in data["monster"]:
                    monsters.append(monster)

        return monsters

    def remove_keywords(self,data):
        for mon in data:
            for key in list(mon.keys()):
                if key in self.removable_keywords:
                    del mon[key]

    def rename_sizes(self,data):
        for mon in data:
            new_sizes = []
            if "size" in mon:
                for size in mon["size"]:
                    new_sizes.append(self.sizes[size])

            mon["size"] = new_sizes

    def gather_type_tags(self,data):
        tags = {
            "prefix":[],
            "sufix": []
        }

        for mon in data:
            if "type" in mon:
                if isinstance(mon["type"],str):
                    if mon["type"] not in tags["prefix"]:
                        tags["prefix"].append(mon["type"])

                elif isinstance(mon["type"],dict):
                    if "type" in mon["type"]:
                        if mon["type"]["type"] not in tags["prefix"] and isinstance(mon["type"]["type"],str):
                            tags["prefix"].append(mon["type"]["type"])

                    if "tags" in mon["type"]:
                        for tag in mon["type"]["tags"]:
                            if tag not in tags["sufix"] and isinstance(tag, str):
                                tags["sufix"].append(tag)



        path = os.path.join(self.output_path,"types")
        self.filehandler.save_json(path,tags)

    def gather_action_trait_tags(self, data):
        unique_tags = []
        for mon in data:
            traits = mon.get("traitTags",None)
            actions = mon.get("actionTags",None)

            if traits:
                for tag in traits:
                    if tag not in unique_tags:
                        unique_tags.append(tag)
            if actions:
                for tag in actions:
                    if tag not in unique_tags:
                        unique_tags.append(tag)

        savepath = os.path.join(self.output_path,"trait_tags")
        self.filehandler.save_json(savepath,unique_tags)


    def _strip_planar(self, tag):
        """'planar, feywild' -> 'feywild'. Leaves non-planar tags untouched."""
        if isinstance(tag, str) and tag.startswith("planar,"):
            return tag.split(",", 1)[1].strip()
        return tag

    def gather_environment_tags(self, data):
        unique_tags = []
        for mon in data:
            envs = mon.get("environment")
            if not envs:
                continue
            cleaned = [self._strip_planar(t) for t in envs]
            mon["environment"] = cleaned             # mutate the monster too
            for tag in cleaned:
                if tag not in unique_tags:
                    unique_tags.append(tag)

        savepath = os.path.join(self.output_path, "environment_tags")
        self.filehandler.save_json(savepath, unique_tags)


    def _decode_alignment_codes(self, codes):
        """['N', 'E'] -> 'Neutral Evil'. Unknown codes (NX, NY, ...) are dropped.
        Returns None if nothing usable remains."""
        words = [self.alignments[c] for c in codes if c in self.alignments]
        return " ".join(words) if words else None

    def rename_alignments(self, data):
        for mon in data:
            raw = mon.get("alignment")
            if not raw:
                continue

            options = []      # OR-list of human-readable alignments
            flat_codes = []    # bare letter codes -> one single alignment

            for entry in raw:
                if isinstance(entry, str):
                    flat_codes.append(entry)
                elif isinstance(entry, dict):
                    # 'special'-only entries are skipped; 'chance'/'note' ignored
                    if "alignment" in entry:
                        decoded = self._decode_alignment_codes(entry["alignment"])
                        if decoded:
                            options.append(decoded)

            # the bare codes (if any) collapse into one alignment, prepended
            if flat_codes:
                decoded = self._decode_alignment_codes(flat_codes)
                if decoded:
                    options.insert(0, decoded)

            # dedupe, preserve order
            seen, cleaned = set(), []
            for o in options:
                if o not in seen:
                    seen.add(o)
                    cleaned.append(o)

            mon["alignment"] = cleaned or None

    def _strip_at_notation(self, text):
        """{@item studded leather armor|phb|studded leather} -> 'studded leather'.
        3+ parts -> display (parts[2]); else -> name (parts[0])."""
        if not isinstance(text, str):
            return text
        def repl(m):
            parts = m.group(1).split("|")
            return parts[2] if len(parts) >= 3 else parts[0]
        return self._AT_TAG.sub(repl, text).strip()

    def _normalize_ac_entry(self, entry):
        base = {"value": None, "from": [], "condition": None, "special": None}

        if isinstance(entry, int):
            base["value"] = entry
            return base

        if isinstance(entry, dict):
            if "special" in entry:
                base["special"] = self._strip_at_notation(entry["special"])
                return base
            if "ac" in entry:
                base["value"] = entry["ac"]
            if entry.get("from"):
                base["from"] = [self._strip_at_notation(f) for f in entry["from"]]
            if entry.get("condition"):
                base["condition"] = self._strip_at_notation(entry["condition"])
            return base

        return None  # unknown shape -> caller drops it

    def clean_ac(self, data):
        for mon in data:
            raw = mon.get("ac")
            if not raw:
                continue
            if not isinstance(raw, list):   # defensive; 5etools always uses a list
                raw = [raw]

            cleaned = []
            for entry in raw:
                norm = self._normalize_ac_entry(entry)
                if norm is not None:
                    cleaned.append(norm)

            mon["ac"] = cleaned or None

    def clean_hp(self, data):
        for mon in data:
            hp = mon.get("hp")
            if not isinstance(hp, dict):
                continue
            special = hp.get("special")
            if not special or not isinstance(special, str):
                continue

            # 1. strip 5etools tags  {@dice 17d8 + 51} -> 17d8 + 51
            text = self._strip_at_notation(special)
            # 2. collapse whitespace (also cleans doubles left by stripping)
            text = re.sub(r"\s+", " ", text).strip()
            # 3. ensure a space after a leading em dash: —(immune…) -> — (immune…)
            text = re.sub(r"—(?=\S)", "— ", text)

            # numeric-only specials are really just HP values -> move to average
            if re.fullmatch(r"\d+", text):
                hp["average"] = int(text)
                hp["special"] = None
            else:
                hp["special"] = text

    def _parse_save(self, raw):
        """'+9' -> 9, '-1' -> -1. None/garbage -> None."""
        if not isinstance(raw, str):
            return None
        try:
            return int(raw.replace("+", "").strip())
        except ValueError:
            return None

    def clean_ability_scores(self, data):
        abilities = ("str", "dex", "con", "int", "wis", "cha")
        for mon in data:
            scores = {ab: mon.pop(ab, None) for ab in abilities}
            saves  = mon.pop("save", None) or {}

            block = {}
            for ab in abilities:
                score = scores[ab]
                mod = (score - 10) // 2 if isinstance(score, int) else None

                proficient = ab in saves
                save_val = self._parse_save(saves.get(ab)) if proficient else mod

                block[ab] = {
                    "score":      score,
                    "proficient": proficient,
                    "expertise":  False,
                    "mod":        mod,
                    "save":       save_val,
                }

            mon["ability_scores"] = block

    def clean_senses(self, data):
        for mon in data:
            raw = mon.get("senses")
            if not raw:
                continue
            if not isinstance(raw, list):
                raw = [raw]

            result, notes = {}, []
            for entry in raw:
                text = self._strip_at_notation(entry)
                text = re.sub(r"\s+", " ", text).strip()

                m = self._SENSE_RE.match(text)
                if m:
                    key = m.group(1).lower()          # darkvision, blindsight, …
                    result[key] = int(m.group(2))     # the ft value as int
                    extra = text[m.end():].strip(" .")
                    if extra:
                        notes.append(f"{key.capitalize()}: {extra.strip('()')}")
                else:
                    notes.append(text)                # no "<word> <n> ft" -> all note

            if notes:
                result["note"] = "; ".join(notes)

            mon["senses"] = result or None

    def rename_passive_perception(self,data):
        for mon in data:
            if "passive" in mon:
                mon["passive_perception"] = mon.pop("passive")


    def _cr_stats(self, rating):
        stats = self.CR_STATS.get(rating)
        return (stats["xp"], stats["pb"]) if stats else (None, None)

    def clean_cr(self, data):
        for mon in data:
            raw = mon.get("cr")
            level = mon.get("level",None)
            if raw is None and level is None:
                continue

            if isinstance(raw, dict):
                base  = raw.get("cr")
                lair  = raw.get("lair")
                coven = raw.get("coven")
            else:
                base, lair, coven = raw, None, None

            xp, pb      = self._cr_stats(base)
            xp_lair, _  = self._cr_stats(lair)
            xp_coven, _ = self._cr_stats(coven)

            mon["cr"] = {
                "base":     base,
                "xp":       xp,
                "pb":       pb,
                "lair":     lair,
                "xp_lair":  xp_lair,
                "coven":    coven,
                "xp_coven": xp_coven,
                "level": level
            }

            if "level" in mon:
                del mon["level"]


# --- Resolve Copy Methods -----------------

    def _js_repl_to_py(self, s):
        """JS replacement '$1goblin' -> Python r'\\1goblin'. Literal $ stays."""
        return re.sub(r"\$(\d)", r"\\\1", s) if isinstance(s, str) else s

    def _walk_strings(self, obj, fn):
        """Apply fn to every string leaf, in place, recursively."""
        if isinstance(obj, dict):
            for k, v in obj.items():
                obj[k] = fn(v) if isinstance(v, str) else (self._walk_strings(v, fn) or v)
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                obj[i] = fn(v) if isinstance(v, str) else (self._walk_strings(v, fn) or v)
        return obj

    def _match_name(self, arr, name):
        for i, el in enumerate(arr):
            if isinstance(el, dict) and el.get("name") == name:
                return i
        return -1

    def _as_list(self, x):
        return x if isinstance(x, list) else [x]

    def _apply_spell_mod(self, sc, step):
        """replace/add/removeSpells against raw spellcasting shape
        (spells.{lvl}, daily.{1e|3e}, will)."""
        if not isinstance(sc, dict):
            return
        mode = step["mode"]

        def buckets():
            for grp in ("spells", "daily"):
                if isinstance(step.get(grp), dict):
                    for key, payload in step[grp].items():
                        yield grp, key, payload
            if "will" in step:
                yield "will", None, step["will"]

        for grp, key, payload in buckets():
            if grp == "will":
                tgt = sc.setdefault("will", [])
            else:
                tgt = sc.setdefault(grp, {})
                if grp == "spells" and isinstance(payload, dict):
                    payload = payload.get("spells", [])
                tgt = tgt.setdefault(key, [] if mode != "replaceSpells"
                                    else tgt.get(key, []))
                if isinstance(tgt, dict):
                    tgt = tgt.setdefault("spells", [])

            if mode == "addSpells":
                tgt.extend(self._as_list(payload))
            elif mode == "removeSpells":
                rm = set(self._as_list(payload))
                tgt[:] = [s for s in tgt if s not in rm]
            elif mode == "replaceSpells":
                for pair in self._as_list(payload):
                    for j, s in enumerate(tgt):
                        if s == pair.get("replace"):
                            tgt[j] = pair.get("with")

    def _apply_mod(self, base, mod):
        for target, instr in mod.items():            # dict-insertion order (#5)
            for step in self._as_list(instr):

                if step == "remove":                  # Tier-3 shorthand
                    base.pop(target, None)
                    continue
                if not isinstance(step, dict):
                    continue

                mode = step.get("mode")

                if mode == "replaceTxt":              # #4: all strings
                    pat = re.compile(step["replace"],
                                    re.IGNORECASE if step.get("flags") == "i" else 0)
                    rep = self._js_repl_to_py(step["with"])
                    self._walk_strings(base, lambda s: pat.sub(rep, s))
                    continue

                if mode == "setProp":
                    base[step["prop"]] = step.get("value")
                    continue
                if mode == "addSkills":               # #3: raw merge
                    sk = base.setdefault("skill", {})
                    for s, v in step["skills"].items():
                        sk[s] = v
                    continue
                if mode in ("replaceSpells", "addSpells", "removeSpells"):
                    self._apply_spell_mod(base.get("spellcasting"), step)
                    continue

                arr = base.get(target)                # array ops
                if not isinstance(arr, list):
                    arr = base[target] = []
                items = step.get("items")
                if mode == "appendArr":
                    arr.extend(self._as_list(items))
                elif mode == "prependArr":
                    base[target] = self._as_list(items) + arr
                elif mode == "insertArr":
                    arr[step.get("index", 0):step.get("index", 0)] = self._as_list(items)
                elif mode == "replaceArr":
                    idx = self._match_name(arr, step.get("replace"))
                    if idx != -1:
                        arr[idx:idx+1] = self._as_list(items)
                elif mode == "removeArr":
                    names = {step["replace"]} if "replace" in step \
                            else set(self._as_list(step.get("names", [])))
                    base[target] = [e for e in arr
                                    if not (isinstance(e, dict) and e.get("name") in names)]
                elif mode == "appendIfNotExistsArr":
                    have = {e.get("name") for e in arr if isinstance(e, dict)}
                    arr.extend(it for it in self._as_list(items)
                            if not (isinstance(it, dict) and it.get("name") in have))
                    
                elif mode == "renameArr":
                    renames = step.get("renames") or {}
                    old = renames.get("rename")
                    new = renames.get("with")
                    idx = self._match_name(arr, old)
                    if idx != -1 and new is not None:
                        arr[idx]["name"] = new

    def resolve_copies(self, data):
        index = {(m.get("name"), m.get("source")): m for m in data}
        resolved, dropped = {}, []

        def resolve(mon, stack):
            ident = (mon.get("name"), mon.get("source"))
            if ident in resolved:
                return resolved[ident]
            if "_copy" not in mon:
                resolved[ident] = mon
                return mon
            if ident in stack:
                raise _CycleError(ident)

            cp = mon["_copy"]
            base_src = index.get((cp.get("name"), cp.get("source")))
            if base_src is None:
                raise _CycleError(("MISSING", ident))

            base_resolved = resolve(base_src, stack | {ident})   # #2 recursive
            merged = copy.deepcopy(base_resolved)
            merged.pop("_copy", None)

            if cp.get("_mod"):
                self._apply_mod(merged, cp["_mod"])

            for k, v in mon.items():                             # child overlays
                if k != "_copy":
                    merged[k] = v
            merged.pop("_copy", None)

            resolved[ident] = merged
            return merged

        out = []
        for mon in data:
            try:
                out.append(resolve(mon, frozenset()))
            except _CycleError as e:
                dropped.append(e.args[0])

        if dropped:
            print(f"[resolve_copies] dropped {len(dropped)} (missing base / cycle):")
            for d in dropped:
                print(f"  {d}")

        return out

    def resolve_versions(self, data):
        """Expand _versions into sibling monsters. Returns new list.
        Must run BEFORE all clean_* methods (operates on raw shapes)."""
        expanded = []
        for parent in data:
            versions = parent.pop("_versions", None)
            if not versions:
                continue
            for ver in versions:
                if not isinstance(ver, dict):
                    continue
                child = copy.deepcopy(parent)
                child.pop("variant", None) 
                mod = ver.get("_mod")
                if mod:
                    self._apply_mod(child, mod)
                for k, v in ver.items():
                    if k in ("_mod", "variant"):
                        continue
                    child[k] = v
                expanded.append(child)
        return data + expanded
# ----------------------------------------


    def sort_by_source(self, data):
        sources_data = {}
        for mon in data:
            source = mon.get("source")
            if not source:
                continue
            sources_data.setdefault(source, []).append(mon)

        for name, mon_data in sources_data.items():
            path = os.path.join(self.output_path, "source_books", name)
            self.filehandler.save_json(path, mon_data)

    def resolve_legendary_copies(self, data):
        """In-place. data = list of entries in the legendary/lair file.
        Scan-verified: only prepend/appendArr, list items, no chains, no missing bases."""
        index = {(m.get("name"), m.get("source")): m for m in data}

        for entry in data:
            cp = entry.get("_copy")
            if not cp:
                continue

            base = index.get((cp.get("name"), cp.get("source")))
            if base is None:                       # scan says 0; defensive only
                print(f"[legendary] missing base for "
                    f"{(entry.get('name'), entry.get('source'))} -> "
                    f"{(cp.get('name'), cp.get('source'))}; left as-is")
                continue

            merged = copy.deepcopy(base)
            merged.pop("_copy", None)              # base shouldn't have one (0 chains)

            for target, step in cp.get("_mod", {}).items():
                for s in self._as_list(step):      # scan shows single dict, list-safe anyway
                    items = self._as_list(s.get("items"))
                    arr = merged.get(target)
                    if not isinstance(arr, list):
                        arr = merged[target] = []
                    if s.get("mode") == "prependArr":
                        merged[target] = items + arr
                    elif s.get("mode") == "appendArr":
                        arr.extend(items)

            for k, v in entry.items():             # child overlays base
                if k != "_copy":
                    merged[k] = v
            merged.pop("_copy", None)

            entry.clear()                          # mutate the SAME dict in place
            entry.update(merged)                   # so list identity is preserved

    def append_legendary_groups(self, data):
        leg_path = os.path.join(self.raw_path, "legendarygroups")
        leg_data = self.filehandler.load_json(leg_path)["legendaryGroup"]

        self.resolve_legendary_copies(leg_data)        # in-place; no return to capture

        # index the (resolved) groups by (name, source)
        leg_index = {
            (g.get("name"), g.get("source")): g
            for g in leg_data
        }

        attached, missing = 0, []
        for mon in data:
            ref = mon.get("legendaryGroup")
            if not ref:
                continue                                # not a legendary creature

            key = (ref.get("name"), ref.get("source"))
            group = leg_index.get(key)
            if group is None:
                missing.append({"monster": (mon.get("name"), mon.get("source")),
                                "wanted_group": key})
                continue

            lair     = group.get("lairActions")
            regional = group.get("regionalEffects")
            mythic   = group.get("mythicEncounter")

            if lair is not None:
                mon["lairActions"] = lair
            if regional is not None:
                mon["regionalEffects"] = regional
            if mythic is not None:
                mon["mythicEncounter"] = mythic

            mon.pop("legendaryGroup", None)             # consumed -> strip the ref
            attached += 1

        print(f"[legendary] attached groups to {attached} monsters")
        if missing:
            print(f"[legendary] {len(missing)} monsters reference a missing group:")
            for m in missing:
                print(f"  {m}")

    def _clean_defense_list(self, raw):
        """Normalize an immune/resist/vulnerable/conditionImmune list."""
        if not isinstance(raw, list):
            return None

        types, conditional, special = [], [], None

        for entry in raw:
            if isinstance(entry, str):
                types.append(entry)
            elif isinstance(entry, dict):
                if "special" in entry:
                    special = self._strip_at_notation(entry["special"])
                    continue
                inner = entry.get("immune") or entry.get("resist") \
                    or entry.get("vulnerable") or entry.get("conditionImmune") or []
                note = entry.get("note") or entry.get("preNote")
                if note:
                    note = self._strip_at_notation(note).rstrip(":").strip()
                conditional.append({
                    "types": list(inner),
                    "note":  note,
                })

        return {
            "types":       types,
            "conditional": conditional,
            "special":     special,
        }

    def clean_defenses(self, data):
        pairs = [
            ("immune",         "immunities"),
            ("resist",         "resistances"),
            ("vulnerable",     "vulnerabilities"),
            ("conditionImmune","condition_immunities"),
        ]
        for mon in data:
            for src, dst in pairs:
                if src not in mon:
                    continue
                cleaned = self._clean_defense_list(mon.pop(src))
                if cleaned:
                    mon[dst] = cleaned

    def clean_initiative(self, data):
        for mon in data:
            raw = mon.get("initiative")                 # may be missing entirely

            dex_mod = mon.get("ability_scores", {}).get("dex", {}).get("mod")
            cr      = mon.get("cr") or {}
            pb      = cr.get("pb")

            if isinstance(raw, int):
                total, advantage = raw, False           # int overrides
            else:
                # dict, or absent — both go through the same calc with sensible defaults
                prof      = raw.get("proficiency", 0) if isinstance(raw, dict) else 0
                advantage = raw.get("advantageMode") == "adv" if isinstance(raw, dict) else False
                total     = None if dex_mod is None else dex_mod + (pb or 0) * prof

            mon["initiative"] = {"total": total, "advantage": advantage}

    def clean_inflict_and_forced_saves(self, data):
    
        merges = [
            ("condition_inflict",    ("conditionInflict", "conditionInflictSpell","conditionInflictLegendary")),
            ("forced_saving_throw",  ("savingThrowForced", "savingThrowForcedSpell","savingThrowForcedLegendary")),
        ]
        for mon in data:
            for new_key, sources in merges:
                combined, seen = [], set()
                present = False
                for src in sources:
                    if src not in mon:
                        continue
                    present = True
                    for v in mon.pop(src) or []:
                        if v not in seen:
                            seen.add(v)
                            combined.append(v)
                if present:
                    mon[new_key] = combined

    def _parse_gear_ref(self, ref):
        """'chain mail|xphb' -> ('chain mail', 'xphb')
        '+2 greataxe'     -> ('+2 greataxe', None)"""
        parts = ref.split("|", 1)
        name = parts[0].strip()
        source = parts[1].strip() if len(parts) == 2 and parts[1].strip() else None
        return name, source

    def clean_gear(self, data):
        for mon in data:
            gear   = mon.pop("gear", None) or []
            attach = mon.pop("attachedItems", None) or []
            raw    = gear + attach            # scan confirmed no overlap
            if not raw:
                continue

            cleaned = []
            for el in raw:
                if isinstance(el, str):
                    name, source = self._parse_gear_ref(el)
                    cleaned.append({"name": name, "source": source, "quantity": 1})
                elif isinstance(el, dict) and "item" in el:
                    name, source = self._parse_gear_ref(el["item"])
                    cleaned.append({
                        "name":     name,
                        "source":   source,
                        "quantity": el.get("quantity", 1),
                    })
                # silently skip unknown shapes — scan said none exist

            mon["gear"] = cleaned

    def clean_leg_action_points(self,data):
        for mon in data:
            legendary_action_points = {
                "legendary_actions":None,
                "lair_actions":None
            }
            leg_actions = mon.get("legendaryActions",None)
            lair_actions = mon.get("legendaryActionsLair", None)

            if "legendary" in mon:

                if not leg_actions:
                    legendary_action_points["legendary_actions"] = 3

                else:
                    legendary_action_points["legendary_actions"] = leg_actions
                    del mon["legendaryActions"]

                if lair_actions:
                    legendary_action_points["lair_actions"] = lair_actions
                    del mon["legendaryActionsLair"]

                mon["legendary_action_points"] = legendary_action_points

    def clean_summon(self, data):
        for mon in data:
            spell = mon.pop("summonedBySpell",      None)
            level = mon.pop("summonedBySpellLevel", None)
            cls   = mon.pop("summonedByClass",      None)

            if spell is None and level is None and cls is None:
                continue

            spell_name, spell_source = (None, None)
            if isinstance(spell, str):
                spell_name, spell_source = self._parse_gear_ref(spell)

            class_name, _ = (None, None)
            if isinstance(cls, str):
                class_name, _ = self._parse_gear_ref(cls)   # drop class source

            mon["summon"] = {
                "spell_name":   spell_name,
                "spell_level":  level,
                "spell_source": spell_source,
                "class":        class_name,
            }

    def _preprocess_spellcasting(self, blocks):
        """Pre-map source buckets to display labels so the LLM doesn't have to."""
        BUCKET_LABELS = {
            "will":     ("At will", None, False),
            "daily.1":  ("1/day", 1, False),
            "daily.2":  ("2/day", 2, False),
            "daily.3":  ("3/day", 3, False),
            "daily.1e": ("1/day each", 1, True),
            "daily.2e": ("2/day each", 2, True),
            "daily.3e": ("3/day each", 3, True),
        }
        ORDINAL = {1:"1st", 2:"2nd", 3:"3rd", 4:"4th", 5:"5th",
                6:"6th", 7:"7th", 8:"8th", 9:"9th"}

        pre = []
        for block in blocks:
            groups = []

            # at-will
            if isinstance(block.get("will"), list):
                groups.append({
                    "label": "At will", "uses": None, "each": False,
                    "raw_spells": block["will"],
                })

            # daily.{N|Ne}
            daily = block.get("daily") or {}
            for key in ("1","2","3","1e","2e","3e"):
                if key in daily:
                    label, uses, each = BUCKET_LABELS[f"daily.{key}"]
                    groups.append({
                        "label": label, "uses": uses, "each": each,
                        "raw_spells": daily[key],
                    })

            # spells.{level}
            spells = block.get("spells") or {}
            for lvl_key in sorted(spells.keys(), key=int):
                lvl = int(lvl_key)
                payload = spells[lvl_key]
                if lvl == 0:
                    groups.append({
                        "label": "Cantrips (at will)", "uses": None, "each": False,
                        "raw_spells": payload.get("spells", []),
                    })
                else:
                    slots = payload.get("slots", 0)
                    groups.append({
                        "label": f"{ORDINAL[lvl]} level ({slots} slots)",
                        "uses": slots, "each": False,
                        "raw_spells": payload.get("spells", []),
                    })

            pre.append({
                "name": block.get("name"),
                "ability": block.get("ability"),
                "headerEntries": block.get("headerEntries"),
                "footerEntries": block.get("footerEntries"),
                "groups": groups,
            })

        return pre

    def run_pre_LLM(self):
        data = self.gather_all_monsters()

        self.append_legendary_groups(data)

        self.remove_keywords(data)
        data = self.resolve_copies(data)
        data = self.resolve_versions(data)

        self.rename_sizes(data)
        self.gather_type_tags(data)
        self.rename_alignments(data)
        self.clean_ac(data)
        self.clean_hp(data)
        self.clean_ability_scores(data)
        self.clean_senses(data)
        self.rename_passive_perception(data)
        self.clean_cr(data)
        self.clean_defenses(data)

        self.gather_action_trait_tags(data)
        self.gather_environment_tags(data)

        self.clean_initiative(data)
        self.clean_inflict_and_forced_saves(data)
        self.clean_gear(data)
        self.clean_leg_action_points(data)
        self.clean_summon(data)

        
        # sorts and saves
        self.sort_by_source(data)

       
    def run_LLM_cleaning(self,source,break_counter,token_limit = 2000000):
        
        loadpath = os.path.join(self.output_path, "source_books", source)
        raw_data = self.filehandler.load_json(loadpath)

        cleaned_path = os.path.join(self.output_path,"cleaned_source_books",source)
        try:
            cleaned_monsters = self.filehandler.load_json(cleaned_path)

        except FileNotFoundError:
            cleaned_monsters = []


        effects_instructions = self.filehandler.load_md(
            os.path.join(self.instructions_path, "clean_effects.md")
        )
        spell_instructions = self.filehandler.load_md(
            os.path.join(self.instructions_path, "clean_spellcasting.md")
        )

        open_ai = OpenAIApi()

        counter = 0
        total_tokens = 0
        
        for raw_monster in raw_data:

            if total_tokens >= token_limit:
                break

            if counter >= break_counter:
                break

            already_done = any(
                cm["name"] == raw_monster["name"] for cm in cleaned_monsters
            )
            
            if already_done:
                continue   # this `continue` is in the outer loop — correct scope

            print(f"{raw_monster['name']} -{raw_monster["source"]} - {counter+1}/{len(raw_data)-len(cleaned_monsters)}")
            print(f"tokens {total_tokens}/{token_limit}")
            
            raw_keys = [
                "trait", "action", "bonus", "reaction", "legendary", "mythic",
                "legendaryHeader", "mythicHeader", "reactionHeader",
                "actionNote", "reactionNote",
                "lairActions", "regionalEffects",
            ]
            payload = {k: raw_monster[k] for k in raw_keys if k in raw_monster}

            spellcasting = raw_monster.get("spellcasting")
            instructions = effects_instructions
            text_format = Effects

            if spellcasting:
                payload["spellcasting"] = self._preprocess_spellcasting(spellcasting)
                instructions = f"{effects_instructions}\n\n{spell_instructions}"
                text_format = CleanedData

            messages = [
                {"role": "user", "content": json.dumps(payload, indent=2)},
            ]

            response, tokens = open_ai.parse(
                instructions=instructions,
                input=messages,
                reasoning="low",
                text_format=text_format,
                timeout=120.0,
            )

            for key in raw_keys:
                if key in raw_monster:
                    del raw_monster[key]

            if spellcasting:
                raw_monster.update(response)         
            else:
                raw_monster["effects"] = response    
                 
            cleaned_monsters.append(raw_monster)
            self.filehandler.save_json(cleaned_path, cleaned_monsters)

            counter += 1
            total_tokens += tokens


    # Post LLM CLEANING FIXES 
    def fix_effects(self,source_book):
        EFFECT_KEYS = [
            "actions", "bonus_actions", "reactions", "traits",
            "legendary_actions", "mythic_actions", "lair_actions", "regional_effects",
        ]

        path = os.path.join(self.output_path, "cleaned_source_books",source_book)
        data = self.filehandler.load_json(path)
        
        for monster in data:
            if "effects" in monster:
                continue  # already correct shape
            effects = {}
            for k in EFFECT_KEYS:
                if k in monster:
                    effects[k] = monster.pop(k)
            if effects:
                monster["effects"] = effects
        

        self.filehandler.save_json(path,data)


    def rec_clean(self,obj):
        """
        Recursively remove:
        - None
        - empty dicts {}
        - empty lists []
        """

        if isinstance(obj, dict):
            cleaned = {}

            for key, value in obj.items():
                cleaned_value = self.rec_clean(value)

                # Keep valid falsy values like 0 or False
                if cleaned_value is None:
                    continue

                if cleaned_value == {}:
                    continue

                if cleaned_value == []:
                    continue

                cleaned[key] = cleaned_value

            return cleaned

        elif isinstance(obj, list):
            cleaned_list = []

            for item in obj:
                cleaned_item = self.rec_clean(item)

                if cleaned_item is None:
                    continue

                if cleaned_item == {}:
                    continue

                if cleaned_item == []:
                    continue

                cleaned_list.append(cleaned_item)

            return cleaned_list

        else:
            return obj


    def strip_none_values(self):
        loadpath = os.path.join(self.output_path, "cleaned_source_books")
        savefolder = os.path.join(self.output_path,"stripped_source_books")
        os.makedirs(savefolder,exist_ok=True)

        for file in os.listdir(loadpath):
            name, ext = os.path.splitext(file)
            path = os.path.join(loadpath,name)
            data = self.filehandler.load_json(path)

            cleaned_data = self.rec_clean(data)

            savepath = os.path.join(savefolder, name)
            self.filehandler.save_json(savepath, cleaned_data)


    
    def get_toplevel_keys(self):

        keywords = []
        loadpath = os.path.join(self.output_path, "cleaned_source_books")

        for file in os.listdir(loadpath):
            name, ext = os.path.splitext(file)
            path = os.path.join(loadpath,name)
            data = self.filehandler.load_json(path)

            for mon in data:
                for key in mon.keys():
                    if key not in keywords:
                        keywords.append(key)



        savepath = os.path.join(self.output_path,"keywords")
        self.filehandler.save_json(savepath,keywords)



        
if __name__ == "__main__":
    cleaner = MonsterCleaner()
    # cleaner.gather_all_monsters()
    # cleaner.run_pre_LLM()

    # cleaner.get_toplevel_keys()

    
    # Got variants
        # BGDIA
        # BMT
        # CM
        # CoS
        # DoSI
        # DSotDQ
        # EGW
        # ERLW 
        # FTD
        # GGR
        # GoS
        # HotDQ
        # IDRotF
        # IMR
        # JttRC
        # KftGV
        # LLK
        # LMoP
        # LoX
        # MM
        # MOT
        # MPMM
        # MTF
        # NRH-AT
        # NRH-TCMC
        # Oota
        # OoW
        # PaBTSO
        # PoTA
        # PSA
        # PSI
        # PSK
        # PSX
        # PSZ
        # QftIS
        # RoT
        # SADS
        # SKT
        # TCE
        # TftYP
        # ToA
        # ToFW
        # VEoR
        # VGM
        # VRGR
        # WDH
        # WDMM
    
    cleaner.run_LLM_cleaning(source="XPHB",break_counter=100)

    # cleaner.fix_effects(source_book="XMM")

    
