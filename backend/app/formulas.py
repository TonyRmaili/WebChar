"""The formula calculator: turns a value from the data into a number or dice.

A value in the data (data-model §2 "Formulas") is one of three things:

    a number        3
    a formula       "8 + con_mod + pb"   "max(1, wis_mod)"   "2d8 + spell_mod"
    a level table   {"1": "1d6", "5": "2d6", "11": "3d6"}

evaluate(value, words, level=None) gives back:

    an int          when it works out to a plain number           -> 14
    a dice string   when there are dice in it                     -> "2d8+3"
    None            when a word is unknown or it can't be read    -> the sheet
                    shows the formula as words and the dice tower skips it

`words` holds what each word means for this character: pb, level,
class_level, str .. cha, str_mod .. cha_mod, spell_mod, spell_level, and a
class's table columns (sneak_attack: "3d6", focus_points: 5). A word may
be a number or dice.

`level` picks the row of a level table: the highest row at or below it.
Which level that is (character or class level) is the caller's choice.

Only these are allowed, so nothing in the data can run code:
numbers, dice (NdM), words, + - * /, brackets, max(), min().
Division always rounds down (the 5e rule). Dice can be added or
subtracted, and multiplied by a plain number ("2 * 1d6"); anything else
with dice gives None.

The same rules and the same test cases live in src/utils/formulas.js.
"""

import re

_TOKEN = re.compile(r"\s*(?:(\d*d\d+)|(\d+)|([a-z_][a-z0-9_]*)|(.))", re.I)
_DICE = re.compile(r"^(\d*)d(\d+)$", re.I)
_FUNCS = {"max": max, "min": min}


class _Bad(Exception):
    """Anything the calculator can't read: an unknown word, a bad shape."""


# A value while working: a plain number, or {"flat": n, "dice": {size: count}}.
def _num(v):
    return isinstance(v, int) and not isinstance(v, bool)


def _as_dice(v):
    return v if isinstance(v, dict) else {"flat": v, "dice": {}}


def _parse_dice(text):
    m = _DICE.match(text.strip())
    if not m:
        raise _Bad(text)
    count = int(m.group(1) or 1)
    return {"flat": 0, "dice": {int(m.group(2)): count}}


def _word_value(name, words):
    if name not in words or words[name] is None:
        raise _Bad(name)
    v = words[name]
    if isinstance(v, bool):
        raise _Bad(name)
    if _num(v):
        return v
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, str):
        if v.strip().lstrip("-").isdigit():
            return int(v)
        return _parse_dice(v)
    raise _Bad(name)


def _add(a, b, sign=1):
    if _num(a) and _num(b):
        return a + sign * b
    a, b = _as_dice(a), _as_dice(b)
    dice = dict(a["dice"])
    for size, count in b["dice"].items():
        dice[size] = dice.get(size, 0) + sign * count
    return {"flat": a["flat"] + sign * b["flat"], "dice": dice}


def _mul(a, b):
    if _num(a) and _num(b):
        return a * b
    if _num(a) and isinstance(b, dict):
        a, b = b, a
    if isinstance(a, dict) and _num(b):
        return {"flat": a["flat"] * b, "dice": {s: c * b for s, c in a["dice"].items()}}
    raise _Bad("dice * dice")


def _div(a, b):
    if not (_num(a) and _num(b)) or b == 0:
        raise _Bad("division")
    return a // b  # rounds down


class _Parser:
    def __init__(self, text, words):
        self.tokens = []
        pos = 0
        text = text.strip()
        while pos < len(text):
            m = _TOKEN.match(text, pos)
            if not m or m.end() == pos:
                raise _Bad(text)
            pos = m.end()
            dice, number, word, other = m.groups()
            if dice:
                self.tokens.append(("dice", dice))
            elif number:
                self.tokens.append(("num", int(number)))
            elif word:
                self.tokens.append(("word", word.lower()))
            elif other and other.strip():
                if other not in "+-*/(),":
                    raise _Bad(other)
                self.tokens.append(("op", other))
        self.i = 0
        self.words = words

    def peek(self):
        return self.tokens[self.i] if self.i < len(self.tokens) else (None, None)

    def take(self, op=None):
        tok = self.peek()
        if op is not None and tok != ("op", op):
            raise _Bad(f"expected {op}")
        self.i += 1
        return tok

    def run(self):
        value = self.expr()
        if self.i != len(self.tokens):
            raise _Bad("left over")
        return value

    def expr(self):
        value = self.term()
        while self.peek() in (("op", "+"), ("op", "-")):
            sign = 1 if self.take()[1] == "+" else -1
            value = _add(value, self.term(), sign)
        return value

    def term(self):
        value = self.factor()
        while self.peek() in (("op", "*"), ("op", "/")):
            op = self.take()[1]
            right = self.factor()
            value = _mul(value, right) if op == "*" else _div(value, right)
        return value

    def factor(self):
        kind, val = self.take()
        if kind == "num":
            return val
        if kind == "dice":
            return _parse_dice(val)
        if kind == "op" and val == "-":
            return _mul(self.factor(), -1)
        if kind == "op" and val == "(":
            value = self.expr()
            self.take(")")
            return value
        if kind == "word":
            if val in _FUNCS and self.peek() == ("op", "("):
                self.take("(")
                args = [self.expr()]
                while self.peek() == ("op", ","):
                    self.take(",")
                    args.append(self.expr())
                self.take(")")
                if not all(_num(a) for a in args):
                    raise _Bad("max/min of dice")
                return _FUNCS[val](args)
            return _word_value(val, self.words)
        raise _Bad(str(val))


def _finish(v):
    """A working value -> int or "2d8+3" (dice largest first)."""
    if _num(v):
        return v
    dice = {s: c for s, c in v["dice"].items() if c}
    if any(c < 0 for c in dice.values()):
        return None
    if not dice:
        return v["flat"]
    text = "+".join(f"{c}d{s}" for s, c in sorted(dice.items(), key=lambda x: -x[0]))
    flat = v["flat"]
    return f"{text}{'+' if flat > 0 else '-'}{abs(flat)}" if flat else text


def table_row(table, level):
    """The value for `level` in {"1": …, "5": …}: the highest row at or below it."""
    if level is None:
        return None
    best = None
    for key, value in table.items():
        try:
            row = int(key)
        except (TypeError, ValueError):
            continue
        if row <= level and (best is None or row > best[0]):
            best = (row, value)
    return best[1] if best else None


def evaluate(value, words=None, level=None):
    """A number, a dice string ("2d8+3"), or None. See the module notes."""
    words = words or {}
    if isinstance(value, bool) or value is None:
        return None
    if _num(value):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() else None
    if isinstance(value, dict):
        row = table_row(value, level)
        return None if row is None else evaluate(row, words, level)
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return _finish(_Parser(value, words).run())
    except (_Bad, RecursionError):
        return None


def words_used(value):
    """The words a value uses, e.g. to see what a feature depends on."""
    if isinstance(value, dict):
        return sorted({w for v in value.values() for w in words_used(v)})
    if not isinstance(value, str):
        return []
    found = {m.group(3).lower() for m in _TOKEN.finditer(value) if m.group(3)}
    return sorted(found - set(_FUNCS))
