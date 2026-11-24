import React, { useMemo } from "react";
import useCharStore from "../../../../store/CharStore";
import { SubSection, CardGrid, UseCard, Pips } from "./PlayParts";
import { actionDamage, partWords, regainWords } from "../../../../utils/featureRuntime";
import { asList, useSheet } from "../sheetHelpers";
import { CATEGORIES, featureRows, resourceRows, riderOptions, setFeatureFlag, setResourceUsed, setUsesUsed, weaponAttack } from "../featureHelpers";
import { labelFromId } from "../../../Catalogues/catalogueHelpers";
import { ORDINAL, pactRows, patchSpell, playsSpell, setPactUsed, setSlotUsed, setSpellOn, slotRows, spellRows } from "../spellbookHelpers";
import { chargesOf, inventoryOf, isConsumable, num, patchItem, regainText } from "../define/inventoryHelpers";

/* "Actions & Charges" in the Play panel (version-2 file).

   Layout, top to bottom:
   1. Spellcasting: spell slots and pact slots by level, and the pools no
      shown feature spends (a pool a feature spends shows on its card).
   2. Your turn: Actions (equipped weapons first) | Bonus Actions |
      Reactions, side by side when there is room, stacked at half width.
      Spells with free casts or at will sit here too, by casting time.
   3. Magic Items (with charges) and Consumables.
   4. Passives.

   One card per feature, with everything on it: its on/off diamond
   (Rage, Mage Armor), its dots (its own uses, or the pool it spends,
   shared with every other feature spending that pool), to hit, DC,
   damage. Click a card to use it, right-click to regain one; on dot
   tracks, click a filled dot to spend and an empty one to regain.

   Spent things are counts in `state` (and charges_used on an item):
   shown at once and saved by CharStore a moment later. Rests (Health)
   give them back. */

const KEY = (k) => `sheet.play.charges.${k}`;

// Section rows: stacked when the panel is narrow (half width), side by side once it is wide.
const WIDE_COLS = { 1: "", 2: "@5xl:grid-cols-2", 3: "@5xl:grid-cols-3" };
const sectionGrid = (n) => `grid grid-cols-1 items-start gap-x-8 gap-y-4 ${WIDE_COLS[Math.min(n, 3)] || ""}`;
const signed = (n) => `${n >= 0 ? "+" : ""}${n}`;

// "+7 to hit", "DEX DC 14", "60-foot cone" from a worked-out action.
function actionChips(a) {
  if (!a) return [];
  const chips = [];
  if (a.attack) {
    const b = a.attack.bonus;
    chips.push({ tone: "hit", text: typeof b === "number" ? `${signed(b)} to hit` : b ? `+${b} to hit` : "attack" });
  }
  if (a.save) chips.push({ tone: "save", text: `${String(a.save.ability || "").toUpperCase()} ${typeof a.save.dc === "number" ? `DC ${a.save.dc}` : "save"}` });
  if (a.range) chips.push({ tone: "plain", text: a.range });
  if (a.area) chips.push({ tone: "plain", text: a.area });
  return chips;
}
const damageText = (a) => (a ? actionDamage(a).map((p) => partWords(p)).filter(Boolean).join(" + ") : "");

/* Damage parts added up by type, for a card with riders attached:
   "1d6 + 7 bludgeoning + 2d10 + 1d8 thunder + 1d6 cold". A part that only
   applies sometimes (a condition) stays on its own. */
function sumByType(parts) {
  const out = [];
  const byType = {};
  for (const p of parts) {
    if (!p) continue;
    if (p.condition || (p.dice != null && typeof p.dice !== "string")) {
      out.push({ part: p });
      continue;
    }
    const t = p.type || "";
    if (!byType[t]) {
      byType[t] = { dice: [], bonus: 0, words: [], type: p.type || null };
      out.push(byType[t]);
    }
    const g = byType[t];
    if (p.dice) g.dice.push(p.dice);
    if (typeof p.bonus === "number") g.bonus += p.bonus;
    else if (p.bonus) g.words.push(p.bonus);
  }
  return out.map((g) => g.part || { dice: g.dice.join(" + ") || null, bonus: g.words.length ? [g.bonus || null, ...g.words].filter(Boolean).join(" + ") : g.bonus || null, type: g.type });
}
const partsText = (parts) => parts.map((p) => partWords(p)).filter(Boolean).join(" + ");
const riderLine = (o) => [partsText(o.damage), ...o.conditions.map(labelFromId)].filter(Boolean).join(", ");

