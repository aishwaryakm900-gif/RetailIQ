import React from 'react';

interface QrCodeSvgProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Deterministic visual QR-style matrix SVG for campaign & pickup codes.
 * Renders cleanly offline with standard finder patterns.
 */
export function QrCodeSvg({ value, size = 128, className = '' }: QrCodeSvgProps) {
  const grid = 21;
  const cells: boolean[][] = Array.from({ length: grid }, () => Array(grid).fill(false));

  const setFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const border = x === 0 || x === 6 || y === 0 || y === 6;
        const inner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        cells[oy + y][ox + x] = border || inner;
      }
    }
  };

  setFinder(0, 0);
  setFinder(grid - 7, 0);
  setFinder(0, grid - 7);

  // Deterministic bit fill seeded by value characters
  let seed = 2166136261;
  for (let i = 0; i < value.length; i++) {
    seed ^= value.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }

  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const inTopLeft = x < 8 && y < 8;
      const inTopRight = x >= grid - 8 && y < 8;
      const inBottomLeft = x < 8 && y >= grid - 8;
      if (inTopLeft || inTopRight || inBottomLeft) continue;

      seed ^= (x * 31 + y * 17) & 0xff;
      seed = Math.imul(seed, 16777619);
      cells[y][x] = (seed >>> 0) % 2 === 0;
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid} ${grid}`}
      className={`bg-white p-2 rounded-lg border border-gray-200 ${className}`}
      role="img"
      aria-label={`QR code for ${value}`}
    >
      <rect width={grid} height={grid} fill="#FFFFFF" />
      {cells.map((row, y) =>
        row.map((on, x) =>
          on ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#111827" /> : null
        )
      )}
    </svg>
  );
}

