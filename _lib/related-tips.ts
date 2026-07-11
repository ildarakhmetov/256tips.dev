/**
 * Pure helpers for the "Related Tips" feature.
 *
 * Relatedness between 256tipsdev tips is computed offline from OpenRouter
 * embeddings (see _og/build-related.ts). This module holds the dependency-free,
 * testable pieces: text preparation, content hashing (for the embedding cache),
 * cosine similarity, and top-K neighbor selection.
 */

/**
 * Strip Markdown/HTML down to plain prose so embeddings reflect meaning, not
 * syntax. Mirrors the regex chain used for reading-time in _config.ts.
 */
export function stripMarkdown(md: string): string {
  return String(md ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // keep link text, drop target
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build the text fed to the embedding model for a single tip. Title and
 * description carry the most signal, so they lead, followed by the prose body.
 */
export function buildEmbeddingText(
  title: string,
  description: string,
  body: string,
): string {
  return [
    String(title ?? "").trim(),
    String(description ?? "").trim(),
    stripMarkdown(body),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** SHA-256 hex digest of `text`, used to detect when a tip needs re-embedding. */
export async function contentHash(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Cosine similarity of two equal-length vectors. Returns 0 for a zero vector. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface Neighbor {
  slug: string;
  score: number;
}

/**
 * Top-K most similar tips to `slug`, by cosine similarity, excluding itself.
 * Brute force over the whole set (≤256 tips, so trivially fast). Ties break on
 * slug for deterministic output.
 */
export function topKNeighbors(
  slug: string,
  vectors: Map<string, number[]>,
  k: number,
): Neighbor[] {
  const target = vectors.get(slug);
  if (!target) return [];
  const scored: Neighbor[] = [];
  for (const [other, vec] of vectors) {
    if (other === slug) continue;
    scored.push({ slug: other, score: cosineSimilarity(target, vec) });
  }
  scored.sort((a, b) =>
    b.score - a.score || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
  );
  return scored.slice(0, k);
}
