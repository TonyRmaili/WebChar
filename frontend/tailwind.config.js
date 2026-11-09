import containerQueries from "@tailwindcss/container-queries";

/* Colours come from the theme (src/styles/themes.css). Each name here is
   a slot the theme fills, so `text-ink`, `bg-page` or `border-rule/30`
   follow whichever theme is on. Never add a hex colour to a component —
   add a slot here and in themes.css instead. */
const slot = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: slot("ink"), faded: slot("ink-faded"), faint: slot("ink-faint") },
        rubric: { DEFAULT: slot("rubric"), deep: slot("rubric-deep") },
        rule: slot("rule"),
        page: { DEFAULT: slot("page"), light: slot("page-light") },
        desk: {
          DEFAULT: slot("desk"),
          deep: slot("desk-deep"),
          ink: slot("desk-ink"),
          "ink-faded": slot("desk-ink-faded"),
          accent: slot("desk-accent"),
        },
        stitch: slot("stitch"),
        good: slot("good"),
        bad: slot("bad"),
        warn: slot("warn"),
        magic: slot("magic"),
        info: slot("info"),
      },
      fontFamily: {
        body: "var(--font-body)",
      },
    },
  },
  plugins: [containerQueries],
};