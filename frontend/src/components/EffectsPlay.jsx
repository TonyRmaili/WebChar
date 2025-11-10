import React, { useEffect, useMemo, useCallback } from "react";
import useCharStore from "../store/CharStore";

/* --- helper, not used directly for display anymore --- */
const summarizeDamageRaw = (row) => {
  const list = (row.damages || [])
    .map((d) => {
      const dicePart =
        d.dice_count && d.dice_size
          ? `${d.dice_count}${d.dice_size}`
          : d.dice_size || "";

      const modNum = Number(d.mod);
      const hasMod = Number.isFinite(modNum) && modNum !== 0;
      const modPart = hasMod ? `${modNum > 0 ? "+" : ""}${modNum}` : "";

      const base = [dicePart, modPart].filter(Boolean).join("");

      if (!base && !d.damage_type) return "";
      if (!d.damage_type) return base;
      if (!base) return d.damage_type;
      return `${base} ${d.damage_type}`;
    })
    .filter(Boolean);

  return list.join(", ");
};

const summarizeAttack = (row) => {
  const atk = row.attack || {};
  const type = atk.attack_type || ""; // melee / ranged / spell / ""
  const range = atk.range_ft || "";

  const parts = [];
  if (type) {
    parts.push(type.charAt(0).toUpperCase() + type.slice(1));
  }
  if (range) parts.push(`${range} ft`);

  return parts.join(" • ");
};

