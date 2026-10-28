const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const project = __dirname, deps = fs.existsSync(path.join(project, 'node_modules/esbuild')) ? path.join(project, 'node_modules') : 'C:/页面/winter-cabin-build/node_modules';
const canvas = require('C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const document = { createElement(type) { assert.equal(type, 'canvas'); return canvas.createCanvas(1, 1); } };
const context = { console, document, window: { devicePixelRatio: 1, addEventListener() {} }, performance, setTimeout, clearTimeout };
(async () => {
  const built = await require(path.join(deps, 'esbuild')).build({ stdin: { contents: `import * as THREE from 'three';import {createTreasureTree} from './src/treasure-tree-v9.js';import {createForest,terrainHeight} from './src/environment.js';import {createWalkController} from './src/walk.js';import {LETTER,SECRET_LETTER,BIRTHDAY_NOTE,STORIES} from './src/story-data.js';export {THREE,createTreasureTree,createForest,terrainHeight,createWalkController,LETTER,SECRET_LETTER,BIRTHDAY_NOTE,STORIES};`, resolveDir: project }, bundle: true, format: 'cjs', platform: 'node', write: false, nodePaths: [deps] });
  const module = { exports: {} }; Object.assign(context, { module, exports: module.exports }); vm.runInNewContext(built.outputFiles[0].text, context, { timeout: 30000 });
  const { THREE, createTreasureTree, createForest, terrainHeight, createWalkController, LETTER, SECRET_LETTER, BIRTHDAY_NOTE, STORIES } = module.exports;
  assert.equal(LETTER, SECRET_LETTER, 'Full original deep letter remains available as the hidden letter');
  assert.equal(LETTER.paragraphs.length, 24);
  assert(LETTER.paragraphs.some(p => p.includes('所以，梦琪，我爱你')));
  assert(!/我爱你|我们认真地在一起|从来没有喜欢过/.test(JSON.stringify(STORIES)), 'Public memory chapters should not reveal the deep confession');
  assert(!/我爱你|我们认真地在一起/.test(JSON.stringify(BIRTHDAY_NOTE)));
  assert(BIRTHDAY_NOTE.paragraphs.some(p => p.includes('你要爱久')));
  assert.equal(STORIES.at(-1).id, 'letter'); assert(STORIES.at(-1).title.includes('树下'));
  const scene = new THREE.Scene(), texture = new THREE.Texture();
  const textures = { darkWood: { map: texture, normalMap: texture }, snow: { map: texture, normalMap: texture }, glowSoft: texture };
  const forest = createForest(scene, textures), tree = createTreasureTree({ scene, textures, terrainHeight });
  assert.equal(tree.target.id, 'secret-letter'); assert.equal(tree.target.kind, 'treasure'); assert(tree.target.outsideOnly);
  assert.equal(tree.target.title, '属于你的那棵树'); assert.equal(tree.target.object.name.includes('chest'), true);
  assert.equal(tree.unlocked, false); assert.equal(tree.stats().opening, 0);
  const nearestTree = forest.placements.map(p => ({ x: p.x, z: p.z, distance: Math.hypot(p.x - tree.stats().site[0], p.z - tree.stats().site[2]) })).sort((a, b) => a.distance - b.distance)[0];
  assert(nearestTree.distance > 2.6, 'New treasure needs a clear place among the existing forest trunks');
  const camera = new THREE.PerspectiveCamera(62, 1.5, .08, 240);
  const walk = createWalkController({ camera, canvas: { style: {}, addEventListener() {}, hasPointerCapture() { return false; } }, orbitControls: { target: new THREE.Vector3(), enabled: true, update() {} }, cabin: { getDoorAmount: () => 1, setDoor() {}, doorState: { target: 1 } } });
  for (const p of forest.placements) walk.addCollider('pine trunk', p.x, p.z, .2 * p.scale, -2, 20);
  for (const c of tree.colliders) walk.addColliderBox(c);
  // Include all six memory boxes at their authored size; the trail must lead
  // around them, rather than relying on a teleport into an isolated pocket.
  for (const [x, z] of [[-5.9, 9.1], [-7.1, 5.3], [-7.1, .1], [6.1, 8.1], [7.6, 3.6], [6.8, -2.2]]) walk.addCollider('memory chest', x, z, .64, -2, 1.3);
  walk.start();
  assert(walk.setPose(tree.viewPose, 0, 0), 'Authored standing position is free');
  assert(walk.canReach(tree.target.position, 1.8), 'Actual walk controller can touch the actual chest target');
  const distance = camera.position.distanceTo(tree.target.position);
  const yaw = Math.atan2(-(tree.target.position.x - camera.position.x), -(tree.target.position.z - camera.position.z));
  const pitch = Math.atan2(tree.target.position.y - camera.position.y, Math.hypot(tree.target.position.x - camera.position.x, tree.target.position.z - camera.position.z));
  walk.setPose(tree.viewPose, yaw, pitch); scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(camera.position, tree.target.position.clone().sub(camera.position).normalize());
  const hits = ray.intersectObject(tree.target.object, true); assert(hits.length, 'Touch line hits visible chest / its exact hit volume'); assert(hits[0].distance < 1.8);
  // Flood fill the actual collision probe from the outside doorway to the
  // treasure pose, to ensure the low path can be followed without teleporting.
  const step = .15, minX = -11.5, minZ = 7.25, nx = 76, nz = 31;
  const key = (x, z) => x + ',' + z;
  const cell = (x, z) => [Math.round((x - minX) / step), Math.round((z - minZ) / step)];
  const start = cell(-1.4, 7.7), goal = cell(tree.viewPose[0], tree.viewPose[2]), queue = [start], seen = new Set([key(...start)]);
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, zz = z + dz, k = key(xx, zz);
      if (xx < 0 || zz < 0 || xx >= nx || zz >= nz || seen.has(k)) continue;
      const wx = minX + xx * step, wz = minZ + zz * step;
      if (walk.probe(wx, wz, terrainHeight(wx, wz) + .045).blockedBy) continue;
      seen.add(k); queue.push([xx, zz]);
    }
  }
  assert(seen.has(key(...goal)), 'Tree target is connected to the front door by walkable snow');
  let nonFinite = 0, lights = 0;
  tree.group.traverse(o => { if (o.isLight) lights++; if (o.geometry) for (const a of Object.values(o.geometry.attributes)) for (const value of a.array) if (!Number.isFinite(value)) nonFinite++; for (const value of o.matrixWorld.elements) if (!Number.isFinite(value)) nonFinite++; });
  assert.equal(nonFinite, 0); assert.equal(lights, 0, 'Treasure tree does not alter the renderer light topology');
  const opening = []; assert(tree.open()); assert(tree.reveal());
  for (let i = 0; i < 180; i++) { tree.update(1 / 60, i / 60); if (i < 7 || i % 30 === 0) opening.push(tree.stats().opening); }
  assert(opening[0] < .1, 'First touch frame cannot snap the lid open');
  assert(opening.every((v, i) => !i || v >= opening[i - 1]), 'Hinge opens monotonically with easing');
  assert(tree.stats().opening > .999); assert.equal(tree.stats().openCount, 1, 'Repeated interaction preserves the discovery');
  const report = { success: true, kind: 'CPU geometry, story disclosure and actual navigation tests; no GPU assertions', ...tree.stats(), touchDistance: distance, nearestExistingPine: nearestTree, reachableSnowCells: seen.size, initialOpeningFrames: opening.slice(0, 7), noExtraLights: lights === 0, publicBirthdayParagraphs: BIRTHDAY_NOTE.paragraphs.length, hiddenLetterParagraphs: SECRET_LETTER.paragraphs.length };
  fs.writeFileSync(path.join(project, '../treasure-tree-audit-v9.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
