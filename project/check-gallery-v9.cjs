// Deterministic CPU / geometry audit. This does not claim a GPU visual review.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const deps = fs.existsSync(path.join(__dirname, 'node_modules/esbuild')) ? path.join(__dirname, 'node_modules') : 'C:/页面/winter-cabin-build/node_modules';
const { createCanvas, loadImage } = require('C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const document = { hidden: false, createElement(type) { assert.equal(type, 'canvas'); return createCanvas(1, 1); } };
(async () => {
  const result = await require(path.join(deps, 'esbuild')).build({ stdin: { contents: "import * as THREE from 'three'; export {THREE}; export {createMemoryGallery,MEMORY_WALL_SLOTS} from './src/memory-gallery-v9.js';", resolveDir: __dirname }, bundle: true, platform: 'node', format: 'cjs', write: false, nodePaths: [deps] });
  const module = { exports: {} }, context = { module, exports: module.exports, require, document, console, setTimeout, clearTimeout };
  vm.runInNewContext(result.outputFiles[0].text, context, { timeout: 10000 });
  const { THREE, createMemoryGallery, MEMORY_WALL_SLOTS } = module.exports;
  let imageDecodes = 0;
  THREE.ImageLoader.prototype.load = function (url, onLoad) { imageDecodes++; const image = createCanvas(url.includes('thumb') ? 480 : 1200, 900); queueMicrotask(() => onLoad(image)); return image; };
  const photos = Array.from({ length: 28 }, (_, i) => ({ id: `photo-${String(i + 1).padStart(2, '0')}`, thumb: `thumb-${i}`, src: `original-${i}`, aspect: [4 / 3, 3 / 4, 1, 2.64][i % 4], title: `第${i + 1}张照片`, caption: '这一天的故事，被好好地留在了相册里。这是完整的真实回忆。', chapter: `chapter-${Math.floor(i / 4)}`, chapterTitle: `第${Math.floor(i / 4) + 1}章`, period: '白马校区', order: i, sky: i < 8 }));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(62, 16 / 9, .08, 240); camera.position.set(0, 1.75, 26); camera.rotation.x = .48;
  const gallery = createMemoryGallery({ scene, camera, photos });
  const loaded = await gallery.ready;
  await Promise.resolve();
  assert.equal(loaded.loaded, 28); assert.equal(gallery.targets.length, 28); assert.equal(MEMORY_WALL_SLOTS.length, 28);
  assert.equal(gallery.stats().photoTextures, 28); assert.equal(gallery.getAlbum().length, 28); assert.equal(imageDecodes, 36);
  const placements = gallery.getPlacements();
  for (const p of placements) {
    assert.ok(Math.abs(p.imageWidth / p.imageHeight - p.aspect) < 1e-12, `${p.photoId}: image aspect changed`);
    assert.ok(p.y - p.height / 2 > 3.95 && p.y + p.height / 2 < 6.5, `${p.photoId}: floor / ceiling overlap`);
    assert.ok(p.width <= .651 && p.height <= .90, `${p.photoId}: wall cell overflow`);
    if (p.wall === 'back') {
      assert.ok(p.x + p.width / 2 < 2.10 && p.x - p.width / 2 > -4.47, `${p.photoId}: wardrobe / corner overlap`);
      assert.ok(p.z > -3.25, `${p.photoId}: mounted inside solid wall`);
    } else {
      assert.ok(p.z - p.width / 2 > .82 && p.z + p.width / 2 < 3.24, `${p.photoId}: side window / corner overlap`);
      assert.ok(Math.abs(p.x) < 4.47, `${p.photoId}: mounted inside side wall`);
    }
  }
  for (const target of gallery.targets) {
    assert.equal(target.kind, 'album'); assert.ok(target.photoId); assert.ok(target.position.toArray().every(Number.isFinite));
    // Invisible raycast carriers must remain clickable without drawing.
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(target.group.quaternion);
    const ray = new THREE.Raycaster(target.position.clone().addScaledVector(normal, 2), normal.clone().negate());
    scene.updateMatrixWorld(true); assert.ok(ray.intersectObject(target.object).length > 0, `${target.photoId}: unavailable click carrier`);
  }
  assert.equal(gallery.stats().estimatedWallDrawCalls, 33);
  gallery.update(1 / 60, 0, { showActive: false }); assert.equal(gallery.stats().activeSkyPhotos, 0);
  gallery.update(1 / 60, 1, { showActive: true, showTime: 8 }); assert.equal(gallery.stats().activeSkyPhotos, 0);
  let maxSky = 0;
  for (const aspect of [16 / 9, 9 / 16, 3.2, .44]) {
    camera.aspect = aspect; camera.updateProjectionMatrix();
    for (const time of [12.8, 18, 22, 26, 31, 36, 41, 46]) {
      gallery.update(.016, time, { showActive: true, showTime: time, phase: time > 49 ? 'wish' : 'fireworks' });
      const state = gallery.stats(); maxSky = Math.max(maxSky, state.activeSkyPhotos); assert.ok(state.activeSkyPhotos <= 2);
      for (const card of state.skyCards) {
        const b = card.ndcBounds; assert.ok(b.minX > -1 && b.maxX < 1 && b.minY > -1 && b.maxY < 1, 'Sky photo outside frustum');
        assert.ok(b.maxX < -.58 || b.minX > .58, 'Sky photo enters central birthday lettering');
        assert.ok(card.position.every(Number.isFinite));
      }
    }
  }
  assert.equal(maxSky, 2); assert.equal(gallery.stats().fullResolutionSkyUpgrades, 8);
  gallery.update(.016, 49, { showActive: true, showTime: 49, phase: 'wish' }); assert.equal(gallery.stats().activeSkyPhotos, 0, 'Meteor wish phase remains free of photographs');
  gallery.update(.016, 14, { showActive: true, showTime: 14 });
  const frozen = JSON.stringify(gallery.stats().skyCards), uploads = gallery.stats().textureUploads;
  gallery.update(2, 16, { showActive: true, showTime: 16, paused: true }); assert.equal(JSON.stringify(gallery.stats().skyCards), frozen);
  gallery.update(2, 18, { showActive: true, showTime: 18, reading: true }); assert.equal(JSON.stringify(gallery.stats().skyCards), frozen);
  document.hidden = true; gallery.update(2, 21, { showActive: true, showTime: 21 }); assert.equal(JSON.stringify(gallery.stats().skyCards), frozen); assert.equal(gallery.stats().textureUploads, uploads); document.hidden = false;
  gallery.update(.016, 60, { showActive: true, showTime: 60 }); assert.equal(gallery.stats().activeSkyPhotos, 0);
  gallery.update(.016, 0, { showActive: false, paused: true }); assert.equal(gallery.stats().activeSkyPhotos, 0);
  gallery.update(.016, 0, { showActive: true, showTime: 0 }); assert.equal(gallery.stats().activeSkyPhotos, 0, 'Replay opens without floating photos');
  gallery.setQuality('low'); assert.equal(gallery.stats().quality, 'low');
  const metadata = gallery.getAlbum(); assert.equal(metadata[0].caption, photos[0].caption, 'Full original caption lost');
  assert.ok(gallery.getOverviewPose().position.every(Number.isFinite));
  const statistics = gallery.stats(); gallery.dispose(); assert.equal(scene.children.length, 0);
  const manifestPath = path.join(__dirname, 'album-manifest.json');
  let realManifest = null;
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const realPhotos = await Promise.all(manifest.photos.map(async (photo, order) => {
      const chapter = manifest.chapters.find(c => c.id === photo.chapter);
      const bytes = fs.readFileSync(path.join(__dirname, '..', 'assets', 'album', photo.id.replace('photo-', 'thumb-') + '.jpg'));
      const image = await loadImage(bytes), url = 'data:image/jpeg;base64,' + bytes.toString('base64');
      return { ...photo, order, chapterTitle: chapter?.title, period: photo.period || chapter?.period, aspect: image.width / image.height, src: url, thumb: url };
    }));
    THREE.ImageLoader.prototype.load = function (url, onLoad, onProgress, onError) { loadImage(Buffer.from(url.split(',')[1], 'base64')).then(onLoad, onError); return null; };
    const actual = createMemoryGallery({ scene, camera, photos: realPhotos }); await actual.ready;
    assert.equal(actual.stats().thumbnailsLoaded, 28); assert.equal(actual.stats().skySelections.length, 8);
    assert.equal(actual.getAlbum()[0].id, 'photo-01'); assert.equal(actual.getAlbum().find(p => p.title === '试戴我的眼镜').id, 'photo-14');
    assert.equal(new Set(actual.getAlbum().map(p => p.chapter)).size, 7);
    for (const p of actual.getPlacements()) assert.ok(Math.abs(p.imageWidth / p.imageHeight - p.aspect) < 1e-12);
    for (const t of [13, 22, 32, 42]) { actual.update(.016, t, { showActive: true, showTime: t }); assert.equal(actual.stats().activeSkyPhotos, 2); }
    actual.update(.016, 49, { showActive: true, showTime: 49, phase: 'wish' }); assert.equal(actual.stats().activeSkyPhotos, 0);
    realManifest = { decodedThumbnails: actual.stats().thumbnailsLoaded, chapters: 7, skySelections: actual.stats().skySelections, first: actual.getAlbum()[0].id, glassesPhoto: 'photo-14', estimatedWallDrawCalls: actual.stats().estimatedWallDrawCalls };
    actual.dispose();
  }
  console.log(JSON.stringify({ kind: 'CPU geometry / timing audit only; GPU visuals require browser review', checks: ['28 real wall targets', 'aspect preserved / no crop', 'window / wardrobe / ceiling clearance', 'single photo texture per photograph', '33 wall draws', 'desktop / portrait central lettering clear', '2 simultaneous sky photos', 'pause / reading / hidden freeze', 'replay clears sky', 'full original metadata retained', 'actual manifest / thumbnail decode'], statistics, realManifest }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
