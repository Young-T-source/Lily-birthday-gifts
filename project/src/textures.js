import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Tiny deterministic noise kit used to author every texture at run   */
/*  time.  No image requests, the final page is fully self contained.  */
/* ------------------------------------------------------------------ */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, seed) {
  const h = Math.sin(x * 127.1 + y * 311.7 + seed * 73.31) * 43758.5453;
  return h - Math.floor(h);
}
function smooth(t) { return t * t * (3 - 2 * t); }
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
export function fbm(x, y, seed = 1, octaves = 4) {
  let value = 0, amp = 0.5, fx = x, fy = y;
  for (let i = 0; i < octaves; i++) {
    value += amp * vnoise(fx, fy, seed + i * 17);
    fx *= 2.03; fy *= 2.03; amp *= 0.5;
  }
  return value;
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  return c;
}

function finish(c, { repeat = 1, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/* Sobel-ish normal map from a grayscale canvas. */
function normalMapFrom(source, strength = 2.2) {
  const w = source.width, h = source.height;
  const sctx = source.getContext('2d');
  const src = sctx.getImageData(0, 0, w, h).data;
  const target = canvas(w);
  const tctx = target.getContext('2d');
  const out = tctx.createImageData(w, h);
  const height = (x, y) => {
    x = (x + w) % w; y = (y + h) % h;
    return src[(y * w + x) * 4] / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (height(x - 1, y) - height(x + 1, y)) * strength;
      const dy = (height(x, y - 1) - height(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  tctx.putImageData(out, 0, 0);
  return target;
}

function normalTexture(source, repeat, strength = 2.2) {
  const t = finish(normalMapFrom(source, strength), { repeat, srgb: false });
  return t;
}

/* ------------------------------------------------------------------ */
/*  Wood — warm honey planks with visible grain, knots and saw marks   */
/* ------------------------------------------------------------------ */
function woodTextures(seed, base, dark, light, repeat = 1) {
  const size = 512;
  const c = canvas(size), ctx = c.getContext('2d');
  const height = canvas(size), hctx = height.getContext('2d');
  const img = ctx.createImageData(size, size);
  const himg = hctx.createImageData(size, size);
  const rnd = mulberry32(seed);
  const knots = [];
  for (let i = 0; i < 5; i++) {
    knots.push({ x: rnd() * size, y: rnd() * size, rx: 6 + rnd() * 18, ry: 4 + rnd() * 10 });
  }
  const plankCount = 4, plankH = size / plankCount;
  const plankTint = Array.from({ length: plankCount }, () => 0.86 + rnd() * 0.25);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const pi = Math.min(plankCount - 1, Math.floor(y / plankH));
      const localY = y - pi * plankH;
      const warp = fbm(x * 0.012, localY * 0.006, seed, 3);
      const grain = 0.5 + 0.5 * Math.sin(x * 0.09 + warp * 14 + pi * 2.4);
      const fine = fbm(x * 0.09, y * 0.018, seed + 3, 2);
      let shade = 0.48 + grain * 0.22 + fine * 0.2;
      // cathedral grain / concentric figure
      for (const k of knots) {
        const dx = (x - k.x) / (k.rx * 3.2), dy = (y - k.y) / (k.ry * 3.2);
        const d = Math.hypot(dx, dy);
        shade -= Math.exp(-d * 1.7) * 0.12;
        shade += Math.sin(d * 17) * Math.exp(-d * 1.6) * 0.045;
      }
      // seam
      const edge = Math.min(localY, plankH - localY);
      if (edge < 2) shade *= 0.42;
      shade *= plankTint[pi];
      const i = (y * size + x) * 4;
      img.data[i] = Math.min(255, base[0] * shade * 1.55 + light[0] * 0.12);
      img.data[i + 1] = Math.min(255, base[1] * shade * 1.55 + light[1] * 0.1);
      img.data[i + 2] = Math.min(255, base[2] * shade * 1.55 + light[2] * 0.1);
      img.data[i + 3] = 255;
      const hv = Math.min(255, shade * 255 * 0.9);
      himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = hv;
      himg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  hctx.putImageData(himg, 0, 0);
  // occasional pale scratch / saw mark
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = 'rgba(255,225,190,1)';
  for (let i = 0; i < 12; i++) {
    ctx.lineWidth = 0.6 + rnd() * 1.2;
    ctx.beginPath();
    const yy = rnd() * size;
    ctx.moveTo(0, yy);
    ctx.bezierCurveTo(size * 0.3, yy + rnd() * 20, size * 0.7, yy - rnd() * 20, size, yy + rnd() * 10);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return {
    map: finish(c, { repeat }),
    normalMap: normalTexture(height, repeat, 1.5),
    height
  };
}

/* ------------------------------------------------------------------ */
/*  Stone — irregular fieldstone set in deep mortar                    */
/* ------------------------------------------------------------------ */
function stoneTextures(seed, repeat = 2) {
  const size = 512;
  const c = canvas(size), ctx = c.getContext('2d');
  const height = canvas(size), hctx = height.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.fillStyle = '#4a463f'; ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#202020'; hctx.fillRect(0, 0, size, size);
  ctx.lineJoin = 'round';
  const rows = 7, rh = size / rows;
  const palette = ['#857c70', '#92887a', '#756c61', '#9b9182', '#7f776c', '#6d645b', '#8d8275'];
  for (let row = 0; row < rows; row++) {
    let x = -30 + rnd() * 26;
    const y0 = row * rh + 3;
    while (x < size + 20) {
      const w = 44 + rnd() * 82;
      const h = rh - 6 - rnd() * 7;
      if (w < 30) { x += w + 4; continue; }
      const b = 3 + rnd() * 5;
      const j = () => (rnd() - 0.5) * 4.5;
      const pts = [
        [x + b + j(), y0 + j()],
        [x + w - b + j(), y0 + j()],
        [x + w + j(), y0 + b + j()],
        [x + w + j(), y0 + h - b + j()],
        [x + w - b + j(), y0 + h + j()],
        [x + b + j(), y0 + h + j()],
        [x + j(), y0 + h - b + j()],
        [x + j(), y0 + b + j()]
      ];
      const cx = x + w / 2, cy = y0 + h / 2;
      const col = palette[Math.floor(rnd() * palette.length)];
      const grad = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 3, cy + h / 2);
      grad.addColorStop(0, col);
      grad.addColorStop(0.7, col);
      grad.addColorStop(1, '#5f584f');
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = 'rgba(35,32,28,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
      // chiselled facets and weathering
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = 'rgba(235,228,214,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pts[1][0], pts[1][1] + 2);
      ctx.lineTo(pts[2][0] + 3, pts[2][1] + 2);
      ctx.stroke();
      ctx.globalAlpha = 0.1;
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = k % 2 ? '#2b2823' : '#d6cfc0';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        const sx = cx + (rnd() - 0.5) * w * 0.5;
        const sy = cy + (rnd() - 0.5) * h * 0.5;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (rnd() - 0.5) * 24, sy + (rnd() - 0.5) * 10);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // height: bevelled face
      hctx.beginPath();
      hctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) hctx.lineTo(pts[i][0], pts[i][1]);
      hctx.closePath();
      const hg = hctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
      hg.addColorStop(0, '#efefef');
      hg.addColorStop(0.65, '#c9c9c9');
      hg.addColorStop(1, '#8f8f8f');
      hctx.fillStyle = hg; hctx.fill();
      x += w + 5 + rnd() * 7;
    }
  }
  // fine mineral speckle / weathering
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const g = (fbm(x * 0.08, y * 0.08, seed + 8, 2) - 0.5) * 18;
      const grain = (rnd() - 0.5) * 12;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + g + grain));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + g + grain));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + g + grain));
    }
  }
  ctx.putImageData(img, 0, 0);
  return {
    map: finish(c, { repeat }),
    normalMap: normalTexture(height, repeat, 2.6)
  };
}

