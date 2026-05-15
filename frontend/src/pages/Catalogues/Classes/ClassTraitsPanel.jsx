import React from "react";
import {
  formatPrimaryAbility,
  buildProfs,
  hasAnyProfs,
  normalizeMulticlassRequirements,
} from "./classHelpers";

export default function ClassTraitsPanel({ selectedClassData }) {
  if (!selectedClassData) {
    return (
      <aside className="bg-slate-900/40 border border-slate-700 rounded-lg p-4">
        <p className="text-sm text-slate-400 italic">
          Select a class to view its traits.
        </p>
      </aside>
    );
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

  const showMulticlass =
    multiclassing &&
    (multiclassing.requirements || hasAnyProfs(multiclassing.proficiencies));

  return (
    <aside className="bg-slate-900/40 border border-slate-700 rounded-lg p-4">
      <div className="space-y-5">
        {/* Core Traits */}
        <section className="space-y-3">
          <PanelHeading>Core Traits</PanelHeading>

          {primaryAbilityGroups.length > 0 && (
            <TraitRow label="Primary Ability">
              <span className="text-sm">
                {primaryAbilityGroups.map((group, i) => (
                  <React.Fragment key={i}>
                    <span className="text-amber-300 font-semibold">
                      {group.map((a) => a.toUpperCase()).join(" and ")}
                    </span>
                    {i < primaryAbilityGroups.length - 1 && (
                      <span className="text-slate-400"> or </span>
                    )}
                  </React.Fragment>
                ))}
              </span>
            </TraitRow>
          )}

          {cls.hit_dice && (
            <TraitRow label="Hit Dice">
              <ProfPill tone="accent">{cls.hit_dice}</ProfPill>
            </TraitRow>
          )}

          {cls.saving_throw_proficiency?.length > 0 && (
            <TraitRow label="Saving Throws">
              <div className="flex flex-wrap gap-1">
                {cls.saving_throw_proficiency.map((a) => (
                  <ProfPill key={a}>{a.toUpperCase()}</ProfPill>
                ))}
              </div>
            </TraitRow>
          )}

          {cls.spellcastingAbility && (
            <TraitRow label="Spellcasting">
              <ProfPill tone="accent">{cls.spellcastingAbility.toUpperCase()}</ProfPill>
            </TraitRow>
          )}
        </section>

        {/* Starting Proficiencies */}
        {hasAnyProfs(proficiencies) && (
          <section className="space-y-3 border-t border-slate-700 pt-4">
            <PanelHeading>Starting Proficiencies</PanelHeading>
            <ProficiencyBlocks profs={proficiencies} />
          </section>
        )}

        {/* Multiclassing */}
        {showMulticlass && (
          <section className="space-y-3 border-t border-slate-700 pt-4">
            <PanelHeading>Multiclassing</PanelHeading>

            <TraitRow label="Requirements">
              {multiclassing.requirements ? (
                <div className="flex flex-wrap items-center gap-1">
                  {multiclassing.requirements.pairs.map(([ability, score], i, arr) => (
                    <React.Fragment key={`${ability}-${i}`}>
                      <ProfPill tone="accent">
                        {ability.toUpperCase()} {score}
                      </ProfPill>
                      {i < arr.length - 1 && (
                        <span className="text-xs text-slate-400">
                          {multiclassing.requirements.connector}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">
                  No ability score prerequisites.
                </span>
              )}
            </TraitRow>

            {hasAnyProfs(multiclassing.proficiencies) && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">
                  Proficiencies Gained
                </p>
                <ProficiencyBlocks profs={multiclassing.proficiencies} />
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}

// ── internals ─────────────────────────────────────────────────────────────────

function PanelHeading({ children }) {
  return (
    <h5 className="text-sm font-semibold tracking-wider uppercase text-lime-400">
      {children}
    </h5>
  );
}

function TraitRow({ label, children }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </p>
      <div className="text-sm text-slate-100">{children}</div>
    </div>
  );
}

function ProfPill({ children, muted, tone = "default" }) {
  const tones = {
    default: "bg-slate-800 text-slate-200 border-slate-600",
    muted:   "bg-slate-800/60 text-slate-400 border-slate-700",
    accent:  "bg-amber-500/10 text-amber-300 border-amber-500/40",
  };
  const cls = muted ? tones.muted : (tones[tone] || tones.default);
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {children}
    </span>
  );
}

function ProficiencyBlocks({ profs }) {
  if (!profs) return null;
  const { armor, weapons, tools, skills } = profs;
  if (!armor.length && !weapons.length && !tools.length && !skills.length) return null;

  return (
    <div className="space-y-3">
      {armor.length > 0 && (
        <TraitRow label="Armor">
          <div className="flex flex-wrap gap-1">
            {armor.map((a, i) => (
              <span key={i} className="flex items-center gap-1">
                <ProfPill muted={!!a.note}>{a.label}</ProfPill>
                {a.note && (
                  <span className="text-xs text-slate-400 italic cursor-help" title={a.note}>
                    *
                  </span>
                )}
              </span>
            ))}
          </div>
          {armor.some((a) => a.note) && (
            <div className="mt-1 space-y-0.5">
              {armor.filter((a) => a.note).map((a, i) => (
                <p key={i} className="text-xs text-slate-400 italic leading-tight">
                  * {a.note}
                </p>
              ))}
            </div>
          )}
        </TraitRow>
      )}

      {weapons.length > 0 && (
        <TraitRow label="Weapons">
          <div className="flex flex-wrap gap-1">
            {weapons.map((w, i) => (
              <span key={i} className="flex items-center gap-1">
                <ProfPill muted={w.optional}>{w.label}</ProfPill>
                {w.optional && (
                  <span className="text-xs text-amber-400 italic">opt.</span>
                )}
              </span>
            ))}
          </div>
        </TraitRow>
      )}

      {tools.length > 0 && (
        <TraitRow label="Tools">
          <div className="flex flex-wrap gap-1">
            {tools.map((t, i) => (
              <ProfPill key={i} muted={t.isChoice}>
                {t.isChoice ? `${t.count}× ${t.label}` : t.label}
              </ProfPill>
            ))}
          </div>
        </TraitRow>
      )}

      {skills.length > 0 && (
        <TraitRow label="Skills">
          <div className="space-y-0.5">
            {skills.map((s, i) => (
              <div key={i} className="text-xs text-slate-300 leading-relaxed">
                <span className="text-amber-400 font-semibold">
                  Choose {s.count}:{" "}
                </span>
                {s.from.join(", ")}
              </div>
            ))}
          </div>
        </TraitRow>
      )}
    </div>
  );
}