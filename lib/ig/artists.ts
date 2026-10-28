/**
 * Artistas de imagem em cascata (fallback).
 * Ordem: Pollinations (nanobanana → flux) → Hugging Face Flux → Gemini Imagen → Leonardo → null
 */

export type ArtistResult = {
  provider: "pollinations-nanobanana" | "pollinations-flux" | "huggingface" | "gemini-imagen" | "leonardo";
  bytes: Buffer;
  contentType: string;
  prompt: string;
  model: string;
  /** URL pública estável (ex.: Pollinations) — usada se o Blob falhar */
  publicUrl?: string;
};

function portraitSize() {
  return { width: 1080, height: 1350 };
}

async function fetchBinary(url: string, init?: RequestInit): Promise<{ ok: boolean; bytes?: Buffer; contentType?: string; status: number; err?: string }> {
  const res = await fetch(url, init).catch((err) => {
    throw err;
  });
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { ok: false, status: res.status, err: err.slice(0, 300) };
  }
  if (!contentType.includes("image") && !contentType.includes("octet-stream")) {
    const err = await res.text().catch(() => "not image");
    return { ok: false, status: res.status, err: err.slice(0, 300) };
  }
  const ab = await res.arrayBuffer();
  if (ab.byteLength < 8_000) {
    return { ok: false, status: res.status, err: "image too small / likely error banner" };
  }
  return { ok: true, status: res.status, bytes: Buffer.from(ab), contentType: contentType.includes("png") ? "image/png" : "image/jpeg" };
}

