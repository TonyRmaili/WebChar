import React from "react";

function SkillCard({
  skill,
  row,
  governingMod = 0,           
  onOffsetChange,              
  onToggleProficient,
  onToggleExpertise,
  pb = 0,
}) {
  const label = row?.label ?? skill;
  const proficient = !!row?.proficient;
  const expertise  = !!row?.expertise;

  // Treat stored "value" as this skill's manual offset
  const offset = row?.value === "" ? 0 : Number(row?.value ?? 0);
  const safeMod = Number.isFinite(governingMod) ? governingMod : 0;
  const pbBonus = expertise ? 2 * Number(pb || 0) : (proficient ? Number(pb || 0) : 0);
  const total   = safeMod + offset + pbBonus;

  // const pill = "min-w-10 px-2 h-7 inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-100 text-sm font-semibold";
  // const box  = "h-8 w-16 text-center rounded-md bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600";
  const chk  = "h-4 w-4 accent-orange-500";

  const pill = "min-w-9 px-2 h-7 inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-100 text-xs font-semibold";
  const box  = "h-8 w-14 text-center rounded-md bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-600";

  return (
    <div className="py-2 flex items-center justify-between gap-3">
      <label className="font-medium text-slate-100 truncate" htmlFor={`${skill}-offset`}>
        {label}
      </label>

      <div className="flex items-center gap-3">
        {/* Total */}
        <span className={pill} title={`= ability mod (${safeMod}) + offset (${offset}) + PB (${pbBonus})`}>
          {total >= 0 ? `+${total}` : total}
        </span>

        {/* Offset input */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-400">±</span>
          <input
            type="number"
            id={`${skill}-offset`}
            value={row?.value ?? 0}
            onChange={(e) => {
              const v = e.target.value === "" ? "" : Number(e.target.value);
              if (v === "" || Number.isFinite(v)) onOffsetChange(v);
            }}
            onWheel={(e) => e.currentTarget.blur()}
            className={box}
            inputMode="numeric"
            title="Skill offset"
          />
        </div>

        {/* Proficiency */}
        <label className="inline-flex items-center gap-1 cursor-pointer select-none text-sm text-slate-200">
          <input type="checkbox" checked={proficient} onChange={onToggleProficient} className={chk} />
          <span className="hidden sm:inline">Prof.</span>
        </label>

        {/* Expertise */}
        <label className="inline-flex items-center gap-1 cursor-pointer select-none text-sm text-slate-200">
          <input type="checkbox" checked={expertise} onChange={onToggleExpertise} className={chk} />
          <span className="hidden sm:inline">Exp.</span>
        </label>
      </div>
    </div>
  );
}

export default SkillCard;
