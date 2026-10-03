export const skippedCounts = (output) =>
  [...output.matchAll(/^(?:ℹ|#)\s*skipped\s+(\d+)/gm)].map((match) => Number(match[1]));

// Linhas cobertas (%) da linha "all files" do relatório de cobertura do node --test; null se o relatório não veio.
export const lineCoverage = (output) => {
  const match = output.match(/^(?:ℹ|#)\s*all files\s*\|\s*(\d+(?:\.\d+)?)\s*\|/m);
  return match ? Number(match[1]) : null;
};

// Decide se a cobertura de linhas do relatório atende ao piso: sem relatório ou abaixo do piso não passa.
export const coverageVerdict = (output, floor) => {
  const coverage = lineCoverage(output);
  if (coverage === null) {
    return { ok: false, message: "O relatório de cobertura do backend não veio: verify não aceita testes sem medir a cobertura." };
  }
  if (coverage < floor) {
    return { ok: false, message: `Cobertura de linhas do backend em ${coverage}%, abaixo do piso de ${floor}%.` };
  }
  return { ok: true, message: `Cobertura de linhas do backend: ${coverage}% (piso ${floor}%).` };
};
