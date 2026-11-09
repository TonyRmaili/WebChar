import React from "react";
import { formatPrimaryAbility, buildProfs, hasAnyProfs, normalizeMulticlassRequirements } from "./classHelpers";
import { InkHeading } from "../../../styles/parchment";

/* The class's traits, written down the left column: primary ability, hit
   dice, saves, proficiencies and multiclassing, as labelled lines. Words
   worth noticing (hit dice, spellcasting ability, requirements) are inked
   in rubric; optional or "see note" ones are faded and italic. */
export default function ClassTraitsPanel({ selectedClassData }) {
  if (!selectedClassData) {
    return <p className="text-sm italic text-ink-faded">Select a class to view its traits.</p>;
  }

  const cls = selectedClassData.class || {};
  const primaryAbilityGroups = formatPrimaryAbility(cls.primaryAbility);
  const proficiencies = buildProfs(cls.startingProficiencies);

  const multiclassing = cls.multiclassing
    ? {
        requirements: normalizeMulticlassRequirements(cls.multiclassing.requirements),
        proficiencies: buildProfs(cls.multiclassing.proficienciesGained),
      }
    : null;

  const showMulticlass = multiclassing && (multiclassing.requirements || hasAnyProfs(multiclassing.proficiencies));

  return (
    <aside className="space-y-6">
      {/* Core Traits */}
      <section className="space-y-3">
        <InkHeading>Core Traits</InkHeading>

        {primaryAbilityGroups.length > 0 && (
          <TraitRow label="Primary Ability">
            {primaryAbilityGroups.map((group, i) => (
              <React.Fragment key={i}>
                <span className="font-semibold text-rubric">{group.map((a) => a.toUpperCase()).join(" and ")}</span>
                {i < primaryAbilityGroups.length - 1 && <span className="italic text-ink-faded"> or </span>}
              </React.Fragment>
            ))}
          </TraitRow>
        )}

        {cls.hit_dice && (
          <TraitRow label="Hit Dice">
            <Word tone="accent">{cls.hit_dice}</Word>
          </TraitRow>
        )}

        {cls.saving_throw_proficiency?.length > 0 && (
          <TraitRow label="Saving Throws">
            <Words>
              {cls.saving_throw_proficiency.map((a) => (
                <Word key={a}>{a.toUpperCase()}</Word>
              ))}
            </Words>
          </TraitRow>
        )}

        {cls.spellcastingAbility && (
          <TraitRow label="Spellcasting">
            <Word tone="accent">{cls.spellcastingAbility.toUpperCase()}</Word>
          </TraitRow>
        )}
      </section>

      {/* Starting Proficiencies */}
      {hasAnyProfs(proficiencies) && (
        <section className="space-y-3">
          <InkHeading>Starting Proficiencies</InkHeading>
          <ProficiencyBlocks profs={proficiencies} />
        </section>
      )}

      {/* Multiclassing */}
      {showMulticlass && (
        <section className="space-y-3">
          <InkHeading>Multiclassing</InkHeading>

          <TraitRow label="Requirements">
            {multiclassing.requirements ? (
              <Words>
                {multiclassing.requirements.pairs.map(([ability, score], i, arr) => (
                  <React.Fragment key={`${ability}-${i}`}>
                    <Word tone="accent">
                      {ability.toUpperCase()} {score}
                    </Word>
                    {i < arr.length - 1 && <span className="text-xs italic text-ink-faded">{multiclassing.requirements.connector}</span>}
                  </React.Fragment>
                ))}
              </Words>
            ) : (
              <span className="text-xs italic text-ink-faded">No ability score prerequisites.</span>
            )}
          </TraitRow>

          {hasAnyProfs(multiclassing.proficiencies) && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faded">Proficiencies Gained</p>
              <ProficiencyBlocks profs={multiclassing.proficiencies} />
            </div>
          )}
        </section>
      )}
    </aside>
  );
}

// ── internals ─────────────────────────────────────────────────────────────────

function TraitRow({ label, children }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faded">{label}</p>
      <div className="text-sm text-ink">{children}</div>
    </div>
  );
}

// A run of words, spaced like a written list.
const Words = ({ children }) => <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">{children}</div>;

// One proficiency. accent = worth noticing (rubric); muted = optional or with
// a note (faded italic).
function Word({ children, muted, tone = "default" }) {
  const cls = muted ? "italic text-ink-faded" : tone === "accent" ? "font-semibold text-rubric" : "text-ink";
  return <span className={`text-sm ${cls}`}>{children}</span>;
}

function ProficiencyBlocks({ profs }) {
  if (!profs) return null;
  const { armor, weapons, tools, skills } = profs;
  if (!armor.length && !weapons.length && !tools.length && !skills.length) return null;

  return (
    <div className="space-y-3">
      {armor.length > 0 && (
        <TraitRow label="Armor">
          <Words>
            {armor.map((a, i) => (
              <span key={i} className="inline-flex items-baseline gap-0.5">
                <Word muted={!!a.note}>{a.label}</Word>
                {a.note && (
                  <span className="cursor-help text-xs italic text-rubric" title={a.note}>
                    *
                  </span>
                )}
              </span>
            ))}
          </Words>
          {armor.some((a) => a.note) && (
            <div className="mt-1 space-y-0.5">
              {armor
                .filter((a) => a.note)
                .map((a, i) => (
                  <p key={i} className="text-xs italic leading-tight text-ink-faded">
                    * {a.note}
                  </p>
                ))}
            </div>
          )}
        </TraitRow>
      )}

      {weapons.length > 0 && (
        <TraitRow label="Weapons">
          <Words>
            {weapons.map((w, i) => (
              <span key={i} className="inline-flex items-baseline gap-1">
                <Word muted={w.optional}>{w.label}</Word>
                {w.optional && <span className="text-xs italic text-rubric">opt.</span>}
              </span>
            ))}
          </Words>
        </TraitRow>
      )}

      {tools.length > 0 && (
        <TraitRow label="Tools">
          <Words>
            {tools.map((t, i) => (
              <Word key={i} muted={t.isChoice}>
                {t.isChoice ? `${t.count}× ${t.label}` : t.label}
              </Word>
            ))}
          </Words>
        </TraitRow>
      )}

      {skills.length > 0 && (
        <TraitRow label="Skills">
          <div className="space-y-0.5">
            {skills.map((s, i) => (
              <div key={i} className="text-sm leading-relaxed text-ink">
                <span className="font-semibold text-rubric">Choose {s.count}: </span>
                {s.from.join(", ")}
              </div>
            ))}
          </div>
        </TraitRow>
      )}
    </div>
  );
}