import React, { useEffect, useState } from "react";
import useCharStore from "../../../../store/CharStore";
import { useCatalogueStore } from "../../../../store/CatalogueStore";
import { usePersistedOpen } from "../../../../utils/SectionCard";
import ClassProgress from "./ClassProgress";
import { INK, InkButton, InkChoice, InkHeading as Heading, InkNumber, InkRemove, InkSelect, InkText, Leader, Line, Mark, ParchmentSheet, Title } from "../../../../styles/parchment";
import {
  ABILITIES,
  ATTACKS,
  DIE_OPTIONS,
  SENSE_TYPES,
  SPEED_TYPES,
  asList,
  attackTotal,
  cap,
  catalogueKeyFor,
  classDisplayName,
  classEntry,
  classPatch,
  defaultDie,
  editionsOf,
  expOf,
  formatNumber,
  hitDiceLabel,
  initiativeOf,
  newClassRow,
  offenseOf,
  offenseWithTotals,
  pbOf,
  saveDcTotal,
  senseEntries,
  sensesOf,
  signed,
  speedEntries,
  speedOf,
  subclassesOf,
  summarizeHitDice,
  toInt,
  totalLevelOf,
  withAutoDie,
  withSense,
  withSpeed,
  withoutSense,
  withoutSpeed,
  xpProgress,
} from "./generalHelpers";

/* Define tab: General — classes (with their progression tables), vitals,
   movement, senses, offense and experience. Written on the parchment
   sheet (see src/styles/parchment.jsx).

   Half width: everything in one column. Full width: classes across the
   top, then vitals/movement/senses on the left and offense/experience
   on the right. */

const small = `text-[10px] font-semibold uppercase tracking-[0.16em] ${INK.faded}`;

/* ─── Small pieces ───────────────────────────────────────────────── */

// "± n" blank for manual bonuses.
function Adj({ value, onChange, label }) {
  const n = toInt(value);
  return (
    <span className={`inline-flex items-baseline text-xs ${n ? INK.ink : INK.faint}`} title="Extra bonus from items, feats…">
      ±
      <InkNumber value={n || null} placeholder="0" fallback={0} onChange={(v) => onChange(v ?? 0)} aria-label={label} className="h-6 w-8 text-xs" />
    </span>
  );
}

const Total = ({ children, strong = true }) => (
  <span className={`min-w-[2.25rem] text-right tabular-nums ${strong ? "text-[17px] font-semibold" : ""}`}>{children}</span>
);

// "+ fly  + swim …" for the kinds not added yet.
function AddLinks({ types, have, onAdd }) {
  const missing = types.filter((t) => !have.includes(t));
  if (!missing.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
      {missing.map((t) => (
        <InkButton key={t} onClick={() => onAdd(t)}>
          + {t}
        </InkButton>
      ))}
    </div>
  );
}

/* ─── One class ──────────────────────────────────────────────────── */

