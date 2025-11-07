import React, { useEffect, useMemo, useCallback } from "react";
import useCharStore from "../store/CharStore";

const clampNum = (v, lo, hi) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(n, hi));
};

export default function SpellPlay() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  // Strict new model
  const book = useMemo(() => {
    const raw = charData.spellbook || {};
    return {
      spellslots: Array.isArray(raw.spellslots) ? raw.spellslots : [],
      pactslots: Array.isArray(raw.pactslots) ? raw.pactslots : [],
      spells: Array.isArray(raw.spells) ? raw.spells : [],
      metamagic: Array.isArray(raw.metamagic) ? raw.metamagic : [],
      sorcery_points: raw.sorcery_points ?? {
        max_charges: "",
        current_charges: "",
        recharge_short_amount: 0,
      },
    };
  }, [charData?.spellbook]);

  // Seed currents from max if missing
  useEffect(() => {
    let changed = false;

    const fixSlots = (arr) =>
      arr.map((row) => {
        const max = Number(row?.slots_max);
        const cur = Number(row?.slots_current);
        const hasMax = Number.isFinite(max) && max >= 0;
        const hasCur = Number.isFinite(cur) && cur >= 0;
        if (hasMax && !hasCur) {
          changed = true;
          return { ...row, slots_current: max };
        }
        return row;
      });

    const fixInnate = (arr) =>
      arr.map((s) => {
        if (!s?.innate) return s;
        const max = Number(s?.max_charges);
        const cur = Number(s?.current_charges);
        const hasMax = Number.isFinite(max) && max >= 0;
        const hasCur = Number.isFinite(cur) && cur >= 0;
        if (hasMax && !hasCur) {
          changed = true;
          return { ...s, current_charges: max };
        }
        return s;
      });

    const next = {
      ...book,
      spellslots: fixSlots(book.spellslots),
      pactslots: fixSlots(book.pactslots),
      spells: fixInnate(book.spells),
      sorcery_points: (() => {
        const max = Number(book.sorcery_points?.max_charges);
        const cur = Number(book.sorcery_points?.current_charges);
        const hasMax = Number.isFinite(max) && max >= 0;
        const hasCur = Number.isFinite(cur) && cur >= 0;
        if (hasMax && !hasCur) {
          changed = true;
          return { ...book.sorcery_points, current_charges: max };
        }
        return book.sorcery_points;
      })(),
    };

    if (changed) {
      updateCharField("spellbook", next);
      postCharData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    book.spellslots,
    book.pactslots,
    book.spells,
    book.sorcery_points?.max_charges,
    book.sorcery_points?.current_charges,
  ]);

  // Use a slot row by id
  const onUseSlot = useCallback(
    (catKey, rowId) => {
      const source = book[catKey]; // array
      const idx = source.findIndex((r) => (r.id || "") === rowId);
      if (idx < 0) return;

      const row = source[idx];
      const max = clampNum(row.slots_max, 0, Number(row.slots_max) || 0);
      const cur = clampNum(row.slots_current, 0, max);
      if (cur <= 0) return;

      const updated = { ...row, slots_current: cur - 1 };
      const next = {
        ...book,
        [catKey]: [...source.slice(0, idx), updated, ...source.slice(idx + 1)],
      };
      updateCharField("spellbook", next);
      postCharData();
    },
    [book, updateCharField, postCharData]
  );

  // Spend innate charge
  const onUseInnate = useCallback(
    (spellId) => {
      const list = book.spells;
      const idx = list.findIndex((s) => (s.id || "") === spellId);
      if (idx < 0) return;

      const s = list[idx];
      if (!s?.innate) return;

      const max = clampNum(s.max_charges, 0, Number(s.max_charges) || 0);
      const cur = clampNum(s.current_charges, 0, max);
      if (cur <= 0) return;

      const updated = { ...s, current_charges: cur - 1 };
      const next = { ...book, spells: [...list.slice(0, idx), updated, ...list.slice(idx + 1)] };
      updateCharField("spellbook", next);
      postCharData();
    },
    [book, updateCharField, postCharData]
  );

  // Spend sorcery point
  const onUseSorcery = useCallback(() => {
    const sp = book.sorcery_points;
    const max = clampNum(sp.max_charges, 0, Number(sp.max_charges) || 0);
    const cur = clampNum(sp.current_charges, 0, max);
    if (max <= 0 || cur <= 0) return;

    const next = { ...book, sorcery_points: { ...sp, current_charges: cur - 1 } };
    updateCharField("spellbook", next);
    postCharData();
  }, [book, updateCharField, postCharData]);

  // UI
  const SlotSection = ({ title, catKey, rows }) => (
    <section className="space-y-2">
      <h4 className="text-slate-300 text-sm font-semibold">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((r, i) => {
          const max = Number.isFinite(Number(r.slots_max)) ? Math.max(0, Number(r.slots_max)) : 0;
          const curRaw = Number(r.slots_current);
          const cur = Number.isFinite(curRaw) ? clampNum(curRaw, 0, max) : max;
          const depleted = cur <= 0 || max <= 0;
          const base = "w-full text-left px-3 py-3 rounded-xl border transition focus:outline-none";
          const ok = "border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100";
          const off = "border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-70";

          return (
            <button
              key={r.id || `${catKey}-${r.level}-${i}`}
              type="button"
              onClick={() => onUseSlot(catKey, r.id)}
              disabled={depleted}
              className={`${base} ${depleted ? off : ok}`}
              title={`Level ${r.level ?? "-"} slots`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">Lvl {r.level ?? "-"}</div>
                  <div className="text-xs text-slate-400">Spell Slots</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-400">Remaining</div>
                  <div className={`text-sm font-semibold ${depleted ? "text-slate-500" : "text-slate-100"}`}>
                    {cur} / {max}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );

  const InnateSection = ({ spells }) => {
    const usable = spells.filter((s) => {
      if (!s?.innate) return false;
      const max = Number(s?.max_charges);
      const cur = Number(s?.current_charges);
      if (!Number.isFinite(max) || max <= 0) return false;
      if (!Number.isFinite(cur) || cur <= 0) return false;
      return true;
    });
    if (usable.length === 0) return null;

    return (
      <section className="space-y-2">
        <h4 className="text-slate-300 text-sm font-semibold">Innate Spells</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {usable.map((s) => {
            const max = Math.max(0, Number(s.max_charges) || 0);
            const cur = clampNum(s.current_charges, 0, max);
            const base = "w-full text-left px-3 py-3 rounded-xl border transition focus:outline-none";
            const ok = "border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100";
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onUseInnate(s.id)}
                className={`${base} ${ok}`}
                title={s.notes || ""}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{s.name || "Innate Spell"}</div>
                    <div className="text-xs text-slate-400">Lvl {s.level ?? "-"} • {s.school || "—"}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-slate-400">Charges</div>
                    <div className="text-sm font-semibold text-slate-100">{cur} / {max}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  const SorcerySection = ({ sp, metamagic }) => {
    const max = Number.isFinite(Number(sp?.max_charges)) ? Math.max(0, Number(sp.max_charges)) : 0;
    if (max <= 0) return null;
    const cur = clampNum(sp?.current_charges, 0, max);
    const depleted = cur <= 0;
    const names = metamagic.map((m) => m?.name).filter(Boolean);
    const base = "w-full text-left px-3 py-3 rounded-xl border transition focus:outline-none";
    const ok = "border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100";
    const off = "border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed opacity-70";
    return (
      <section className="space-y-2">
        <h4 className="text-slate-300 text-sm font-semibold">Sorcery Points</h4>
        <button
          type="button"
          onClick={onUseSorcery}
          disabled={depleted}
          className={`${base} ${depleted ? off : ok}`}
          title="Spend 1 sorcery point"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold truncate">Spend Sorcery Point</div>
              <div className="text-xs text-slate-400">
                Short-rest recharge: +{Number(book.sorcery_points?.recharge_short_amount || 0)}
              </div>
              {names.length > 0 && (
                <div className="mt-1 text-xs text-slate-300">Metamagic: {names.join(", ")}</div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-slate-400">Remaining</div>
              <div className={`text-sm font-semibold ${depleted ? "text-slate-500" : "text-slate-100"}`}>
                {cur} / {max}
              </div>
            </div>
          </div>
        </button>
      </section>
    );
  };

  return (
    <div className="w-full space-y-6">
      <SlotSection title="Spellcasting Slots" catKey="spellslots" rows={book.spellslots} />
      <SlotSection title="Pact Magic Slots" catKey="pactslots" rows={book.pactslots} />
      <InnateSection spells={book.spells} />
      <SorcerySection sp={book.sorcery_points} metamagic={book.metamagic} />
    </div>
  );
}
