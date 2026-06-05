"use client";

import { useMemo } from "react";

const COLORS = ["#ec4899", "#a855f7", "#f59e0b", "#fde047", "#fb7185", "#c084fc"];

export default function Confetti({ count = 60 }: { count?: number }) {
  const pieces = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const startX = Math.random() * 100; // vw
      const drift = (Math.random() - 0.5) * 320; // ±160px lateral drift
      const rotate = 360 + Math.random() * 720;
      const color = COLORS[i % COLORS.length];
      const delay = Math.random() * 0.6;
      const dur = 2.4 + Math.random() * 1.4;
      return {
        key: i,
        style: {
          left: `${startX}vw`,
          backgroundColor: color,
          animationDelay: `${delay}s`,
          animationDuration: `${dur}s`,
          ["--cx" as string]: `${drift}px`,
          ["--cr" as string]: `${rotate}deg`,
        } as React.CSSProperties,
      };
    });
  }, [count]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
    >
      {pieces.map((p) => (
        <span key={p.key} className="confetti-piece" style={p.style} />
      ))}
    </div>
  );
}
