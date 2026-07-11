// Renders per-tip Open Graph cards for /256tipsdev/<slug>/ pages.
//
// Walks 256tipsdev/*.md, reads frontmatter (tip_number, title), substitutes
// placeholders in _og/tip.html, screenshots each via headless Chrome, then
// crops + compresses to JPG into assets/img/og/tips/<slug>.jpg.
//
// Run via:
//   deno task tip-cards                 # render every tip card
//   deno task tip-cards <slug>          # render only one tip (the .md basename)
//
// When adding a single new tip, pass its slug so you don't re-render all cards.

const TEMPLATE_PATH = "_og/tip.html";
const TIPS_DIR = "256tipsdev";
const TMP_DIR = "_og/.tmp-tips";
const OUT_DIR = "assets/img/og/tips";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Wrap the title's terminal punctuation in a red span. If the title doesn't
// end with terminal punctuation, append a red period — matches the brand's
// "Akhmetov.", "Junior Devs.", "256." kiss.
function buildTitleHtml(title: string): string {
  const trimmed = title.trim();
  const last = trimmed.slice(-1);
  if (/[.!?]/.test(last)) {
    const rest = trimmed.slice(0, -1);
    return `${escapeHtml(rest)}<span class="red">${escapeHtml(last)}</span>`;
  }
  return `${escapeHtml(trimmed)}<span class="red">.</span>`;
}

interface TipFrontmatter {
  tip_number?: number;
  title?: string;
}

function parseFrontmatter(raw: string): TipFrontmatter | null {
  const match = raw.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!match) return null;
  const fm: TipFrontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.+?)\s*$/);
    if (!m) continue;
    const [, key, rawValue] = m;
    const value = rawValue.replace(/^["'](.*)["']$/, "$1");
    if (key === "tip_number") fm.tip_number = Number(value);
    else if (key === "title") fm.title = value;
  }
  return fm;
}

async function run(cmd: string, args: string[]): Promise<void> {
  const out = await new Deno.Command(cmd, { args, stdout: "piped", stderr: "piped" }).output();
  if (!out.success) {
    const stderr = new TextDecoder().decode(out.stderr);
    throw new Error(`${cmd} failed: ${stderr}`);
  }
}

// Optional CLI arg: a single tip slug (with or without the .md extension).
// When present, only that tip's card is rendered.
const targetSlug = Deno.args[0]?.replace(/\.md$/, "");

await Deno.mkdir(TMP_DIR, { recursive: true });
await Deno.mkdir(OUT_DIR, { recursive: true });

const template = await Deno.readTextFile(TEMPLATE_PATH);
const cwd = Deno.cwd();

let count = 0;
for await (const entry of Deno.readDir(TIPS_DIR)) {
  if (!entry.isFile || !entry.name.endsWith(".md")) continue;

  const slug = entry.name.replace(/\.md$/, "");
  if (targetSlug && slug !== targetSlug) continue;
  const raw = await Deno.readTextFile(`${TIPS_DIR}/${entry.name}`);
  const fm = parseFrontmatter(raw);

  if (!fm || fm.tip_number === undefined || !fm.title) {
    console.warn(`Skipping ${entry.name}: missing tip_number or title`);
    continue;
  }

  const html = template
    .replaceAll("__TIP_NUMBER__", String(fm.tip_number))
    .replaceAll("__TIP_TITLE__", buildTitleHtml(fm.title));

  const tmpHtml = `${TMP_DIR}/${slug}.html`;
  const tmpPng = `${TMP_DIR}/${slug}.png`;
  const outJpg = `${OUT_DIR}/${slug}.jpg`;

  await Deno.writeTextFile(tmpHtml, html);

  await run("google-chrome", [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1200,720",
    `--screenshot=${tmpPng}`,
    `file://${cwd}/${tmpHtml}`,
  ]);

  await run("magick", [
    tmpPng,
    "-crop", "1200x630+0+0",
    "+repage", "-strip",
    "-quality", "88",
    "-sampling-factor", "4:2:0",
    "-interlace", "JPEG",
    outJpg,
  ]);

  console.log(`Rendered: ${outJpg}  (Tip ${fm.tip_number} — ${fm.title})`);
  count++;
}

await Deno.remove(TMP_DIR, { recursive: true });

if (targetSlug && count === 0) {
  console.error(`No tip found for slug "${targetSlug}" in ${TIPS_DIR}/.`);
  Deno.exit(1);
}

console.log(`\nDone — rendered ${count} tip card${count === 1 ? "" : "s"}.`);
