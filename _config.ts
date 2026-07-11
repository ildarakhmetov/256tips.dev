import lume from "lume/mod.ts";
import tailwindcss from "lume/plugins/tailwindcss.ts";
import markdown from "lume/plugins/markdown.ts";
import date from "lume/plugins/date.ts";
import metas from "lume/plugins/metas.ts";
import picture from "lume/plugins/picture.ts";
import transformImages from "lume/plugins/transform_images.ts";
import sitemap from "lume/plugins/sitemap.ts";
import feed from "lume/plugins/feed.ts";

// Use environment variable for location, or default to production URL
const siteUrl = Deno.env.get("SITE_URL") || "https://256tips.dev/";

const site = lume({
  location: new URL(siteUrl),
});

site.use(tailwindcss());
site.use(markdown());
site.use(date());
site.use(picture());
site.use(transformImages());
site.use(metas());
site.use(sitemap());
site.use(feed({
  output: ["/feed.xml"],
  query: "tip",
  sort: "date=desc",
  limit: 20,
  info: {
    title: "256 Tips for Developers",
    description:
      "256 short, practical tips for junior developers — one at a time.",
  },
  items: {
    title: "=title",
    description: "=description",
  },
}));

// Pre-computed "Related Tips" index, produced offline by `deno task related`
// (_og/build-related.ts) from OpenRouter embeddings. Read explicitly here
// rather than from _data/ so it isn't auto-exposed as a global (which would
// collide with the `related` front-matter override). Missing file is fine —
// the site builds without related links until the task is first run.
type RelatedRef = { slug: string; tip_number: number };
let relatedIndex: Record<string, RelatedRef[]> = {};
try {
  relatedIndex = JSON.parse(await Deno.readTextFile("_og/related.json"));
} catch {
  // no index yet
}

// Escape a string for safe use inside an HTML attribute value. Vento does not
// auto-escape interpolations, so titles containing quotes (e.g. Tip 240's
// `"+1"`) would otherwise break `attr="{{ ... }}"`.
site.filter("attr", (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;"));

// Add the CSS file to be processed
site.add("styles.css");
site.copy("assets");

site.ignore("CLAUDE.md", "LICENSE.md", "README.md");

site.preprocess([".html"], (pages) => {
  // Tips live at the domain root: /<slug>/ → "<slug>".
  const tipUrlSlug = (url: unknown) =>
    typeof url === "string" ? url.replace(/^\//, "").replace(/\/$/, "") : "";
  type TipRef = { url: string; title: string; tip_number: number };
  const tipBySlug = new Map<string, TipRef>();
  const slugByNumber = new Map<number, string>();
  for (const page of pages) {
    const d = page.data;
    if (d.layout !== "tip.vto" || typeof d.url !== "string") continue;
    const slug = tipUrlSlug(d.url);
    const ref: TipRef = {
      url: d.url,
      title: String(d.title ?? ""),
      tip_number: Number(d.tip_number),
    };
    tipBySlug.set(slug, ref);
    if (Number.isFinite(ref.tip_number)) slugByNumber.set(ref.tip_number, slug);
  }

  for (const page of pages) {
    const data = page.data;
    // SEO title suffix everywhere except the homepage.
    if (data.url !== "/" && data.title) {
      if (!data.metas) {
        data.metas = {};
      }
      data.metas.title = `${data.title} | 256 Tips for Developers`;
    }

    // Auto-wire per-tip Open Graph cards. `deno task tip-cards` renders
    // /assets/img/og/tips/<slug>.jpg from each tip's title + tip_number;
    // this hook surfaces it via metas plugin as og:image.
    if (
      data.layout === "tip.vto" && !data.thumbnail &&
      typeof data.url === "string"
    ) {
      const slug = tipUrlSlug(data.url);
      if (slug) data.thumbnail = `/assets/img/og/tips/${slug}.jpg`;
    }

    // Resolve "Related Tips" for the page. A `related: [N, M]` front-matter
    // array (tip_numbers) overrides; otherwise fall back to the embedding
    // index. Either way, resolve to live {url, title, tip_number} refs and
    // skip anything that doesn't point at a real tip.
    if (data.layout === "tip.vto" && typeof data.url === "string") {
      const slug = tipUrlSlug(data.url);
      const refs = Array.isArray(data.related)
        ? (data.related as number[])
          .map((n) => slugByNumber.get(Number(n)))
          .filter((s): s is string => !!s)
          .map((s) => tipBySlug.get(s)!)
        : (relatedIndex[slug] ?? [])
          .map((r) => tipBySlug.get(r.slug))
          .filter((r): r is TipRef => !!r);
      data.relatedTips = refs;
    }
  }
});

export default site;
