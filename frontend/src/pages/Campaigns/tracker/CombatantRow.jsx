import React, { useState } from "react";
import { INK, InkButton, InkNumber, InkRemove, InkSelect, InkText, Leader, Mark } from "../../../styles/parchment";
import { Chevron, NumberInput, dangerBtn } from "../../../styles/parchmentForm";
import { CONDITIONS, acOf, healthWord, hpOf } from "./trackerLogic";

/* One line of the initiative order, and the controls that open under it.

   ◆ 17  Name  party ........ bloodied · HP 9/27 · AC 18  ⌄
              prone ✕ · concentrating on Bless · reaction used

   The square at the start selects the line (for saves and attacks on
   many at once — TrackerWindow); so does Ctrl/⌘- or Shift-click.

   The open part: damage / heal / temp HP, conditions, reaction,
   concentration, and taking them out of the fight. Clicking the name
   opens their statblock card; rolling again and resetting are on the
   right-click menu (TrackerWindow). */

const KIND_TAG = { party: "party", npc: "NPC", monster: "" };

function Controls({ c, onHp, onFight, onRemove }) {
  const [amount, setAmount] = useState(null);
  const f = c.fight;
  const apply = (how) => {
    if (!amount || amount <= 0) return;
    onHp(how, amount);
    setAmount(null);
  };
  return (
    <div className="mb-2 ml-[22px] mt-1 space-y-2 border-l-2 border-[#9a3412]/40 pl-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${INK.faded}`}>HP</span>
        <NumberInput
          value={amount}
          min={0}
          placeholder="—"
          onChange={setAmount}
          aria-label={`Amount for ${c.name}`}
          className="w-12"
        />
        <InkButton onClick={() => apply("damage")} title="Takes temporary HP first">
          damage
        </InkButton>
        <InkButton onClick={() => apply("heal")}>heal</InkButton>
        <InkButton onClick={() => apply("temp")} title="Temporary HP don't stack; the higher number stays">
          temp
        </InkButton>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${INK.faded}`}>Conditions</span>
        {f.conditions.map((k) => (
          <span key={k} className="inline-flex items-baseline capitalize">
            {k}
            <InkRemove onClick={() => onFight({ conditions: f.conditions.filter((x) => x !== k) })} label={`End ${k}`} />
          </span>
        ))}
        <InkSelect
          value=""
          onChange={(e) => e.target.value && onFight({ conditions: [...f.conditions, e.target.value] })}
          aria-label={`Add a condition to ${c.name}`}
          className="h-6 text-sm"
        >
          <option value="">+ condition…</option>
          {CONDITIONS.filter((k) => !f.conditions.includes(k)).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </InkSelect>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className={`flex items-center gap-1.5 italic ${f.reaction ? INK.rubric : INK.faded}`}>
          <Mark on={f.reaction} onClick={() => onFight({ reaction: !f.reaction })} label="Reaction used" />
          reaction used
        </span>
        <span className={`flex items-center gap-1.5 italic ${f.concentration != null ? INK.rubric : INK.faded}`}>
          <Mark on={f.concentration != null} onClick={() => onFight({ concentration: f.concentration != null ? null : "" })} label="Concentrating" />
          concentrating
          {f.concentration != null && (
            <InkText value={f.concentration} onChange={(e) => onFight({ concentration: e.target.value })} placeholder="on what?" aria-label="Concentrating on" className="h-6 w-32 text-sm" />
          )}
        </span>
        <button type="button" onClick={onRemove} className={`${dangerBtn} ml-auto`}>
          take out of the fight
        </button>
      </div>
    </div>
  );
}

export default function CombatantRow({ c, isTurn, tied, open, alert, onToggle, onOpenCard, onInitiative, onHp, onFight, onRemove, onMenu, selected = false, onSelect }) {
  const hp = hpOf(c);
  const word = healthWord(c);
  const ac = acOf(c);
  const f = c.fight;
  const out = word === "dead";

  const status = [
    ...f.conditions,
    f.concentration != null ? `concentrating${f.concentration ? ` on ${f.concentration}` : ""}` : "",
    f.reaction ? "reaction used" : "",
  ].filter(Boolean);

  return (
    <div
      className={`border-b border-[#7b6346]/15 last:border-b-0 ${out ? "opacity-50" : ""} ${selected ? "bg-[#9a3412]/[0.07]" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onMenu({ x: e.clientX, y: e.clientY, c });
      }}
    >
      <div
        className="group/row flex items-baseline gap-2 py-1.5"
        onClickCapture={(e) => {
          // Ctrl/⌘- or Shift-click anywhere on the line selects instead.
          if (!onSelect || !(e.ctrlKey || e.metaKey || e.shiftKey)) return;
          e.preventDefault();
          e.stopPropagation();
          onSelect(e);
        }}
      >
        {onSelect && (
          // A square tick box, so it isn't mistaken for the turn diamond next to it.
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={selected ? `Unselect ${c.name}` : `Select ${c.name}`}
            title={selected ? "Selected — click to unselect" : "Select (Shift-click: everyone in between)"}
            onClick={(e) => onSelect(e)}
            className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center self-center rounded-[2px] border text-[10px] leading-none transition ${
              selected ? "border-[#9a3412] bg-[#9a3412] text-[#efe4c8]" : "border-[#7b6346]/60 opacity-40 group-hover/row:opacity-100"
            }`}
          >
            {selected ? "✓" : ""}
          </button>
        )}
        <span className="self-center" title={isTurn ? "Their turn" : undefined}>
          <span className={`block h-2.5 w-2.5 rotate-45 border-[1.5px] ${isTurn ? "border-[#9a3412] bg-[#9a3412]" : "border-[#7b6346]/50"}`} />
        </span>
        <InkNumber value={f.initiative} onChange={onInitiative} placeholder="—" aria-label={`Initiative of ${c.name}`} className="h-7 w-10 text-lg" />
        <span className="flex min-w-0 items-baseline gap-1.5">
          <button
            type="button"
            onClick={onOpenCard}
            disabled={c.missing}
            className={`truncate text-left text-[17px] ${isTurn ? INK.rubric : ""} ${out ? "line-through" : ""} hover:underline hover:decoration-dotted hover:underline-offset-4`}
            title="Open their statblock card"
          >
            {c.name}
          </button>
          {KIND_TAG[c.kind] && <span className={`shrink-0 text-[10px] uppercase tracking-wider ${INK.faint}`}>{KIND_TAG[c.kind]}</span>}
          {tied && (
            <span className={`shrink-0 text-[10px] italic ${INK.faint}`} title="Same roll: higher DEX goes first, then party, NPCs, monsters">
              tie
            </span>
          )}
        </span>
        <Leader />
        <span className={`shrink-0 text-sm tabular-nums ${INK.faded}`}>
          {word && <span className={`mr-2 italic ${word === "bloodied" ? "" : INK.rubric}`}>{word}</span>}
          <span className={hp.cur <= 0 ? INK.rubric : "text-[#3a2716]"}>{hp.cur}</span>/{hp.max}
          {hp.temp > 0 && <span className="ml-1">+{hp.temp}</span>}
          {ac != null && <span className="ml-3">AC {ac}</span>}
        </span>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? "Hide controls" : "Show controls"} className="self-center">
          <Chevron open={open} />
        </button>
      </div>

      {(status.length > 0 || alert) && (
        <p className="-mt-1 pb-1.5 pl-[22px] text-xs italic">
          {status.length > 0 && <span className={INK.faded}>{status.join(" · ")}</span>}
          {alert && <span className={`${status.length ? "ml-3" : ""} ${INK.rubric}`}>{alert}</span>}
        </p>
      )}

      {open && <Controls c={c} onHp={onHp} onFight={onFight} onRemove={onRemove} />}
    </div>
  );
}