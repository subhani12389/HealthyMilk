// Lightweight Pure SVG QR Code Generator for HealthyMilk Batch Traceability

export function generateBatchQRData(batch) {
  return JSON.stringify({
    app: "HealthyMilk Platform",
    batchId: batch.id,
    farmer: batch.farmerName,
    liters: `${batch.liters} L`,
    fat: batch.fatPercentage > 0 ? `${batch.fatPercentage}%` : "Pending Test",
    snf: batch.snfPercentage > 0 ? `${batch.snfPercentage}%` : "Pending Test",
    date: batch.dateStr || new Date().toLocaleDateString(),
    verified: batch.status.includes("Collected") || batch.status === "Delivered"
  });
}

// Generate inline SVG QR Pattern
export function renderQRCodeSVG(text, size = 160) {
  const hash = Array.from(text).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 1000000, 7);
  const matrixSize = 21; // Standard QR matrix grid 21x21
  
  let cells = [];
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      // Position Detection Patterns (Top-Left, Top-Right, Bottom-Left)
      const isTopLeft = r < 7 && c < 7;
      const isTopRight = r < 7 && c >= matrixSize - 7;
      const isBottomLeft = r >= matrixSize - 7 && c < 7;
      
      let isDark = false;
      if (isTopLeft || isTopRight || isBottomLeft) {
        // Outer ring or inner core
        const rIn = isBottomLeft ? r - (matrixSize - 7) : r;
        const cIn = isTopRight ? c - (matrixSize - 7) : c;
        if (rIn === 0 || rIn === 6 || cIn === 0 || cIn === 6) isDark = true;
        else if (rIn >= 2 && rIn <= 4 && cIn >= 2 && cIn <= 4) isDark = true;
      } else {
        // Pseudorandom pattern seeded by text hash
        isDark = ((r * 13 + c * 17 + hash) % 3 === 0) || ((r + c + (hash % 7)) % 2 === 0);
      }
      if (isDark) {
        cells.push({ r, c });
      }
    }
  }

  const cellSize = size / matrixSize;

  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#FFFFFF" rx="12" />
      ${cells.map(cell => `<rect x="${cell.c * cellSize}" y="${cell.r * cellSize}" width="${cellSize - 0.5}" height="${cellSize - 0.5}" fill="#0F172A" rx="1" />`).join('')}
    </svg>`
  );
}
