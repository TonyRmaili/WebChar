import { Extension, Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import FileHandler from "@tiptap/extension-file-handler";
import Mention from "@tiptap/extension-mention";
import { PluginKey } from "@tiptap/pm/state";
import { Placeholder } from "@tiptap/extensions";
import NoteImageView from "./NoteImageView";
import HandoutView from "./HandoutView";
import { linkMenuRender } from "./LinkMenu";
import { ensureCatalogues, findCatalogue, findCopies, findFiles } from "./noteLinks";
import { PICTURE_TYPES } from "./notesApi";

/* ═══════════════════════════════════════════════════════════════════
   noteExtensions.js — what a campaign note can hold.

   Tiptap is built from "extensions": each one teaches the editor a kind
   of thing (a heading, a table, bold text…). Most come ready-made; three
   are made here:

   - NoteImage: a picture. The document only keeps the server's file name
     (`file`), how wide it is, where it sits (left / centre / right, text
     flows around left and right) and a description (`alt`), which is what
     the DM Assistant reads instead of the picture.
   - Indent: Tab at the start of a line indents the paragraph; Tab inside
     a line adds a tab gap (they line up, like tab stops). Shift+Tab undoes.
     In lists Tab nests the item, in tables it moves to the next cell.
   - Columns: two columns side by side.
   - ReadAloud: a box of text to read out to the players.
   - Handout: a titled block the players get to see; "show" opens it on
     its own (HandoutCard).
   - Links (Mention): "@" links a catalogue entry, "//" a party member or NPC
     of the campaign (their statblock), "[[" another note or picture of the
     campaign (noteLinks.js); clicking one opens its card.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── pictures ─── */

const dataAttr = (name, parse = (v) => v) => ({
  parseHTML: (el) => parse(el.getAttribute(`data-${name}`)),
  renderHTML: (attrs) => (attrs[name] == null || attrs[name] === "" ? {} : { [`data-${name}`]: attrs[name] }),
});

export const NoteImage = Node.create({
  name: "noteImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return { campaignName: "" };
  },

  addAttributes() {
    return {
      file: { default: null, ...dataAttr("file") },
      alt: { default: "", ...dataAttr("alt", (v) => v || "") },
      width: { default: null, ...dataAttr("width", (v) => (v ? Number(v) || null : null)) },
      align: { default: "center", ...dataAttr("align", (v) => (["left", "right", "center"].includes(v) ? v : "center")) },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-note-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes({ "data-note-image": "" }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteImageView);
  },

  addCommands() {
    return {
      insertNoteImage:
        (attrs, pos) =>
        ({ commands, state }) => {
          const node = { type: this.name, attrs };
          if (pos == null) return commands.insertContent(node);
          return commands.insertContentAt(Math.min(pos, state.doc.content.size), node);
        },
    };
  },
});

/* ─── indent and tab gaps ─── */

const INDENT_TYPES = ["paragraph", "heading"];
const MAX_INDENT = 8;

// Change the indent of every paragraph and heading the selection touches.
function shiftIndent(editor, by) {
  const { state, view } = editor;
  const { from, to } = state.selection;
  const tr = state.tr;
  let changed = false;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!INDENT_TYPES.includes(node.type.name)) return true;
    const now = node.attrs.indent || 0;
    const next = Math.max(0, Math.min(MAX_INDENT, now + by));
    if (next !== now) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
      changed = true;
    }
    return false;
  });
  if (changed) view.dispatch(tr);
  return changed;
}

function tabKey(editor, back) {
  // Lists and tables use Tab themselves (their own keys run first); if
  // they couldn't, Tab still stays in the note instead of leaving it.
  if (editor.isActive("listItem") || editor.isActive("taskItem") || editor.isActive("table")) return true;
  const { selection } = editor.state;
  const { $from, empty } = selection;
  if (editor.isActive("codeBlock")) {
    if (!back) editor.commands.insertContent("\t");
    return true;
  }
  const atLineStart = empty && $from.parentOffset === 0;
  if (!empty || atLineStart) {
    shiftIndent(editor, back ? -1 : 1);
    return true;
  }
  if (!back) {
    editor.commands.insertContent("\t");
    return true;
  }
  // Shift+Tab inside a line: take back a tab gap just before the cursor,
  // or else outdent the line.
  if ($from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset) === "\t") {
    editor.commands.deleteRange({ from: $from.pos - 1, to: $from.pos });
  } else {
    shiftIndent(editor, -1);
  }
  return true;
}

export const Indent = Extension.create({
  name: "indent",
  // Lower than the lists and tables, so their Tab goes first.
  priority: 50,

  addGlobalAttributes() {
    return [
      {
        types: INDENT_TYPES,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => Math.min(MAX_INDENT, Number(el.getAttribute("data-indent")) || 0),
            renderHTML: (attrs) => (attrs.indent ? { "data-indent": attrs.indent, style: `margin-left: ${attrs.indent * 2}em` } : {}),
          },
        },
      },
    ];
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => tabKey(this.editor, false),
      "Shift-Tab": () => tabKey(this.editor, true),
    };
  },
});

