import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './textures.js';
import { carvedSign, contactShadow, interactionMaterial } from './diegetic-text.js';

// In the clear space between the left memory walk and the framing pine. The
// chest is in front of the roots, rather than inside a tree / navigation volume.
export const TREASURE_TREE_SITE = Object.freeze({
  x: -10.2, z: 7.75, chestX: -9.54, chestZ: 9.05,
  viewPose: Object.freeze([-9.22, 0, 10.07])
});

function needleTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const q = c.getContext('2d'), rnd = mulberry32(102928);
  const stroke = (ax, ay, bx, by, width, color) => {
    q.strokeStyle = color; q.lineWidth = width; q.beginPath();
    q.moveTo(ax, ay); q.lineTo(bx, by); q.stroke();
  };
  stroke(12, 128, 506, 128, 4, '#6c604a');
  for (let i = 0; i < 39; i++) {
    const x = 20 + i * 11.7, width = 15 + Math.sin(i / 39 * Math.PI) * 72;
    for (const side of [-1, 1]) {
      const ex = Math.min(506, x + 40 + rnd() * 40), ey = 128 + side * width;
      stroke(x, 128, ex, ey, 1.8, '#50624b');
      for (let n = 0; n < 8; n++) {
        const t = n / 8, sx = x + (ex - x) * t, sy = 128 + (ey - 128) * t;
        const length = 14 + rnd() * 15;
        stroke(sx, sy, sx + length * .68, sy + side * length * .62,
          1.3 + rnd() * .7, n % 3 ? '#365b42' : '#82927b');
      }
    }
  }
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8; return texture;
}

function labelTexture() {
  const c = document.createElement('canvas'); c.width = 1536; c.height = 424;
  const q = c.getContext('2d');
  q.fillStyle = '#fff3db'; q.fillRect(0, 0, c.width, c.height);
  q.strokeStyle = '#a77d48'; q.lineWidth = 6; q.strokeRect(19, 19, 1498, 386);
  q.strokeStyle = '#d4b982'; q.lineWidth = 2; q.strokeRect(32, 32, 1472, 360);
  q.fillStyle = '#684632'; q.textAlign = 'center'; q.textBaseline = 'middle';
  q.font = '700 111px "Microsoft YaHei", "PingFang SC", sans-serif';
  q.fillText('属于你的那棵树', 768, 161, 1380);
  q.fillStyle = '#856b50'; q.font = '500 47px "Microsoft YaHei", sans-serif';
  q.fillText('有一封信，在这里等你。', 768, 303, 1350);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16; return texture;
}

function batchStatic(parent) {
  // Geometry is authored once. Only the chest lid and the paper inside move.
  parent.updateMatrixWorld(true);
  const inverse = parent.matrixWorld.clone().invert(), buckets = new Map(), remove = [];
  parent.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.userData.noMerge) return;
    let p = o;
    while (p && p !== parent) { if (p.userData.dynamic) return; p = p.parent; }
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    const key = o.material.uuid + ':' + o.castShadow + ':' + o.receiveShadow;
    if (!buckets.has(key)) buckets.set(key, { material: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [] });
    buckets.get(key).geos.push(g); remove.push(o);
  });
  for (const b of buckets.values()) {
    const geometry = mergeGeometries(b.geos, false);
    if (!geometry) throw new Error('Treasure tree static geometry could not be merged');
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, b.material);
    mesh.name = 'Treasure tree static ' + b.material.name;
    mesh.castShadow = b.cast; mesh.receiveShadow = b.receive; parent.add(mesh);
    b.geos.forEach(g => g.dispose());
  }
  remove.forEach(o => o.removeFromParent());
}

