/* ═══════════════════════════════════════════════════════════════════
   formulas.js — the formula calculator: a value from the data → a
   number or dice. The same rules and test cases as the backend's
   app/formulas.py, so both sides always agree.

   A value in the data (data-model §2 "Formulas") is one of:
     a number        3
     a formula       "8 + con_mod + pb"   "max(1, wis_mod)"   "2d8 + spell_mod"
     a level table   { "1": "1d6", "5": "2d6", "11": "3d6" }

   evaluate(value, words, level) gives back:
     a number        14
     a dice string   "2d8+3"
     null            a word is unknown or it can't be read: the sheet
                     shows the formula as words, the dice tower skips it

   `words`: what each word means for this character — pb, level,
   class_level, str … cha, str_mod … cha_mod, spell_mod, spell_level,
   a class's table columns (sneak_attack: "3d6"). A number or dice.
   `level` picks a level table's row: the highest at or below it.

   Only numbers, dice (NdM), words, + - * /, brackets, max() and min()
   are allowed. Division rounds down. Dice can be added, subtracted, and
   multiplied by a plain number; anything else with dice gives null.
   ═══════════════════════════════════════════════════════════════════ */

const TOKEN = /\s*(?:(\d*d\d+)|(\d+)|([a-z_][a-z0-9_]*)|(\S))/iy;
const DICE = /^(\d*)d(\d+)$/i;
const FUNCS = { max: Math.max, min: Math.min };

class Bad extends Error {}

const isNum = (v) => typeof v === "number" && Number.isInteger(v);
const asDice = (v) => (isNum(v) ? { flat: v, dice: new Map() } : v);

function parseDice(text) {
  const m = DICE.exec(String(text).trim());
  if (!m) throw new Bad(text);
  return { flat: 0, dice: new Map([[Number(m[2]), Number(m[1] || 1)]]) };
}

function wordValue(name, words) {
  const v = words[name];
  if (v == null || typeof v === "boolean") throw new Bad(name);
  if (typeof v === "number") {
    if (Number.isInteger(v)) return v;
    throw new Bad(name);
  }
  if (typeof v === "string") {
    if (/^\s*-?\d+\s*$/.test(v)) return Number(v);
    return parseDice(v);
  }
  throw new Bad(name);
}

function add(a, b, sign = 1) {
  if (isNum(a) && isNum(b)) return a + sign * b;
  const x = asDice(a);
  const y = asDice(b);
  const dice = new Map(x.dice);
  for (const [size, count] of y.dice) dice.set(size, (dice.get(size) || 0) + sign * count);
  return { flat: x.flat + sign * y.flat, dice };
}

function mul(a, b) {
  if (isNum(a) && isNum(b)) return a * b;
  if (isNum(a) && !isNum(b)) [a, b] = [b, a];
  if (!isNum(a) && isNum(b)) return { flat: a.flat * b, dice: new Map([...a.dice].map(([s, c]) => [s, c * b])) };
  throw new Bad("dice * dice");
}

function div(a, b) {
  if (!isNum(a) || !isNum(b) || b === 0) throw new Bad("division");
  return Math.floor(a / b); // rounds down
}

function tokenize(text) {
  const out = [];
  TOKEN.lastIndex = 0;
  const src = text.trim();
  while (TOKEN.lastIndex < src.length) {
    const m = TOKEN.exec(src);
    if (!m) throw new Bad(text);
    if (m[1]) out.push(["dice", m[1]]);
    else if (m[2]) out.push(["num", Number(m[2])]);
    else if (m[3]) out.push(["word", m[3].toLowerCase()]);
    else if (m[4]) {
      if (!"+-*/(),".includes(m[4])) throw new Bad(m[4]);
      out.push(["op", m[4]]);
    }
  }
  return out;
}

function parse(text, words) {
  const tokens = tokenize(text);
  let i = 0;
  const peek = () => tokens[i] || [null, null];
  const isOp = (op) => peek()[0] === "op" && peek()[1] === op;
  const take = (op) => {
    if (op != null && !isOp(op)) throw new Bad(`expected ${op}`);
    return tokens[i++] || [null, null];
  };

  function expr() {
    let v = term();
    while (isOp("+") || isOp("-")) {
      const sign = take()[1] === "+" ? 1 : -1;
      v = add(v, term(), sign);
    }
    return v;
  }
  function term() {
    let v = factor();
    while (isOp("*") || isOp("/")) {
      const op = take()[1];
      const right = factor();
      v = op === "*" ? mul(v, right) : div(v, right);
    }
    return v;
  }
  function factor() {
    const [kind, val] = take();
    if (kind === "num") return val;
    if (kind === "dice") return parseDice(val);
    if (kind === "op" && val === "-") return mul(factor(), -1);
    if (kind === "op" && val === "(") {
      const v = expr();
      take(")");
      return v;
    }
    if (kind === "word") {
      if (FUNCS[val] && isOp("(")) {
        take("(");
        const args = [expr()];
        while (isOp(",")) {
          take(",");
          args.push(expr());
        }
        take(")");
        if (!args.every(isNum)) throw new Bad("max/min of dice");
        return FUNCS[val](...args);
      }
      return wordValue(val, words);
    }
    throw new Bad(String(val));
  }

  const v = expr();
  if (i !== tokens.length) throw new Bad("left over");
  return v;
}

// A working value → a number or "2d8+3" (dice largest first).
function finish(v) {
  if (isNum(v)) return v;
  const dice = [...v.dice].filter(([, c]) => c);
  if (dice.some(([, c]) => c < 0)) return null;
  if (!dice.length) return v.flat;
  const text = dice.sort((a, b) => b[0] - a[0]).map(([s, c]) => `${c}d${s}`).join("+");
  return v.flat ? `${text}${v.flat > 0 ? "+" : "-"}${Math.abs(v.flat)}` : text;
}

// The value for `level` in { "1": …, "5": … }: the highest row at or below it.
export function tableRow(table, level) {
  if (level == null) return null;
  let best = null;
  for (const [key, value] of Object.entries(table || {})) {
    const row = Number(key);
    if (!Number.isInteger(row)) continue;
    if (row <= level && (best === null || row > best[0])) best = [row, value];
  }
  return best ? best[1] : null;
}

// A number, a dice string ("2d8+3"), or null. See the notes above.
export function evaluate(value, words = {}, level = null) {
  if (value == null || typeof value === "boolean") return null;
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const row = tableRow(value, level);
    return row == null ? null : evaluate(row, words, level);
  }
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return finish(parse(value, words || {}));
  } catch (e) {
    if (e instanceof Bad || e instanceof RangeError) return null;
    throw e;
  }
}

// The words a value uses, e.g. to see what a feature depends on.
export function wordsUsed(value) {
  if (value && typeof value === "object") return [...new Set(Object.values(value).flatMap(wordsUsed))].sort();
  if (typeof value !== "string") return [];
  const found = new Set();
  for (const m of value.matchAll(/(\d*d\d+)|([a-z_][a-z0-9_]*)/gi)) if (m[2] && !FUNCS[m[2].toLowerCase()]) found.add(m[2].toLowerCase());
  return [...found].sort();
}
