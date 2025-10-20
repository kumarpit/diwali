const CHUNK_SIZE = 256;
const chunks = new Map<string, Uint32Array>();
const subscriptions = new Map<string, Set<WebSocket>>();

export async function getChunk(x: number, y: number) {
  const key = `${x},${y}`;
  if (!chunks.has(key)) {
    chunks.set(key, new Uint32Array(CHUNK_SIZE * CHUNK_SIZE));
  }
  return chunks.get(key);
}

export async function setPixel(chunkX, chunkY, x, y, color) {
  const key = `${chunkX},${chunkY}`;
  const chunk = await getChunk(chunkX, chunkY);
  const idx = y * CHUNK_SIZE + x;
  chunk[idx] = parseInt(color.replace('#', ''), 16);

  // Notify subscribers
  subscriptions.get(key)?.forEach((ws) => {
    ws.send(JSON.stringify({ type: 'update', x, y, color }));
  });
}

export function subscribeChunk(x, y, ws) {
  const key = `${x},${y}`;
  if (!subscriptions.has(key)) subscriptions.set(key, new Set());
  subscriptions.get(key).add(ws);
  ws.on('close', () => subscriptions.get(key).delete(ws));
}
