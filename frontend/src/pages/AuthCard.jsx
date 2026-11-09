import React from "react";
import { ParchmentSheet } from "../styles/parchment";

/* The log-in / create-account card: a parchment sheet in the middle of the
   leather, with a title, labelled blanks and the rubric seal button. Shared
   by LogIn and CreateAccount so the two look the same. */

export function AuthCard({ title, children, footer }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <ParchmentSheet>
          <h2 className="mb-6 text-center text-3xl tracking-wide text-ink">{title}</h2>
          {children}
        </ParchmentSheet>
        {footer && <div className="mt-5 flex justify-center font-body">{footer}</div>}
      </div>
    </div>
  );
}

// One labelled blank. Pass the input's props straight through.
export function AuthField({ id, label, ...inputProps }) {
  return (
    <div className="mb-5">
      <label htmlFor={id} className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faded">
        {label}
      </label>
      <input
        id={id}
        className="h-9 w-full rounded-none border-0 border-b border-dotted border-rule/70 bg-transparent px-0 font-body text-[17px] text-ink placeholder:text-ink-faint focus:border-solid focus:border-ink focus:outline-none focus:ring-0"
        {...inputProps}
      />
    </div>
  );
}

// The submit button: rubric-edged, filled with rubric on hover.
export const sealBtn =
  "mt-2 w-full rounded-md border border-rubric/60 py-2 text-[17px] font-semibold tracking-wide text-rubric transition hover:bg-rubric hover:text-page-light disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-rubric";

// A problem with the form, in the bad ink.
export const AuthError = ({ children }) => (children ? <p className="mb-3 text-center text-sm italic text-bad">{children}</p> : null);