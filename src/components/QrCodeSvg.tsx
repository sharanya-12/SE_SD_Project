import React, { useMemo } from 'react';

interface QrCodeSvgProps {
  value: string;
  size?: number;
}

/**
 * Deterministic high-contrast SVG QR-style matrix generated from a pass code.
 */
export const QrCodeSvg: React.FC<QrCodeSvgProps> = ({ value, size = 136 }) => {
  const grid = useMemo(() => {
    const dim = 21;
    const matrix: boolean[][] = Array.from({ length: dim }, () => Array(dim).fill(false));

    const drawFinder = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          matrix[r0 + r][c0 + c] = isBorder || isCenter;
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, dim - 7);
    drawFinder(dim - 7, 0);

    // Timing patterns
    for (let i = 8; i < dim - 8; i++) {
      matrix[6][i] = i % 2 === 0;
      matrix[i][6] = i % 2 === 0;
    }

    // Deterministic hash fill for remaining data cells
    let seed = 2166136261;
    for (let i = 0; i < value.length; i++) {
      seed ^= value.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }

    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        const inTopLeft = r < 8 && c < 8;
        const inTopRight = r < 8 && c >= dim - 8;
        const inBottomLeft = r >= dim - 8 && c < 8;
        const isTiming = r === 6 || c === 6;
        if (inTopLeft || inTopRight || inBottomLeft || isTiming) continue;

        seed ^= (r * 31 + c * 17) & 0xff;
        seed = Math.imul(seed, 16777619);
        matrix[r][c] = (seed >>> 28) % 2 === 0;
      }
    }

    return matrix;
  }, [value]);

  const dim = grid.length;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${dim + 2} ${dim + 2}`}
      role="img"
      aria-label={`Gate entry QR code for pass ${value}`}
      className="bg-white rounded-lg border border-slate-200 p-1.5 shrink-0"
    >
      <rect x="0" y="0" width={dim + 2} height={dim + 2} fill="#ffffff" />
      {grid.map((row, r) =>
        row.map((filled, c) =>
          filled ? (
            <rect key={`${r}-${c}`} x={c + 1} y={r + 1} width="1" height="1" fill="#0f172a" />
          ) : null
        )
      )}
    </svg>
  );
};
