"use client";

import type { SharedSong } from "@/lib/api-types";
import { SharedSongBody } from "./shared";

export function Elegant({ song }: { song: SharedSong }) {
  return (
    <main
      className="relative min-h-screen overflow-hidden text-yellow-50"
      style={{ background: "linear-gradient(135deg, #030303 0%, #14100a 50%, #3b2700 100%)" }}
    >
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(3deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(-4deg); }
        }
        @keyframes float3 {
          0%, 100% { transform: translateY(0px) rotate(-6deg); }
          50% { transform: translateY(-12px) rotate(-2deg); }
        }
        @keyframes float4 {
          0%, 100% { transform: translateY(0px) rotate(12deg); }
          50% { transform: translateY(-7px) rotate(16deg); }
        }
        @keyframes float5 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-9px) rotate(2deg); }
        }
        @keyframes float6 {
          0%, 100% { transform: translateY(0px) rotate(-6deg); }
          50% { transform: translateY(-11px) rotate(-9deg); }
        }
        .float1 { animation: float1 5s ease-in-out infinite; }
        .float2 { animation: float2 6.5s ease-in-out infinite; }
        .float3 { animation: float3 4.8s ease-in-out infinite; }
        .float4 { animation: float4 7s ease-in-out infinite; }
        .float5 { animation: float5 5.5s ease-in-out infinite; }
        .float6 { animation: float6 6s ease-in-out infinite; }
      `}</style>

      {/* Deep radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 60% at 50% 25%, rgba(180,120,20,0.12) 0%, transparent 65%)",
        }}
      />

      {/* Thin gold horizontal lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent 59px, rgba(212,160,23,0.8) 60px)",
        }}
      />

      {/* Top gold border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
        style={{ background: "linear-gradient(to right, transparent, #d4a017 25%, #f5e070 50%, #d4a017 75%, transparent)" }}
      />

      {/* Bottom gold border */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] pointer-events-none"
        style={{ background: "linear-gradient(to right, transparent, #d4a017 25%, #f5e070 50%, #d4a017 75%, transparent)" }}
      />

      {/* Saxophone — top left */}
      <svg className="absolute top-16 left-12 opacity-15 pointer-events-none float1" width="60" height="90" viewBox="0 0 60 90" fill="none">
        <path d="M40 4 C40 4 48 8 48 20 C48 32 38 38 30 44 C22 50 14 56 12 68 C10 78 16 86 24 88" stroke="#d4a017" strokeWidth="3" strokeLinecap="round" fill="none"/>
        <path d="M34 2 C34 2 44 6 44 18" stroke="#d4a017" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="24" cy="88" r="5" stroke="#d4a017" strokeWidth="2" fill="none"/>
        <circle cx="38" cy="32" r="2" fill="#d4a017"/>
        <circle cx="30" cy="44" r="2" fill="#d4a017"/>
        <circle cx="22" cy="56" r="2" fill="#d4a017"/>
        <circle cx="16" cy="68" r="2" fill="#d4a017"/>
      </svg>

      {/* Music notes — top left area */}
      <svg className="absolute top-8 left-40 opacity-20 pointer-events-none float2" width="30" height="40" viewBox="0 0 30 40" fill="none">
        <path d="M10 28 L10 8 L26 4 L26 14 L10 18" stroke="#d4a017" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="7" cy="30" r="4" fill="#d4a017"/>
        <circle cx="23" cy="18" r="4" fill="#d4a017"/>
      </svg>

      {/* Single note — top center-left */}
      <svg className="absolute top-24 left-1/4 opacity-15 pointer-events-none float3" width="20" height="28" viewBox="0 0 20 28" fill="none">
        <path d="M8 20 L8 4 L18 2 L18 10 L8 12" stroke="#f5c842" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        <circle cx="5" cy="22" r="3.5" fill="#f5c842"/>
      </svg>

      {/* Saxophone — bottom right */}
      <svg className="absolute bottom-20 right-10 opacity-15 pointer-events-none float4" width="55" height="80" viewBox="0 0 60 90" fill="none">
        <path d="M40 4 C40 4 48 8 48 20 C48 32 38 38 30 44 C22 50 14 56 12 68 C10 78 16 86 24 88" stroke="#d4a017" strokeWidth="3" strokeLinecap="round" fill="none"/>
        <path d="M34 2 C34 2 44 6 44 18" stroke="#d4a017" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="24" cy="88" r="5" stroke="#d4a017" strokeWidth="2" fill="none"/>
        <circle cx="38" cy="32" r="2" fill="#d4a017"/>
        <circle cx="30" cy="44" r="2" fill="#d4a017"/>
        <circle cx="22" cy="56" r="2" fill="#d4a017"/>
        <circle cx="16" cy="68" r="2" fill="#d4a017"/>
      </svg>

      {/* Music notes — bottom right area */}
      <svg className="absolute bottom-36 right-36 opacity-20 pointer-events-none float5" width="30" height="40" viewBox="0 0 30 40" fill="none">
        <path d="M10 28 L10 8 L26 4 L26 14 L10 18" stroke="#d4a017" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="7" cy="30" r="4" fill="#d4a017"/>
        <circle cx="23" cy="18" r="4" fill="#d4a017"/>
      </svg>

      {/* Single note — top right */}
      <svg className="absolute top-14 right-1/4 opacity-15 pointer-events-none float2" width="20" height="28" viewBox="0 0 20 28" fill="none">
        <path d="M8 20 L8 4 L18 2 L18 10 L8 12" stroke="#f5c842" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        <circle cx="5" cy="22" r="3.5" fill="#f5c842"/>
      </svg>

      {/* Treble clef — right side */}
      <svg className="absolute top-1/3 right-8 opacity-[0.12] pointer-events-none float1" width="30" height="60" viewBox="0 0 30 60" fill="none">
        <path d="M15 2 C15 2 22 10 22 20 C22 30 14 34 14 42 C14 50 20 56 20 56 M14 42 C8 42 4 38 4 34 C4 28 10 26 15 28 C20 30 22 36 18 40 C14 44 8 42 8 38" stroke="#d4a017" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
        <path d="M10 52 L18 52" stroke="#d4a017" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M8 56 L20 56" stroke="#d4a017" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>

      {/* Double note — left middle */}
      <svg className="absolute top-1/2 left-8 opacity-15 pointer-events-none float6" width="36" height="44" viewBox="0 0 36 44" fill="none">
        <path d="M6 32 L6 10 L30 4 L30 16 L6 22" stroke="#d4a017" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="3" cy="34" r="4" fill="#d4a017"/>
        <circle cx="27" cy="20" r="4" fill="#d4a017"/>
        <path d="M3 34 L27 20" stroke="#d4a017" strokeWidth="1" opacity="0.4"/>
      </svg>

      {/* Gold dust particles */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-15" preserveAspectRatio="xMidYMid slice">
        {[
          [8,12],[15,72],[22,38],[30,88],[38,18],[45,55],[52,82],[60,28],[68,65],[75,10],
          [82,45],[90,78],[12,52],[25,20],[48,70],[70,40],[88,15],[5,90],[35,60],[63,5],
          [78,90],[18,80],[42,30],[57,95],[92,55],[3,35],[28,48],[50,10],[72,75],[95,22],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={`${cx}%`} cy={`${cy}%`} r={i % 3 === 0 ? "1.5" : "0.8"} fill="#d4a017"/>
        ))}
      </svg>

      {/* Corner filigree — top left */}
      <svg className="absolute top-5 left-5 opacity-30 pointer-events-none" width="80" height="80" viewBox="0 0 80 80" fill="none">
        <path d="M2 2 L2 36 M2 2 L36 2" stroke="#d4a017" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M2 2 Q20 20 36 2" stroke="#d4a017" strokeWidth="0.6" fill="none" strokeDasharray="2 4"/>
        <path d="M2 2 Q20 20 2 36" stroke="#d4a017" strokeWidth="0.6" fill="none" strokeDasharray="2 4"/>
        <circle cx="2" cy="2" r="3" fill="#d4a017"/>
        <circle cx="36" cy="2" r="1.5" fill="#d4a017" opacity="0.6"/>
        <circle cx="2" cy="36" r="1.5" fill="#d4a017" opacity="0.6"/>
      </svg>

      {/* Corner filigree — top right */}
      <svg className="absolute top-5 right-5 opacity-30 pointer-events-none" width="80" height="80" viewBox="0 0 80 80" fill="none">
        <path d="M78 2 L78 36 M78 2 L44 2" stroke="#d4a017" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M78 2 Q60 20 44 2" stroke="#d4a017" strokeWidth="0.6" fill="none" strokeDasharray="2 4"/>
        <path d="M78 2 Q60 20 78 36" stroke="#d4a017" strokeWidth="0.6" fill="none" strokeDasharray="2 4"/>
        <circle cx="78" cy="2" r="3" fill="#d4a017"/>
        <circle cx="44" cy="2" r="1.5" fill="#d4a017" opacity="0.6"/>
        <circle cx="78" cy="36" r="1.5" fill="#d4a017" opacity="0.6"/>
      </svg>

      {/* Corner filigree — bottom left */}
      <svg className="absolute bottom-5 left-5 opacity-30 pointer-events-none" width="80" height="80" viewBox="0 0 80 80" fill="none">
        <path d="M2 78 L2 44 M2 78 L36 78" stroke="#d4a017" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M2 78 Q20 60 36 78" stroke="#d4a017" strokeWidth="0.6" fill="none" strokeDasharray="2 4"/>
        <path d="M2 78 Q20 60 2 44" stroke="#d4a017" strokeWidth="0.6" fill="none" strokeDasharray="2 4"/>
        <circle cx="2" cy="78" r="3" fill="#d4a017"/>
        <circle cx="36" cy="78" r="1.5" fill="#d4a017" opacity="0.6"/>
        <circle cx="2" cy="44" r="1.5" fill="#d4a017" opacity="0.6"/>
      </svg>

      {/* Corner filigree — bottom right */}
      <svg className="absolute bottom-5 right-5 opacity-30 pointer-events-none" width="80" height="80" viewBox="0 0 80 80" fill="none">
        <path d="M78 78 L78 44 M78 78 L44 78" stroke="#d4a017" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M78 78 Q60 60 44 78" stroke="#d4a017" strokeWidth="0.6" fill="none" strokeDasharray="2 4"/>
        <path d="M78 78 Q60 60 78 44" stroke="#d4a017" strokeWidth="0.6" fill="none" strokeDasharray="2 4"/>
        <circle cx="78" cy="78" r="3" fill="#d4a017"/>
        <circle cx="44" cy="78" r="1.5" fill="#d4a017" opacity="0.6"/>
        <circle cx="78" cy="44" r="1.5" fill="#d4a017" opacity="0.6"/>
      </svg>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-16">

        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-white/10 backdrop-blur-sm px-5 py-2 text-sm font-semibold text-yellow-200 shadow-lg border border-yellow-400/20">
            ✨ It's Your Special Day!
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mb-7">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-[#d4a017]" />
          <svg width="32" height="14" viewBox="0 0 32 14" fill="none">
            <path d="M16 1 L19 6 L25 6 L20.5 9.5 L22.5 14 L16 10.5 L9.5 14 L11.5 9.5 L7 6 L13 6 Z" fill="#d4a017" opacity="0.85"/>
            <circle cx="3" cy="7" r="1.5" fill="#d4a017" opacity="0.5"/>
            <circle cx="29" cy="7" r="1.5" fill="#d4a017" opacity="0.5"/>
          </svg>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-[#d4a017]" />
        </div>

        <h1
          className="text-center text-4xl font-extrabold bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-100 bg-clip-text text-transparent"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: "0.02em" }}
        >
          Happy Birthday,<br />{song.name}
        </h1>

        <div className="flex items-center justify-center gap-2 mt-6">
          <div className="h-px w-8 bg-[#d4a017] opacity-40" />
          <div className="w-1 h-1 rounded-full bg-[#d4a017] opacity-60" />
          <div className="h-px w-16 bg-[#d4a017] opacity-60" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#f5e070] opacity-80" />
          <div className="h-px w-16 bg-[#d4a017] opacity-60" />
          <div className="w-1 h-1 rounded-full bg-[#d4a017] opacity-60" />
          <div className="h-px w-8 bg-[#d4a017] opacity-40" />
        </div>

        <SharedSongBody song={song} className="mt-8" />
      </div>
    </main>
  );
}