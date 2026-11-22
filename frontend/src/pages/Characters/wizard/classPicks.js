/* ═══════════════════════════════════════════════════════════════════
   classPicks — the builder's class choices, condensed (the wizard's
   Class step and the sheet's level-up form).

   The server sends one choice per class level ("Spellbook" at 1, 2 more
   at 2, 2 more at 3…), each on its own layer ("class:wizard-xphb@3").
   Drawn one by one they repeat; here the same kind of choice of one
   class becomes one group:

     key       class + what it grants + its id without the level number
               ("class_spells", "ability_score_improvement_4" → "…_improvement")
     members   the choices in it, lowest level first
     count     every member's count added up

   A pick in a group belongs to one member: the lowest-level one that
   still has room and offers it (a 2nd-level spell can't go into the
   level 1 picks). distribute() works that out again after every click,
   moving earlier picks along when that makes room.

   Only pools merge. A bundle (starting gear: a or b) or an ability
   choice (+2 / +1) stays on its own, and so does a choice of a feat
   that a level gives (it's shown under that feat's name).
   ═══════════════════════════════════════════════════════════════════ */

export const asList = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

const CLASS_FROM = /^class:([^@]+)@(\d+)$/;
export const classOf = (from) => {
  const m = CLASS_FROM.exec(from || "");
  return m ? { id: m[1], level: Number(m[2]) } : null;
};

const baseId = (id) => String(id || "").replace(/_\d+$/, "");

/* choices: the server's choice views; rootOf(from): the class layer a
   layer hangs on. Returns [{ classId, groups: [...] }] in the classes'
   order of first appearance, each group:
     { key, label, type, grant, level (lowest), members, count, single } */
export function groupChoices(choices, rootOf) {
  const byClass = new Map();
  for (const c of choices || []) {
    const root = classOf(rootOf(c.from));
    if (!root) continue;
    if (!byClass.has(root.id)) byClass.set(root.id, new Map());
    const groups = byClass.get(root.id);
    const own = c.from === `class:${root.id}@${root.level}`;
    const merge = own && c.type === "pool";
    const key = merge ? `${c.grant}|${baseId(c.id)}` : `${c.from}|${c.path}`;
    if (!groups.has(key)) groups.set(key, { key, label: c.label, type: c.type, grant: c.grant, level: root.level, members: [], single: !merge, owner: own ? null : c.from });
    const g = groups.get(key);
    g.members.push({ ...c, level: root.level });
    g.level = Math.min(g.level, root.level);
  }
  const out = [];
  for (const [classId, groups] of byClass) {
    const list = [...groups.values()].map((g) => {
      const members = [...g.members].sort((a, b) => a.level - b.level);
      return { ...g, members, count: members.reduce((n, m) => n + (m.count || 1), 0) };
    });
    list.sort((a, b) => a.level - b.level || (a.single === b.single ? 0 : a.single ? 1 : -1));
    out.push({ classId, groups: list });
  }
  return out;
}

/* The options of a merged group: every member's, once each, with the
   members that offer it and the lowest level it's offered at. */
export function groupOptions(group) {
  const seen = new Map();
  group.members.forEach((m, i) => {
    for (const o of m.options || []) {
      if (!seen.has(o.value)) seen.set(o.value, { ...o, members: [], from: m.level });
      seen.get(o.value).members.push(i);
    }
  });
  return [...seen.values()];
}

/* values → one list per member (null for an empty one). Most constrained
   values first, each to the lowest member with room that offers it; when
   none has room, an earlier value moves to another member to make it. */
export function distribute(group, values, options = groupOptions(group)) {
  const accept = new Map(options.map((o) => [o.value, o.members]));
  const room = group.members.map((m) => m.count || 1);
  const lists = group.members.map(() => []);
  const order = [...values].sort((a, b) => (accept.get(a)?.length || 99) - (accept.get(b)?.length || 99));
  const place = (v) => {
    for (const i of accept.get(v) || []) {
      if (lists[i].length < room[i]) {
        lists[i].push(v);
        return true;
      }
    }
    return false;
  };
  for (const v of order) {
    if (place(v)) continue;
    // make room: move something out of a full member that offers v
    let done = false;
    for (const i of accept.get(v) || []) {
      for (const w of lists[i]) {
        const to = (accept.get(w) || []).find((j) => j !== i && lists[j].length < room[j]);
        if (to != null) {
          lists[i] = lists[i].filter((x) => x !== w);
          lists[to].push(w);
          lists[i].push(v);
          done = true;
          break;
        }
      }
      if (done) break;
    }
  }
  return lists.map((l) => (l.length ? l : null));
}

/* "Level 1: 6 · level 2: 2 · level 3: 2" for a merged group. */
export const countsByLevel = (group) => group.members.map((m) => `${m.level}: ${m.count || 1}`).join(" · ");

/* ─── What you get ───────────────────────────────────────────────── */

/* The features (and spells the class gives outright) by class level:
   { classId: [{ level, features: [{from, id, name, text, via}], spells: [...] }] }.
   A feat a level grants is listed under that level, by its label. */
export function gainsByLevel(features, spells, rootOf, labelOf = () => null) {
  const out = {};
  const slot = (from) => {
    const root = classOf(rootOf(from));
    if (!root) return null;
    const rows = (out[root.id] ||= []);
    let row = rows.find((r) => r.level === root.level);
    if (!row) rows.push((row = { level: root.level, features: [], spells: [] }));
    return { row, via: from === `class:${root.id}@${root.level}` ? null : labelOf(from) || from };
  };
  for (const f of features || []) {
    const s = slot(f.from);
    if (s) s.row.features.push({ ...f, via: s.via });
  }
  for (const sp of spells || []) {
    if (sp.class) continue; // the class's own picks show in Picks
    const s = slot(sp.from);
    if (s) s.row.spells.push({ ...sp, via: s.via });
  }
  for (const rows of Object.values(out)) rows.sort((a, b) => a.level - b.level);
  return out;
}
