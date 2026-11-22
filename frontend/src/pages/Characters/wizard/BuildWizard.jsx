import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import useCharStore from "../../../store/CharStore";
import useCampaignStore from "../../../store/CampaignStore";
import { INK, InkButton, InkSelect, InkText, Mark } from "../../../styles/parchment";

import AbilityScoreBoxes, { defaultsFor, rollPool } from "../AbilityScoreBoxes";
import OriginStep from "./OriginStep";
import ClassStep from "./ClassStep";
import HitPointsStep from "./HitPointsStep";
import WizardSummary from "./WizardSummary";
import usePreview from "./usePreview";
import useViewOption from "./useViewOption";

/* ═══════════════════════════════════════════════════════════════════
   BuildWizard — what the player picks, on parchment. The rules live in
   the backend (app/builder, claude/character-plan.md):

     POST /character/preview   while picking: every choice with its
                               options, what's open, the numbers
     POST /character           create, to the profile and/or a campaign

   The wizard keeps only the picks, as the character file does:

     race, subrace, background, classes [{id, level}]
     picks   { "<layer from>": { "<choice path>": value } }
             e.g. picks["background:acolyte-xphb"].starting_equipment = "a"
     abilities, hp, name, the randomizer settings, where it goes

   and sends them as layers ({from, picks}): one per race, subrace,
   background, class level ("class:wizard-xphb@3") and feat a layer grants
   ("feat:magic-initiate-xphb", via the layer that grants it).

   With "fill in the rest at random" on, the preview shows the roll (drawn
   lighter) and Create sends the same seed, so what you see is what you
   get; "reroll" draws again. Anything the player picks is kept.
   ═══════════════════════════════════════════════════════════════════ */

const EDITIONS = [
  { id: "one", label: "One D&D" },
  { id: "classic", label: "Classic" },
];
const MAX_LEVEL = 20;
const newSeed = () => Math.floor(Math.random() * 1e9);

const SECTIONS = [
  { id: "scores", numeral: "I", title: "Ability scores" },
  { id: "race", numeral: "II", title: "Race" },
  { id: "class", numeral: "III", title: "Class" },
  { id: "background", numeral: "IV", title: "Background" },
  { id: "hp", numeral: "V", title: "Hit points" },
];

// The step a layer's choices belong to (a feat follows the layer that grants it).
const stepOf = (root) =>
  root?.startsWith("race:") ? "race" : root?.startsWith("background:") ? "background" : root?.startsWith("class:") ? "class" : null;

