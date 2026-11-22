import React, { useEffect, useMemo, useState } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import { usePopupStore } from "../../../store/PopupStore";
import useAuthStore from "../../../store/AuthStore";
import FilterSection from "../FilterSection";
import FilterPopup, { FilterButton } from "../FilterPopup";

import { ErrorLine, LoadingLine, Toolbar, searchCls } from "../catalogueStyle";
import { CatalogueRow, ChipToggles, useEntryMenu } from "../catalogueParts";
import { addBtn } from "../../../styles/parchmentForm";
import {
  HOMEBREW, ABILITIES, ABILITY_SHORT, EDITIONS, formatEdition, formatSource, labelFromId, titleCase,
  collectUnique, toggleIn, matchesQuery, passesAny, byName, offeredAbilities, offeredKinds, GIVES_LABELS,
  offeredSenses, offeredSpeeds, offeredResistances,
} from "../catalogueHelpers";




/* The Races catalogue: a filterable list; a click opens the card, a
   right-click copies (and, for your own homebrew, edits or deletes).
   The filters offer only values the loaded races have, subraces included. */
export default function Rules() {
  const rules = useCatalogueStore((s) => s.rules);  
  const loading = useCatalogueStore((s) => s.loadingRules);
  const error = useCatalogueStore((s) => s.rulesError);
  const loadRules = useCatalogueStore((s) => s.loadRules);
  const deleteRules = useCatalogueStore((s) => s.deleteRules);


  const openPopup = usePopupStore((s) => s.open);
  const currentUser = useAuthStore((s) => s.userData?.name);

  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editions, setEditions] = useState(["one"]);
  const [sources, setSources] = useState([]);
 

  const [form, setForm] = useState(null); // null = closed · {} new · { editing } · { copyFrom }
  
  useEffect(() => {
    loadRules();
    
  }, [loadRules]);

  function checkRules(){
    console.log(rules)
  }

 
  const all = [ editions, sources ];
  const activeCount = all.reduce((n, l) => n + l.length, 0);

  return (
    <div className="min-h-[640px] w-full">
      {error && <ErrorLine>{error}</ErrorLine>}

      {loading ? (
        <LoadingLine>Fetching rules...</LoadingLine>
      ) : (
        <>
          <Toolbar
            
            search={<input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search rules…" className={searchCls} />}
            right={
              <>
                
                <button type="button" onClick={checkRules}>
                  + create
                </button>
              </>
            }
          />
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2 xl:grid-cols-3">
            {rules.map((r) => (
              <CatalogueRow key={`${r.id}-${r.visibility || ""}`} entry={r} 
                    onOpen={(x) => openPopup("rules", x)}         />
            ))}
          </div>

        
        </>
      )}
    </div>
  );
}
