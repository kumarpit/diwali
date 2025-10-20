import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { handler } from './build/handler.js';

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = createServer(handler);

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Grid state management
const CHUNK_SIZE = 256;
const chunks = new Map();
const subscriptions = new Map();

// Fireworks state management
const fireworks = new Map();

function broadcastToAll(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(message));
    }
  });
}

async function getChunk(x, y) {
  const key = `${x},${y}`;
  if (!chunks.has(key)) {
    chunks.set(key, new Uint32Array(CHUNK_SIZE * CHUNK_SIZE));
  }
  return chunks.get(key);
}

async function setPixel(chunkX, chunkY, x, y, color) {
  const key = `${chunkX},${chunkY}`;
  const chunk = await getChunk(chunkX, chunkY);
  const idx = y * CHUNK_SIZE + x;
  chunk[idx] = parseInt(color.replace('#', ''), 16);

  // Notify subscribers
  const subs = subscriptions.get(key);
  if (subs) {
    subs.forEach((ws) => {
      ws.send(JSON.stringify({ type: 'pixel', cx: chunkX, cy: chunkY, x, y, color }));
    });
  }
}

function subscribeChunk(x, y, ws) {
  const key = `${x},${y}`;
  if (!subscriptions.has(key)) {
    subscriptions.set(key, new Set());
  }
  subscriptions.get(key).add(ws);

  // Track subscribed chunks on the WebSocket itself
  if (!ws.subscribedChunks) {
    ws.subscribedChunks = new Set();
  }
  ws.subscribedChunks.add(key);
}

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  // Add cleanup handler ONCE per connection
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    // Clean up all chunk subscriptions for this client
    if (ws.subscribedChunks) {
      ws.subscribedChunks.forEach((chunkKey) => {
        const subs = subscriptions.get(chunkKey);
        if (subs) {
          subs.delete(ws);
          // Clean up empty subscription sets
          if (subs.size === 0) {
            subscriptions.delete(chunkKey);
          }
        }
      });
      ws.subscribedChunks.clear();
    }
  });

  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      console.log('Received message:', data);

      if (data.type === 'join') {
        subscribeChunk(data.chunkX, data.chunkY, ws);
        // Send initial chunk data
        const chunk = await getChunk(data.chunkX, data.chunkY);
        // Convert Uint32Array to object for JSON serialization
        const pixels = {};
        for (let i = 0; i < chunk.length; i++) {
          if (chunk[i] !== 0) {
            const x = i % CHUNK_SIZE;
            const y = Math.floor(i / CHUNK_SIZE);
            pixels[`${x},${y}`] = '#' + chunk[i].toString(16).padStart(6, '0');
          }
        }
        ws.send(JSON.stringify({
          type: 'chunk',
          cx: data.chunkX,
          cy: data.chunkY,
          pixels: pixels
        }));
        // Also send all current fireworks
        ws.send(JSON.stringify({
          type: 'allFireworks',
          fireworks: Array.from(fireworks.values())
        }));
      } else if (data.type === 'setPixel') {
        await setPixel(data.chunkX, data.chunkY, data.x, data.y, data.color);
      } else if (data.type === 'placeFirework') {
        const litAt = Date.now();
        const firework = {
          id: data.id,
          type: data.fireworkType,
          x: data.x,
          y: data.y,
          lit: true,
          litAt: litAt
        };
        fireworks.set(data.id, firework);
        broadcastToAll({ type: 'fireworkPlaced', firework });
      } else if (data.type === 'lightFirework') {
        const firework = fireworks.get(data.id);
        if (firework && !firework.lit) {
          firework.lit = true;
          firework.litAt = Date.now();
          broadcastToAll({ type: 'fireworkLit', id: data.id, litAt: firework.litAt });

          // Auto-remove after animation (anar: 5s, chakri: 3s)
          const duration = firework.type === 'anar' ? 5000 : 3000;
          setTimeout(() => {
            fireworks.delete(data.id);
            broadcastToAll({ type: 'fireworkRemoved', id: data.id });
          }, duration);
        }
      } else if (data.type === 'removeFirework') {
        if (fireworks.has(data.id)) {
          fireworks.delete(data.id);
          broadcastToAll({ type: 'fireworkRemoved', id: data.id });
        }
      } else if (data.type === 'getAllFireworks') {
        ws.send(JSON.stringify({
          type: 'allFireworks',
          fireworks: Array.from(fireworks.values())
        }));
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });
});

// Handle upgrade requests
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === '/api/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint available at ws://localhost:${PORT}/api/ws`);
});
