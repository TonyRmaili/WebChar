import React, { useCallback, useMemo, useState } from "react";
import useCharStore from "../../../../store/CharStore";
import { INK, InkButton, InkNumber, InkText, Mark } from "../../../../styles/parchment";
import { Segmented } from "../../../../styles/parchmentForm";
import PickGroups from "../../wizard/PickGroups";
import WhatYouGet from "../../wizard/WhatYouGet";
import { gainsByLevel, groupChoices } from "../../wizard/classPicks";
import { useServerPreview } from "../../wizard/usePreview";
import useViewOption from "../../wizard/useViewOption";
import { classLevels } from "../../../../utils/derive";
import { requirementProblem } from "./generalHelpers";

/* ═══════════════════════════════════════════════════════════════════
   The class leveler, in the General tab (app/builder/level.py does the
   work; CharStore.previewLevel / levelUp / levelDown ask for it).

     LevelSteps   − level + beside a class. − warns first, then takes the
                  top level away with everything it gave.
     LevelUpForm  what one more level gives: its features (hover or click
                  for the text), its choices (condensed, right-click an
                  option for its card), hit points (average · roll · set),
                  "fill the rest at random". Nothing is saved until
                  "level up".
     AddClass     a class the character doesn't have yet (multiclass).

   Requirements (multiclass ability scores) only warn, never block, and
   nothing stops a level past 20.
   ═══════════════════════════════════════════════════════════════════ */

const newSeed = () => Math.floor(Math.random() * 1e9);
const small = `text-[11px] font-semibold uppercase tracking-[0.25em] ${INK.faint}`;

/* ─── − level + ──────────────────────────────────────────────────── */

export function LevelSteps({ level, onDown, onUp, busy, label }) {
  const btn = `w-6 text-lg leading-none transition ${INK.faded} hover:text-ink disabled:opacity-30`;
  return (
    <span className="inline-flex items-baseline" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={onDown} disabled={busy} title="One level down (asks first)" aria-label={`Lower ${label}`}>
        −
      </button>
      <span className={`min-w-[1.75rem] text-center text-lg font-semibold tabular-nums ${INK.ink}`}>{level}</span>
      <button type="button" className={btn} onClick={onUp} disabled={busy} title="One level up" aria-label={`Raise ${label}`}>
        +
      </button>
    </span>
  );
}

/* What a level down takes away, for the warning. */
export function levelDownMessage(ch, classId, name) {
  const lv = classLevels(ch).find(([cid]) => cid === classId)?.[1] || 0;
  const from = `class:${classId}@${lv}`;
  const layers = (ch.layers || []).filter((l) => l?.from === from || l?.via === from);
  const feats = layers.filter((l) => l.from !== from).map((l) => l.label || l.from);
  const features = layers.flatMap((l) => (l.features || []).map((f) => f.name)).filter(Boolean);
  const spells = layers.flatMap((l) => (l.spells || []).map((s) => s.name)).filter(Boolean);
  const lines = [
    lv <= 1 ? `${name} goes entirely (it's at level 1).` : `${name} ${lv} → ${lv - 1}.`,
    features.length ? `Features that go: ${features.join(", ")}.` : null,
    feats.length ? `Feats that go: ${feats.join(", ")}.` : null,
    spells.length ? `Spells that go: ${spells.join(", ")}.` : null,
    "Its hit points and used counts go too. Your inventory stays.",
  ];
  return lines.filter(Boolean).join("\n\n");
}

/* ─── Hit points for the new level ───────────────────────────────── */

const HP_WAYS = [
  { value: "average", label: "average", hint: "The class's fixed number per level" },
  { value: "roll", label: "roll", hint: "Roll the hit die (Con is added)" },
  { value: "set", label: "set", hint: "Write the hit points this level gives (nothing is added)" },
];

