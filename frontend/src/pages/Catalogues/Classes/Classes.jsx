import React, { useEffect, useState, useMemo } from "react";
import { useCatalogueStore } from "../../../store/CatalogueStore";
import ClassTraitsPanel from "./ClassTraitsPanel";
import ClassProgressionTable from "./ClassProgressionTable";
import ClassFeatureList from "./ClassFeatureList";
import { ErrorLine, LoadingLine, chip } from "../catalogueStyle";
import { InkHeading } from "../../../styles/parchment";
import { Segmented } from "../../../styles/parchmentForm";

const EDITIONS = [
  { value: "one", label: "One" },
  { value: "classic", label: "Classic" },
];
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function Classes() {
  const classes = useCatalogueStore((s) => s.classes);
  const loading = useCatalogueStore((s) => s.loadingClasses);
  const error = useCatalogueStore((s) => s.error);
  const loadClasses = useCatalogueStore((s) => s.loadClasses);

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
    <div>
      {loading && <LoadingLine>Fetching classes…</LoadingLine>}
      {error && <ErrorLine>{error}</ErrorLine>}

      {!loading && classes && (
        <div className="grid w-full items-start gap-x-8 gap-y-6 lg:grid-cols-[15rem_1fr]">
          {/* ─────────────── LEFT COLUMN ─────────────── */}
          <div className="flex flex-col gap-6 lg:border-r lg:border-rule/30 lg:pr-6">
            <section>
              <InkHeading>Edition</InkHeading>
              <Segmented options={EDITIONS} value={edition} onChange={setEdition} />
            </section>

            <section>
              <InkHeading>Class</InkHeading>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {Object.keys(classes).map((className) => (
                  <button
                    key={className}
                    type="button"
                    onClick={() => setSelectedClass((prev) => (prev === className ? "" : className))}
                    aria-pressed={selectedClass === className}
                    className={`${chip(selectedClass === className)} !text-sm`}
                  >
                    {cap(className)}
                  </button>
                ))}
              </div>
            </section>

            <ClassTraitsPanel selectedClassData={selectedClassData} />
          </div>

          {/* ─────────────── RIGHT COLUMN ─────────────── */}
          <div className="flex min-w-0 flex-col gap-6 text-ink">
            <ClassProgressionTable selectedClassData={selectedClassData} />

            {/* Subclass picker */}
            {selectedClass && subclasses.length > 0 && (
              <section>
                <InkHeading>Subclass</InkHeading>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {subclasses.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setSelectedSubclass((prev) => (prev === sc.name ? "" : sc.name))}
                      aria-pressed={selectedSubclass === sc.name}
                      className={`${chip(selectedSubclass === sc.name)} !text-sm`}
                    >
                      {sc.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <ClassFeatureList selectedClassData={selectedClassData} selectedSubclass={selectedSubclass} />
          </div>
        </div>
      )}
    </div>
  );
}