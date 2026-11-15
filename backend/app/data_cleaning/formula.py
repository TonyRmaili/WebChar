"""Formulas: how the data says a number that depends on the character.

A value in the cleaned data is one of:

    1                                       a plain number
    "pb"  "8 + con_mod + pb"  "level / 2"   a formula
    "2d6"                                   dice (only where dice are allowed)
    {"1": "2d6", "6": "3d6", "11": "4d6"}   a level table: the entry for the
                                            highest level reached applies

Formulas may only use these words, so a formula typed into the app can never
run code. They are read with Python's own parser (ast) and every piece is
checked against the whitelist; `eval` is never used.

    numbers, + - * / ( ), max(…), min(…)
    pb, level
    class_level                             the level in the class the feature comes from
    str dex con int wis cha                 ability scores
    str_mod dex_mod … cha_mod               ability modifiers
    spell_mod                               the feature's spellcasting modifier

Division always rounds down, like 5e.
"""

import ast
import re

ABILITIES = ["str", "dex", "con", "int", "wis", "cha"]
WORDS = {"pb", "level", "class_level", "spell_mod", *ABILITIES, *(f"{a}_mod" for a in ABILITIES)}
FUNCTIONS = {"max", "min"}

DICE_RE = re.compile(r"^\s*(\d+)\s*d\s*(\d+)\s*$")


class FormulaError(ValueError):
    pass


# Words one entry may use on top of WORDS: a class's table columns
# ("martial_arts", "sneak_attack"). Set only while that entry is checked
# (`with extra_words(...)`), so no other entry can use them.
EXTRA_WORDS: set[str] = set()
EXTRA_DICE: set[str] = set()     # columns whose values are dice: allowed where dice go


class extra_words:
    def __init__(self, words=(), dice=()):
        self.words, self.dice = set(words), set(dice)

    def __enter__(self):
        EXTRA_WORDS.update(self.words)
        EXTRA_DICE.update(self.dice)

    def __exit__(self, *exc):
        EXTRA_WORDS.clear()
        EXTRA_DICE.clear()


# ---------- checking ----------

def _walk(node: ast.AST) -> None:
    """Raise FormulaError for anything outside the whitelist."""
    if isinstance(node, ast.Expression):
        return _walk(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
        return
    if isinstance(node, ast.Name):
        if node.id not in WORDS and node.id not in EXTRA_WORDS:
            raise FormulaError(f"unknown word '{node.id}' (allowed: {', '.join(sorted(WORDS))})")
        return
    if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv)):
        _walk(node.left)
        _walk(node.right)
        return
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
        return _walk(node.operand)
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in FUNCTIONS and not node.keywords:
        if len(node.args) < 2:
            raise FormulaError(f"{node.func.id}() needs at least two values")
        for a in node.args:
            _walk(a)
        return
    what = {"Pow": "**", "Mod": "%", "Attribute": "a dot (.)", "Call": "that function"}.get(
        type(getattr(node, "op", node)).__name__ if isinstance(node, ast.BinOp) else type(node).__name__,
        type(node).__name__)
    raise FormulaError(f"{what} is not allowed in a formula")


def _parse(expr: str) -> ast.Expression:
    if not isinstance(expr, str) or not expr.strip():
        raise FormulaError("empty formula")
    if len(expr) > 120:
        raise FormulaError("formula too long")
    try:
        tree = ast.parse(expr.strip(), mode="eval")
    except SyntaxError:
        raise FormulaError(f"can't read formula '{expr}'")
    _walk(tree)
    return tree


def check_formula(expr) -> None:
    """A plain number or a formula string."""
    if isinstance(expr, (int, float)) and not isinstance(expr, bool):
        return
    _parse(expr)


def is_dice(expr) -> bool:
    return isinstance(expr, str) and (DICE_RE.match(expr) is not None or expr.strip() in EXTRA_DICE)


def check_dice(expr) -> None:
    if not is_dice(expr):
        raise FormulaError(f"'{expr}' is not dice like '2d6'")


def check_value(value, dice: bool = False) -> None:
    """Check a value: number, formula, (dice,) or a level table of those."""
    one = check_dice if dice else check_formula
    if isinstance(value, dict):
        if not value:
            raise FormulaError("empty level table")
        for lvl, v in value.items():
            if not str(lvl).isdigit() or not 1 <= int(lvl) <= 30:
                raise FormulaError(f"level table key '{lvl}' is not a level")
            one(v)
        return
    one(value)


# ---------- working out ----------

def _eval(node: ast.AST, ctx: dict) -> int:
    if isinstance(node, ast.Expression):
        return _eval(node.body, ctx)
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name):
        if node.id not in ctx:
            raise FormulaError(f"no value for '{node.id}'")
        return ctx[node.id]
    if isinstance(node, ast.UnaryOp):
        v = _eval(node.operand, ctx)
        return -v if isinstance(node.op, ast.USub) else v
    if isinstance(node, ast.BinOp):
        a, b = _eval(node.left, ctx), _eval(node.right, ctx)
        if isinstance(node.op, ast.Add):
            return a + b
        if isinstance(node.op, ast.Sub):
            return a - b
        if isinstance(node.op, ast.Mult):
            return a * b
        return a // b  # 5e rounds down
    if isinstance(node, ast.Call):
        vals = [_eval(a, ctx) for a in node.args]
        return max(vals) if node.func.id == "max" else min(vals)
    raise FormulaError("bad formula")


def at_level(value, level: int):
    """Pick the level table entry that applies (the highest level reached)."""
    if not isinstance(value, dict):
        return value
    reached = [int(k) for k in value if int(k) <= level]
    return value[str(max(reached))] if reached else None


def evaluate(value, ctx: dict):
    """The number for a character. ctx has pb, level, scores and mods.
    Dice come back as they are ("3d6"), already picked for the level."""
    v = at_level(value, ctx.get("level", 1))
    if v is None or isinstance(v, (int, float)):
        return v
    if is_dice(v):
        return v.replace(" ", "")
    return int(_eval(_parse(v), ctx))


def context_for(level: int, scores: dict, spell_ability: str | None = None) -> dict:
    """Build ctx from a level and {"str": 15, …}."""
    ctx = {"level": level, "pb": 2 + (level - 1) // 4}
    for a in ABILITIES:
        ctx[a] = scores.get(a, 10)
        ctx[f"{a}_mod"] = (ctx[a] - 10) // 2
    ctx["spell_mod"] = ctx[f"{spell_ability}_mod"] if spell_ability else 0
    return ctx
