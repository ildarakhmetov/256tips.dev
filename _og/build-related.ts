// Computes the "Related Tips" index for 256tipsdev, offline.
//
// Walks 256tipsdev/*.md, embeds each tip's text via OpenRouter (incrementally,
// reusing a local cache keyed by content hash), computes the top-K cosine
// neighbors, and writes a small committed index that the Lume build consumes.
//
// Run via: deno task related   (requires OPENROUTER_API_KEY when anything is
// new or changed; an all-cache-hit run needs no key and no network).
//
// Outputs:
//   _og/related.json          committed — { "<slug>": [ { slug, tip_number } ] }
//   _og/.cache/tip-embeddings.json   gitignored — { "<slug>": { hash, embedding } }

import {
  buildEmbeddingText,
  contentHash,
  type Neighbor,
  topKNeighbors,
} from "../_lib/related-tips.ts";

const TIPS_DIR = "256tipsdev";
const OUT_PATH = "_og/related.json";
const CACHE_PATH = "_og/.cache/tip-embeddings.json";
const MODEL = "openai/text-embedding-3-small";
const DIMENSIONS = 512;
const TOP_K = 3;

interface Tip {
  slug: string;
  tipNumber: number;
  title: string;
  description: string;
  body: string;
  embedText: string;
  hash: string;
}

interface CacheEntry {
  hash: string;
  embedding: number[];
}

function frontmatterValue(fm: string, key: string): string {
  const m = fm.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m"));
  if (!m) return "";
  return m[1].replace(/^["'](.*)["']$/, "$1");
}

function parseTip(slug: string, raw: string): Tip | null {
  const m = raw.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const [, fm, body] = m;
  const tipNumber = Number(frontmatterValue(fm, "tip_number"));
  const title = frontmatterValue(fm, "title");
  if (!Number.isFinite(tipNumber) || !title) return null;
  return {
    slug,
    tipNumber,
    title,
    description: frontmatterValue(fm, "description"),
    body,
    embedText: "",
    hash: "",
  };
}

async function readCache(): Promise<Record<string, CacheEntry>> {
  try {
    return JSON.parse(await Deno.readTextFile(CACHE_PATH));
  } catch {
    return {};
  }
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) {
    console.error(
      `OPENROUTER_API_KEY is not set, but ${texts.length} tip(s) need ` +
        `embedding. Set the key and re-run, e.g.:\n` +
        `  OPENROUTER_API_KEY=[your-key] deno task related`,
    );
    Deno.exit(1);
  }
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ildarakhmetov.com/",
      "X-Title": "256 Tips for Junior Devs",
    },
    body: JSON.stringify({ model: MODEL, input: texts, dimensions: DIMENSIONS }),
  });
  if (!res.ok) {
    throw new Error(
      `OpenRouter embeddings failed: ${res.status} ${await res.text()}`,
    );
  }
  const json = await res.json();
  // Sort by `index` so the order matches `texts`, regardless of response order.
  const data = (json.data as { index: number; embedding: number[] }[])
    .slice()
    .sort((a, b) => a.index - b.index);
  if (data.length !== texts.length) {
    throw new Error(
      `expected ${texts.length} embeddings, got ${data.length}`,
    );
  }
  return data.map((d) => d.embedding);
}

// --- Load tips -------------------------------------------------------------

const tips: Tip[] = [];
for await (const entry of Deno.readDir(TIPS_DIR)) {
  if (!entry.isFile || !entry.name.endsWith(".md")) continue;
  const slug = entry.name.replace(/\.md$/, "");
  const tip = parseTip(slug, await Deno.readTextFile(`${TIPS_DIR}/${entry.name}`));
  if (!tip) {
    console.warn(`Skipping ${entry.name}: missing tip_number or title`);
    continue;
  }
  tip.embedText = buildEmbeddingText(tip.title, tip.description, tip.body);
  tip.hash = await contentHash(tip.embedText);
  tips.push(tip);
}

// --- Embed (incrementally) -------------------------------------------------

const cache = await readCache();
const vectors = new Map<string, number[]>();
const stale = tips.filter((t) => cache[t.slug]?.hash !== t.hash);

if (stale.length > 0) {
  console.log(`Embedding ${stale.length} new/changed tip(s) via ${MODEL}…`);
  const embeddings = await embedBatch(stale.map((t) => t.embedText));
  stale.forEach((t, i) => {
    cache[t.slug] = { hash: t.hash, embedding: embeddings[i] };
  });
} else {
  console.log("All tips are cache hits — no embedding call needed.");
}

// Drop cache entries for deleted tips, and collect vectors for current tips.
const liveSlugs = new Set(tips.map((t) => t.slug));
for (const slug of Object.keys(cache)) {
  if (!liveSlugs.has(slug)) delete cache[slug];
}
for (const t of tips) vectors.set(t.slug, cache[t.slug].embedding);

// --- Compute neighbors -----------------------------------------------------

const tipNumberBySlug = new Map(tips.map((t) => [t.slug, t.tipNumber]));
const index: Record<string, { slug: string; tip_number: number }[]> = {};
for (const t of tips) {
  index[t.slug] = topKNeighbors(t.slug, vectors, TOP_K).map((n: Neighbor) => ({
    slug: n.slug,
    tip_number: tipNumberBySlug.get(n.slug)!,
  }));
}

// --- Write -----------------------------------------------------------------

await Deno.mkdir("_og/.cache", { recursive: true });
await Deno.writeTextFile(CACHE_PATH, JSON.stringify(cache));
await Deno.writeTextFile(OUT_PATH, JSON.stringify(index, null, 2) + "\n");

console.log(
  `Wrote ${OUT_PATH} — ${tips.length} tips, top ${TOP_K} related each.`,
);
