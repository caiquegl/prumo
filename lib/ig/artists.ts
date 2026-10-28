/**
 * Artistas de imagem em cascata (fallback).
 * Ordem: Pollinations (nanobanana → flux) → Hugging Face Flux → Gemini Imagen → Leonardo → null
 */

export type ArtistResult = {
  provider:
    | "recraft"
    | "ideogram"
    | "pollinations-nanobanana"
    | "pollinations-flux"
    | "huggingface"
    | "gemini-imagen"
    | "leonardo";
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
      // Nunca vazar a API key na URL pública (query/header já autenticam no gen)
      const safeUrl = url.replace(/([?&]key=)[^&]*/g, "$1").replace(/\?&/, "?").replace(/[?&]$/, "");
      return {
        provider: model.includes("nanobanana") ? "pollinations-nanobanana" : "pollinations-flux",
        bytes: got.bytes,
        contentType: got.contentType || "image/jpeg",
        prompt,
        model,
        publicUrl: safeUrl.includes("gen.pollinations.ai") && key
          ? // Bearer-only: remove key param; Instagram fetch precisa de URL aberta → preferir image.pollinations
            `https://image.pollinations.ai/prompt/${path}?${new URLSearchParams({
              model,
              width: String(width),
              height: String(height),
              seed: String(seed),
              nologo: "true",
            })}`
          : safeUrl,
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

/** Recraft — ilustração única com paleta Prumo (sem texto). */
async function recraft(prompt: string): Promise<ArtistResult | null> {
  const key = process.env.RECRAFT_API_TOKEN || process.env.RECRAFT_API_KEY;
  if (!key) return null;
  const clean = `${prompt}. Absolutely no text, letters, words, logos, watermarks or UI labels.`;
  const model = process.env.RECRAFT_MODEL || "recraftv4_1";
  try {
    const res = await fetch("https://external.api.recraft.ai/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: clean.slice(0, 8000),
        model,
        n: 1,
        size: "4:5",
        image_format: "png",
        response_format: "b64_json",
        random_seed: Math.floor(Math.random() * 1_000_000_000),
        controls: {
          // cream + terracotta + charcoal (marca Prumo)
          background_color: { rgb: [243, 238, 230] },
          colors: [
            { rgb: [212, 87, 62], weight: 0.45 },
            { rgb: [26, 25, 22], weight: 0.35 },
            { rgb: [251, 248, 243], weight: 0.2 },
          ],
        },
      }),
    });
    if (!res.ok) {
      console.error("[artist:recraft]", res.status, (await res.text().catch(() => "")).slice(0, 280));
      return null;
    }
    const json = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const row = json.data?.[0];
    if (row?.b64_json) {
      return {
        provider: "recraft",
        bytes: Buffer.from(row.b64_json, "base64"),
        contentType: "image/png",
        prompt: clean,
        model,
      };
    }
    if (row?.url) {
      const got = await fetchBinary(row.url);
      if (!got.ok || !got.bytes) return null;
      return {
        provider: "recraft",
        bytes: got.bytes,
        contentType: got.contentType || "image/png",
        prompt: clean,
        model,
        publicUrl: row.url,
      };
    }
    return null;
  } catch (err) {
    console.error("[artist:recraft]", err);
    return null;
  }
}

/** Ideogram 4.5 — design; VISUAL sem texto (tipografia no FeedCard). */
async function ideogram(prompt: string): Promise<ArtistResult | null> {
  const key = process.env.IDEOGRAM_API_KEY;
  if (!key) return null;
  const clean = `${prompt}. No text, no letters, no words, no logos, no watermarks.`;

  // API v2 (Ideogram 4.5)
  try {
    const endpoints = [
      "https://api.ideogram.ai/v2/image/generate/ideogram-4-5",
      "https://api.ideogram.ai/v2/images/generate/ideogram-4-5",
    ];
    for (const endpoint of endpoints) {
      const body = new FormData();
      body.append("prompt", clean.slice(0, 2000));
      body.append("size", "1024x1280");
      body.append("magic_prompt", "off");
      body.append("num_images", "1");
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Api-Key": key },
        body,
      });
      if (!res.ok) {
        console.error("[artist:ideogram:v2]", endpoint, res.status, (await res.text().catch(() => "")).slice(0, 200));
        continue;
      }
      const json = (await res.json()) as {
        data?: Array<{ url?: string }>;
        images?: Array<{ url?: string }>;
        created?: Array<{ url?: string }>;
      };
      const url = json.data?.[0]?.url || json.images?.[0]?.url || json.created?.[0]?.url;
      if (!url) continue;
      const got = await fetchBinary(url);
      if (got.ok && got.bytes) {
        return {
          provider: "ideogram",
          bytes: got.bytes,
          contentType: got.contentType || "image/png",
          prompt: clean,
          model: "ideogram-4-5",
          publicUrl: url,
        };
      }
    }
  } catch (err) {
    console.error("[artist:ideogram:v2]", err);
  }

  // Fallback API v1 clássica
  try {
    const res = await fetch("https://api.ideogram.ai/generate", {
      method: "POST",
      headers: { "Api-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        image_request: {
          prompt: clean.slice(0, 1500),
          aspect_ratio: "ASPECT_3_4",
          model: "V_2A",
          magic_prompt_option: "OFF",
          style_type: "DESIGN",
        },
      }),
    });
    if (!res.ok) {
      console.error("[artist:ideogram:v1]", res.status, (await res.text().catch(() => "")).slice(0, 240));
      return null;
    }
    const json = (await res.json()) as { data?: Array<{ url?: string }> };
    const url = json.data?.[0]?.url;
    if (!url) return null;
    const got = await fetchBinary(url);
    if (!got.ok || !got.bytes) return null;
    return {
      provider: "ideogram",
      bytes: got.bytes,
      contentType: got.contentType || "image/png",
      prompt: clean,
      model: "ideogram-v2a",
      publicUrl: url,
    };
  } catch (err) {
    console.error("[artist:ideogram:v1]", err);
    return null;
  }
}

export async function generateArt(prompt: string): Promise<ArtistResult | null> {
  const pollen = process.env.POLLINATIONS_API_KEY;
  // Recraft → Ideogram → Pollinations → HF → Gemini → Leonardo (sempre arte nova, sem template)
  const attempts: Array<() => Promise<ArtistResult | null>> = [
    () => recraft(prompt),
    () => ideogram(prompt),
    () => pollinations("nanobanana", prompt, pollen),
    () => pollinations("nanobanana-2", prompt, pollen),
    () => pollinations("flux", prompt, pollen),
    () => pollinations("flux", prompt, undefined),
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
