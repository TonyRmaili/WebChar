import React, { useMemo } from "react";
import useCharStore from "../../../../store/CharStore";
import { SubSection, CardGrid, UseCard, Pips, Chip } from "./PlayParts";
import {
  ACTION_GROUPS,
  INNATE_RESET,
  asList,
  chargedMagicItems,
  consumables,
  effectChips,
  effectDamage,
  groupEffects,
  innateUses,
  ordinal,
  regainLabel,
  replaceById,
  slotUses,
  sortSlots,
  sorceryUses,
  spellComponents,
  spellMeta,
  usesFromCharges,
  withChargesCurrent,
} from "./playHelpers";

/* "Actions & Charges" in the Play panel.

   Layout, top to bottom:
   1. Spellcasting resources: slot levels, pact slots, sorcery points.
   2. Your turn: Actions | Bonus Actions | Reactions, side by side when
      there is room, stacked at half width.
   3. Everything else that has uses: innate spells, magic items,
      consumables, then passives.

   Every block collapses and remembers it. Click a card to use it,
   right-click to regain one; on dot tracks, click a filled dot to spend
   and an empty one to regain. */

const KEY = (k) => `sheet.play.charges.${k}`;

// Section rows: stacked when the panel is narrow (half width), side by
// side once it is wide. The column count follows how many sections there
// are, so two sections share the row instead of leaving an empty third.
// (Tailwind needs the full class names written out, hence the map.)
const WIDE_COLS = { 1: "", 2: "@5xl:grid-cols-2", 3: "@5xl:grid-cols-3" };
const sectionGrid = (n) => `grid grid-cols-1 items-start gap-3 ${WIDE_COLS[Math.min(n, 3)] || ""}`;

function SlotTrack({ label, uses, tone, onSpend, onRestore }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1.5">
      <span className={`min-w-[2.5rem] shrink-0 whitespace-nowrap text-xs font-semibold ${tone === "pact" ? "text-violet-300" : "text-amber-300"}`}>
        {label}
      </span>
      <Pips cur={uses.cur} max={uses.max} tone={tone} size="lg" onSpend={onSpend} onRestore={onRestore} label="slot" />
      <span className="ml-auto pl-2 text-[11px] tabular-nums text-slate-500">
        {uses.cur}/{uses.max}
      </span>
    </div>
  );
}

