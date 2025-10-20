<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { CHUNK_SIZE, worldToChunk, chunkKey } from '$lib/shared/gridMath';
  import { gridStore, fireworksStore, type Firework } from '$lib/stores/gridStore';
  import { Eraser, PaintBucket, Triangle, Circle, Rocket } from 'lucide-svelte';

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let rafId: number;

  // View settings
  let scale = 1;
  let pixelSize = 16;
  let offsetX = 0;
  let offsetY = 0;

  // Drawing settings
  let currentColor = '#0077ff';
  let isEraser = false;
  let isFillMode = false;
  let fireworkMode: 'anar' | 'chakri' | 'rocket' | null = null;

  // Chunk storage - subscribe to gridStore for synced data
  let chunks = new Map<string, Map<string, string>>();

  // Subscribe to gridStore for updates from other users
  gridStore.subscribe((storeChunks) => {
    chunks = storeChunks;
  });

  // Fireworks storage
  let fireworks = new Map<string, Firework>();

  // Subscribe to fireworksStore
  fireworksStore.subscribe((storeFireworks) => {
    fireworks = storeFireworks;
  });

  // --- Pixel helpers ---
  function setPixel(worldX: number, worldY: number, color: string) {
    const { chunkX, chunkY, localX, localY } = worldToChunk(worldX, worldY);

    // Send update to server to sync with other users
    gridStore.setPixel(chunkX, chunkY, localX, localY, color);

    // Also update locally for immediate feedback
    const key = chunkKey(chunkX, chunkY);
    if (!chunks.has(key)) chunks.set(key, new Map());
    chunks.get(key)!.set(`${localX},${localY}`, color);
  }

  // --- Canvas setup ---
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // --- Drawing loop ---
  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const worldLeft = -offsetX / (pixelSize * scale);
    const worldTop = -offsetY / (pixelSize * scale);
    const worldRight = (w - offsetX) / (pixelSize * scale);
    const worldBottom = (h - offsetY) / (pixelSize * scale);

    const chunkX0 = Math.floor(worldLeft / CHUNK_SIZE);
    const chunkY0 = Math.floor(worldTop / CHUNK_SIZE);
    const chunkX1 = Math.floor(worldRight / CHUNK_SIZE);
    const chunkY1 = Math.floor(worldBottom / CHUNK_SIZE);

    // Draw visible pixels
    for (let cx = chunkX0; cx <= chunkX1; cx++) {
      for (let cy = chunkY0; cy <= chunkY1; cy++) {
        const chunk = chunks.get(chunkKey(cx, cy));
        if (!chunk) continue;

        for (const [coord, color] of chunk.entries()) {
          const [lx, ly] = coord.split(',').map(Number);
          const wx = cx * CHUNK_SIZE + lx;
          const wy = cy * CHUNK_SIZE + ly;
          const sx = wx * pixelSize * scale + offsetX;
          const sy = wy * pixelSize * scale + offsetY;
          ctx.fillStyle = color;
          ctx.fillRect(sx, sy, pixelSize * scale, pixelSize * scale);
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    for (let x = Math.floor(worldLeft); x <= Math.ceil(worldRight); x++) {
      const sx = x * pixelSize * scale + offsetX;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();
    }
    for (let y = Math.floor(worldTop); y <= Math.ceil(worldBottom); y++) {
      const sy = y * pixelSize * scale + offsetY;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
    }

    // Draw fireworks
    for (const firework of fireworks.values()) {
      if (firework.type === 'anar') {
        drawAnar(firework.x, firework.y, firework.lit, firework.litAt || 0);
      } else if (firework.type === 'chakri') {
        drawChakri(firework.x, firework.y, firework.lit, firework.litAt || 0);
      } else if (firework.type === 'rocket') {
        drawRocket(firework.x, firework.y, firework.lit, firework.litAt || 0);
      }
    }

    rafId = requestAnimationFrame(draw);
  }

  // --- Firework drawing functions ---
  function drawPixel(worldX: number, worldY: number, color: string) {
    const sx = worldX * pixelSize * scale + offsetX;
    const sy = worldY * pixelSize * scale + offsetY;
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, pixelSize * scale, pixelSize * scale);
  }

  function drawAnar(baseX: number, baseY: number, lit: boolean, litAt: number) {
    // Draw triangular anar using pixels (5 pixels wide at base, tapering to point)

    // Triangle shape - proper triangular form
    // Row 1 (base) - 5 pixels wide
    drawPixel(baseX - 2, baseY, '#2d5016');
    drawPixel(baseX - 1, baseY, '#2d5016');
    drawPixel(baseX, baseY, '#2d5016');
    drawPixel(baseX + 1, baseY, '#2d5016');
    drawPixel(baseX + 2, baseY, '#2d5016');

    // Row 2 - 3 pixels wide
    drawPixel(baseX - 1, baseY - 1, '#2d5016');
    drawPixel(baseX, baseY - 1, '#2d5016');
    drawPixel(baseX + 1, baseY - 1, '#2d5016');

    // Row 3 - 3 pixels wide
    drawPixel(baseX - 1, baseY - 2, '#1a3010');  // Darker sides
    drawPixel(baseX, baseY - 2, '#2d5016');
    drawPixel(baseX + 1, baseY - 2, '#1a3010');  // Darker sides

    // Row 4 - 1 pixel (tip)
    drawPixel(baseX, baseY - 3, '#2d5016');

    // Black outline pixels
    drawPixel(baseX - 3, baseY, '#000');         // Left edge
    drawPixel(baseX + 3, baseY, '#000');         // Right edge
    drawPixel(baseX - 2, baseY - 1, '#000');
    drawPixel(baseX + 2, baseY - 1, '#000');
    drawPixel(baseX - 2, baseY - 2, '#000');
    drawPixel(baseX + 2, baseY - 2, '#000');
    drawPixel(baseX - 1, baseY - 3, '#000');
    drawPixel(baseX + 1, baseY - 3, '#000');
    drawPixel(baseX, baseY - 4, '#000');         // Top point

    // Fuse pixel
    drawPixel(baseX, baseY - 5, '#8b4513');

    // Animated flame and particles if lit
    if (lit) {
      const elapsed = (Date.now() - litAt) / 1000;

      // Volcanic particle ejection from the tip (small particles shooting out)
      for (let i = 0; i < 15; i++) {
        const particleLife = (elapsed * 10 + i * 0.1) % 1; // Fast, looping particles
        const angle = (i / 15) * Math.PI * 0.6 - Math.PI * 0.3; // Spread in cone shape
        const speed = 4 + (i % 3);
        const particleX = Math.floor(baseX + Math.sin(angle) * particleLife * speed);
        const particleY = Math.floor(baseY - 6 - particleLife * speed);

        // Hot particles: orange -> red -> dark
        const colors = ['#ffff00', '#ff9900', '#ff6600', '#ff3300', '#cc0000'];
        const colorIdx = Math.min(Math.floor(particleLife * 5), colors.length - 1);
        drawPixel(particleX, particleY, colors[colorIdx]);
      }

      // DRAMATIC pixel sparks fountain - many more sparks!
      for (let i = 0; i < 20; i++) {
        const sparkLife = (elapsed * 3 + i * 0.15) % 3; // Looping sparks
        const sparkY = Math.floor(baseY - 9 - sparkLife * 12 + Math.sin(sparkLife * 4 + i) * 3);
        const sparkX = Math.floor(baseX + Math.sin(sparkLife * 3 + i * 0.5) * 6);

        // Color progression: white -> yellow -> orange -> red
        const colors = ['#ffffff', '#ffff00', '#ffcc00', '#ff9900', '#ff6600', '#ff3300', '#cc0000'];
        const colorIdx = Math.min(Math.floor(sparkLife * 3), colors.length - 1);
        drawPixel(sparkX, sparkY, colors[colorIdx]);
      }

      // Additional side sparks for extra drama
      for (let i = 0; i < 10; i++) {
        const sparkLife = (elapsed * 2.5 + i * 0.2) % 2;
        const angle = (i / 10) * Math.PI * 0.4 - Math.PI * 0.2; // Spread angle
        const distance = sparkLife * 8;
        const sparkX = Math.floor(baseX + Math.cos(angle - Math.PI/2) * distance);
        const sparkY = Math.floor(baseY - 6 - Math.sin(angle - Math.PI/2) * distance);

        const colors = ['#ffff00', '#ff9900', '#ff6600'];
        const colorIdx = Math.floor(sparkLife * 1.5) % colors.length;
        drawPixel(sparkX, sparkY, colors[colorIdx]);
      }

      // Ground sparks bouncing around the base
      if (Math.floor(elapsed * 5) % 3 === 0) {
        for (let i = 0; i < 5; i++) {
          const offset = Math.floor(Math.sin(elapsed * 8 + i) * 4);
          drawPixel(baseX + offset, baseY + 1, ['#ff6600', '#ff9900', '#ffcc00'][i % 3]);
        }
      }
    }
  }

  function drawChakri(centerX: number, centerY: number, lit: boolean, litAt: number) {
    // Draw circular chakri using pixels (pixelated circle)
    const radius = 3;
    const rotation = lit ? ((Date.now() - litAt) / 1000) * 8 : 0; // Rotate when lit

    // Define chakri pattern with visual markers (4 spokes)
    const pattern: Array<{x: number, y: number, color: string}> = [];

    // Create circular body with spokes
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        if (dist <= radius && dist > 1) {
          // Create 4 yellow spokes on red body
          const spokeAngle = ((angle + Math.PI) % (Math.PI / 2));
          const isSpokePixel = spokeAngle < 0.3 || spokeAngle > (Math.PI / 2 - 0.3);
          const color = isSpokePixel ? '#ffff00' : '#8b0000';
          pattern.push({x: dx, y: dy, color});
        } else if (dist <= 1) {
          // Black center hole
          pattern.push({x: dx, y: dy, color: '#000'});
        }
      }
    }

    // Draw the pattern with rotation
    for (const pixel of pattern) {
      // Apply rotation transformation
      const angle = Math.atan2(pixel.y, pixel.x) + rotation;
      const dist = Math.sqrt(pixel.x * pixel.x + pixel.y * pixel.y);
      const rotatedX = Math.round(Math.cos(angle) * dist);
      const rotatedY = Math.round(Math.sin(angle) * dist);

      drawPixel(centerX + rotatedX, centerY + rotatedY, pixel.color);
    }

    // Animated spinning pixel particles if lit
    if (lit) {
      const elapsed = (Date.now() - litAt) / 1000;

      // Draw spinning pixel sparks
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + rotation;
        const distance = 5 + Math.sin(elapsed * 15 + i) * 2;
        const px = Math.floor(centerX + Math.cos(angle) * distance);
        const py = Math.floor(centerY + Math.sin(angle) * distance);

        // Rainbow colors
        const hue = (elapsed * 100 + i * 45) % 360;
        const h = Math.floor(hue / 60);
        const colors = ['#ff0000', '#ff9900', '#ffff00', '#00ff00', '#0099ff', '#9900ff'];
        const color = colors[h % colors.length];

        drawPixel(px, py, color);

        // Trail pixels
        const trailDist = distance - 2;
        const trailX = Math.floor(centerX + Math.cos(angle) * trailDist);
        const trailY = Math.floor(centerY + Math.sin(angle) * trailDist);
        const trailColor = colors[(h + 1) % colors.length];
        drawPixel(trailX, trailY, trailColor);
      }
    }
  }

  function drawRocket(baseX: number, baseY: number, lit: boolean, litAt: number) {
    // Draw rocket launcher base (bottle-like structure)
    // Base stand (3x2 pixels)
    drawPixel(baseX - 1, baseY, '#8b4513');
    drawPixel(baseX, baseY, '#8b4513');
    drawPixel(baseX + 1, baseY, '#8b4513');
    drawPixel(baseX - 1, baseY - 1, '#654321');
    drawPixel(baseX, baseY - 1, '#654321');
    drawPixel(baseX + 1, baseY - 1, '#654321');

    // Bottle neck (1 pixel)
    drawPixel(baseX, baseY - 2, '#2d5016');
    drawPixel(baseX, baseY - 3, '#2d5016');

    if (lit) {
      const elapsed = (Date.now() - litAt) / 1000;
      const rocketCycleDuration = 2.5; // Each rocket cycle takes 2.5 seconds

      // Launch multiple rockets in sequence
      for (let rocketIndex = 0; rocketIndex < 3; rocketIndex++) {
        const rocketOffset = rocketIndex * 0.8; // Stagger rocket launches
        const rocketLife = ((elapsed + rocketOffset) % rocketCycleDuration) / rocketCycleDuration;

        if (rocketLife < 0.9) { // Rocket is active for first 90% of cycle
          const launchPhase = Math.min(rocketLife / 0.4, 1); // Launch takes 40% of cycle
          const explosionPhase = Math.max((rocketLife - 0.4) / 0.5, 0); // Explosion after launch

          // Rocket position (goes up)
          const rocketHeight = launchPhase * 25;
          const rocketX = Math.floor(baseX + Math.sin(rocketIndex * 2) * 2);
          const rocketY = Math.floor(baseY - 4 - rocketHeight);

          if (explosionPhase === 0) {
            // Draw rocket body (going up)
            drawPixel(rocketX, rocketY, '#ff0000');
            drawPixel(rocketX, rocketY + 1, '#ff3300');

            // Rocket trail (sparks following behind)
            for (let t = 0; t < 5; t++) {
              const trailY = rocketY + 2 + t;
              const trailAlpha = 1 - (t / 5);
              if (trailAlpha > 0.3) {
                const trailColors = ['#ffff00', '#ff9900', '#ff6600', '#ff3300'];
                drawPixel(rocketX, trailY, trailColors[Math.min(t, 3)]);
              }
            }
          } else {
            // Explosion particle system
            const numParticles = 30;

            for (let p = 0; p < numParticles; p++) {
              const angle = (p / numParticles) * Math.PI * 2;
              const speed = 3 + (p % 5);
              const particleLife = explosionPhase;

              // Particle spreads out from explosion center
              const px = Math.floor(rocketX + Math.cos(angle) * speed * particleLife);
              const py = Math.floor(rocketY + Math.sin(angle) * speed * particleLife + particleLife * 2); // Gravity effect

              // Color progression: white -> yellow -> orange -> red -> fade
              const colorPhase = Math.min(particleLife * 2, 1);
              const colors = ['#ffffff', '#ffff99', '#ffcc00', '#ff9900', '#ff6600', '#ff3300', '#cc0000'];
              const colorIdx = Math.min(Math.floor(colorPhase * 6), 6);

              if (particleLife < 0.8) { // Fade out particles near end
                drawPixel(px, py, colors[colorIdx]);
              }
            }

            // Central bright flash
            if (explosionPhase < 0.3) {
              drawPixel(rocketX, rocketY, '#ffffff');
              drawPixel(rocketX + 1, rocketY, '#ffff99');
              drawPixel(rocketX - 1, rocketY, '#ffff99');
              drawPixel(rocketX, rocketY + 1, '#ffff99');
              drawPixel(rocketX, rocketY - 1, '#ffff99');
            }
          }
        }
      }

      // Launch sparks from bottle (continuous)
      if (Math.floor(elapsed * 10) % 3 === 0) {
        for (let i = 0; i < 3; i++) {
          const sparkX = baseX + Math.floor(Math.sin(elapsed * 12 + i) * 2);
          const sparkY = baseY - 4 + i;
          drawPixel(sparkX, sparkY, ['#ffff00', '#ff9900', '#ff6600'][i]);
        }
      }
    }
  }

  // --- Interaction state ---
  let isPanning = false;
  let isPainting = false;
  let lastX = 0;
  let lastY = 0;

  // --- Cursor update helper ---
  function updateCursor() {
    if (isPainting) {
      canvas.style.cursor = 'crosshair';
    } else if (isPanning) {
      canvas.style.cursor = 'grabbing';
    } else if (isFillMode) {
      canvas.style.cursor = 'cell';
    } else {
      canvas.style.cursor = 'crosshair';
    }
  }

  // --- Mouse event handlers ---
  function onMouseDown(e: MouseEvent) {
    e.preventDefault();

    if (e.button === 2) {
      // Right-click → pan
      isPanning = true;
      lastX = e.clientX;
      lastY = e.clientY;
    } else if (e.button === 0) {
      const worldX = Math.floor((e.clientX - offsetX) / (pixelSize * scale));
      const worldY = Math.floor((e.clientY - offsetY) / (pixelSize * scale));

      if (fireworkMode) {
        // Place firework
        gridStore.placeFirework(fireworkMode, worldX, worldY);
      } else {
        // Check if clicking on a firework
        let fireworkClicked = false;
        for (const firework of fireworks.values()) {
          const dx = Math.abs(firework.x - worldX);
          const dy = Math.abs(firework.y - worldY);
          if (dx < 5 && dy < 5) {
            if (isEraser) {
              // Remove firework in eraser mode
              gridStore.removeFirework(firework.id);
            } else if (!firework.lit) {
              // Light firework in normal mode
              gridStore.lightFirework(firework.id);
            }
            fireworkClicked = true;
            break;
          }
        }

        if (!fireworkClicked) {
          if (isFillMode) {
            // Fill mode → flood fill on click
            const fillColor = isEraser ? '#fafafa' : currentColor;
            floodFill(worldX, worldY, fillColor);
          } else {
            // Left-click → paint
            isPainting = true;
            paintAt(e);
          }
        }
      }
    }
    updateCursor();
  }

  function paintAt(e: MouseEvent) {
    // TODO: may need to add canvas.boundingClientRect.top / .left to acount for other elements on the screen
    const worldX = Math.floor((e.clientX - offsetX) / (pixelSize * scale));
    const worldY = Math.floor((e.clientY - offsetY) / (pixelSize * scale));
    const color = isEraser ? '#fafafa' : currentColor;
    setPixel(worldX, worldY, color);
  }

  function toggleEraser() {
    isEraser = !isEraser;
  }

  function toggleFillMode() {
    isFillMode = !isFillMode;
  }

  function toggleAnarMode() {
    fireworkMode = fireworkMode === 'anar' ? null : 'anar';
  }

  function toggleChakriMode() {
    fireworkMode = fireworkMode === 'chakri' ? null : 'chakri';
  }

  function toggleRocketMode() {
    fireworkMode = fireworkMode === 'rocket' ? null : 'rocket';
  }

  function getPixelColor(worldX: number, worldY: number): string {
    const { chunkX, chunkY, localX, localY } = worldToChunk(worldX, worldY);
    const key = chunkKey(chunkX, chunkY);
    const chunk = chunks.get(key);
    if (!chunk) return '#fafafa'; // Default background color
    return chunk.get(`${localX},${localY}`) || '#fafafa';
  }

  function floodFill(startX: number, startY: number, fillColor: string) {
    const targetColor = getPixelColor(startX, startY);

    // If target color is the same as fill color, nothing to do
    if (targetColor === fillColor) return;

    const queue: Array<{x: number, y: number}> = [{x: startX, y: startY}];
    const visited = new Set<string>();
    const maxPixels = 10000; // Safety limit to prevent infinite loops
    let pixelCount = 0;

    while (queue.length > 0 && pixelCount < maxPixels) {
      const {x, y} = queue.shift()!;
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const currentColor = getPixelColor(x, y);
      if (currentColor !== targetColor) continue;

      // Fill this pixel
      setPixel(x, y, fillColor);
      pixelCount++;

      // Add neighbors to queue
      queue.push({x: x + 1, y});
      queue.push({x: x - 1, y});
      queue.push({x, y: y + 1});
      queue.push({x, y: y - 1});
    }
  }

  function onMouseMove(e: MouseEvent) {
    if (isPanning) {
      offsetX += e.clientX - lastX;
      offsetY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
    } else if (isPainting) {
      paintAt(e);
    }
  }

  function onMouseUp() {
    isPanning = false;
    isPainting = false;
    updateCursor();
  }

  function onDoubleClick(e: MouseEvent) {
    isPanning = true;
    lastX = e.clientX;
    lastY = e.clientY;
    updateCursor();
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomFactor = 1.12;
    const delta = -e.deltaY;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const beforeX = (sx - offsetX) / scale;
    const beforeY = (sy - offsetY) / scale;

    if (delta > 0) scale *= zoomFactor;
    else scale /= zoomFactor;
    scale = Math.max(0.1, Math.min(20, scale));

    const afterX = (sx - offsetX) / scale;
    const afterY = (sy - offsetY) / scale;
    offsetX += (afterX - beforeX) * scale;
    offsetY += (afterY - beforeY) * scale;
  }

  // --- Lifecycle ---
  onMount(() => {
    ctx = canvas.getContext('2d')!;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('dblclick', onDoubleClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    updateCursor();
    rafId = requestAnimationFrame(draw);

    gridStore.connect();
    gridStore.joinChunk(0, 0); // load central chunk
  });

  onDestroy(() => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resizeCanvas);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('contextmenu', onContextMenu);
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('dblclick', onDoubleClick);
    canvas.removeEventListener('wheel', onWheel);
  });
