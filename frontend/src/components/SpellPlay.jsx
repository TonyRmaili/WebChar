import React, { useEffect, useMemo, useCallback } from "react";
import useCharStore from "../store/CharStore";

const clampNum = (v, lo, hi) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(n, hi));
};

export default function SpellPlay() {
  // zustand selectors
  const spellbook = useCharStore((s) => s.charData?.spellbook);
  const updateCharField = useCharStore((s) => s.updateCharField);
  const postCharData = useCharStore((s) => s.postCharData);

  const hasSpellbook = !!spellbook;

  const book = useMemo(() => {
    const raw = spellbook || {};
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
  }, [spellbook]);

  useEffect(() => {
    if (!hasSpellbook) return;

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
    hasSpellbook,
    book.spellslots,
    book.pactslots,
    book.spells,
    book.sorcery_points?.max_charges,
    book.sorcery_points?.current_charges,
  ]);

  const onUseSlot = useCallback(
    (catKey, rowId) => {
      const source = book[catKey];
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
      const next = {
        ...book,
        spells: [...list.slice(0, idx), updated, ...list.slice(idx + 1)],
      };
      updateCharField("spellbook", next);
      postCharData();
    },
    [book, updateCharField, postCharData]
  );

  const onUseSorcery = useCallback(() => {
    const sp = book.sorcery_points;
    const max = clampNum(sp.max_charges, 0, Number(sp.max_charges) || 0);
    const cur = clampNum(sp.current_charges, 0, max);
    if (max <= 0 || cur <= 0) return;

    const next = { ...book, sorcery_points: { ...sp, current_charges: cur - 1 } };
    updateCharField("spellbook", next);
    postCharData();
  }, [book, updateCharField, postCharData]);

  if (!hasSpellbook) return null;

  // card style for each category; break-inside-avoid is key for columns layout
  const sectionCardClass = "break-inside-avoid mb-1 space-y-1";

  const SlotSection = ({ title, catKey, rows }) => {
    if (!rows || rows.length === 0) return null;

    return (
      <section className={sectionCardClass}>
        <h4 className="text-slate-300 text-xs font-semibold">{title}</h4>
        <div className="flex flex-wrap gap-1">
          {rows.map((r, i) => {
            const maxRaw = Number(r.slots_max);
            const max = Number.isFinite(maxRaw) ? Math.max(0, maxRaw) : 0;
            const curRaw = Number(r.slots_current);
            const cur = Number.isFinite(curRaw) ? clampNum(curRaw, 0, max) : max;
            const depleted = cur <= 0 || max <= 0;

            const base =
              "relative flex items-center justify-center rounded-full aspect-square w-12 text-[10px] font-semibold border border-dashed transition focus:outline-none";
            const ok =
              "border-amber-500/80 bg-slate-950 text-amber-200 shadow-md shadow-amber-500/40 hover:bg-slate-900 hover:shadow-lg";
            const off =
              "border-amber-900/70 bg-slate-950 text-amber-800 cursor-not-allowed opacity-60";

            return (
              <button
                key={r.id || `${catKey}-${r.level}-${i}`}
                type="button"
                onClick={() => onUseSlot(catKey, r.id)}
                disabled={depleted}
                className={`${base} ${depleted ? off : ok}`}
                title={`Level ${r.level ?? "-"} slots (${cur}/${max})`}
              >
                <div className="flex flex-col items-center leading-tight">
                  <span className="text-[11px] font-bold">L{r.level ?? "-"}</span>
                  <span className="text-[9px]">
                    {cur}/{max}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  const InnateSection = ({ spells }) => {
    const innateList = spells.filter((s) => {
      if (!s?.innate) return false;
      const max = Number(s?.max_charges);
      return Number.isFinite(max) && max > 0;
    });
    if (innateList.length === 0) return null;

    return (
      <section className={sectionCardClass}>
        <h4 className="text-slate-300 text-xs font-semibold">Innate Spells</h4>
        <div className="space-y-1">
          {innateList.map((s) => {
            const max = Math.max(0, Number(s.max_charges) || 0);
            const cur = clampNum(s.current_charges, 0, max);
            const depleted = cur <= 0;

            const base =
              "w-full text-left px-3 py-2 rounded-xl border border-dashed transition focus:outline-none";
            const ok =
              "border-amber-500/80 bg-slate-950 text-amber-200 shadow-md shadow-amber-500/40 hover:bg-slate-900 hover:shadow-lg";
            const off =
              "border-amber-900/70 bg-slate-950 text-amber-700 cursor-not-allowed opacity-75";

            const comps = s.components || {};
            const hasV = !!comps.v;
            const hasS = !!comps.s;
            const hasM = !!comps.m;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onUseInnate(s.id)}
                disabled={depleted}
                className={`${base} ${depleted ? off : ok}`}
                title={s.notes || ""}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="font-semibold truncate">
                      {s.name || "Innate Spell"}
                    </div>
                    <div className="text-[11px] text-amber-300/80">
                      Lvl {s.level ?? "-"} • {s.school || "—"}
                    </div>

                    <div className="flex flex-wrap items-center gap-1 text-[10px]">
                      {hasV && (
                        <span className="px-1 rounded border border-amber-500/70 text-amber-200">
                          V
                        </span>
                      )}
                      {hasS && (
                        <span className="px-1 rounded border border-amber-500/70 text-amber-200">
                          S
                        </span>
                      )}
                      {hasM && (
                        <span className="px-1 rounded border border-amber-500/70 text-amber-200">
                          M
                        </span>
                      )}
                      {s.concentration && (
                        <span className="px-1 rounded border border-emerald-500/70 text-emerald-300">
                          C
                        </span>
                      )}
                      {s.ritual && (
                        <span className="px-1 rounded border border-sky-500/70 text-sky-300">
                          R
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-amber-300/70">Charges</div>
                    <div className="text-sm font-semibold text-amber-200">
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
  };

  const SorcerySection = ({ sp, metamagic }) => {
    const maxRaw = Number(sp?.max_charges);
    const max = Number.isFinite(maxRaw) ? Math.max(0, maxRaw) : 0;
    if (max <= 0) return null;

    const cur = clampNum(sp?.current_charges, 0, max);
    const depleted = cur <= 0;
    const names = metamagic.map((m) => m?.name).filter(Boolean);

    const base =
      "w-full text-left px-3 py-2 rounded-xl border border-dashed transition focus:outline-none";
    const ok =
      "border-amber-500/80 bg-slate-950 text-amber-200 shadow-md shadow-amber-500/40 hover:bg-slate-900 hover:shadow-lg";
    const off =
      "border-amber-900/70 bg-slate-950 text-amber-700 cursor-not-allowed opacity-75";

    return (
      <section className={sectionCardClass}>
        <h4 className="text-slate-300 text-xs font-semibold">Sorcery Points</h4>
        <button
          type="button"
          onClick={onUseSorcery}
          disabled={depleted}
          className={`${base} ${depleted ? off : ok}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {names.length > 0 && (
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  {names.map((name) => (
                    <div
                      key={name}
                      className="truncate px-1.5 py-0.5 rounded border border-amber-500/70 text-amber-200 bg-slate-950/80"
                    >
                      {name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="text-sm font-semibold text-amber-200">
              {cur} / {max}
            </div>
          </div>
        </button>
      </section>
    );
  };

  // Masonry-like layout using CSS columns.
  // Cards "flow like water" vertically, then into next column.
  return (
    <div className="w-full columns-1 md:columns-2 2xl:columns-3 gap-x-2">
      <SlotSection title="Spellcasting Slots" catKey="spellslots" rows={book.spellslots} />
      <SlotSection title="Pact Magic Slots" catKey="pactslots" rows={book.pactslots} />
      <InnateSection spells={book.spells} />
      <SorcerySection sp={book.sorcery_points} metamagic={book.metamagic} />
    </div>
  );
}