export default function EffectsPlay() {
  // --- Zustand selectors ---
  const charData = useCharStore((s) => s.charData);
  const updateCharField = useCharStore((s) => s.updateCharField);
  const postCharData = useCharStore((s) => s.postCharData);

  if (!charData) return null;

  const effects = useMemo(() => {
    const src = charData.effects;
    return Array.isArray(src) ? src : [];
  }, [charData?.effects]);

  const offense = charData.offense || {};
  const saveDcs = offense.save_dcs || {};
  const abilityScores = charData.ability_scores || {};
  const pb = Number(charData.pb?.total ?? 0);

  const getAbilityMod = useCallback(
    (ability) => {
      if (!ability) return 0;
      const key = String(ability).toLowerCase();
      const raw = abilityScores[key]?.mod;
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    },
    [abilityScores]
  );

  const getAttackAbilityModByType = useCallback(
    (attackType) => {
      const type = String(attackType || "").toLowerCase();
      const row = offense[type] || {};
      let base = row.base;
      if (!base) {
        if (type === "ranged") base = "dex";
        else if (type === "spell") base = "cha";
        else base = "str";
      }
      return getAbilityMod(base);
    },
    [offense, getAbilityMod]
  );

  // Total to-hit = PB + abilityMod(from offense.base) + global atk mod + effect's own hit bonus
  const getToHit = useCallback(
    (row) => {
      const atk = row.attack || {};
      const type = String(atk.attack_type || "").toLowerCase();

      const typeRow = offense[type] || {};
      let baseAbility = typeRow.base;
      if (!baseAbility) {
        if (type === "ranged") baseAbility = "dex";
        else if (type === "spell") baseAbility = "cha";
        else baseAbility = "str";
      }

      const abilityMod = getAbilityMod(baseAbility);
      const globalModNum = Number(typeRow.mod);
      const globalMod = Number.isFinite(globalModNum) ? globalModNum : 0;

      const hitBonusNum = Number(atk.hit_bonus);
      const effectBonus = Number.isFinite(hitBonusNum) ? hitBonusNum : 0;

      const total = pb + abilityMod + globalMod + effectBonus;
      if (!Number.isFinite(total)) return null;
      return total;
    },
    [offense, pb, getAbilityMod]
  );

  // Damage summary with ability mod added to first damage entry
  const summarizeDamageWithAttack = useCallback(
    (row) => {
      const damages = row.damages || [];
      if (!damages.length) return "";

      const atkType = row.attack?.attack_type || "";
      const abilityBonus = atkType
        ? getAttackAbilityModByType(atkType)
        : 0;

      const parts = damages
        .map((d, idx) => {
          const dicePart =
            d.dice_count && d.dice_size
              ? `${d.dice_count}${d.dice_size}`
              : d.dice_size || "";

          let baseMod = Number(d.mod);
          if (!Number.isFinite(baseMod)) baseMod = 0;
          const effectiveMod = idx === 0 ? baseMod + abilityBonus : baseMod;

          const hasMod = effectiveMod !== 0;
          const modPart = hasMod
            ? `${effectiveMod > 0 ? "+" : ""}${effectiveMod}`
            : "";

          const base = [dicePart, modPart].filter(Boolean).join("");

          if (!base && !d.damage_type) return "";
          if (!d.damage_type) return base;
          if (!base) return d.damage_type;
          return `${base} ${d.damage_type}`;
        })
        .filter(Boolean);

      return parts.join(", ");
    },
    [getAttackAbilityModByType]
  );

  /* ---- seed missing current_charges from max_charges once ---- */

  useEffect(() => {
    if (!effects.length) return;

    let changed = false;

    const next = effects.map((a) => {
      const c = a?.charges;
      if (!c?.has) return a;

      const max = Number(c.max_charges);
      const hasMax = Number.isFinite(max) && max >= 0;
      const curNum = Number(c.current_charges);
      const hasCur = Number.isFinite(curNum);

      if (hasMax && !hasCur) {
        changed = true;
        return {
          ...a,
          charges: {
            ...c,
            current_charges: max,
          },
        };
      }

      return a;
    });

    if (changed) {
      updateCharField("effects", next);
      postCharData();
    }
  }, [effects, updateCharField, postCharData]);

  /* ---- charge helpers ---- */

  const getCounts = useCallback((effect) => {
    const c = effect?.charges;
    const has = !!c?.has;
    if (!has) return { has: false, current: 0, max: 0 };

    const rawMax = Number(c.max_charges);
    const rawCur = Number(c.current_charges);

    const max = Number.isFinite(rawMax) ? Math.max(0, rawMax) : 0;
    let current = Number.isFinite(rawCur) ? Math.max(0, rawCur) : max;
    current = Math.min(current, max);

    return { has: true, current, max };
  }, []);

  const onUse = useCallback(
    (effectId) => {
      const idx = effects.findIndex((x) => x.id === effectId);
      if (idx < 0) return;

      const a = effects[idx];
      if (!a?.charges?.has) return;

      const { current } = getCounts(a);
      if (current <= 0) return;

      const updated = {
        ...a,
        charges: {
          ...a.charges,
          current_charges: Math.max(0, current - 1),
        },
      };

      const next = [
        ...effects.slice(0, idx),
        updated,
        ...effects.slice(idx + 1),
      ];

      updateCharField("effects", next);
      postCharData();
    },
    [effects, getCounts, updateCharField, postCharData]
  );

  /* ---- grouping by action_type ---- */

  const grouped = useMemo(
    () => ({
      actions: effects.filter(
        (e) => (e.action_type || "action") === "action"
      ),
      bonus_actions: effects.filter((e) => e.action_type === "bonus_action"),
      reactions: effects.filter((e) => e.action_type === "reaction"),
    }),
    [effects]
  );

  const Section = ({ title, rows }) => {
    if (!rows.length) return null;

    return (
      <section className="space-y-2">
        <h4 className="text-slate-200 text-sm font-semibold">{title}</h4>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
          {rows.map((e) => {
            const { has, current, max } = getCounts(e);
            const depleted = has && current <= 0;

            const dmg = summarizeDamageWithAttack(e);
            const atkLabel = summarizeAttack(e);
            const toHit = getToHit(e); // total attack bonus

          
           // --- Save label with live DC from ability_scores + pb + global mod + effect bonus ---
            const saveChip = (() => {
              const save = e.save || {};

              // What the target rolls (label)
              const displayRaw = save.target || save.ability;
              // What DC is based on (caster ability)
              const calcRaw = save.ability || save.target;

              if (!displayRaw && !calcRaw) return "";

              const displayLower = displayRaw
                ? String(displayRaw).toLowerCase()
                : "";
              const displayLabel = displayLower.toUpperCase(); // STR / DEX / WIS ...

              const calcLower = calcRaw
                ? String(calcRaw).toLowerCase()
                : "";

              // Rebuild DC from primitives instead of stored .total
              let baseDc = 0;
              if (calcLower) {
                const key = `save_${calcLower}`;
                const saveRow = saveDcs[key] || {};

                const abilityModForCalc = getAbilityMod(calcLower); // from ability_scores
                const rowModNum = Number(saveRow.mod);
                const rowMod = Number.isFinite(rowModNum) ? rowModNum : 0;

                const rawDc = 8 + pb + abilityModForCalc + rowMod;
                baseDc = Number.isFinite(rawDc) ? rawDc : 0;
              }

              const bonusNum = Number(save.dc_bonus);
              const bonus = Number.isFinite(bonusNum) ? bonusNum : 0;

              const totalDc = baseDc + bonus;

              if (baseDc === 0 && bonus === 0) {
                // no configured DC, just show "Wis save"
                return `${displayLabel} save`;
              }

              const labelParts = [];
              labelParts.push(`${displayLabel} save DC ${totalDc}`);
              if (bonus !== 0) {
                const sign = bonus > 0 ? "+" : "";
                labelParts.push(`(${sign}${bonus} effect bonus)`);
              }
              return labelParts.join(" ");
            })();


            const base =
              "text-left px-3 py-2 rounded-xl border transition focus:outline-none w-full";
            const ok =
              "border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100";
            const off =
              "border-slate-800 bg-slate-900/50 text-slate-500 cursor-default";

            const clickable = has;
            const className = `${base} ${
              !clickable || depleted ? off : ok
            }`;

            const inner = (
              <div className="flex flex-col gap-1">
                {/* Top row: name + charges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate text-slate-50">
                      {e.name || "Unnamed effect"}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[10px] text-slate-200">
                      {atkLabel && (
                        <span className="px-1.5 py-0.5 rounded-full border border-slate-600 bg-slate-900/70">
                          {atkLabel}
                        </span>
                      )}
                      {typeof toHit === "number" && (
                        <span className="px-1.5 py-0.5 rounded-full border border-slate-600 bg-slate-900/70">
                          {toHit >= 0 ? "+" : ""}
                          {toHit} to hit
                        </span>
                      )}
                      {saveChip && (
                        <span className="px-1.5 py-0.5 rounded-full border border-slate-600 bg-slate-900/70">
                          {saveChip}
                        </span>
                      )}
                    </div>
                  </div>

                  {has && (
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-200">
                        Charges
                      </div>
                      <div
                        className={`text-sm font-semibold ${
                          depleted ? "text-slate-500" : "text-slate-50"
                        }`}
                      >
                        {current} / {max}
                      </div>
                    </div>
                  )}
                </div>

                {/* Damage line */}
                {dmg && (
                  <div className="text-[11px] text-slate-100">
                    {dmg}
                  </div>
                )}
              </div>
            );

            if (clickable) {
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    if (!depleted) onUse(e.id);
                  }}
                  disabled={depleted}
                  className={className}
                  title={e.notes || ""}
                >
                  {inner}
                </button>
              );
            }

            // no charges: static card
            return (
              <div
                key={e.id}
                className={className}
                title={e.notes || ""}
              >
                {inner}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="w-full space-y-4">
      <Section title="Actions" rows={grouped.actions} />
      <Section title="Bonus Actions" rows={grouped.bonus_actions} />
      <Section title="Reactions" rows={grouped.reactions} />
    </div>
  );
}
