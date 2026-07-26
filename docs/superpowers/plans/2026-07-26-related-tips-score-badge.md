# Related Tips Cosine Score Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each related tip's cosine similarity as a monospace `cos θ = 0.512` badge on the Related Tips cards.

**Architecture:** The score already exists in `topKNeighbors()` but is dropped when `_og/build-related.ts` writes `_og/related.json`. We add a 3-decimal rounding helper in `_lib/related-tips.ts`, persist the rounded score in the JSON index, carry it through `_config.ts` onto `data.relatedTips`, and render it in `_includes/tip.vto`. The `score` field is optional everywhere, so an old-format index or a `related:` front-matter override still builds and simply shows no badge.

**Tech Stack:** Deno, Lume 3 (static site generator), Vento templates, Tailwind CSS. Tests use Deno's native test runner with `jsr:@std/assert`.

**Spec:** `docs/superpowers/specs/2026-07-26-related-tips-score-badge-design.md`

## Global Constraints

- All commands run from the repo root: `/home/ildar/sites/256tips.dev`.
- Run tests with `deno task test`; build with `deno task build`.
- Do NOT push to `main` — pushing deploys to production. Commit locally only.
- Scores are rounded to exactly 3 decimal places in `related.json`.
- The design system uses sharp corners (`border-4 border-black`, no `rounded-*` classes) and heavy font weights.
- Regenerating `related.json` needs no API key: embeddings are cached in `_og/.cache/` and no tip content changes in this work. If `deno task related` unexpectedly reports cache misses, STOP and report — do not paste any API key.

---

### Task 1: `roundScore` helper (TDD)

**Files:**
- Modify: `_lib/related-tips.ts` (append new function at end of file)
- Test: `_lib/related-tips_test.ts` (append new test at end of file)

**Interfaces:**
- Consumes: nothing new.
- Produces: `export function roundScore(score: number): number` — rounds to 3 decimal places (`0.51234 → 0.512`). Task 2 imports it from `../_lib/related-tips.ts`.

- [ ] **Step 1: Write the failing test**

Append to `_lib/related-tips_test.ts`:

```ts
Deno.test("roundScore - rounds to 3 decimals", () => {
  assertEquals(roundScore(0.51234), 0.512);
  assertEquals(roundScore(0.5), 0.5);
  assertEquals(roundScore(0.9995), 1);
  assertEquals(roundScore(0), 0);
  assertEquals(roundScore(-0.12345), -0.123);
});
```

Also add `roundScore` to the existing import block at the top of the test file:

```ts
import {
  buildEmbeddingText,
  contentHash,
  cosineSimilarity,
  roundScore,
  stripMarkdown,
  topKNeighbors,
} from "./related-tips.ts";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `deno task test`
Expected: FAIL — the module has no export named `roundScore` (a type/compile error counts as the failing state).

- [ ] **Step 3: Write minimal implementation**

Append to `_lib/related-tips.ts`:

```ts
/**
 * Round a similarity score to 3 decimal places for the committed index —
 * enough precision to compare neighbors, stable across recomputes (no float
 * noise in diffs).
 */
export function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `deno task test`
Expected: PASS (all tests, including the new `roundScore` test).

- [ ] **Step 5: Commit**

```bash
git add _lib/related-tips.ts _lib/related-tips_test.ts
git commit -m "feat: add roundScore helper for related-tips index"
```

---

### Task 2: Persist score in `related.json`

**Files:**
- Modify: `_og/build-related.ts` (neighbor-mapping block, around lines 155–161)
- Regenerate: `_og/related.json` (via `deno task related`)

**Interfaces:**
- Consumes: `roundScore(score: number): number` from `_lib/related-tips.ts` (Task 1).
- Produces: `_og/related.json` entries of shape `{ slug: string; tip_number: number; score: number }`. Task 3 reads this shape in `_config.ts`.

- [ ] **Step 1: Add `roundScore` to the import**

In `_og/build-related.ts`, the import block from `../_lib/related-tips.ts` (near the top, around line 13) currently includes `topKNeighbors`, `type Neighbor`, etc. Add `roundScore` to it:

```ts
import {
  buildEmbeddingText,
  contentHash,
  type Neighbor,
  roundScore,
  topKNeighbors,
} from "../_lib/related-tips.ts";
```

(Keep whatever names are already imported there — only add `roundScore`, alphabetically ordered.)

- [ ] **Step 2: Persist the score in the index**

Replace this block in `_og/build-related.ts`:

```ts
const index: Record<string, { slug: string; tip_number: number }[]> = {};
for (const t of tips) {
  index[t.slug] = topKNeighbors(t.slug, vectors, TOP_K).map((n: Neighbor) => ({
    slug: n.slug,
    tip_number: tipNumberBySlug.get(n.slug)!,
  }));
}
```

with:

```ts
const index: Record<
  string,
  { slug: string; tip_number: number; score: number }[]
> = {};
for (const t of tips) {
  index[t.slug] = topKNeighbors(t.slug, vectors, TOP_K).map((n: Neighbor) => ({
    slug: n.slug,
    tip_number: tipNumberBySlug.get(n.slug)!,
    score: roundScore(n.score),
  }));
}
```

- [ ] **Step 3: Regenerate the index**

Run: `deno task related`
Expected output includes: `All tips are cache hits — no embedding call needed.` followed by `Wrote _og/related.json — <N> tips, top 3 related each.`

If it instead reports cache misses / asks for `OPENROUTER_API_KEY`, STOP and report back — something is off with the cache and no content should have changed.

- [ ] **Step 4: Verify the new JSON shape**

