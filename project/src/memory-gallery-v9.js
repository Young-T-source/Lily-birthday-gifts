import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const FONT = '"Microsoft YaHei", "PingFang SC", sans-serif';
const ease = x => { x = THREE.MathUtils.clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const clip = (text, n) => { const chars = Array.from(String(text || '')); return chars.length > n ? chars.slice(0, n - 1).join('') + '…' : chars.join(''); };

// Coordinates refer to the actual loft walls in birthday-loft.js. These are
// thin wall hangings, never freestanding obstacles or new navigation blockers.
export const MEMORY_WALL_SLOTS = Object.freeze([
  ...[5.86, 4.56].flatMap(y => Array.from({ length: 8 }, (_, i) => ({ wall: 'back', x: -3.94 + i * .77, y, z: -3.195, rotation: 0 }))),
  ...[5.86, 4.56].flatMap(y => [2.84, 2.03, 1.22].map(z => ({ wall: 'left', x: -4.405, y, z, rotation: Math.PI / 2 }))),
  ...[5.86, 4.56].flatMap(y => [1.22, 2.03, 2.84].map(z => ({ wall: 'right', x: 4.405, y, z, rotation: -Math.PI / 2 })))
]);

// Each pair lives at the edges of the camera frustum. The opening nine shells
// and the central birthday lettering always retain their own empty sky.
const SKY_CUES = Object.freeze([
  { start: 11.35, end: 18.75, first: 0 },
  { start: 20.30, end: 27.70, first: 2 },
  { start: 29.90, end: 37.30, first: 4 },
  { start: 39.50, end: 47.50, first: 6 }
]);

/** Real photographs, a chronological loft exhibition and restrained sky cameos.
 * `ready` resolves after every wall thumbnail has loaded (failures are reported,
 * not replaced with fabricated images). The full-resolution DOM album belongs
 * to the caller; targets carry photoId and can be clicked from any distance.
 */
export function createMemoryGallery({ scene, camera, photos = [], textures = {} }) {
  const album = photos.filter(p => p && p.src).slice(0, MEMORY_WALL_SLOTS.length)
    .map((p, index) => ({ ...p, id: p.id ?? `photo-${index + 1}`, aspect: Number(p.aspect) > .05 ? Number(p.aspect) : .75, _sourceOrder: index }))
    .sort((a, b) => (Number.isFinite(+a.order) ? +a.order : a._sourceOrder) - (Number.isFinite(+b.order) ? +b.order : b._sourceOrder));
  const group = new THREE.Group(); group.name = 'Lily · real photographs / chronological loft gallery'; scene.add(group);
  const sky = new THREE.Group(); sky.name = 'Lily · photographs carried by the celebration'; sky.visible = false; scene.add(sky);
  const targets = [], entries = [], errors = [], textureCache = new Map(), pendingUpgrades = [], batched = new Map();
  const labelSize = 2048, labelCanvas = document.createElement('canvas'); labelCanvas.width = labelCanvas.height = labelSize;
  const labelCtx = labelCanvas.getContext('2d');
  const labelTexture = new THREE.CanvasTexture(labelCanvas); labelTexture.colorSpace = THREE.SRGBColorSpace; labelTexture.anisotropy = 8;
  const labelMaterial = new THREE.MeshBasicMaterial({ map: labelTexture, color: 0xffffff, toneMapped: false, side: THREE.DoubleSide, fog: false });
  const labelGeometries = [];
  const plane = new THREE.PlaneGeometry(1, 1), box = new THREE.BoxGeometry(1, 1, 1);
  const mats = {
    wood: new THREE.MeshStandardMaterial({ color: 0x604638, map: textures.darkWood?.map || null, roughness: .59, metalness: .04 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xceac79, roughness: .35, metalness: .62 }),
    ivory: new THREE.MeshBasicMaterial({ color: 0xf1e5d5, toneMapped: false, side: THREE.DoubleSide, fog: false }),
    backing: new THREE.MeshStandardMaterial({ color: 0x3a2a25, roughness: .88 }),
    hit: new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
  };
  let loaded = 0, upgraded = 0, disposed = false, quality = 'high', frozen = false, lastActive = false, visualShowTime = -1, uploadCount = 0;
  const imageLoader = new THREE.ImageLoader();

  function staticMesh(geometry, material, parent, x, y, z, w, h, d = 1) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.scale.set(w, h, d); parent.add(mesh);
    if (!batched.has(material)) batched.set(material, []); batched.get(material).push(mesh); return mesh;
  }
  function addLabel(parent, text, subtitle, w, h, x, y, z, index, chapter = '') {
    // One mipmapped atlas with generous gutters, at least 512 px per caption.
    const tileW = index < 28 ? 512 : index === 28 ? 1536 : 768;
    const tileH = Math.round(tileW * h / w), tx = index < 28 ? index % 4 * 512 : index === 30 ? 1024 : 0, ty = index < 28 ? Math.floor(index / 4) * 192 : index === 28 ? 1460 : 1580;
    labelCtx.fillStyle = '#f1e5d5'; labelCtx.fillRect(tx, ty, tileW, tileH);
    labelCtx.textAlign = 'center'; labelCtx.textBaseline = 'middle'; labelCtx.fillStyle = '#543846';
    if (chapter) { labelCtx.font = `500 ${Math.round(tileH * .135)}px ${FONT}`; labelCtx.fillStyle = '#946f56'; labelCtx.fillText(clip(chapter, 24), tx + tileW / 2, ty + tileH * .13, tileW - 28); }
    labelCtx.font = `600 ${Math.round(tileH * (chapter ? .245 : .35))}px ${FONT}`; labelCtx.fillStyle = '#543846'; labelCtx.fillText(clip(text, 18), tx + tileW / 2, ty + tileH * .39, tileW - 32);
    labelCtx.font = `500 ${Math.round(tileH * .18)}px ${FONT}`; labelCtx.fillStyle = '#775b55';
    const chars = Array.from(String(subtitle || ''));
    labelCtx.fillText(chars.slice(0, 22).join(''), tx + tileW / 2, ty + tileH * .67, tileW - 32);
    if (chars.length > 22) labelCtx.fillText(clip(chars.slice(22).join(''), 22), tx + tileW / 2, ty + tileH * .87, tileW - 32);
    const geometry = plane.clone(); geometry.scale(w, h, 1); const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (tx + 3 + uv.getX(i) * (tileW - 6)) / labelSize, 1 - (ty + 3 + (1 - uv.getY(i)) * (tileH - 6)) / labelSize);
    const mesh = new THREE.Mesh(geometry, labelMaterial); mesh.position.set(x, y, z); parent.add(mesh); parent.updateWorldMatrix(true, false);
    mesh.updateWorldMatrix(true, false); geometry.applyMatrix4(mesh.matrixWorld); labelGeometries.push(geometry); mesh.removeFromParent();
  }
  function photoTexture(photo) {
    const url = photo.thumb || photo.src;
    if (textureCache.has(url)) return textureCache.get(url);
    const texture = new THREE.Texture(); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
    const task = new Promise(resolve => imageLoader.load(url, image => {
      if (!disposed) { texture.image = image; texture.needsUpdate = true; loaded++; uploadCount++; }
      resolve({ ok: true, id: photo.id });
    }, undefined, error => { errors.push({ id: photo.id, stage: 'thumbnail', message: String(error?.message || 'Image could not be decoded') }); resolve({ ok: false, id: photo.id }); }));
    const result = { texture, task, url }; textureCache.set(url, result); return result;
  }

  album.forEach((photo, index) => {
    const slot = MEMORY_WALL_SLOTS[index], frame = new THREE.Group(); frame.name = `${String(index + 1).padStart(2, '0')} · ${photo.title || '我们的日常'}`;
    frame.position.set(slot.x, slot.y, slot.z); frame.rotation.y = slot.rotation; group.add(frame);
    // The opening uses the original aspect. Nothing is crop-filled or stretched.
    const innerW = Math.min(.565, .655 * photo.aspect), innerH = innerW / photo.aspect;
    const w = innerW + .085, photoH = innerH + .085, captionH = .155, h = photoH + captionH;
    const photoY = captionH / 2, rail = .021;
    const frameMaterial = index % 3 === 0 ? mats.wood : mats.brass;
    staticMesh(box, mats.backing, frame, 0, 0, -.022, w + .025, h + .025, .036);
    staticMesh(plane, mats.ivory, frame, 0, 0, .001, w, h);
    for (const side of [-1, 1]) {
      staticMesh(box, frameMaterial, frame, side * (w / 2 + rail / 2), 0, .013, rail, h + rail * 2, .024);
      staticMesh(box, frameMaterial, frame, 0, side * (h / 2 + rail / 2), .013, w, rail, .024);
    }
    const { texture, task } = photoTexture(photo);
    const material = new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff, toneMapped: false, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(plane, material); mesh.scale.set(innerW, innerH, 1); mesh.position.set(0, photoY, .006); mesh.name = `Complete photograph · ${photo.id}`; frame.add(mesh);
    // A wall caption is a short exhibition label; the complete original caption
    // remains available in getAlbum() / the caller's accessible DOM viewer.
    const caption = photo.caption || photo.period || '';
    const title = `${String(index + 1).padStart(2, '0')}  ${photo.title || '这一刻，留在相册里'}`;
    addLabel(frame, title, caption, Math.min(.69, Math.max(w, .56)), captionH, 0, -h / 2 + captionH / 2 + .012, .007, index, [photo.chapterTitle, photo.period].filter(Boolean).join(' · '));
    const hit = new THREE.Mesh(plane, mats.hit); hit.scale.set(Math.max(w, .61), h + .025, 1); hit.position.z = .032; hit.name = `Open full photograph ${photo.id}`; frame.add(hit);
    frame.updateWorldMatrix(true, true); const position = new THREE.Vector3(); hit.getWorldPosition(position);
    const target = { id: `album-${photo.id}`, photoId: photo.id, title: photo.title || '打开这一页回忆', caption: photo.caption || '', kind: 'album', object: hit, position, group: frame, action: '看看这张照片', floor: 3.45 };
    targets.push(target); entries.push({ photo, slot, frame, mesh, texture, task, width: w, height: h, imageWidth: innerW, imageHeight: innerH });
  });

  const headings = [
    { text: '把普通的日子，慢慢收藏', subtitle: 'OUR LITTLE CHRONICLE', w: 4.95, x: -1.15, y: 6.61, z: -3.18, rotation: 0 },
    { text: album[16]?.chapterTitle || '镜头里的你', subtitle: '每个寻常的日子，都被好好记着', w: 2.02, x: -4.39, y: 6.61, z: 2.03, rotation: Math.PI / 2 },
    { text: album[22]?.chapterTitle || '那些舍不得删的照片', subtitle: '照片会替我们记住', w: 2.02, x: 4.39, y: 6.61, z: 2.03, rotation: -Math.PI / 2 }
  ];
  headings.forEach((heading, i) => {
    const holder = new THREE.Group(); holder.position.set(heading.x, heading.y, heading.z); holder.rotation.y = heading.rotation; group.add(holder);
    staticMesh(box, mats.wood, holder, 0, 0, -.016, heading.w + .05, .255, .026);
    addLabel(holder, heading.text, heading.subtitle, heading.w, .22, 0, 0, .001, 28 + i);
  });
  // The atlas uses 31 of 36 available tiles. No texture drawing occurs in update.
  labelTexture.needsUpdate = true;
  group.updateMatrixWorld(true);
  let staticBatches = 0;
  for (const [material, meshes] of batched) {
    const geometries = meshes.map(mesh => { mesh.updateWorldMatrix(true, false); const g = mesh.geometry.clone(); g.applyMatrix4(mesh.matrixWorld); mesh.removeFromParent(); return g; });
    if (!geometries.length) continue;
    const merged = mergeGeometries(geometries), mesh = new THREE.Mesh(merged, material); mesh.name = 'Gallery · shared physical frame surfaces'; mesh.castShadow = false; mesh.receiveShadow = material.isMeshStandardMaterial;
    group.add(mesh); geometries.forEach(g => g.dispose()); staticBatches++;
  }
  if (labelGeometries.length) { group.add(new THREE.Mesh(mergeGeometries(labelGeometries), labelMaterial)); labelGeometries.forEach(g => g.dispose()); }

  const chosen = entries.filter(e => e.photo.sky).slice(0, 8);
  const skyEntries = chosen.length ? chosen : entries.filter((_, i) => i % Math.max(1, Math.ceil(entries.length / 8)) === 0).slice(0, 8);
  const skySlots = Array.from({ length: 2 }, (_, index) => {
    const card = new THREE.Group(); card.name = `Sky keepsake ${index + 1}`; card.visible = false; sky.add(card);
    const backing = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: 0xf2e4d1, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: false })); card.add(backing);
    const photo = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: false })); photo.position.z = .018; card.add(photo);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)), new THREE.LineBasicMaterial({ color: 0xd7b78b, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false })); outline.position.z = .035; card.add(outline);
    // Warm fine-line edge and an ivory photographic mount, rather than a light
    // source: no emissive or additive pass can bleach the real photograph.
    return { card, backing, photo, outline, index: -1, opacity: 0, ndcBounds: null };
  });
  const local = new THREE.Vector3(), origin = new THREE.Vector3();
  let activeCameos = 0;
  function hideSky() { sky.visible = false; activeCameos = 0; for (const slot of skySlots) { slot.card.visible = false; slot.opacity = 0; } }
  function updateSky(t) {
    const cue = SKY_CUES.find(c => t >= c.start && t < c.end);
    if (!cue || !skyEntries.length) { hideSky(); return; }
    sky.visible = true; activeCameos = 0;
    camera.updateWorldMatrix(true, false); camera.getWorldPosition(origin);
    const depth = 61, halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov || 62) / 2) * depth, halfW = halfH * Math.max(.3, camera.aspect || 1);
    skySlots.forEach((slot, i) => {
      // A final single unpaired image is allowed; never repeat the same photo
      // on the left and right of the same cue.
      const selection = cue.first + i;
      if (selection >= skyEntries.length) { slot.card.visible = false; slot.opacity = 0; return; }
      const entry = skyEntries[selection];
      if (slot.index !== selection) { slot.photo.material.map = entry.texture; slot.photo.material.needsUpdate = true; slot.index = selection; }
      const phase = t - cue.start, duration = cue.end - cue.start;
      const alpha = ease(phase / 1.4) * ease((duration - phase) / 1.7) * .97;
      const aspect = entry.photo.aspect, w = Math.min(.345 * halfW, .46 * halfH * aspect), h = w / aspect;
      const mat = Math.min(w, h) * .045;
      const mountW = w + mat * 2, mountH = h + mat * 2;
      const side = i === 0 ? -1 : 1, x = side * (.79 * halfW), y = (.20 + Math.sin(phase * .27 + i * 1.7) * .019) * halfH;
      local.set(x, y, -depth).applyQuaternion(camera.quaternion).add(origin); slot.card.position.copy(local); slot.card.quaternion.copy(camera.quaternion);
      slot.card.rotateZ(side * (.019 + Math.sin(phase * .20) * .008));
      slot.backing.scale.set(mountW, mountH, 1); slot.photo.scale.set(w, h, 1); slot.outline.scale.set(mountW, mountH, 1);
      slot.backing.material.opacity = alpha * .94; slot.photo.material.opacity = alpha; slot.outline.material.opacity = alpha * .80;
      slot.card.visible = alpha > .002; slot.opacity = alpha;
      slot.ndcBounds = { minX: x / halfW - mountW / (2 * halfW), maxX: x / halfW + mountW / (2 * halfW), minY: y / halfH - mountH / (2 * halfH), maxY: y / halfH + mountH / (2 * halfH) };
      if (slot.card.visible) activeCameos++;
    });
  }

  const ready = Promise.all(entries.map(e => e.task)).then(results => {
    // Decode selected high-resolution originals progressively, retaining one
    // THREE.Texture per photograph. GPU promotion waits for an active frame.
    for (const entry of skyEntries) {
      if (!entry.photo.thumb || entry.photo.src === entry.photo.thumb) continue;
      imageLoader.load(entry.photo.src, image => { if (!disposed) pendingUpgrades.push({ entry, image }); }, undefined, error => errors.push({ id: entry.photo.id, stage: 'sky', message: String(error?.message || 'Image could not be decoded') }));
    }
    return { total: album.length, loaded, failed: results.filter(r => !r.ok).length, errors: errors.slice() };
  });

  function update(dt, time, state = {}) {
    if (disposed) return;
    frozen = !!(state.paused || state.reading || (typeof document !== 'undefined' && document.hidden));
    if (!state.showActive) { lastActive = false; visualShowTime = -1; hideSky(); }
    if (frozen) return;
    while (pendingUpgrades.length) { const { entry, image } = pendingUpgrades.shift(); entry.texture.image = image; entry.texture.needsUpdate = true; upgraded++; uploadCount++; }
    if (!state.showActive) return;
    const next = Number.isFinite(+state.showTime) ? Math.max(0, +state.showTime) : lastActive ? visualShowTime + Math.max(0, Math.min(+dt || 0, .1)) : 0;
    lastActive = true; visualShowTime = next; updateSky(next);
  }
  function setQuality(q) {
    quality = q;
    const anisotropy = q === 'low' || q === 'mobile' || q === 0 ? 2 : q === 'medium' || q === 1 ? 4 : 8;
    for (const { texture } of textureCache.values()) texture.anisotropy = anisotropy;
    labelTexture.anisotropy = anisotropy;
  }
  function stats() {
    return { totalPhotos: album.length, wallPhotographs: entries.length, wallTargets: targets.length, photoTextures: textureCache.size, thumbnailsLoaded: loaded, fullResolutionSkyUpgrades: upgraded, pendingUpgrades: pendingUpgrades.length, textureUploads: uploadCount, labelAtlases: 1, frameBatches: staticBatches, estimatedWallDrawCalls: entries.length + staticBatches + (labelGeometries.length ? 1 : 0), skySelections: skyEntries.map(e => e.photo.id), activeSkyPhotos: activeCameos, maxSimultaneousSkyPhotos: 2, showTime: visualShowTime, paused: frozen, quality, errors: errors.slice(), skyCards: skySlots.filter(s => s.card.visible).map(s => ({ photoId: skyEntries[s.index]?.photo.id, opacity: s.opacity, position: s.card.position.toArray(), ndcBounds: s.ndcBounds })) };
  }
  function dispose() {
    disposed = true; group.removeFromParent(); sky.removeFromParent();
    const geometries = new Set(), materials = new Set();
    for (const root of [group, sky]) root.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    for (const { texture } of textureCache.values()) texture.dispose(); labelTexture.dispose();
    pendingUpgrades.length = 0;
  }
  return {
    group, sky, ready, targets, update, setQuality, stats, dispose,
    getAlbum: () => album.map(({ _sourceOrder, ...photo }) => ({ ...photo })),
    getOverviewPose: () => ({ position: [1.20, 3.45, .12], yaw: .46, pitch: .16 }),
    // Useful for deterministic CPU layout audits without coupling the viewer
    // to frame geometry internals.
    getPlacements: () => entries.map(e => ({ photoId: e.photo.id, ...e.slot, width: e.width, height: e.height, imageWidth: e.imageWidth, imageHeight: e.imageHeight, aspect: e.photo.aspect }))
  };
}
