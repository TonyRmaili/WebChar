import React, { useEffect, useMemo, useState } from "react";
import useDiceStore from "../../store/DiceStore";
import { INK, InkButton, InkNumber, InkRemove, InkSelect, InkText, Mark, ParchmentSheet, SubHeading } from "../../styles/parchment";
import { addBtn, chipBtn } from "../../styles/parchmentForm";
import { DAMAGE_TYPES } from "../../utils/Constants";
import { MODES, d20Words, damageWords, signed } from "./diceWords";
import { ABILITIES, attackPlan, attackRequest, defenseWords, savePlan, saveRequest } from "./groupRollHelper";
import { fillFrom, loadoutFrom, loadoutWords } from "./loadoutFill";

/* ═══════════════════════════════════════════════════════════════════
   GroupRoll — saves and attacks against many creatures at once, through
   the dice tower. Used by the tracker (selected combatants) and by the
   tower's Minions tab (selected units). `targets` are plain targets
   (groupRoll.js); the caller applies the result.

     kind "save"    Make them save…   (a Fireball on 15 monsters)
     kind "attack"  Attack them…      (a volley of arrows at each)

   1. The form: what it is, the DC or to-hit, the damage — typed in, or
      filled from one of your dice loadouts ("from a loadout"; whatever
      the loadout lacks is named, and you type just that). A form you
      filled in can be kept as a loadout for next time. Then the roll
      button — above the list of creatures, so a long list needs no
      scrolling. Below it, anyone's advantage, or a number your players
      rolled at the table, can be set before rolling.
   2. The backend rolls (DiceStore → engine) and the panel shows what
      would happen to each, with Apply / roll again on top — nothing has
      changed yet. You can overturn a
      save, or untick anyone who shouldn't be hit.
   3. Apply: onApply([{ key, amount }, …], name) — the caller puts the
      damage on everyone ticked.

   `bare`: no parchment sheet of its own (when it sits inside one).

   The roll also lands in the dice tower's log.
   ═══════════════════════════════════════════════════════════════════ */

const TYPES = DAMAGE_TYPES.map((t) => t.toLowerCase());
const newPart = (type = "fire") => ({ id: crypto.randomUUID(), dice: "", type, given: null });
const smallCaps = `text-[10px] font-semibold uppercase tracking-[0.18em] ${INK.faded}`;

function Field({ label, children }) {
  return (
    <label className={`flex items-baseline gap-2 text-sm italic ${INK.faded}`}>
      {label}
      {children}
    </label>
  );
}

function DamageRows({ rows, setRows, allowGiven }) {
  const change = (id, patch) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div>
      <p className={smallCaps}>Damage</p>
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1">
          <InkText value={r.dice} onChange={(e) => change(r.id, { dice: e.target.value })} placeholder="8d6" aria-label="Damage dice" className="h-7 w-24" />
          <InkSelect value={r.type} onChange={(e) => change(r.id, { type: e.target.value })} aria-label="Damage type" className="h-7 text-sm">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </InkSelect>
          {allowGiven && (
            <Field label="or rolled at the table">
              <InkNumber value={r.given} min={0} onChange={(v) => change(r.id, { given: v })} placeholder="—" aria-label="Damage rolled at the table" className="h-7 w-14" />
            </Field>
          )}
          {rows.length > 1 && <InkRemove onClick={() => setRows(rows.filter((x) => x.id !== r.id))} label="Remove this damage" />}
        </div>
      ))}
      <button type="button" onClick={() => setRows([...rows, newPart("cold")])} className={addBtn}>
        + another damage type
      </button>
    </div>
  );
}

