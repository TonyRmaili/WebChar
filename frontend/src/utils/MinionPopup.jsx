
export default function MinionPopup({ item, onClose, onDragStart }) {
  if (!item) return null;

  return (
    <div className="bg-slate-950 text-slate-100 p-4">
      <header
        className="flex items-center justify-between mb-4 border-b border-slate-700 pb-2 cursor-move"
        onMouseDown={onDragStart}
      >
        <span className="text-lg font-semibold">{item.name}</span>
        <button
          onClick={onClose}
          className="px-2 py-1 rounded border border-slate-600 hover:bg-slate-800"
        >
          Close
        </button>
      </header>

      <section className="space-y-2">
        <p>
          <span className="text-slate-400">Name:</span> {item.name}
        </p>
        <p>
          <span className="text-slate-400">AC:</span> {item.ac ?? "Unknown"}
        </p>
        <p>
          <span className="text-slate-400">HP:</span> {item.max_hp ?? "Unknown"}
        </p>
      </section>
    </div>
  );
}
