import React, { useCallback, useEffect, useMemo, useState } from "react";
import useCharStore from "../../../../store/CharStore";
import { usePopupStore } from "../../../../store/PopupStore";
import { INK, InkButton, Mark } from "../../../../styles/parchment";
import OriginStep from "../../wizard/OriginStep";
import { useServerPreview } from "../../wizard/usePreview";
import useViewOption from "../../wizard/useViewOption";

/* ═══════════════════════════════════════════════════════════════════
   OriginSwap — a new race or background for a saved character (the
   Biography tab; app/builder/origin.py does the work), or a feat taken
   from the catalogue (kind "feat", the Feats & Options tab).

   Pick the new one (and its subrace), answer its choices (right-click an
   option for its card), see what it gives and what goes, then "swap".
   The old one goes with everything it gave: its traits, spells, ability
   bonuses, proficiencies and the feat that came with it. Your edits to
   everything else stay. Its starting gear stays too unless "swap the
   gear" is ticked. Nothing is saved until "swap".

   `keepRace` (race only): the race stays and only its subrace changes
   (the Subrace line's "change"): the list is that race alone, already
   picked; the server gets only the new subrace (`subrace_only`).

   A feat: nothing goes. Pick it, answer its choices, "take the feat".
   Unmet prerequisites are a warning (the preview's `unmet`), never a block.
   ═══════════════════════════════════════════════════════════════════ */

const newSeed = () => Math.floor(Math.random() * 1e9);
const small = `text-[11px] font-semibold uppercase tracking-[0.25em] ${INK.faint}`;
const EDITIONS = [
  ["one", "2024"],
  ["classic", "2014"],
];

function Names({ title, names, rubric }) {
  if (!names.length) return null;
  return (
    <p className="text-sm">
      <span className={`italic ${rubric ? INK.rubric : INK.faded}`}>{title}: </span>
      {names.join(", ")}
    </p>
  );
}

