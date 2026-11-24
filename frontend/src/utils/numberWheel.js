/* The mouse wheel changes any number field it's over once that field is
   clicked into (focused): up adds the field's step (1, or 5 for
   distances, speeds and senses), down takes it away, within its min/max.
   The page doesn't scroll meanwhile. A field that isn't focused leaves
   the wheel alone, so scrolling past a form never changes a value by
   accident. Installed once for the whole app (main.jsx). React hears the
   change as if it were typed. */

const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;

function onWheel(e) {
  const el = e.target;
  if (!(el instanceof window.HTMLInputElement) || el.type !== "number" || el.disabled || el.readOnly) return;
  if (document.activeElement !== el) return;
  e.preventDefault();
  const step = Number(el.step) > 0 ? Number(el.step) : 1;
  const cur = el.value === "" ? 0 : Number(el.value) || 0;
  let next = e.deltaY < 0 ? cur + step : cur - step;
  if (step > 1) next = Math.round(next / step) * step; // 14 + 5 → 20, on the 5s
  if (el.min !== "" && next < Number(el.min)) next = Number(el.min);
  if (el.max !== "" && next > Number(el.max)) next = Number(el.max);
  if (next === cur && el.value !== "") return;
  valueSetter.call(el, String(next));
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
}

let installed = false;
export function installNumberWheel() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener("wheel", onWheel, { passive: false });
}
