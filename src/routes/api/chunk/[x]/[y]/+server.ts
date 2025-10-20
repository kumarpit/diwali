import { json } from '@sveltejs/kit';
import { getChunk } from '$lib/server/gridManager';

export async function GET({ params }) {
  const { x, y } = params;
  const chunk = await getChunk(Number(x), Number(y));
  return json(chunk);
}
