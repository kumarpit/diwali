export const CHUNK_SIZE = 256;

export function worldToChunk(worldX: number, worldY: number) {
  const chunkX = Math.floor(worldX / CHUNK_SIZE);
  const chunkY = Math.floor(worldY / CHUNK_SIZE);
  const localX = worldX - chunkX * CHUNK_SIZE;
  const localY = worldY - chunkY * CHUNK_SIZE;
  return { chunkX, chunkY, localX, localY };
}

export function chunkKey(chunkX: number, chunkY: number) {
  return `${chunkX},${chunkY}`;
}
