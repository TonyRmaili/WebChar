import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../../store/CatalogueStore";
import useCharStore from "../../../../store/CharStore";
import { usePersistedOpen } from "../../../../utils/SectionCard";
import ClassProgressionTable from "../../../Catalogues/Classes/ClassProgressionTable";
import { INK, InkButton, InkSelect, ParchmentSheet, SubHeading, Title } from "../../../../styles/parchment";
import { DefineSection, Hint, Segmented, addBtn } from "../../../../styles/parchmentForm";
import { labelOf, useSheet } from "../sheetHelpers";
import { addLayerFeature, featureRows, isOptionFeature, newOwnFeature, usesKey } from "../featureHelpers";
import { hitDiceLabel } from "./generalHelpers";
import FeatureList, { TakenOff } from "./FeatureList";
import { AddClass, LevelSteps, LevelUpForm, levelDownMessage } from "./Leveler";
import { classFeatureGroups, levelFrom, moveOwnClassFeature } from "./classHelpers";

/* Define tab: Class — everything the classes give, on parchment.

   Per class:
     the header      subclass, − level + (Leveler.jsx: − asks first, +
                     opens the level-up form), hit die, the class table
     Class features  the core features, by the level they came with
     <Subclass>      the subclass's features, by level
   Every feature is the character's own copy: click a name to read or
   change it ("edited", "back to the book's"). "+ a feature" writes one
   of your own at the level you pick, core or subclass; it lives on that
   level (classHelpers.js), so a level down takes it with the level.

   "+ add a class" takes a first level in a new class (warnings only). */

const CORE_OR_SUB = [
  { value: "core", label: "core" },
  { value: "subclass", label: "subclass" },
];

const levelOptions = (max) => Array.from({ length: Math.max(1, max) }, (_, i) => i + 1);

// Level and core/subclass, for writing a new feature or moving your own.
function Placement({ maxLevel, level, kind, subclassName, onLevel, onKind }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
      <label className="flex items-baseline gap-1.5">
        <span className={`italic ${INK.faded}`}>level</span>
        <InkSelect value={level} onChange={(e) => onLevel(Number(e.target.value))} aria-label="Level" className="h-7 text-sm">
          {levelOptions(maxLevel).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </InkSelect>
      </label>
      <Segmented
        size="sm"
        options={CORE_OR_SUB.map((o) => (o.value === "subclass" && subclassName ? { ...o, label: subclassName } : o))}
        value={kind}
        onChange={onKind}
      />
    </span>
  );
}

function NewFeature({ cls, onAdd, onCancel }) {
  const [level, setLevel] = useState(cls.level);
  const [kind, setKind] = useState("core");
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-2 border-l-2 border-rubric/40 pl-4">
      <span className="text-[15px]">A feature of your own</span>
      <Placement maxLevel={cls.level} level={level} kind={kind} subclassName={cls.subclass_name} onLevel={setLevel} onKind={setKind} />
      <span className="ml-auto flex items-baseline gap-4">
        <InkButton onClick={onCancel}>cancel</InkButton>
        <InkButton active onClick={() => onAdd(level, kind === "subclass")}>
          write it
        </InkButton>
      </span>
    </div>
  );
}

// Features by level: "Level 3" in the margin, the lines beside it.
function ByLevel({ groups, list, empty }) {
  if (!groups.length) return <Hint>{empty}</Hint>;
  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g.level} className="flex items-baseline gap-3">
          <span className={`w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] ${INK.faded}`}>Level {g.level}</span>
          <div className="min-w-0 flex-1">{list(g.rows)}</div>
        </div>
      ))}
    </div>
  );
}