function ModePick({ value, onChange, label }) {
  return (
    <InkSelect value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-6 text-sm">
      {MODES.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </InkSelect>
  );
}

/* ─── loadouts ───────────────────────────────────────────────────── */

// "from a loadout ▾" — picks one; the form fills in what it can.
function LoadoutPick({ onPick }) {
  const loadouts = useDiceStore((s) => s.loadouts);
  useEffect(() => {
    if (!loadouts) useDiceStore.getState().fetchLoadouts();
  }, [loadouts]);
  if (!loadouts?.length) return null;
  return (
    <InkSelect
      value=""
      onChange={(e) => {
        const l = loadouts.find((x) => x.id === e.target.value);
        if (l) onPick(l);
      }}
      aria-label="Fill from a loadout"
      className="h-7 max-w-[14rem] text-sm italic"
    >
      <option value="">from a loadout…</option>
      {loadouts.map((l) => (
        <option key={l.id} value={l.id}>
          {[l.name, ...loadoutWords(l)].join(" — ")}
        </option>
      ))}
    </InkSelect>
  );
}

/* ─── the preview ────────────────────────────────────────────────── */

function HpChange({ line }) {
  const { before, after } = line;
  const down = after.cur <= 0 && before.cur > 0;
  return (
    <span className="tabular-nums">
      <span className={INK.faded}>{before.cur}</span> → <span className={after.cur <= 0 ? INK.rubric : ""}>{after.cur}</span>
      <span className={INK.faint}>/{before.max}</span>
      {down && <span className={`ml-1.5 text-xs italic ${INK.rubric}`}>drops</span>}
    </span>
  );
}

function Preview({ kind, plan, setPlan, result, onOverturn }) {
  const toggle = (key) => setPlan(plan.map((l) => (l.key === key ? { ...l, apply: !l.apply } : l)));
  let lastGroup = null;
  return (
    <div>
      {kind === "save" && (
        <p className={`mb-2 text-sm italic ${INK.faded}`}>
          DC {result.dc} · <span className={INK.rubric}>{plan.filter((l) => !l.passed).length} failed</span>, {plan.filter((l) => l.passed).length} passed
          {result.damage ? ` · ${damageWords(result.damage.by_type) || "no damage"}` : ""}
          <span className={`ml-2 ${INK.faint}`}>· click passed / failed to overturn it</span>
        </p>
      )}
      {plan.map((l) => {
        const heading = l.t.group && l.t.group !== lastGroup ? l.t.group : null;
        lastGroup = l.t.group || lastGroup;
        return (
        <React.Fragment key={l.key}>
        {heading && <p className={`mt-2 ${smallCaps}`}>{heading}</p>}
        <div className={`flex flex-wrap items-baseline gap-x-3 border-b border-[#7b6346]/15 py-1.5 text-sm last:border-b-0 ${l.apply ? "" : "opacity-50"}`}>
          <span className="self-center">
            <Mark on={l.apply} onClick={() => toggle(l.key)} label={`Apply to ${l.t.name}`} />
          </span>
          <span className="w-36 truncate text-[15px]">{l.t.name}</span>
          {kind === "save" ? (
            <>
              <span className={`w-28 tabular-nums ${INK.faded}`} title={l.roll.d20.given ? "rolled at the table" : undefined}>
                {d20Words(l.roll.d20)} {signed(l.roll.bonus)} = {l.roll.total}
              </span>
              <button
                type="button"
                onClick={() => onOverturn(l.key, !l.passed)}
                className={`w-20 text-left underline decoration-dotted underline-offset-4 ${l.passed ? "" : INK.rubric}`}
                title="Overturn it"
              >
                {l.passed ? "passed" : "failed"}
                {l.overturned ? "*" : ""}
              </button>
            </>
          ) : (
            <span className={`w-56 ${INK.faded}`}>
              AC {l.volley.ac} · {l.volley.hits}/{l.volley.attacks.length} hit{l.volley.crits ? ` (${l.volley.crits} crit)` : ""}
              <span className={`ml-2 text-xs ${INK.faint}`}>{l.volley.attacks.map((a) => d20Words(a.d20) + (a.result === "crit" ? "!" : "")).join(" · ")}</span>
            </span>
          )}
          <span className="tabular-nums">
            takes <span className="text-[15px]">{l.amount}</span>
            {l.notes.length > 0 && <span className={`ml-1 text-xs italic ${INK.faded}`}>({l.notes.join(", ")})</span>}
          </span>
          <span className="ml-auto">
            <HpChange line={l} />
          </span>
        </div>
        </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─── the panel ──────────────────────────────────────────────────── */

export default function GroupRoll({ kind, targets, source, onApply, onClose, bare = false }) {
  const isSave = kind === "save";

  // the form
  const [label, setLabel] = useState("");
  const [ability, setAbility] = useState("dex");
  const [dc, setDc] = useState(15);
  const [onSuccess, setOnSuccess] = useState("half");
  const [damageRoll, setDamageRoll] = useState("once");
  const [rows, setRows] = useState([newPart(isSave ? "fire" : "piercing")]);
  const [count, setCount] = useState(1);
  const [toHit, setToHit] = useState(5);
  const [critOn, setCritOn] = useState(20);
  const [critRule, setCritRule] = useState("double_dice");
  // per creature: { key: "advantage" } and, for saves, { key: 14 } rolled at the table
  const [modes, setModes] = useState(() => Object.fromEntries(targets.map((t) => [t.key, isSave && t.magicResistance ? "advantage" : "normal"])));
  const [given, setGiven] = useState({});
  // what the last loadout filled in: { name, missing: ["DC", …] }, and "kept as a loadout" notes
  const [filled, setFilled] = useState(null);
  const [kept, setKept] = useState(null);

  // the answer
  const [result, setResult] = useState(null);
  const [plan, setPlan] = useState([]);
  const [overturned, setOverturned] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);

  const abilityName = ABILITIES.find((a) => a.key === ability)?.label;
  const name = label.trim() || (isSave ? `${abilityName} save` : "Attack");

  const roll = async () => {
    setBusy(true);
    const list = targets.map((t) => ({ t, mode: modes[t.key] || "normal", given: given[t.key] ?? null }));
    const meta = { source, label: isSave ? `${name} · ${abilityName}` : `${name} · ${signed(toHit)}` };
    const res = isSave
      ? await useDiceStore.getState().saves(saveRequest({ ability, dc, onSuccess, damage: rows, damageRoll, list }), meta)
      : await useDiceStore.getState().attacks(attackRequest({ name, count, toHit, critOn, damage: rows, critRule, list }), meta);
    setBusy(false);
    if (!res.ok) return setProblem(res.message);
    setProblem(null);
    setResult(res.result);
    setOverturned({});
    setPlan(isSave ? savePlan(res.result, targets) : attackPlan(res.result, targets));
  };

  const overturn = (key, passed) => {
    const next = { ...overturned, [key]: passed };
    setOverturned(next);
    const keep = Object.fromEntries(plan.map((l) => [l.key, l.apply]));
    setPlan(savePlan(result, targets, next).map((l) => ({ ...l, apply: keep[l.key] ?? true })));
  };

  const fill = (loadout) => {
    const { form, missing } = fillFrom(loadout, kind);
    const fallbackType = rows[0]?.type || (isSave ? "fire" : "piercing");
    if (form.label != null) setLabel(form.label);
    if (form.rows) setRows(form.rows.map((r) => ({ ...r, type: r.type || fallbackType })));
    if (form.ability) setAbility(form.ability);
    if (form.dc != null) setDc(form.dc);
    if (form.onSuccess) setOnSuccess(form.onSuccess);
    if (form.damageRoll) setDamageRoll(form.damageRoll);
    if (form.toHit != null) setToHit(form.toHit);
    if (form.count != null) setCount(form.count);
    if (form.critOn != null) setCritOn(form.critOn);
    if (form.mode) setModes(Object.fromEntries(targets.map((t) => [t.key, form.mode])));
    setFilled({ name: loadout.name, missing });
    setKept(null);
  };

  const keep = async () => {
    const commonMode = new Set(Object.values(modes)).size === 1 ? Object.values(modes)[0] : "normal";
    const data = loadoutFrom({ kind, label, rows, ability, dc, onSuccess, damageRoll, toHit, count, critOn, mode: commonMode });
    const res = await useDiceStore.getState().createLoadout(data);
    setKept(res.ok ? `Kept as the loadout "${res.loadout.name}".` : `Couldn't keep it — ${res.message}.`);
  };

  const chosen = plan.filter((l) => l.apply && l.amount > 0);
  const anyGiven = useMemo(() => Object.values(given).some((v) => v != null), [given]);

  const Frame = bare ? React.Fragment : ParchmentSheet;
  let lastGroup = null;

  return (
    <Frame>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4">
        <h3 className="text-2xl tracking-wide">{isSave ? "Make them save" : "Attack them"}</h3>
        <span className={`text-sm italic ${INK.faded}`}>
          {targets.length} {targets.length === 1 ? "creature" : "creatures"}
        </span>
        {!result && <LoadoutPick onPick={fill} />}
        {onClose && (
          <span className="ml-auto">
            <InkButton onClick={onClose}>{result ? "close" : "cancel"}</InkButton>
          </span>
        )}
      </div>

      {!result ? (
        <div className="space-y-4">
          {filled && (
            <p className={`-mt-1 text-sm italic ${INK.faded}`}>
              Filled from {filled.name}
              {filled.missing.length ? (
                <>
                  {" "}· <span className={INK.rubric}>not in it: {filled.missing.join(", ")}</span> — set {filled.missing.length === 1 ? "that" : "those"} here
                </>
              ) : (
                " · everything was in it"
              )}
            </p>
          )}
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <InkText value={label} onChange={(e) => setLabel(e.target.value)} placeholder={isSave ? "what is it? e.g. Fireball" : "what is it? e.g. Shortbow"} aria-label="What it is" className="h-8 min-w-[12rem] flex-1 text-lg" />
            {isSave ? (
              <>
                <span className="flex flex-wrap items-baseline gap-x-2">
                  {ABILITIES.map((a) => (
                    <button key={a.key} type="button" onClick={() => setAbility(a.key)} className={chipBtn(ability === a.key)} title={a.name}>
                      {a.label}
                    </button>
                  ))}
                </span>
                <Field label="DC">
                  <InkNumber value={dc} min={1} max={40} fallback={10} onChange={(v) => setDc(v ?? 10)} aria-label="Save DC" className="h-8 w-12 text-lg" />
                </Field>
              </>
            ) : (
              <>
                <Field label="to hit">
                  <InkNumber value={toHit} min={-10} max={30} fallback={0} onChange={(v) => setToHit(v ?? 0)} aria-label="To hit" className="h-8 w-12 text-lg" />
                </Field>
                <Field label="attacks each">
                  <InkNumber value={count} min={1} max={100} fallback={1} onChange={(v) => setCount(v ?? 1)} aria-label="Attacks against each" className="h-8 w-12 text-lg" />
                </Field>
              </>
            )}
          </div>

          <DamageRows rows={rows} setRows={setRows} allowGiven={isSave} />

          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
            {isSave ? (
              <>
                <span className="flex items-baseline gap-x-2">
                  <span className={`italic ${INK.faded}`}>on a success</span>
                  <button type="button" onClick={() => setOnSuccess("half")} className={chipBtn(onSuccess === "half")}>
                    half
                  </button>
                  <button type="button" onClick={() => setOnSuccess("none")} className={chipBtn(onSuccess === "none")}>
                    nothing
                  </button>
                </span>
                <span className="flex items-baseline gap-x-2">
                  <span className={`italic ${INK.faded}`}>damage</span>
                  <button type="button" onClick={() => setDamageRoll("once")} className={chipBtn(damageRoll === "once")} title="One roll for everyone, as the rules say">
                    one roll for all
                  </button>
                  <button type="button" onClick={() => setDamageRoll("each")} className={chipBtn(damageRoll === "each")}>
                    a roll for each
                  </button>
                </span>
              </>
            ) : (
              <>
                <Field label="crit on">
                  <InkNumber value={critOn} min={2} max={20} fallback={20} onChange={(v) => setCritOn(v ?? 20)} aria-label="Crit on" className="h-7 w-10" />
                </Field>
                <span className="flex items-baseline gap-x-2">
                  <span className={`italic ${INK.faded}`}>a crit</span>
                  <button type="button" onClick={() => setCritRule("double_dice")} className={chipBtn(critRule === "double_dice")} title="Roll the damage dice twice (the rule)">
                    doubles the dice
                  </button>
                  <button type="button" onClick={() => setCritRule("max_plus_roll")} className={chipBtn(critRule === "max_plus_roll")} title="Maximum damage plus a normal roll">
                    max + a roll
                  </button>
                </span>
              </>
            )}
          </div>

          {problem && <p className={`text-sm italic ${INK.rubric}`}>{problem}</p>}
          <p className="flex flex-wrap items-baseline gap-x-4">
            <InkButton active onClick={roll} disabled={busy}>
              {busy ? "rolling…" : isSave ? "roll the saves" : "roll the attacks"}
            </InkButton>
            <button type="button" onClick={keep} className={addBtn} title="Keep this as a dice loadout, to fill it in again next time">
              keep as a loadout
            </button>
            <span className={`text-xs italic ${INK.faint}`}>advantage or a table roll for someone? set it below first</span>
          </p>
          {kept && <p className={`-mt-2 text-sm italic ${INK.faded}`}>{kept}</p>}

          <div>
            <SubHeading count={targets.length}>{isSave ? "Who saves" : "Who is attacked"}</SubHeading>
            {targets.map((t) => {
              const heading = t.group && t.group !== lastGroup ? t.group : null;
              lastGroup = t.group || lastGroup;
              return (
                <React.Fragment key={t.key}>
                  {heading && <p className={`mt-2 ${smallCaps}`}>{heading}</p>}
                  <div className="flex flex-wrap items-baseline gap-x-3 border-b border-[#7b6346]/10 py-1 text-sm last:border-b-0">
                    <span className="w-40 truncate text-[15px]">{t.name}</span>
                    <span className={`w-20 tabular-nums ${INK.faded}`}>{isSave ? `${abilityName} ${signed(t.saves?.[ability] ?? 0)}` : `AC ${t.ac ?? "—"}`}</span>
                    <ModePick value={modes[t.key] || "normal"} onChange={(m) => setModes({ ...modes, [t.key]: m })} label={`Advantage for ${t.name}`} />
                    {isSave && (
                      <Field label="rolled">
                        <InkNumber value={given[t.key] ?? null} min={1} max={20} onChange={(v) => setGiven({ ...given, [t.key]: v })} placeholder="—" aria-label={`${t.name}'s own roll`} className="h-6 w-10" />
                      </Field>
                    )}
                    <span className={`min-w-0 truncate text-xs italic ${INK.faint}`}>
                      {[isSave && t.magicResistance ? "magic resistance" : "", defenseWords(t.defenses)].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
            {isSave && <p className={`mt-1 text-xs italic ${INK.faint}`}>Type a d20 in "rolled" for anyone who rolled at the table{anyGiven ? "" : " — the rest are rolled for you"}.</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-lg">{name}</p>
          <p className="flex flex-wrap items-baseline gap-x-4">
            <InkButton active onClick={() => onApply(chosen, name)} disabled={!chosen.length}>
              {chosen.length ? `apply the damage to ${chosen.length}` : "no damage to apply"}
            </InkButton>
            <InkButton onClick={roll} disabled={busy}>
              roll again
            </InkButton>
            <InkButton onClick={() => setResult(null)}>change it</InkButton>
          </p>
          <p className={`text-xs italic ${INK.faint}`}>Nothing has changed yet. Untick anyone it shouldn't touch.</p>
          <Preview kind={kind} plan={plan} setPlan={setPlan} result={result} onOverturn={overturn} />
        </div>
      )}
    </Frame>
  );
}