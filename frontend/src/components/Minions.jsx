import React, { useMemo, useRef, useState, useCallback } from "react";
import useCharStore from "../store/CharStore";
import useMonsterStore from "../store/MonsterStore";

const buttonStyle = "px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-amber-500"
const inputTextStyle = "border border-slate-600 bg-slate-800 text-slate-100 px-2 py-1 rounded"
const inputNumberStyle = "w-20 border border-slate-600 bg-slate-800 text-slate-100 px-2 py-1 rounded"

function MinionRow({ index }) {
  return (
    <div className="flex gap-2 my-2">
      <input
        type="text"
        placeholder={`Minion ${index + 1} name`}
        className={inputTextStyle}
      />
      <input
        type="number"
        placeholder="HP"
        className={inputNumberStyle}
      />
    </div>
  );
}


function Minions() {
	const charData = useCharStore((s) => s.charData);
	const updateCharField = useCharStore((s) => s.updateCharField)
	const postCharData = useCharStore((s) => s.postCharData)

	const createMinion = useMonsterStore((s) => s.createMinion)
	const fetchMinions = useMonsterStore((s) => s.fetchMinions)

	const [rows, setRows] = useState([]);

	const handleAddRow = () => {
    setRows((prev) => [...prev, {}]); // adds an empty monster row
  };

	async function onCreateMonster(){
		const monsterPayload = {
			name : "snake",
			hp : "15"
		}
		
		const filepath = await createMinion(monsterPayload, charData.name) 
		console.log("Created:", filepath);

		const existing = Array.isArray(charData?.minions)
			? charData.minions
			: [];

		updateCharField("minions", [...existing, filepath]);
		await postCharData()
	}

	async function onFetchMinions(){
		await fetchMinions(charData.name)
	}

	return (
    <div className="p-4">
      <button
        onClick={handleAddRow}
        className={buttonStyle}
      >
        Create Minion
      </button>

      <button
        onClick={onFetchMinions}
        className={buttonStyle}
      >
        fetch Minions
      </button>

      <div className="mt-4">
        {rows.map((_, i) => (
          <MinionRow key={i} index={i} />
        ))}
      </div>
    </div>
  );
	
 
}
export default Minions;
