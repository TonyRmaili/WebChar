function AbilityScoreCard({
  ability,
  row,
  onValueChange,
  onCheckModChange,
  onSaveModChange,
  onToggle,
  pb,
}) {
  const score = row?.score ?? "";
  const label = row?.label ?? ability;

  const proficient = !!row?.proficient;
  const expertise = !!row?.expertise;

  const computedMod =
    Number.isFinite(Number(score)) ? Math.floor((Number(score) - 10) / 2) : null;
  const mod = Number.isFinite(row?.mod) ? row.mod : computedMod;

  const checkMod = Number.isFinite(row?.check_mod) ? row.check_mod : 0;
  const saveMod = Number.isFinite(row?.save_mod) ? row.save_mod : 0;

  const pbBonus = expertise
    ? 2 * Number(pb || 0)
    : proficient
    ? Number(pb || 0)
    : 0;

  const checkDisplay = (mod ?? 0) + checkMod;
  const saveDisplay = (mod ?? 0) + pbBonus + saveMod;
  const modStr = mod == null ? "—" : mod >= 0 ? `+${mod}` : `${mod}`;

  const normInt = (v) => {
    if (v === "" || v === null || v === undefined) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const baseBox =
    "h-8 text-center rounded-md border text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500";
  const inputBox = `${baseBox} bg-slate-900 border-slate-600 text-slate-100`;
  const totalPrimary =
    "bg-slate-950 border-amber-500 text-amber-200 font-semibold";
  const totalSecondary =
    "bg-slate-950 border-sky-500 text-sky-200 font-semibold";

  return (
    <div className="bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-2 w-full text-[11px]">
      {/* TOP ROW: Label → Score → Mod */}
      <div className="flex items-center gap-2 mb-1">
        <span className="flex-1 text-amber-300 font-semibold uppercase tracking-wide">
          {label}
        </span>

        <input
          type="number"
          value={score}
          onChange={(e) =>
            onValueChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          onWheel={(e) => e.currentTarget.blur()}
          inputMode="numeric"
          min={0}
          max={30}
          className={`${inputBox} w-12 font-bold`}
          title="Ability Score"
        />

        <input
          readOnly
          value={modStr}
          className={`${baseBox} ${totalPrimary} w-10`}
          title="Ability Modifier"
        />
      </div>

      {/* MIDDLE ROW: Check → Check total → Check mod */}
      <div className="flex items-center gap-2 mb-1">
        <span className="w-10 text-slate-400 uppercase text-[10px]">
          Check
        </span>

        <input
          readOnly
          value={checkDisplay}
          title="Total = Mod + Check Mod"
          className={`${baseBox} ${totalSecondary} w-12`}
        />

        <span className="text-[10px] text-slate-500">±</span>

        <input
          type="number"
          value={checkMod}
          onChange={(e) => onCheckModChange(normInt(e.target.value))}
          onWheel={(e) => e.currentTarget.blur()}
          className={`${inputBox} w-12`}
          placeholder="0"
          title="Check Mod (manual adj.)"
        />
      </div>

      {/* BOTTOM ROW: Save → Save total → Save mod → Prof → Exp */}
      <div className="flex items-center gap-2">
        <span className="w-10 text-slate-400 uppercase text-[10px]">
          Save
        </span>

        <input
          readOnly
          value={saveDisplay}
          title="Total = Mod + PB/Expertise + Save Mod"
          className={`${baseBox} ${totalSecondary} w-12`}
        />

        <span className="text-[10px] text-slate-500">±</span>

        <input
          type="number"
          value={saveMod}
          onChange={(e) => onSaveModChange(normInt(e.target.value))}
          onWheel={(e) => e.currentTarget.blur()}
          className={`${inputBox} w-12`}
          placeholder="0"
          title="Save Mod (manual adj.)"
        />

        {/* Prof / Exp – kept small so they stay on same row */}
        <button
          type="button"
          onClick={() => onToggle("proficient")}
          className={`px-2 py-1 rounded-full border text-[10px] leading-none ml-1 ${
            proficient
              ? "border-amber-500 bg-amber-500/20 text-amber-200"
              : "border-slate-600 bg-slate-900 text-slate-200"
          }`}
          title="Proficiency in this save"
        >
          Prof
        </button>

        <button
          type="button"
          onClick={() => onToggle("expertise")}
          className={`px-2 py-1 rounded-full border text-[10px] leading-none ${
            expertise
              ? "border-amber-500 bg-amber-500/20 text-amber-200"
              : "border-slate-600 bg-slate-900 text-slate-200"
          }`}
          title="Expertise in this save"
        >
          Exp
        </button>
      </div>
    </div>
  );
}

export default AbilityScoreCard;
