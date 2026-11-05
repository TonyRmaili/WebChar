import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import useCharStore from "../../../store/CharStore";

import Summary from "../Summary";
import AbilityScoreBoxes, { defaultsFor, rollPool } from "../AbilityScoreBoxes";

import RaceStep from "./RaceStep";
import BackgroundStep from "./BackgroundStep";
import ClassStep from "./ClassStep";
import HitPointsStep from "./HitPointsStep";
import {
  raceChoices,
  backgroundChoices,
  collectGrants,
  isResolved,
  choiceTitle,
  valueLabel,
} from "./choiceEngine";
import {
  classChoices,
  classFixedGrants,
  derivedStats,
  pendingOptionalFeatures,
  makeClassEntry,
  levelBudget,
  availableEditions,
  classVariant,
  subclassUnlockLevel,
  classFeatSlots,
  rollHp,
  computeHp,
  isEpicBoonFeat,
  totalLevel,
  MAX_CHARACTER_LEVEL
} from "./classEngine";
import { computeOverlap } from "./overlap";
import { editionOf } from "./wizardHelpers";
import { buildCharacterPayload } from "./characterPayload";

/* ═══════════════════════════════════════════════════════════════════
   BuildWizard — state and layout only.

   Everything that used to live here (choice detection, option pools,
   grant collection, labels, chip styling) now lives in ./wizard, so
   adding classes means writing one adapter in choiceEngine.js rather
   than growing this file again.
   ═══════════════════════════════════════════════════════════════════ */

const EDITIONS = [
  { id: "one", label: "One D&D" },
  { id: "classic", label: "Classic" },
];

const SECTIONS = [
  { id: "scores", title: "Ability Scores", scope: null },
  { id: "race", title: "Race", scope: "race" },
  { id: "class", title: "Class", scope: "class" },
  { id: "background", title: "Background", scope: "background" },
  { id: "hp", title: "Hit Points", scope: null },
];

