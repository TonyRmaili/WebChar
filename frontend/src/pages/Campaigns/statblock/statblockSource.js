import useCampaignStore, { copiesKey } from "../../../store/CampaignStore";
import useEncounterStore from "../../../store/EncounterStore";
import useTemplateStore from "../../../store/TemplateStore";

/* Where a statblock card's creature lives, and how it is saved.

   Window data says which one:
     { kind: "party" | "npc" | "monster", campaignName, file }
         a campaign copy (the party, NPCs, the monster shelf)
     { kind: "encounter", campaignName, encounterId, monsterId }
         a monster inside one encounter (each encounter has its own)
     { kind: "template", campaignName, templateId }
         a template (this campaign's or one for all campaigns)

   useStatblockSource(data) → {
     raw,                      the creature, or undefined until loaded
     load(),                   fetch it → { ok, message } (missing → not ok)
     save(next, { now }),      → { ok, message }; `now: false` lets an
                               encounter wait a moment before writing
   } */

const asList = (v) => (Array.isArray(v) ? v : []);
const MISSING = { ok: false, message: "it isn't in this campaign any more" };

const encounterMonster = (state, d) =>
  asList(asList(state.encounters[d.campaignName]).find((e) => e.id === d.encounterId)?.monsters).find((m) => m.id === d.monsterId);

export function useStatblockSource(d) {
  const inEncounter = d.kind === "encounter";
  const isTemplate = d.kind === "template";

  // Every store is always asked (hooks can't be skipped); only one answers.
  const copy = useCampaignStore((s) => (inEncounter || isTemplate ? undefined : asList(s.campaignCharacters[copiesKey(d.campaignName, d.kind)]).find((c) => c.file === d.file)));
  const monster = useEncounterStore((s) => (inEncounter ? encounterMonster(s, d) : undefined));
  const template = useTemplateStore((s) => (isTemplate ? asList(s.records[d.campaignName]).find((t) => t.id === d.templateId) : undefined));

  if (isTemplate) {
    return {
      raw: template,
      load: async () => {
        const res = await useTemplateStore.getState().fetch(d.campaignName);
        if (!res.ok) return res;
        return asList(useTemplateStore.getState().records[d.campaignName]).some((t) => t.id === d.templateId) ? { ok: true } : { ok: false, message: "that template is gone" };
      },
      save: async (next) => {
        const store = useTemplateStore.getState();
        store.update(d.campaignName, d.templateId, () => next);
        return store.flush(d.campaignName, d.templateId);
      },
    };
  }

  if (inEncounter) {
    return {
      raw: monster,
      load: async () => {
        const res = await useEncounterStore.getState().fetchEncounters(d.campaignName);
        if (!res.ok) return res;
        return encounterMonster(useEncounterStore.getState(), d) ? { ok: true } : { ok: false, message: "it isn't in that encounter any more" };
      },
      save: async (next, { now = true } = {}) => {
        const store = useEncounterStore.getState();
        store.update(d.campaignName, d.encounterId, (e) => ({ ...e, monsters: asList(e.monsters).map((m) => (m.id === d.monsterId ? next : m)) }));
        return now ? store.flush(d.campaignName, d.encounterId) : { ok: true };
      },
    };
  }

  return {
    raw: copy?.data,
    load: async () => {
      const res = await useCampaignStore.getState().fetchCampaignCharacters(d.campaignName, d.kind);
      if (!res.ok) return res;
      const found = asList(useCampaignStore.getState().campaignCharacters[copiesKey(d.campaignName, d.kind)]).some((c) => c.file === d.file);
      return found ? { ok: true } : MISSING;
    },
    save: (next) => useCampaignStore.getState().saveCampaignCharacter(d.campaignName, d.kind, d.file, next),
  };
}