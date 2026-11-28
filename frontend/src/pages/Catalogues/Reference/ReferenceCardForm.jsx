import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { CreateModal, PartPopup, fieldCls, labelCls } from "../catalogueStyle";
import { EDITION_OPTIONS, EntryPicker, Segmented, VISIBILITY_OPTIONS } from "../catalogueParts";
import { buildNameIndex } from "../catalogueHelpers";
import { AddRow, CardText, StatLine } from "../cardParts";
import { KINDS, REFERENCE_CATALOGUES, emptyReferenceForm, fieldWords, formToReference, kindLabel, kindsOf, referenceToForm } from "./referenceHelpers";

/* ═══════════════════════════════════════════════════════════════════
   ReferenceCardForm — the form of a Rules, Lore or Toolkit entry
   (2026-11-25), a card like the other catalogues' (../cardParts):

     start     what it is (Action, Condition… / Deity, Language… / Trap,
               Object…), or a copy of one from the book
     header    the name, typed on the card · the line under it (its type)
               opens a window
     lines     its type's own fields (a deity's pantheon, domains…): each a
               line opening the "Details" window; "+ details" when empty
     text      typed on the card (**Name.** text starts a named part)
     footer    edition · visibility

   `catalogue`: "rules" | "lore" | "toolkit". Saves through the store's
   create<Rules|Lore|Toolkit> / update….
   ═══════════════════════════════════════════════════════════════════ */

const WINDOWS = {
  kind: { title: "Type", hint: "What kind of entry it is. Each type has its own details (a deity's pantheon, a trap's tier)." },
  details: { title: "Details", hint: "The lines under the name on its card; the catalogue's filters use them. Several words: a comma between them." },
  more: { title: "Edition & visibility", hint: "Which rules it's for, and who can see it." },
};

function FieldInput({ field, value, onChange }) {
  const id = `ref-field-${field.key}`;
  return (
    <label className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className={`${labelCls} !mb-0 w-32 shrink-0`}>{field.label}</span>
      <input id={id} type={field.type === "number" ? "number" : "text"} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
             list={field.options ? `${id}-options` : undefined} aria-label={field.label}
             placeholder={field.type === "list" ? "a, b, c" : field.options ? field.options.slice(0, 3).join(" · ") : ""}
             className={`${fieldCls} min-w-[10rem] flex-1`} />
      {field.options && (
        <datalist id={`${id}-options`}>
          {field.options.map((o) => <option key={o} value={o} />)}
        </datalist>
      )}
    </label>
  );
}

