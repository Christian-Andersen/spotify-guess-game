import Fuse from "fuse.js";
import { normalizeTitle } from "./normalizer";

export function computeMatchScore(
  guess: string,
  answer: string,
): { similarity: number; exact: boolean } {
  const normalizedGuess = normalizeTitle(guess);
  const normalizedAnswer = normalizeTitle(answer);

  if (!normalizedGuess || !normalizedAnswer) {
    return { similarity: 0, exact: false };
  }

  if (normalizedGuess === normalizedAnswer) {
    return { similarity: 1, exact: true };
  }

  // Check if guess is a substring of the answer (or vice versa)
  if (
    normalizedAnswer.includes(normalizedGuess) ||
    normalizedGuess.includes(normalizedAnswer)
  ) {
    const shorter = Math.min(normalizedGuess.length, normalizedAnswer.length);
    const longer = Math.max(normalizedGuess.length, normalizedAnswer.length);
    return { similarity: shorter / longer, exact: false };
  }

  const fuse = new Fuse([normalizedAnswer], {
    includeScore: true,
    threshold: 1.0,
    distance: 1000,
    ignoreLocation: true,
  });

  const results = fuse.search(normalizedGuess);

  if (results.length === 0) {
    return { similarity: 0, exact: false };
  }

  const similarity = 1 - (results[0].score ?? 1);
  return { similarity: Math.max(0, similarity), exact: false };
}

export function getRoundPoints(
  similarity: number,
  exact: boolean,
): number {
  if (exact) return 3;
  if (similarity >= 0.8) return 2;
  if (similarity >= 0.5) return 1;
  return 0;
}
