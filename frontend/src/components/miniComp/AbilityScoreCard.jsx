function AbilityScoreCard({
  ability,
  row,
  onValueChange,
  onCheckModChange,
  onSaveModChange,
  onToggle,
  pb,
}) {
  const value = row?.value ?? "";
  const label = row?.label ?? ability;

  const proficient = !!row?.proficient;
  const expertise  = !!row?.expertise;

  const computedMod =
    Number.isFinite(Number(value)) ? Math.floor((Number(value) - 10) / 2) : null;
  const mod = Number.isFinite(row?.mod) ? row.mod : computedMod;

  const checkMod = Number.isFinite(row?.check_mod) ? row.check_mod : 0;
  const saveMod  = Number.isFinite(row?.save_mod)  ? row.save_mod  : 0;

  const pbBonus = expertise ? 2 * Number(pb || 0) : (proficient ? Number(pb || 0) : 0);

  const checkDisplay = (mod ?? 0) + checkMod;
  const saveDisplay  = (mod ?? 0) + pbBonus + saveMod;

  const modStr = mod == null ? "—" : mod >= 0 ? `+${mod}` : `${mod}`;

  const normInt = (v) => {
    if (v === "" || v === null || v === undefined) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const box = "h-9 w-full max-w-16 text-center font-bold rounded-md bg-slate-800 border border-slate-600 text-slate-100";

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 w-full min-w-[190px]">
      <div className="mb-2 text-center text-amber-200 text-xs uppercase tracking-wide">
        {label}
      </div>

      {/* Top grid: Score | Mod | Check */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
        {/* Score */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-slate-400 text-[10px] uppercase">Score</span>
          <input
            type="number"
            value={value}
            onChange={(e) =>
              onValueChange(e.target.value === "" ? "" : Number(e.target.value))
            }
            onWheel={(e) => e.currentTarget.blur()}
            inputMode="numeric"
            min={0}
            max={30}
            className={`${box} font-extrabold text-lg`}
          />
        </div>

        {/* Mod */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-slate-400 text-[10px] uppercase">Mod</span>
          <input readOnly value={modStr} className={box} />
        </div>

        {/* Check total + offset (stacked) */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-slate-400 text-[10px] uppercase">Check</span>
          <input
            readOnly
            value={checkDisplay}
            title="Total = Mod + Check Mod"
            className={`${box} max-w-14`}
          />
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[10px] text-slate-500">±</span>
            <input
              type="number"
              aria-label="Check Mod"
              value={checkMod}
              onChange={(e) => onCheckModChange(normInt(e.target.value))}
              onWheel={(e) => e.currentTarget.blur()}
              className={`${box} max-w-14`}
              placeholder="0"
              title="Check Mod (manual adjustment)"
            />
          </div>
        </div>
      </div>

      {/* Bottom grid: Save | Prof | Exp */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3 text-center">
        {/* Save total + offset (stacked) */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-slate-400 text-[10px] uppercase">Save</span>
          <input
            readOnly
            value={saveDisplay}
            title="Total = Mod + PB/Expertise + Save Mod"
            className={`${box} max-w-16`}
          />
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[10px] text-slate-500">±</span>
            <input
              type="number"
              aria-label="Save Mod"
              value={saveMod}
              onChange={(e) => onSaveModChange(normInt(e.target.value))}
              onWheel={(e) => e.currentTarget.blur()}
              className={`${box} max-w-14`}
              placeholder="0"
              title="Save Mod (manual adjustment)"
            />
          </div>
        </div>

        {/* Prof */}
        <label className="flex flex-col items-center justify-center gap-1 text-xs text-slate-300">
          <span className="text-slate-400 text-[10px] uppercase">Prof.</span>
          <input
            type="checkbox"
            checked={proficient}
            onChange={() => onToggle("proficient")}
            className="h-4 w-4 accent-amber-400"
          />
        </label>

        {/* Exp */}
        <label className="flex flex-col items-center justify-center gap-1 text-xs text-slate-300">
          <span className="text-slate-400 text-[10px] uppercase">Exp.</span>
          <input
            type="checkbox"
            checked={expertise}
            onChange={() => onToggle("expertise")}
            className="h-4 w-4 accent-amber-400"
          />
        </label>
      </div>
    </div>
  );
}

export default AbilityScoreCard;
