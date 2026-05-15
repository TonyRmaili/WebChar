import React, { useEffect, useState, useMemo } from "react";
import { useDnDStore } from "../../../store/DndStore";
import ClassTraitsPanel from "./ClassTraitsPanel";
import ClassProgressionTable from "./ClassProgressionTable";
import ClassFeatureList from "./ClassFeatureList";

export default function Classes() {
  const classes = useDnDStore((s) => s.classes);
  const loading = useDnDStore((s) => s.loadingClasses);
  const error = useDnDStore((s) => s.error);
  const loadClasses = useDnDStore((s) => s.loadClasses);

  const [edition, setEdition] = useState("one");
  const [selectedClass, setSelectedClass] = useState("wizard");
  const [selectedSubclass, setSelectedSubclass] = useState("");

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    setSelectedSubclass("");
  }, [selectedClass, edition]);

  const subclasses = useMemo(() => {
    if (!selectedClass) return [];
    const classData = classes?.[selectedClass];
    if (!classData) return [];
    const source =
      edition === "classic"
        ? classData.classic?.subclasses
        : classData.one?.subclasses;
    if (!source) return [];
    return source.map((sc) => ({
      id: `${selectedClass}-${edition}-${sc.name}`,
      name: sc.name,
      edition,
    }));
  }, [classes, selectedClass, edition]);

  const selectedClassData = useMemo(() => {
    if (!selectedClass) return null;
    return classes?.[selectedClass]?.[edition];
  }, [classes, selectedClass, edition]);

  return (
    <div className="p-4">
      {loading && <p className="text-slate-300">Loading classes...</p>}
      {error && <p className="text-red-300">{error}</p>}

      {!loading && classes && (
        <div className="flex w-full gap-3 items-start">
          {/* ─────────────── LEFT COLUMN ─────────────── */}
          <div className="w-1/5 flex flex-col gap-3">

            {/* Edition + Class selector */}
            <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-4 space-y-4">
              {/* Edition */}
              <section>
               
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setEdition("one")}
                    className={`
                      px-3 py-1.5 rounded-md text-sm font-semibold border transition-colors
                      ${edition === "one"
                        ? "bg-cyan-500 text-slate-950 border-cyan-300 shadow-sm"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"}
                    `}
                  >
                    One
                  </button>
                  <button
                    onClick={() => setEdition("classic")}
                    className={`
                      px-3 py-1.5 rounded-md text-sm font-semibold border transition-colors
                      ${edition === "classic"
                        ? "bg-amber-500 text-slate-950 border-amber-300 shadow-sm"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"}
                    `}
                  >
                    Classic
                  </button>
                </div>
              </section>

              {/* Class */}
              <section className="border-t border-slate-700 pt-4">
                
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(classes).map((className) => {
                    const active = selectedClass === className;
                    return (
                      <button
                        key={className}
                        onClick={() =>
                          setSelectedClass((prev) => (prev === className ? "" : className))
                        }
                        className={`
                          px-2.5 py-1 rounded-md border text-xs font-medium transition-colors
                          ${active
                            ? "bg-amber-500 text-slate-950 border-amber-300 shadow-sm"
                            : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400"}
                        `}
                      >
                        {className}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <ClassTraitsPanel selectedClassData={selectedClassData} />
          </div>

          {/* ─────────────── RIGHT COLUMN ─────────────── */}
          <div className="w-4/5 flex flex-col gap-3 text-slate-200">
            <ClassProgressionTable selectedClassData={selectedClassData} />

            {/* Subclass picker */}
            {selectedClass && subclasses.length > 0 && (
              <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-3">
               

                <div className="flex flex-wrap gap-1.5">
                  {subclasses.map((sc) => {
                    const active = selectedSubclass === sc.name;
                    const cls = active
                      ? sc.edition === "classic"
                        ? "bg-amber-500 text-slate-950 border-amber-300"
                        : "bg-cyan-500 text-slate-950 border-cyan-300"
                      : sc.edition === "classic"
                        ? "bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700"
                        : "bg-slate-800 text-cyan-400 border-slate-700 hover:bg-slate-700";
                    return (
                      <button
                        key={sc.id}
                        onClick={() =>
                          setSelectedSubclass((prev) =>
                            prev === sc.name ? "" : sc.name
                          )
                        }
                        className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${cls}`}
                      >
                        {sc.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <ClassFeatureList
              selectedClassData={selectedClassData}
              selectedSubclass={selectedSubclass}
            />
          </div>
        </div>
      )}
    </div>
  );
}