</script>

<div class="toolbar">
  <div class="color-picker-wrapper">
    <input
      type="color"
      bind:value={currentColor}
      class="color-picker"
      title="Pick color"
    />
  </div>
  <button
    class="tool-btn"
    class:active={isEraser}
    on:click={toggleEraser}
    title="Eraser"
  >
    <Eraser size={18} />
  </button>
  <button
    class="tool-btn"
    class:active={isFillMode}
    on:click={toggleFillMode}
    title="Fill tool"
  >
    <PaintBucket size={18} />
  </button>
  <button
    class="tool-btn"
    class:active={fireworkMode === 'anar'}
    on:click={toggleAnarMode}
    title="Place Anar (fountain)"
  >
    <Triangle size={18} />
  </button>
  <button
    class="tool-btn"
    class:active={fireworkMode === 'chakri'}
    on:click={toggleChakriMode}
    title="Place Chakri (spinning wheel)"
  >
    <Circle size={18} />
  </button>
  <button
    class="tool-btn"
    class:active={fireworkMode === 'rocket'}
    on:click={toggleRocketMode}
    title="Place Rocket (sky rocket)"
  >
    <Rocket size={18} />
  </button>
</div>

<canvas bind:this={canvas} class="grid"></canvas>

<style>
  .grid {
    width: 100vw;
    height: 100vh;
    background: #fafafa;
    display: block;
    touch-action: none;
  }

  .toolbar {
    position: fixed;
    top: 16px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: white;
    padding: 8px;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
  }

  .color-picker-wrapper {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid #ddd;
    cursor: pointer;
    transition: border-color 0.2s;
    position: relative;
  }

  .color-picker-wrapper:hover {
    border-color: #999;
  }

  .color-picker {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(1.8);
    width: 100%;
    height: 100%;
    border: none;
    cursor: pointer;
  }

  .tool-btn {
    width: 32px;
    height: 32px;
    border: 2px solid #ddd;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    padding: 0;
  }

  .tool-btn:hover {
    border-color: #999;
    background: #f5f5f5;
  }

  .tool-btn.active {
    background: #0077ff;
    border-color: #0077ff;
    color: white;
  }
</style>