export function createTreasureTree({ scene, textures, terrainHeight }) {
  if (!scene || typeof terrainHeight !== 'function') throw new Error('Treasure tree needs scene and terrain height');
  const site = TREASURE_TREE_SITE, y0 = terrainHeight(site.x, site.z);
  const group = new THREE.Group(); group.name = '属于你的那棵树 · private birthday letter';
  group.position.set(site.x, y0, site.z); group.userData.treasureTree = true;
  const fixed = new THREE.Group(); fixed.name = 'Living pine and warm treasure path'; group.add(fixed);
  const materials = {
    bark: new THREE.MeshStandardMaterial({ map: textures?.darkWood?.map, normalMap: textures?.darkWood?.normalMap, color: 0x70513a, roughness: .94 }),
    wood: new THREE.MeshStandardMaterial({ map: textures?.darkWood?.map, normalMap: textures?.darkWood?.normalMap, color: 0xaa7049, roughness: .73 }),
    inner: new THREE.MeshStandardMaterial({ color: 0x533b32, roughness: .91 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xcaa467, roughness: .34, metalness: .71 }),
    wire: new THREE.MeshStandardMaterial({ color: 0x6f5e40, roughness: .65, metalness: .5 }),
    snow: new THREE.MeshStandardMaterial({ map: textures?.snow?.map, normalMap: textures?.snow?.normalMap, color: 0xe9f0f5, roughness: .85, normalScale: new THREE.Vector2(.27, .27) }),
    foliage: new THREE.MeshStandardMaterial({ map: needleTexture(), alphaTest: .42, side: THREE.DoubleSide, color: 0xa5b6a1, roughness: .9 }),
    ribbon: new THREE.MeshStandardMaterial({ color: 0xcf8194, roughness: .51, metalness: .1 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xffefd9, roughness: .95 }),
    ink: new THREE.MeshStandardMaterial({ color: 0x6e3f4b, roughness: .9 }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xffdeb0, toneMapped: false }),
    seal: new THREE.MeshStandardMaterial({ color: 0x993e53, roughness: .47 })
  };
  for (const [key, mat] of Object.entries(materials)) mat.name = key;
  const rnd = mulberry32(10292026), up = new THREE.Vector3(0, 1, 0);
  const localGround = (x, z) => terrainHeight(site.x + x, site.z + z) - y0;
  const add = (parent, geometry, material, x = 0, y = 0, z = 0, shadow = true) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z);
    mesh.castShadow = shadow; mesh.receiveShadow = shadow; parent.add(mesh); return mesh;
  };
  const box = (p, w, h, d, mat, x = 0, y = 0, z = 0) => add(p, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const segment = (parent, a, b, r1, r2, material) => {
    const delta = b.clone().sub(a);
    const mesh = add(parent, new THREE.CylinderGeometry(r2, r1, delta.length(), 7, 1), material);
    mesh.quaternion.setFromUnitVectors(up, delta.normalize()); mesh.position.copy(a).add(b).multiplyScalar(.5); return mesh;
  };
  const tube = (parent, points, radius, material, closed = false) => {
    const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', .1);
    return add(parent, new THREE.TubeGeometry(curve, Math.max(12, points.length * 3), radius, 5, closed), material, 0, 0, 0, false);
  };

  // A tapered, lightly bent trunk with articulated boughs and individual needle
  // sprays. There are no stacked cone crowns / rounded cartoon snow tiers.
  const height = 5.55, trunk = new THREE.CylinderGeometry(.033, .20, height, 11, 10);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const h = tp.getY(i) + height / 2;
    tp.setXYZ(i, tp.getX(i) + Math.sin(h * .43) * .065, h, tp.getZ(i) + Math.sin(h * .73) * .032);
  }
  trunk.computeVertexNormals(); add(fixed, trunk, materials.bark);
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7 + .34, reach = .48 + rnd() * .36;
    const points = [new THREE.Vector3(0, .36, 0), new THREE.Vector3(Math.cos(a) * .22, .07, Math.sin(a) * .22),
      new THREE.Vector3(Math.cos(a) * reach, localGround(Math.cos(a) * reach, Math.sin(a) * reach) - .015, Math.sin(a) * reach)];
    tube(fixed, points, .048, materials.bark);
  }
  const foliageGeos = [], scratch = new THREE.Matrix4(); let branchCount = 0;
  function spray(a, b, width, roll) {
    const axis = b.clone().sub(a).normalize(), yy = new THREE.Vector3().crossVectors(axis, up).normalize();
    yy.applyAxisAngle(axis, roll); const zz = new THREE.Vector3().crossVectors(axis, yy).normalize();
    scratch.makeBasis(axis, yy, zz);
    const g = new THREE.PlaneGeometry(a.distanceTo(b), width);
    g.applyMatrix4(scratch); g.translate(...a.clone().add(b).multiplyScalar(.5).toArray()); foliageGeos.push(g);
  }
  for (let level = 0; level < 8; level++) {
    const t = level / 7, h = 1.02 + t * 4.17, reach = .25 + Math.pow(1 - t, .86) * 1.48;
    for (let j = 0; j < 6; j++) {
      const a = level * 2.399 + j * Math.PI / 3 + (rnd() - .5) * .2;
      const r = reach * (.88 + rnd() * .19), start = new THREE.Vector3(.04, h, .015);
      const mid = new THREE.Vector3(Math.cos(a) * r * .58, h - .27 + t * .1, Math.sin(a) * r * .58);
      const tip = new THREE.Vector3(Math.cos(a) * r, h - .11 + t * .11, Math.sin(a) * r);
      segment(fixed, start, mid, .025 * (1 - t * .55), .015, materials.bark);
      segment(fixed, mid, tip, .014, .004, materials.bark); branchCount++;
      const from = start.clone().lerp(mid, .2), width = Math.max(.22, r * .53);
      spray(from, tip, width, Math.PI * .23); spray(from, tip, width * .91, -Math.PI * .28);
      if (j === level % 6) {
        const snow = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI * .53);
        snow.scale(r * .34, .065 + rnd() * .025, width * .37); snow.rotateY(-a);
        const p = mid.clone().lerp(tip, .20); add(fixed, snow, materials.snow, p.x, p.y + .05, p.z);
      }
    }
  }
  spray(new THREE.Vector3(.04, 4.96, 0), new THREE.Vector3(.04, 5.75, .01), .35, 0);
  spray(new THREE.Vector3(.04, 4.96, .01), new THREE.Vector3(.04, 5.75, 0), .35, Math.PI / 2);
  const foliage = mergeGeometries(foliageGeos); foliageGeos.forEach(g => g.dispose());
  add(fixed, foliage, materials.foliage);

  // The gold line follows the actual bough volume. Warm microbulbs create a
  // recognizable destination without a large floating marker / extra lights.
  const bulbs = [], wire = [];
  for (let i = 0; i <= 96; i++) {
    const t = i / 96, a = t * Math.PI * 2 * 2.6 + .34, r = 1.38 * Math.pow(1 - t, .85) + .12;
    const p = new THREE.Vector3(Math.cos(a) * r, .91 + t * 4.22, Math.sin(a) * r);
    wire.push(p); if (i % 2 === 0) bulbs.push(p);
  }
  tube(fixed, wire, .006, materials.wire);
  const starPositions = [[-.87, 1.66, .88], [.70, 2.19, .94], [-.48, 3.0, .69]];
  for (const [x, y, z] of starPositions) {
    const points = [];
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + Math.PI / 2, r = i % 2 ? .045 : .105; points.push(new THREE.Vector3(x + Math.cos(a) * r, y + Math.sin(a) * r, z)); }
    tube(fixed, points, .006, materials.gold, true); bulbs.push(new THREE.Vector3(x, y, z));
  }

  // Two slender wooden stakes carry a horizontal sign. It reads as a gift
  // destination; no slab, headstone silhouette or grave-like mound.
  const sign = new THREE.Group(); sign.position.set(.97, localGround(.97, .65), .65); sign.rotation.y = .20; fixed.add(sign);
  for (const x of [-.53, .53]) box(sign, .028, .98, .033, materials.wood, x, .47, 0);
  const plate = carvedSign(labelTexture(), 1.48, .408, { frame: 'brass', depth: .028 });
  plate.position.set(0, 1.0, .01); plate.userData.noMerge = true; sign.add(plate);
  for (let i = 0; i <= 8; i++) bulbs.push(new THREE.Vector3(.97 + (i / 8 - .5) * 1.46, sign.position.y + 1.225, .65 + .013));

  const cx = site.chestX - site.x, cz = site.chestZ - site.z, cy = localGround(cx, cz);
  const chest = new THREE.Group(); chest.name = 'Tree treasure chest · touch to uncover the letter';
  chest.position.set(cx, cy, cz); chest.rotation.y = .16; group.add(chest);
  const shell = new THREE.Group(); chest.add(shell);
  // Open interior: four separate boards leave a hollow cavity under the lid.
  box(shell, .81, .065, .53, materials.wood, 0, -.025, 0);
  for (const x of [-.382, .382]) box(shell, .047, .30, .53, materials.wood, x, .115, 0);
  for (const z of [-.243, .243]) box(shell, .72, .30, .045, materials.wood, 0, .115, z);
  box(shell, .71, .024, .43, materials.inner, 0, .012, 0);
  for (const x of [-.285, .285]) {
    box(shell, .031, .304, .543, materials.gold, x, .116, 0);
    for (let j = 0; j < 3; j++) add(shell, new THREE.SphereGeometry(.008, 8, 5), materials.gold, x, .026 + j * .105, .278);
  }
  // Half-buried corners: snow sits only around the outside of the little box.
  for (const [x, z, sx, sz] of [[-.43, .14, .19, .22], [.41, -.12, .20, .24], [-.15, -.31, .36, .13]]) {
    const drift = add(fixed, new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), materials.snow, cx + x, cy + .012, cz + z);
    drift.scale.set(sx, .10, sz);
  }
  const lid = new THREE.Group(); lid.name = 'Slowly hinged treasure lid'; lid.userData.dynamic = true;
  lid.position.set(0, .272, -.252); chest.add(lid);
  const top = box(lid, .837, .081, .556, materials.wood, 0, .035, .258);
  top.geometry.computeVertexNormals();
  for (const x of [-.285, .285]) box(lid, .032, .09, .564, materials.gold, x, .035, .258);
  for (const x of [-.24, .24]) { const hinge = add(lid, new THREE.CylinderGeometry(.018, .018, .072, 12), materials.gold, x, -.003, 0); hinge.rotation.z = Math.PI / 2; }
  box(lid, .075, .109, .018, materials.gold, 0, -.010, .546);
  // A fabric ribbon loop and wax seal connects the find to a birthday gift.
  box(lid, .057, .004, .54, materials.ribbon, .076, .079, .258);
  for (const side of [-1, 1]) {
    const points = [new THREE.Vector3(.076, .088, .26), new THREE.Vector3(.076 + side * .10, .15, .23), new THREE.Vector3(.076 + side * .17, .13, .28), new THREE.Vector3(.076, .088, .26)];
    tube(lid, points, .012, materials.ribbon);
  }
  const envelope = new THREE.Group(); envelope.name = 'A birthday letter waiting inside'; envelope.userData.dynamic = true; chest.add(envelope);
  box(envelope, .44, .018, .27, materials.paper, 0, .056, .012);
  const fold = [new THREE.Vector3(-.20, .068, -.10), new THREE.Vector3(0, .070, .042), new THREE.Vector3(.20, .068, -.10)];
  tube(envelope, fold, .002, materials.gold);
  add(envelope, new THREE.CylinderGeometry(.034, .037, .006, 24), materials.seal, 0, .073, .034);
  const seam = box(chest, .68, .009, .008, materials.bulb, 0, .269, .275); seam.castShadow = seam.receiveShadow = false;
  const hit = add(chest, new THREE.BoxGeometry(.94, .65, .68), interactionMaterial, 0, .23, 0, false);
  hit.name = 'Interact · secret-letter'; hit.userData.noMerge = true;
  contactShadow(group, cx, cy + .011, cz, .62, .49, .22);

  // A low, walkable trail starts beyond the first memory box, then curves to
  // the front of the treasure. Repeated tiny lamps are a single draw call.
  const trail = [[2.88, 2.98], [2.24, 2.79], [1.65, 2.60], [1.05, 2.30]];
  for (const [x, z] of trail) {
    const y = localGround(x, z);
    add(fixed, new THREE.CylinderGeometry(.032, .046, .16, 10), materials.gold, x + .17, y + .08, z);
    bulbs.push(new THREE.Vector3(x + .17, y + .17, z));
    const cap = add(fixed, new THREE.SphereGeometry(.05, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), materials.snow, x + .17, y + .20, z);
    cap.scale.y = .4;
  }
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.021, 8, 6), materials.bulb, bulbs.length);
  const matrix = new THREE.Matrix4(); bulbs.forEach((p, i) => { matrix.makeTranslation(p.x, p.y, p.z); bulbMesh.setMatrixAt(i, matrix); });
  bulbMesh.name = 'Tiny warm lights tracing the tree and the path'; bulbMesh.castShadow = bulbMesh.receiveShadow = false;
  fixed.add(bulbMesh); bulbMesh.instanceMatrix.needsUpdate = true;

  // Snow shoe impressions are shallow shaded soles, never deep black holes.
  // They stop at the opening pose, leaving the box itself unobstructed.
  const sole = new THREE.Shape(); sole.moveTo(-.055, -.13); sole.quadraticCurveTo(-.09, -.03, -.07, .10);
  sole.quadraticCurveTo(0, .18, .07, .10); sole.lineTo(.064, -.10); sole.quadraticCurveTo(0, -.17, -.055, -.13);
  const printMaterial = new THREE.MeshStandardMaterial({ color: 0xaab9c7, roughness: .99, polygonOffset: true, polygonOffsetFactor: -1 }); printMaterial.name = 'soft snow impressions';
  for (let i = 0; i < 7; i++) {
    const t = i / 6, x = 2.65 - t * 1.65 + (i % 2 ? .09 : -.09), z = 2.80 - t * .41;
    const print = add(fixed, new THREE.ShapeGeometry(sole, 8), printMaterial, x, localGround(x, z) + .008, z, false);
    print.rotation.set(-Math.PI / 2, 0, -.40 + (i % 2 ? -.08 : .08));
  }
  contactShadow(group, 0, .006, 0, .68, .57, .17);
  batchStatic(fixed); batchStatic(shell); batchStatic(lid); batchStatic(envelope);
  scene.add(group); group.updateMatrixWorld(true);

  const viewPose = [...site.viewPose], chestWorld = new THREE.Vector3();
  chest.localToWorld(chestWorld.set(0, .34, .20));
  const target = {
    id: 'secret-letter', kind: 'treasure', title: '属于你的那棵树',
    action: '轻轻打开树下的礼物', object: chest, group: chest,
    position: chestWorld, viewPose, outsideOnly: true, opened: false,
    hint: '顺着暖灯走近树根，系着丝带的小箱子里留了一封信。'
  };
  const chestGround = y0 + cy;
  const colliders = [
    { name: '属于你的那棵树 · trunk', shape: 'circle', x: site.x, z: site.z, radius: .23, minY: y0 - .25, maxY: y0 + height, structural: true },
    { name: '树下的生日宝箱', shape: 'obb', x: site.chestX, z: site.chestZ, halfX: .43, halfZ: .29, angle: .16, minY: chestGround - .1, maxY: chestGround + .39 },
    { name: '属于你的那棵树 · sign', minX: site.x + .40, maxX: site.x + 1.54, minZ: site.z + .59, maxZ: site.z + .72, minY: y0 - .1, maxY: y0 + 1.24 }
  ];
  let opening = 0, opened = false, age = 0, openCount = 0;
  function reveal() { if (!opened) { opened = target.opened = true; openCount++; } return true; }
  function update(dt, time) {
    const delta = Math.max(0, Math.min(.05, Number(dt) || 0)); age += delta;
    const now = Number.isFinite(time) ? time : age;
    opening = THREE.MathUtils.damp(opening, opened ? 1 : 0, 4.3, delta);
    // Ease the physical hinge with no sudden visible pop / allocations.
    lid.rotation.x = -1.15 * opening;
    envelope.position.y = .06 * opening;
    materials.bulb.color.setRGB(1, .73 + Math.sin(now * .9) * .025, .40);
    seam.visible = opening < .82;
  }
  function stats() {
    let meshes = 0, triangles = 0, vertices = 0;
    group.traverse(o => { if (!o.isMesh) return; meshes++; const p = o.geometry.attributes.position;
      vertices += p.count; triangles += (o.geometry.index ? o.geometry.index.count : p.count) / 3 * (o.isInstancedMesh ? o.count : 1); });
    return { id: target.id, site: [site.x, y0, site.z], chest: [site.chestX, chestGround, site.chestZ], target: target.position.toArray(), viewPose, branchCount, bulbCount: bulbs.length, opened, opening, openCount, meshes, triangles: Math.round(triangles), vertices, outsideOnly: true, extraLights: 0 };
  }
  return { group, target, colliders, viewPose, update, reveal, open: reveal, stats,
    get unlocked() { return opened; } };
}
