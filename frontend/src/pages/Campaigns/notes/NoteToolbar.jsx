import React, { useEffect, useRef, useState } from "react";
import { useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  BookOpenText,
  Columns2,
  Highlighter,
  ImagePlus,
  Italic,
  List,
  ListCollapse,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  ScrollText,
  Strikethrough,
  Table,
  Underline,
  Undo2,
  WandSparkles,
} from "lucide-react";

/* The note's toolbar: one row of tools, and a second row that only shows
   while you are in a table or in columns, with what can be done there.
   Buttons don't take the focus (onMouseDown prevents it), so the text you
   picked stays picked. */

export const FONTS = [
  { label: "Book", value: "" }, // the theme's own writing
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Sans", value: "system-ui, 'Segoe UI', Roboto, sans-serif" },
  { label: "Script", value: "'Segoe Script', 'Bradley Hand', 'Brush Script MT', cursive" },
  { label: "Mono", value: "ui-monospace, Consolas, 'Courier New', monospace" },
];

export const SIZES = ["", "12px", "14px", "18px", "22px", "28px", "36px"];

// Colours are the theme's inks, so a note stays readable in every theme.
const INKS = [
  { label: "Ink", value: null },
  { label: "Faded", value: "rgb(var(--c-ink-faded))" },
  { label: "Rubric", value: "rgb(var(--c-rubric))" },
  { label: "Green", value: "rgb(var(--c-good))" },
  { label: "Red", value: "rgb(var(--c-bad))" },
  { label: "Amber", value: "rgb(var(--c-warn))" },
  { label: "Violet", value: "rgb(var(--c-magic))" },
  { label: "Blue", value: "rgb(var(--c-info))" },
];

const MARKERS = [
  { label: "None", value: null },
  { label: "Gold", value: "rgb(var(--c-desk-accent) / 0.45)" },
  { label: "Rubric", value: "rgb(var(--c-rubric) / 0.2)" },
  { label: "Green", value: "rgb(var(--c-good) / 0.22)" },
  { label: "Red", value: "rgb(var(--c-bad) / 0.2)" },
  { label: "Violet", value: "rgb(var(--c-magic) / 0.2)" },
  { label: "Blue", value: "rgb(var(--c-info) / 0.2)" },
];

const btn = (on) =>
  `inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded px-1 text-sm transition ${
    on ? "bg-rubric/15 text-rubric" : "text-ink-faded hover:bg-ink/[0.07] hover:text-ink"
  } disabled:opacity-35 disabled:hover:bg-transparent`;
const textBtn = "h-6 shrink-0 rounded px-1.5 text-xs italic text-ink-faded transition hover:bg-ink/[0.07] hover:text-ink";
const selectCls =
  "h-7 shrink-0 cursor-pointer rounded border-0 bg-transparent py-0 pl-1 pr-6 font-body text-sm text-ink hover:bg-ink/[0.07] focus:outline-none focus:ring-0";
const Gap = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-rule/40" aria-hidden="true" />;
const keep = (e) => e.preventDefault();

function Tool({ on, title, onClick, disabled, children }) {
  return (
    <button type="button" className={btn(on)} title={title} aria-label={title} aria-pressed={!!on} disabled={disabled} onMouseDown={keep} onClick={onClick}>
      {children}
    </button>
  );
}