function HitPoints({ info, hp, onChange }) {
  if (!info) return null;
  const con = info.con_mod;
  const conText = con ? ` ${con > 0 ? "+" : "−"} ${Math.abs(con)} Con` : "";
  const roll = () => onChange({ how: "roll", value: 1 + Math.floor(Math.random() * info.sides) });
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
      <span className={small}>Hit points</span>
      <Segmented
        size="sm"
        options={HP_WAYS}
        value={hp.how}
        onChange={(how) => (how === "roll" ? roll() : onChange({ how, value: how === "set" ? hp.value ?? null : null }))}
      />
      {hp.how === "average" && <span className="text-[15px]">+{info.average}</span>}
      {hp.how === "roll" && (
        <span className="flex items-baseline gap-2 text-[15px]">
          <span>
            {info.die}: <span className="font-semibold">{hp.value}</span>
            {conText}
          </span>
          <InkButton onClick={roll} title="Roll again">
            roll again
          </InkButton>
        </span>
      )}
      {hp.how === "set" && (
        <span className="flex items-baseline gap-1.5">
          +
          <InkNumber value={hp.value ?? null} min={0} placeholder="—" onChange={(v) => onChange({ how: "set", value: v })} aria-label="Hit points this level gives" className="h-7 w-12 text-[15px]" />
        </span>
      )}
      <span className={`text-sm italic ${INK.faded}`}>
        max {info.hp_max_before} → <span className={`not-italic font-semibold ${INK.ink}`}>{info.hp_max_after}</span>
      </span>
      {info.manual && <span className={`text-xs italic ${INK.rubric}`}>Your hit point maximum is set by hand (Vitals), so this doesn't change it.</span>}
    </div>
  );
}

/* ─── The form ───────────────────────────────────────────────────── */