async function pollinations(model: string, prompt: string, key?: string): Promise<ArtistResult | null> {
  const { width, height } = portraitSize();
  const seed = Math.floor(Math.random() * 1_000_000);
  const path = encodeURIComponent(prompt.slice(0, 800));
  const qs = new URLSearchParams({
    model,
    width: String(width),
    height: String(height),
    seed: String(seed),
    nologo: "true",
    enhance: "false",
    safe: "true",
  });
  if (key) qs.set("key", key);

  // nanobanana costuma exigir pollen pago — tenta só gen (rápido em 402)
  const urls =
    model.includes("nanobanana")
      ? [`https://gen.pollinations.ai/image/${path}?${qs}`]
      : [
          `https://gen.pollinations.ai/image/${path}?${qs}`,
          `https://image.pollinations.ai/prompt/${path}?${qs}`,
        ];

  for (const url of urls) {
    const headers: Record<string, string> = { Accept: "image/*" };
    if (key && url.includes("gen.pollinations.ai")) headers.Authorization = `Bearer ${key}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), model.includes("nanobanana") ? 12_000 : 45_000);
    try {
      const got = await fetchBinary(url, { headers, signal: controller.signal });
      if (!got.ok || !got.bytes) {
        console.error("[artist:pollinations]", model, url.includes("image.pollinations") ? "public" : "gen", got.status, got.err);
        continue;
      }
      return {
        provider: model.includes("nanobanana") ? "pollinations-nanobanana" : "pollinations-flux",
        bytes: got.bytes,
        contentType: got.contentType || "image/jpeg",
        prompt,
        model,
        publicUrl: url,
      };
    } catch (err) {
      console.error("[artist:pollinations]", model, err);
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

async function huggingface(prompt: string): Promise<ArtistResult | null> {
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
  if (!token) return null;
  const model = process.env.HF_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell";
  const { width, height } = portraitSize();
  const res = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "image/png",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: { width, height, num_inference_steps: 4, guidance_scale: 3.5 },
    }),
  });
  if (!res.ok) {
    // try Inference Providers text-to-image OpenAI-ish path
    const alt = await fetch("https://router.huggingface.co/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        size: `${width}x${height}`,
        response_format: "b64_json",
      }),
    });
    if (!alt.ok) {
      console.error("[artist:hf]", res.status, await res.text().catch(() => ""), alt.status, await alt.text().catch(() => ""));
      return null;
    }
    const json = (await alt.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) return null;
    return {
      provider: "huggingface",
      bytes: Buffer.from(b64, "base64"),
      contentType: "image/png",
      prompt,
      model,
    };
  }
  const ab = await res.arrayBuffer();
  if (ab.byteLength < 8_000) return null;
  return {
    provider: "huggingface",
    bytes: Buffer.from(ab),
    contentType: "image/png",
    prompt,
    model,
  };
}

async function geminiImagen(prompt: string): Promise<ArtistResult | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const models = [
    process.env.GEMINI_IMAGE_MODEL,
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-image",
    "imagen-4.0-generate-001",
  ].filter(Boolean) as string[];

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });
    const json = (await res.json()) as {
      error?: { message?: string };
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }> };
      }>;
    };
    if (!res.ok || json.error) {
      console.error("[artist:gemini-imagen]", model, json.error?.message || res.status);
      continue;
    }
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) continue;
    return {
      provider: "gemini-imagen",
      bytes: Buffer.from(part.inlineData.data, "base64"),
      contentType: part.inlineData.mimeType || "image/png",
      prompt,
      model,
    };
  }
  return null;
}

async function leonardo(prompt: string): Promise<ArtistResult | null> {
  const key = process.env.LEONARDO_API_KEY;
  if (!key) return null;
  // Leonardo Lightning XL — free-tier friendly default
  const modelId = process.env.LEONARDO_MODEL_ID || "aa77f04e-3eec-4034-9c07-d0f619884a84";
  const create = await fetch("https://cloud.leonardo.ai/api/rest/v1/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      prompt,
      width: 1024,
      height: 1280,
      num_images: 1,
      modelId,
      alchemy: false,
      photoReal: false,
    }),
  });

  if (!create.ok) {
    console.error("[artist:leonardo]", create.status, await create.text().catch(() => ""));
    return null;
  }

  const gen = (await create.json()) as { sdGenerationJob?: { generationId?: string } };
  const id = gen.sdGenerationJob?.generationId;
  if (!id) return null;
  return pollLeonardo(id, prompt, key);
}

async function pollLeonardo(generationId: string, prompt: string, key: string): Promise<ArtistResult | null> {
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const res = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
      headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
    });
    if (!res.ok) continue;
    const json = (await res.json()) as {
      generations_by_pk?: { status?: string; generated_images?: Array<{ url?: string }> };
    };
    const status = json.generations_by_pk?.status;
    if (status === "FAILED") return null;
    const url = json.generations_by_pk?.generated_images?.[0]?.url;
    if (status === "COMPLETE" && url) {
      const got = await fetchBinary(url);
      if (!got.ok || !got.bytes) return null;
      return {
        provider: "leonardo",
        bytes: got.bytes,
        contentType: got.contentType || "image/jpeg",
        prompt,
        model: process.env.LEONARDO_MODEL_ID || "leonardo",
      };
    }
  }
  return null;
}

export async function generateArt(prompt: string): Promise<ArtistResult | null> {
  const pollen = process.env.POLLINATIONS_API_KEY;
  // Ordem pedida: nanobanana → flux → HF → Gemini Imagen → Leonardo.
  // nanobanana costuma pedir pollen pago (402); flux/public costuma passar no free/quest.
  const attempts: Array<() => Promise<ArtistResult | null>> = [
    () => pollinations("nanobanana", prompt, pollen),
    () => pollinations("nanobanana-2", prompt, pollen),
    () => pollinations("flux", prompt, pollen),
    () => pollinations("flux", prompt, undefined), // público image.pollinations.ai
    () => pollinations("zimage", prompt, pollen),
    () => huggingface(prompt),
    () => geminiImagen(prompt),
    () => leonardo(prompt),
  ];

  for (const run of attempts) {
    try {
      const hit = await run();
      if (hit) return hit;
    } catch (err) {
      console.error("[artist]", err);
    }
  }
  return null;
}
