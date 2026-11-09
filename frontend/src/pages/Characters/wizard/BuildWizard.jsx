import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import useCharStore from "../../../store/CharStore";
import { INK, InkSelect, InkText, Mark } from "../../../styles/parchment";

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
  MAX_CHARACTER_LEVEL,
} from "./classEngine";
import { computeOverlap } from "./overlap";
import { editionOf } from "./wizardHelpers";
import { buildCharacterPayload } from "./characterPayload";

/* ═══════════════════════════════════════════════════════════════════
   BuildWizard — state and layout only, on parchment.

   Lives inside the Characters › Create sheet. Everything that decides
   WHAT the choices are (choice detection, option pools, grants, labels)
   lives in choiceEngine / classEngine / overlap, so adding a source
   means writing one adapter there rather than growing this file.

   Layout: name and options at the top, a contents line of the five
   steps (with how many choices each still needs), the active step, and
   the running summary in the margin beside it on wide screens.
   ═══════════════════════════════════════════════════════════════════ */

const EDITIONS = [
  { id: "one", label: "One D&D" },
  { id: "classic", label: "Classic" },
];

const SECTIONS = [
  { id: "scores", numeral: "I", title: "Ability scores", scope: null },
  { id: "race", numeral: "II", title: "Race", scope: "race" },
  { id: "class", numeral: "III", title: "Class", scope: "class" },
  { id: "background", numeral: "IV", title: "Background", scope: "background" },
  { id: "hp", numeral: "V", title: "Hit points", scope: null },
];

// Contents line: I Ability scores · II Race ² · …  (the small number is
// how many choices that step still needs).
function StepNav({ active, pending, onPick }) {
  return (
    <nav aria-label="Builder steps" className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-y border-rule/30 py-2">
      {SECTIONS.map((s) => {
        const on = active === s.id;
        const left = s.scope ? pending[s.scope] : 0;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            aria-current={on ? "step" : undefined}
            title={left ? `${left} choice${left > 1 ? "s" : ""} still to make` : undefined}
            className={`group flex items-baseline gap-1.5 transition ${on ? INK.rubric : "hover:text-black"}`}
          >
            <span className={`text-xs ${on ? "" : INK.faint}`}>{s.numeral}</span>
            <span className={`text-[17px] ${on ? "underline decoration-1 underline-offset-[6px]" : "group-hover:underline group-hover:decoration-dotted group-hover:underline-offset-[6px]"}`}>
              {s.title}
            </span>
            {left > 0 && <sup className={`text-[11px] font-semibold tabular-nums ${INK.rubric}`}>{left}</sup>}
          </button>
        );
      })}
    </nav>
  );
}