function ClassSection({ cls, record, subRecord, ch, d, rows, patchChar, openKey, setOpenKey, leveling, onLevelUp, onLevelDown, onCloseForm, busy }) {
  const [showTable, setShowTable] = usePersistedOpen(`class.progression.${cls.id}`, false);
  const [writing, setWriting] = useState(false);
  const groups = useMemo(() => classFeatureGroups(rows, cls), [rows, cls]);
  const subName = cls.subclass_name || (cls.subclass ? labelOf(cls.subclass.split(":").pop()) : null);

  const add = (level, subclass) => {
    const from = levelFrom(cls.id, level);
    const f = newOwnFeature("actions", { level, subclass });
    patchChar(addLayerFeature(ch, from, f), { now: true });
    setOpenKey(usesKey(from, f.id));
    setWriting(false);
  };

  // Your own: move it to another level, or between core and subclass.
  const placement = (r) =>
    r.feature.own ? (
      <div className="ml-[26px] mt-2">
        <Placement
          maxLevel={cls.level}
          level={r.level}
          kind={r.feature.subclass ? "subclass" : "core"}
          subclassName={subName}
          onLevel={(level) => {
            const to = levelFrom(cls.id, level);
            patchChar(moveOwnClassFeature(ch, r.from, to, r.feature.id, { level }), { now: true });
            setOpenKey(usesKey(to, r.feature.id));
          }}
          onKind={(kind) => patchChar(moveOwnClassFeature(ch, r.from, r.from, r.feature.id, { subclass: kind === "subclass" }), { now: true })}
        />
      </div>
    ) : null;

  const list = (rs) => <FeatureList rows={rs} ch={ch} d={d} patchChar={patchChar} openKey={openKey} setOpenKey={setOpenKey} extra={placement} hideOwner />;

  return (
    <DefineSection
      title={cls.name}
      count={`level ${cls.level}`}
      storageKey={`define.class.${cls.id}`}
      actions={(setOpen) => (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setWriting(!writing);
          }}
          className={addBtn}
          title="Write a class or subclass feature of your own, at the level you pick"
        >
          + a feature
        </button>
      )}
    >
      <div className="mb-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <span className="text-[15px]">{subName || <span className={`italic ${INK.faint}`}>no subclass yet</span>}</span>
        <span className={`flex items-baseline gap-1 text-sm italic ${INK.faded}`}>
          level
          <LevelSteps level={cls.level} label={`${cls.name} level`} busy={busy} onUp={onLevelUp} onDown={onLevelDown} />
        </span>
        <span className={`text-sm italic ${INK.faded}`}>
          hit die <span className={`not-italic ${INK.ink}`}>{cls.hit_die}</span>
        </span>
        <span className={`text-xs ${INK.faint}`}>{cls.edition === "classic" ? "2014" : "2024"}</span>
        <span className="ml-auto">
          {record ? (
            <InkButton onClick={() => setShowTable((v) => !v)} active={showTable}>
              {showTable ? "hide table" : "table"}
            </InkButton>
          ) : (
            <span className={`text-xs italic ${INK.faint}`}>not in the catalogue</span>
          )}
        </span>
      </div>
      {record && showTable && (
        <div className="mb-4">
          <ClassProgressionTable cls={record} subclasses={subRecord ? [subRecord] : []} />
        </div>
      )}
      {leveling && (
        <div className="mb-5">
          <LevelUpForm key={`${cls.id}@${cls.level}`} ch={ch} classId={cls.id} name={cls.name} onClose={onCloseForm} />
        </div>
      )}
      {writing && <NewFeature cls={{ ...cls, subclass_name: subName }} onAdd={add} onCancel={() => setWriting(false)} />}

      <SubHeading>Class features</SubHeading>
      <ByLevel groups={groups.core} list={list} empty="No class features." />
      {(subName || groups.subclass.length > 0) && (
        <>
          <SubHeading>{subName || "Subclass"} features</SubHeading>
          <ByLevel groups={groups.subclass} list={list} empty="No subclass features yet." />
        </>
      )}
      <TakenOff ch={ch} patchChar={patchChar} test={(from, f) => from.startsWith(`class:${cls.id}@`) && !isOptionFeature(f)} />
    </DefineSection>
  );
}

