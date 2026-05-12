"use client";

import type { SharedSong } from "@/lib/api-types";
import { SharedSongBody } from "./shared";
import { useEffect, useRef } from "react";

function FireworksCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let W = window.innerWidth;
    let H = window.innerHeight;

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    };
    resize();
    window.addEventListener("resize", resize);

    const neonColors = [
      "#ff00cc", "#ff66ff", "#cc00ff", "#00ffff", "#ff3399",
      "#ff00aa", "#aa00ff", "#00ccff", "#ff6699", "#ffcc00",
      "#ff4488", "#44ffcc",
    ];

    class Particle {
      x: number; y: number; color: string;
      vx: number; vy: number;
      alpha: number; decay: number; radius: number;
      trail: { x: number; y: number; alpha: number }[];

      constructor(x: number, y: number, color: string) {
        this.x = x; this.y = y; this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.alpha = 1;
        this.decay = Math.random() * 0.018 + 0.012;
        this.radius = Math.random() * 2 + 1;
        this.trail = [];
      }

      update() {
        this.trail.push({ x: this.x, y: this.y, alpha: this.alpha });
        if (this.trail.length > 4) this.trail.shift();
        this.vy += 0.06;
        this.vx *= 0.98;
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
      }

      draw() {
        this.trail.forEach((t, i) => {
          ctx.save();
          ctx.globalAlpha = t.alpha * (i / this.trail.length) * 0.3;
          ctx.beginPath();
          ctx.arc(t.x, t.y, this.radius * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = this.color;
          ctx.shadowBlur = 6;
          ctx.shadowColor = this.color;
          ctx.fill();
          ctx.restore();
        });
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
      }
    }

    class Firework {
      x: number; y: number;
      tx: number; ty: number;
      vx: number; vy: number;
      color: string;
      exploded: boolean;
      trail: { x: number; y: number }[];

      constructor() {
        this.x = Math.random() * W;
        this.y = H;
        this.tx = Math.random() * W * 0.8 + W * 0.1;
        this.ty = Math.random() * H * 0.5 + 50;
        const dx = this.tx - this.x;
        const dy = this.ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = Math.random() * 3 + 8;
        this.vx = (dx / dist) * speed;
        this.vy = (dy / dist) * speed;
        this.color = neonColors[Math.floor(Math.random() * neonColors.length)];
        this.exploded = false;
        this.trail = [];
      }

      update() {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 8) this.trail.shift();
        this.x += this.vx;
        this.y += this.vy;
        if (Math.abs(this.x - this.tx) < 10 && Math.abs(this.y - this.ty) < 10) {
          this.explode();
          this.exploded = true;
        }
      }

      explode() {
        // Daha az parçacık
        const count = Math.floor(Math.random() * 30) + 40;
        for (let i = 0; i < count; i++) {
          particles.push(new Particle(this.x, this.y, this.color));
        }
        // Daha küçük halka
        const ringColor = neonColors[Math.floor(Math.random() * neonColors.length)];
        for (let i = 0; i < 16; i++) {
          const p = new Particle(this.x, this.y, ringColor);
          const angle = (i / 16) * Math.PI * 2;
          p.vx = Math.cos(angle) * 5;
          p.vy = Math.sin(angle) * 5;
          particles.push(p);
        }
      }

      draw() {
        this.trail.forEach((t, i) => {
          ctx.save();
          ctx.globalAlpha = (i / this.trail.length) * 0.6;
          ctx.beginPath();
          ctx.arc(t.x, t.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = this.color;
          ctx.shadowBlur = 12;
          ctx.shadowColor = this.color;
          ctx.fill();
          ctx.restore();
        });
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
      }
    }

    const particles: Particle[] = [];
    const fireworks: Firework[] = [];
    let lastFirework = 0;
    let rafId: number;

    const loop = (ts: number) => {
      ctx.fillStyle = "rgba(9,0,20,0.22)";
      ctx.fillRect(0, 0, W, H);

      // Her 1800ms'de bir havai fişek, artık ikiz yok
      if (ts - lastFirework > 1800) {
        fireworks.push(new Firework());
        lastFirework = ts;
      }

      for (let i = fireworks.length - 1; i >= 0; i--) {
        fireworks[i].update();
        fireworks[i].draw();
        if (fireworks[i].exploded) fireworks.splice(i, 1);
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].alpha <= 0) particles.splice(i, 1);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none"
    />
  );
}

export function Neon({ song }: { song: SharedSong }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090014] text-white">

      {/* Havai fişek canvas animasyonu */}
      <FireworksCanvas />

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#ffffff11_1px,transparent_1px),linear-gradient(to_bottom,#ffffff11_1px,transparent_1px)] bg-[size:40px_40px] z-[1]" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-16">

      

        <div className="mb-6 flex justify-center">
          <div className="rounded-full border border-pink-400/30 bg-white/5 px-4 py-2 text-sm text-pink-200 backdrop-blur-md shadow-[0_0_20px_rgba(255,0,255,0.2)]">
            ✨ It's Your Special Day!
          </div>
        </div>

        <h1 className="text-center text-5xl font-extrabold leading-tight bg-gradient-to-r from-pink-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(255,0,255,0.35)]">
          Happy Birthday,
          <br />
          {song.name} 🎉
        </h1>

        <p className="mt-4 text-center text-purple-200/80">
          A personalized AI-generated birthday song made just for you.
        </p>

        {/* Main card */}
        <div className="mt-10 rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_0_40px_rgba(168,85,247,0.15)] backdrop-blur-xl">
          <SharedSongBody song={song} className="mt-2" />
        </div>
      </div>
    </main>
  );
}