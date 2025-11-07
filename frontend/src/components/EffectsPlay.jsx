import React, { useEffect, useMemo, useCallback } from "react";
import useCharStore from "../store/CharStore";

export default function EffectsPlay() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  // Expect the new shape already
  const groups = useMemo(
    () => ({
      actions: charData.effects?.actions || [],
      bonus_actions: charData.effects?.bonus_actions || [],
      reactions: charData.effects?.reactions || [],
    }),
    [charData?.effects]
  );

  // Seed missing current_charges from max_charges once
  useEffect(() => {
    const categories = ["actions", "bonus_actions", "reactions"];
    let changed = false;

    const nextActions = {
      actions: [...groups.actions],
      bonus_actions: [...groups.bonus_actions],
      reactions: [...groups.reactions],
    };

    for (const cat of categories) {
      nextActions[cat] = nextActions[cat].map((a) => {
        const c = a?.charges;
        if (!c?.has) return a;

        const max = Number(c.max_charges);
        const hasMax = Number.isFinite(max) && max >= 0;
        const cur = c.current_charges;
        const hasCur = Number.isFinite(Number(cur));

        // If we have a valid max but current is missing/invalid -> seed from max
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
    }

    if (changed) {
      updateCharField("effects", nextActions);
      postCharData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.actions, groups.bonus_actions, groups.reactions]);

  // Helpers
  const getCounts = useCallback((a) => {
    const has = !!a?.charges?.has;
    if (!has) return { has: false, current: 0, max: 0 };

    const rawMax = Number(a.charges?.max_charges);
    const rawCur = Number(a.charges?.current_charges);

    const max = Number.isFinite(rawMax) ? Math.max(0, rawMax) : 0;
    let current = Number.isFinite(rawCur) ? Math.max(0, rawCur) : max;
    current = Math.min(current, max);

    return { has: true, current, max };
  }, []);

  // Decrement handler: updates nested action in-place (immutably) and persists
  const onUse = useCallback(
    (catKey, actionId) => {
      const source = groups[catKey] || [];
      const idx = source.findIndex((x) => x.id === actionId);
      if (idx < 0) return;

      const a = source[idx];
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

      const next = {
        actions: groups.actions,
        bonus_actions: groups.bonus_actions,
        reactions: groups.reactions,
        [catKey]: [
          ...source.slice(0, idx),
          updated,
          ...source.slice(idx + 1),
        ],
      };

      updateCharField("effects", next);
      postCharData();
    },
    [groups, getCounts, updateCharField, postCharData]
  );

  const Section = ({ title, rows, catKey }) => (
    <section className="space-y-2">
      <h4 className="text-slate-300 text-sm font-semibold">{title}</h4>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
        {rows.map((a) => {
          const { has, current, max } = getCounts(a);
          const depleted = has && current <= 0;
          const base = "text-left px-2 py-1 rounded-xl border transition focus:outline-none w-full";
          const ok = "border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100";
          const off = "border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-70";

          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onUse(catKey, a.id)}
              disabled={depleted || !has} // disable if no charges or depleted
              className={`${base} ${depleted || !has ? off : ok}`}
              title={a.description || ""}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{a.name || "Unnamed Action"}</div>
                  {a.hit_bonus !== "" && a.hit_bonus != null ? (
                    <div className="text-xs text-slate-400">
                      {a.hit_bonus >= 0 ? `+${a.hit_bonus}` : a.hit_bonus} to hit
                    </div>
                  ) : null}
                </div>
                {has && (
                  <div className="text-right shrink-0">
                    <div className="text-xs text-slate-400">Charges</div>
                    <div className={`text-sm font-semibold ${depleted ? "text-slate-500" : "text-slate-100"}`}>
                      {current} / {max}
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="w-full space-y-4">
      <Section title="Actions"        rows={groups.actions}        catKey="actions" />
      <Section title="Bonus Actions"  rows={groups.bonus_actions}  catKey="bonus_actions" />
      <Section title="Reactions"      rows={groups.reactions}      catKey="reactions" />
    </div>
  );
}
