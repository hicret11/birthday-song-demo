import { fal } from "@fal-ai/client";

fal.config({
  credentials: process.env.FAL_KEY,
});

export async function POST(req: Request) {
  try {
    const { name, language, style } = await req.json();

    const prompt = `## Happy Birthday ${name}

Happy birthday ${name}
Today is your special day
We celebrate you with joy
May your new age bring happiness

Happy birthday ${name}
Wishing you smiles and laughter
May this year be bright and beautiful
`;

    const result: any = await fal.subscribe("fal-ai/minimax-music", {
      input: {
        prompt,
        reference_audio_url:
          "https://fal.media/files/lion/OOTBTSlxKMH_E8H6hoSlb.mpga",
      },
    });

    return Response.json({
      audioUrl: result.data.audio.url,
    });
  } catch (error: any) {
    console.error("FULL ERROR:", JSON.stringify(error.body, null, 2));

    return Response.json(
      { error: error.body || "Generation failed" },
      { status: 500 }
    );
  }
}