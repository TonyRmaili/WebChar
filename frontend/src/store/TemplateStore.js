import { createRecordStore } from "./recordStore";

/* Templates (claude/templates-contract.md). Every template has a scope:
   "campaign" (only this campaign) or "all" (every campaign of yours);
   `fetch(campaignName)` brings both. See recordStore.js for the actions. */

const useTemplateStore = createRecordStore("http://localhost:8000/templates");

export default useTemplateStore;