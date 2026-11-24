import React, { useEffect, useMemo, useState } from "react";
import useStoredState from "../../../utils/useStoredState";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import useAuthStore from "../../../store/AuthStore";
import { InkHeading } from "../../../styles/parchment";
import { Segmented, addBtn } from "../../../styles/parchmentForm";
import { ErrorLine, LoadingLine, chip } from "../catalogueStyle";
import { useEntryMenu } from "../catalogueParts";
import { buildNameIndex, byName, isHomebrew } from "../catalogueHelpers";
import ClassTraitsPanel from "./ClassTraitsPanel";
import ClassProgressionTable from "./ClassProgressionTable";
import ClassFeatureList, { SUBCLASS_TONES } from "./ClassFeatureList";
import ClassCreatePopup from "./ClassCreatePopup";
import SubclassCreatePopup from "./SubclassCreatePopup";

const EDITIONS = [
  { value: "one", label: "One" },
  { value: "classic", label: "Classic" },
];

// "Public" / "Private" for homebrew, the book otherwise.
const originTag = (e) => (isHomebrew(e) ? (e.visibility === "public" ? "public" : "private") : e.source);

/* The Classes catalogue: pick an edition and a class on the left (its
   traits underneath), and see its table and features on the right.
   Subclasses can be picked several at once to compare them: their
   features are woven into the list (or shown side by side), and "hide
   class features" leaves only theirs. Right-click a class or subclass
   for copy / edit / delete. */
