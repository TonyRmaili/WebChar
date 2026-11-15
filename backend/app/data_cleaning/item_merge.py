"""Make a real item from a base item and a magic variant.

    merge(base, variant) -> item

"Flame Tongue" + "Greatsword" -> "Flame Tongue Greatsword": the base's
weapon or armor stats, weight and price, plus everything the variant gives
(bonus, rarity, attunement, charges, resistances, features, text). The
result is an ordinary item (kind "item") with `made_from`, so it can be
rebuilt if the data changes. The backend uses this when a player picks a
variant; it never puts a bare variant on a character sheet.

Try it on the finished data (free):

    py -m app.data_cleaning.item_merge "Flame Tongue|XDMG" "Greatsword|XPHB"
"""

import ast
import copy
import operator

from .cleaners.common_cleaner import cp_to_money

COIN_CP = {"pp": 1000, "gp": 100, "ep": 50, "sp": 10, "cp": 1}
OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv}


def _cp(money: dict | None) -> int | None:
    if not money or "formula" in money:
        return None
    return sum(COIN_CP.get(k, 0) * v for k, v in money.items())


def _calc(formula: str, base: float) -> float | None:
    """"base * 4", "base + 50000" (copper) with only numbers, `base`, + - * /."""
    def ev(n):
        if isinstance(n, ast.Expression):
            return ev(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return n.value
        if isinstance(n, ast.Name) and n.id == "base":
            return base
        if isinstance(n, ast.BinOp) and type(n.op) in OPS:
            return OPS[type(n.op)](ev(n.left), ev(n.right))
        raise ValueError(formula)
    try:
        return ev(ast.parse(formula, mode="eval"))
    except (ValueError, SyntaxError):
        return None


def _fill(text: str, base_name: str, base: dict) -> str:
    dtype = ((base.get("weapon") or {}).get("damage") or {}).get("type") or ""
    return (text.replace("{base_lower}", base_name.lower()).replace("{base}", base_name)
            .replace("{base_damage_type_lower}", dtype).replace("{base_damage_type}", dtype))


def _union(a: list | None, b: list | None) -> list | None:
    out = list(dict.fromkeys((a or []) + (b or [])))
    return out or None


def _merge_grants(a: dict, b: dict) -> dict:
    out = copy.deepcopy(a or {})
    for k, v in (b or {}).items():
        if isinstance(v, list):
            out[k] = (out.get(k) or []) + [x for x in v if x not in (out.get(k) or [])]
        elif isinstance(v, dict) and isinstance(out.get(k), dict):
            for kk, vv in v.items():
                if isinstance(vv, list):
                    out[k][kk] = list(dict.fromkeys((out[k].get(kk) or []) + vv))
                else:
                    out[k][kk] = vv
        else:
            out[k] = copy.deepcopy(v)
    return out


def merge(base: dict, variant: dict) -> dict:
    if base["id"] not in (variant.get("applies_to") or []):
        raise ValueError(f"{variant['name']} can't be made from {base['name']}")
    base_name = base["name"]
    if variant.get("name_remove"):
        base_name = base_name.replace(variant["name_remove"], "").strip()
    name = variant["name_format"].replace("{base}", base_name).strip()

    item = {
        "id": f"{variant['id']}--{base['id']}",
        "kind": "item",
        "name": name,
        "source": variant["source"],
        "edition": variant["edition"],
        "made_from": {"base": base["id"], "variant": variant["id"]},
    }
    if variant.get("srd"):
        item["srd"] = variant["srd"]
    texts = [t for t in (_fill(variant.get("text") or "", base_name, base), base.get("text")) if t]
    item["text"] = "\n\n".join(texts)
    item["item_types"] = _union(base.get("item_types"), variant.get("item_types"))
    for k in ("rarity", "tier", "attunement", "charges", "light", "focus", "focus_type", "curse", "sentient"):
        v = variant.get(k, base.get(k))
        if v is not None:
            item[k] = copy.deepcopy(v)
    if base.get("weight") is not None:
        item["weight"] = base["weight"]
    value = variant.get("value")
    if value and "formula" in value:
        cp = _calc(value["formula"], _cp(base.get("value")) or 0)
        if cp is not None:
            item["value"] = cp_to_money(int(round(cp)))
    elif value:
        item["value"] = value
    elif base.get("value"):
        item["value"] = base["value"]

    if base.get("weapon"):
        w = copy.deepcopy(base["weapon"])
        vb = (variant.get("weapon") or {}).get("bonus")
        if vb:
            w["bonus"] = vb
        w["properties"] = _union(w.get("properties"), variant.get("properties_add"))
        item["weapon"] = {k: v for k, v in w.items() if v is not None}
    if base.get("armor"):
        a = copy.deepcopy(base["armor"])
        a.update(variant.get("armor_overrides") or {})
        if not a.get("strength"):
            a.pop("strength", None)          # 0 = the variant removes the requirement (Mithral)
        item["armor"] = {k: v for k, v in a.items() if v is not None}
    mods = (base.get("modifiers") or []) + (variant.get("modifiers") or [])
    if mods:
        item["modifiers"] = copy.deepcopy(mods)
    item["grants"] = _merge_grants(base.get("grants"), variant.get("grants"))
    item["choices"] = copy.deepcopy(variant.get("choices") or [])
    item["features"] = copy.deepcopy((variant.get("features") or []) + (base.get("features") or []))
    item["item_tags"] = _union(base.get("item_tags"), variant.get("item_tags"))
    extra = {**(base.get("extra") or {}), **{k: v for k, v in (variant.get("extra") or {}).items()
                                               if k != "weight_formula"}}
    if extra:
        item["extra"] = extra
    return {k: v for k, v in item.items() if v not in (None, [], {})}


if __name__ == "__main__":
    import json
    import sys

    from .cleaners.common_cleaner import ref_id
    from .data_files import CLEANED_PATH, FINAL_PATH, read_list

    if len(sys.argv) != 3:
        print('usage: py -m app.data_cleaning.item_merge "Flame Tongue|XDMG" "Greatsword|XPHB"')
        sys.exit(1)
    # finished items first (with their features), then the SRD set, then the
    # cleaned ones (no features yet) for anything not finished
    by_id = {}
    for stage, cat in ((CLEANED_PATH, "items"), (FINAL_PATH, "items_srd"), (FINAL_PATH, "items")):
        for e in read_list(stage, cat):
            by_id[e["id"]] = e
    v, b = by_id.get(ref_id(sys.argv[1])), by_id.get(ref_id(sys.argv[2]))
    if not v or not b:
        print("not found:", sys.argv[1] if not v else sys.argv[2])
        sys.exit(1)
    try:
        m = merge(b, v)
    except ValueError as err:
        print(err)
        sys.exit(1)
    m.pop("_book", None)
    print(json.dumps(m, indent=2, ensure_ascii=False))