import React, { useEffect, useState, useMemo } from "react";
import { useDnDStore } from "../../../store/DndStore";

export default function Feats() {
  const featsData = useDnDStore((s) => s.featsData);
  const loading = useDnDStore((s) => s.loadingFeats);
  const error = useDnDStore((s) => s.error);
  const loadFeats = useDnDStore((s) => s.loadFeats);

  const feats = featsData.feats || [];
  const sources = featsData.sources || [];
  const categories = featsData.categories || [];

	const [query, setQuery] = useState("");

  useEffect(() => {
    loadFeats();
  }, []);

	const filteredFeats = useMemo(() => {
		if (!query.trim()) return feats;

		return feats.filter((feat) =>
			feat.name.toLowerCase().includes(query.toLowerCase())
		);
	}, [feats, query]);

  return (
    <div className="text-amber-400">
      {loading && <p>Loading feats...</p>}
      {error && <p>{error}</p>}

      {!loading && (
        <>
				<div className="flex">
					<input
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search feats..."
							className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm
												focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition"
						/>

					<div className="flex flex-col gap-1">
						<p className="font-bold text-lg text-bo">Sources</p>
						
						{sources.map ((source) => (
							<button className="p-1 border">
								{source}
							</button>
						))}
					</div>

					<div className="flex gap-1">
						Categories
						{categories.map ((cate) => (
							<button>
								{cate}
							</button>
						))}
					</div>
				</div>

          {filteredFeats.map((feat) => (
            <div key={`${feat.name}-${feat.source}`}>
              {feat.name} | {feat.source}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