export default function OriginSwap({ kind, entries, loading, currentId, keepRace = null, onClose }) {
  const previewOrigin = useCharStore((s) => s.previewOrigin);
  const swapOrigin = useCharStore((s) => s.swapOrigin);
  const openPopup = usePopupStore((s) => s.open);
  const onView = useViewOption();

  const [editions, setEditions] = useState(["one", "classic"]);
  const [selectedId, setSelectedId] = useState(keepRace?.id || null);
  const [subraceId, setSubraceId] = useState(null);
  const [picks, setPicks] = useState({});
  const [viaOf, setViaOf] = useState({});
  const [random, setRandom] = useState(false);
  const [seed, setSeed] = useState(newSeed);
  const [gear, setGear] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const root = selectedId ? `${kind}:${selectedId}` : null;
  const subFrom = root && subraceId ? `${root}/subrace:${subraceId}` : null;
  const isFeat = kind === "feat";

  const body = useMemo(() => {
    const layers = [];
    if (root && !keepRace) layers.push({ from: root, picks: picks[root] || {} });
    if (subFrom) layers.push({ from: subFrom, picks: picks[subFrom] || {} });
    for (const from of Object.keys(picks)) if (viaOf[from]) layers.push({ from, via: viaOf[from], picks: picks[from] });
    return { kind, layers, random, seed: random ? seed : undefined, gear: keepRace ? false : gear, ...(keepRace ? { subrace_only: true } : {}) };
  }, [kind, root, subFrom, picks, viaOf, random, seed, gear, keepRace]);

  const { data: preview, loading: asking, error } = useServerPreview(body, previewOrigin, keepRace ? !!subFrom : !!root);

  useEffect(() => {
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
  const ownerLabel = useCallback((from) => preview?.labels?.[from] || null, [preview]);

  const select = (id) => {
    setSelectedId(id);
    setSubraceId(null);
    setPicks({});
    setViaOf({});
  };
  const selectSub = (id) => {
    setSubraceId(id);
    setPicks((p) => Object.fromEntries(Object.entries(p).filter(([from]) => !from.includes("/subrace:"))));
  };

  const confirm = async () => {
    try {
      setSaving(true);
      setErr(null);
      await swapOrigin(body);
      onClose();
    } catch (e) {
      setErr(e.message || (isFeat ? "couldn't take it" : "couldn't swap"));
    } finally {
      setSaving(false);
    }
  };

  const word = kind;
  const open = (preview?.choices || []).filter((c) => c.missing > 0 && !own(c.from, c.path)).length;
  const losing = preview?.losing || { layers: [], features: [], spells: [], gear: [] };
  const choices = root ? preview?.choices || [] : [];

  return (
    <div className="mt-3 border-l-2 border-rubric/50 pl-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span className="text-lg">{isFeat ? "Take a feat" : keepRace ? "Another subrace" : `A new ${word}`}</span>
        {!keepRace && EDITIONS.map(([id, label]) => (
          <span key={id} className="flex items-center gap-1">
            <Mark on={editions.includes(id)} onClick={() => setEditions((e) => (e.includes(id) ? (e.length > 1 ? e.filter((x) => x !== id) : e) : [...e, id]))} label={`Show ${label}`} />
            <span>{label}</span>
          </span>
        ))}
        {asking && root && <span className={`text-xs italic ${INK.faint}`}>asking the rules…</span>}
        {error && <span className={`text-xs italic ${INK.rubric}`}>Couldn't ask the server: {error}</span>}
        <InkButton onClick={onClose} className="ml-auto">
          cancel
        </InkButton>
      </div>

      <OriginStep
        kind={kind}
        fixed={!!keepRace}
        entries={(entries || []).filter((e) => e.id !== currentId)}
        loading={loading}
        editions={editions}
        selectedId={selectedId}
        subraceId={subraceId}
        onSelect={select}
        onSelectSubrace={selectSub}
        onPreview={(e) => openPopup(kind, e)}
        choices={choices}
        own={own}
        onPick={onPick}
        ownerLabel={ownerLabel}
        rolled={random}
        onView={onView}
      />

      {root && preview && (
        <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-3 @3xl:grid-cols-2">
          <div className="space-y-1">
            <div className={small}>What you get</div>
            {preview.features.length ? (
              <p className="text-sm">
                {preview.features.map((f, i) => (
                  <React.Fragment key={`${f.from}|${f.id}`}>
                    {i > 0 && ", "}
                    <span title={f.text || undefined} className={f.text ? "cursor-help underline decoration-dotted underline-offset-4" : ""}>
                      {f.name}
                    </span>
                  </React.Fragment>
                ))}
              </p>
            ) : (
              <p className={`text-sm italic ${INK.faint}`}>No traits listed: its bonuses, proficiencies and speed land on the sheet.</p>
            )}
            <Names title="Spells" names={preview.spells.map((s) => s.name || s.id)} />
            <Names title="Feats" names={Object.entries(preview.labels || {}).filter(([from]) => from.startsWith("feat:")).map(([from, label]) => label || from)} />
          </div>
          {!isFeat && <div className="space-y-1">
            <div className={small}>What goes</div>
            <Names title={keepRace ? "The old subrace" : `The old ${word}`} names={losing.layers} rubric />
            <Names title="Traits" names={losing.features.filter(Boolean)} rubric />
            <Names title="Spells" names={losing.spells.filter(Boolean)} rubric />
            {losing.gear.length > 0 && (
              <p className="text-sm">
                <span className={`italic ${gear ? INK.rubric : INK.faded}`}>Its gear{gear ? "" : " (stays)"}: </span>
                {losing.gear.join(", ")}
              </p>
            )}
          </div>}
          {isFeat && (preview.unmet || []).length > 0 && (
            <p className={`text-sm italic ${INK.rubric}`}>
              The character doesn't meet the prerequisite of {preview.unmet.join(", ")}. You can take it anyway.
            </p>
          )}
        </div>
      )}

      {root && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="flex items-center gap-1" title="Anything you leave open is decided at random. You see the roll before you swap.">
            <Mark on={random} onClick={() => setRandom(!random)} label="Fill in the rest at random" />
            <span>Fill in the rest at random</span>
          </span>
          {random && <InkButton onClick={() => setSeed(newSeed())}>reroll</InkButton>}
          {!isFeat && !keepRace && (
            <span className="flex items-center gap-1" title="The old one's starting gear leaves the inventory and the new one's (or its gold) comes in.">
              <Mark on={gear} onClick={() => setGear(!gear)} label="Swap the starting gear too" />
              <span>Swap the starting gear too</span>
            </span>
          )}
          {open > 0 && !random && (
            <span className={`text-xs italic ${INK.faded}`}>
              {open} choice{open > 1 ? "s" : ""} still open
            </span>
          )}
          <button
            type="button"
            disabled={saving || !preview}
            onClick={confirm}
            className="ml-auto rounded-full border border-rubric/70 px-4 py-0.5 text-[15px] italic text-rubric transition hover:bg-rubric hover:text-page-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (isFeat ? "taking…" : "swapping…") : isFeat ? "take the feat" : keepRace ? "change the subrace" : `swap the ${word}`}
          </button>
        </div>
      )}
      {err && <p className={`mt-2 text-sm italic ${INK.rubric}`}>Couldn't {isFeat ? "take it" : "swap"}: {err}</p>}
    </div>
  );
}
