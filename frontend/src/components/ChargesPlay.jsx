import React, { useEffect, useMemo, useCallback } from "react";
import useCharStore from "../store/CharStore";

/* ---------- Labels ---------- */
function titleFromKey(k) {
  if (!k) return "";
  if (k === "class") return "Class Traits";
  if (k === "feats") return "Feats";
  if (k === "race") return "Racial Traits";
  if (k === "background") return "Background Traits";
  if (k === "others") return "Other Traits";
  const base = k.replace(/_/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/* ---------- Counts helper for any object with charges ---------- */
function useChargeCounter() {
  return useCallback((obj) => {
    const c = obj?.charges;
    const has = !!c?.has;
    if (!has) return { has: false, current: 0, max: 0 };
    const rawMax = Number(c.max_charges);
    const rawCur = Number(c.current_charges);
    const max = Number.isFinite(rawMax) ? Math.max(0, rawMax) : 0;
    let current = Number.isFinite(rawCur) ? Math.max(0, rawCur) : max;
    current = Math.min(current, max);
    return { has: true, current, max };
  }, []);
}

export default function ChargesPlay() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  /* ---------- Traits groups ---------- */
  const traitGroups = useMemo(() => {
    const t = charData.traits || {};
    return Object.entries(t).filter(([, arr]) => Array.isArray(arr));
  }, [charData?.traits]);

  /* ---------- Inventory groups ---------- */
  const magicItems = useMemo(() => charData.inventory?.magic || [], [charData?.inventory]);
  const mundaneItems = useMemo(() => charData.inventory?.mundane || [], [charData?.inventory]);

  const getCounts = useChargeCounter();

  /* ---------- Seed missing current_charges once (traits + magic items) ---------- */
  useEffect(() => {
    let changedTraits = false;
    const nextTraits = Object.fromEntries(
      traitGroups.map(([key, rows]) => {
        const updated = rows.map((tr) => {
          const c = tr.charges;
          if (!c?.has) return tr;
          const max = Number(c.max_charges);
          const cur = Number(c.current_charges);
          const hasMax = Number.isFinite(max) && max >= 0;
          const hasCur = Number.isFinite(cur);
          if (hasMax && !hasCur) {
            changedTraits = true;
            return { ...tr, charges: { ...c, current_charges: max } };
          }
          return tr;
        });
        return [key, updated];
      })
    );

    let changedInv = false;
    const nextMagic = magicItems.map((m) => {
      const c = m?.charges;
      if (!c?.has) return m;
      const max = Number(c.max_charges);
      const cur = Number(c.current_charges);
      const hasMax = Number.isFinite(max) && max >= 0;
      const hasCur = Number.isFinite(cur);
      if (hasMax && !hasCur) {
        changedInv = true;
        return { ...m, charges: { ...c, current_charges: max } };
      }
      return m;
    });

    if (changedTraits) {
      updateCharField("traits", nextTraits);
    }
    if (changedInv) {
      updateCharField("inventory", {
        ...(charData.inventory || {}),
        magic: nextMagic,
        mundane: mundaneItems,
      });
    }
    if (changedTraits || changedInv) postCharData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traitGroups, magicItems, mundaneItems]);

  /* ---------- Spend one charge on a trait ---------- */
  const onUseTrait = useCallback(
    (catKey, traitId) => {
      const src = charData.traits?.[catKey] ?? [];
      const idx = src.findIndex((x) => x.id === traitId);
      if (idx < 0) return;
      const tr = src[idx];
      if (!tr?.charges?.has) return;
      const { current, max } = getCounts(tr);
      if (current <= 0) return;

      const updated = {
        ...tr,
        charges: { ...tr.charges, current_charges: Math.max(0, Math.min(max, current - 1)) },
      };
      const nextTraits = {
        ...charData.traits,
        [catKey]: [...src.slice(0, idx), updated, ...src.slice(idx + 1)],
      };
      updateCharField("traits", nextTraits);
      postCharData();
    },
    [charData?.traits, getCounts, updateCharField, postCharData]
  );

  const onConsumeMundane = useCallback(
  (itemId) => {
    const src = mundaneItems;
    const idx = src.findIndex((x) => x.id === itemId);
    if (idx < 0) return;

    const it = src[idx];
    const amt = Number(it?.amount) || 0;
    if (amt <= 0) return;

    const updated = { ...it, amount: Math.max(0, amt - 1) };
    const nextInv = {
      ...(charData.inventory || {}),
      magic: magicItems,
      mundane: [...src.slice(0, idx), updated, ...src.slice(idx + 1)],
    };
    updateCharField("inventory", nextInv);
    postCharData();
  },
  [mundaneItems, magicItems, charData?.inventory, updateCharField, postCharData]
);

  /* ---------- Spend one charge on a magic item ---------- */
  const onUseMagicItem = useCallback(
    (itemId) => {
      const src = magicItems;
      const idx = src.findIndex((x) => x.id === itemId);
      if (idx < 0) return;
      const it = src[idx];
      if (!it?.charges?.has) return;
      const { current, max } = getCounts(it);
      if (current <= 0) return;

      const updated = {
        ...it,
        charges: { ...it.charges, current_charges: Math.max(0, Math.min(max, current - 1)) },
      };
      const nextInv = {
        ...(charData.inventory || {}),
        magic: [...src.slice(0, idx), updated, ...src.slice(idx + 1)],
        mundane: mundaneItems,
      };
      updateCharField("inventory", nextInv);
      postCharData();
    },
    [magicItems, mundaneItems, charData?.inventory, getCounts, updateCharField, postCharData]
  );

  /* ---------- Sections ---------- */
  const TraitSection = ({ title, rows, catKey }) => {
    const visible = rows.filter((tr) => tr?.charges?.has === true);
    if (visible.length === 0) return null;

    return (
      <section className="space-y-2">
        <h4 className="text-slate-300 text-sm font-semibold">{title}</h4>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
          {visible.map((tr) => {
            const { has, current, max } = getCounts(tr);
            const depleted = has && current <= 0;
            const base = "text-left px-2 py-1 rounded-xl border transition focus:outline-none w-full";
            const ok = "border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100";
            const off = "border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-70";
            return (
              <button
                key={tr.id}
                type="button"
                onClick={() => onUseTrait(catKey, tr.id)}
                disabled={depleted || !has}
                className={`${base} ${depleted || !has ? off : ok}`}
                title={tr.description || ""}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{tr.name || "Unnamed Trait"}</div>
                    {tr.charges?.resetOn ? (
                      <div className="text-[11px] text-slate-400 truncate">
                        Reset: {typeof tr.charges.resetAmount === "string" ? "Full" : tr.charges.resetAmount} on {tr.charges.resetOn}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-slate-400">Charges</div>
                    <div className={`text-sm font-semibold ${depleted ? "text-slate-500" : "text-slate-100"}`}>
                      {current} / {max}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  const MagicSection = ({ items }) => {
    const visible = items.filter((m) => m?.charges?.has === true);
    if (visible.length === 0) return null;

    return (
      <section className="space-y-2">
        <h4 className="text-slate-300 text-sm font-semibold">Magic Items (Charges)</h4>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
          {visible.map((it) => {
            const { has, current, max } = getCounts(it);
            const depleted = has && current <= 0;
            const base = "text-left px-2 py-1 rounded-xl border transition focus:outline-none w-full";
            const ok = "border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100";
            const off = "border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-70";
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => onUseMagicItem(it.id)}
                disabled={depleted || !has}
                className={`${base} ${depleted || !has ? off : ok}`}
                title={it.notes || ""}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{it.name || "Unnamed Item"}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      Amt {it.amount ?? 1}
                      {it.attuned ? " • Attuned" : ""}
                      {it.charges?.resetOn
                        ? ` • Reset: ${typeof it.charges.resetAmount === "string" ? "Full" : it.charges.resetAmount} on ${it.charges.resetOn}`
                        : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-slate-400">Charges</div>
                    <div className={`text-sm font-semibold ${depleted ? "text-slate-500" : "text-slate-100"}`}>
                      {current} / {max}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  const MundaneConsumedSection = ({ items }) => {
  const visible = items.filter((m) => m?.consumed === true);
  if (visible.length === 0) return null;

  return (
    <section className="space-y-2">
      <h4 className="text-slate-300 text-sm font-semibold">Mundane Items (Consumed)</h4>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
        {visible.map((it) => {
          const amount = Number(it.amount) || 0;
          const disabled = amount <= 0;
          const base = "text-left px-2 py-1 rounded-xl border transition focus:outline-none w-full";
          const ok =
            "border-amber-700 bg-amber-900/20 text-amber-100 hover:bg-amber-900/30";
          const off =
            "border-slate-700 bg-slate-800/40 text-slate-500 cursor-not-allowed opacity-70";

          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onConsumeMundane(it.id)}
              disabled={disabled}
              className={`${base} ${disabled ? off : ok}`}
              title={it.notes || ""}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{it.name || "Unnamed Item"}</div>
                  <div className="text-[11px] truncate">
                    {disabled ? "None left" : "Click to consume 1"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-400">Amount</div>
                  <div className={`text-sm font-semibold ${disabled ? "text-slate-500" : "text-amber-100"}`}>
                    {amount}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};


  return (
    <div className="w-full space-y-6">
      {/* Traits with charges */}
      {traitGroups.map(([key, rows]) => (
        <TraitSection key={key} title={titleFromKey(key)} rows={rows} catKey={key} />
      ))}

      {/* Magic items with charges */}
      <MagicSection items={magicItems} />

      {/* Mundane items that are consumed */}
      <MundaneConsumedSection items={mundaneItems} />
    </div>
  );
}