/* ------------------------------------------------------------------ */
/*  Snow — soft blue-white with crystalline glints                     */
/* ------------------------------------------------------------------ */
function snowTextures(seed, repeat = 20) {
  const size = 512;
  const c = canvas(size), ctx = c.getContext('2d');
  const height = canvas(size), hctx = height.getContext('2d');
  const rough = canvas(size), rctx = rough.getContext('2d');
  const img = ctx.createImageData(size, size), himg = hctx.createImageData(size, size);
  const rimg = rctx.createImageData(size, size), rnd = mulberry32(seed);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const drift = fbm(x * .014, y * .014, seed, 3);
      const crystal = fbm(x * .17, y * .17, seed + 4, 2);
      const grain = rnd();
      // Snow has a dense, finely granular surface, never painted white dots.
      const v = .91 + drift * .075 + crystal * .028 + (grain - .5) * .016;
      const i = (y * size + x) * 4;
      img.data[i] = 234 * v; img.data[i + 1] = 241 * v; img.data[i + 2] = 248 * v; img.data[i + 3] = 255;
      const hv = 112 + drift * 44 + crystal * 36 + (grain - .5) * 13;
      himg.data[i] = himg.data[i + 1] = himg.data[i + 2] = hv; himg.data[i + 3] = 255;
      const rv = 226 + crystal * 22 - Math.pow(grain, 24) * 43;
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rv; rimg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0); hctx.putImageData(himg, 0, 0); rctx.putImageData(rimg, 0, 0);
  return { map: finish(c, { repeat }), normalMap: normalTexture(height, repeat, 1.65), roughnessMap: finish(rough, { repeat, srgb: false }) };
}

