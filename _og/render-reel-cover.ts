// Renders a vertical 1080×1920 video cover for a tip — one image that works
// for YouTube Shorts, Instagram Reels, and TikTok (all 9:16).
//
// Extracts a frame from the source video with ffmpeg, drops it behind a
// neo-style floating card (red "Tip N" badge + italic title + @256tipsdev),
// screenshots via headless Chrome, and crops/compresses to JPG.
//
// Run via:
//   deno task reel-cover <slug> --video <path> [--at <seconds>]
//
// Frame timestamp precedence: --at flag > `cover_at` front matter > 1.0s.
// Output: _covers/<slug>.jpg  (gitignored — these are upload assets).

const TEMPLATE_PATH = "_og/reel-cover.html";
const TIPS_DIR = "256tipsdev";
const TMP_DIR = "_og/.tmp-reel";
const OUT_DIR = "_covers";
const DEFAULT_AT = 1.0;
const WIDTH = 1080;
const HEIGHT = 1920;
// Chrome headless reserves ~90px of height; oversize then crop the top-left.
const WINDOW_HEIGHT = HEIGHT + 90;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Wrap terminal punctuation in a red span, or append a red period — the brand's
// "Akhmetov.", "256." kiss. Mirrors the helper in render-tip-cards.ts.
function buildTitleHtml(title: string): string {
  const trimmed = title.trim();
  const last = trimmed.slice(-1);
  if (/[.!?]/.test(last)) {
    return `${escapeHtml(trimmed.slice(0, -1))}<span class="red">${escapeHtml(last)}</span>`;
  }
  return `${escapeHtml(trimmed)}<span class="red">.</span>`;
}

function parseFrontmatter(raw: string): Record<string, string> {
  const m = raw.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  const fm: Record<string, string> = {};
  if (!m) return fm;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.+?)\s*$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["'](.*)["']$/, "$1");
  }
  return fm;
}

async function run(cmd: string, args: string[]): Promise<void> {
  const out = await new Deno.Command(cmd, { args, stdout: "piped", stderr: "piped" }).output();
  if (!out.success) {
    throw new Error(`${cmd} failed: ${new TextDecoder().decode(out.stderr)}`);
  }
}

// --- Parse args ------------------------------------------------------------

const args = Deno.args;
const positional: string[] = [];
let videoPath: string | undefined;
let atFlag: string | undefined;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--video") videoPath = args[++i];
  else if (args[i] === "--at") atFlag = args[++i];
  else positional.push(args[i]);
}
const slug = positional[0]?.replace(/\.md$/, "");

if (!slug || !videoPath) {
  console.error(
    "Usage: deno task reel-cover <slug> --video <path> [--at <seconds>]",
  );
  Deno.exit(1);
}

const mdPath = `${TIPS_DIR}/${slug}.md`;
let raw: string;
try {
  raw = await Deno.readTextFile(mdPath);
} catch {
  console.error(`No tip found at ${mdPath}`);
  Deno.exit(1);
}
const fm = parseFrontmatter(raw);
if (!fm.tip_number || !fm.title) {
  console.error(`${mdPath} is missing tip_number or title`);
  Deno.exit(1);
}

const at = atFlag ?? fm.cover_at ?? String(DEFAULT_AT);

try {
  await Deno.stat(videoPath);
} catch {
  console.error(`Video not found: ${videoPath}`);
  Deno.exit(1);
}

// --- Render ----------------------------------------------------------------

await Deno.mkdir(TMP_DIR, { recursive: true });
await Deno.mkdir(OUT_DIR, { recursive: true });

const cwd = Deno.cwd();
const framePath = `${cwd}/${TMP_DIR}/frame.png`;
const tmpHtml = `${TMP_DIR}/${slug}.html`;
const tmpPng = `${TMP_DIR}/${slug}.png`;
const outJpg = `${OUT_DIR}/${slug}.jpg`;

console.log(`Extracting frame at ${at}s from ${videoPath}…`);
await run("ffmpeg", [
  "-y",
  "-ss", at,
  "-i", videoPath,
  "-frames:v", "1",
  "-q:v", "2",
  framePath,
]);

const template = await Deno.readTextFile(TEMPLATE_PATH);
const html = template
  .replaceAll("__FRAME_URL__", `file://${framePath}`)
  .replaceAll("__TIP_NUMBER__", fm.tip_number)
  .replaceAll("__TIP_TITLE__", buildTitleHtml(fm.title));
await Deno.writeTextFile(tmpHtml, html);

await run("google-chrome", [
  "--headless",
  "--disable-gpu",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  `--window-size=${WIDTH},${WINDOW_HEIGHT}`,
  `--screenshot=${tmpPng}`,
  `file://${cwd}/${tmpHtml}`,
]);

await run("magick", [
  tmpPng,
  "-crop", `${WIDTH}x${HEIGHT}+0+0`,
  "+repage", "-strip",
  "-quality", "90",
  "-sampling-factor", "4:2:0",
  "-interlace", "JPEG",
  outJpg,
]);

await Deno.remove(TMP_DIR, { recursive: true });
console.log(`Rendered: ${outJpg}  (Tip ${fm.tip_number} — ${fm.title})`);
