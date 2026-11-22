import React, { useMemo, useState } from "react";
import { INK, InkButton, InkChoice, InkHeading as Heading, InkNumber, InkRemove, InkText, Line, Mark, ParchmentSheet, Title } from "../../../../styles/parchment";
import { wornArmor } from "../../../../utils/derive";
import {
  labelOf,
  manualAdd,
  manualSet,
  setDefense,
  setDistance,
  setFlag,
  setHas,
  setManualAdd,
  setManualSet,
  signed,
  sourcesOf,
  toInt,
  useSheet,
} from "../sheetHelpers";
import {
  DEFENSE_KINDS,
  FLAGS,
  PROFICIENCY_KINDS,
  SENSE_TYPES,
  SPEED_TYPES,
  distanceEntries,
  expOf,
  formatNumber,
  hitDiceLabel,
  toId,
  xpProgress,
} from "./generalHelpers";

/* Define tab: General — vitals, movement, senses, defenses,
   proficiencies, offense and experience, on parchment. Classes (leveling,
   features, tables) are on the Class tab.

   The numbers are worked out by utils/derive.js from the layers. What the
   player changes here goes to the manual layer (see sheetHelpers.js):
     ± boxes              a modifier that adds (ac, initiative, pb, hp_max…)
     "set" numbers        a modifier that sets the final value (AC 18)
     speeds and senses    their own value, or an override of a granted one
     chips                added to the grants, or taken away with removes
   Half width: everything in one column. Full width: two columns. */

const small = `text-[10px] font-semibold uppercase tracking-[0.16em] ${INK.faded}`;

/* ─── Small pieces ───────────────────────────────────────────────── */

// "± n" blank for the player's own bonus.
function Adj({ value, onChange, label }) {
  const n = toInt(value);
  return (
    <span className={`inline-flex items-baseline text-xs ${n ? INK.ink : INK.faint}`} title="Your own bonus (items, blessings…)">
      ±
      <InkNumber value={n || null} placeholder="0" fallback={0} onChange={(v) => onChange(v ?? 0)} aria-label={label} className="h-6 w-8 text-xs" />
    </span>
  );
}

const Total = ({ children, strong = true }) => (
  <span className={`min-w-[2.25rem] text-right tabular-nums ${strong ? "text-[17px] font-semibold" : ""}`}>{children}</span>
);

// The worked-out number, or the player's own one written over it.
function Overridable({ value, own, onSet, label }) {
  const [editing, setEditing] = useState(false);
  if (own != null || editing) {
    return (
      <span className="inline-flex items-baseline gap-1" title={`Your own number. Worked out it would be ${value}.`}>
        <InkNumber
          value={own}
          autoFocus={editing && own == null}
          placeholder={String(value)}
          onChange={(v) => {
            onSet(v);
            setEditing(false);
          }}
          aria-label={label}
          className="h-7 w-12 text-[17px] font-semibold"
        />
        <InkRemove
          onClick={() => {
            onSet(null);
            setEditing(false);
          }}
          label={`Use the worked-out ${label}`}
        />
      </span>
    );
  }
  return (
    <span className="inline-flex items-baseline gap-2">
      <InkButton onClick={() => setEditing(true)} title={`Write your own ${label}`} className="text-xs">
        set
      </InkButton>
      <Total>{value}</Total>
    </span>
  );
}

// Chips: what the character has, ✕ to take it away; struck-out ones were
// taken away by the player and can be given back; a blank to add one.
function Chips({ have, removed = [], sources, onSet, placeholder, emptyText }) {
  const [text, setText] = useState("");
  const add = () => {
    const id = toId(text);
    if (id) onSet(id, true);
    setText("");
  };
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
      {!have.length && !removed.length && <span className={`text-sm italic ${INK.faint}`}>{emptyText}</span>}
      {have.map((id) => (
        <span key={id} className="group inline-flex items-baseline gap-0.5 text-[15px]" title={sources?.(id)?.length ? `from ${sources(id).join(", ")}` : "added by you"}>
          {labelOf(id)}
          <button type="button" onClick={() => onSet(id, false)} aria-label={`Take away ${labelOf(id)}`} className={`hidden text-xs group-hover:inline ${INK.faded} hover:text-rubric`}>
            ✕
          </button>
        </span>
      ))}
      {removed.map((id) => (
        <button key={`r-${id}`} type="button" onClick={() => onSet(id, true)} title="Taken away by you. Click to give it back." className={`text-[15px] line-through decoration-rubric/60 ${INK.faint} hover:text-ink`}>
          {labelOf(id)}
        </button>
      ))}
      <InkText
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        onBlur={add}
        placeholder={placeholder}
        className="h-7 w-32 text-sm"
      />
    </div>
  );
}

// "+ fly  + swim …" for the kinds not there yet.
function AddLinks({ types, have, onAdd }) {
  const missing = types.filter((t) => !have.includes(t));
  if (!missing.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
      {missing.map((t) => (
        <InkButton key={t} onClick={() => onAdd(t)}>
          + {t}
        </InkButton>
      ))}
    </div>
  );
}

/* ─── Tab ─────────────────────────────────────────────────────────── */

