import useMonsterStore from "../store/MonsterStore";
import useCharStore from "../store/CharStore";

export default function MinionPopup({ item, onClose, onDragStart }) {
  if (!item) return null;

  const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
  const modFrom = (score) => Math.floor((toInt(score) - 10) / 2);
  const saveFrom = (score, prof, exp, pb) => modFrom(score) + (exp ? 2 * pb : prof ? pb : 0);
  const toInt = (v) => {const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : 0;};
  
  const updateMinion = useMonsterStore((s) => s.updateMinion);
  const fetchMinions = useMonsterStore((s) => s.fetchMinions);
  const charData = useCharStore((s) => s.charData)
  
  function formatCamel(text) {
  if (!text) return "";

  // Insert spaces before capital letters
  const spaced = text.replace(/([A-Z])/g, " $1");

  // Capitalize first letter
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}


  function onChangeHp(e) {
    const newValue = Number(e.target.value) || 0;

  
    const updated = {
    ...item,
    max_hp: newValue,
  };

    // Call your API-backed updater
    updateMinion(updated, charData.name);
    fetchMinions(charData.name)
  }

  function AbilityScoreLabels({ abilityKey, abilityObj, showHeaders }){
    const mod = modFrom(abilityObj.score)
    const save = saveFrom(abilityObj.score,abilityObj.proficient,abilityObj.expertise,item.pb)
    return(
      <>
      <div className="flex">
        <div className={`${showHeaders ? "mt-4" : "mt-0"} ${showHeaders ? "bg-zinc-200": "bg-slate-100"}  w-20 h-6 text-sm font-semibold flex justify-end px-1 items-center `}>
          <div className="flex gap-2">
            <p>{abilityKey}</p>
            <p>{abilityObj.score}</p>
          </div>
        </div>
        <div>
          {showHeaders && (
            <div className="flex text-xs justify-between font-light px-1">
              <p>Mod</p>
              <p>Save</p>
            </div>
          )}
          <div className={`${showHeaders ? "bg-red-200": "bg-stone-200"} w-16 h-6 text-sm font-semibold px-2 items-center`}>
            <div className="flex justify-between ">
              <p>{fmt(mod)}</p>
              <p>{fmt(save)}</p>
            </div>
          </div>
        </div>
      </div>
      </>

    )
  }

  function EffectsRender({ title, effects}){

    return(
      <div>
        <header className="border-b-2 border-red-900 font-semibold text-lg text-red-900">
          {title}
        </header>
        <div className="flex flex-col text-sm gap-1 mt-1">
        {effects?.map((effect) => (
          <div>
            <span className="italic font-bold">{effect.name}.</span> {effect.notes}
          </div>
        ))}
      </div>
      </div>
    )
  }


  return (
    <div className="bg-amber-200 text-slate-100 p-4">
      <header
        className="flex items-center justify-between mb-4 border-b-4 border-red-900 pb-2 cursor-move text-black"
        onMouseDown={onDragStart}
      >
        <span className="text-2xl font-semibold text-red-900">{item.name}</span>
        <button
          onClick={onClose}
          className="px-2 py-1 rounded border border-slate-600 hover:bg-slate-800"
        >
          Close
        </button>
      </header>

      <section className="text-black flex flex-col gap-2">
        <div className="italic" >
          {item.size} {`(`}
          {item.monster_types?.join(", ")}
          {`)`}, {item.alignment}
        </div>
        <div>
          <div className="flex justify-between">
            <p>
              <span className="font-semibold">AC</span> {item.ac ?? "Unknown"}
            </p>
            <p>
              <span className="font-semibold">Initiative</span> {item.initiative ?? 0} ({item.initiative+10 ?? 10})
            </p>
          </div>
          <p>
            <span className="font-semibold">HP</span> {item.max_hp ?? "Unknown"}
          </p>
          <p>
            <span className="font-semibold">Speed </span> 
            {item.speed?.map((s) => `${s.type} ${s.value} ft`).join(", ")}
          </p>
          
            <div className="flex flex-col mt-2">
              {[0, 1].map((rowIndex) => (
                <div key={rowIndex} className="flex gap-2">
                  {Object.entries(item.ability_scores).slice(rowIndex * 3, rowIndex * 3 + 3).map(([key, obj]) => (
                    <AbilityScoreLabels
                      key={key}
                      abilityKey={key}
                      abilityObj={obj}
                      showHeaders={rowIndex === 0}   // only first row shows headers
                    />
                  ))}
                </div>
              ))}
            </div>
            <p>
              <span className="font-semibold">Resistances </span> 
               {item.resistances?.join(", ")}
            </p>
            <p>
              <span className="font-semibold">Immunities </span> 
               {item.immunities?.join(", ")}
            </p>
            <p>
              <span className="font-semibold">Skills </span> 
               {item.skills?.map(formatCamel).join(", ")}
            </p>
            <p>
              <span className="font-semibold">Languages </span> 
               {item.languages?.join(", ")}
            </p>
            <p>
              <span className="font-semibold">CR</span> {item.cr}
            </p>


            {item.traits?.length > 0 && (
              <EffectsRender title="Traits" effects={item.traits} />
            )}

            {item.actions?.length > 0 && (
              <EffectsRender title="Actions" effects={item.actions} />
            )}

            {item.bonus_actions?.length > 0 && (
              <EffectsRender title="Bonus Actions" effects={item.bonus_actions} />
            )}

            {item.reactions?.length > 0 && (
              <EffectsRender title="Reactions" effects={item.reactions} />
            )}

            {item.legendary_actions?.length > 0 && (
              <EffectsRender title="Legendary Actions" effects={item.legendary_actions} />
            )}

            {item.mythic_actions?.length > 0 && (
              <EffectsRender title="Mythic Actions" effects={item.mythic_actions} />
            )}

            {item.actions?.regional_effects > 0 && (
              <EffectsRender title="Regional Effects" effects={item.regional_effects} />
            )}


        </div>

        {/* <input
          type="number"
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-100"
          value={item.max_hp}
          onChange={onChangeHp}
        /> */}
      </section>
    </div>
  );
}