export default function BuildWizard({ onCreated }) {
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
      (list || []).reduce((acc, e) => (e ? ((acc[editionOf(e)] += 1), acc) : acc), { one: 0, classic: 0 });
    const r = tally(races);
    const b = tally(backgrounds);
    return { one: r.one + b.one, classic: r.classic + b.classic, races: r, backgrounds: b };
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
    () =>
      collectGrants({
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
  const optionalFeatures = useMemo(() => pendingOptionalFeatures(classEntries, classes), [classEntries, classes]);

  /* CON after racial/background bonuses — what the HP maths needs. */
  const conMod = useMemo(() => {
    const base = abilityScores?.con;
    if (base == null) return 0;
    return Math.floor((base + (grants.abilities?.con || 0) - 10) / 2);
  }, [abilityScores, grants.abilities]);

  const hpResult = useMemo(() => computeHp({ entries: classEntries, classes, conMod, ...hp }), [classEntries, classes, conMod, hp]);

  const overlap = useMemo(() => computeOverlap({ grants, choices, choiceSel }), [grants, choices, choiceSel]);

  const unresolved = useMemo(
    () => choices.filter((c) => !isResolved(c, choiceSel[c.id], subrace)),
    [choices, choiceSel, subrace]
  );

  const pendingByScope = useMemo(() => {
    const out = { race: 0, class: 0, background: 0 };
    unresolved.forEach((c) => {
      if (out[c.scope] != null) out[c.scope] += 1;
    });
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
     null-safe for a missing race, no classes and unmade choices. */
  const incomplete = useMemo(() => {
    const list = [];
    if (!selectedRace) list.push("no race");
    if (classEntries.length === 0) list.push("no class");
    if (unresolved.length) list.push(`${unresolved.length} unmade choice${unresolved.length > 1 ? "s" : ""}`);
    return list;
  }, [selectedRace, classEntries, unresolved]);

  const assignedLevels = totalLevel(classEntries);
  const effectiveTarget = targetLevel === "random" ? "random" : Math.max(targetLevel, assignedLevels, 1);
  const levelCap = random && effectiveTarget !== "random" ? effectiveTarget : MAX_CHARACTER_LEVEL;

  /* ───────── selection handlers ─────────
     Clearing scoped keys on re-selection stops stale picks from a
     previous race/background leaking into the new one. */
  const dropKeys = (prefix) =>
    setChoiceSel((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(prefix))));

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
      return updated.map((e) => {
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
    setClassEntries((prev) => prev.map((e) => (e.key === key ? { ...e, edition, subclass: null, feats: [] } : e)));
    // Subclass lists, proficiencies AND feat-slot progression differ per
    // edition — old picks are void.
    dropKeys(`class.${key}.`);
  };

  const changeSubclass = (key, subclass) => setClassEntries((prev) => prev.map((e) => (e.key === key ? { ...e, subclass } : e)));

  const changeClassFeats = (key, picked) => setClassEntries((prev) => prev.map((e) => (e.key === key ? { ...e, feats: picked } : e)));

  /* ───────── hit points ───────── */
  const changeHpMode = (mode) =>
    setHp((prev) => ({
      ...prev,
      mode,
      // Entering roll mode with no rolls yet gets one automatically, so the
      // number on screen is never a stale placeholder average.
      rolls: mode === "roll" && !Object.keys(prev.rolls || {}).length ? rollHp(classEntries, classes) : prev.rolls,
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

  const toggleEdition = (id) =>
    setEditions((prev) => {
      const next = prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id];
      return next.length ? next : prev; // never zero
    });

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
     The player's raw selections only; the backend builds the sheet. */
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
    const payload = makePayload();
    console.log("character payload →", payload);
    try {
      setCreating(true);
      setErr(null);
      await createChar(payload);
      await fetchUser();
      onCreated?.(payload.name);
      resetAll();
    } catch (e) {
      setErr(e.message);
      console.error("create failed:", e);
    } finally {
      setCreating(false);
    }
  };

  const minTarget = Math.max(1, assignedLevels);

  /* ───────── render ───────── */
  return (
    <div className="space-y-6">
      {/* name · ruleset · randomizer · create */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span className={`text-sm italic ${INK.faded}`}>Their name is</span>
          <InkText
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Thaldrin Brightaxe"
            aria-label="Character name"
            className="h-9 w-full max-w-xs text-xl"
          />
          <button
            type="button"
            disabled={creating}
            onClick={handleCreate}
            className="ml-auto rounded-full border border-rubric/70 px-4 py-1 text-[15px] italic text-rubric transition hover:bg-rubric hover:text-page-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? "creating…" : incomplete.length ? "create anyway" : "create character"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-3">
            <span className={`italic ${INK.faded}`}>Ruleset</span>
            {EDITIONS.map((e) => (
              <span key={e.id} className="flex items-center gap-1">
                <Mark on={editions.includes(e.id)} onClick={() => toggleEdition(e.id)} label={`Show ${e.label}`} />
                <span>{e.label}</span>
                <span className={`text-xs ${INK.faint}`}>{counts[e.id]}</span>
              </span>
            ))}
          </span>

          <span className="flex items-center gap-1" title="Anything you leave open is decided at random when you create the character.">
            <Mark on={random} onClick={() => setRandom(!random)} label="Fill in the rest at random" />
            <span>Fill in the rest at random</span>
          </span>

          {random && (
            <span className="flex items-baseline gap-2">
              <span className={`italic ${INK.faded}`}>up to level</span>
              <InkSelect
                value={String(effectiveTarget)}
                onChange={(e) => setTargetLevel(e.target.value === "random" ? "random" : Number(e.target.value))}
                aria-label="Total level"
                className="h-7 text-sm"
              >
                <option value="random">any (random)</option>
                {Array.from({ length: MAX_CHARACTER_LEVEL }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n} disabled={n < minTarget}>
                    {n}
                  </option>
                ))}
              </InkSelect>
              <span className={`text-xs italic ${INK.faint}`}>
                {effectiveTarget === "random"
                  ? `${assignedLevels} chosen · the rest decided on create`
                  : effectiveTarget - assignedLevels > 0
                  ? `${assignedLevels} chosen · ${effectiveTarget - assignedLevels} at random`
                  : "all levels chosen"}
              </span>
            </span>
          )}
        </div>

        {incomplete.length > 0 && name.trim() && (
          <p className={`text-sm italic ${INK.faded}`}>
            Still open: {incomplete.join(", ")}. You can create the character anyway — the open parts are left for you to fill in on the sheet
            {random ? ", or decided at random" : ""}.
          </p>
        )}
        {err && <p className={`text-sm italic ${INK.rubric}`}>Couldn't create the character — {err}</p>}
      </div>

      <StepNav active={activeSection} pending={pendingByScope} onPick={setActiveSection} />

      <div className="flex flex-col gap-10 @5xl:flex-row @5xl:items-start">
        <div className="min-w-0 flex-1">
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
        </div>

        <div className="@5xl:w-72 @5xl:shrink-0 @5xl:self-stretch @5xl:border-l @5xl:border-rule/25 @5xl:pl-6">
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
      </div>
    </div>
  );
}