Run: `head -12 _og/related.json`
Expected: every neighbor entry now has a `score` field with ≤3 decimals, e.g.:

```json
{
  "algorithms-in-everyday-things": [
    {
      "slug": "think-about-yourself-in-1-2-5-10-50-years",
      "tip_number": 200,
      "score": 0.464
    },
```

(Exact score values will differ; only the shape matters.) Also confirm scores are descending within each tip's list — `topKNeighbors` sorts best-first.

- [ ] **Step 5: Run tests and build to confirm nothing breaks**

Run: `deno task test && deno task build`
Expected: tests PASS, build succeeds (the extra `score` field is ignored by the current `_config.ts` — that's fine until Task 3).

- [ ] **Step 6: Commit**

```bash
git add _og/build-related.ts _og/related.json
git commit -m "feat: persist cosine similarity scores in related.json"
```

---

### Task 3: Carry score through `_config.ts` and render badge in `tip.vto`

**Files:**
- Modify: `_config.ts` (the `RelatedRef` type around line 46, and the relatedTips resolution block around lines 112–127)
- Modify: `_includes/tip.vto` (the Related Tips card, around lines 71–76)

**Interfaces:**
- Consumes: `_og/related.json` entries `{ slug, tip_number, score }` (Task 2).
- Produces: `data.relatedTips` items of shape `{ url: string; title: string; tip_number: number; score?: number }`, read by `_includes/tip.vto`.

- [ ] **Step 1: Widen the `RelatedRef` type in `_config.ts`**

Change:

```ts
type RelatedRef = { slug: string; tip_number: number };
```

to:

```ts
type RelatedRef = { slug: string; tip_number: number; score?: number };
```

(`score` is optional so an old-format `related.json` still type-checks and builds.)

- [ ] **Step 2: Attach the score when resolving index entries**

In the relatedTips resolution block, the fallback branch currently reads:

```ts
        : (relatedIndex[slug] ?? [])
          .map((r) => tipBySlug.get(r.slug))
          .filter((r): r is TipRef => !!r);
```

Replace it with:

```ts
        : (relatedIndex[slug] ?? [])
          .map((r) => {
            const tip = tipBySlug.get(r.slug);
            return tip ? { ...tip, score: r.score } : undefined;
          })
          .filter((r): r is TipRef & { score?: number } => !!r);
```

Leave the `related:` front-matter override branch (the `Array.isArray(data.related)` side) untouched — those refs carry no score by design.

- [ ] **Step 3: Render the badge in `_includes/tip.vto`**

The related card currently reads:

```vto
      <a href="{{ related.url }}" class="block p-4 border-4 border-black bg-white hover:bg-neo-yellow shadow-neo transition-colors">
        <div class="text-xs font-bold opacity-60 mb-1">Tip {{ related.tip_number }}</div>
        <div class="font-black">{{ related.title }}</div>
      </a>
```

Replace the header `<div>` so it becomes a flex row with the score right-aligned:

```vto
      <a href="{{ related.url }}" class="block p-4 border-4 border-black bg-white hover:bg-neo-yellow shadow-neo transition-colors">
        <div class="mb-1 flex items-baseline justify-between gap-2 text-xs opacity-60">
          <span class="font-bold">Tip {{ related.tip_number }}</span>
          {{ if related.score !== undefined }}
          <span class="font-mono">cos θ = {{ related.score.toFixed(3) }}</span>
          {{ /if }}
        </div>
        <div class="font-black">{{ related.title }}</div>
      </a>
```

Notes for the implementer:
- Vento interpolations are raw JS expressions, so `related.score.toFixed(3)` works directly.
- `θ` is a literal UTF-8 character; the layout already serves UTF-8.
- No `rounded-*` classes, per the design system.

- [ ] **Step 4: Build and verify the badge is in the output**

Run: `deno task test && deno task build`
Expected: tests PASS, build succeeds.

Then run: `grep -o "cos θ = 0\.[0-9]*" _site/algorithms-in-everyday-things/index.html | head -3`
Expected: three matches like `cos θ = 0.464` (values will differ), matching the tip's entries in `_og/related.json`.

- [ ] **Step 5: Visual check in the dev server**

Run `deno task serve` in the background, open `http://localhost:3000/algorithms-in-everyday-things/` (Lume's default port; use whatever port the serve output prints), and confirm on the Related Tips cards:
- "Tip N" on the left, `cos θ = 0.512`-style badge right-aligned on the same line, monospace, same muted opacity.
- Card hover (yellow) still works; title below unchanged.
- Narrow viewport (~375px): the badge wraps or shrinks gracefully without overflowing the card border.

Stop the server when done. If a browser isn't available, a careful read of the built HTML plus the grep in Step 4 is an acceptable substitute — say so in the report.

- [ ] **Step 6: Commit**

```bash
git add _config.ts _includes/tip.vto
git commit -m "feat: show cosine similarity badge on Related Tips cards"
```

---

### Task 4: Final verification

**Files:** none modified.

**Interfaces:** none.

- [ ] **Step 1: Full test + build from a clean state**

Run: `deno task test && deno task build`
Expected: all tests PASS; build succeeds with no new warnings.

- [ ] **Step 2: Spot-check a second tip page and the no-score paths**

- `grep -c "cos θ" _site/become-antifragile/index.html` → expected `3`.
- Confirm the homepage is untouched: `grep -c "cos θ" _site/index.html` → expected `0` (grep exits 1; that's the pass condition).

- [ ] **Step 3: Confirm working tree is clean and report**

Run: `git status`
Expected: clean (all changes committed in Tasks 1–3). Do NOT push — the user pushes to `main` when they're ready to ship.
