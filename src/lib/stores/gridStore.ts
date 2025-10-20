import { writable, get } from 'svelte/store';
// import { CHUNK_SIZE } from '$lib/server/gridManager'; // or duplicate constant locally

const CHUNK_SIZE = 256;

type Chunk = Map<string, string>;
type ChunkKey = string;

export type Firework = {
  id: string;
  type: 'anar' | 'chakri' | 'rocket';
  x: number;
  y: number;
  lit: boolean;
  litAt?: number;
};

const _chunks = writable<Map<ChunkKey, Chunk>>(new Map());
const _fireworks = writable<Map<string, Firework>>(new Map());
let ws: WebSocket | null = null;
let messageQueue: string[] = [];

function chunkKey(cx: number, cy: number) {
  return `${cx},${cy}`;
}

function sendMessage(message: string) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(message);
  } else {
    // Queue message until connection is ready
    messageQueue.push(message);
  }
}

export const fireworksStore = {
  subscribe: _fireworks.subscribe
};

export const gridStore = {
  subscribe: _chunks.subscribe,

  connect() {
    if (ws) return;
    ws = new WebSocket(`ws://${location.host}/api/ws`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Send any queued messages
      while (messageQueue.length > 0) {
        const message = messageQueue.shift();
        if (message) ws?.send(message);
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const chunks = get(_chunks);

      if (data.type === 'chunk') {
        const key = chunkKey(data.cx, data.cy);
        chunks.set(key, new Map(Object.entries(data.pixels)));
        _chunks.set(new Map(chunks));
      } else if (data.type === 'pixel') {
        const key = chunkKey(data.cx, data.cy);
        if (!chunks.has(key)) chunks.set(key, new Map());
        chunks.get(key)!.set(`${data.x},${data.y}`, data.color);
        _chunks.set(new Map(chunks));
      } else if (data.type === 'fireworkPlaced') {
        const fireworks = get(_fireworks);
        fireworks.set(data.firework.id, data.firework);
        _fireworks.set(new Map(fireworks));
      } else if (data.type === 'fireworkLit') {
        const fireworks = get(_fireworks);
        const firework = fireworks.get(data.id);
        if (firework) {
          firework.lit = true;
          firework.litAt = data.litAt;
          _fireworks.set(new Map(fireworks));
        }
      } else if (data.type === 'fireworkRemoved') {
        const fireworks = get(_fireworks);
        fireworks.delete(data.id);
        _fireworks.set(new Map(fireworks));
      } else if (data.type === 'allFireworks') {
        const fireworksMap = new Map();
        data.fireworks.forEach((fw: Firework) => {
          fireworksMap.set(fw.id, fw);
        });
        _fireworks.set(fireworksMap);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      ws = null;
    };
  },

  joinChunk(cx: number, cy: number) {
    sendMessage(JSON.stringify({ type: 'join', chunkX: cx, chunkY: cy }));
  },

  setPixel(cx: number, cy: number, x: number, y: number, color: string) {
    sendMessage(JSON.stringify({ type: 'setPixel', chunkX: cx, chunkY: cy, x, y, color }));
  },

  placeFirework(type: 'anar' | 'chakri', x: number, y: number) {
    const id = `${type}-${Date.now()}-${Math.random()}`;
    sendMessage(JSON.stringify({ type: 'placeFirework', fireworkType: type, x, y, id }));
  },

  lightFirework(id: string) {
    sendMessage(JSON.stringify({ type: 'lightFirework', id }));
  },

  removeFirework(id: string) {
    sendMessage(JSON.stringify({ type: 'removeFirework', id }));
  },

  requestAllFireworks() {
    sendMessage(JSON.stringify({ type: 'getAllFireworks' }));
  }
};