export default function Classes() {
  const classes = useCatalogueStore((s) => s.classes);
  const subclasses = useCatalogueStore((s) => s.subclasses);
  const loading = useCatalogueStore((s) => s.loadingClasses);
  const error = useCatalogueStore((s) => s.classesError || s.subclassesError);
  const loadClasses = useCatalogueStore((s) => s.loadClasses);
  const loadSubclasses = useCatalogueStore((s) => s.loadSubclasses);
  const deleteClass = useCatalogueStore((s) => s.deleteClass);
  const deleteSubclass = useCatalogueStore((s) => s.deleteSubclass);
  const currentUser = useAuthStore((s) => s.userData?.name);

  const [edition, setEdition] = useStoredState("catalogue.classes.edition", "one");
  const [classId, setClassId] = useState(null);
  const [picked, setPicked] = useState([]); // subclass ids
  const [hideCore, setHideCore] = useStoredState("catalogue.classes.hideCore", false);
  const [sideBySide, setSideBySide] = useStoredState("catalogue.classes.sideBySide", false);
  const [classForm, setClassForm] = useState(null); // null = closed · {} new · { editing } · { copyFrom }
  const [subForm, setSubForm] = useState(null);

  useEffect(() => {
    if (!classes?.length) loadClasses();
    if (!subclasses?.length) loadSubclasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => (classes || []).filter((c) => (c.edition || "one") === edition).sort(byName), [classes, edition]);
  const cls = useMemo(() => shown.find((c) => c.id === classId) || shown[0] || null, [shown, classId]);
  const classSubs = useMemo(() => (subclasses || []).filter((s) => s.class_id === cls?.id).sort(byName), [subclasses, cls]);
  const pickedSubs = useMemo(() => picked.map((id) => classSubs.find((s) => s.id === id)).filter(Boolean), [picked, classSubs]);
  const index = useMemo(() => buildNameIndex(classes, subclasses), [classes, subclasses]);

  useEffect(() => {
    setPicked([]);
    setSideBySide(false);
  }, [cls?.id]);

  const [openClassMenu, classMenu] = useEntryMenu({
    user: currentUser,
    onCopy: (c) => setClassForm({ copyFrom: c }),
    onEdit: (c) => setClassForm({ editing: c }),
    onDelete: deleteClass,
  });
  const [openSubMenu, subMenu] = useEntryMenu({
    user: currentUser,
    onCopy: (s) => setSubForm({ copyFrom: s }),
    onEdit: (s) => setSubForm({ editing: s }),
    onDelete: deleteSubclass,
  });
  const context = (open) => (entry) => (e) => {
    e.preventDefault();
    open(e, entry);
  };

  const togglePick = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div>
      {loading && <LoadingLine>Fetching classes…</LoadingLine>}
      {error && <ErrorLine>{error}</ErrorLine>}

      {!loading && (
        <div className="grid w-full items-start gap-x-8 gap-y-6 lg:grid-cols-[15rem_1fr]">
          {/* ─── left: edition, classes, traits ─── */}
          <div className="flex flex-col gap-6 lg:border-r lg:border-rule/30 lg:pr-6">
            <section>
              <InkHeading>Edition</InkHeading>
              <Segmented options={EDITIONS} value={edition} onChange={setEdition} />
            </section>

            <section>
              <InkHeading right={<button type="button" onClick={() => setClassForm({})} className={`${addBtn} !text-xs`}>+ create</button>}>
                Class
              </InkHeading>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {shown.map((c) => (
                  <button key={`${c.id}-${c.visibility || ""}`} type="button" onClick={() => setClassId(c.id)} onContextMenu={context(openClassMenu)(c)}
                          aria-pressed={cls?.id === c.id} className={`${chip(cls?.id === c.id)} !text-sm`} title={originTag(c)}>
                    {c.name}
                    {isHomebrew(c) && <span className="ml-1 text-[9px] uppercase tracking-wider text-ink-faint">{originTag(c)}</span>}
                  </button>
                ))}
                {shown.length === 0 && <span className="text-sm italic text-ink-faded">No classes in this edition.</span>}
              </div>
            </section>

            <ClassTraitsPanel cls={cls} index={index} />
          </div>

          {/* ─── right: table, subclasses, features ─── */}
          <div className="flex min-w-0 flex-col gap-6 text-ink">
            <ClassProgressionTable cls={cls} subclasses={pickedSubs} />

            {cls && (
              <section>
                <InkHeading right={<button type="button" onClick={() => setSubForm({})} className={`${addBtn} !text-xs`}>+ create</button>}>
                  {cls.subclass?.title || "Subclass"}
                </InkHeading>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {classSubs.map((s) => {
                    const at = picked.indexOf(s.id);
                    return (
                      <button key={`${s.id}-${s.visibility || ""}`} type="button" onClick={() => togglePick(s.id)} onContextMenu={context(openSubMenu)(s)}
                              aria-pressed={at >= 0} className={`${chip(at >= 0)} !text-sm`}
                              title={`${s.name} · ${originTag(s)} — click to compare several`}>
                        <span className={at >= 0 ? SUBCLASS_TONES[at % SUBCLASS_TONES.length] : ""}>{s.short_name || s.name}</span>
                        {s.source !== cls.source && <span className="ml-1 text-[9px] uppercase tracking-wider text-ink-faint">{originTag(s)}</span>}
                      </button>
                    );
                  })}
                  {classSubs.length === 0 && <span className="text-sm italic text-ink-faded">No subclasses yet.</span>}
                </div>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
                  <button type="button" onClick={() => setPicked(classSubs.map((s) => s.id))} className="text-xs italic text-ink-faded hover:text-rubric">
                    pick all
                  </button>
                  <button type="button" onClick={() => setPicked([])} className="text-xs italic text-ink-faded hover:text-rubric">
                    pick none
                  </button>
                  <button type="button" onClick={() => setHideCore((v) => !v)} aria-pressed={hideCore} className={chip(hideCore)}
                          title="Show only the picked subclasses' features">
                    hide class features
                  </button>
                  {pickedSubs.length > 1 && (
                    <button type="button" onClick={() => setSideBySide((v) => !v)} aria-pressed={sideBySide} className={chip(sideBySide)}
                            title="One column per subclass, lined up by level">
                      side by side
                    </button>
                  )}
                </div>
              </section>
            )}

            <ClassFeatureList cls={cls} subclasses={pickedSubs} hideCore={hideCore} sideBySide={sideBySide && pickedSubs.length > 1} />
          </div>
        </div>
      )}

      {classMenu}
      {subMenu}

      <ClassCreatePopup open={classForm !== null} onClose={() => setClassForm(null)}
                        editingClass={classForm?.editing || null} copyFromClass={classForm?.copyFrom || null} />
      <SubclassCreatePopup open={subForm !== null} onClose={() => setSubForm(null)} forClass={cls}
                           editingSubclass={subForm?.editing || null} copyFromSubclass={subForm?.copyFrom || null} />
    </div>
  );
}