export default function ReferenceCardForm({ catalogue, open, onClose, editingEntry = null, copyFromEntry = null }) {
  const meta = REFERENCE_CATALOGUES[catalogue];
  const entries = useCatalogueStore((s) => s[catalogue]);
  const create = useCatalogueStore((s) => s[`create${meta.store}`]);
  const update = useCatalogueStore((s) => s[`update${meta.store}`]);
  const saving = useCatalogueStore((s) => s[`saving${meta.store}`]);
  const saveError = useCatalogueStore((s) => s[`${catalogue}Error`]);

  const [form, setForm] = useState(() => emptyReferenceForm(kindsOf(catalogue)[0]));
  const [started, setStarted] = useState(false);
  const [win, setWin] = useState(null);
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const src = editingEntry || copyFromEntry;
    setForm(src ? referenceToForm(src, { copy: !editingEntry }) : emptyReferenceForm(kindsOf(catalogue)[0]));
    setStarted(!!src);
    setWin(null);
    setNameError(false);
  }, [open, editingEntry?.id, copyFromEntry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickIndex = useMemo(() => buildNameIndex(entries), [entries]);

  if (!open) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setField = (key, value) => setForm((f) => ({ ...f, fields: { ...f.fields, [key]: value } }));
  const isEditing = !!editingEntry;
  const fields = KINDS[form.kind]?.fields || [];
  const lines = fields.map((f) => ({ field: f, words: fieldWords(f, form.fields[f.key]) })).filter((l) => l.words);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setNameError(true);
      return;
    }
    const record = formToReference(form, isEditing ? editingEntry : null);
    try {
      if (isEditing) await update(editingEntry.id, record);
      else await create(record);
      onClose();
    } catch {
      /* the error is shown in the footer */
    }
  };

  const title = `${isEditing ? "Edit" : copyFromEntry ? "Copy" : "New"} ${meta.one}`;
  const winInfo = win ? WINDOWS[win] : null;

  return (
    <CreateModal open={open} title={title} onClose={onClose} onSave={handleSave} saving={saving}
                 saveLabel={isEditing ? "Save Changes" : "Save"} saveDisabled={!started} error={saveError} width="max-w-2xl">
      {!started ? (
        <div className="space-y-4">
          <p className="text-sm italic text-ink-faded">What is it?</p>
          <div className="flex flex-wrap gap-2">
            {kindsOf(catalogue).map((k) => (
              <button key={k} type="button" onClick={() => { setForm(emptyReferenceForm(k)); setStarted(true); }}
                      className="rounded-sm border border-rule/40 px-3 py-1.5 text-[15px] text-ink transition hover:border-rubric/60 hover:bg-rubric/5">
                {kindLabel(k)}
              </button>
            ))}
          </div>
          <div>
            <div className={labelCls}>…or a copy of one from the book</div>
            <EntryPicker entries={entries || []} index={pickIndex} selected={[]} placeholder={meta.search}
                         onToggle={(id) => {
                           const e = (entries || []).find((x) => x.id === id);
                           if (!e) return;
                           setForm(referenceToForm(e, { copy: true }));
                           setStarted(true);
                         }} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* header: the name, and its type under it */}
          <div className="border-b border-rule/40 pb-1">
            <input type="text" value={form.name} onChange={(e) => { set("name", e.target.value); setNameError(false); }} placeholder="Name"
                   aria-label="Name" autoFocus={!form.name}
                   className={`w-full bg-transparent text-xl font-bold tracking-wide text-ink outline-none placeholder:font-normal placeholder:italic placeholder:text-ink-faint ${nameError ? "border-b border-bad" : ""}`} />
            {nameError && <p className="text-xs italic text-bad">It needs a name.</p>}
            <button type="button" onClick={() => setWin("kind")} className="text-left text-sm italic text-ink-faded hover:text-rubric" title="Its type">
              {kindLabel(form.kind)}
            </button>
          </div>

          {/* its type's own lines */}
          {lines.length > 0 && (
            <div className="space-y-0.5 border-b border-rule/30 pb-2">
              {lines.map((l) => <StatLine key={l.field.key} label={l.field.label} value={l.words} onClick={() => setWin("details")} />)}
            </div>
          )}
          {fields.length > 0 && lines.length < fields.length && (
            <AddRow items={[{ label: lines.length ? "more details" : "details", hint: fields.map((f) => f.label).join(", "), onClick: () => setWin("details") }]} />
          )}

          {/* the text */}
          <CardText value={form.text} onChange={(v) => set("text", v)} placeholder="What it is and what it does… (**Name.** text starts a named part.)" />

          {/* footer */}
          <div className="flex flex-wrap items-baseline gap-x-3 border-t border-rule/25 pt-1.5 text-xs italic text-ink-faded">
            <button type="button" onClick={() => setWin("more")} className="text-left hover:text-rubric" title="Edition, who can see it">
              {[form.edition === "classic" ? "Classic (2014)" : "One (2024)", form.visibility === "public" ? "public" : "private"].join(" · ")}
            </button>
          </div>
        </div>
      )}

      {winInfo && (
        <PartPopup title={winInfo.title} hint={winInfo.hint} onClose={() => setWin(null)}>
          {win === "kind" && (
            <div className="flex flex-wrap gap-2">
              {kindsOf(catalogue).map((k) => (
                <button key={k} type="button" onClick={() => set("kind", k)}
                        className={`rounded-sm border px-2.5 py-1 text-sm transition ${form.kind === k ? "border-rubric/60 bg-rubric/10 text-rubric" : "border-rule/40 text-ink hover:border-rubric/40"}`}>
                  {kindLabel(k)}
                </button>
              ))}
            </div>
          )}
          {win === "details" && (
            <div className="space-y-2">
              {fields.map((f) => <FieldInput key={f.key} field={f} value={form.fields[f.key]} onChange={(v) => setField(f.key, v)} />)}
            </div>
          )}
          {win === "more" && (
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              <div>
                <div className={labelCls}>Edition</div>
                <Segmented size="sm" options={EDITION_OPTIONS} value={form.edition} onChange={(v) => set("edition", v)} />
              </div>
              <div>
                <div className={labelCls}>Visibility</div>
                <Segmented size="sm" options={VISIBILITY_OPTIONS} value={form.visibility} onChange={(v) => set("visibility", v)} />
              </div>
            </div>
          )}
        </PartPopup>
      )}
    </CreateModal>
  );
}
