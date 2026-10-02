export const skippedCounts = (output) =>
  [...output.matchAll(/^(?:ℹ|#)\s*skipped\s+(\d+)/gm)].map((match) => Number(match[1]));
