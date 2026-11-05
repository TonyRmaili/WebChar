import React, { useState } from 'react'
import useAuthStore from "../../store/AuthStore"
import useCharStore from '../../store/CharStore'
import deleteSkull from '../../assets/deleteSkull.svg'
import BuildWizard from './wizard/BuildWizard'


// Accent class fragments per method (selected ring + icon tint + button gradient)
const ACCENTS = {
  emerald: {
    selected: "border-emerald-500 ring-2 ring-emerald-400/60 shadow-[0_0_16px_rgba(16,185,129,0.35)]",
    icon: "text-emerald-300",
    btn: "from-emerald-900 to-emerald-700 hover:from-emerald-800 hover:to-emerald-600 border-emerald-900 shadow-[0_0_10px_rgba(16,185,129,0.25)]",
  },
  amber: {
    selected: "border-amber-500 ring-2 ring-amber-400/60 shadow-[0_0_16px_rgba(245,158,11,0.35)]",
    icon: "text-amber-300",
    btn: "from-amber-900 to-amber-700 hover:from-amber-800 hover:to-amber-600 border-amber-900 shadow-[0_0_10px_rgba(245,158,11,0.25)]",
  },
  indigo: {
    selected: "border-indigo-500 ring-2 ring-indigo-400/60 shadow-[0_0_16px_rgba(99,102,241,0.35)]",
    icon: "text-indigo-300",
    btn: "from-indigo-900 to-indigo-700 hover:from-indigo-800 hover:to-indigo-600 border-indigo-900 shadow-[0_0_10px_rgba(99,102,241,0.25)]",
  },
};

// Small inline icons (use currentColor so the accent tint applies)
const Icons = {
  manual: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
      <path d="M14.5 5.5l3 3" />
    </svg>
  ),
  builder: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M5 19l8.5-8.5" />
      <path d="M16 3l1 2.4L19.5 6 17 7l-1 2.5L15 7l-2.5-1L15 5l1-2z" />
      <path d="M19.5 14l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6.6-1.5z" />
    </svg>
  )
};

const CREATE_METHODS = [
  {
    id: "manual",
    label: "Manual",
    blurb: "Name your character and start from a blank sheet. You fill in everything yourself from the sheets panel.",
    accent: "emerald",
  },
  {
    id: "builder",
    label: "Builder Wizard",
    blurb: "Step-by-step guided creation using the class, race, and background catalogues.",
    accent: "amber",
  },
  
];

