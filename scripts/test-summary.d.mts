export function skippedCounts(output: string): number[];
export function lineCoverage(output: string): number | null;
export function coverageVerdict(output: string, floor: number): { ok: boolean; message: string };
