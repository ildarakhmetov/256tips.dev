// Renders the Open Graph card for /256tipsdev/ archive page.
//
// Reads tip_number from each 256tipsdev/*.md, computes which 256-grid cells
// are filled, which 3 are teasers (next bit-reversal slots), and which are
// empty. Substitutes placeholders in _og/256tipsdev.html and screenshots.
//
// Run via: deno task archive-card

const TEMPLATE_PATH = "_og/256tipsdev.html";
const TIPS_DIR = "256tipsdev";
const TMP_DIR = "_og/.tmp-archive";
const OUT_PATH = "assets/img/og/256tipsdev.jpg";

// Bit-reverse 8 bits — matches the publication-order logic on 256tipsdev.vto
function bitReverse8(n: number): number {
  let r = 0;
  for (let i = 0; i < 8; i++) {
    r = (r << 1) | (n & 1);
    n >>>= 1;
  }
  return r;
}

function parseTipNumber(raw: string): number | undefined {
  const fmMatch = raw.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!fmMatch) return;
  const line = fmMatch[1].split(/\r?\n/).find((l) => /^tip_number:/.test(l));
  if (!line) return;
  const value = line.replace(/^tip_number:\s*/, "").trim();
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function run(cmd: string, args: string[]): Promise<void> {
  const out = await new Deno.Command(cmd, { args, stdout: "piped", stderr: "piped" }).output();
  if (!out.success) {
    throw new Error(`${cmd} failed: ${new TextDecoder().decode(out.stderr)}`);
  }
}

const filledNumbers = new Set<number>();
for await (const entry of Deno.readDir(TIPS_DIR)) {
  if (!entry.isFile || !entry.name.endsWith(".md")) continue;
  const raw = await Deno.readTextFile(`${TIPS_DIR}/${entry.name}`);
  const n = parseTipNumber(raw);
  if (n !== undefined) filledNumbers.add(n);
}

const shipped = filledNumbers.size;
const remaining = 256 - shipped;

// Next 3 bit-reversal slots for "coming soon" teasers
const teaserCount = Math.min(3, remaining);
const teaserNumbers = new Set<number>();
for (let i = 0; i < teaserCount; i++) {
  teaserNumbers.add(bitReverse8(shipped + i));
}

let cells = "";
for (let i = 0; i < 256; i++) {
  if (filledNumbers.has(i)) cells += '<span class="cell cell--filled"></span>';
  else if (teaserNumbers.has(i)) cells += '<span class="cell cell--teaser"></span>';
  else cells += '<span class="cell"></span>';
}

const template = await Deno.readTextFile(TEMPLATE_PATH);
const html = template
  .replaceAll("__GRID_CELLS__", cells)
  .replaceAll("__SHIPPED__", String(shipped))
  .replaceAll("__REMAINING__", String(remaining));

await Deno.mkdir(TMP_DIR, { recursive: true });
await Deno.mkdir("assets/img/og", { recursive: true });

const tmpHtml = `${TMP_DIR}/index.html`;
const tmpPng = `${TMP_DIR}/index.png`;
await Deno.writeTextFile(tmpHtml, html);

const cwd = Deno.cwd();
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
  OUT_PATH,
]);

await Deno.remove(TMP_DIR, { recursive: true });
console.log(`Rendered: ${OUT_PATH}  (${shipped} / 256 shipped, ${remaining} to go)`);
