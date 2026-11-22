import React, { useMemo, useState } from "react";
import { InkHeading } from "../../../styles/parchment";
import { RichText } from "../catalogueParts";
import { describeConsumes, describeFeature } from "../catalogueHelpers";
import { childrenOf, topFeatures } from "./classHelpers";

// Each picked subclass gets its own ink, so its features are told apart.
export const SUBCLASS_TONES = ["text-rubric", "text-info", "text-good", "text-bad", "text-ink-faded"];

/* The class's features and the picked subclasses' features, in level
   order (5etools-style: every picked subclass is woven in, each tagged in
   its own ink). Every feature folds open and shut; "open all" / "close
   all" do them together. A subclass starts with its own description.

   hideCore: only the subclasses' features.
   sideBySide (two or more subclasses): one column per subclass, lined up
   by level, to compare them; class features are left out. */
export default function ClassFeatureList({ cls, subclasses = [], hideCore = false, sideBySide = false }) {
  const [closed, setClosed] = useState(() => new Set());

  const entries = useMemo(() => {
    if (!cls) return [];
    const out = [];
    if (!hideCore && !sideBySide) {
      const kids = childrenOf(cls);
      for (const f of topFeatures(cls)) out.push({ key: `${cls.id}|${f.id}`, owner: cls.id, level: f.level, feature: f, kids: kids[f.id] || [], order: 0 });
    }
    subclasses.forEach((sc, i) => {
      const kids = childrenOf(sc);
      const tag = { name: sc.short_name || sc.name, tone: SUBCLASS_TONES[i % SUBCLASS_TONES.length], index: i };
      const firstLevel = topFeatures(sc)[0]?.level ?? cls.subclass?.level ?? 3;
      out.push({ key: `${sc.id}|intro`, owner: sc.id, level: Math.min(cls.subclass?.level ?? firstLevel, firstLevel), intro: sc, tag, kids: [], order: 1 });
      for (const f of topFeatures(sc)) out.push({ key: `${sc.id}|${f.id}`, owner: sc.id, level: f.level, feature: f, kids: kids[f.id] || [], tag, order: 2 });
    });
    return out.sort((a, b) => a.level - b.level || (a.tag?.index ?? -1) - (b.tag?.index ?? -1) || a.order - b.order);
  }, [cls, subclasses, hideCore, sideBySide]);

  if (!cls) return null;
  const allKeys = entries.flatMap((e) => [e.key, ...e.kids.map((k) => `${e.key}|${k.id}`)]);
  const toggle = (key) =>
    setClosed((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const openAll = () => setClosed(new Set());
  const closeAll = () => setClosed(new Set(allKeys));

  const heading = hideCore || sideBySide ? "Subclass Features" : subclasses.length ? "Class & Subclass Features" : "Class Features";
  const controls = (
    <span className="flex gap-3 text-xs italic text-ink-faded">
      <button type="button" onClick={openAll} className="hover:text-rubric">open all</button>
      <button type="button" onClick={closeAll} className="hover:text-rubric">close all</button>
    </span>
  );

  if (sideBySide && subclasses.length > 1) {
    const levels = [...new Set(entries.map((e) => e.level))].sort((a, b) => a - b);
    return (
      <section>
        <InkHeading right={controls}>{heading}</InkHeading>
        <div className="overflow-x-auto">
          <div className="grid min-w-[40rem] gap-x-6" style={{ gridTemplateColumns: `repeat(${subclasses.length}, minmax(0, 1fr))` }}>
            {subclasses.map((sc, i) => (
              <div key={sc.id} className={`border-b border-rule/40 pb-1 text-sm font-semibold ${SUBCLASS_TONES[i % SUBCLASS_TONES.length]}`}>
                {sc.name}
              </div>
            ))}
            {levels.map((level) =>
              subclasses.map((sc) => (
                <div key={`${level}-${sc.id}`} className="border-b border-dotted border-rule/30 py-2">
                  {entries
                    .filter((e) => e.level === level && e.owner === sc.id)
                    .map((e) => (
                      <Entry key={e.key} entry={e} closed={closed} onToggle={toggle} compact />
                    ))}
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    );
  }

  if (!entries.length) {
    return (
      <section>
        <InkHeading>{heading}</InkHeading>
        <p className="text-sm italic text-ink-faded">{hideCore ? "Pick a subclass to see its features." : "No features."}</p>
      </section>
    );
  }

  return (
    <section>
      <InkHeading right={controls}>{heading}</InkHeading>
      <div className="flex flex-col">
        {entries.map((e) => <Entry key={e.key} entry={e} closed={closed} onToggle={toggle} />)}
      </div>
    </section>
  );
}

function Entry({ entry: e, closed, onToggle, compact = false }) {
  const open = !closed.has(e.key);
  if (e.intro) {
    return (
      <Card open={open} onToggle={() => onToggle(e.key)} level={e.level} name={e.intro.name} tag={compact ? null : { ...e.tag, name: "subclass" }} compact={compact}>
        {e.intro.text ? <RichText text={e.intro.text} className="!text-sm" /> : <p className="text-sm italic text-ink-faded">No description.</p>}
      </Card>
    );
  }
  const f = e.feature;
  return (
    <Card open={open} onToggle={() => onToggle(e.key)} level={f.level} name={f.name} tag={e.tag} feature={f} compact={compact}>
      {f.text ? <RichText text={f.text} className="!text-sm" /> : null}
      {e.kids.length > 0 && (
        <div className="mt-2 space-y-1 border-l border-rule/30 pl-3">
          {e.kids.map((k) => (
            <Card key={k.id} open={!closed.has(`${e.key}|${k.id}`)} onToggle={() => onToggle(`${e.key}|${k.id}`)} name={k.name} feature={k} nested>
              {k.text ? <RichText text={k.text} className="!text-sm" /> : null}
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
}

// One feature: ▶ level · name · tags, and its text when open.
function Card({ open, onToggle, level, name, tag, feature, nested = false, compact = false, children }) {
  const words = feature ? [...describeFeature(feature), feature.consumes ? `costs ${describeConsumes(feature.consumes)}` : ""].filter(Boolean) : [];
  return (
    <div className={nested ? "py-1" : `border-b border-dotted border-rule/30 ${compact ? "py-1" : "py-2.5"} last:border-b-0`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="group flex w-full items-baseline gap-2 text-left">
        <span className={`inline-block text-[9px] text-ink-faded transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        {level != null && <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-rubric">Level {level}</span>}
        <span className={`${nested ? "text-sm" : "text-base"} font-semibold text-ink group-hover:text-rubric`}>{name}</span>
        {tag && <span className={`text-[10px] font-semibold uppercase tracking-wider ${tag.tone}`}>{tag.name}</span>}
        {feature?.optional && <span className="text-[10px] uppercase tracking-wider text-ink-faded">optional</span>}
        {!open && words.length > 0 && <span className="min-w-0 truncate text-xs italic text-ink-faded">{words.join(" · ")}</span>}
      </button>
      {open && (
        <div className={`mt-1 ${nested ? "pl-4" : "pl-5"}`}>
          {words.length > 0 && <p className="mb-1 text-xs italic text-ink-faded">{words.join(" · ")}</p>}
          {children}
        </div>
      )}
    </div>
  );
}
