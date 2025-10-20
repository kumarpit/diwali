import { json } from '@sveltejs/kit';
import { setPixel } from '$lib/server/gridManager';

export async function POST({ request }) {
  const { chunkX, chunkY, x, y, color } = await request.json();
  await setPixel(chunkX, chunkY, x, y, color);
  return json({ ok: true });
}
