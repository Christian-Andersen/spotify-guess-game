export function normalizeTitle(title: string): string {
  return (
    title
      // Remove parenthetical content: (feat. Artist), (Remastered 2011), etc.
      .replace(/\([^)]*\)/g, "")
      // Remove bracketed content: [Remastered], [Deluxe Edition], etc.
      .replace(/\[[^\]]*\]/g, "")
      // Remove common suffixes: "- 2011 Remaster", "– Remastered 2011"
      .replace(/[-–—]\s*(?:remaster(?:ed)?\s*)?(?:\d{4})?(?:\s*remaster(?:ed)?)?/gi, "")
      // Remove standalone remaster tags: "Remastered 2011", "2011 Remaster"
      .replace(/\d{4}\s+remaster(?:ed)?/gi, "")
      .replace(/remaster(?:ed)?\s+\d{4}/gi, "")
      .replace(/remaster(?:ed)?(?=\s*$)/gi, "")
      // Remove featuring / ft. info that might appear without parentheses
      .replace(/\bfeat\.?\s*\S+/gi, "")
      .replace(/\bft\.?\s*\S+/gi, "")
      // Remove music video / audio suffixes
      .replace(/\b(?:official\s+)?(?:music\s+video|audio|lyric\s+video|video)\b/gi, "")
      // Remove trailing year in parentheses or standalone
      .replace(/\b\d{4}\b/g, "")
      // Strip punctuation except apostrophes
      .replace(/[^\w\s']/g, "")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  );
}