/* The riders on a card, under it: "+ Boom ✕", and "+ rider" to attach one
   of the character's riders that fit (attacks, saves). Locked ones (a
   weapon's own riders) have no ✕. */
function RiderStrip({ options, attached, locked, onAttach, onDetach }) {
  if (!options.length) return null;
  const on = new Set(attached.map((o) => o.key));
  const free = options.filter((o) => !on.has(o.key));
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 pl-3 pt-0.5 text-[11px] italic text-ink-faded">
      {attached.map((o) => (
        <span key={o.key} className="inline-flex items-baseline gap-1" title={riderLine(o)}>
          + {o.name}
          {!locked?.has(o.key) && (
            <button type="button" onClick={() => onDetach(o)} className="not-italic text-ink-faint hover:text-bad" aria-label={`Take ${o.name} off`} title="Take it off">
              ✕
            </button>
          )}
        </span>
      ))}
      {free.length > 0 && (
        <select value="" onChange={(e) => { const o = free.find((x) => x.key === e.target.value); if (o) onAttach(o); }} aria-label="Add a rider"
                className="max-w-[11rem] cursor-pointer bg-transparent italic text-ink-faded underline decoration-dotted underline-offset-2 outline-none hover:text-rubric">
          <option value="">+ rider</option>
          {free.map((o) => <option key={o.key} value={o.key}>{o.name} ({riderLine(o)})</option>)}
        </select>
      )}
    </div>
  );
}
// A spell card's line: "1st-level enchantment · V, S, M" · "Evocation cantrip · V, S"
function spellMeta(sp) {
  const school = String(sp.school || "").toLowerCase();
  const level = sp.level ? `${ORDINAL[sp.level]}-level${school ? ` ${school}` : ""}` : `${school ? `${school[0].toUpperCase()}${school.slice(1)} ` : ""}cantrip`;
  const c = sp.components || {};
  const comps = [c.v && "V", c.s && "S", c.r && "R", c.m && "M"].filter(Boolean).join(", ");
  return [level, comps].filter(Boolean).join(" · ");
}

/* The riders that fit a card: on attacks, on saves, or both. A weapon's own
   riders (Frost Brand's cold, Flame Tongue's fire) only fit that weapon
   (`weapon`: its row id); a non-weapon item's (a ring, a poison) fit any. */
const ridersFitting = (all, { attack, save }, weaponIds, weapon = null) =>
  all.filter((o) => ((attack && o.on !== "saves") || (save && o.on !== "attacks")) && (!o.item || !weaponIds.has(o.item) || o.item === weapon));
const riderChips = (attached) => [...new Set(attached.flatMap((o) => o.conditions))].map((c) => ({ tone: "plain", text: labelFromId(c) }));

function Track({ label, cur, max, tone, onSpend, onRestore, note }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-dotted border-rule/35 py-1.5" title={note}>
      <span className={`min-w-[2.5rem] shrink-0 whitespace-nowrap text-sm font-semibold ${tone === "pact" ? "text-magic" : tone === "spell" ? "text-rubric" : "text-ink"}`}>{label}</span>
      {max <= 12 ? (
        <Pips cur={cur} max={max} tone={tone} size="lg" onSpend={onSpend} onRestore={onRestore} label={tone === "default" ? "use" : "slot"} />
      ) : (
        <span className="flex items-center gap-1">
          <button type="button" onClick={onSpend} disabled={cur <= 0} className="h-6 w-6 text-sm text-ink-faded hover:text-ink disabled:opacity-30" aria-label={`Spend one ${label}`}>
            −
          </button>
          <button type="button" onClick={onRestore} disabled={cur >= max} className="h-6 w-6 text-sm text-ink-faded hover:text-ink disabled:opacity-30" aria-label={`Regain one ${label}`}>
            +
          </button>
        </span>
      )}
      <span className="ml-auto pl-2 text-xs tabular-nums text-ink-faded">
        {cur}/{max}
      </span>
    </div>
  );
}