/* ------------------------------------------------------------------ */
/*  Roof shingles                                                     */
/* ------------------------------------------------------------------ */
function roofTextures(seed, repeat = 5) {
  const size = 512, c = canvas(size), ctx = c.getContext('2d');
  const height = canvas(size), hctx = height.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.fillStyle = '#282c2d'; ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#333'; hctx.fillRect(0, 0, size, size);
  const rows = 16, rh = size / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * 26;
    for (let x = -offset; x < size; x += 52) {
      const shade = 48 + rnd() * 38;
      const w = 48 + rnd() * 8, h = rh - 2;
      ctx.fillStyle = `rgb(${shade * 0.8},${shade * 0.9},${shade})`;
      ctx.beginPath();
      ctx.roundRect(x + 1, r * rh + 1, w, h, [2, 2, 5, 5]);
      ctx.fill();
      ctx.fillStyle = 'rgba(220,230,235,0.09)';
      ctx.fillRect(x + 2, r * rh + 1, w - 3, 1.5);
      hctx.fillStyle = `rgb(${180 + rnd() * 50},${180},${180})`;
      hctx.beginPath(); hctx.roundRect(x + 1, r * rh + 1, w, h, 4); hctx.fill();
    }
  }
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 14;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return { map: finish(c, { repeat }), normalMap: normalTexture(height, repeat, 2.4) };
}

/* ------------------------------------------------------------------ */
/*  Hand woven wool rug                                               */
/* ------------------------------------------------------------------ */
function rugTexture(seed) {
  const size = 512, c = canvas(size), ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.fillStyle = '#6f2d23'; ctx.fillRect(0, 0, size, size);
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, 'rgba(255,190,120,0.14)');
  grad.addColorStop(0.5, 'rgba(40,10,5,0.1)');
  grad.addColorStop(1, 'rgba(255,190,120,0.1)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
  // border
  ctx.strokeStyle = '#d9b98d'; ctx.lineWidth = 16; ctx.strokeRect(18, 18, size - 36, size - 36);
  ctx.strokeStyle = '#2e4b47'; ctx.lineWidth = 5; ctx.strokeRect(32, 32, size - 64, size - 64);
  // repeating diamonds
  const colors = ['#d9b98d', '#33524c', '#a8543b', '#e6d2ae'];
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      const cx = 72 + gx * 123, cy = 72 + gy * 123;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = colors[(gx + gy) % colors.length]; ctx.lineWidth = 7;
      ctx.strokeRect(-30, -30, 60, 60);
      ctx.strokeStyle = 'rgba(240,220,185,0.55)'; ctx.lineWidth = 2.5;
      ctx.strokeRect(-16, -16, 32, 32);
      ctx.restore();
    }
  }
  // woven fibre noise
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const weave = (Math.sin(x * 1.8) + Math.sin(y * 1.8)) * 3;
      const n = (rnd() - 0.5) * 15;
      img.data[i] += weave + n; img.data[i + 1] += weave + n; img.data[i + 2] += weave + n;
    }
  }
  ctx.putImageData(img, 0, 0);
  const bump = canvas(size), bctx = bump.getContext('2d');
  bctx.drawImage(c, 0, 0);
  return { map: finish(c, { repeat: 1 }), normalMap: normalTexture(bump, 1, 1.4) };
}

