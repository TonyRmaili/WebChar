import React, { useMemo } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import { CardHeader, RichText } from "../catalogueParts";
import { ABILITIES, ABILITY_SHORT, buildNameIndex } from "../catalogueHelpers";
import {
  abilityMod, signed, formatAC, formatHP, formatSpeed, formatInitiative, statRows, monsterSubtitle, monsterSections,
  featureUsesWords, legendaryUsesWords, shownSpellGroups, spellGroupLabel, spellEntryWords,
} from "./monsterHelpers";

const linkCls = "underline decoration-dotted underline-offset-2 hover:text-rubric";

/* A monster's statblock, laid out like the 2024 books: type line; AC, HP,
   speed and initiative; the ability table with saves; skills, defenses,
   senses, languages and CR; then traits, actions, bonus actions,
   reactions, legendary, mythic and lair actions, with spellcasting in the
   section it's used from. Variants come last: a version opens its own
   statblock, a toggle variant's abilities are switched on in the tracker. */
export default function MonsterPopup({ monster }) {
  const monsters = useCatalogueStore((s) => s.monsters);
  const spells = useCatalogueStore((s) => s.spells);
  const items = useCatalogueStore((s) => s.items);
  const openPopup = usePopupStore((s) => s.open);
  const index = useMemo(() => buildNameIndex(monsters, spells, items), [monsters, spells, items]);
  const byId = useMemo(() => Object.fromEntries((monsters || []).map((m) => [m.id, m])), [monsters]);

  if (!monster) return null;
  const m = monster;
  const base = m.version_of ? byId[m.version_of] : null;
  const vitals = [
    ["AC", formatAC(m.ac)],
    ["HP", formatHP(m.hp)],
    ["Speed", formatSpeed(m.speed)],
    ["Initiative", formatInitiative(m.initiative, m)],
  ].filter(([, v]) => v);

  return (
    <div className="wc-page h-full overflow-y-auto !rounded-none">
      <div className="px-5 py-4">
        <CardHeader entry={m} subtitle={monsterSubtitle(m)} />

        {m.version_of && (
          <p className="mb-2 text-xs italic text-ink-faded">
            A version of{" "}
            {base ? (
              <button type="button" onClick={() => openPopup("monster", base)} className={linkCls}>{base.name}</button>
            ) : (
              index[m.version_of] || m.version_of
            )}
            .
          </p>
        )}

        {vitals.length > 0 && (
          <div className="mb-2 space-y-0.5">
            {vitals.map(([k, v]) => <StatRow key={k} label={k}>{v}</StatRow>)}
          </div>
        )}

        {m.abilities && <AbilityTable monster={m} />}
        {m.abilities_note && <p className="mb-2 text-xs italic text-ink-faded">{m.abilities_note}</p>}

        <div className="mb-3 space-y-0.5 border-b border-rule/40 pb-2">
          {statRows(m, index).map((r) => <StatRow key={r.label} label={r.label}>{r.value}</StatRow>)}
        </div>

        {monsterSections(m).map((s) => (
          <section key={s.key} className="mt-4">
            <h3 className="mb-1.5 border-b border-rubric/40 pb-0.5 text-sm font-bold uppercase tracking-wider text-rubric">{s.title}</h3>
            {s.key === "legendary_actions" && legendaryUsesWords(m) && (
              <p className="mb-1.5 text-sm italic text-ink-faded">{legendaryUsesWords(m)}</p>
            )}
            {m.section_notes?.[s.key] && <p className="mb-1.5 text-sm italic text-ink-faded">{m.section_notes[s.key]}</p>}
            <div className="space-y-2">
              {s.spellcasting.map((b, i) => <SpellcastingBlock key={`sc-${i}`} block={b} index={index} />)}
              {s.features.map((f, i) => <Feature key={f.id || i} feature={f} />)}
            </div>
          </section>
        ))}

        {m.variants?.length > 0 && (
          <section className="mt-5">
            <h3 className="mb-1.5 border-b border-rule/40 pb-0.5 text-sm font-bold uppercase tracking-wider text-ink-faded">Variants</h3>
            <div className="space-y-3">
              {m.variants.map((v) => {
                const version = v.version ? byId[v.version] : null;
                return (
                  <div key={v.id}>
                    <div className="mb-0.5 text-sm font-semibold">{v.name}</div>
                    <RichText text={v.text} className="!text-sm" />
                    {version && (
                      <button type="button" onClick={() => openPopup("monster", version)} className={`mt-1 text-xs italic ${linkCls}`}>
                        Open the {version.name} statblock
                      </button>
                    )}
                    {v.features?.length > 0 && (
                      <p className="mt-1 text-xs italic text-ink-faded">These abilities are off until switched on in the initiative tracker.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StatRow({ label, children }) {
  return (
    <div className="text-sm leading-snug">
      <span className="font-bold text-ink">{label} </span>
      <span className="text-ink">{children}</span>
    </div>
  );
}

// Score, modifier and save for each ability (2024 layout).
function AbilityTable({ monster: m }) {
  return (
    <table className="my-2 w-full border-y border-rule/40 text-center text-sm">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-ink-faded">
          {ABILITIES.map((a) => <th key={a} className="pt-1 font-semibold">{ABILITY_SHORT[a]}</th>)}
        </tr>
      </thead>
      <tbody>
        <tr>
          {ABILITIES.map((a) => {
            const score = m.abilities?.[a];
            const mod = abilityMod(score);
            const save = m.saves?.[a];
            return (
              <td key={a} className="pb-1 align-top">
                <div className="font-semibold">{score ?? "—"}</div>
                <div className="text-xs text-ink-faded">{mod == null ? "" : signed(mod)}</div>
                <div className={`text-[11px] ${save != null ? "font-semibold text-ink" : "text-ink-faint"}`} title="Saving throw">
                  {save != null ? `save ${signed(save)}` : mod == null ? "" : `save ${signed(mod)}`}
                </div>
              </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );
}

// "**Fire Breath (Recharge 5–6).** Dexterity Saving Throw: DC 21, …"
// A feature without a name (a section's opening words) is shown as text.
function Feature({ feature: f }) {
  if (!f.name) return <RichText text={f.text} className="!text-sm" />;
  const uses = featureUsesWords(f);
  return <RichText text={`**${f.name}${uses ? ` ${uses}` : ""}.** ${f.text || ""}`} className="!text-sm" />;
}

function SpellcastingBlock({ block, index }) {
  const groups = shownSpellGroups(block);
  return (
    <div className="text-sm">
      <RichText text={`**${block.name}.** ${block.text || ""}`} className="!text-sm" />
      {groups.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-3">
          {groups.map((g, i) => (
            <li key={i}>
              <span className="italic text-ink-faded">{spellGroupLabel(g)}: </span>
              {(g.spells || []).map((s) => spellEntryWords(s, index)).join(", ")}
            </li>
          ))}
        </ul>
      )}
      {block.footer && <p className="mt-1 text-xs italic text-ink-faded">{block.footer}</p>}
    </div>
  );
}