function ClassBlock({ row, catalogue, onChange, onType, onRemove }) {
  const [showTable, setShowTable] = usePersistedOpen(`general.progression.${row.id}`, true);
  const key = catalogueKeyFor(catalogue, row.class_name);
  const entry = classEntry(catalogue, row);
  const editions = key ? editionsOf(catalogue, key) : [];
  const subclasses = subclassesOf(entry);
  const autoDie = defaultDie(catalogue, row);
  const subclassKnown = !row.subclass || subclasses.some((s) => s.name === row.subclass);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
        <label className="flex flex-col">
          <span className={small}>Class</span>
          <InkText
            list="general-class-names"
            value={row.class_name ?? ""}
            onChange={(e) => onType({ class_name: e.target.value })}
            onBlur={() => onChange({})}
            placeholder="Fighter"
            className="h-8 w-36 text-lg"
          />
        </label>

        <label className="flex flex-col">
          <span className={small}>Subclass</span>
          {subclasses.length > 0 && subclassKnown ? (
            <InkSelect value={row.subclass ?? ""} onChange={(e) => onChange({ subclass: e.target.value })} className="h-8 max-w-[14rem] text-[15px]">
              <option value="">—</option>
              {subclasses.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </InkSelect>
          ) : (
            <InkText value={row.subclass ?? ""} onChange={(e) => onType({ subclass: e.target.value })} placeholder="—" className="h-8 w-40 text-[15px]" />
          )}
        </label>

        <label className="flex flex-col">
          <span className={small}>Level</span>
          <InkNumber value={toInt(row.level, null)} min={0} max={20} placeholder="—" onChange={(v) => onChange({ level: v ?? 0 })} aria-label="Class level" className="h-8 w-12 text-lg font-semibold" />
        </label>

        <label className="flex flex-col">
          <span className={small}>Hit die</span>
          <InkSelect
            value={row.hit_dice_overridden ? row.hit_dice || "" : ""}
            onChange={(e) =>
              onChange(e.target.value ? { hit_dice: e.target.value, hit_dice_overridden: true } : { hit_dice_overridden: false })
            }
            aria-label="Hit die"
            className="h-8 text-[15px]"
          >
            <option value="">{autoDie ? `${autoDie} (class)` : "—"}</option>
            {DIE_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </InkSelect>
        </label>

        <div className="ml-auto flex items-baseline gap-4 pb-1">
          {editions.length > 1 && (
            <InkChoice
              label="Rules edition"
              options={[
                { value: "one", label: "2024" },
                { value: "classic", label: "2014" },
              ]}
              value={entry?.edition}
              onChange={(edition) => onChange({ edition })}
            />
          )}
          {entry && (
            <InkButton onClick={() => setShowTable((v) => !v)} active={showTable}>
              {showTable ? "hide table" : "table"}
            </InkButton>
          )}
          <InkRemove onClick={onRemove} label={`Remove ${row.class_name || "class"}`} />
        </div>
      </div>

      {entry && showTable && <ClassProgress entry={entry} row={row} />}
      {!entry && row.class_name && (
        <p className={`text-xs italic ${INK.faint}`}>"{row.class_name}" isn't in the class catalogue, so there's no table to show.</p>
      )}
    </div>
  );
}

/* ─── Tab ─────────────────────────────────────────────────────────── */

export default function GeneralDefine() {
  const charData = useCharStore((s) => s.charData);
  const patchChar = useCharStore((s) => s.patchChar);

  const catalogue = useCatalogueStore((s) => s.classes);
  const loadClasses = useCatalogueStore((s) => s.loadClasses);
  const loadingClasses = useCatalogueStore((s) => s.loadingClasses);

  const [xpStep, setXpStep] = useState(100);

  const catalogueReady = catalogue && typeof catalogue === "object" && !Array.isArray(catalogue) && Object.keys(catalogue).length > 0;
  useEffect(() => {
    if (!catalogueReady && !loadingClasses) loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clicks and finished numbers save right away; typing saves a moment later.
  const write = (patch, immediate = true) => patchChar(patch, { now: immediate });

  if (!charData) return null;

  const cat = catalogueReady ? catalogue : {};
  const classes = asList(charData.classes);
  const pb = pbOf(charData);
  const totalLevel = totalLevelOf(classes);
  const hd = summarizeHitDice(classes, charData.hit_dice);
  const init = initiativeOf(charData);
  const speed = speedOf(charData);
  const senses = sensesOf(charData);
  const offense = offenseOf(charData);
  const xp = expOf(charData);
  const xpInfo = xpProgress(xp);

  /* classes */
  const writeClasses = (rows, immediate = true) => write(classPatch(charData, rows), immediate);
  const changeClass = (id, patch, immediate = true) =>
    writeClasses(
      classes.map((r) => (r.id === id ? withAutoDie(cat, { ...r, ...patch }) : r)),
      immediate
    );
  const addClass = () => writeClasses([...classes, newClassRow()]);
  const removeClass = (row) => {
    if (!window.confirm(`Remove ${row.class_name || "this class"}${row.level ? ` (level ${row.level})` : ""}?`)) return;
    writeClasses(classes.filter((r) => r.id !== row.id));
  };

  /* offense: totals are recomputed on every write */
  const writeOffense = (next) => write({ offense: offenseWithTotals(next, charData) });
  const patchAttack = (key, p) => writeOffense({ ...offense, [key]: { ...offense[key], ...p } });
  const patchSave = (key, p) => writeOffense({ ...offense, save_dcs: { ...offense.save_dcs, [key]: { ...offense.save_dcs[key], ...p } } });

  const classSummary = classes
    .filter((r) => r.class_name)
    .map((r) => `${catalogueKeyFor(cat, r.class_name) ? classDisplayName(cat, catalogueKeyFor(cat, r.class_name)) : r.class_name} ${toInt(r.level, 0)}`)
    .join(" / ");

  return (
    <ParchmentSheet>
      <datalist id="general-class-names">
        {Object.keys(cat).map((k) => (
          <option key={k} value={classDisplayName(cat, k)} />
        ))}
      </datalist>

      <Title
        after={
          <span className={`text-sm italic ${INK.faded}`}>
            level <span className={`not-italic font-semibold ${INK.ink}`}>{totalLevel}</span>
            {classSummary && <> · {classSummary}</>}
          </span>
        }
      >
        General
      </Title>

      {/* Classes */}
      <section className="mb-9">
        <Heading right={<InkButton onClick={addClass}>+ add a class</InkButton>}>Classes</Heading>
        {classes.length === 0 ? (
          <p className={`text-sm italic ${INK.faint}`}>No class yet.</p>
        ) : (
          <div className="space-y-7">
            {classes.map((row, i) => (
              <React.Fragment key={row.id}>
                {i > 0 && <div aria-hidden="true" className={`text-center text-xs ${INK.faint}`}>· · ·</div>}
                <ClassBlock
                  row={row}
                  catalogue={cat}
                  onChange={(p) => changeClass(row.id, p)}
                  onType={(p) => changeClass(row.id, p, false)}
                  onRemove={() => removeClass(row)}
                />
              </React.Fragment>
            ))}
          </div>
        )}
        {classes.length > 0 && (
          <p className={`mt-5 text-sm ${INK.faded}`}>
            <span className="italic">Total level</span> <span className={`font-semibold ${INK.ink}`}>{totalLevel}</span>
            {hitDiceLabel(hd) && (
              <>
                {"  ·  "}
                <span className="italic">hit dice</span> <span className={`font-semibold ${INK.ink}`}>{hitDiceLabel(hd)}</span>
              </>
            )}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-x-14 gap-y-9 @4xl:grid-cols-2">
        {/* Left column */}
        <div className="space-y-9">
          <section>
            <Heading>Vitals</Heading>
            <Line label="Armor Class">
              <InkNumber value={toInt(charData.ac, null)} min={0} max={40} placeholder="—" fallback={0} onChange={(v) => write({ ac: v ?? 0 })} aria-label="Armor class" className="h-7 w-12 text-[17px] font-semibold" />
            </Line>
            <Line label="Hit point maximum">
              <InkNumber
                value={toInt(charData.health?.max_hp, null)}
                min={0}
                placeholder="—"
                fallback={0}
                onChange={(v) => write({ health: { ...(charData.health || {}), max_hp: v ?? 0 } })}
                aria-label="Hit point maximum"
                className="h-7 w-14 text-[17px] font-semibold"
              />
            </Line>
            <Line label="Initiative" hint="Dexterity modifier plus any bonus">
              <Adj value={init.mod} onChange={(mod) => write({ initiative: { mod, total: init.total - init.mod + mod } })} label="Initiative bonus" />
              <Total>{signed(init.total)}</Total>
            </Line>
            <Line label="Proficiency bonus" hint={`From total level ${totalLevel}, plus any bonus`}>
              <Adj value={pb.modifier} onChange={(m) => write(classPatch(charData, classes, m))} label="Proficiency bonus modifier" />
              <Total>{signed(pb.total)}</Total>
            </Line>
          </section>

          <section>
            <Heading>Movement</Heading>
            {speedEntries(speed).map((type) => (
              <Line key={type} label={cap(type)}>
                {type === "fly" && (
                  <span className={`inline-flex items-center text-xs italic ${INK.faded}`}>
                    <Mark on={!!speed.hover} onClick={() => write({ speed: { ...speed, hover: !speed.hover } })} label="Hover" />
                    hover
                  </span>
                )}
                <InkNumber value={toInt(speed[type], null)} min={0} placeholder="—" fallback={0} onChange={(v) => write({ speed: { ...speed, [type]: v ?? 0 } })} aria-label={`${type} speed`} className="h-7 w-12 text-[15px]" />
                <span className={`text-xs ${INK.faded}`}>ft</span>
                {type !== "walk" ? <InkRemove onClick={() => write({ speed: withoutSpeed(speed, type) })} label={`Remove ${type}`} /> : <span className="w-5" />}
              </Line>
            ))}
            <AddLinks types={SPEED_TYPES} have={Object.keys(speed)} onAdd={(t) => write({ speed: withSpeed(speed, t) })} />
          </section>

          <section>
            <Heading>Senses</Heading>
            {senseEntries(senses).length === 0 && <p className={`text-sm italic ${INK.faint}`}>Only ordinary sight.</p>}
            {senseEntries(senses).map((type) => (
              <Line key={type} label={cap(type)}>
                {type === "darkvision" && (
                  <span className={`inline-flex items-center text-xs italic ${INK.faded}`}>
                    <Mark on={!!senses.devilsight} onClick={() => write({ senses: { ...senses, devilsight: !senses.devilsight } })} label="Devil's Sight" />
                    devil's sight
                  </span>
                )}
                <InkNumber value={toInt(senses[type], null)} min={0} placeholder="—" fallback={0} onChange={(v) => write({ senses: { ...senses, [type]: v ?? 0 } })} aria-label={`${type} range`} className="h-7 w-12 text-[15px]" />
                <span className={`text-xs ${INK.faded}`}>ft</span>
                <InkRemove onClick={() => write({ senses: withoutSense(senses, type) })} label={`Remove ${type}`} />
              </Line>
            ))}
            <AddLinks types={SENSE_TYPES} have={Object.keys(senses)} onAdd={(t) => write({ senses: withSense(senses, t) })} />
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-9">
          <section>
            <Heading>Offense</Heading>
            {ATTACKS.map((a) => {
              const row = offense[a.key];
              return (
                <Line key={a.key} label={a.label}>
                  <InkSelect value={row.base} onChange={(e) => patchAttack(a.key, { base: e.target.value })} aria-label={`${a.label} ability`} className="h-7 text-xs uppercase">
                    {ABILITIES.map((ab) => (
                      <option key={ab} value={ab}>
                        {ab.toUpperCase()}
                      </option>
                    ))}
                  </InkSelect>
                  <Adj value={row.mod} onChange={(mod) => patchAttack(a.key, { mod })} label={`${a.label} bonus`} />
                  <Total>{signed(attackTotal(charData, row))}</Total>
                </Line>
              );
            })}

            <div className={`mt-4 mb-1 flex items-baseline justify-between ${small}`}>
              <span>Save DCs</span>
              <span className="normal-case tracking-normal italic font-normal">◆ = shown in Play</span>
            </div>
            <div className="grid grid-cols-1 gap-x-8 @xl:grid-cols-2 @4xl:grid-cols-1 @6xl:grid-cols-2">
              {ABILITIES.map((ab) => {
                const key = `save_${ab}`;
                const row = offense.save_dcs[key];
                return (
                  <div key={key} className={`flex items-baseline py-0.5 ${row.active ? "" : "opacity-70"}`}>
                    <span className="self-center">
                      <Mark on={row.active} onClick={() => patchSave(key, { active: !row.active })} label={`Show ${ab.toUpperCase()} save DC in Play`} />
                    </span>
                    <span className="ml-1 text-[15px]">
                      <span className="uppercase">{ab}</span> <span className={`text-xs italic ${INK.faded}`}>save DC</span>
                    </span>
                    <Leader />
                    <span className="flex items-baseline gap-1.5">
                      <Adj value={row.mod} onChange={(mod) => patchSave(key, { mod })} label={`${ab} save DC bonus`} />
                      <Total strong={row.active}>{saveDcTotal(charData, row)}</Total>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <Heading>Experience</Heading>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <InkNumber value={xp} min={0} fallback={0} onChange={(v) => write({ exp: v ?? 0 })} aria-label="Experience points" className="h-9 w-28 text-2xl font-semibold" />
              <span className={`text-sm italic ${INK.faded}`}>xp</span>
              <span className="ml-auto inline-flex items-baseline gap-2 text-sm">
                <InkButton onClick={() => write({ exp: Math.max(0, xp - toInt(xpStep, 0)) })}>− </InkButton>
                <InkNumber value={toInt(xpStep, null)} min={0} fallback={0} onChange={(v) => setXpStep(v ?? 0)} aria-label="Experience step" className="h-7 w-14 text-[15px]" />
                <InkButton onClick={() => write({ exp: xp + toInt(xpStep, 0) })}> +</InkButton>
              </span>
            </div>
            <div className="mt-3 h-[3px] w-full bg-rule/20">
              <div className="h-full bg-rubric/75" style={{ width: `${Math.round(xpInfo.fraction * 100)}%` }} />
            </div>
            <p className={`mt-1.5 text-xs italic ${INK.faded}`}>
              {xpInfo.next ? (
                <>
                  {formatNumber(xp)} of {formatNumber(xpInfo.next)} for level {xpInfo.level + 1}
                  {xpInfo.level > totalLevel && <span className={INK.rubric}> — enough for level {xpInfo.level}</span>}
                </>
              ) : (
                "The highest level there is."
              )}
            </p>
          </section>
        </div>
      </div>
    </ParchmentSheet>
  );
}