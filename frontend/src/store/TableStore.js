import { createRecordStore } from "./recordStore";

/* Tables to roll on (claude/tables-contract.md). Every table has a scope:
   "campaign" (only this campaign) or "all" (every campaign of yours);
   `fetch(campaignName)` brings both. See recordStore.js for the actions. */

const useTableStore = createRecordStore("http://localhost:8000/tables");

export default useTableStore;