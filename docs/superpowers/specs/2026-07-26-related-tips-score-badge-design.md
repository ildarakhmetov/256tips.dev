# Related Tips: Cosine Similarity Score Badge

**Date:** 2026-07-26
**Status:** Approved

## Goal

Make the "Related Tips" section on tip pages nerdier by showing the actual
cosine similarity score for each related tip, rendered as a small monospace
badge: `cos θ = 0.512`. No bar, no percentage, no graph — raw score only.

## Background

Relatedness is computed offline by `deno task related`
(`_og/build-related.ts`) from OpenRouter embeddings. `topKNeighbors()` in
`_lib/related-tips.ts` already returns `{slug, score}` per neighbor, but
`build-related.ts` currently drops the score when writing `_og/related.json`
(entries are `{slug, tip_number}` only). The score exists — it just isn't
persisted or displayed.

Embeddings are cached in `_og/.cache/` (keyed by content hash), so
regenerating the index with a new format requires **no API calls** when no
tip content changed.

## Changes

### 1. `_lib/related-tips.ts` — rounding helper

Add a pure helper `roundScore(score: number): number` that rounds to 3
decimal places (e.g. `0.51234…` → `0.512`). Three decimals keeps
`related.json` diffs stable and free of float noise while preserving enough
precision to distinguish neighbors.

### 2. `_og/build-related.ts` — persist the score

Index entries become:

```json
{ "slug": "…", "tip_number": 200, "score": 0.512 }
```

using `roundScore()`. After the code change, run `deno task related` once to
regenerate `_og/related.json` (cache hit — no key/network needed) and commit
the JSON.

### 3. `_config.ts` — carry score through

- `RelatedRef` gains an optional `score?: number`.
- When resolving index entries to live tip refs for `data.relatedTips`,
  attach the entry's `score` to the resolved ref.
- The `related:` front-matter override path (hand-picked tip numbers) stays
  score-less; `score` remains `undefined` there. No tip currently uses the
  override.

### 4. `_includes/tip.vto` — render the badge

The related-card header line (currently just `Tip {{ tip_number }}`) becomes
a flex row:

- Left: `Tip 200` (unchanged styling).
- Right: `cos θ = 0.512` in `font-mono text-xs`, same muted opacity as the
  tip-number label.
- The badge renders only when `related.score !== undefined` — cards from a
  front-matter override (or a stale index without scores) render exactly as
  today.
- Format with 3 decimals (`toFixed(3)`).

## Error handling / edge cases

- **Old-format `related.json`** (no `score` field): builds fine; badges are
  simply absent. No hard dependency on the new field.
- **`related:` override:** cards render without badges.
- **Tip missing from index:** unchanged behavior — no Related section.

## Testing

- Add tests for `roundScore()` in `_lib/related-tips_test.ts` (typical value,
  already-round value, boundary rounding).
- Existing `topKNeighbors` tests already pin score computation.
- Manual check via `deno task serve`: badge visible on a tip page, aligned
  right, mono font.

## Out of scope

- Graph visualizations (per-tip mini constellation, site-wide graph page).
  The score-bearing JSON produced here is the data such a feature would
  consume later.
- OG card and homepage changes.
- Percentage or bar displays.