// A colour button with a small panel of swatches under it.
function Swatches({ title, icon, current, colours, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    window.addEventListener("mousedown", away);
    return () => window.removeEventListener("mousedown", away);
  }, [open]);
  return (
    <span ref={ref} className="relative">
      <button type="button" className={btn(open)} title={title} aria-label={title} onMouseDown={keep} onClick={() => setOpen((o) => !o)}>
        <span className="flex flex-col items-center">
          {icon}
          <span className="mt-px h-[3px] w-4 rounded-sm" style={{ background: current || "rgb(var(--c-ink) / 0.25)" }} />
        </span>
      </button>
      {open && (
        <div className="wc-page absolute left-0 top-8 z-20 grid w-44 grid-cols-4 gap-1 p-2 shadow-xl ring-1 ring-rule/40">
          {colours.map((c) => (
            <button
              key={c.label}
              type="button"
              title={c.label}
              onMouseDown={keep}
              onClick={() => {
                onPick(c.value);
                setOpen(false);
              }}
              className={`flex h-8 flex-col items-center justify-center rounded text-[10px] text-ink-faded hover:bg-ink/[0.07] ${current === c.value ? "ring-1 ring-rubric" : ""}`}
            >
              <span className="h-3.5 w-3.5 rounded-full ring-1 ring-ink/30" style={{ background: c.value || "transparent" }} />
              {c.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// "Paint": a few words to the image model; the picture lands where the
// cursor was (NoteCard.paint). It takes a while, so you can keep writing.
// Open / shut is the card's, so its right-click menu can open it too.
function PaintButton({ onPaint, open, setOpen }) {
  const [words, setWords] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    window.addEventListener("mousedown", away);
    return () => window.removeEventListener("mousedown", away);
  }, [open]);
  const go = () => {
    if (!words.trim()) return;
    onPaint(words.trim());
    setWords("");
    setOpen(false);
  };
  return (
    <span ref={ref} className="relative">
      <button type="button" className={btn(open)} title="Paint a picture here" aria-label="Paint a picture here" onMouseDown={keep} onClick={() => setOpen((o) => !o)}>
        <WandSparkles size={15} />
      </button>
      {open && (
        <div className="wc-page absolute left-0 top-8 z-20 w-80 p-2 shadow-xl ring-1 ring-rule/40">
          <textarea
            autoFocus
            rows={3}
            value={words}
            onChange={(e) => setWords(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                go();
              } else if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Describe the picture… (Ctrl+Enter)"
            className="w-full resize-none rounded border border-rule/50 bg-page-light/60 px-2 py-1 font-body text-sm text-ink focus:border-rubric/60 focus:outline-none focus:ring-0"
          />
          <div className="mt-1 flex items-center gap-2">
            <span className="flex-1 text-[11px] italic text-ink-faint">It lands where the cursor is; keep writing meanwhile.</span>
            <button type="button" disabled={!words.trim()} onClick={go} className="rounded border border-rubric/60 px-3 py-0.5 text-sm text-rubric transition hover:bg-rubric hover:text-page-light disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-rubric">
              Paint
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

export default function NoteToolbar({ editor, onPickImages, onPaint, paintOpen, setPaintOpen, status }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const style = e.getAttributes("textStyle");
      return {
        font: style.fontFamily || "",
        size: style.fontSize || "",
        color: style.color || null,
        marker: style.backgroundColor || null,
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        block: e.isActive("heading", { level: 1 }) ? "h1" : e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : "p",
        align: ["center", "right", "justify"].find((a) => e.isActive({ textAlign: a })) || "left",
        bullet: e.isActive("bulletList"),
        ordered: e.isActive("orderedList"),
        task: e.isActive("taskList"),
        quote: e.isActive("blockquote"),
        readAloud: e.isActive("readAloud"),
        handout: e.isActive("handout"),
        details: e.isActive("details"),
        table: e.isActive("table"),
        columns: e.isActive("columns"),
        undo: e.can().undo(),
        redo: e.can().redo(),
      };
    },
  });
  const go = () => editor.chain().focus();

  return (
    <div className="shrink-0 border-b border-rule/40 px-2 py-1 font-body" onContextMenu={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-0.5">
        <select className={selectCls} title="Font" value={s.font} onChange={(e) => (e.target.value ? go().setFontFamily(e.target.value) : go().unsetFontFamily()).run()}>
          {FONTS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
          {s.font && !FONTS.some((f) => f.value === s.font) && <option value={s.font}>Other</option>}
        </select>
        <select className={selectCls} title="Size" value={s.size} onChange={(e) => (e.target.value ? go().setFontSize(e.target.value) : go().unsetFontSize()).run()}>
          {SIZES.map((v) => (
            <option key={v || "normal"} value={v}>
              {v ? v.replace("px", "") : "Size"}
            </option>
          ))}
          {s.size && !SIZES.includes(s.size) && <option value={s.size}>{s.size}</option>}
        </select>
        <select
          className={selectCls}
          title="Paragraph or heading"
          value={s.block}
          onChange={(e) => {
            const v = e.target.value;
            (v === "p" ? go().setParagraph() : go().setHeading({ level: Number(v[1]) })).run();
          }}
        >
          <option value="p">Text</option>
          <option value="h1">Title</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
        </select>
        <Gap />
        <Tool title="Bold (Ctrl+B)" on={s.bold} onClick={() => go().toggleBold().run()}>
          <Bold size={15} />
        </Tool>
        <Tool title="Italic (Ctrl+I)" on={s.italic} onClick={() => go().toggleItalic().run()}>
          <Italic size={15} />
        </Tool>
        <Tool title="Underline (Ctrl+U)" on={s.underline} onClick={() => go().toggleUnderline().run()}>
          <Underline size={15} />
        </Tool>
        <Tool title="Struck through" on={s.strike} onClick={() => go().toggleStrike().run()}>
          <Strikethrough size={15} />
        </Tool>
        <Swatches title="Ink colour" icon={<Baseline size={15} />} current={s.color} colours={INKS} onPick={(v) => (v ? go().setColor(v) : go().unsetColor()).run()} />
        <Swatches
          title="Marker"
          icon={<Highlighter size={15} />}
          current={s.marker}
          colours={MARKERS}
          onPick={(v) => (v ? go().setBackgroundColor(v) : go().unsetBackgroundColor()).run()}
        />
        <Tool title="Clear the look of the picked text" onClick={() => go().unsetAllMarks().run()}>
          <RemoveFormatting size={15} />
        </Tool>
        <Gap />
        <Tool title="Left" on={s.align === "left"} onClick={() => go().setTextAlign("left").run()}>
          <AlignLeft size={15} />
        </Tool>
        <Tool title="Centre" on={s.align === "center"} onClick={() => go().setTextAlign("center").run()}>
          <AlignCenter size={15} />
        </Tool>
        <Tool title="Right" on={s.align === "right"} onClick={() => go().setTextAlign("right").run()}>
          <AlignRight size={15} />
        </Tool>
        <Tool title="Justified" on={s.align === "justify"} onClick={() => go().setTextAlign("justify").run()}>
          <AlignJustify size={15} />
        </Tool>
        <Gap />
        <Tool title="Bullet list" on={s.bullet} onClick={() => go().toggleBulletList().run()}>
          <List size={15} />
        </Tool>
        <Tool title="Numbered list" on={s.ordered} onClick={() => go().toggleOrderedList().run()}>
          <ListOrdered size={15} />
        </Tool>
        <Tool title="Checklist" on={s.task} onClick={() => go().toggleTaskList().run()}>
          <ListTodo size={15} />
        </Tool>
        <Tool title="Quote" on={s.quote} onClick={() => go().toggleBlockquote().run()}>
          <Quote size={15} />
        </Tool>
        <Tool title="A line across" onClick={() => go().setHorizontalRule().run()}>
          <Minus size={15} />
        </Tool>
        <Gap />
        <Tool title="Table" on={s.table} onClick={() => go().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} disabled={s.table}>
          <Table size={15} />
        </Tool>
        <Tool
          title={s.details ? "Undo the folding section" : "Folding section: a title that opens and closes"}
          on={s.details}
          onClick={() => (s.details ? go().unsetDetails() : go().setDetails()).run()}
        >
          <ListCollapse size={15} />
        </Tool>
        <Tool title="Two columns" on={s.columns} disabled={s.columns} onClick={() => go().insertColumns().run()}>
          <Columns2 size={15} />
        </Tool>
        <Tool title="Picture (or paste / drop one in)" onClick={onPickImages}>
          <ImagePlus size={15} />
        </Tool>
        <PaintButton onPaint={onPaint} open={paintOpen} setOpen={setPaintOpen} />
        <Gap />
        <Tool title={s.readAloud ? "Back to plain text" : "Read-aloud box: text to read out to the players"} on={s.readAloud} onClick={() => go().toggleReadAloud().run()}>
          <BookOpenText size={15} />
        </Tool>
        <Tool
          title={s.handout ? "Undo the handout" : "Handout: something the players get to see (a letter, a map…)"}
          on={s.handout}
          onClick={() => (s.handout ? go().unsetHandout() : go().setHandout()).run()}
        >
          <ScrollText size={15} />
        </Tool>
        <Gap />
        <Tool title="Undo (Ctrl+Z)" disabled={!s.undo} onClick={() => go().undo().run()}>
          <Undo2 size={15} />
        </Tool>
        <Tool title="Redo (Ctrl+Y)" disabled={!s.redo} onClick={() => go().redo().run()}>
          <Redo2 size={15} />
        </Tool>
        <span className="ml-auto shrink-0 pl-2 text-xs italic text-ink-faint">{status}</span>
      </div>

      {s.table && (
        <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-dotted border-rule/40 pt-1">
          <span className="mr-1 text-xs italic text-ink-faint">Table:</span>
          <button type="button" className={textBtn} onMouseDown={keep} onClick={() => go().addRowAfter().run()}>
            + row
          </button>
          <button type="button" className={textBtn} onMouseDown={keep} onClick={() => go().addColumnAfter().run()}>
            + column
          </button>
          <button type="button" className={textBtn} onMouseDown={keep} onClick={() => go().deleteRow().run()}>
            − row
          </button>
          <button type="button" className={textBtn} onMouseDown={keep} onClick={() => go().deleteColumn().run()}>
            − column
          </button>
          <button type="button" className={textBtn} onMouseDown={keep} onClick={() => go().toggleHeaderRow().run()}>
            header row
          </button>
          <button type="button" className={textBtn} onMouseDown={keep} onClick={() => go().mergeOrSplit().run()}>
            merge / split cells
          </button>
          <button type="button" className={`${textBtn} !text-rubric`} onMouseDown={keep} onClick={() => go().deleteTable().run()}>
            remove table
          </button>
        </div>
      )}
      {s.columns && (
        <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-dotted border-rule/40 pt-1">
          <span className="mr-1 text-xs italic text-ink-faint">Columns:</span>
          <button type="button" className={textBtn} onMouseDown={keep} onClick={() => go().removeColumns().run()}>
            back to one column
          </button>
        </div>
      )}
    </div>
  );
}
