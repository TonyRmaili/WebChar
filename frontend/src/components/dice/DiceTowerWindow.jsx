import React, { useEffect, useState } from "react";
import MinionDicePanel from "../../pages/Characters/sheet/minions/MinionDicePanel";
import useDiceStore from "../../store/DiceStore";
import useMinionStore from "../../store/MinionStore";
import { usePopupStore } from "../../store/PopupStore";
import { INK, InkButton, InkNumber, InkRemove, InkSelect, InkText, ParchmentSheet, SubHeading } from "../../styles/parchment";
import { addBtn, chipBtn, dangerBtn } from "../../styles/parchmentForm";
import ParchmentMenu from "../../styles/ParchmentMenu";
import RollLog from "./RollLog";
import { DAMAGE_TYPES } from "../../utils/Constants";
import { DICE, MODES, addDie, modeWord } from "./diceWords";
import { ABILITIES } from "./groupRollHelper";
import { loadoutWords } from "./loadoutFill";

/* ═══════════════════════════════════════════════════════════════════
   DiceTowerWindow — the dice tower as a card window (popup type "dice";
   there is only one). The footer's DiceTower button opens it and puts it
   away again; minimized, it keeps everything but stays out of the deck.

   Left:  the tray (click a die to add it), a line to type any roll
          ("100d6", "4d6kh3", "1d20+5"), how many times, advantage, an
          optional "vs" (count how many reach an AC or DC), and your
          loadouts — saved sets of rolls you keep using. A loadout's rolls
          may have a damage type, and it may carry an attack (to hit,
          attacks each, crit on) and a save (ability, DC, on a success):
          the tracker's and minions' save / attack forms fill in from it.
          The Minions tab (when the sheet's character has minions) rolls
          their attacks and saves, and incoming damage on them
          (pages/Characters/sheet/minions/MinionDicePanel).
   Right: every roll made anywhere in WebChar while the app is open,
          newest first (the tracker's saves and attacks land here too).

   All dice are rolled by the backend (DiceStore → routers/dice.py).
   ═══════════════════════════════════════════════════════════════════ */

const asList = (v) => (Array.isArray(v) ? v : []);
export const DICE_WINDOW = "dice-tower";
const newLine = () => ({ id: crypto.randomUUID(), label: "", expression: "", times: 1, mode: "normal", against: null, type: null });
const TYPES = DAMAGE_TYPES.map((t) => t.toLowerCase());

export const diceWindowId = () => DICE_WINDOW;

// `tab`: open it on "roll" or "minions" (the sheet's minions open it on theirs).
export function openDiceTower(tab) {
  if (typeof tab === "string") useDiceStore.getState().setTab(tab);
  const store = usePopupStore.getState();
  const known = store.openPopups.some((p) => p.id === DICE_WINDOW) || store.minimized.some((p) => p.id === DICE_WINDOW);
  store.open("dice", { name: "Dice tower" });
  if (!known) {
    const width = Math.min(1040, window.innerWidth - 32);
    const height = Math.max(480, window.innerHeight - 120);
    usePopupStore.getState().resize(DICE_WINDOW, width, height);
    usePopupStore.getState().move(DICE_WINDOW, Math.max(16, window.innerWidth - width - 24), 56);
  }
}

// The footer's DiceTower button: open it, bring it to the front, or — when
// it's already in front — put it away (minimized; it isn't in the deck).
export function toggleDiceTower() {
  const store = usePopupStore.getState();
  const open = store.openPopups.find((p) => p.id === DICE_WINDOW);
  if (!open) return openDiceTower();
  const onTop = store.openPopups.every((p) => p.id === DICE_WINDOW || (p.zIndex ?? 0) < (open.zIndex ?? 0));
  if (onTop) store.minimize(DICE_WINDOW);
  else store.focus(DICE_WINDOW);
}

function remembered(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function remember(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* fine without it */
  }
}

/* ─── a loadout ──────────────────────────────────────────────────── */

