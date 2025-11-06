import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import useCharStore from "../store/CharStore";
import { useDnDStore } from "../store/DndStore";
import { SlotsOnlyCard, SpellsCard, MetamagicCard, InvocationsCard, SorceryPointsCard, normalizeSpellRow } from "../utils/spellUtils";

/* ---------- Helpers ---------- */
const idGen = () =>
  (globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

/* ---------- Defaults (fresh schema) ---------- */
const DEFAULT_SPELLBOOK = {
  spellslots: [],          
  pactslots: [],           
  spells: [],
  metamagic: [],
  invocations: [],
  sorcery_points: { max_charges: "", current_charges: "", recharge_short_amount: 0 },
};

export default function Spellbook() {
  const { charData, updateCharField, postCharData } = useCharStore();
  if (!charData) return null;

  const {
    files, loadingFiles, selectedFile,
    spellNames, loadingSpellNames, selectedSpell,
    loadFiles, onSelectFile, onSelectSpell, spellData
  } = useDnDStore();

  useEffect(() => { loadFiles(); }, [loadFiles]);

  /* ---------- Fresh book (no migrations) ---------- */
  const book = useMemo(() => {
    const raw = charData.spellbook ?? {};
    const base = { ...DEFAULT_SPELLBOOK, ...raw };

    const normalizeSlots = (arr) =>
      (Array.isArray(arr) ? arr : []).map((r) => ({
        id: r.id ?? idGen(),
        level: r.level ?? "",
        slots_max: r.slots_max ?? "",
        slots_current: r.slots_current ?? r.slots_max ?? "",
      }));

    return {
      ...base,
      spellslots: normalizeSlots(base.spellslots),
      pactslots: normalizeSlots(base.pactslots),
      spells: (base.spells ?? []).map(normalizeSpellRow),
      metamagic: (base.metamagic ?? []).map((m) => ({
        id: m.id ?? idGen(),
        name: m.name ?? "",
        description: m.description ?? "",
      })),

      invocations: (base.invocations ?? []).map((m) => ({
        id: m.id ?? idGen(),
        name: m.name ?? "",
        description: m.description ?? "",
      })),

      sorcery_points: {
        max_charges: base.sorcery_points?.max_charges ?? "",
        current_charges: base.sorcery_points?.current_charges ?? (base.sorcery_points?.max_charges ?? ""),
        recharge_short_amount: Number(base.sorcery_points?.recharge_short_amount ?? 0) || 0,
      },
    };
  }, [charData?.spellbook]);

  /* ---------- UI state ---------- */
  const [openById, setOpenById] = useState({});
  const toggleOpen = useCallback((id) => {
    setOpenById((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  /* ---------- Debounced persist ---------- */
  const debounceRef = useRef(null);
  const debouncedPost = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => postCharData(), 400);
  }, [postCharData]);

  const persist = useCallback(
    (next, { immediate = false } = {}) => {
      updateCharField("spellbook", next);
      if (immediate) postCharData();
      else debouncedPost();
    },
    [updateCharField, postCharData, debouncedPost]
  );

  /* ---------- Slots (flat arrays) ---------- */
  const addSlot = useCallback(
    (categoryKey /* 'spellslots' | 'pactslots' */) => {
      const row = { id: idGen(), level: "", slots_max: "", slots_current: "" };
      const next = { ...book, [categoryKey]: [...(book[categoryKey] ?? []), row] };
      persist(next, { immediate: true });
    },
    [book, persist]
  );

  const removeSlotRow = useCallback(
    (categoryKey, id) => {
      const next = { ...book, [categoryKey]: (book[categoryKey] ?? []).filter((r) => r.id !== id) };
      persist(next, { immediate: true });
    },
    [book, persist]
  );

  const changeSlotField = useCallback(
    (categoryKey, id, patch) => {
      const next = {
        ...book,
        [categoryKey]: (book[categoryKey] ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
      };
      persist(next);
    },
    [book, persist]
  );

  /* ---------- Spells ---------- */
  const addSpell = useCallback(() => {
    const row = normalizeSpellRow({
      name: "",
      level: "",
      school: "",
      notes: "",
      prepared: false,
      innate: false,
    });
    const next = { ...book, spells: [...(book.spells ?? []), row] };
    persist(next, { immediate: true });
    setOpenById((prev) => ({ ...prev, [row.id]: true }));
  }, [book, persist]);

  const removeSpell = useCallback((id) => {
    const next = { ...book, spells: (book.spells ?? []).filter((r) => r.id !== id) };
    persist(next, { immediate: true });
    setOpenById((prev) => {
      const copy = { ...prev }; delete copy[id]; return copy;
    });
  }, [book, persist]);

  const changeSpellField = useCallback((id, patch) => {
    const next = {
      ...book,
      spells: (book.spells ?? []).map((r) => (r.id === id ? normalizeSpellRow({ ...r, ...patch }) : r)),
    };
    persist(next);
  }, [book, persist]);

  /* ---------- Metamagic ---------- */
  const addMetamagic = useCallback(() => {
    const row = { id: idGen(), name: "", description: "" };
    const next = { ...book, metamagic: [...(book.metamagic ?? []), row] };
    persist(next, { immediate: true });
  }, [book, persist]);

  const removeMetamagic = useCallback((id) => {
    const next = { ...book, metamagic: (book.metamagic ?? []).filter((m) => m.id !== id) };
    persist(next, { immediate: true });
  }, [book, persist]);

  const changeMetamagic = useCallback((id, patch) => {
    const next = {
      ...book,
      metamagic: (book.metamagic ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)),
    };
    persist(next);
  }, [book, persist]);

  /* ---------- Invocations ---------- */
  const addInvocations = useCallback(() => {
    const row = { id: idGen(), name: "", description: "" };
    const next = { ...book, invocations: [...(book.invocations ?? []), row] };
    persist(next, { immediate: true });
  }, [book, persist]);

  const removeInvocations = useCallback((id) => {
    const next = { ...book, invocations: (book.invocations ?? []).filter((m) => m.id !== id) };
    persist(next, { immediate: true });
  }, [book, persist]);

  const changeInvocations = useCallback((id, patch) => {
    const next = {
      ...book,
      invocations: (book.invocations ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m)),
    };
    persist(next);
  }, [book, persist]);

  /* ---------- Sorcery Points ---------- */
  const changeSorcery = useCallback((patch) => {
    const next = { ...book, sorcery_points: { ...book.sorcery_points, ...patch } };
    persist(next);
  }, [book, persist]);

  /* ---------- Import spell ---------- */
  const onImport = useCallback(() => {
    const s = spellData;
    if (!s || Object.keys(s).length === 0) return;

    const row = normalizeSpellRow({
      name: s.name ?? "",
      level: Number.isFinite(+s.level) ? +s.level : s.level ?? "",
      school: s.school ?? "",
      notes: Array.isArray(s.desc) ? s.desc.join("\n") : (s.desc ?? ""),
      concentration: !!s.concentration,
      ritual: !!s.ritual,
      range_ft: Number.isFinite(+s.range) ? +s.range : s.range ?? "",
      components: {
        v: !!(s.components?.v ?? s.components?.includes?.("V")),
        s: !!(s.components?.s ?? s.components?.includes?.("S")),
        m: !!(s.components?.m ?? s.components?.includes?.("M") ?? s.material),
        material_desc: s.material ?? s.components?.material_desc ?? "",
        material_cost: s.material_cost ?? s.components?.material_cost ?? "",
      },
      cast_time_kind: "choice",
      cast_time_choice:
        /bonus/i.test(s.casting_time || "") ? "bonus" :
        /reaction/i.test(s.casting_time || "") ? "reaction" : "action",
    });

    const next = { ...book, spells: [...(book.spells ?? []), row] };
    persist(next, { immediate: true });
    setOpenById((p) => ({ ...p, [row.id]: true }));
  }, [book, persist, spellData]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* pass arrays directly now */}
      <SlotsOnlyCard
        title="Spellcasting"
        categoryKey="spellslots"
        model={book.spellslots}
        onAddSlot={addSlot}
        onRemoveRow={removeSlotRow}
        onChangeSlot={changeSlotField}
      />

      <SlotsOnlyCard
        title="Pact Magic"
        categoryKey="pactslots"
        model={book.pactslots}
        onAddSlot={addSlot}
        onRemoveRow={removeSlotRow}
        onChangeSlot={changeSlotField}
      />

      <SpellsCard
        list={book.spells ?? []}
        openById={openById}
        onToggleOpen={toggleOpen}
        onAdd={addSpell}
        onImport={onImport}
        onChange={changeSpellField}
        onRemove={removeSpell}
        files={files}
        loadingFiles={loadingFiles}
        selectedFile={selectedFile}
        onSelectFile={onSelectFile}
        spellNames={spellNames}
        loadingSpellNames={loadingSpellNames}
        selectedSpell={selectedSpell}
        onSelectSpell={onSelectSpell}
      />

      <MetamagicCard
        list={book.metamagic ?? []}
        onAdd={addMetamagic}
        onRemove={removeMetamagic}
        onChange={changeMetamagic}
      />

      <InvocationsCard
        list={book.invocations ?? []}
        onAdd={addInvocations}
        onRemove={removeInvocations}
        onChange={changeInvocations}
      />

      <SorceryPointsCard
        model={book.sorcery_points}
        onChange={changeSorcery}
      />
    </div>
  );
}
