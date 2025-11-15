
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
  const expertise = !!row?.expertise;

  const offset = row?.value === "" ? 0 : Number(row?.value ?? 0);
  const safeMod = Number.isFinite(governingMod) ? governingMod : 0;
  const pbBonus = expertise
    ? 2 * Number(pb || 0)
    : proficient
    ? Number(pb || 0)
    : 0;
  const total = safeMod + offset + pbBonus;

  const normInt = (v) => {
    if (v === "" || v === null || v === undefined) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const baseBox =
    "h-8 text-center rounded-md border text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-500";
  const inputBox = `${baseBox} bg-slate-900 border-slate-600 text-slate-100`;
  const totalHighlight =
    "bg-slate-950 border-amber-500 text-amber-200 font-semibold";

  return (
    <div className="flex items-center justify-between gap-2 py-2 px-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-amber-600/40 transition-colors">
      {/* Label */}
      <label
        className="flex-1 text-amber-300 font-medium truncate"
        htmlFor={`${skill}-offset`}
      >
        {label}
      </label>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Total */}
        <input
          readOnly
          value={total >= 0 ? `+${total}` : total}
          title={`= Ability (${safeMod}) + Offset (${offset}) + PB (${pbBonus})`}
          className={`${baseBox} ${totalHighlight} w-12 text-center`}
        />

        {/* Offset */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500">±</span>
          <input
            type="number"
            id={`${skill}-offset`}
            value={offset}
            onChange={(e) => onOffsetChange(normInt(e.target.value))}
            onWheel={(e) => e.currentTarget.blur()}
            className={`${inputBox} w-12`}
            placeholder="0"
            title="Skill offset (manual adj.)"
          />
        </div>

        {/* Prof */}
        <button
          type="button"
          onClick={onToggleProficient}
          className={`px-2 py-1 rounded-full border text-[10px] leading-none ${
            proficient
              ? "border-amber-500 bg-amber-500/20 text-amber-200"
              : "border-slate-600 bg-slate-900 text-slate-200"
          }`}
          title="Proficiency"
        >
          Prof
        </button>

        {/* Exp */}
        <button
          type="button"
          onClick={onToggleExpertise}
          className={`px-2 py-1 rounded-full border text-[10px] leading-none ${
            expertise
              ? "border-amber-500 bg-amber-500/20 text-amber-200"
              : "border-slate-600 bg-slate-900 text-slate-200"
          }`}
          title="Expertise"
        >
          Exp
        </button>
      </div>
    </div>
  );
}

export default SkillCard;
