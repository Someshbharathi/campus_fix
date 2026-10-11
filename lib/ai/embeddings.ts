export const COMPLAINT_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
export const COMPLAINT_EMBEDDING_DIMENSIONS = 384;

function parseEmbedding(value: unknown): number[] | null {
  const vector = Array.isArray(value) && Array.isArray(value[0]) ? value[0] : value;
  if (!Array.isArray(vector) || vector.length !== COMPLAINT_EMBEDDING_DIMENSIONS) return null;
  if (!vector.every((item) => typeof item === "number" && Number.isFinite(item))) return null;
  return vector as number[];
}

export async function embedComplaint(text: string): Promise<number[] | null> {
  const token = process.env.HUGGINGFACE_API_TOKEN;
  if (!token) return null;

  const endpoint = process.env.HUGGINGFACE_FEATURE_EXTRACTION_URL ||
    `https://router.huggingface.co/hf-inference/models/${COMPLAINT_EMBEDDING_MODEL}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text, normalize: true, truncate: true }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn("[issues:create] sentence embedding request failed", {
        status: response.status,
        model: COMPLAINT_EMBEDDING_MODEL,
      });
      return null;
    }
    const embedding = parseEmbedding(await response.json());
    if (!embedding) console.warn("[issues:create] embedding response had an unexpected shape");
    return embedding;
  } catch (error) {
    console.warn("[issues:create] sentence embedding failed", {
      reason: error instanceof Error ? error.name : "UnknownError",
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function getSimilarityThresholds() {
  const same = Number(process.env.COMPLAINT_SIMILARITY_THRESHOLD ?? 0.78);
  const cross = Number(process.env.COMPLAINT_CROSS_CATEGORY_SIMILARITY_THRESHOLD ?? Math.max(0.55, same - 0.08));
  return {
    sameCategory: Number.isFinite(same) && same >= 0 && same <= 1 ? same : 0.78,
    crossCategory: Number.isFinite(cross) && cross >= 0 && cross <= 1 ? cross : 0.7,
  };
}