/* ─── two columns ─── */

export const Column = Node.create({
  name: "column",
  content: "block+",
  isolating: true,
  parseHTML() {
    return [{ tag: "div[data-column]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-column": "", class: "note-column" }, HTMLAttributes), 0];
  },
});

export const Columns = Node.create({
  name: "columns",
  group: "block",
  content: "column column",
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-columns]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-columns": "", class: "note-columns" }, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      insertColumns:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            content: [
              { type: "column", content: [{ type: "paragraph" }] },
              { type: "column", content: [{ type: "paragraph" }] },
            ],
          }),
      // Back to one column: the left column's blocks, then the right's.
      removeColumns:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection;
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            const node = $from.node(depth);
            if (node.type.name !== this.name) continue;
            if (dispatch) {
              const blocks = [];
              node.forEach((col) => col.forEach((block) => blocks.push(block)));
              const start = $from.before(depth);
              tr.replaceWith(start, start + node.nodeSize, blocks);
            }
            return true;
          }
          return false;
        },
    };
  },
});

/* ─── read-aloud boxes and handouts ─── */

export const ReadAloud = Node.create({
  name: "readAloud",
  group: "block",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: "aside[data-read-aloud]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["aside", mergeAttributes({ "data-read-aloud": "", class: "note-read-aloud" }, HTMLAttributes), 0];
  },
  addCommands() {
    return {
      toggleReadAloud:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
    };
  },
});

// Like a quote block for the keys: Backspace at its start takes the line
// out of it, and clicking its "Handout" tag picks the whole of it (then
// Delete / Backspace remove it). Its ✕ removes it with what's in it.
export const Handout = Node.create({
  name: "handout",
  group: "block",
  content: "block+",
  defining: true,

  addOptions() {
    return { onShow: null }; // (node) → open it as a HandoutCard
  },
  addAttributes() {
    return { title: { default: "", ...dataAttr("title", (v) => v || "") } };
  },
  parseHTML() {
    return [{ tag: "section[data-handout]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes({ "data-handout": "" }, HTMLAttributes), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(HandoutView);
  },
  addCommands() {
    return {
      // The picked blocks become the handout (or a new empty one).
      setHandout:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name),
      unsetHandout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },
});

/* ─── links ─── */

const LinkNode = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      kind: { default: null, ...dataAttr("kind") },
      slice: { default: null, ...dataAttr("slice") },
    };
  },
});

function links(campaignName) {
  return LinkNode.configure({
    HTMLAttributes: { class: "note-link" },
    renderText: ({ node }) => {
      const char = node.attrs.mentionSuggestionChar;
      return char === "[[" ? `[[${node.attrs.label}]]` : `${char || "@"}${node.attrs.label}`;
    },
    renderHTML: ({ node }) => node.attrs.label,
    suggestions: [
      {
        char: "@",
        pluginKey: new PluginKey("catalogueLink"),
        allowSpaces: true,
        items: async ({ query }) => {
          await ensureCatalogues();
          return findCatalogue(query);
        },
        render: linkMenuRender("Type a name from the catalogues: a monster, spell, item…"),
      },
      {
        // Only after a space or at a line's start, so "https://" doesn't open it.
        char: "//",
        pluginKey: new PluginKey("peopleLink"),
        allowSpaces: true,
        items: ({ query }) => findCopies(campaignName, query),
        render: linkMenuRender("Nobody in this campaign's party or NPCs yet"),
      },
      {
        char: "[[",
        pluginKey: new PluginKey("noteLink"),
        allowSpaces: true,
        items: ({ query }) => findFiles(campaignName, query),
        render: linkMenuRender("Type the name of a note or picture"),
      },
    ],
  });
}

/* ─── everything together ─── */

// onFiles(files, pos): pictures were pasted (pos null) or dropped at pos.
// onShowHandout(node): a handout's "show" was clicked.
export function noteExtensions({ campaignName, onFiles, onShowHandout }) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      dropcursor: { color: "rgb(var(--c-rubric))", width: 2 },
      link: { openOnClick: true, autolink: true },
    }),
    TextStyleKit,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: true } }),
    Details.configure({ persist: true, HTMLAttributes: { class: "details" } }),
    DetailsSummary,
    DetailsContent,
    NoteImage.configure({ campaignName }),
    Columns,
    Column,
    ReadAloud,
    Handout.configure({ onShow: onShowHandout }),
    links(campaignName),
    Indent,
    FileHandler.configure({
      allowedMimeTypes: PICTURE_TYPES,
      consumePasteEvent: true,
      onPaste: (editor, files) => onFiles(files, null),
      onDrop: (editor, files, pos) => onFiles(files, pos),
    }),
    Placeholder.configure({ placeholder: "Write here. Tab indents; paste or drop pictures in; @ links the catalogue, // the party and NPCs, [[ another note." }),
  ];
}