const poolNote = (p) =>
  p.reset === "short" ? "Back on a short rest" : typeof p.short_rest === "number" ? `${p.short_rest} back on a short rest, all on a long rest` : "Back on a long rest";

export default function ActionsCharges() {
  const { ch, d, patchChar } = useSheet();

  const features = useMemo(() => featureRows(ch, d), [ch, d]);
  const spells = useMemo(() => spellRows(ch, d), [ch, d]);
  if (!ch || !d) return null;

  // Always change the newest character (several quick clicks in a row).
  const latest = () => useCharStore.getState().charData || ch;
  const save = (makePatch) => patchChar(makePatch(latest()));

  const slots = slotRows(ch, d);
  const pacts = pactRows(ch, d);
  // An item with ◆ off (Inventory) has no cards here; equipped, it still counts.
  const inv = inventoryOf(ch);
  const inPlay = (it) => it.shown !== false;
  const hiddenItems = new Set(inv.items.filter((it) => !inPlay(it)).map((it) => `item:${it.id}`));
  // An item's own extra damage (Frost Brand's cold) shows on its weapon's card,
  // not as a card of its own (one with a switch keeps its card for the switch).
  // a rider has no card of its own: it's attached to the attack and save cards (below them)
  const shown = features.filter((r) => r.active && !hiddenItems.has(r.from) && !r.riderOnly && r.category !== "riders");
  const allRiders = riderOptions(features, spells);
  const weaponIds = new Set(inv.items.filter((it) => it.weapon).map((it) => it.id));
  // Weapons exported to Custom show as those attacks instead of their own card.
  const exported = new Set(features.filter((r) => r.linked?.item).map((r) => r.linked.item.id));
  const spentPools = new Set(shown.map((r) => r.consumes?.id).filter(Boolean));
  const loosePools = resourceRows(ch, d).filter((p) => p.max > 0 && !spentPools.has(p.id));
  const weapons = inv.items
    .filter((it) => inPlay(it) && it.equipped && it.weapon && !exported.has(it.id))
    .map((it) => ({ it, atk: weaponAttack(it, d) }))
    .filter((w) => w.atk);
  // Spells here: free casts (innate with casts per rest, at will) and any
  // prepared spell that can be switched on (Mage Armor, Shield, Bless).
  const freeSpells = spells.filter((r) => playsSpell(r) && r.inPlay);
  const charged = inv.items.filter((it) => inPlay(it) && chargesOf(it));
  const goods = inv.items.filter((it) => inPlay(it) && isConsumable(it));

  /* ---- one feature: everything on its card ---- */
  const featureCard = (r) => {
    const pool = r.consumes && !r.consumes.missing && !r.consumes.itemCharges ? r.consumes : null;
    const amount = pool?.amount || 1;
    const uses = r.uses ? { cur: r.uses.cur, max: r.uses.max } : pool ? { cur: pool.cur, max: pool.max } : null;
    const meta = [
      r.linked?.attack && !r.linked.attack.proficient ? "not proficient" : "",
      r.linked?.attack?.twoHanded ? "two-handed" : "",
      r.uses ? regainWords(r.feature.uses) : "",
      pool ? `${amount > 1 ? `${amount} ` : ""}${pool.name}` : "",
      // spends the item's charges: the player clicks the item's dots (Magic Items)
      r.consumes?.itemCharges ? `${r.consumes.amount} ${r.consumes.name}` : "",
      r.kind === "class" || r.kind === "race" || r.kind === "background" ? "" : r.owner,
    ]
      .filter(Boolean)
      .join(" · ");
    const spend = () => {
      if (r.uses) save((c) => setUsesUsed(c, r.key, r.uses.used + 1));
      else if (pool) save((c) => setResourceUsed(c, pool.id, Math.min(pool.max, pool.used + amount)));
    };
    const regain = () => {
      if (r.uses) save((c) => setUsesUsed(c, r.key, Math.max(0, r.uses.used - 1)));
      else if (pool) save((c) => setResourceUsed(c, pool.id, Math.max(0, pool.used - amount)));
    };
    // riders on its attack / save (not itself, not its weapon's own: those are in already)
    const a = r.action || {};
    const fits = ridersFitting(allRiders, { attack: !!a.attack && a.attack.kind !== "any", save: !!a.save }, weaponIds).filter(
      (o) => o.key !== r.key && (!r.linked?.item || o.item !== r.linked.item.id),
    );
    const attached = fits.filter((o) => r.riders.includes(o.key));
    const setRiders = (keys) => save((c) => setFeatureFlag(c, r.from, r.feature.id, "riders", keys.length ? keys : undefined));
    return (
      <div key={r.key}>
      <UseCard
        title={r.feature.name || "Unnamed"}
        meta={meta}
        chips={[...actionChips(r.action), ...riderChips(attached)]}
        detail={attached.length ? partsText(sumByType([...actionDamage(r.action), ...attached.flatMap((o) => o.damage)])) : damageText(r.action)}
        note={typeof r.feature.text === "string" ? r.feature.text.slice(0, 400) : ""}
        uses={uses}
        onSpend={uses ? spend : undefined}
        onRestore={uses ? regain : undefined}
        toggle={
          r.isToggle
            ? {
                on: r.on,
                // a switch that spends a use when it goes on (Rage, Wild Shape)
                onChange: (v) =>
                  save((c) => {
                    const flag = setFeatureFlag(c, r.from, r.feature.id, "on", v);
                    if (!v || !r.feature.toggle?.uses_charge || !r.uses || r.uses.cur < 1) return flag;
                    return { ...flag, ...setUsesUsed({ ...c, ...flag }, r.key, r.uses.used + 1) };
                  }),
              }
            : undefined
        }
      />
      <RiderStrip options={fits} attached={attached} onAttach={(o) => setRiders([...r.riders, o.key])} onDetach={(o) => setRiders(r.riders.filter((k) => k !== o.key))} />
      </div>
    );
  };

  /* A weapon's card. Its own riders (Frost Brand's cold) are on it already
     (locked); a switched one (Flame Tongue's fire) is attached by switching
     it on. Other riders are attached on the item row (`riders`). */
  const weaponCard = ({ it, atk }) => {
    const fits = ridersFitting(allRiders, { attack: true }, weaponIds, it.id);
    const own = fits.filter((o) => o.item === it.id);
    const locked = own.filter((o) => !o.toggle);
    const picked = asList(it.riders);
    const attached = [...locked, ...own.filter((o) => o.toggle && o.isOn), ...fits.filter((o) => o.item !== it.id && picked.includes(o.key))];
    const attach = (o) =>
      save((c) => (o.item === it.id ? setFeatureFlag(c, o.from, o.featureId, "on", true) : patchItem(c, it.id, { riders: [...picked, o.key] })));
    const detach = (o) =>
      save((c) => (o.item === it.id ? setFeatureFlag(c, o.from, o.featureId, "on", false) : patchItem(c, it.id, { riders: picked.filter((k) => k !== o.key) })));
    return (
      <div key={`w-${it.id}`}>
        <UseCard
          title={it.name}
          meta={[atk.range, atk.twoHanded ? "two-handed" : "", atk.ability ? `uses ${atk.ability.toUpperCase()}` : "", atk.proficient ? "" : "not proficient"].filter(Boolean).join(" · ")}
          chips={[{ tone: "hit", text: `${signed(atk.hit)} to hit` }, ...atk.mastery.map((m) => ({ tone: "plain", text: m })), ...riderChips(attached)]}
          detail={partsText(attached.length ? sumByType([...atk.damage, ...attached.flatMap((o) => o.damage)]) : atk.damage)}
          note={it.notes}
        />
        <RiderStrip options={fits} attached={attached} locked={new Set(locked.map((o) => o.key))} onAttach={attach} onDetach={detach} />
      </div>
    );
  };

  // A prepared or innate spell is cast with the lowest slot of its level or higher that's left.
  const slotFor = (r) => (r.mode !== "at_will" && r.mode !== "ritual" && r.level > 0 ? slots.find((x) => x.level >= r.level && x.cur > 0) || slots.find((x) => x.level >= r.level) || null : null);
  const spellCard = (r) => {
    const slot = r.uses ? null : slotFor(r);
    // riders on a spell that attacks or forces a save (Fire Bolt + Hex)
    const main = r.actions.find((a) => (a.action?.attack && a.action.attack.kind !== "any") || a.action?.save)?.action || null;
    const fits = main ? ridersFitting(allRiders, { attack: !!main.attack, save: !!main.save }, weaponIds).filter((o) => !o.key.startsWith(`${r.key}~`)) : [];
    const picked = asList(r.spell.riders);
    const attached = fits.filter((o) => picked.includes(o.key));
    const setRiders = (keys) => save((c) => patchSpell(c, r.from, r.spell.id, { riders: keys.length ? keys : undefined }));
    return (
      <div key={r.key}>
      <UseCard
        tone="spell"
        title={r.spell.name}
        meta={spellMeta(r.spell)}
        metaWrap
        chips={riderChips(attached)}
        detail={attached.length ? partsText(sumByType([...actionDamage(main), ...attached.flatMap((o) => o.damage)])) : r.actions.map((a) => damageText(a.action)).filter(Boolean)[0]}
        uses={r.uses ? { cur: r.uses.cur, max: r.uses.max } : slot ? { cur: slot.cur, max: slot.max } : null}
        onSpend={
          r.uses ? () => save((c) => setUsesUsed(c, r.key, r.uses.used + 1)) : slot ? () => save((c) => setSlotUsed(c, slot.level, Math.min(slot.max, slot.max - slot.cur + 1))) : undefined
        }
        onRestore={
          r.uses ? () => save((c) => setUsesUsed(c, r.key, Math.max(0, r.uses.used - 1))) : slot ? () => save((c) => setSlotUsed(c, slot.level, Math.max(0, slot.max - slot.cur - 1))) : undefined
        }
        toggle={r.isToggle ? { on: r.on, onChange: (v) => save((c) => setSpellOn(c, r.from, r.spell, v)) } : undefined}
      />
      <RiderStrip options={fits} attached={attached} onAttach={(o) => setRiders([...picked, o.key])} onDetach={(o) => setRiders(picked.filter((k) => k !== o.key))} />
      </div>
    );
  };

  const turn = CATEGORIES.filter((c) => c.value !== "traits" && c.value !== "riders")
    .map((c) => ({
      ...c,
      rows: shown.filter((r) => r.category === c.value),
      weapons: c.value === "actions" ? weapons : [],
      spells: freeSpells.filter((r) => r.category === c.value),
    }))
    .filter((g) => g.rows.length || g.weapons.length || g.spells.length);
  const passives = shown.filter((r) => r.category === "traits");
  const hasStrip = slots.length > 0 || pacts.length > 0 || loosePools.length > 0;
  const itemCount = [charged, goods].filter((l) => l.length > 0).length;

  if (!hasStrip && !turn.length && !passives.length && !itemCount) {
    return (
      <p className="text-sm italic text-ink-faded">
        Nothing to track yet. Spell slots, pools, features, equipped weapons, spells you cast for free, charged items and consumables show up here.
      </p>
    );
  }

  return (
    <div className="@container space-y-4">
      {/* 1. Spellcasting: slots, pact slots, pools no feature spends */}
      {hasStrip && (
        <SubSection title="Spellcasting" tone="spell" storageKey={KEY("resources")}>
          <div className="grid grid-cols-1 gap-x-6 @xl:grid-cols-2 @5xl:grid-cols-3">
            {slots.map((s) => (
              <Track
                key={`s${s.level}`}
                label={ORDINAL[s.level]}
                cur={s.cur}
                max={s.max}
                tone="spell"
                onSpend={() => save((c) => setSlotUsed(c, s.level, s.max - s.cur + 1))}
                onRestore={() => save((c) => setSlotUsed(c, s.level, s.max - s.cur - 1))}
              />
            ))}
            {pacts.map((p) => (
              <Track
                key={`p${p.level}`}
                label={`Pact ${ORDINAL[p.level]}`}
                cur={p.cur}
                max={p.max}
                tone="pact"
                note="Back on a short rest"
                onSpend={() => save((c) => setPactUsed(c, p.level, p.max - p.cur + 1))}
                onRestore={() => save((c) => setPactUsed(c, p.level, p.max - p.cur - 1))}
              />
            ))}
            {loosePools.map((p) => (
              <Track
                key={p.id}
                label={`${p.name}${p.die ? ` (${p.die})` : ""}`}
                cur={p.cur}
                max={p.max}
                tone="default"
                note={poolNote(p)}
                onSpend={() => save((c) => setResourceUsed(c, p.id, p.used + 1))}
                onRestore={() => save((c) => setResourceUsed(c, p.id, Math.max(0, p.used - 1)))}
              />
            ))}
          </div>
        </SubSection>
      )}

      {/* 2. Your turn */}
      {turn.length > 0 && (
        <div className={sectionGrid(turn.length)}>
          {turn.map((g) => (
            <SubSection key={g.value} title={g.title} count={g.rows.length + g.weapons.length + g.spells.length} storageKey={KEY(g.value)}>
              <CardGrid>
                {g.weapons.map(weaponCard)}
                {g.rows.map(featureCard)}
                {g.spells.map(spellCard)}
              </CardGrid>
            </SubSection>
          ))}
        </div>
      )}

      {/* 3. Items */}
      {itemCount > 0 && (
        <div className={sectionGrid(itemCount)}>
          {charged.length > 0 && (
            <SubSection title="Magic Items" tone="item" count={charged.length} storageKey={KEY("items")}>
              <CardGrid>
                {charged.map((it) => {
                  const c = chargesOf(it);
                  return (
                    <UseCard
                      key={it.id}
                      tone="item"
                      title={it.name || "Unnamed item"}
                      meta={regainText(c)}
                      chips={it.attuned ? [{ tone: "good", text: "Attuned" }] : []}
                      note={it.notes}
                      uses={{ cur: c.cur, max: c.max }}
                      onSpend={() => save((x) => patchItem(x, it.id, { charges_used: c.max - c.cur + 1 }))}
                      onRestore={() => save((x) => patchItem(x, it.id, { charges_used: Math.max(0, c.max - c.cur - 1) }))}
                    />
                  );
                })}
              </CardGrid>
            </SubSection>
          )}

          {goods.length > 0 && (
            <SubSection title="Consumables" tone="item" count={goods.length} storageKey={KEY("consumables")}>
              <CardGrid>
                {goods.map((it) => {
                  const qty = Math.max(0, Math.trunc(num(it.qty, 1)));
                  return (
                    <UseCard
                      key={it.id}
                      tone="item"
                      title={it.name || "Unnamed item"}
                      meta={qty > 0 ? "" : "None left"}
                      note={it.notes}
                      uses={{ cur: qty, max: null }}
                      onSpend={() => save((x) => patchItem(x, it.id, { qty: qty - 1 }))}
                      onRestore={() => save((x) => patchItem(x, it.id, { qty: qty + 1 }))}
                    />
                  );
                })}
              </CardGrid>
            </SubSection>
          )}
        </div>
      )}

      {/* 4. Passives */}
      {passives.length > 0 && (
        <SubSection title="Passives" tone="passive" count={passives.length} storageKey={KEY("passive")}>
          <CardGrid>{passives.map(featureCard)}</CardGrid>
        </SubSection>
      )}
    </div>
  );
}
