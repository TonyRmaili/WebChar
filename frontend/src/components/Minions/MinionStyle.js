
export const buttonStyle =
  "px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-amber-500";
export const inputTextStyle =
  "border border-slate-600 bg-slate-800 text-slate-100 px-2 py-1 rounded";


export const inputNumberStyle =
  "w-20 border border-slate-600 bg-slate-800 text-slate-100 px-2 py-1 rounded";

export const box = "rounded-md border border-slate-700 bg-slate-900/70 p-2";
export const label = "text-[11px] text-slate-400";
export const num = "text-sm text-amber-300 tabular-nums";
export const chip = "text-[10px] text-slate-300";
export const inputNum =
  "w-16 px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-100";



export const selectStyle = {
    control: (base) => ({
      ...base,
      backgroundColor: "#0f172a",   // slate-900
      borderColor: "#334155",       // slate-700
      borderRadius: "0.75rem",
      minHeight: "2.25rem",
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: "#0f172a",   // slate-900
    }),
    option: (base, state) => {
    const obj = state.data.value;              // original { "Wolf": false }
    const [name, flag] = Object.entries(obj)[0]; // name: "Wolf", flag: true/false

    return {
      ...base,
      backgroundColor: state.isFocused
        ? (flag ? "#14532d" : "#4c0519")       // hover: green/red
        : (flag ? "#166534" : "#7f1d1d"),      // default: green/red
      color: "#fcd34d",
      cursor: "pointer",
    };
  },
    singleValue: (base) => ({
      ...base,
      color: "#fcd34d",             // amber-300
    }),
    input: (base) => ({
      ...base,
      color: "#fcd34d",             // input text color
    }),
    placeholder: (base) => ({
      ...base,
      color: "#94a3b8",             // slate-400
    }),
  }