function WizardBlock({ title, active, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative p-6 rounded-xl border text-lg font-semibold transition-all
        ${active
          ? "border-amber-500 bg-amber-500/10 text-amber-300"
          : "border-slate-700 bg-slate-800/40 text-slate-300 hover:border-amber-500/40"}`}
    >
      {title}
      {badge > 0 && (
        <span
          title={`${badge} choice${badge > 1 ? "s" : ""} still to make`}
          className="absolute top-2 right-2 min-w-[20px] h-5 px-1.5 rounded-full
                     bg-amber-500/20 border border-amber-500/50 text-amber-300
                     text-[11px] font-bold leading-5 tabular-nums"
        >
          {badge}
        </span>
      )}
    </button>
  );
}

const chipCls = (active) =>
  `text-[11px] px-2.5 py-1 rounded border transition
   ${active
     ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
     : "bg-slate-800/60 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-300"}`;


function TargetLevelField({ value, assigned, onChange }) {
  const min = Math.max(1, assigned);
  const missing = value === "random" ? null : value - assigned;
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] uppercase tracking-wider text-amber-400">Total level</label>
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value === "random" ? "random" : Number(e.target.value))}
        className="px-3 py-2 rounded-md bg-slate-800 border border-slate-600 text-amber-100
                   focus:outline-none focus:ring-2 focus:ring-amber-500/60"
      >
        <option value="random">Random</option>
        {Array.from({ length: MAX_CHARACTER_LEVEL }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n} disabled={n < min}>{n}</option>
        ))}
      </select>
      <span className="text-[10px] text-slate-500">
        {missing == null
          ? `${assigned} assigned · rest decided on create`
          : missing > 0
          ? `${assigned} assigned · ${missing} to randomize`
          : "all levels assigned"}
      </span>
    </div>
  );
}

export default function BuildWizard() {
  /* ───────── stores ───────── */
  const races = useCatalogueStore((s) => s.races);
  const loadingRaces = useCatalogueStore((s) => s.loadingRaces);
  const loadRaces = useCatalogueStore((s) => s.loadRaces);

  const backgroundsData = useCatalogueStore((s) => s.backgroundsData);
  const loadingBackgrounds = useCatalogueStore((s) => s.loadingBackgrounds);
  const loadBackgrounds = useCatalogueStore((s) => s.loadBackgrounds);

  const classes = useCatalogueStore((s) => s.classes);
  const loadingClasses = useCatalogueStore((s) => s.loadingClasses);
  const loadClasses = useCatalogueStore((s) => s.loadClasses);

  const featsData = useCatalogueStore((s) => s.featsData);
  const loadingFeats = useCatalogueStore((s) => s.loadingFeats);
  const loadFeats = useCatalogueStore((s) => s.loadFeats);

  const openPopup = usePopupStore((s) => s.open);
  const createChar = useCharStore((s) => s.createChar);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const [random, setRandom] = useState(false);
  const [targetLevel, setTargetLevel] = useState("random"); // "random" | 1–20

  const backgrounds = backgroundsData?.backgrounds || [];
  const feats = featsData?.feats || [];

  /* ───────── identity ───────── */
  const [name, setName] = useState("");
  const [editions, setEditions] = useState(["one"]);

  /* ───────── selections ───────── */
  const [selectedRace, setSelectedRace] = useState(null);
  const [subrace, setSubrace] = useState(null);
  const [selectedBackground, setSelectedBackground] = useState(null);
  /* Ordered — index 0 is the primary class and the only one that grants full
     starting proficiencies and equipment. */
  const [classEntries, setClassEntries] = useState([]);
  const [choiceSel, setChoiceSel] = useState({}); // { [choiceId]: values | asiState }
  /* HP is its own little config: average | roll | manual. Rolls are stored
     so the number doesn't change on every render. */
  const [hp, setHp] = useState({ mode: "average", manual: 0, rolls: {} });

  /* ───────── ability scores ───────── */
  const [abilityMethod, setAbilityMethod] = useState("standard");
  const [abilityScores, setAbilityScores] = useState(() => defaultsFor("standard"));
  const [abilityPool, setAbilityPool] = useState([]);

  const [activeSection, setActiveSection] = useState("scores");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!Array.isArray(races) || races.length === 0) loadRaces();
  }, [races, loadRaces]);

  useEffect(() => {
    if (!Array.isArray(backgrounds) || backgrounds.length === 0) loadBackgrounds();
    if (!classes || Object.keys(classes).length === 0) loadClasses();
    if (!Array.isArray(feats) || feats.length === 0) loadFeats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───────── derived ───────── */
  const counts = useMemo(() => {
    const tally = (list) =>
      (list || []).reduce(
        (acc, e) => (e ? ((acc[editionOf(e)] += 1), acc) : acc),
        { one: 0, classic: 0 }
      );
    const r = tally(races);
    const b = tally(backgrounds);
    return {
      one: r.one + b.one,
      classic: r.classic + b.classic,
      races: r,
      backgrounds: b,
    };
  }, [races, backgrounds]);

  const choices = useMemo(
    () => [
      ...raceChoices(selectedRace, subrace),
      ...classChoices(classEntries, classes, choiceSel),
      ...backgroundChoices(selectedBackground),
    ],
    [selectedRace, subrace, selectedBackground, classEntries, classes, choiceSel]
  );

  const grants = useMemo(
    () => collectGrants({
      race: selectedRace,
      subrace,
      background: selectedBackground,
      extraFixed: classFixedGrants(classEntries, classes),
      choices,
      choiceSel,
    }),
    [selectedRace, subrace, selectedBackground, classEntries, classes, choices, choiceSel]
  );

  const stats = useMemo(() => derivedStats(classEntries, classes), [classEntries, classes]);
  const optionalFeatures = useMemo(
    () => pendingOptionalFeatures(classEntries, classes),
    [classEntries, classes]
  );

  /* CON after racial/background bonuses — what the HP maths needs. */
  const conMod = useMemo(() => {
    const base = abilityScores?.con;
    if (base == null) return 0;
    return Math.floor((base + (grants.abilities?.con || 0) - 10) / 2);
  }, [abilityScores, grants.abilities]);

  const hpResult = useMemo(
    () => computeHp({ entries: classEntries, classes, conMod, ...hp }),
    [classEntries, classes, conMod, hp]
  );

  const overlap = useMemo(
    () => computeOverlap({ grants, choices, choiceSel }),
    [grants, choices, choiceSel]
  );

  const unresolved = useMemo(
    () => choices.filter((c) => !isResolved(c, choiceSel[c.id], subrace)),
    [choices, choiceSel, subrace]
  );

  const pendingByScope = useMemo(() => {
    const out = { race: 0, class: 0, background: 0 };
    unresolved.forEach((c) => { if (out[c.scope] != null) out[c.scope] += 1; });
    // Feat slots (including the Epic Boon bonus slot) aren't tracked by the
    // generic choice engine — feats come from a catalogue classEngine has
    // no access to, so they're counted directly here instead.
    classEntries.forEach((entry, index) => {
      const variant = classVariant(classes, entry.key, entry.edition);
      const { slots } = classFeatSlots({ entry, index, variant, feats });
      out.class += Math.max(0, slots - (entry.feats?.length || 0));
    });
    return out;
  }, [unresolved, classEntries, classes, feats]);

  /* Creation is deliberately NOT gated on completeness. A half-built
     character is useful while testing, and anything unresolved is simply
     absent from the payload rather than invalid — `characterPayload` is
     null-safe for a missing race, no classes and unmade choices.
     Only the name is required, because `createChar` keys on it. */
  const incomplete = useMemo(() => {
    const list = [];
    if (!selectedRace) list.push("no race");
    if (classEntries.length === 0) list.push("no class");
    if (unresolved.length) {
      list.push(`${unresolved.length} unmade choice${unresolved.length > 1 ? "s" : ""}`);
    }
    return list;
  }, [selectedRace, classEntries, unresolved]);

  const canCreate = !!name.trim();

  const assignedLevels = totalLevel(classEntries);

  const effectiveTarget =
    targetLevel === "random" ? "random" : Math.max(targetLevel, assignedLevels, 1);

  const levelCap =
    random && effectiveTarget !== "random" ? effectiveTarget : MAX_CHARACTER_LEVEL;

  /* ───────── selection handlers ─────────
     Clearing scoped keys on re-selection stops stale picks from a
     previous race/background leaking into the new one. */
  const dropKeys = (prefix) =>
    setChoiceSel((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(prefix)))
    );

  const chooseRace = (r) => {
    setSelectedRace(r);
    setSubrace(null);
    dropKeys("race.");
  };

  const chooseSubrace = (sr) => {
    setSubrace(sr);
    dropKeys("race.sub");
  };

  const chooseBackground = (bg) => {
    setSelectedBackground(bg);
    dropKeys("bg.");
  };

  /* ───────── classes ───────── */
  const addClass = (key, edition) => {
    const ed = edition || availableEditions(classes, key)[0];
    if (!ed) return;
    setClassEntries((prev) => {
      if (prev.some((e) => e.key === key)) return prev; // can't take the same class twice
      const room = levelBudget(prev, key, levelCap);
      if (room < 1) return prev;
      return [...prev, makeClassEntry(key, ed, 1)];
    });
  };

  const removeClass = (key) => {
    setClassEntries((prev) => prev.filter((e) => e.key !== key));
    dropKeys(`class.${key}.`);
  };

  const changeClassLevel = (key, level) =>
    setClassEntries((prev) => {
      const next = Math.max(1, Math.min(levelBudget(prev, key, levelCap), level));
      const updated = prev.map((e) => (e.key === key ? { ...e, level: next } : e));
      return updated.map((e, i) => {
        if (e.key !== key) return e;
        const variant = classVariant(classes, key, e.edition);
        // Dropping below the unlock level must also clear the subclass.
        // classChoices stops emitting that choice, so a kept value would be
        // invisible in the UI yet still ride along in the payload.
        const unlockSub = subclassUnlockLevel(variant);
        const keepSub = unlockSub == null || next >= unlockSub;
        // Same idea for feats — dropping level (or losing Epic Boon
        // eligibility) can shrink the number of feat slots this class grants.
        const { slots: maxFeats, epicBoonEligible } = classFeatSlots({ entry: e, variant });
        const kept = (e.feats || []).filter((p) => {
          if (epicBoonEligible) return true;
          const full = feats.find((f) => f.name === p.name && f.source === p.source);
          return !isEpicBoonFeat(full);
        });
        return { ...e, subclass: keepSub ? e.subclass : null, feats: kept.slice(0, maxFeats) };
              });
    });

  const changeClassEdition = (key, edition) => {
    setClassEntries((prev) =>
      prev.map((e) => (e.key === key ? { ...e, edition, subclass: null, feats: [] } : e))
    );
    // Subclass lists, proficiencies AND feat-slot progression differ per
    // edition — old picks are void.
    dropKeys(`class.${key}.`);
  };

  const changeSubclass = (key, subclass) =>
    setClassEntries((prev) => prev.map((e) => (e.key === key ? { ...e, subclass } : e)));

  const changeClassFeats = (key, feats) =>
    setClassEntries((prev) => prev.map((e) => (e.key === key ? { ...e, feats } : e)));

  /* ───────── hit points ───────── */
  const changeHpMode = (mode) =>
    setHp((prev) => ({
      ...prev,
      mode,
      // Entering roll mode with no rolls yet gets one automatically, so the
      // number on screen is never stale placeholder average.
      rolls:
        mode === "roll" && !Object.keys(prev.rolls || {}).length
          ? rollHp(classEntries, classes)
          : prev.rolls,
    }));

  const changeHpManual = (manual) => setHp((prev) => ({ ...prev, manual }));
  const rerollHp = () => setHp((prev) => ({ ...prev, rolls: rollHp(classEntries, classes) }));

  const toggleChoiceValue = (id, value, count) =>
    setChoiceSel((prev) => {
      const cur = Array.isArray(prev[id]) ? prev[id] : [];
      let next;
      if (cur.includes(value)) next = cur.filter((v) => v !== value);
      else if (cur.length >= count) next = count === 1 ? [value] : cur;
      else next = [...cur, value];
      return { ...prev, [id]: next };
    });

  const setAsi = (id, state) => setChoiceSel((prev) => ({ ...prev, [id]: state }));

  const changeAbilityMethod = (m) => {
    setAbilityMethod(m);
    setAbilityScores(defaultsFor(m));
    setAbilityPool([]);
  };

  const rollAbilityScores = () => {
    setAbilityPool(rollPool());
    setAbilityScores(defaultsFor("random"));
  };

  const resetAll = () => {
    setName("");
    setSelectedRace(null);
    setSubrace(null);
    setSelectedBackground(null);
    setClassEntries([]);
    setChoiceSel({});
    setHp({ mode: "average", manual: 0, rolls: {} });
    setAbilityMethod("standard");
    setAbilityScores(defaultsFor("standard"));
    setAbilityPool([]);
    setActiveSection("scores");
    setTargetLevel("random");
  };

  /* ───────── payload ─────────
     Shaped like a character save so the Combat screens can read it
     directly; `_builder` carries the source refs the backend needs to
     resolve class/subclass features and feat-granted spells. */
  const makePayload = () =>
    buildCharacterPayload({
      name,
      random,
      targetLevel: effectiveTarget,
      abilityMethod,
      abilityScores,
      selectedRace,
      subrace,
      selectedBackground,
      classEntries,
      choices,
      choiceSel,
      hp,
    });

  const handleCreate = async () => {
    // if (!canCreate) return;
    const payload = makePayload();
    console.log("character payload →", payload);
    try {
      setCreating(true);
      setErr(null);
      // Passed as a second argument so this stays compatible with the
      // existing `createChar(name)` signature — update CharStore to read
      // the second parameter when the endpoint is ready for it.
      await createChar(payload);
      await fetchUser();
      resetAll();
    } catch (e) {
      setErr(e.message);
      console.error("create failed:", e);
    } finally {
      setCreating(false);
    }
  };



  /* ───────── render ───────── */
  return (
    <div className="flex flex-col lg:flex-row gap-5 w-full">
      <div className="flex-[2] min-w-0 flex flex-col gap-4">
        {/* name · ruleset · create */}
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 flex flex-col gap-4">
          <div className="flex justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase tracking-wider text-amber-400">
                Character name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Thaldrin Brightaxe"
                className="px-3 py-2 rounded-md bg-slate-800 border border-slate-600 text-amber-100
                           placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/60"
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-wider text-amber-400">Ruleset</span>
              <div className="flex flex-wrap gap-2">
                {EDITIONS.map((e) => {
                  const active = editions.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() =>
                        setEditions((prev) => {
                          const next = active ? prev.filter((v) => v !== e.id) : [...prev, e.id];
                          return next.length ? next : prev; // never zero
                        })
                      }
                      className={chipCls(active)}
                    >
                      {e.label}
                      <span className="ml-1.5 text-amber-300/70 normal-case">({counts[e.id]})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col text-amber-400 items-center text-sm">
              <span >
                Randomizer
              </span>
              <button
                  onClick={() => setRandom(!random)}
                  className={`toggle ${random ? "on" : "off"} border-2 border-red-700 rounded-xl p-2`}
              >
                  {random ? "ON" : "OFF"}
              </button>
        
            </div>

            {random && (
              <TargetLevelField
                value={effectiveTarget}
                assigned={assignedLevels}
                onChange={setTargetLevel}
              />
            )}

            <button
              type="button"
              disabled={creating}
              onClick={handleCreate}
              className="px-5 py-2 rounded-md border-2 bg-gradient-to-r text-amber-100 font-semibold transition-all
                         from-amber-900 to-amber-700 hover:from-amber-800 hover:to-amber-600 border-amber-900
                         shadow-[0_0_10px_rgba(245,158,11,0.25)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating
                ? "Creating…"
                : incomplete.length
                ? "Create Anyway"
                : "Create Character"}
            </button>
          </div>

          {incomplete.length > 0 && name.trim() && (
            <div className="flex items-start gap-2 p-2 rounded border border-amber-600/40
                            bg-amber-500/10 text-amber-200/90 text-xs">
              <span className="mt-[1px]">⚠</span>
              <span>
                Incomplete: {incomplete.join(", ")}. You can still create the
                character — the missing pieces just won't be in the payload.
              </span>
            </div>
          )}

          {err && (
            <div className="p-2 rounded border border-red-700 bg-red-900/30 text-red-300 text-sm">
              {err}
            </div>
          )}
        </div>

        {/* steps */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {SECTIONS.map((s) => (
            <WizardBlock
              key={s.id}
              title={s.title}
              active={activeSection === s.id}
              badge={s.scope ? pendingByScope[s.scope] : 0}
              onClick={() => setActiveSection(s.id)}
            />
          ))}
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          {activeSection === "scores" && (
            <AbilityScoreBoxes
              method={abilityMethod}
              scores={abilityScores}
              pool={abilityPool}
              onMethodChange={changeAbilityMethod}
              onScoresChange={setAbilityScores}
              onRoll={rollAbilityScores}
            />
          )}

          {activeSection === "race" && (
            <RaceStep
              races={races}
              loading={loadingRaces}
              editions={editions}
              selectedRace={selectedRace}
              subrace={subrace}
              choices={choices}
              choiceSel={choiceSel}
              overlap={overlap}
              onSelectRace={chooseRace}
              onSelectSubrace={chooseSubrace}
              onToggleChoice={toggleChoiceValue}
              onAsiChange={setAsi}
              onPreview={(r) => openPopup("race", r)}
            />
          )}

          {activeSection === "class" && (
            <ClassStep
              classes={classes}
              loading={loadingClasses}
              editions={editions}
              entries={classEntries}
              choices={choices}
              choiceSel={choiceSel}
              overlap={overlap}
              feats={feats}
              loadingFeats={loadingFeats}
              onAddClass={addClass}
              onRemoveClass={removeClass}
              onChangeLevel={changeClassLevel}
              onChangeEdition={changeClassEdition}
              onChangeSubclass={changeSubclass}
              onChangeFeats={changeClassFeats}
              onPreviewFeat={(f) => openPopup("feat", f)}
              onToggleChoice={toggleChoiceValue}
              onAsiChange={setAsi}
              levelCap={levelCap}
            />
          )}

          {activeSection === "hp" && (
            <HitPointsStep
              classes={classes}
              entries={classEntries}
              conMod={conMod}
              hp={hp}
              onChangeMode={changeHpMode}
              onChangeManual={changeHpManual}
              onRoll={rerollHp}
            />
          )}

          {activeSection === "background" && (
            <BackgroundStep
              backgrounds={backgrounds}
              loading={loadingBackgrounds}
              editions={editions}
              selectedBackground={selectedBackground}
              choices={choices}
              choiceSel={choiceSel}
              overlap={overlap}
              onSelectBackground={chooseBackground}
              onToggleChoice={toggleChoiceValue}
              onAsiChange={setAsi}
              onPreview={(b) => openPopup("background", b)}
            />
          )}
        </div>
      </div>

      <Summary
        editions={editions}
        selectedRace={selectedRace}
        subrace={subrace}
        selectedBackground={selectedBackground}
        classEntries={classEntries}
        classes={classes}
        stats={stats}
        optionalFeatures={optionalFeatures}
        maxHp={hpResult.total}
        grants={grants}
        choices={choices}
        choiceSel={choiceSel}
        overlap={overlap}
        choiceTitle={choiceTitle}
        valueLabel={valueLabel}
        abilityMethod={abilityMethod}
        abilityScores={abilityScores}
      />
    </div>
  );
}