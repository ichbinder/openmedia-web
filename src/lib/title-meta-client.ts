import { getTitleMeta, type TitleMeta } from "./backend";
import { getToken } from "./auth";

type Kind = "movie" | "show";
type Pending = { kind: Kind; tmdbId: number; resolve: (meta: TitleMeta | null) => void };

const BATCH_DELAY_MS = 30;
const CHUNK_SIZE = 60;

const cache = new Map<string, Promise<TitleMeta | null>>();
let queue: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function sendChunk(chunk: Pending[], token: string) {
  try {
    const res = await getTitleMeta(
      chunk.map(({ kind, tmdbId }) => ({ kind, tmdbId })),
      token,
    );
    const byKey = new Map((res.ok ? res.data.items : []).map((m) => [`${m.kind}:${m.tmdbId}`, m]));
    for (const p of chunk) p.resolve(byKey.get(`${p.kind}:${p.tmdbId}`) ?? null);
  } catch {
    for (const p of chunk) p.resolve(null);
  }
}

function flush() {
  const pending = queue;
  queue = [];
  timer = null;
  const token = getToken();
  if (!token) {
    for (const p of pending) p.resolve(null);
    return;
  }
  for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
    void sendChunk(pending.slice(i, i + CHUNK_SIZE), token);
  }
}

function hasData(meta: TitleMeta | null) {
  return !!meta && (meta.label !== null || meta.score !== null || Object.keys(meta.ratings).length > 0);
}

export function loadTitleMeta(kind: Kind, tmdbId: number): Promise<TitleMeta | null> {
  const key = `${kind}:${tmdbId}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const promise = new Promise<TitleMeta | null>((resolve) => {
    queue.push({ kind, tmdbId, resolve });
    timer ??= setTimeout(flush, BATCH_DELAY_MS);
  });
  cache.set(key, promise);
  void promise.then((meta) => {
    if (!hasData(meta) && cache.get(key) === promise) cache.delete(key);
  });
  return promise;
}

export function __resetTitleMetaCache() {
  cache.clear();
  queue = [];
  if (timer) clearTimeout(timer);
  timer = null;
}
