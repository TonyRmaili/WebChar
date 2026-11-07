import React from "react";
import { INK, InkButton } from "../../../styles/parchment";
import { Field, inputCls } from "../../../styles/parchmentForm";
import { EffectEditor, SOURCES } from "../../Characters/sheet/define/effectEditor";

/* The editor that opens under a character's trait or action on the
   statblock card: the same effect editor as the Effects define tab.
   Feats taken from the catalogue keep their name and source. */

export default function CharacterRowEditor({ entry, row, onPatch, onReplace, onRemove, onDone, onView }) {
  const isFeat = entry.ref.list === "feats";
  const fromCatalogue = isFeat && !!row.source;
  return (
    <EffectEditor
      row={row}
      onPatch={onPatch}
      onReplace={onReplace}
      onRemove={onRemove}
      onDuplicate={null}
      onDone={onDone}
      notesLabel="Text"
      nameField={
        fromCatalogue ? (
          <Field label="Feat">
            <p className="flex items-baseline gap-3 pb-1 text-[17px]">
              {row.name}
              <InkButton onClick={() => onView("feat", { name: row.name, source: row.source })}>read its card</InkButton>
            </p>
          </Field>
        ) : undefined
      }
      sourceField={
        isFeat ? (
          <Field label="From">
            <p className="pb-1 text-[15px]">{row.source ? `${row.source} · feat` : <span className={`italic ${INK.faded}`}>written by hand</span>}</p>
          </Field>
        ) : (
          <Field label="Source">
            <select value={row.trait || "standard"} onChange={(e) => onPatch({ trait: e.target.value })} className={`${inputCls} cursor-pointer`}>
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        )
      }
    />
  );
}