export function LevelUpForm({ ch, classId, name, onClose }) {
  const previewLevel = useCharStore((s) => s.previewLevel);
  const levelUp = useCharStore((s) => s.levelUp);
  const onView = useViewOption();

  const [picks, setPicks] = useState({}); // { from: { path: value } }
  const [viaOf, setViaOf] = useState({});
  const [random, setRandom] = useState(false);
  const [seed, setSeed] = useState(newSeed);
  const [hp, setHp] = useState({ how: "average", value: null });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const current = classLevels(ch).find(([cid]) => cid === classId)?.[1] || 0;
  const root = `class:${classId}@${current + 1}`;

  const body = useMemo(() => {
    const layers = [{ from: root, picks: picks[root] || {} }];
    for (const from of Object.keys(picks)) if (from !== root && viaOf[from]) layers.push({ from, via: viaOf[from], picks: picks[from] });
    return {
      class_id: classId,
      layers,
      random,
      seed: random ? seed : undefined,
      hp: hp.how === "average" || hp.value == null ? { how: "average" } : hp,
    };
  }, [classId, root, picks, viaOf, random, seed, hp]);

  const { data: preview, loading, error } = useServerPreview(body, previewLevel);

  // Feat layers the new level brings: their picks ride along `via` it.
  React.useEffect(() => {
    if (!preview?.layers) return;
    const via = {};
    for (const l of preview.layers) if (l.via) via[l.from] = l.via;
    setViaOf((old) => (JSON.stringify(old) === JSON.stringify(via) ? old : via));
  }, [preview]);

  const own = useCallback((from, path) => picks[from]?.[path] ?? null, [picks]);
  const onPick = useCallback(
    (from, path, value) =>
      setPicks((p) => {
        const layer = { ...(p[from] || {}) };
        if (value == null) delete layer[path];
        else layer[path] = value;
        return { ...p, [from]: layer };
      }),
    []
  );
  const rootOf = useCallback(
    (from) => {
      let f = from;
      for (let i = 0; i < 6 && viaOf[f]; i += 1) f = viaOf[f];
      return f;
    },
    [viaOf]
  );
  const labels = useMemo(() => Object.fromEntries((preview?.layers || []).map((l) => [l.from, l.label])), [preview]);
  const labelOf = useCallback((from) => labels[from] || null, [labels]);

  const groups = useMemo(() => groupChoices(preview?.choices || [], rootOf).find((g) => g.classId === classId)?.groups || [], [preview, rootOf, classId]);
  const gains = useMemo(() => gainsByLevel(preview?.features, preview?.spells, rootOf, labelOf)[classId] || [], [preview, rootOf, labelOf, classId]);
  const open = (preview?.choices || []).filter((c) => c.missing > 0 && !own(c.from, c.path)).length;

  const confirm = async () => {
    try {
      setSaving(true);
      setErr(null);
      await levelUp(body);
      onClose();
    } catch (e) {
      setErr(e.message || "couldn't level up");
    } finally {
      setSaving(false);
    }
  };

  const total = classLevels(ch).reduce((n, [, l]) => n + l, 0);
  const warnings = [...(preview?.warnings || []), ...(total >= 20 ? [`This takes the character past level 20 (to ${total + 1}).`] : [])];

  return (
    <div className="mt-3 border-l-2 border-rubric/50 pl-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-lg">
          {name} <span className="font-semibold">{current + 1}</span>
        </span>
        <span className={`text-xs italic ${INK.faint}`}>{loading ? "asking the rules…" : current === 0 ? "a new class" : "one more level"}</span>
        {error && <span className={`text-xs italic ${INK.rubric}`}>Couldn't ask the server: {error}</span>}
      </div>

      {warnings.length > 0 && (
        <ul className="mb-3 space-y-0.5">
          {warnings.map((w) => (
            <li key={w} className={`text-sm italic ${INK.rubric}`}>
              ⚠ {w}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-x-10 gap-y-6 @3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <div className={`mb-2 ${small}`}>Picks</div>
          {preview ? (
            <PickGroups groups={groups} own={own} onPick={onPick} rolled={random} onView={onView} ownerLabel={labelOf} empty="Nothing to choose at this level." />
          ) : (
            <p className={`text-sm italic ${INK.faint}`}>…</p>
          )}
        </div>
        <div className="min-w-0 @3xl:border-l @3xl:border-rule/20 @3xl:pl-6">
          <div className={`mb-2 ${small}`}>What you get</div>
          <WhatYouGet rows={gains} empty={preview ? "No new features at this level." : "…"} />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <HitPoints info={preview?.hp} hp={hp} onChange={setHp} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="flex items-center gap-1" title="Anything you leave open is decided at random. You see the roll before you level up.">
            <Mark on={random} onClick={() => setRandom(!random)} label="Fill in the rest at random" />
            <span>Fill in the rest at random</span>
          </span>
          {random && (
            <InkButton onClick={() => setSeed(newSeed())} title="Roll everything left open again">
              reroll
            </InkButton>
          )}
          {open > 0 && !random && (
            <span className={`text-xs italic ${INK.faded}`}>
              {open} choice{open > 1 ? "s" : ""} still open: they stay open on the sheet.
            </span>
          )}
          <span className="ml-auto flex items-baseline gap-4">
            <InkButton onClick={onClose}>cancel</InkButton>
            <button
              type="button"
              disabled={saving || !preview}
              onClick={confirm}
              className="rounded-full border border-rubric/70 px-4 py-0.5 text-[15px] italic text-rubric transition hover:bg-rubric hover:text-page-light disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "leveling up…" : open && !random ? "level up anyway" : "level up"}
            </button>
          </span>
        </div>
        {err && <p className={`text-sm italic ${INK.rubric}`}>Couldn't level up: {err}</p>}
      </div>
    </div>
  );
}

/* ─── A new class ────────────────────────────────────────────────── */

export function AddClass({ catalogue, have, scores, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const [editions, setEditions] = useState(["one"]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalogue || [])
      .filter((c) => c?.hit_die && !have.includes(c.id) && editions.includes(c.edition === "classic" ? "classic" : "one") && (!q || c.name?.toLowerCase().includes(q)))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)) || String(a.source).localeCompare(String(b.source)));
  }, [catalogue, have, editions, query]);
  const toggle = (id) => setEditions((e) => (e.includes(id) ? (e.length > 1 ? e.filter((x) => x !== id) : e) : [...e, id]));

  return (
    <div className="mt-3 border-l-2 border-rule/40 pl-4">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <InkText value={query} onChange={(e) => setQuery(e.target.value)} placeholder="find a class…" aria-label="Find a class" className="h-7 w-48 text-sm" autoFocus />
        {[
          ["one", "2024"],
          ["classic", "2014"],
        ].map(([id, label]) => (
          <span key={id} className="flex items-center gap-1">
            <Mark on={editions.includes(id)} onClick={() => toggle(id)} label={`Show ${label}`} />
            <span>{label}</span>
          </span>
        ))}
        <InkButton onClick={onClose} className="ml-auto">
          close
        </InkButton>
      </div>
      <div className="grid max-h-72 grid-cols-1 gap-x-6 overflow-y-auto @xl:grid-cols-2 @4xl:grid-cols-3">
        {list.map((c) => {
          const problem = requirementProblem(c, scores);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c)}
              title={problem ? `${problem} You can still take it.` : undefined}
              className="flex items-baseline gap-2 py-0.5 text-left text-[15px] hover:underline hover:decoration-dotted hover:underline-offset-4"
            >
              <span className="truncate">{c.name}</span>
              <span className={`shrink-0 text-[11px] ${INK.faint}`}>
                {c.source} · {c.hit_die}
              </span>
              {problem && <span className={`text-[11px] ${INK.rubric}`}>⚠</span>}
            </button>
          );
        })}
        {!list.length && <p className={`text-sm italic ${INK.faint}`}>No classes match.</p>}
      </div>
    </div>
  );
}
