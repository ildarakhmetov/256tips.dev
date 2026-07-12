# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The public site for **256 Tips for Developers** — short career/craft advice
for junior developers, one tip at a time, each with an accompanying YouTube
Short. Built with Deno + Lume (static site generator) and deployed to
Cloudflare at https://256tips.dev/. Code is MIT; the tips themselves are
CC BY-NC-ND 4.0 (see `LICENSE.md`).

The prose itself is drafted and edited upstream in a separate private writing
workspace (`~/writing/256tipsdev`); this repo is the **publish target** —
tips arrive here already finished.

## Tech Stack

- **Runtime:** Deno
- **Static Site Generator:** Lume 3.1.4
- **Templating:** Vento (`.vto` files)
- **Styling:** Tailwind CSS
- **Testing:** Deno's native test runner
- **Deployment:** Cloudflare Workers (static assets), via GitHub Actions

## Repository Structure

```
256tips.dev/
├── _config.ts           # Lume site configuration (plugins, related-tips wiring)
├── deno.json             # Deno tasks, imports, compiler options
├── wrangler.jsonc         # Cloudflare Workers config (custom domain routing)
├── styles.css             # Global CSS (Tailwind)
├── _data.yml               # Site-wide metas (title, description, image defaults)
├── _includes/                # Shared Vento layout templates
│   ├── layout.vto            # Main HTML wrapper (nav, fonts, styles)
│   ├── tip.vto                # Per-tip page layout
│   └── newsletter-signup.vto  # Shared signup snippet
├── _lib/                       # Custom TypeScript utilities
│   ├── related-tips.ts         # Cosine-similarity logic for "Related Tips"
│   └── related-tips_test.ts
├── 256tipsdev/                  # Markdown tips — one file per tip, this is the content
│   └── <slug>.md
├── _og/                          # Open Graph / social image render pipeline
│   ├── tip.html                  # Per-tip OG card template
│   ├── render-tip-cards.ts        # Renders 256tipsdev/*.md → assets/img/og/tips/<slug>.jpg
│   ├── 256tipsdev.html             # Archive/progress-grid OG card template
│   ├── render-archive-card.ts      # Renders assets/img/og/256tipsdev.jpg
│   ├── build-related.ts             # Computes _og/related.json from OpenRouter embeddings
│   ├── related.json                  # Committed output of build-related.ts (read by _config.ts)
│   ├── avatar.html / banner.html      # YouTube channel branding sources
│   └── reel-cover.html / render-reel-cover.ts  # Vertical 1080x1920 video covers
├── assets/                        # Static assets, including generated OG images
├── index.vto                       # Homepage — also the tip archive / progress grid
├── 404.md
└── .github/workflows/               # CI (PRs) + deploy (push to main)
```

## Development Commands

```bash
deno task serve    # Local dev server with watch mode
deno task build    # Production build to _site/
deno task test     # Run tests
deno task lume     # Run Lume CLI directly
```

## Key Conventions

### Tip Front Matter
Every tip in `256tipsdev/` requires:
```yaml
---
layout: tip.vto
title: "Tip Title in Title Case"
tip_number: 8
date: 2026-06-10 12:00:00
description: "One-sentence summary (SEO + the tip's own OG description)."
tags:
- tip            # always include `tip` — that's how pages are found
- career         # plus topical tags
url: /<slug>/
---
```

### Design System
The site uses a **neomorphic/retro** visual style:
- **Borders:** `border-4 border-black` (thick, no rounding)
- **Shadows:** `shadow-neo` or `shadow-neo-lg` (custom Tailwind utilities)
- **Colors:** custom `riso-red` and neo palette
- **Typography:** heavy weights (`font-black`, `font-bold`)
- Avoid `rounded-*` classes — the design intentionally uses sharp corners

## Publishing a New Tip

Tips live in `256tipsdev/<slug>.md` and use `layout: tip.vto`. New tips ship
roughly **biweekly**. Full procedure:

