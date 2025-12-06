import React, { useEffect, useRef, useState, useCallback } from "react";
import useCharStore from "../../store/CharStore";
import useMonsterStore from "../../store/MonsterStore";
import { toInt2 } from "../../utils/HelperFunctions";
import { DEFAULT_MINION_DATA, CATEGORY_KEYS } from "../../utils/Constants";
import { MinionRow } from "./MinionRow";
import { buttonStyle, inputTextStyle, selectStyle } from "./MinionStyle";
import Select from "react-select";

function collectChargedEffectsFromMinion(minion) {
  const out = [];
  const effects = minion.effects || {};

  const take = (arr) => {
    (arr || []).forEach((e) => {
      if (e?.charges?.has) {
        const max = toInt2(e.charges.max_charges);
        if (max <= 0) return;

        const baseCur = toInt2(e.charges.current_charges);
        const cur = Number.isFinite(baseCur) && baseCur >= 0 ? baseCur : max;

        out.push({
          effect_id: e.id,
          name: e.name,
          max,
          current: cur,
        });
      }
    });
  };

  CATEGORY_KEYS.forEach((key) => take(effects[key]));
  return out;
}

function syncUnitChargesForMinion(minion) {
  const chargedEffects = collectChargedEffectsFromMinion(minion);

  // No charged effects: clear per-unit charged_effects
  if (!chargedEffects.length) {
    if (!Array.isArray(minion.units)) return minion.units;
    return minion.units.map((u) =>
      u.charged_effects ? { ...u, charged_effects: [] } : u
    );
  }

  const metaMap = new Map(
    chargedEffects.map((ce) => [ce.effect_id, ce]) // id -> meta
  );

  if (!Array.isArray(minion.units)) return minion.units;

  return minion.units.map((u) => {
    const existing = Array.isArray(u.charged_effects)
      ? [...u.charged_effects]
      : [];

    // Keep only entries whose effect still exists; update name/max and clamp current
    const filtered = existing
      .map((ce) => {
        const meta = metaMap.get(ce.effect_id);
        if (!meta) return null; // effect was deleted or lost charges

        const prevCur = toInt2(ce.current_charges);
        const current_charges =
          Number.isFinite(prevCur) && prevCur >= 0
            ? Math.min(prevCur, meta.max)
            : meta.current;

        return {
          effect_id: meta.effect_id,
          name: meta.name,
          max_charges: meta.max,
          current_charges,
        };
      })
      .filter(Boolean);

    const existingIds = new Set(filtered.map((ce) => ce.effect_id));

    // Add missing entries for any remaining charged effects
    const additions = [];
    for (const meta of chargedEffects) {
      if (!existingIds.has(meta.effect_id)) {
        additions.push({
          effect_id: meta.effect_id,
          name: meta.name,
          max_charges: meta.max,
          current_charges: meta.current,
        });
      }
    }

    return {
      ...u,
      charged_effects: [...filtered, ...additions],
    };
  });
}

