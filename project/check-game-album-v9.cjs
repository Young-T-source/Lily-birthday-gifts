// Integration audit of the unmodified game coordinator. Real navigation,
// photograph gallery, treasure, loft, interior objects and visible world are
// bundled. Only GPU effects, DOM reader and asynchronous GLTF decoding are
// replaced; their cross-module contracts are exercised, not reimplemented.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const deps = fs.existsSync(path.join(__dirname, 'node_modules/esbuild')) ? path.join(__dirname, 'node_modules') : 'C:/页面/winter-cabin-build/node_modules';
const canvasLib = require('C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const callbacks = {}, audit = { events: [], worldHasAlbum: null, effects: null, photos: [], callbacks };
const classSet = new Set();
const classList = { add: (...keys) => keys.forEach(k => classSet.add(k)), remove: (...keys) => keys.forEach(k => classSet.delete(k)), contains: k => classSet.has(k), toggle(k, force) { const next = force === undefined ? !classSet.has(k) : force; if (next) classSet.add(k); else classSet.delete(k); return next; } };
const document = { hidden: false, body: { classList }, querySelector: () => null, createElement(type) { if (type === 'canvas') return canvasLib.createCanvas(1, 1); throw new Error('Unexpected DOM element ' + type); } };
function surface() {
  const listeners = new Map();
  return { style: {}, addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); }, hasPointerCapture: () => false, setPointerCapture() {}, releasePointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }), dispatch(type, init = {}) { const event = { clientX: 640, clientY: 400, pointerId: 1, pointerType: 'mouse', button: 0, target: null, preventDefault() {}, stopImmediatePropagation() { this.stopped = true; }, ...init }; for (const fn of listeners.get(type) || []) { fn(event); if (event.stopped) break; } return event; } };
}
const window = surface();
const uiMock = `export function mountBirthdayUI(cb){
  Object.assign(globalThis.__audit.callbacks,cb);let opened=false,unlocked=false;
  const emit=(kind,value)=>globalThis.__audit.events.push({kind,value});
  const show=(kind,value)=>{opened=true;emit(kind,value);cb.onOpen?.();return true;};
  return {begin(){cb.onBegin?.();},close(){if(opened){opened=false;cb.onClose?.();}},
  openStory(id){return show('story',id)},openBirthdayNote(){return show('birthdayNote')},openAlbum(id){return show('album',id)},
  unlockSecretLetter(){unlocked=true;emit('unlock')},openLetter(){if(!unlocked)return false;return show('deepLetter')},
  setNearTarget(t){globalThis.__audit.near=t?.id||null},setReady(){},setMusicAvailable(){},setAudioState(){},setMusicPlaying(){},setProgress(){},setTouching(){},setEnding(){},setShowPaused(){},setShowState(){},setWishPhase(){},setWishRemaining(){},setWorldCaption(){} };
}`;
const effectsMock = `export function createBirthdayEffects(){let active=false,time=0,paused=false;
  const fx={onBurst(){},setPaused(v){paused=!!v},cancelTouch(){},playTouch(){return 4.2},touchContactTime:1.72,
  startFireworks(){active=true;time=0;paused=false},skip(){active=false},
  update(dt){if(active&&!paused){time+=dt;if(time>93)active=false}},
  getStats(){return {fireworksActive:active,fireworksTime:time,celebrationPhase:active?(time<49?'fireworks':'wish'):'idle',wishDuration:44,wishRemaining:active?Math.max(0,93-time):0,paused}},
  force(t,a=true){time=t;active=a},get paused(){return paused}};globalThis.__audit.effects=fx;return fx;
}`;
(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'album-manifest.json'), 'utf8'));
  audit.photos = await Promise.all(manifest.photos.map(async (photo, order) => {
    const image = await canvasLib.loadImage(fs.readFileSync(path.join(__dirname, '..', 'assets', 'album', photo.id.replace('photo-', 'thumb-') + '.jpg')));
    const chapter = manifest.chapters.find(c => c.id === photo.chapter);
    return { ...photo, order, chapterTitle: chapter.title, period: photo.period || chapter.period, aspect: image.width / image.height, src: 'audit-src-' + photo.id, thumb: 'audit-thumb-' + photo.id };
  }));
  const built = await require(path.join(deps, 'esbuild')).build({ stdin: { contents: "import * as THREE from 'three';export {THREE};export {setupBirthdayGame} from './src/birthday-game.js';export {createWalkController} from './src/walk.js';export {terrainHeight} from './src/environment.js';", resolveDir: __dirname }, bundle: true, platform: 'node', format: 'cjs', write: false, nodePaths: [deps], plugins: [{ name: 'test-only-browser-adapters', setup(build) {
    build.onLoad({ filter: /birthday-ui\.js$/ }, () => ({ contents: uiMock, loader: 'js' }));
    build.onLoad({ filter: /birthday-effects\.js$/ }, () => ({ contents: effectsMock, loader: 'js' }));
    build.onLoad({ filter: /local-media\.js$/ }, () => ({ contents: 'export const MEDIA={albumPhotos:globalThis.__audit.photos,photos:[],music:null};', loader: 'js' }));
    build.onLoad({ filter: /birthday-world\.js$/ }, args => {
      let text = fs.readFileSync(args.path, 'utf8');
      const start = text.indexOf('  const ready=(async()=>{'), end = text.indexOf('  ready.catch(', start);
      assert.ok(start > 0 && end > start, 'Locate only the independent GLTF decode promise');
      text = text.slice(0, start) + '  const ready=Promise.resolve({auditSkippedGlb:true});\n' + text.slice(end);
      text = text.replace('hasAlbum=false}) {', 'hasAlbum=false}) { globalThis.__audit.worldHasAlbum=hasAlbum;');
      return { contents: text, loader: 'js', resolveDir: path.dirname(args.path) };
    });
  } }] });
  let now = 0;
  const module = { exports: {} }, context = { console, module, exports: module.exports, require, document, window, innerWidth: 1280, innerHeight: 800, location: { search: '' }, URLSearchParams, performance: { now: () => now }, setTimeout, clearTimeout, atob, btoa, __audit: audit };
  vm.runInNewContext(built.outputFiles[0].text, context, { timeout: 30000 });
  const { THREE, setupBirthdayGame, createWalkController } = module.exports;
  // Browser image transport is orthogonal to this integration test; the real
  // thumbnail decode / aspect checks live in check-gallery-v9.cjs.
  THREE.ImageLoader.prototype.load = function (url, onLoad) { const image = canvasLib.createCanvas(4, 4); queueMicrotask(() => onLoad(image)); return image; };
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(62, 1.6, .08, 240), canvas = surface();
  let door = 1;
  const cabin = { doorMeshes: [], getDoorAmount: () => door, setDoor(value) { door = value ? 1 : 0; }, doorState: { target: 1 } };
  const controls = { target: new THREE.Vector3(), enabled: true, update() {} };
  const walk = createWalkController({ camera, canvas, orbitControls: controls, cabin });
  const texture = new THREE.Texture(canvasLib.createCanvas(2, 2));
  const textures = Object.fromEntries(['floor', 'darkWood', 'log', 'knitCream', 'rug', 'snow'].map(key => [key, { map: texture, normalMap: texture }])); textures.glowSoft = texture;
  const sound = { enabled: false, setEnabled(value) { this.enabled = value; return Promise.resolve(); }, setReading() {}, firework() {}, touch() {}, step() {} };
  const game = setupBirthdayGame({ scene, camera, renderer: { domElement: canvas }, textures, walk, controls, cabin, sound, toast() {} });
  await game.gallery.ready; await Promise.resolve(); await game.world.ready;
  const eventCount = kind => audit.events.filter(e => e.kind === kind).length;
  function tick(seconds, dt = .01) { const count = Math.ceil(seconds / dt); for (let i = 0; i < count; i++) { now += dt * 1000; game.update(dt, now / 1000); } }
  function look(point) { camera.lookAt(point); camera.updateMatrixWorld(true); scene.updateMatrixWorld(true); }
  function click(point) { look(point); canvas.dispatch('pointerdown'); now += 30; canvas.dispatch('pointerup'); }

  game.enter(); assert.equal(game.stats().begun, true); assert.equal(audit.worldHasAlbum, true);
  assert.equal(game.stats().photos, 28);
  for (let i = 1; i <= 3; i++) assert.equal(scene.getObjectByName('Lily indoor photograph ' + i), undefined, 'Legacy watercolor frame conflicts with album wall');
  assert.equal(scene.getObjectByName('A little photograph by the fire'), undefined);
  assert.equal(game.world.setPhoto(0, texture), false, 'Removed legacy frames must reject accidental editor writes');
  callbacks.onNavigate('letter'); assert.equal(eventCount('story'), 1); assert.equal(audit.events.at(-1).value, 'letter'); assert.equal(eventCount('deepLetter'), 0); assert.equal(eventCount('unlock'), 0); assert.equal(game.isReading, true); game.ui.close();
  callbacks.onBirthdayNote(); assert.equal(eventCount('birthdayNote'), 1); assert.equal(game.isReading, true); assert.equal(eventCount('deepLetter'), 0); game.ui.close();
  callbacks.onNavigate('secret-letter'); assert.equal(eventCount('unlock'), 0); assert.equal(eventCount('deepLetter'), 0, 'No public map shortcut to hidden letter');

  // The new overview is tested against real loft / wardrobe / furniture boxes.
  callbacks.onVisitAlbum(); const pose = game.gallery.getOverviewPose();
  assert.equal(walk.getState().inside, true); assert.equal(walk.getState().floor, 2); assert.equal(walk.probe(pose.position[0], pose.position[2], 3.45).blockedBy, null);
  assert.ok(Math.abs(camera.position.y - (3.45 + 1.64)) < .001);
  const albumTarget = game.gallery.targets[0], albumsBefore = eventCount('album');
  click(albumTarget.position); assert.equal(eventCount('album'), albumsBefore + 1); assert.equal(audit.events.at(-1).value, albumTarget.photoId); assert.equal(game.isReading, true); assert.equal(audit.effects.paused, true);
  click(game.gallery.targets[1].position); assert.equal(eventCount('album'), albumsBefore + 1, 'A click through the reader cannot activate another frame'); game.ui.close();
  assert.equal(walk.setPose([0, 0, 17], 0, .1), true); click(albumTarget.position); assert.equal(eventCount('album'), albumsBefore + 1, 'Outside clicks cannot open indoor wall photos');

  // A secret must be physically discovered; neither an indoor action, a remote
  // action, nor a blocked line of touch can start the reveal gesture.
  callbacks.onVisitAlbum(); callbacks.onInteract('secret-letter'); assert.equal(game.stats().touching, null); assert.equal(game.treasure.unlocked, false);
  assert.equal(walk.setPose([0, 0, 17], 0, .1), true); callbacks.onInteract('secret-letter'); assert.equal(game.stats().touching, null);
  assert.equal(walk.setPose(game.treasure.viewPose, 0, 0), true); assert.equal(walk.getState().inside, false); assert.equal(walk.canReach(game.treasure.target.position, 1.8), true);
  const actualReach = walk.canReach; walk.canReach = () => false; callbacks.onInteract('secret-letter'); assert.equal(game.stats().touching, null); walk.canReach = actualReach;
  callbacks.onInteract('secret-letter'); assert.equal(game.stats().touching, 'secret-letter'); tick(1.70); assert.equal(game.treasure.unlocked, false); assert.equal(eventCount('unlock'), 0);
  tick(.05); assert.equal(game.treasure.unlocked, true); assert.equal(eventCount('deepLetter'), 0, 'Contact opens the chest before revealing the letter');
  tick(.90); assert.equal(eventCount('deepLetter'), 0, 'Hold the natural reveal delay after contact'); tick(.05); assert.equal(eventCount('unlock'), 1); assert.equal(eventCount('deepLetter'), 1); assert.equal(game.isReading, true); assert.equal(game.stats().touching, null); game.ui.close();

  callbacks.onFireworks(); audit.effects.force(13); game.update(0, now / 1000);
  assert.equal(game.gallery.stats().activeSkyPhotos, 2);
  callbacks.onAlbum(); const readingSky = JSON.stringify(game.gallery.stats().skyCards), readingTime = audit.effects.getStats().fireworksTime; tick(.25);
  assert.equal(game.isReading, true); assert.equal(audit.effects.getStats().fireworksTime, readingTime); assert.equal(JSON.stringify(game.gallery.stats().skyCards), readingSky); assert.equal(game.gallery.stats().paused, true);
  game.ui.close(); assert.equal(audit.effects.paused, false); tick(.05);
  callbacks.onPauseShow(); const pausedSky = JSON.stringify(game.gallery.stats().skyCards), pausedTime = audit.effects.getStats().fireworksTime; tick(.25);
  assert.equal(audit.effects.getStats().fireworksTime, pausedTime); assert.equal(JSON.stringify(game.gallery.stats().skyCards), pausedSky); assert.equal(game.gallery.stats().paused, true);
  callbacks.onAlbum(); game.ui.close(); assert.equal(audit.effects.paused, true, 'Closing a reader preserves manual show pause'); callbacks.onPauseShow(); assert.equal(audit.effects.paused, false);
  document.hidden = true; const hiddenSky = JSON.stringify(game.gallery.stats().skyCards); tick(.25); assert.equal(JSON.stringify(game.gallery.stats().skyCards), hiddenSky); document.hidden = false;
  audit.effects.force(49); game.update(0, now / 1000); assert.equal(game.gallery.stats().activeSkyPhotos, 0, 'Meteor wish phase has no floating photos');
  audit.effects.force(0, false); game.update(0, now / 1000); assert.equal(game.gallery.stats().activeSkyPhotos, 0); callbacks.onFireworks(); game.update(0, now / 1000); assert.equal(game.gallery.stats().activeSkyPhotos, 0, 'Replay leaves the initial salvo clear');
  console.log(JSON.stringify({ success: true, kind: 'Actual coordinator / world targets / navigation / gallery / treasure integration; DOM reader and GPU effects are contract stubs', checks: ['hasAlbum removes all old photograph placeholders', 'public letter map is only a story clue', 'birthday note stays public', 'real loft overview walk position is valid', 'canvas raycast opens correct inside photo and pauses reader', 'outside and click-through-reader rejected', 'treasure requires outside / reachable / contact + .95 seconds', 'reader / manual / background pause freezes gallery', 'manual pause survives reader closing', 'wish phase and replay clear sky photos'], events: audit.events, overviewPose: pose, gallery: game.gallery.stats(), treasure: game.treasure.stats() }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
