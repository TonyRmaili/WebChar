import React from "react";
import { shortTokens, tokens, untilMidnight, useAiStore } from "../store/AiStore";

/* Today's AI tokens in one short line ("today 12k of 50k tokens"), for
   the DM Assistant. Amber when less than a fifth is left, red when it's
   used up. Hover for the split (words / pictures / notes search) and when
   the day ends. */

export default function TokenMeter({ className = "" }) {
  const usage = useAiStore((s) => s.usage);
  if (!usage) return null;
  const { used, daily_limit: limit, left, words, pictures, search, resets_in_minutes: resets } = usage;
  const ink = limit == null ? "text-ink-faded" : left === 0 ? "text-bad" : left < limit / 5 ? "text-warn" : "text-ink-faded";
  const title = [
    `Today: ${tokens(used)} tokens${limit == null ? " (no daily limit)" : ` of ${tokens(limit)}, ${tokens(left)} left`}`,
    `words ${tokens(words)} · pictures ${tokens(pictures)} · notes search ${tokens(search)}`,
    `A new day starts at midnight, in ${untilMidnight(resets)}. The limit is in Settings → AI & API keys.`,
  ].join("\n");
  return (
    <span className={`whitespace-nowrap text-xs italic ${ink} ${className}`} title={title}>
      today {shortTokens(used)}
      {limit != null && <> of {shortTokens(limit)}</>} tokens
      {left === 0 && " · used up"}
    </span>
  );
}