export default function ClassDefine() {
  const { ch, d, patchChar } = useSheet();
  const classes = useCatalogueStore((s) => s.classes);
  const subclasses = useCatalogueStore((s) => s.subclasses);
  useEffect(() => {
    const store = useCatalogueStore.getState();
    if (!store.classes?.length && !store.loadingClasses) store.loadClasses();
    if (!store.subclasses?.length && !store.loadingSubclasses) store.loadSubclasses();
  }, []);

  const levelDown = useCharStore((s) => s.levelDown);
  const [leveling, setLeveling] = useState(null); // class id whose level-up form is open
  const [adding, setAdding] = useState(false);
  const [newClass, setNewClass] = useState(null); // catalogue record
  const [busy, setBusy] = useState(false);
  const [levelErr, setLevelErr] = useState(null);
  const [openKey, setOpenKey] = useState(null); // the feature whose editor is open
  const rows = useMemo(() => featureRows(ch, d), [ch, d]);

  if (!ch || !d) return null;

  const down = async (cls) => {
    if (!window.confirm(levelDownMessage(ch, cls.id, cls.name))) return;
    try {
      setBusy(true);
      setLevelErr(null);
      setLeveling(null);
      await levelDown(cls.id);
    } catch (e) {
      setLevelErr(e.message || "couldn't level down");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ParchmentSheet>
      <Title
        after={
          <span className={`text-sm italic ${INK.faded}`}>
            level <span className={`not-italic font-semibold ${INK.ink}`}>{d.level}</span>
            {d.classes.length > 0 && <> · hit dice {hitDiceLabel(d.hit_dice)}</>}
          </span>
        }
        right={
          !newClass && (
            <InkButton onClick={() => setAdding(!adding)} active={adding} title="Take a level in a class you don't have yet">
              + add a class
            </InkButton>
          )
        }
      >
        Class
      </Title>

      {adding && !newClass && (
        <div className="-mt-3 mb-6">
          <AddClass
            catalogue={classes || []}
            have={d.classes.map((c) => c.id)}
            scores={Object.fromEntries(Object.entries(d.abilities).map(([a, v]) => [a, v.score]))}
            onPick={(c) => {
              setLeveling(null);
              setAdding(false);
              setNewClass(c);
            }}
            onClose={() => setAdding(false)}
          />
        </div>
      )}
      {newClass && (
        <div className="-mt-3 mb-6">
          <LevelUpForm key={newClass.id} ch={ch} classId={newClass.id} name={newClass.name} onClose={() => setNewClass(null)} />
        </div>
      )}
      {levelErr && <p className={`mb-4 text-sm italic ${INK.rubric}`}>Couldn't level down: {levelErr}</p>}

      {d.classes.length === 0 && !newClass ? (
        <Hint>No class yet: "+ add a class" takes a first level in one.</Hint>
      ) : (
        <div className="space-y-8">
          {d.classes.map((cls) => (
            <ClassSection
              key={cls.id}
              cls={cls}
              record={(classes || []).find((c) => c.id === cls.id)}
              subRecord={cls.subclass ? (subclasses || []).find((s) => s.id === cls.subclass) : null}
              ch={ch}
              d={d}
              rows={rows}
              patchChar={patchChar}
              openKey={openKey}
              setOpenKey={setOpenKey}
              busy={busy}
              leveling={leveling === cls.id}
              onLevelUp={() => {
                setNewClass(null);
                setAdding(false);
                setLeveling(leveling === cls.id ? null : cls.id);
              }}
              onCloseForm={() => setLeveling(null)}
              onLevelDown={() => down(cls)}
            />
          ))}
        </div>
      )}
      <p className={`mt-6 text-xs italic ${INK.faint}`}>◆ = shown in Play · click a name for its card · "edit" changes your copy</p>
    </ParchmentSheet>
  );
}
