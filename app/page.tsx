"use client";

import { useState } from "react";

export default function Home() {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("English");
  const [style, setStyle] = useState("Fun Kids");
  const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateSong() {
    if (!name.trim()) {
      alert("Please enter a name");
      return;
    }

    setLoading(true);
    setAudioUrl("");

    const res = await fetch("/api/generate-song", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, language, style }),
    });

    const data = await res.json();
    setAudioUrl(data.audioUrl);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-100 via-white to-purple-100 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
        
        <section className="space-y-6">
          <div className="inline-flex items-center rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-pink-600 shadow-sm">
            AI Birthday Song Generator
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight">
            Create a birthday song in seconds.
          </h1>

          <p className="text-lg text-gray-700 max-w-md">
            Enter a name, choose a language and style, then generate a personalized birthday song with AI.
          </p>

          <div className="flex gap-3 text-sm text-gray-700">
            <span className="bg-white rounded-full px-4 py-2 shadow-sm">Personalized</span>
            <span className="bg-white rounded-full px-4 py-2 shadow-sm">Playable MP3</span>
            <span className="bg-white rounded-full px-4 py-2 shadow-sm">No login</span>
          </div>
        </section>

        <section className="bg-white rounded-3xl shadow-2xl p-8 border border-pink-100">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Make your song
          </h2>

          <p className="text-gray-600 mb-8">
            Fill in the details below and listen to your custom birthday song.
          </p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Recipient name
              </label>
              <input
                className="w-full border border-gray-300 p-4 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400"
                placeholder="Example: Rachel"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Language
              </label>
              <select
                className="w-full border border-gray-300 p-4 rounded-2xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-pink-400"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option>English</option>
                <option>Turkish</option>
                <option>Spanish</option>
                <option>French</option>
                <option>Arabic</option>
                <option>Hindi</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Song style
              </label>
              <select
                className="w-full border border-gray-300 p-4 rounded-2xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-pink-400"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              >
                <option>Fun Kids</option>
                <option>Pop Celebration</option>
                <option>Soft Acoustic</option>
                <option>Warm Family</option>
              </select>
            </div>

            <button
              onClick={generateSong}
              disabled={loading}
              className="w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-60 text-white p-4 rounded-2xl font-bold shadow-lg transition"
            >
              {loading ? "Creating your song..." : "Generate Song"}
            </button>
          </div>

          {audioUrl && (
            <div className="mt-8 p-5 rounded-2xl bg-pink-50 border border-pink-100">
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Your song is ready 🎉
              </h3>

              <audio controls className="w-full">
                <source src={audioUrl} type="audio/mpeg" />
              </audio>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <a
                  href={audioUrl}
                  target="_blank"
                  className="text-center bg-gray-900 text-white p-3 rounded-xl font-semibold"
                >
                  Download
                </a>

           <button
  onClick={async () => {
    try {
      await navigator.clipboard.writeText(audioUrl);
      alert("Link copied!");
    } catch (err) {
      prompt("Copy this link manually:", audioUrl);
    }
  }}
  className="bg-white border border-gray-300 text-gray-900 p-3 rounded-xl font-semibold"
>
  Copy Link
</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}