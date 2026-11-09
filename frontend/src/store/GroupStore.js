import { createRecordStore } from "./recordStore";

/* Groups: saved packs of creatures for encounters (routers/groups.py).
   See recordStore.js for the actions. */

const useGroupStore = createRecordStore("http://localhost:8000/campaign/groups");

export default useGroupStore;