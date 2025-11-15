import React, { useEffect, useMemo, useState } from "react";
import useCharStore from "../store/CharStore";
import CreatableSelect from "react-select/creatable";

function Biography() {
  const { charData, updateCharField, postCharData } = useCharStore();

  // Guard
  if (!charData) return null;

  // ----- Remote race data (options) -----
  const [error, setError] = useState(null);
  const [raceOptions, setRaceOptions] = useState(null); // [{value,label}]
  const [subraceRaw, setSubraceRaw] = useState(null);   // [{ value: raceName, label: subraceName }]

  // useEffect(() => {
  //   let cancelled = false;
  //   (async () => {
  //     try {
  //       const res = await fetch("http://localhost:8000/races");
  //       if (!res.ok) throw new Error("Failed to load races");
  //       const data = await res.json();

  //       // data[0] = races[] with .name; data[1] = subraces[] with .raceName + .name
  //       const races0 = Array.isArray(data) && data[0] ? data[0] : [];
  //       const subs1  = Array.isArray(data) && data[1] ? data[1] : [];

  //       // Clean races: remove parentheses and dedupe by name
  //       const unique = new Set();
  //       const cleanedRaces = races0
  //         .map(r => (r?.name ?? "").replace(/\s*\([^)]*\)/g, ""))
  //         .filter(n => {
  //           if (!n) return false;
  //           if (unique.has(n)) return false;
  //           unique.add(n);
  //           return true;
  //         })
  //         .map(n => ({ value: n, label: n }));

  //       // Clean subraces: keep { value: raceName, label: subraceName }
  //       const cleanedSubs = subs1.map(s => ({
  //         value: s?.raceName ?? "",
  //         label: s?.name ?? "",
  //       }));

  //       if (!cancelled) {
  //         setRaceOptions(cleanedRaces);
  //         setSubraceRaw(cleanedSubs);
  //       }
  //     } catch (e) {
  //       if (!cancelled) setError(e.message || "Error loading races");
  //     }
  //   })();
  //   return () => { cancelled = true; };
  // }, []);

  // ----- Selected values come from charData -----
  const selectedRace   = charData?.race ?? "";
  const selectedSubrace = charData?.subrace ?? "";
  const languages = Array.isArray(charData?.languages) ? charData.languages : [];
  const background = charData?.background ?? "";
  const backstory  = charData?.backstory ?? "";

  // Subrace options filtered by chosen race
  const subraceOptions = useMemo(() => {
    if (!selectedRace || !Array.isArray(subraceRaw)) return [];
    return subraceRaw.filter(opt => opt.value === selectedRace);
  }, [selectedRace, subraceRaw]);

  // ----- Handlers: Race / Subrace -----
  const handleRaceChange = (opt) => {
    const newRace = opt?.value ?? "";
    // If race changes and the current subrace doesn't belong, clear it
    let nextSubrace = selectedSubrace;
    if (newRace !== selectedRace) {
      const stillValid = subraceOptions.some(o => o.label === selectedSubrace && o.value === newRace);
      if (!stillValid) nextSubrace = "";
    }

    updateCharField("race", newRace);
    updateCharField("subrace", nextSubrace);
    postCharData();
  };

  const handleSubraceChange = (opt) => {
    const newSub = opt?.label ?? "";
    updateCharField("subrace", newSub);
    postCharData();
  };

  // ----- Handlers: Background -----
  const handleBackgroundChange = (e) => {
    updateCharField("background", e.target.value);
    postCharData();
  };

  // ----- Languages: add/remove -----
  const [langInput, setLangInput] = useState("");

  const addLanguage = () => {
    const v = langInput.trim();
    if (!v) return;
    if (languages.includes(v)) {
      setLangInput("");
      return;
    }
    const next = [...languages, v];
    updateCharField("languages", next);
    postCharData();
    setLangInput("");
  };

  const removeLanguage = (idx) => {
    const next = languages.filter((_, i) => i !== idx);
    updateCharField("languages", next);
    postCharData();
  };

  const onLangInputKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addLanguage();
    }
  };

  // ----- Backstory -----
  const handleBackstoryChange = (e) => {
    updateCharField("backstory", e.target.value);
    postCharData();
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900/30 p-3 text-red-100">
          {error}
        </div>
      )}

      {/* Race / Subrace */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
        <header className="mb-3">
          <h3 className="text-lg font-semibold text-orange-300">Ancestry</h3>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Race */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-300">Race</label>
            <CreatableSelect
              className="text-slate-900"
              value={
                selectedRace
                  ? { value: selectedRace, label: selectedRace }
                  : null
              }
              options={raceOptions || []}
              onChange={handleRaceChange}
              placeholder="Choose or type a race…"
            />
          </div>

          {/* Subrace */}
          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-300">Subrace</label>
            <CreatableSelect
              className="text-slate-900"
              isDisabled={!selectedRace}
              value={
                selectedSubrace
                  ? { value: selectedRace, label: selectedSubrace }
                  : null
              }
              options={subraceOptions}
              onChange={handleSubraceChange}
              placeholder={selectedRace ? "Choose or type a subrace…" : "Select a race first"}
            />
          </div>
        </div>
      </section>

      {/* Background */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
        <header className="mb-3">
          <h3 className="text-lg font-semibold text-orange-300">Background</h3>
        </header>

        <div className="flex items-center gap-3">
          <label htmlFor="background" className="w-28 text-right">
            Background
          </label>
          <input
            type="text"
            id="background"
            name="background"
            value={background}
            onChange={handleBackgroundChange}
            className="flex-1 px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
            placeholder='e.g., "Acolyte", "Soldier"'
          />
        </div>
      </section>

      {/* Languages */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
        <header className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-orange-300">Languages</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={langInput}
              onChange={(e) => setLangInput(e.target.value)}
              onKeyDown={onLangInputKey}
              placeholder="Add a language"
              className="px-2 py-1 rounded border border-slate-700 bg-white text-slate-900"
            />
            <button
              type="button"
              onClick={addLanguage}
              className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 transition"
            >
              Add
            </button>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {languages.length === 0 && (
            <span className="text-slate-400 text-sm">No languages yet.</span>
          )}
          {languages.map((lng, idx) => (
            <span
              key={`${lng}-${idx}`}
              className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-slate-700 bg-slate-900 text-slate-100"
            >
              {lng}
              <button
                type="button"
                className="text-slate-300 hover:text-white"
                onClick={() => removeLanguage(idx)}
                title="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* Backstory */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
        <header className="mb-3">
          <h3 className="text-lg font-semibold text-orange-300">Backstory</h3>
        </header>
        <textarea
          value={backstory}
          onChange={handleBackstoryChange}
          className="w-full min-h-[220px] rounded-lg border border-slate-700 bg-white text-slate-900 p-3"
          placeholder="Write your character's backstory here…"
        />
      </section>
    </div>
  );
}

export default Biography;