export default function MinionsDefine() {
  const charData = useCharStore((s) => s.charData);

  const fetchMinions = useMonsterStore((s) => s.fetchMinions);
  const fetchAllMonsterNames = useMonsterStore((s) => s.fetchAllMonsterNames);
  const importMinion = useMonsterStore((s) => s.importMinion);
  const createMinion = useMonsterStore((s) => s.createMinion);
  const updateMinion = useMonsterStore((s) => s.updateMinion);
  const deleteMinion = useMonsterStore((s) => s.deleteMinion);

  const minionsData = useMonsterStore((s) => s.minionsData);
  const loading = useMonsterStore((s) => s.loading);
  const error = useMonsterStore((s) => s.error);
  const [importing, setImporting] = useState(false);

  const [selectedMinion, setSelectedMinion] = useState({})

  const [monsterNames, setMonsterNames] = useState([]);
  const options = monsterNames.map((obj) => {
    const [name] = Object.keys(obj);      
    return {
      label: name,                       
      value: obj,                         
    };
  });


  // local drafts for smooth typing (optimistic UI)
  const [drafts, setDrafts] = useState([]);
  useEffect(() => setDrafts(minionsData || []), [minionsData]);

  // collapse state
  const [openIndices, setOpenIndices] = useState({});
  const toggleOpen = useCallback(
    (idx) => setOpenIndices((p) => ({ ...p, [idx]: !p[idx] })),
    []
  );

  // create form
  const [newName, setNewName] = useState("");

  // load on character change
  useEffect(() => {
    if (charData?.name) fetchMinions(charData.name);
  }, [charData?.name, fetchMinions]);

  // shared debounce per (index:field)
  const timersRef = useRef({});
  const debouncedSave = useCallback(
    (index, fullMinion) => {
      const key = String(index);
      clearTimeout(timersRef.current[key]);
      timersRef.current[key] = setTimeout(async () => {
        if (!charData?.name) return;
        await updateMinion(fullMinion, charData.name);
        await fetchMinions(charData.name); // sync back from server
        delete timersRef.current[key];
      }, 400);
    },
    [updateMinion, fetchMinions, charData?.name]
  );

  const handleFieldChange = (index, field, value) => {
    setDrafts((prev) => {
      const next = [...prev];

      // start from the existing minion + defaults
      const base = { ...DEFAULT_MINION_DATA, ...(next[index] || {}) };

      // apply the raw field change first
      const rawNext = { ...base, [field]: value };

      // normalize amount / max_hp as non-negative integers
      const prevMaxHp = Math.max(0, toInt2(base.max_hp));
      const maxHp = Math.max(0, toInt2(rawNext.max_hp));
      const amount = Math.max(0, toInt2(rawNext.amount));

      // work with units instead of current_hps
      let units = Array.isArray(rawNext.units) ? [...rawNext.units] : [];

      // --- handle max_hp change ---
      if (maxHp !== prevMaxHp) {
        const allAtPrev =
          units.length > 0 && units.every((u) => u.current_hp === prevMaxHp);

        if (allAtPrev) {
          // fresh / undamaged: resync all to new max_hp
          units = units.map((u) => ({
            ...u,
            current_hp: maxHp,
          }));
        } else {
          // damaged: only clamp values that exceed new max_hp
          units = units.map((u) => ({
            ...u,
            current_hp: u.current_hp > maxHp ? maxHp : u.current_hp,
          }));
        }
      }

      // helper to create a new unit with default selected=false
      const makeUnit = (slotIndex) => ({
        id: `u-${index}-${slotIndex}`,
        current_hp: maxHp,
        selected: false,
        // charged_effects will be filled by syncUnitChargesForMinion
      });

      // --- handle amount change: length of units === amount ---
      if (units.length < amount) {
        const toAdd = amount - units.length;
        for (let i = 0; i < toAdd; i++) {
          const slotIndex = units.length + i;
          units.push(makeUnit(slotIndex)); // new instances start at full HP
        }
      } else if (units.length > amount) {
        units = units.slice(0, amount); // removing minions chops from the end
      }

      // Build the intermediate minion
      let updated = {
        ...rawNext,
        amount,
        max_hp: maxHp,
        units,
      };

      // Always sync per-unit charged_effects against current effects
      updated = {
        ...updated,
        units: syncUnitChargesForMinion(updated),
      };

      next[index] = updated;

      // debounce save with full object
      debouncedSave(index, updated);
      return next;
    });
  };

  useEffect(() => {
    async function onSelectMinion() {
      try {
        const data = await fetchAllMonsterNames();
        setMonsterNames(data);
      } catch (err) {
        console.error("Failed to load options", err);
      }
    }
    onSelectMinion();
  }, []);

  async function onImportMinion() {
    setImporting(true);
    try {
      await importMinion(selectedMinion, charData.name);

      // Refresh names only if import succeeded
      const data = await fetchAllMonsterNames();
      setMonsterNames(data);
    } catch (err) {
      console.error("Import or refresh failed:", err);
      // optionally show toast / set error state
    } finally {
      setImporting(false);
    }
}
  


  const onCreateMinion = async () => {
    const name = newName.trim();
    if (!name || !charData?.name) return;
    const payload = { ...DEFAULT_MINION_DATA, name };
    const created = await createMinion(payload, charData.name);
    if (created) {
      setNewName("");
      await fetchMinions(charData.name);
    }
  };

  const onDeleteMinion = async (index) => {
    const m = drafts[index];
    if (!m || !charData?.name) return;

    const res = await deleteMinion(m, charData.name);
    if (res !== null) {
      await fetchMinions(charData.name);
    }
  };

  return (
    <div className="p-4">
      {/* Create row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          className={`${inputTextStyle} flex-1`}
          placeholder="Minion name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          onClick={onCreateMinion}
          className={buttonStyle}
          disabled={!newName.trim()}
        >
          Create Minion
        </button>

        <Select
          options={options}
          isSearchable={true}
          placeholder="Select monster..."
          onChange={(opt) => setSelectedMinion(opt.value)}
          className="w-56 text-black border rounded-xl text-sm"
          styles={selectStyle}
        />

        <button
          onClick={onImportMinion}
          className={buttonStyle}
          disabled={importing}
          >
           {importing ? "Importing..." : "Import Minion"}
        </button>
      </div>


      <div className="mt-4">
        {error && <p className="text-red-400 text-xs">Error: {error}</p>}
        {!loading && !error && (!drafts || drafts.length === 0) && (
          <p className="text-slate-500 text-xs">No minions yet.</p>
        )}

        {drafts?.map((m, i) => (
          <MinionRow
            key={m.id || m._file || i}
            index={i}
            minion={m}
            isOpen={!!openIndices[i]}
            onToggle={() => toggleOpen(i)}
            onFieldChange={handleFieldChange}
            onDelete={() => onDeleteMinion(i)}
          />
        ))}
      </div>
    </div>
  );
}