export default function ActionsCharges() {
  const charData = useCharStore((s) => s.charData);
  const updateCharField = useCharStore((s) => s.updateCharField);
  const postCharData = useCharStore((s) => s.postCharData);

  const effects = charData?.effects;
  // Feats are stored like effect rows (Feats tab), so they show up in the
  // same groups.
  const feats = charData?.feats;
  const spellbook = charData?.spellbook;
  const inventory = charData?.inventory;

  const featRows = useMemo(() => asList(feats), [feats]);
  const featIds = useMemo(() => new Set(featRows.map((f) => f.id)), [featRows]);
  const groups = useMemo(() => groupEffects([...asList(effects), ...featRows]), [effects, featRows]);
  const slots = useMemo(() => sortSlots(spellbook?.spellslots), [spellbook?.spellslots]);
  const pact = useMemo(() => sortSlots(spellbook?.pactslots), [spellbook?.pactslots]);
  const innate = useMemo(
    () =>
      asList(spellbook?.spells)
        .filter(innateUses)
        .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || String(a.name).localeCompare(String(b.name))),
    [spellbook?.spells]
  );
  const items = useMemo(() => chargedMagicItems(inventory), [inventory]);
  const goods = useMemo(() => consumables(inventory), [inventory]);

  if (!charData) return null;

  const save = (field, value) => {
    updateCharField(field, value);
    postCharData();
  };

  /* ---- writers ---- */

  // A row is saved back to whichever list it came from.
  const setEffectUses = (effect, value) =>
    featIds.has(effect.id)
      ? save("feats", replaceById(feats, effect.id, withChargesCurrent(effect, value)))
      : save("effects", replaceById(effects, effect.id, withChargesCurrent(effect, value)));

  const setSlot = (listKey, row, value) =>
    save("spellbook", {
      ...spellbook,
      [listKey]: replaceById(spellbook[listKey], row.id, { ...row, slots_current: value }),
    });

  const setInnate = (spell, value) =>
    save("spellbook", {
      ...spellbook,
      spells: replaceById(spellbook.spells, spell.id, { ...spell, uses: { ...spell.uses, current: value } }),
    });

  const setSorcery = (value) =>
    save("spellbook", { ...spellbook, sorcery_points: { ...spellbook.sorcery_points, current_charges: value } });

  const setItemUses = (item, value) =>
    save("inventory", { ...inventory, magic: replaceById(inventory.magic, item.id, withChargesCurrent(item, value)) });

  const setAmount = (item, value) =>
    save("inventory", { ...inventory, mundane: replaceById(inventory.mundane, item.id, { ...item, amount: value }) });

  /* ---- blocks ---- */

  const sorcery = sorceryUses(spellbook?.sorcery_points);
  const metamagic = asList(spellbook?.metamagic).map((m) => m?.name).filter(Boolean);
  const hasResources = slots.length > 0 || pact.length > 0 || !!sorcery;

  const effectCard = (e) => {
    const uses = usesFromCharges(e.charges);
    return (
      <UseCard
        key={e.id}
        title={e.name || "Unnamed effect"}
        meta={uses ? regainLabel(e.charges?.reset_amount, uses.max) : ""}
        chips={effectChips(charData, e)}
        detail={effectDamage(charData, e)}
        note={e.notes}
        uses={uses}
        onSpend={() => setEffectUses(e, uses.cur - 1)}
        onRestore={() => setEffectUses(e, uses.cur + 1)}
      />
    );
  };

  const otherCount = [innate, items, goods].filter((l) => l.length > 0).length;
  const turnGroups = ACTION_GROUPS.filter((g) => g.key !== "passive" && groups[g.key].length > 0);
  const passives = groups.passive;

  const nothing =
    !hasResources && turnGroups.length === 0 && passives.length === 0 && !innate.length && !items.length && !goods.length;

  if (nothing) {
    return (
      <p className="rounded-xl border border-dashed border-slate-700 px-4 py-3 text-sm text-slate-500">
        Nothing to track yet. Active effects and feats, spell slots, limited spells and charged items from the Define tabs show up
        here.
      </p>
    );
  }

  return (
    <div className="@container space-y-3">
      {/* 1. Spellcasting resources */}
      {hasResources && (
        <SubSection title="Spellcasting" tone="spell" storageKey={KEY("resources")}>
          <div className="grid grid-cols-1 gap-1.5 @xl:grid-cols-2 @5xl:grid-cols-3">
            {slots.map((r) => {
              const u = slotUses(r);
              return (
                <SlotTrack
                  key={r.id || `s${r.level}`}
                  label={ordinal(r.level)}
                  uses={u}
                  tone="spell"
                  onSpend={() => setSlot("spellslots", r, u.cur - 1)}
                  onRestore={() => setSlot("spellslots", r, u.cur + 1)}
                />
              );
            })}
            {pact.map((r) => {
              const u = slotUses(r);
              return (
                <SlotTrack
                  key={r.id || `p${r.level}`}
                  label={`Pact ${ordinal(r.level)}`}
                  uses={u}
                  tone="pact"
                  onSpend={() => setSlot("pactslots", r, u.cur - 1)}
                  onRestore={() => setSlot("pactslots", r, u.cur + 1)}
                />
              );
            })}
          </div>

          {sorcery && (
            <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-semibold text-amber-300">Sorcery Points</span>
                <Pips
                  cur={sorcery.cur}
                  max={sorcery.max}
                  tone="spell"
                  onSpend={() => setSorcery(sorcery.cur - 1)}
                  onRestore={() => setSorcery(sorcery.cur + 1)}
                  label="sorcery point"
                />
                <span className="ml-auto text-[11px] tabular-nums text-slate-500">
                  {sorcery.cur}/{sorcery.max}
                </span>
              </div>
              {metamagic.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {metamagic.map((n) => (
                    <Chip key={n} tone="comp">
                      {n}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          )}
        </SubSection>
      )}

      {/* 2. Your turn */}
      {turnGroups.length > 0 && (
        <div className={sectionGrid(turnGroups.length)}>
          {turnGroups.map((g) => (
            <SubSection key={g.key} title={g.title} count={groups[g.key].length} storageKey={KEY(g.key)}>
              <CardGrid>{groups[g.key].map(effectCard)}</CardGrid>
            </SubSection>
          ))}
        </div>
      )}

      {/* 3. Limited spells, items, passives */}
      {otherCount > 0 && (
        <div className={sectionGrid(otherCount)}>
          {innate.length > 0 && (
            <SubSection title="Innate Spells" tone="spell" count={innate.length} storageKey={KEY("innate")}>
              <CardGrid>
                {innate.map((s) => {
                  const u = innateUses(s);
                  return (
                    <UseCard
                      key={s.id}
                      tone="spell"
                      title={s.name || "Innate spell"}
                      meta={[spellMeta(s), INNATE_RESET[s.uses?.reset]].filter(Boolean).join(" · ")}
                      chips={spellComponents(s).map((c) => ({ tone: "comp", text: c }))}
                      uses={u}
                      onSpend={() => setInnate(s, u.cur - 1)}
                      onRestore={() => setInnate(s, u.cur + 1)}
                    />
                  );
                })}
              </CardGrid>
            </SubSection>
          )}

          {items.length > 0 && (
            <SubSection title="Magic Items" tone="item" count={items.length} storageKey={KEY("items")}>
              <CardGrid>
                {items.map((it) => {
                  const u = usesFromCharges(it.charges);
                  return (
                    <UseCard
                      key={it.id}
                      tone="item"
                      title={it.name || "Unnamed item"}
                      meta={regainLabel(it.charges?.reset_amount, u.max)}
                      chips={it.attuned ? [{ tone: "good", text: "Attuned" }] : []}
                      note={it.notes}
                      uses={u}
                      onSpend={() => setItemUses(it, u.cur - 1)}
                      onRestore={() => setItemUses(it, u.cur + 1)}
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
                  const amount = Math.max(0, Math.trunc(Number(it.amount) || 0));
                  return (
                    <UseCard
                      key={it.id}
                      tone="item"
                      title={it.name || "Unnamed item"}
                      meta={amount > 0 ? "" : "None left"}
                      note={it.notes}
                      uses={{ cur: amount, max: null }}
                      onSpend={() => setAmount(it, amount - 1)}
                      onRestore={() => setAmount(it, amount + 1)}
                    />
                  );
                })}
              </CardGrid>
            </SubSection>
          )}
        </div>
      )}

      {passives.length > 0 && (
        <SubSection title="Passives" tone="passive" count={passives.length} storageKey={KEY("passive")}>
          <CardGrid>{passives.map(effectCard)}</CardGrid>
        </SubSection>
      )}
    </div>
  );
}