function StepNav({ active, pending, onPick }) {
  return (
    <nav aria-label="Builder steps" className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-y border-rule/30 py-2">
      {SECTIONS.map((s) => {
        const on = active === s.id;
        const left = pending[s.id] || 0;
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

// Where the new character goes: any combination of the three.
function Destinations({ dest, onChange, campaigns }) {
  const set = (k, v) => onChange({ ...dest, [k]: v });
  const toCampaign = dest.npc || dest.party;
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className={`italic ${INK.faded}`}>Save as</span>
      {[
        ["character", "my character"],
        ["npc", "NPC"],
        ["party", "party member"],
      ].map(([k, label]) => (
        <span key={k} className="flex items-center gap-1">
          <Mark on={dest[k]} onClick={() => set(k, !dest[k])} label={label} />
          <span>{label}</span>
        </span>
      ))}
      {toCampaign && (
        <span className="flex items-baseline gap-2">
          <span className={`italic ${INK.faded}`}>in</span>
          <InkSelect value={dest.campaign || ""} onChange={(e) => set("campaign", e.target.value || null)} aria-label="Campaign" className="h-7 text-sm">
            <option value="">pick a campaign…</option>
            {campaigns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </InkSelect>
        </span>
      )}
    </span>
  );
}

export default function BuildWizard({ onCreated }) {
  /* ───────── catalogues ───────── */
  const races = useCatalogueStore((s) => s.races);
  const loadingRaces = useCatalogueStore((s) => s.loadingRaces);
  const backgrounds = useCatalogueStore((s) => s.backgrounds);
  const loadingBackgrounds = useCatalogueStore((s) => s.loadingBackgrounds);
  const classes = useCatalogueStore((s) => s.classes);
  const loadingClasses = useCatalogueStore((s) => s.loadingClasses);

  useEffect(() => {
    const store = useCatalogueStore.getState();
    if (!store.races?.length) store.loadRaces();
    if (!store.backgrounds?.length) store.loadBackgrounds();
    if (!store.classes?.length) store.loadClasses();
  }, []);

  const openPopup = usePopupStore((s) => s.open);
  const createChar = useCharStore((s) => s.createChar);
  const fetchUser = useAuthStore((s) => s.fetchUser);
  const selectedCampaign = useAuthStore((s) => s.userData?.selected_campaign);
  const campaigns = useCampaignStore((s) => s.campaignNames);
  const listCampaigns = useCampaignStore((s) => s.listCampaigns);
  useEffect(() => {
    listCampaigns();
  }, [listCampaigns]);

  const classById = useMemo(() => Object.fromEntries((classes || []).map((c) => [c.id, c])), [classes]);

  /* ───────── what the player picked ───────── */
  const [name, setName] = useState("");
  const [editions, setEditions] = useState(["one"]);
  const [random, setRandom] = useState(false);
  const [seed, setSeed] = useState(newSeed);
  const [targetLevel, setTargetLevel] = useState("random"); // "random" | 1–20

  const [abilityMethod, setAbilityMethod] = useState("standard");
  const [abilityScores, setAbilityScores] = useState(() => defaultsFor("standard"));
  const [abilityPool, setAbilityPool] = useState([]);
  const [hp, setHp] = useState({ mode: "average", manual: 0, rolls: {} });

  const [race, setRace] = useState(null);
  const [subrace, setSubrace] = useState(null);
  const [background, setBackground] = useState(null);
  const [classEntries, setClassEntries] = useState([]); // [{ id, level }], first = starting class
  const [picks, setPicks] = useState({}); // { from: { path: value } }
  const [dest, setDest] = useState({ character: true, npc: false, party: false, campaign: null });

  const [activeSection, setActiveSection] = useState("scores");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!dest.campaign && selectedCampaign) setDest((d) => ({ ...d, campaign: selectedCampaign }));
  }, [selectedCampaign]); // eslint-disable-line react-hooks/exhaustive-deps

  const assigned = classEntries.reduce((n, e) => n + e.level, 0);
  const levelCap = random && targetLevel !== "random" ? Math.max(targetLevel, 1) : MAX_LEVEL;

  /* ───────── picks ───────── */
  const dropPicks = (test) => setPicks((p) => Object.fromEntries(Object.entries(p).filter(([from]) => !test(from))));
  const own = useCallback((from, path) => picks[from]?.[path] ?? null, [picks]);
  const setPick = useCallback(
    (from, path, value) =>
      setPicks((p) => {
        const layer = { ...(p[from] || {}) };
        if (value == null) delete layer[path];
        else layer[path] = value;
        return { ...p, [from]: layer };
      }),
    []
  );

  const chooseRace = (id) => {
    setRace(id);
    setSubrace(null);
    dropPicks((f) => f.startsWith("race:"));
  };
  const chooseSubrace = (id) => {
    setSubrace(id);
    dropPicks((f) => f.includes("/subrace:"));
  };
  const chooseBackground = (id) => {
    setBackground(id);
    dropPicks((f) => f.startsWith("background:"));
  };
  const addClass = (id) =>
    setClassEntries((prev) => (prev.some((e) => e.id === id) || assigned >= levelCap ? prev : [...prev, { id, level: 1 }]));
  const removeClass = (id) => {
    setClassEntries((prev) => prev.filter((e) => e.id !== id));
    dropPicks((f) => f.startsWith(`class:${id}@`));
    setHp((h) => ({ ...h, rolls: Object.fromEntries(Object.entries(h.rolls || {}).filter(([k]) => !k.startsWith(`class:${id}@`))) }));
  };
  const setClassLevel = (id, level) => {
    setClassEntries((prev) => prev.map((e) => (e.id === id ? { ...e, level } : e)));
    // levels taken away take their picks with them
    dropPicks((f) => {
      const m = /^class:([^@]+)@(\d+)$/.exec(f);
      return m && m[1] === id && Number(m[2]) > level;
    });
  };

  /* ───────── what the server makes of it ───────── */
  const [viaOf, setViaOf] = useState({}); // feat layer -> the layer that grants it (from the last preview)

  const layers = useMemo(() => {
    const out = [];
    const add = (from, extra = {}) => out.push({ from, picks: picks[from] || {}, ...extra });
    if (race) add(`race:${race}`);
    if (race && subrace) add(`race:${race}/subrace:${subrace}`);
    if (background) add(`background:${background}`);
    for (const e of classEntries) for (let n = 1; n <= e.level; n += 1) add(`class:${e.id}@${n}`);
    // Picks for granted feats ride along with where they came from.
    for (const from of Object.keys(picks)) if (from.startsWith("feat:") && viaOf[from]) add(from, { via: viaOf[from] });
    return out;
  }, [race, subrace, background, classEntries, picks, viaOf]);

  const payload = useMemo(
    () => ({
      name: name.trim(),
      random,
      seed: random ? seed : undefined,
      target_level: random ? targetLevel : null,
      abilities: { method: abilityMethod, base: abilityScores },
      // Rolls count only while "rolled" is picked (the sheet keeps per-level rolls).
      hp: hp.mode === "roll" ? hp : { ...hp, rolls: {} },
      layers,
    }),
    [name, random, seed, targetLevel, abilityMethod, abilityScores, hp, layers]
  );

  const { data: preview, loading: previewing, error: previewError } = usePreview(payload);

  useEffect(() => {
    if (!preview?.layers) return;
    const via = {};
    for (const l of preview.layers) if (l.via) via[l.from] = l.via;
    setViaOf((old) => (JSON.stringify(old) === JSON.stringify(via) ? old : via));
  }, [preview]);

  const rootOf = useCallback(
    (from) => {
      let f = from;
      for (let i = 0; i < 6 && viaOf[f]; i += 1) f = viaOf[f];
      return f;
    },
    [viaOf]
  );
  const labelOf = useMemo(() => Object.fromEntries((preview?.layers || []).map((l) => [l.from, l.label])), [preview]);
  const ownerLabel = useCallback((from) => (from.startsWith("feat:") ? labelOf[from] : null), [labelOf]);

  const choicesFor = useCallback(
    (step) => (preview?.choices || []).filter((c) => stepOf(rootOf(c.from)) === step),
    [preview, rootOf]
  );

  const pending = useMemo(() => {
    const out = {};
    for (const c of preview?.choices || []) {
      const step = stepOf(rootOf(c.from));
      if (step && c.missing > 0 && !own(c.from, c.path)) out[step] = (out[step] || 0) + 1;
    }
    const raceRec = (races || []).find((r) => r.id === race);
    if (raceRec?.subraces?.length && !subrace) out.race = (out.race || 0) + 1;
    if (!race) out.race = (out.race || 0) + 1;
    if (!background) out.background = (out.background || 0) + 1;
    if (!classEntries.length) out.class = (out.class || 0) + 1;
    return out;
  }, [preview, rootOf, own, races, race, subrace, background, classEntries]);

  /* ───────── create ───────── */
  const toCampaign = dest.npc || dest.party;
  const blocked = !dest.character && !toCampaign ? "Pick where the character goes." : toCampaign && !dest.campaign ? "Pick the campaign." : null;

  const resetAll = () => {
    setName("");
    setRace(null);
    setSubrace(null);
    setBackground(null);
    setClassEntries([]);
    setPicks({});
    setHp({ mode: "average", manual: 0, rolls: {} });
    setAbilityMethod("standard");
    setAbilityScores(defaultsFor("standard"));
    setAbilityPool([]);
    setActiveSection("scores");
    setTargetLevel("random");
    setSeed(newSeed());
  };

  const handleCreate = async () => {
    if (blocked) return setErr(blocked);
    try {
      setCreating(true);
      setErr(null);
      const result = await createChar({ ...payload, destinations: dest });
      if (dest.character) await fetchUser();
      onCreated?.(result?.name || payload.name, result);
      resetAll();
    } catch (e) {
      setErr(e.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleEdition = (id) => setEditions((prev) => (prev.includes(id) ? (prev.length > 1 ? prev.filter((v) => v !== id) : prev) : [...prev, id]));
  const open = (preview?.choices || []).filter((c) => c.missing > 0).length;
  const onView = useViewOption();
  const layerLabel = useCallback((from) => labelOf[from] || null, [labelOf]);
  const stepProps = { own, onPick: setPick, ownerLabel, rolled: random, onView };

  /* ───────── render ───────── */
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span className={`text-sm italic ${INK.faded}`}>Their name is</span>
          <InkText value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Thaldrin Brightaxe" aria-label="Character name" className="h-9 w-full max-w-xs text-xl" />
          <button
            type="button"
            disabled={creating || !!blocked}
            onClick={handleCreate}
            title={blocked || undefined}
            className="ml-auto rounded-full border border-rubric/70 px-4 py-1 text-[15px] italic text-rubric transition hover:bg-rubric hover:text-page-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? "creating…" : open && !random ? "create anyway" : "create character"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-3">
            <span className={`italic ${INK.faded}`}>Ruleset</span>
            {EDITIONS.map((e) => (
              <span key={e.id} className="flex items-center gap-1">
                <Mark on={editions.includes(e.id)} onClick={() => toggleEdition(e.id)} label={`Show ${e.label}`} />
                <span>{e.label}</span>
              </span>
            ))}
          </span>

          <span className="flex items-center gap-1" title="Anything you leave open is decided at random. You see the roll before you create.">
            <Mark on={random} onClick={() => setRandom(!random)} label="Fill in the rest at random" />
            <span>Fill in the rest at random</span>
          </span>

          {random && (
            <span className="flex items-baseline gap-2">
              <span className={`italic ${INK.faded}`}>up to level</span>
              <InkSelect
                value={String(targetLevel)}
                onChange={(e) => setTargetLevel(e.target.value === "random" ? "random" : Number(e.target.value))}
                aria-label="Total level"
                className="h-7 text-sm"
              >
                <option value="random">any (random)</option>
                {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n} disabled={n < Math.max(1, assigned)}>
                    {n}
                  </option>
                ))}
              </InkSelect>
              <InkButton onClick={() => setSeed(newSeed())} title="Roll everything left open again">
                reroll
              </InkButton>
            </span>
          )}
        </div>

        <div className="text-sm">
          <Destinations dest={dest} onChange={setDest} campaigns={campaigns || []} />
        </div>

        {open > 0 && !random && (
          <p className={`text-sm italic ${INK.faded}`}>
            {open} choice{open > 1 ? "s are" : " is"} still open. You can create the character anyway and finish them on the sheet.
          </p>
        )}
        {err && <p className={`text-sm italic ${INK.rubric}`}>Couldn't create the character: {err}</p>}
      </div>

      <StepNav active={activeSection} pending={pending} onPick={setActiveSection} />

      <div className="flex flex-col gap-10 @5xl:flex-row @5xl:items-start">
        <div className="min-w-0 flex-1">
          {activeSection === "scores" && (
            <AbilityScoreBoxes
              method={abilityMethod}
              scores={abilityScores}
              pool={abilityPool}
              onMethodChange={(m) => {
                setAbilityMethod(m);
                setAbilityScores(defaultsFor(m));
                setAbilityPool([]);
              }}
              onScoresChange={setAbilityScores}
              onRoll={() => {
                setAbilityPool(rollPool());
                setAbilityScores(defaultsFor("random"));
              }}
            />
          )}

          {activeSection === "race" && (
            <OriginStep
              kind="race"
              entries={races}
              loading={loadingRaces}
              editions={editions}
              selectedId={race}
              subraceId={subrace}
              onSelect={chooseRace}
              onSelectSubrace={chooseSubrace}
              onPreview={(r) => openPopup("race", r)}
              choices={choicesFor("race")}
              {...stepProps}
            />
          )}

          {activeSection === "class" && (
            <ClassStep
              classes={classes}
              loading={loadingClasses}
              editions={editions}
              entries={classEntries}
              levelCap={levelCap}
              onAdd={addClass}
              onRemove={removeClass}
              onLevel={setClassLevel}
              choices={choicesFor("class")}
              rootOf={rootOf}
              features={preview?.features}
              spells={preview?.spells}
              labelOf={layerLabel}
              {...stepProps}
            />
          )}

          {activeSection === "background" && (
            <OriginStep
              kind="background"
              entries={backgrounds}
              loading={loadingBackgrounds}
              editions={editions}
              selectedId={background}
              onSelect={chooseBackground}
              onPreview={(b) => openPopup("background", b)}
              choices={choicesFor("background")}
              {...stepProps}
            />
          )}

          {activeSection === "hp" && (
            <HitPointsStep
              entries={classEntries}
              byId={classById}
              hp={hp}
              onChange={setHp}
              maxHp={preview?.derived?.hp_max}
              conMod={preview?.derived?.abilities?.con?.mod ?? 0}
            />
          )}
        </div>

        <div className="@5xl:w-72 @5xl:shrink-0 @5xl:self-stretch @5xl:border-l @5xl:border-rule/25 @5xl:pl-6">
          <WizardSummary preview={preview} loading={previewing} error={previewError} />
        </div>
      </div>
    </div>
  );
}