/* ------------------------------------------------------------------ */
/*  Knitted throw / fabric                                            */
/* ------------------------------------------------------------------ */
function knitTexture(seed, base, accent) {
  const size = 256, c = canvas(size), ctx = c.getContext('2d');
  const height = canvas(size), hctx = height.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#777'; hctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 12) {
    for (let x = 0; x < size; x += 12) {
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.35 + rnd() * 0.25;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(x + 6, y + 6, 5, Math.PI * 0.2, Math.PI * 1.05);
      ctx.stroke();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.ellipse(x + 6, y + 6, 2.6, 4.2, 0.4, 0, Math.PI * 2); ctx.fill();
      hctx.fillStyle = `rgb(${170 + rnd() * 50},${170},${170})`;
      hctx.beginPath(); hctx.ellipse(x + 6, y + 6, 4, 5, 0, 0, Math.PI * 2); hctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  return { map: finish(c, { repeat: 3 }), normalMap: normalTexture(height, 3, 1.8) };
}

/* ------------------------------------------------------------------ */
/*  Frost on the window glass                                         */
/* ------------------------------------------------------------------ */
function frostTexture(seed) {
  const size = 512, c = canvas(size), ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.clearRect(0, 0, size, size);
  const edge = (x0, y0, dx, dy) => {
    let x = x0, y = y0;
    const steps = 20 + Math.floor(rnd() * 30);
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 0; i < steps; i++) {
      x += dx * (2 + rnd() * 6) + (rnd() - 0.5) * 12;
      y += dy * (2 + rnd() * 6) + (rnd() - 0.5) * 12;
      ctx.lineTo(x, y);
      if (rnd() > 0.72) {
        const bx = x + (rnd() - 0.5) * 26, by = y + (rnd() - 0.5) * 26;
        ctx.moveTo(x, y); ctx.lineTo(bx, by);
      }
    }
    ctx.stroke();
  };
  ctx.strokeStyle = 'rgba(240,250,255,0.75)';
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 10; i++) {
    edge(rnd() * size, 0, (rnd() - 0.5) * 0.5, 1);
    edge(rnd() * size, size, (rnd() - 0.5) * 0.5, -1);
    edge(0, rnd() * size, 1, (rnd() - 0.5) * 0.5);
    edge(size, rnd() * size, -1, (rnd() - 0.5) * 0.5);
  }
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.72);
  g.addColorStop(0, 'rgba(230,245,255,0)');
  g.addColorStop(0.68, 'rgba(235,248,255,0.06)');
  g.addColorStop(1, 'rgba(240,250,255,0.34)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* Soft smoke sprite */
function smokeTexture(seed) {
  const size = 256, c = canvas(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rnd = mulberry32(seed);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size * 2 - 1, v = y / size * 2 - 1;
      const r = Math.hypot(u, v);
      const n = fbm(x * 0.026, y * 0.026, seed, 5);
      const n2 = fbm(x * 0.075, y * 0.075, seed + 6, 3);
      let a = Math.max(0, 1 - r * 1.15);
      a = Math.pow(a, 1.65);
      a *= 0.42 + n * 0.85;
      a *= 0.65 + n2 * 0.55;
      a = Math.min(1, a * 1.25);
      const i = (y * size + x) * 4;
      const shade = 192 + n * 48;
      img.data[i] = shade * 0.9;
      img.data[i + 1] = shade * 0.94;
      img.data[i + 2] = shade;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Generic radial glow */
function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const size = 256, c = canvas(size), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.13, inner);
  g.addColorStop(0.42, outer.replace('0)', '0.22)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Warm window light pool / fake projection on snow */
function lightPoolTexture() {
  const w = 256, h = 512, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(w / 2, 0, 4, w / 2, 0, h * 0.9);
  g.addColorStop(0, 'rgba(255,197,111,0.95)');
  g.addColorStop(0.2, 'rgba(255,167,76,0.55)');
  g.addColorStop(0.6, 'rgba(255,140,50,0.14)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Wooden sign */
function signTexture() {
  const w = 1536, h = 576, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d'), rnd = mulberry32(22);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#503424'); g.addColorStop(.5, '#71503a'); g.addColorStop(1, '#3c271d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 210; i++) {
    ctx.strokeStyle = `rgba(20,10,5,${.035 + rnd() * .12})`; ctx.lineWidth = .8 + rnd() * 3;
    const y = rnd() * h; ctx.beginPath(); ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * .3, y + (rnd() - .5) * 35, w * .7, y + (rnd() - .5) * 35, w, y + (rnd() - .5) * 20); ctx.stroke();
  }
  ctx.strokeStyle = '#c9a778'; ctx.lineWidth = 5; ctx.strokeRect(29, 29, w - 58, h - 58);
  ctx.strokeStyle = 'rgba(201,167,120,.44)'; ctx.lineWidth = 2; ctx.strokeRect(42, 42, w - 84, h - 84);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'italic 102px Georgia, "Times New Roman", serif';
  ctx.fillStyle = 'rgba(12,6,3,.75)'; ctx.fillText('Lily’s lovely house', w / 2 + 3, h * .445 + 4);
  ctx.fillStyle = '#ffedce'; ctx.fillText('Lily’s lovely house', w / 2, h * .445);
  ctx.font = '400 41px "Microsoft YaHei", sans-serif'; ctx.fillStyle = '#e4c69e';
  ctx.fillText('为你留灯 · 生日快乐', w / 2, h * .73);
  // A small engraved heart, rather than an oversized decorative sticker.
  ctx.fillStyle = '#e2b9a3'; ctx.beginPath();
  const x = w / 2, y = h * .19, k = 11;
  ctx.moveTo(x, y + k); ctx.bezierCurveTo(x - k * 2, y - k * .25, x - k, y - k * 1.6, x, y - k * .5);
  ctx.bezierCurveTo(x + k, y - k * 1.6, x + k * 2, y - k * .25, x, y + k); ctx.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/* Little framed landscape paintings */
function paintingTexture(seed) {
  const size = 256, c = canvas(size), ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const sky = ctx.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, '#20384c'); sky.addColorStop(0.55, '#c98c63'); sky.addColorStop(1, '#f2d3a1');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#2a3d45';
  for (let i = 0; i < 7; i++) {
    const x = 20 + i * 38 + rnd() * 16;
    ctx.beginPath();
    ctx.moveTo(x, 180);
    ctx.lineTo(x + 14, 90 + rnd() * 30);
    ctx.lineTo(x + 30, 180);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,220,0.65)';
    ctx.beginPath(); ctx.moveTo(x + 14, 90 + rnd() * 10); ctx.lineTo(x + 23, 125); ctx.lineTo(x + 5, 125); ctx.fill();
    ctx.fillStyle = '#2a3d45';
  }
  ctx.fillStyle = '#d7e3e8'; ctx.fillRect(0, 180, size, 76);
  ctx.fillStyle = 'rgba(80,110,130,0.2)';
  ctx.fillRect(0, 190, size, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ */
export function createTextures() {
  const log = woodTextures(11, [150, 94, 54], [50, 27, 13], [235, 190, 140], 2);
  const floor = woodTextures(23, [122, 75, 43], [38, 20, 11], [220, 170, 120], 4);
  const darkWood = woodTextures(41, [92, 58, 36], [30, 16, 9], [180, 130, 88], 2);
  const stone = stoneTextures(5, 2.2);
  const snow = snowTextures(7, 22);
  const roof = roofTextures(9, 5);
  const rug = rugTexture(13);
  const knitOchre = knitTexture(17, '#a8613c', '#d7a574');
  const knitCream = knitTexture(19, '#cbb99e', '#efe4d2');
  const knitGreen = knitTexture(29, '#3f5548', '#6c806c');
  const frost = frostTexture(31);
  const smoke = smokeTexture(37);
  const glowWarm = glowTexture('rgba(255,220,160,1)', 'rgba(255,160,70,0)');
  const glowSoft = glowTexture('rgba(255,255,255,1)', 'rgba(200,220,255,0)');
  const lightPool = lightPoolTexture();
  const sign = signTexture();
  const paintingA = paintingTexture(3);
  const paintingB = paintingTexture(8);
  return {
    log, floor, darkWood, stone, snow, roof, rug,
    knitOchre, knitCream, knitGreen, frost, smoke, glowWarm, glowSoft,
    lightPool, sign, paintingA, paintingB
  };
}