// Per level (each level's average, roll or set number, from leveling)
// or one number of the player's own for the whole maximum.
const HP_MODES = [
  { value: "average", label: "by level" },
  { value: "manual", label: "my own" },
];

export default function GeneralDefine() {
  const { ch, d, patchChar } = useSheet();

  const [xpStep, setXpStep] = useState(100);
  const armor = useMemo(() => wornArmor(ch), [ch]);

  if (!ch || !d) return null;

  // Clicks and finished numbers save right away.
  const write = (patch) => patchChar(patch, { now: true });
  const hp = ch.hp || { mode: "average" };
  const xp = expOf(ch);
  const xpInfo = xpProgress(xp);
  const classSummary = d.classes.map((c) => `${c.name} ${c.level}`).join(" / ");

  const speedKeys = distanceEntries(d.speed, SPEED_TYPES);
  const senseKeys = distanceEntries(d.senses, SENSE_TYPES);
  const removedOf = (kind) => d.removed?.[kind] || [];

  const distanceRow = (kind, type) => {
    const flag = FLAGS[type];
    const value = d[kind][type];
    const from = sourcesOf(ch, kind, type);
    return (
      <Line key={type} label={labelOf(type)} hint={from.length ? `from ${from.join(", ")}` : "added by you"}>
        {flag && (
          <span className={`inline-flex items-center text-xs italic ${INK.faded}`}>
            <Mark on={!!d[kind][flag.key]} onClick={() => write(setFlag(ch, kind, flag.key, !d[kind][flag.key]))} label={flag.label} />
            {flag.label}
          </span>
        )}
        <InkNumber
          value={typeof value === "number" ? value : null}
          min={0}
          placeholder="—"
          fallback={0}
          onChange={(v) => write(setDistance(ch, kind, type, v ?? 0))}
          aria-label={`${type} ${kind === "speed" ? "speed" : "range"}`}
          className="h-7 w-12 text-[15px]"
        />
        <span className={`text-xs ${INK.faded}`}>ft</span>
        {kind === "speed" && type === "walk" ? <span className="w-5" /> : <InkRemove onClick={() => write(setDistance(ch, kind, type, null))} label={`Remove ${type}`} />}
      </Line>
    );
  };

  return (
    <ParchmentSheet>
      <Title
        after={
          <span className={`text-sm italic ${INK.faded}`}>
            level <span className={`not-italic font-semibold ${INK.ink}`}>{d.level}</span>
            {classSummary && <> · {classSummary}</>}
          </span>
        }
      >
        General
      </Title>

      {/* Classes live on the Class tab (leveling, features, tables). */}
      {d.classes.length > 0 && (
        <p className={`-mt-3 mb-8 text-sm ${INK.faded}`}>
          <span className="italic">Total level</span> <span className={`font-semibold ${INK.ink}`}>{d.level}</span>
          {"  ·  "}
          <span className="italic">hit dice</span> <span className={`font-semibold ${INK.ink}`}>{hitDiceLabel(d.hit_dice)}</span>
          {"  ·  "}
          <span className="italic">level up and down on the Class tab</span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-x-14 gap-y-9 @4xl:grid-cols-2">
        {/* Left column */}
        <div className="space-y-9">
          <section>
            <Heading>Vitals</Heading>
            <Line
              label="Armor Class"
              hint={[armor.body ? armor.body.name : "no armour", armor.shield ? armor.shield.name : null].filter(Boolean).join(" + ")}
            >
              <Adj value={manualAdd(ch, "ac")} onChange={(v) => write(setManualAdd(ch, "ac", v))} label="Armor class bonus" />
              <Overridable value={d.ac} own={manualSet(ch, "ac")} onSet={(v) => write(setManualSet(ch, "ac", v))} label="AC" />
            </Line>
            <Line label="Hit point maximum">
              <InkChoice label="How hit points are worked out" options={HP_MODES} value={hp.mode === "manual" ? "manual" : "average"} onChange={(mode) => write({ hp: { ...hp, mode } })} />
              {hp.mode === "manual" ? (
                <InkNumber
                  value={toInt(hp.manual, null)}
                  min={0}
                  placeholder="—"
                  fallback={0}
                  onChange={(v) => write({ hp: { ...hp, manual: v ?? 0 } })}
                  aria-label="Hit point maximum"
                  className="h-7 w-14 text-[17px] font-semibold"
                />
              ) : (
                <>
                  <Adj value={manualAdd(ch, "hp_max")} onChange={(v) => write(setManualAdd(ch, "hp_max", v))} label="Hit point bonus" />
                  <Total>{d.hp_max}</Total>
                </>
              )}
            </Line>
            <Line label="Initiative" hint="Dexterity modifier plus any bonus">
              <Adj value={manualAdd(ch, "initiative")} onChange={(v) => write(setManualAdd(ch, "initiative", v))} label="Initiative bonus" />
              <Total>{signed(d.initiative)}</Total>
            </Line>
            <Line label="Proficiency bonus" hint={`From total level ${d.level}, plus any bonus`}>
              <Adj value={manualAdd(ch, "pb")} onChange={(v) => write(setManualAdd(ch, "pb", v))} label="Proficiency bonus modifier" />
              <Total>{signed(d.pb)}</Total>
            </Line>
          </section>

          <section>
            <Heading>Movement</Heading>
            {speedKeys.map((t) => distanceRow("speed", t))}
            <AddLinks types={SPEED_TYPES} have={speedKeys} onAdd={(t) => write(setDistance(ch, "speed", t, d.speed.walk || 30))} />
          </section>

          <section>
            <Heading>Senses</Heading>
            {senseKeys.length === 0 && <p className={`text-sm italic ${INK.faint}`}>Only ordinary sight.</p>}
            {senseKeys.map((t) => distanceRow("senses", t))}
            <AddLinks types={SENSE_TYPES} have={senseKeys} onAdd={(t) => write(setDistance(ch, "senses", t, 60))} />
          </section>

          <section>
            <Heading>Defenses</Heading>
            <div className="space-y-3">
              {DEFENSE_KINDS.map((k) => (
                <div key={k.key}>
                  <div className={small}>{k.label}</div>
                  <Chips
                    have={d.defenses[k.key] || []}
                    removed={d.removed?.defenses?.[k.key] || []}
                    onSet={(id, want) => write(setDefense(ch, k.key, id, want))}
                    placeholder="+ add"
                    emptyText="none"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-9">
          <section>
            <Heading>Offense</Heading>
            <Line label="Melee attack" hint="Strength modifier + proficiency bonus">
              <Total>{signed(d.attacks.melee)}</Total>
            </Line>
            <Line label="Ranged attack" hint="Dexterity modifier + proficiency bonus">
              <Total>{signed(d.attacks.ranged)}</Total>
            </Line>
            <Line label="Bonus to every attack">
              <Adj value={manualAdd(ch, "attack")} onChange={(v) => write(setManualAdd(ch, "attack", v))} label="Attack bonus" />
            </Line>

            {d.spellcasting.length > 0 && (
              <>
                <div className={`mt-4 mb-1 ${small}`}>Spellcasting</div>
                {d.spellcasting.map((s) => (
                  <Line key={s.owner} label={s.name} hint={`${s.ability.toUpperCase()} spellcasting`}>
                    <span className={`text-xs italic ${INK.faded}`}>attack</span>
                    <Total>{signed(s.attack)}</Total>
                    <span className={`text-xs italic ${INK.faded}`}>DC</span>
                    <Total>{s.dc}</Total>
                  </Line>
                ))}
                <Line label="Your own bonus" hint="to spell attacks / spell save DC">
                  <Adj value={manualAdd(ch, "spell_attack")} onChange={(v) => write(setManualAdd(ch, "spell_attack", v))} label="Spell attack bonus" />
                  <Adj value={manualAdd(ch, "spell_dc")} onChange={(v) => write(setManualAdd(ch, "spell_dc", v))} label="Spell save DC bonus" />
                </Line>
              </>
            )}
          </section>

          <section>
            <Heading>Proficiencies</Heading>
            <div className="space-y-3">
              {PROFICIENCY_KINDS.map((k) => (
                <div key={k.key}>
                  <div className={small}>{k.label}</div>
                  <Chips
                    have={d.proficiencies[k.key] || []}
                    removed={removedOf(k.key)}
                    sources={(id) => sourcesOf(ch, k.key, id)}
                    onSet={(id, want) => write(setHas(ch, k.key, id, want))}
                    placeholder="+ add"
                    emptyText="none"
                  />
                </div>
              ))}
            </div>
          </section>

          <section>
            <Heading>Experience</Heading>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <InkNumber value={xp} min={0} fallback={0} onChange={(v) => write({ exp: v ?? 0 })} aria-label="Experience points" className="h-9 w-28 text-2xl font-semibold" />
              <span className={`text-sm italic ${INK.faded}`}>xp</span>
              <span className="ml-auto inline-flex items-baseline gap-2 text-sm">
                <InkButton onClick={() => write({ exp: Math.max(0, xp - toInt(xpStep, 0)) })}>− </InkButton>
                <InkNumber value={toInt(xpStep, null)} min={0} fallback={0} onChange={(v) => setXpStep(v ?? 0)} aria-label="Experience step" className="h-7 w-14 text-[15px]" />
                <InkButton onClick={() => write({ exp: xp + toInt(xpStep, 0) })}> +</InkButton>
              </span>
            </div>
            <div className="mt-3 h-[3px] w-full bg-rule/20">
              <div className="h-full bg-rubric/75" style={{ width: `${Math.round(xpInfo.fraction * 100)}%` }} />
            </div>
            <p className={`mt-1.5 text-xs italic ${INK.faded}`}>
              {xpInfo.next ? (
                <>
                  {formatNumber(xp)} of {formatNumber(xpInfo.next)} for level {xpInfo.level + 1}
                  {xpInfo.level > d.level && <span className={INK.rubric}> — enough for level {xpInfo.level}</span>}
                </>
              ) : (
                "The highest level there is."
              )}
            </p>
          </section>
        </div>
      </div>

    </ParchmentSheet>
  );
}
