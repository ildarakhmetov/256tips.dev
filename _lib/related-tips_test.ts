import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@^1";
import {
  buildEmbeddingText,
  contentHash,
  cosineSimilarity,
  stripMarkdown,
  topKNeighbors,
} from "./related-tips.ts";

Deno.test("stripMarkdown - removes code, markup, keeps link text", () => {
  const input =
    "# Title\n\nSome **bold** and `code` and a [link](https://x.com).\n\n```js\nconst x = 1;\n```";
  const out = stripMarkdown(input);
  assertEquals(out.includes("`"), false);
  assertEquals(out.includes("**"), false);
  assertEquals(out.includes("const x"), false);
  assertEquals(out.includes("https://x.com"), false);
  assertEquals(out.includes("link"), true);
  assertEquals(out.includes("Title"), true);
});

Deno.test("buildEmbeddingText - orders title, description, body and skips empties", () => {
  assertEquals(
    buildEmbeddingText("T", "D", "Body text"),
    "T\n\nD\n\nBody text",
  );
  assertEquals(buildEmbeddingText("T", "", "Body"), "T\n\nBody");
});

Deno.test("contentHash - stable and content-sensitive", async () => {
  const a = await contentHash("hello");
  const b = await contentHash("hello");
  const c = await contentHash("world");
  assertEquals(a, b);
  assertEquals(a.length, 64);
  assertEquals(a === c, false);
});

Deno.test("cosineSimilarity - identical, orthogonal, zero", () => {
  assertAlmostEquals(cosineSimilarity([1, 2, 3], [1, 2, 3]), 1);
  assertAlmostEquals(cosineSimilarity([1, 0], [0, 1]), 0);
  assertEquals(cosineSimilarity([0, 0], [1, 1]), 0);
});

Deno.test("cosineSimilarity - throws on length mismatch", () => {
  let threw = false;
  try {
    cosineSimilarity([1, 2], [1, 2, 3]);
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("topKNeighbors - ranks by similarity, excludes self, respects k", () => {
  const vectors = new Map<string, number[]>([
    ["a", [1, 0, 0]],
    ["b", [0.9, 0.1, 0]], // most similar to a
    ["c", [0, 1, 0]], // orthogonal to a
    ["d", [0, 0, 1]], // orthogonal to a
  ]);
  const result = topKNeighbors("a", vectors, 2);
  assertEquals(result.length, 2);
  assertEquals(result[0].slug, "b");
  assertEquals(result.some((n) => n.slug === "a"), false);
});

Deno.test("topKNeighbors - unknown slug returns empty", () => {
  const vectors = new Map<string, number[]>([["a", [1, 0]]]);
  assertEquals(topKNeighbors("missing", vectors, 3), []);
});