// First 1–2 letters for the token monogram (until a token image exists)
function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function CreateCharacters() {
  const { userData, fetchUser } = useAuthStore()
  const { deleteChar, createChar, toggleActiveChar } = useCharStore()

  const [createMode, setCreateMode] = useState(null)   // "manual" | "builder" |  null
  const [manualName, setManualName] = useState("")
  const [creating, setCreating] = useState(false)
  
  async function onDeleteChar(charName) {
    try {
      const ok = window.confirm(`Delete ${charName}? This cannot be undone.`)
      if (!ok) return

      await deleteChar(charName)
      await fetchUser()

      const current = JSON.parse(localStorage.getItem("charData"))
      if (current?.name === charName) {
        localStorage.removeItem("charData")
      }
    } catch (e) {
      console.error('Delete failed:', e)
      alert('Delete failed. Please try again.')
    }
  }

  async function onCreateManual() {
    const name = manualName.trim()
    if (!name) {
      console.log("Empty name — creation skipped.")
      return
    }
    try {
      setCreating(true)
      await createChar(name)
      await fetchUser()
      console.log("Character created successfully:", name)
      setManualName("")
    } catch (e) {
      console.error("Failed to create character:", e)
    } finally {
      setCreating(false)
    }
  }

  async function onSelectChar(charId) {
    await toggleActiveChar(charId)
    await fetchUser()
  }

  const characters = [...(userData?.characters ?? [])].sort((a, b) => {
    if (a.id != null && b.id != null) return a.id - b.id
    return String(a.name).localeCompare(String(b.name))
  })

  return (
    <div className="flex flex-col items-center w-full">
      {/* Method picker */}
      <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {CREATE_METHODS.map((m) => {
          const isActive = createMode === m.id
          const accent = ACCENTS[m.accent]
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setCreateMode(m.id)}
              className={`text-left rounded-lg border-2 bg-slate-900/40 p-4 transition-all hover:-translate-y-0.5 hover:bg-slate-900/60 ${
                isActive ? accent.selected : "border-slate-700"
              }`}
            >
              <div className='flex items-center gap-3'>
                <div className={`${accent.icon}`}>{Icons[m.id]}</div>
                <h3 className="text-amber-200 font-semibold tracking-wide">{m.label}</h3>
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{m.blurb}</p>
            </button>
          )
        })}
      </div>

      {/* Workspace: narrow select rail (1/4) + wide builder area (3/4) */}
      <div className='w-full grid grid-cols-1 lg:grid-cols-6 gap-2'>

        {/* Select Panel — left rail */}
        <div className='flex flex-col items-center'>
          <h2 className="text-xl font-bold text-amber-200 mb-1 tracking-wide drop-shadow-md">
            Characters
          </h2>
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-amber-700/60 to-transparent mb-4 " />

          {characters.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-6">
              No characters yet — create one to begin.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {characters.map((character) => {
                const isActive = !!character.active
                return (
                  <div key={character.id ?? character.name} className="group relative flex flex-col items-center">
                    {/* Token */}
                    <button
                      onClick={() => onSelectChar(character.id)}
                      className="relative transition-transform duration-150 hover:scale-105 focus:outline-none"
                      aria-label={`Select ${character.name}`}
                    >
                      <div
                        className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold tracking-wide
                          bg-gradient-to-br from-slate-700 to-slate-900 text-amber-100/90
                          border-[3px] transition-all duration-200
                          ${isActive
                            ? "border-amber-400 ring-2 ring-amber-300/70 shadow-[0_0_14px_rgba(250,204,21,0.5)]"
                            : "border-slate-600 group-hover:border-amber-600/70 shadow-md"
                          }`}
                      >
                        {initials(character.name)}
                      </div>

                      {/* Active badge */}
                      {isActive && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[8px] font-semibold uppercase tracking-wider bg-amber-500 text-slate-900 shadow">
                          Active
                        </span>
                      )}
                    </button>

                    {/* Delete skull — corner badge, fades in on hover */}
                    <button
                      type="button"
                      aria-label={`Delete ${character.name}`}
                      onClick={() => onDeleteChar(character.name)}
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-800/90 border border-red-950
                        flex items-center justify-center opacity-0 group-hover:opacity-100
                        hover:bg-red-600 active:bg-red-900 focus:outline-none focus:ring-2 focus:ring-red-400
                        transition-opacity duration-150 shadow"
                    >
                      <img src={deleteSkull} alt="" className="w-3 h-3 pointer-events-none" />
                    </button>

                    {/* Name plaque */}
                    <p className="mt-2 px-1.5 py-0.5 max-w-[4.5rem] truncate text-center text-[11px] font-medium text-amber-100
                      rounded bg-slate-800/70 border border-slate-700">
                      {character.name}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Builder / method area — wide right side */}
        <div className="lg:col-span-5">
          {!createMode ? (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-900/20 text-center py-10">
              <div className="text-slate-600">{Icons.builder}</div>
              <p className="text-sm text-slate-500">Pick a creation method above to get started.</p>
            </div>
          ) : (
            <>
              {createMode === "manual" && (
                <div className="flex flex-col gap-3 max-w-2xl">
                  <label className="text-sm font-medium text-amber-200">Character name</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && onCreateManual()}
                      placeholder="e.g. Thaldrin Brightaxe"
                      className="flex-1 px-3 py-2 rounded-md bg-slate-800 border border-slate-600 text-amber-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                    />
                    <button
                      type="button"
                      onClick={onCreateManual}
                      disabled={creating || !manualName.trim()}
                      className={`px-5 py-2 rounded-md border-2 bg-gradient-to-r text-amber-100 font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${ACCENTS.emerald.btn}`}
                    >
                      {creating ? "Creating…" : "Create"}
                    </button>
                    
                  </div>
                  <p className="text-xs text-slate-500">A token image can be added later from the sheet.</p>
                </div>
              )}

              {createMode === "builder" && <BuildWizard />}

            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateCharacters;