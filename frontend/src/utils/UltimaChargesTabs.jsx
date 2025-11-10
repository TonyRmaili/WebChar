import React, { useEffect, useMemo, useCallback } from "react";
import EffectsPlay from "./EffectsPlay";
import SpellPlay from "./SpellPlay";
import InventoryPlay from "./InventoryPlay";


export default function UltimaCharges() {
  return(

    <div>
      <EffectsPlay />
      <SpellPlay />
      <InventoryPlay />     
    </div>
  )
         
}
