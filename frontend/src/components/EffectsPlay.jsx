import React, { useEffect, useMemo, useCallback } from "react";
import useCharStore from "../store/CharStore";

const ACTION_TYPE_LABELS = {
  action: "Action",
  bonus_action: "Bonus Action",
  reaction: "Reaction",
};

const toIntOrNull = (v) => {
  if (v === "" || v == null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

/* --- summarizers, aligned with your edit UI --- */

const summarizeDamage = (row) => {
  const list = (row.damages || [])
    .map((d) => {
      const dicePart =
        d.dice_count && d.dice_size
          ? `${d.dice_count}${d.dice_size}`
          : d.dice_size || "";

      const modNum = Number(d.mod);
      const hasMod = Number.isFinite(modNum) && modNum !== 0;
      const modPart = hasMod
        ? `${modNum > 0 ? "+" : ""}${modNum}`
        : "";

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
    // Capitalize first
    parts.push(type.charAt(0).toUpperCase() + type.slice(1));
  }
  if (range) parts.push(`${range} ft`);

  return parts.join(" • ");
};

const summarizeSave = (row) => {
  const ability = row.save?.ability;
  const dcBonus = row.save?.dc_bonus;

  const n = Number(dcBonus);
  const hasBonus = Number.isFinite(n) && n !== 0;

  if (!ability && !hasBonus) return "";

  if (ability && hasBonus) {
    const bonusStr = n > 0 ? `+${n}` : `${n}`;
    return `${ability} save DC ${bonusStr}`;
  }
  if (ability) return `${ability} save`;
  // no ability, only bonus
  const bonusStr = n > 0 ? `+${n}` : `${n}`;
  return `Save DC ${bonusStr}`;
};

export default function EffectsPlay() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  const effects = useMemo(() => {
    const src = charData.effects;
    return Array.isArray(src) ? src : [];
  }, [charData?.effects]);

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
        <h4 className="text-slate-300 text-sm font-semibold">{title}</h4>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
          {rows.map((e) => {
            const { has, current, max } = getCounts(e);
            const depleted = has && current <= 0;

            const dmg = summarizeDamage(e);
            const atk = summarizeAttack(e);
            const save = summarizeSave(e);

            const actionTypeLabel =
              ACTION_TYPE_LABELS[e.action_type || "action"] || "Action";

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
                    <div className="font-semibold text-sm truncate">
                      {e.name || "Unnamed effect"}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[10px] text-slate-400">
                      <span className="px-1.5 py-0.5 rounded-full border border-slate-600 bg-slate-950/60">
                        {actionTypeLabel}
                      </span>
                      {atk && (
                        <span className="px-1.5 py-0.5 rounded-full border border-slate-700 bg-slate-900/60">
                          {atk}
                        </span>
                      )}
                      {save && (
                        <span className="px-1.5 py-0.5 rounded-full border border-slate-700 bg-slate-900/60">
                          {save}
                        </span>
                      )}
                    </div>
                  </div>

                  {has && (
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400">
                        Charges
                      </div>
                      <div
                        className={`text-sm font-semibold ${
                          depleted ? "text-slate-500" : "text-slate-100"
                        }`}
                      >
                        {current} / {max}
                      </div>
                    </div>
                  )}
                </div>

                {/* Damage line */}
                {dmg && (
                  <div className="text-[11px] text-slate-200">
                    {dmg}
                  </div>
                )}

                {/* Notes hint */}
                {e.notes && (
                  <div className="text-[10px] text-slate-500 line-clamp-2">
                    {e.notes}
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