1. **Create the file** `256tipsdev/<slug>.md`. The filename slug **must equal**
   the `url` slug — `_config.ts` auto-derives each tip's `og:image` from its
   url (`/assets/img/og/tips/<slug>.jpg`), and the card renderer keys off the
   filename, so a mismatch breaks the social card. Front matter:
   ```yaml
   ---
   layout: tip.vto
   title: "Tip Title in Title Case"
   tip_number: 8
   date: 2026-06-10 12:00:00
   description: "One-sentence summary (SEO + the tip's own OG description)."
   tags:
   - tip            # always include `tip` — that's how pages are found
   - career         # plus topical tags
   url: /<slug>/
   ---
   ```
   - **`tip_number`** (0–255) is the tip's fixed *identity*, **not** its publish
     order. It only decides which cell the tip occupies in the 16×16 grid on
     the homepage/archive. Use the number the user gives.
   - **`date`** controls actual publish order — it drives the site's prev/next
     nav and the archive's "shipped" count. Use today's date (or the user's
     stated date).
   - **Omit `youtube_url` at creation.** The YouTube Short is published
     separately; the link is added in a *later, dedicated commit* (e.g. "add
     YouTube short link to tip N") once it's live.
   - Body is plain markdown.
   - **Cross-link other tips.** Tips are cross-listed: whenever the body
     mentions another tip (e.g. "see Tip 176"), make it a markdown link to
     that tip's `url` — `[Tip 176](/build-software-to-solve-your-own-problems/)`.
     Scan the body for any such references and find the target by its
     `tip_number` in `256tipsdev/*.md`. If the referenced tip doesn't exist
     yet, leave it as plain text (it can be linked once that tip ships).
   - **Optional `related:`** — a "Related Tips" section is normally
     auto-computed from embeddings (step 3). To hand-pick instead, add
     `related: [176, 16]` (an array of `tip_number`s); it overrides the
     computed list for that tip.
   - **Optional `cover_at:`** — the timestamp (in seconds, e.g.
     `cover_at: 3.5`) of the video frame to use for the vertical social cover
     (see "Vertical Video Covers" below). Optional; defaults to 1.0s and is
     overridable per run.

2. **Regenerate the two affected OG cards** (requires headless `google-chrome`
   **and** ImageMagick's `magick` on PATH):
   ```bash
   deno task tip-cards <slug>   # per-tip card → assets/img/og/tips/<slug>.jpg
   deno task archive-card       # homepage/archive grid card → assets/img/og/256tipsdev.jpg
   ```
   - Pass the slug to `tip-cards` to render **only the new tip** — omitting it
     re-renders every tip card.
   - Always run `archive-card` too: adding a tip changes the shipped/remaining
     counts and shifts the three "coming soon" teaser cells (computed by
     bit-reversal of the tip count).
   - Commit both generated JPGs alongside the new `.md`.

3. **Recompute the Related Tips index:**
   ```bash
   deno task related   # → _og/related.json
   ```
   - One-time setup: `cp .env.example .env` and put your key in `.env`
     (gitignored). The task loads it via `--env-file`, so no need to paste the
     key each run. (A raw `OPENROUTER_API_KEY=… deno task related` still works
     too.)
   - Embeds tips via OpenRouter (`openai/text-embedding-3-small`) and writes
     the top-3 cosine neighbors per tip. Adding a tip can change *other* tips'
     neighbors, so always re-run after a new tip.
   - Incremental: only new/changed tips hit the API (cache at `_og/.cache/`,
     gitignored). A no-change run needs no key or network. Cost is negligible
     (~$0.002 for the whole corpus).
   - **Commit `_og/related.json`** — the build reads it; CI never calls the
     API. A tip with no entry yet simply renders no Related section
     (graceful).
   - The pure logic lives in `_lib/related-tips.ts` (tested in
     `_lib/related-tips_test.ts`); wiring is in `_config.ts` (reads the index,
     resolves links, honors the `related:` override) and `_includes/tip.vto`
     (renders the section).

4. Preview with `deno task serve`.

5. Commit the new `.md` plus the two regenerated JPGs and `related.json`.
   Push to `main` only when ready to ship — see "Deployment" below.

## Open Graph Social Cards

Per-tip and archive social-share cards (LinkedIn, X, iMessage previews) are
wired through Lume's `metas` plugin. See "Publishing a New Tip" above for the
per-tip/archive card tasks (`tip-cards`, `archive-card`). `deno task avatar`
and `deno task banner` render the YouTube channel avatar/banner from
`_og/avatar.html` / `_og/banner.html` — only needed when that branding
changes, not part of the regular publish flow.

## Vertical Video Covers

Each tip's YouTube Short is cross-posted to Instagram Reels and TikTok — all
**9:16 (1080×1920)**, so one cover image serves all three. `deno task
reel-cover` generates a branded cover: it pulls a frame from the source video
and overlays a neo-style floating card (red `Tip N` badge + italic title +
handle), matching the OG cards.

```bash
deno task reel-cover <slug> --video <path-to-video> [--at <seconds>]
```

- **Requires `ffmpeg`** (frame extraction) plus the same headless
  `google-chrome` + ImageMagick `magick` used by the other render tasks.
- **Frame timestamp precedence:** `--at` flag → the tip's `cover_at` front
  matter → `1.0s` default.
- **Video isn't in the repo** — pass its local path each run (`--video`).
  Output goes to `_covers/<slug>.jpg` (gitignored; it's an upload asset, not
  site content).
- **Layout safe zones:** the card sits in the upper-middle, leaving the bottom
  ~30% clear for the platform caption/username UI and keeping clear of
  right-edge action buttons.
- Source of truth is `_og/reel-cover.html`; the renderer is
  `_og/render-reel-cover.ts`. Edit the HTML to change the design, then
  re-run.

## Deployment

**Pushing to `main` is production.** `.github/workflows/deploy.yml` runs on
every push to `main`:
1. `deno task test`
2. `deno task build` (site to `_site/`)
3. `npx -y wrangler@4 deploy` — deploys `_site/` as static assets to
   Cloudflare Workers (config in `wrangler.jsonc`, custom domain routing to
   `256tips.dev`)

The whole run takes roughly **~2 minutes**. There is no staging environment —
review locally with `deno task serve` before pushing, and only push on an
explicit go-ahead when publishing a tip.

Analytics is Cloudflare Web Analytics via a manual beacon snippet in
`_includes/layout.vto` — edge auto-injection does not reach Workers-served
HTML, so the `<script>` beacon there must be kept whenever the layout is
edited. The beacon token is public by design (it's client-side and only
identifies the site to Cloudflare's collector).

## Environment Variables

| Variable             | Default                | Purpose                         |
|-----------------------|-------------------------|---------------------------------|
| `SITE_URL`             | `https://256tips.dev/`   | Full base URL for the site |
| `OPENROUTER_API_KEY`   | _(none)_                 | Only for `deno task related` (tip embeddings). Not needed for build/deploy. |

## CI

`.github/workflows/ci.yml` runs `deno task test` + `deno task build` on every
pull request against `main` (no deploy step — that only runs on push to
`main`, see "Deployment").

## Dependency Management

Dependencies are locked in `deno.lock`. There is currently no automated
dependency-update workflow in this repo.

To update manually:
```bash
deno cache --reload _config.ts
```