function LoadoutLine({ line, editing, onRoll, onChange, onRemove }) {
  if (!editing) {
    return (
      <button type="button" onClick={onRoll} disabled={!line.expression} className="group flex w-full items-baseline gap-3 py-1 text-left" title="Roll it">
        <span className={`text-sm ${INK.rubric} opacity-60 group-hover:opacity-100`}>▸</span>
        <span className="text-[15px] group-hover:underline group-hover:decoration-dotted group-hover:underline-offset-4">{line.label || line.expression || "—"}</span>
        {line.label && <span className={`text-sm italic ${INK.faded}`}>{line.expression}</span>}
        {line.type && <span className={`text-sm italic ${INK.faded}`}>{line.type}</span>}
        {line.times > 1 && <span className={`text-sm italic ${INK.faded}`}>× {line.times}</span>}
        {modeWord(line.mode) && <span className={`text-xs italic ${INK.rubric}`}>{modeWord(line.mode)}</span>}
        {line.against != null && <span className={`text-sm italic ${INK.faded}`}>vs {line.against}</span>}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-1">
      <InkText value={line.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="name, e.g. Shortbow" aria-label="Name of the roll" className="h-7 w-36" />
      <InkText value={line.expression} onChange={(e) => onChange({ expression: e.target.value })} placeholder="1d6+2" aria-label="Dice" className="h-7 w-28" />
      <InkSelect value={line.type || ""} onChange={(e) => onChange({ type: e.target.value || null })} aria-label="Damage type" className="h-7 text-sm" title="A damage type makes this roll damage when the loadout fills a save or an attack">
        <option value="">no damage type</option>
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </InkSelect>
      <span className={`text-sm italic ${INK.faded}`}>×</span>
      <InkNumber value={line.times} min={1} max={1000} fallback={1} onChange={(v) => onChange({ times: v ?? 1 })} aria-label="How many times" className="h-7 w-12" />
      <InkSelect value={line.mode} onChange={(e) => onChange({ mode: e.target.value })} aria-label="Advantage" className="h-7 text-sm">
        {MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </InkSelect>
      <span className={`text-sm italic ${INK.faded}`}>vs</span>
      <InkNumber value={line.against} onChange={(v) => onChange({ against: v })} placeholder="—" aria-label="Against (AC or DC)" className="h-7 w-10" />
      <InkRemove onClick={onRemove} label="Remove this roll" />
    </div>
  );
}

/* What a loadout brings to a save or an attack (all optional) — used when
   the tracker or the minions fill their form from it (loadoutFill.js). */
function LoadoutPackage({ loadout, onChange }) {
  const a = loadout.attack || {};
  const sv = loadout.save || {};
  const setA = (patch) => onChange({ attack: { ...a, ...patch } });
  const setS = (patch) => onChange({ save: { ...sv, ...patch } });
  const toggle = (now, value) => (now === value ? null : value);
  const label = `text-sm italic ${INK.faded}`;
  const group = "inline-flex items-baseline gap-x-2 whitespace-nowrap";
  const head = `text-[10px] font-semibold uppercase tracking-[0.18em] ${INK.faded}`;
  return (
    <div className="mt-3 space-y-2 border-t border-[#7b6346]/20 pt-2">
      <p className={`text-xs italic ${INK.faint}`}>For the save and attack forms (tracker, minions). Fill in only what you want — whatever is missing is typed there.</p>
      <div>
        <p className={head}>As an attack</p>
        <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className={group}>
            <span className={label}>to hit</span>
            <InkNumber value={a.toHit ?? null} min={-10} max={30} onChange={(v) => setA({ toHit: v })} placeholder="—" aria-label="Loadout to hit" className="h-7 w-10" />
          </span>
          <span className={group}>
            <span className={label}>attacks each</span>
            <InkNumber value={a.count ?? null} min={1} max={100} onChange={(v) => setA({ count: v })} placeholder="—" aria-label="Loadout attacks each" className="h-7 w-10" />
          </span>
          <span className={group}>
            <span className={label}>crit on</span>
            <InkNumber value={a.critOn ?? null} min={2} max={20} onChange={(v) => setA({ critOn: v })} placeholder="20" aria-label="Loadout crit on" className="h-7 w-10" />
          </span>
        </p>
      </div>
      <div>
        <p className={head}>As a save</p>
        <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className={group}>
            {ABILITIES.map((ab) => (
              <button key={ab.key} type="button" onClick={() => setS({ ability: toggle(sv.ability, ab.key) })} className={chipBtn(sv.ability === ab.key)} title={ab.name}>
                {ab.label}
              </button>
            ))}
          </span>
          <span className={group}>
            <span className={label}>DC</span>
            <InkNumber value={sv.dc ?? null} min={1} max={40} onChange={(v) => setS({ dc: v })} placeholder="—" aria-label="Loadout save DC" className="h-7 w-10" />
          </span>
        </p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className={group}>
            <span className={label}>on a success</span>
            <button type="button" onClick={() => setS({ onSuccess: toggle(sv.onSuccess, "half") })} className={chipBtn(sv.onSuccess === "half")}>
              half
            </button>
            <button type="button" onClick={() => setS({ onSuccess: toggle(sv.onSuccess, "none") })} className={chipBtn(sv.onSuccess === "none")}>
              nothing
            </button>
          </span>
          <span className={group}>
            <span className={label}>damage</span>
            <button type="button" onClick={() => setS({ damageRoll: toggle(sv.damageRoll, "once") })} className={chipBtn(sv.damageRoll === "once")}>
              one roll for all
            </button>
            <button type="button" onClick={() => setS({ damageRoll: toggle(sv.damageRoll, "each") })} className={chipBtn(sv.damageRoll === "each")}>
              a roll each
            </button>
          </span>
        </p>
      </div>
    </div>
  );
}

function Loadouts({ onRoll }) {
  const loadouts = useDiceStore((s) => s.loadouts);
  const problem = useDiceStore((s) => s.problem);
  const store = useDiceStore;
  const [chosen, setChosen] = useState(() => remembered("dice.loadout"));
  // While editing you change a copy (`draft`); nothing is checked or saved
  // until "done", so "1d" on the way to "1d6+3" is fine.
  const [draft, setDraft] = useState(null);
  const [draftProblem, setDraftProblem] = useState(null);
  const [saving, setSaving] = useState(false);
  const editing = draft !== null;

  useEffect(() => {
    if (!loadouts) store.getState().fetchLoadouts();
  }, [loadouts, store]);

  const stopEditing = () => {
    setDraft(null);
    setDraftProblem(null);
  };
  const choose = (id) => {
    setChosen(id);
    remember("dice.loadout", id);
    stopEditing();
  };
  const saved = asList(loadouts).find((l) => l.id === chosen) || null;
  const current = editing ? draft : saved;
  const change = (fn) => setDraft((d) => (d ? fn(d) : d));
  const changeLine = (id, patch) => change((l) => ({ ...l, rolls: asList(l.rolls).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const startEditing = (rec) => {
    setDraft(structuredClone(rec));
    setDraftProblem(null);
  };

  // "done": tidy the typing, save it whole; a line the dice can't read keeps you editing.
  const done = async () => {
    const rec = { ...draft, rolls: asList(draft.rolls).map((r) => ({ ...r, expression: String(r.expression || "").trim() })) };
    setSaving(true);
    const res = await store.getState().saveLoadout(rec);
    setSaving(false);
    if (!res.ok) {
      setDraft(rec);
      setDraftProblem(`Not saved — ${res.message}. Fix that roll and press done again.`);
      return false;
    }
    stopEditing();
    return true;
  };
  // Leaving one loadout for another while editing saves it first.
  const pick = async (id) => {
    if (editing && !(await done())) return;
    choose(current?.id === id ? null : id);
  };

  const create = async () => {
    if (editing && !(await done())) return;
    const res = await store.getState().createLoadout({ name: `Loadout ${asList(loadouts).length + 1}`, rolls: [newLine()] });
    if (res.ok) {
      choose(res.loadout.id);
      startEditing(res.loadout);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete the loadout ${saved?.name || current.name}?`)) return;
    const res = await store.getState().removeLoadout(current.id);
    if (res.ok) choose(null);
  };

  const lines = asList(current?.rolls).filter((r) => r.expression);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <SubHeading>Loadouts</SubHeading>
        <button type="button" onClick={create} className={addBtn}>
          + new loadout
        </button>
      </div>
      {problem && <p className={`mb-1 text-sm italic ${INK.rubric}`}>{problem}</p>}
      {loadouts === null ? (
        <p className={`text-sm italic ${INK.faint}`}>Fetching…</p>
      ) : loadouts.length === 0 ? (
        <p className={`text-sm italic ${INK.faint}`}>None yet. A loadout keeps rolls you make again and again — "Skeleton archers: Shortbow 1d20+4 × 27, damage 1d6+2 × 27".</p>
      ) : (
        <>
          <p className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
            {loadouts.map((l) => (
              <button key={l.id} type="button" onClick={() => pick(l.id)} className={chipBtn(current?.id === l.id)}>
                {current?.id === l.id ? current.name || "—" : l.name}
              </button>
            ))}
          </p>
          {current && (
            <div>
              {editing && (
                <InkText value={current.name} onChange={(e) => change((l) => ({ ...l, name: e.target.value }))} aria-label="Loadout name" className="mb-1 h-8 w-full max-w-xs text-lg" />
              )}
              {!editing && loadoutWords(current).length > 0 && <p className={`text-sm italic ${INK.rubric}`}>{loadoutWords(current).join(" · ")}</p>}
              {asList(current.rolls).map((line) => (
                <LoadoutLine
                  key={line.id}
                  line={line}
                  editing={editing}
                  onRoll={() => onRoll([line], current.name)}
                  onChange={(patch) => changeLine(line.id, patch)}
                  onRemove={() => change((l) => ({ ...l, rolls: asList(l.rolls).filter((r) => r.id !== line.id) }))}
                />
              ))}
              {editing && <LoadoutPackage loadout={current} onChange={(patch) => change((l) => ({ ...l, ...patch }))} />}
              {draftProblem && <p className={`mt-1 text-sm italic ${INK.rubric}`}>{draftProblem}</p>}
              <p className="mt-1 flex flex-wrap items-baseline gap-x-4">
                {editing ? (
                  <>
                    <button type="button" onClick={() => change((l) => ({ ...l, rolls: [...asList(l.rolls), newLine()] }))} className={addBtn}>
                      + roll
                    </button>
                    <InkButton active onClick={done} disabled={saving}>
                      {saving ? "saving…" : "done"}
                    </InkButton>
                    <InkButton onClick={stopEditing}>cancel</InkButton>
                    <button type="button" onClick={remove} className={`${dangerBtn} ml-auto`}>
                      delete loadout
                    </button>
                  </>
                ) : (
                  <>
                    {lines.length > 1 && (
                      <InkButton active onClick={() => onRoll(lines, current.name)}>
                        roll them all
                      </InkButton>
                    )}
                    <InkButton onClick={() => startEditing(saved)}>edit</InkButton>
                  </>
                )}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── the card ───────────────────────────────────────────────────── */

export default function DiceTowerWindow() {
  const log = useDiceStore((s) => s.log);
  const tab = useDiceStore((s) => s.tab);
  const setTab = useDiceStore((s) => s.setTab);
  const hasMinions = useMinionStore((s) => s.minions.length > 0);
  const [expression, setExpression] = useState("");
  const [times, setTimes] = useState(1);
  const [mode, setMode] = useState("normal");
  const [against, setAgainst] = useState(null);
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(null);

  // lines: [{ label, expression, times, mode }]
  const roll = async (lines, label = "") => {
    setBusy(true);
    const res = await useDiceStore.getState().roll(
      lines.map((l) => ({ label: l.label || "", expression: l.expression, times: Math.max(1, l.times || 1), mode: l.mode || "normal", against: l.against ?? null })),
      { source: label ? `Dice tower · ${label}` : "Dice tower" }
    );
    setBusy(false);
    setProblem(res.ok ? null : res.message);
  };

  const rollTyped = () => expression.trim() && roll([{ expression: expression.trim(), times, mode, against }]);

  return (
    <div
      className="@container h-full overflow-y-auto bg-[#1c120b]"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="flex flex-col gap-2 p-2 @3xl:h-full @3xl:flex-row">
        {/* ── rolling ── */}
        <div className="shrink-0 @3xl:w-[48%] @3xl:overflow-y-auto">
          <ParchmentSheet>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-5">
              <h2 className="text-2xl tracking-wide">Dice tower</h2>
              {(hasMinions || tab === "minions") && (
                <span className="flex items-baseline gap-x-4">
                  {[
                    { value: "roll", label: "Roll" },
                    { value: "minions", label: "Minions" },
                  ].map((t) => (
                    <button key={t.value} type="button" onClick={() => setTab(t.value)} className={`text-lg ${tab === t.value ? `${INK.rubric} underline decoration-dotted underline-offset-4` : `${INK.faded} hover:text-[#3a2716]`}`}>
                      {t.label}
                    </button>
                  ))}
                </span>
              )}
            </div>

            {tab === "minions" ? (
              <MinionDicePanel />
            ) : (
            <>

            <div className="mb-2 flex flex-wrap gap-1.5">
              {DICE.map((sides) => (
                <button
                  key={sides}
                  type="button"
                  onClick={() => setExpression((x) => addDie(x, sides))}
                  className="h-9 min-w-[2.75rem] rounded-[3px] border border-[#7b6346]/50 px-2 text-[15px] transition hover:border-[#9a3412] hover:text-[#9a3412]"
                  title={`Add a d${sides}`}
                >
                  d{sides}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <InkText
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && rollTyped()}
                placeholder="1d20+5, 8d6, 100d6, 4d6kh3…"
                aria-label="What to roll"
                className="h-9 min-w-[12rem] flex-1 text-lg"
              />
              <span className={`flex items-baseline gap-1.5 text-sm italic ${INK.faded}`}>
                ×
                <InkNumber value={times} min={1} max={1000} fallback={1} onChange={(v) => setTimes(v ?? 1)} aria-label="How many times" className="h-8 w-14 text-center" />
              </span>
              <span className={`flex items-baseline gap-1.5 text-sm italic ${INK.faded}`} title="Count how many reach an AC or DC (a natural 20 always does, a 1 never)">
                vs
                <InkNumber value={against} onChange={setAgainst} placeholder="—" aria-label="Against (AC or DC)" className="h-8 w-12 text-center" />
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {MODES.map((m) => (
                <button key={m.value} type="button" onClick={() => setMode(m.value)} className={chipBtn(mode === m.value)} title={m.value === "normal" ? "No advantage" : `The first d20 is rolled with ${m.value}`}>
                  {m.label}
                </button>
              ))}
              <span className="ml-auto flex items-baseline gap-x-4">
                {expression && (
                  <InkButton onClick={() => setExpression("")} title="Empty the line">
                    clear
                  </InkButton>
                )}
                <InkButton active onClick={rollTyped} disabled={!expression.trim() || busy}>
                  {busy ? "rolling…" : "roll"}
                </InkButton>
              </span>
            </div>
            {problem && <p className={`mt-2 text-sm italic ${INK.rubric}`}>{problem}</p>}

            <div className="mt-6">
              <Loadouts onRoll={roll} />
            </div>
            </>
            )}
          </ParchmentSheet>
        </div>

        {/* ── what was rolled ── */}
        <div className="min-h-[18rem] min-w-0 flex-1 @3xl:overflow-y-auto">
          <ParchmentSheet>
            <div className="mb-1 flex items-baseline gap-3">
              <h3 className="text-xl tracking-wide">Rolls</h3>
              {log.length > 0 && <span className={`text-xs italic ${INK.faint}`}>{log.length} · kept while the app is open</span>}
              {log.length > 0 && (
                <span className="ml-auto">
                  <InkButton onClick={() => useDiceStore.getState().clearLog()}>clear</InkButton>
                </span>
              )}
            </div>
            <RollLog log={log} onAgain={(entry) => roll(entry.request.rolls, entry.source.replace(/^Dice tower( · )?/, ""))} />
          </ParchmentSheet>
        </div>
      </div>

      {menu && (
        <ParchmentMenu
          x={menu.x}
          y={menu.y}
          title="Dice tower"
          groups={[
            {
              items: [
                { label: "Minimize", onSelect: () => usePopupStore.getState().minimize(DICE_WINDOW) },
                { label: "Close", onSelect: () => usePopupStore.getState().close(DICE_WINDOW) },
              ],
            },
          ]}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}