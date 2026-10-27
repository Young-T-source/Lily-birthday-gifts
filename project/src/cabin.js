import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './textures.js';
import { terrainHeight } from './environment.js';
import { contactShadow, shareSurfaceMaterials, rebatchSharedSurfaces } from './diegetic-text.js';

/* ================================================================== */
/*  SNOW PINE CABIN                                                   */
/*  All geometry is authored procedurally so the exported page is one  */
/*  portable file.                                                     */
/* ================================================================== */

function cloneTex(t, rx = 1, ry = rx) {
  const c = t.clone();
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry);
  c.needsUpdate = true;
  return c;
}

function matFrom(texSet, repeat, color, normalScale = 1, roughness = 0.8) {
  // One uploaded texture serves many physical surfaces; UV scale belongs to the material.
  const map=texSet.map,normalMap=texSet.normalMap||null;
  for(const t of [map,normalMap])if(t){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.needsUpdate=true;}
  const m=new THREE.MeshPhysicalMaterial({map,normalMap,normalScale:new THREE.Vector2(normalScale,normalScale),color,roughness,metalness:0,clearcoat:roughness<.5?.12:0,clearcoatRoughness:.42});
  const scale=new THREE.Vector2(repeat,repeat);
  m.onBeforeCompile=shader=>{shader.uniforms.uSurfaceUvScale={value:scale};shader.vertexShader='uniform vec2 uSurfaceUvScale;\n'+shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
    #ifdef USE_MAP
      vMapUv *= uSurfaceUvScale;
    #endif
    #ifdef USE_NORMALMAP
      vNormalMapUv *= uSurfaceUvScale;
    #endif
  `);};
  m.userData.surfaceUvRepeat=repeat;m.customProgramCacheKey=()=> 'shared-surface-uv-v4';return m;
}

function makeMaterials(tex) {
  const snowMap = cloneTex(tex.snow.map, 12);
  const snowNormal = cloneTex(tex.snow.normalMap, 12);
  const bookCache = new Map();
  return {
    log: matFrom(tex.log, 1.35, 0xb18d6c, .62, 0.84),
    logDark: matFrom(tex.darkWood, 1.4, 0x9c775c, .65, 0.76),
    floor: matFrom(tex.floor, 2.2, 0xb89775, .45, 0.63),
    trim: matFrom(tex.darkWood, 2, 0x5e402a, 0.9, 0.78),
    beam: matFrom(tex.darkWood, 2, 0x553a27, 0.95, 0.8),
    roof: matFrom(tex.roof, 3, 0x8b9296, 1.0, 0.86),
    stone: matFrom(tex.stone, 0.8, 0xb8b1a5, .82, 0.86),
    snow: new THREE.MeshStandardMaterial({
      map: snowMap, normalMap: snowNormal,
      roughnessMap: tex.snow.roughnessMap ? cloneTex(tex.snow.roughnessMap,12) : null,
      normalScale: new THREE.Vector2(0.35, 0.35),
      color: 0xf4f9ff, roughness: 0.78, metalness: 0.0, envMapIntensity:.55
    }),
    snowSoft: new THREE.MeshStandardMaterial({
      map: cloneTex(tex.snow.map, 3), color: 0xf7fbff,
      roughness: 0.78, metalness: 0.0, envMapIntensity:.55
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xbfd7e9, transparent: true, opacity: 0.14,
      roughness: 0.06, metalness: 0.0, side: THREE.DoubleSide,
      depthWrite: false, envMapIntensity: 1.8, clearcoat: 1, clearcoatRoughness: 0.04
    }),
    glassWarm: new THREE.MeshBasicMaterial({
      color: 0xffb15c, transparent: true, opacity: 0.055,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }),
    frost: new THREE.MeshStandardMaterial({
      map: tex.frost, transparent: true, opacity: 0.065, roughness:.96,
      depthWrite: false, side: THREE.DoubleSide
    }),
    iron: new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.42, metalness: 0.85 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb68843, roughness: 0.3, metalness: 0.9 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xa95f34, roughness: 0.35, metalness: 0.8 }),
    fabricRust: matFrom(tex.knitOchre, 2.2, 0xa35b3c, 1.3, 0.95),
    fabricGreen: matFrom(tex.knitGreen, 2.2, 0x5c7b69, 1.2, 0.95),
    fabricCream: matFrom(tex.knitCream, 2.2, 0xd8c7ad, 1.2, 0.95),
    woolRug: new THREE.MeshStandardMaterial({
      map: cloneTex(tex.rug.map, 1), normalMap: cloneTex(tex.rug.normalMap, 1),
      roughness: 0.98, color: 0xffffff
    }),
    ceramic: new THREE.MeshPhysicalMaterial({ color: 0xf1e8d8, roughness: 0.20, metalness: 0.0, clearcoat: .8, clearcoatRoughness: .12 }),
    ceramicGreen: new THREE.MeshPhysicalMaterial({ color: 0x8da18e, roughness: 0.24, clearcoat:.65, clearcoatRoughness:.17 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xe8ddc7, roughness: 0.9 }),
    candle: new THREE.MeshStandardMaterial({ color: 0xf2e3c4, roughness: 0.55, emissive: 0xffa64d, emissiveIntensity: 0.06 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.92, toneMapped: false }),
    ember: new THREE.MeshStandardMaterial({ color: 0xff5c1a, emissive: 0xff4a08, emissiveIntensity: 2.6, roughness: 0.6 }),
    ice: new THREE.MeshPhysicalMaterial({
      color: 0xd6ecff, transparent: true, opacity: 0.62, roughness: 0.05,
      metalness: 0.0, clearcoat: 1, side: THREE.DoubleSide
    }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x294a39, roughness: 0.88 }),
    leafLight: new THREE.MeshStandardMaterial({ color: 0x385943, roughness: 0.9 }),
    bark: matFrom(tex.darkWood, 1.5, 0x5a402e, 1.2, 0.95),
    book: (color) => {
      if (!bookCache.has(color)) {
        bookCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.82 }));
      }
      return bookCache.get(color);
    },
    paintingA: new THREE.MeshStandardMaterial({ map: tex.paintingA, roughness: 0.85 }),
    paintingB: new THREE.MeshStandardMaterial({ map: tex.paintingB, roughness: 0.85 }),
    sign: new THREE.MeshStandardMaterial({ map: tex.sign, roughness:.84 }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xffd28a }),
    bulbWarm: new THREE.MeshBasicMaterial({ color: 0xffb45e }),
    black: new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 0.95 })
  };
}

export function buildCabin(scene, tex) {
  const cabin = new THREE.Group();
  scene.add(cabin);
  const M = makeMaterials(tex);
  for(const key of ['fabricRust','fabricGreen','fabricCream']){M[key].sheen=.5;M[key].sheenColor.set(0xffd9c0);M[key].sheenRoughness=.8;M[key].normalScale.set(.55,.55);}
  // Seamless longitudinal grain for round logs; plank seams belong only on flat boards.
  const grainCanvas=document.createElement('canvas');grainCanvas.width=512;grainCanvas.height=256;const gc=grainCanvas.getContext('2d');gc.fillStyle='#a88a68';gc.fillRect(0,0,512,256);
  for(let i=0;i<140;i++){const xx=i*512/140;gc.strokeStyle=i%3?'rgba(71,44,26,.15)':'rgba(231,207,164,.13)';gc.lineWidth=i%5===0?1.8:.6;gc.beginPath();for(let y=0;y<=256;y+=4){const x=xx+Math.sin(y*.03+i*.41)*1.6+Math.sin(y*.06+i)*.7;y?gc.lineTo(x,y):gc.moveTo(x,y);}gc.stroke();}
  const roundGrain=new THREE.CanvasTexture(grainCanvas);roundGrain.colorSpace=THREE.SRGBColorSpace;roundGrain.wrapS=roundGrain.wrapT=THREE.RepeatWrapping;roundGrain.anisotropy=8;M.log.map=roundGrain;M.log.normalMap=null;

  const rnd = mulberry32(1886);
  const doorMeshes = [];
  const windowGlass = [];
  const lightPools = [];
  const stringBulbs = [];
  const candles = [];
  const flames = [];
  const spritesGlow = [];
  const clockHands = [];

  /* helpers ------------------------------------------------------- */
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = cabin, cast = true, receive = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast; m.receiveShadow = receive;
    parent.add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z, parent = cabin, cast = true, receive = true) =>
    add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent, cast, receive);
  const rbox = (w, h, d, r, mat, x, y, z, parent = cabin, cast = true) =>
    add(new RoundedBoxGeometry(w, h, d, 3, r), mat, x, y, z, parent, cast, true);
  const cyl = (rt, rb, h, seg, mat, x, y, z, parent = cabin, cast = true) =>
    add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, parent, cast, true);
  const logX = (x1, x2, y, z, r = 0.15, mat = M.log, parent = cabin) => {
    const m = add(new THREE.CylinderGeometry(r, r, x2 - x1, 18, 1), mat, (x1 + x2) / 2, y, z, parent, true, true);
    m.rotation.z = Math.PI / 2;
    return m;
  };
  const logZ = (z1, z2, y, x, r = 0.15, mat = M.log, parent = cabin) => {
    const m = add(new THREE.CylinderGeometry(r, r, z2 - z1, 18, 1), mat, x, y, (z1 + z2) / 2, parent, true, true);
    m.rotation.x = Math.PI / 2;
    return m;
  };
  const snowBlob = (x, y, z, sx = 0.5, sy = 0.16, sz = 0.55, parent = cabin, mat = M.snow) => {
    const geo=new THREE.SphereGeometry(1,12,8),verts=geo.attributes.position;for(let i=0;i<verts.count;i++){const px=verts.getX(i),py=verts.getY(i),pz=verts.getZ(i),r=1+.055*Math.sin(px*6+pz*3)*Math.cos(pz*7+py*4);verts.setXYZ(i,px*r,py*(1+.035*Math.sin(px*8+pz*5)),pz*r);}geo.computeVertexNormals();const m = add(geo, mat, x, y, z, parent, false, true);
    m.scale.set(sx, sy, sz);
    return m;
  };

  /* ================================================================ */
  /*  FOUNDATION & FLOOR                                              */
  /* ================================================================ */
  box(9.9, 0.5, 7.5, M.stone, 0, 0.25, 0);
  box(9.4, 0.14, 7.0, M.floor, 0, 0.55, 0);
  // individual stone footing blocks
  for (let i = 0; i < 9; i++) {
    box(0.9, 0.42, 0.24, M.stone, -4.3 + i * 1.06, 0.22, 3.56, cabin, false);
    box(0.9, 0.42, 0.24, M.stone, -4.3 + i * 1.06, 0.22, -3.56, cabin, false);
  }
  for (let i = 0; i < 6; i++) {
    box(0.24, 0.42, 0.9, M.stone, 4.83, 0.22, -2.6 + i * 1.04, cabin, false);
    box(0.24, 0.42, 0.9, M.stone, -4.83, 0.22, -2.6 + i * 1.04, cabin, false);
  }
  // interior floor boards direction accent
  for (let i = 0; i < 20; i++) {
    const p = box(0.44, 0.025, 6.5, M.floor, -4.2 + i * 0.44, 0.625, 0, cabin, false, true);
    p.material = M.floor;
  }

  /* ================================================================ */
  /*  LOG WALLS                                                       */
  /* ================================================================ */
  const wallOpenings = {
    front: [
      { a: -2.33, b: -0.83, y0: 0.5, y1: 2.93 },   // door
      { a: -4.06, b: -3.04, y0: 1.36, y1: 2.69 },  // small window
      { a: 1.28, b: 3.48, y0: 1.36, y1: 2.69 }     // big window
    ],
    back: [
      { a:-1.74,b:-.10,y0:.66,y1:1.92 }, // open masonry firebox
      { a: 1.92, b: 3.48, y0: 1.38, y1: 2.69 }     // back window
    ],
    left: [
      { a: 0.18, b: 1.42, y0: 1.38, y1: 2.69 }
    ],
    right: [
      { a: -2.22, b: -0.98, y0: 1.38, y1: 2.69 }
    ]
  };

  function cutSegments(min, max, y, openings) {
    let blocked = openings
      .filter(o => y > o.y0 - 0.08 && y < o.y1 + 0.08)
      .map(o => [o.a, o.b])
      .sort((a, b) => a[0] - b[0]);
    const out = [];
    let cursor = min;
    for (const [a, b] of blocked) {
      if (b <= cursor || a >= max) continue;
      if (a > cursor) out.push([cursor, Math.min(a, max)]);
      cursor = Math.max(cursor, b);
    }
    if (cursor < max) out.push([cursor, max]);
    return out.filter(([a, b]) => b - a > 0.07);
  }

  const logRows = 10;
  for (let row = 0; row < logRows; row++) {
    const y = 0.68 + row * 0.275;
    const r = 0.145 + (row % 2) * 0.006;
    // front / back logs run along X
    for (const [z, openings] of [[3.38, wallOpenings.front], [-3.38, wallOpenings.back]]) {
      for (const [a, b] of cutSegments(-4.72, 4.72, y, openings)) {
        logX(a - 0.02, b + 0.02, y, z, r);
      }
    }
    // side logs run along Z, at alternating heights
    const sy = y + 0.137;
    for (const [x, openings] of [[-4.6, wallOpenings.left], [4.6, wallOpenings.right]]) {
      for (const [a, b] of cutSegments(-3.4, 3.4, sy, openings)) {
        logZ(a - 0.02, b + 0.02, sy, x, r);
      }
    }
  }
  // corner uprights + wall plate
  for (const [x, z] of [[-4.62, 3.4], [4.62, 3.4], [-4.62, -3.4], [4.62, -3.4]]) {
    box(0.26, 3.0, 0.26, M.trim, x, 1.95, z);
  }
  for (const z of [3.4, -3.4]) box(9.6, 0.18, 0.22, M.trim, 0, 3.32, z);
  for (const x of [-4.62, 4.62]) box(0.22, 0.18, 7.0, M.trim, x, 3.32, 0);

  /* ================================================================ */
  /*  GABLE ENDS                                                      */
  /* ================================================================ */
  const upperRoofStart = cabin.children.length;
  function gable(x, dir) {
    const g = new THREE.BufferGeometry();
    const verts = new Float32Array([
      x, 4.27, -3.45,
      x, 4.27, 3.45,
      x, 6.23, 0
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    g.computeVertexNormals();
    const mesh = add(g, new THREE.MeshStandardMaterial({
      map: cloneTex(tex.log.map, 1.2), normalMap: cloneTex(tex.log.normalMap, 1.2),
      color: 0x936b4c, roughness: 0.8, side: THREE.DoubleSide
    }), 0, 0, 0, cabin, true, true);
    // battens on the gable face
    for (let i = -3; i <= 3; i++) {
      const z = i * 0.95;
      const h = 6.23 - Math.abs(z) * 0.568 - 4.27;
      if (h > 0.15) box(0.05, h, 0.11, M.trim, x + dir * 0.03, 4.27 + h / 2, z, cabin, false);
    }
    return mesh;
  }
  gable(-4.64, -1);
  gable(4.64, 1);
  // round gable window on the visible right-hand side
  {
    const ring = add(new THREE.TorusGeometry(0.46, 0.065, 8, 24), M.trim, 4.68, 4.5, 0.5);
    ring.rotation.y = Math.PI / 2;
    const glass = add(new THREE.CircleGeometry(0.42, 24), M.glassWarm, 4.67, 4.5, 0.5, cabin, false, false);
    glass.rotation.y = Math.PI / 2;
    const innerGlow = add(new THREE.CircleGeometry(0.39, 24), new THREE.MeshBasicMaterial({
      color: 0xffae5e, transparent: true, opacity: 0.23,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false
    }), 4.66, 4.5, 0.5, cabin, false, false);
    innerGlow.rotation.y = Math.PI / 2;
    innerGlow.renderOrder = 2;
    for (let i = 0; i < 4; i++) {
      const bar = box(0.035, 0.8, 0.035, M.trim, 4.69, 4.5, 0.5, cabin, false);
      bar.rotation.x = i * Math.PI / 4;
    }
    const sill = box(0.18, 0.1, 1.1, M.trim, 4.74, 4.02, 0.5, cabin, true);
    snowBlob(4.79, 4.09, 0.5, 0.14, 0.045, 0.48, cabin);
  }

  /* ================================================================ */
  /*  ROOF — shingles, deep snow, icicles                              */
  /* ================================================================ */
  const roofAngle = Math.atan2(2.9, 5.2);
  const roofSlope = Math.hypot(2.9, 5.2);
  const roofGroups = [];
  for (const side of [1, -1]) {
    const rg = new THREE.Group();
    rg.position.set(0, 4.76, side * 2.6);
    rg.rotation.x = side * roofAngle;
    cabin.add(rg);
    roofGroups.push(rg);
    box(11.85, 0.18, roofSlope, M.roof, 0, 0, 0, rg);
    // interior wood soffit
    box(11.2, 0.055, roofSlope - 0.2, M.floor, 0, -0.12, -0.02, rg, false, true);
    // thick snow layer, slightly oversized
    const sn = add(new RoundedBoxGeometry(11.95, 0.2, roofSlope + 0.12, 3, 0.08), M.snow, 0, 0.18, 0, rg, true, true);
    const powder=new THREE.PlaneGeometry(11.88,roofSlope+.035,72,40);powder.rotateX(-Math.PI/2);
    const pp=powder.attributes.position;
    for(let i=0;i<pp.count;i++){
      const x=pp.getX(i),z=pp.getZ(i),edge=Math.min(1,(5.94-Math.abs(x))*5,(roofSlope/2-Math.abs(z))*5);
      const dune=.006*Math.sin(x*1.32+side)*Math.cos(z*2.1)+.002*Math.sin(x*5.8+z*3.7);
      pp.setY(i,.315+Math.max(0,edge)*(.012+dune));
    }
    powder.computeVertexNormals();add(powder,M.snow,0,0,0,rg,false,true);
  }
  // ridge snow cap
  const ridgeSnow = add(new THREE.CylinderGeometry(0.25, 0.25, 11.6, 12, 1, false), M.snow, 0, 6.18, 0);
  ridgeSnow.rotation.z = Math.PI / 2;
  ridgeSnow.scale.y = 0.67;
  box(11.9, 0.16, 0.4, M.trim, 0, 6.03, 0);
  // eave boards and gutters
  for (const z of [5.2, -5.2]) {
    box(11.9, 0.18, 0.24, M.trim, 0, 3.31, z);
  }

  // Icicles along the front and back eaves
  {
    const count = 54;
    const geo = new THREE.ConeGeometry(0.045, 1, 5, 1);
    geo.rotateX(Math.PI);
    geo.translate(0, -0.5, 0);
    const inst = new THREE.InstancedMesh(geo, M.ice, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const front = i < 36;
      const x = (rnd() - 0.5) * 11.4;
      const z = front ? 5.31 + rnd() * 0.08 : -5.31 - rnd() * 0.08;
      const len = 0.18 + rnd() * 0.55;
      dummy.position.set(x, 3.26, z);
      dummy.scale.set(0.7 + rnd() * 0.7, len, 0.7 + rnd() * 0.7);
      dummy.rotation.y = rnd() * Math.PI;
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.castShadow = true; inst.receiveShadow = false;
    cabin.add(inst);
  }

  // rafters & collar ties inside
  box(11.2, 0.22, 0.26, M.beam, 0, 5.94, 0);
  for (let i = -3; i <= 3; i++) {
    const x = i * 1.55;
    for (const side of [1, -1]) {
      const b = box(0.14, 0.17, roofSlope - 0.55, M.beam, x, 4.68, side * 2.52, cabin);
      b.rotation.x = side * roofAngle;
    }
    box(0.13, 0.15, 5.1, M.beam, x, 4.12, 0);
  }

  /* ================================================================ */
  /*  DOOR                                                            */
  /* ================================================================ */
  // Lift the entire original gable / roof assembly to make a real second storey.
  for (const part of cabin.children.slice(upperRoofStart)) part.position.y += 2.6;

  // heavy timber frame
  box(0.19, 2.5, 0.28, M.trim, -2.34, 1.76, 3.4);
  box(0.19, 2.5, 0.28, M.trim, -0.82, 1.76, 3.4);
  box(1.7, 0.2, 0.3, M.trim, -1.58, 2.94, 3.4);
  box(1.68, 0.12, 0.42, M.stone, -1.58, 0.54, 3.46);
  // wall lantern light spill strip in the doorway
  const doorwayGlow = add(new THREE.PlaneGeometry(1.34, 2.28),
    new THREE.MeshBasicMaterial({
      map:tex.glowWarm,color: 0xffb164, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false
    }), -1.58, 1.69, 3.35, cabin, false, false);
  doorwayGlow.rotation.y = 0;

  const doorPivot = new THREE.Group();
  doorPivot.position.set(-2.25, 0.56, 3.4);
  cabin.add(doorPivot);
  {
    const w = 1.36, h = 2.3;
    const door = new THREE.Group();
    doorPivot.add(door);
    // slab backing
    const slab = box(w, h, 0.08, M.logDark, w / 2, h / 2, 0, door, true);
    slab.userData.door = true; doorMeshes.push(slab);
    // five vertical planks with tiny seams
    for (let i = 0; i < 5; i++) {
      const pw = w / 5 - 0.012;
      const plank = box(pw, h - 0.04, 0.055, M.log, 0.02 + pw / 2 + i * (w / 5), h / 2, 0.065, door, true);
      plank.userData.door = true; doorMeshes.push(plank);
    }
    // Z braces
    for (const [y, rot] of [[0.62, -0.31], [1.78, 0.31]]) {
      const brace = box(1.02, 0.12, 0.07, M.trim, w / 2, y, 0.11, door, true);
      brace.rotation.z = rot;
      brace.userData.door = true; doorMeshes.push(brace);
    }
    // iron strap hinges
    for (const y of [0.38, 1.16, 1.95]) {
      const strap = box(0.5, 0.075, 0.035, M.iron, 0.28, y, 0.135, door, false);
      strap.userData.door = true; doorMeshes.push(strap);
      for (const bx of [0.09, 0.46]) {
        const bolt = add(new THREE.SphereGeometry(0.026, 6, 4), M.iron, bx, y, 0.16, door, false);
        bolt.userData.door = true; doorMeshes.push(bolt);
      }
    }
    // handle
    const plate = add(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 12), M.iron, w - 0.19, 1.08, 0.16, door, false);
    plate.rotation.x = Math.PI / 2;
    plate.userData.door = true; doorMeshes.push(plate);
    const ring = add(new THREE.TorusGeometry(0.075, 0.017, 7, 18), M.brass, w - 0.19, 1.00, 0.2, door, false);
    ring.userData.door = true; doorMeshes.push(ring);
    // A restrained woven ribbon, with gravity-softened hanging tails.
    for(const side of [-1,1]){const tail=box(.07,.28,.015,M.fabricRust,w/2+side*.07,1.02,.16,door,false);tail.rotation.z=side*.12;}
    // red bow
    for (const s of [-1, 1]) {
      const bow = box(0.23, 0.11, 0.05, new THREE.MeshStandardMaterial({ color: 0x7e1b20, roughness: 0.7 }),
        w / 2 + s * 0.11, 1.19, 0.16, door, false);
      bow.rotation.z = s * 0.4;
      bow.userData.door = true; doorMeshes.push(bow);
    }
  }
  // invisible but comfortable click target
  const doorClick = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.4, 0.3),
    new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 }));
  doorClick.position.set(-1.57, 1.72, 3.44);
  doorClick.userData.door = true;
  doorMeshes.push(doorClick);
  cabin.add(doorClick);

  /* ================================================================ */
  /*  WINDOWS                                                         */
  /* ================================================================ */
  function curtain(width, height, material) {
    const geo = new THREE.PlaneGeometry(width, height, 14, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, Math.sin((x / width) * Math.PI * 6) * 0.035);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.castShadow = false; m.receiveShadow = true;
    return m;
  }

  function makeWindow(cfg) {
    const { x, y, z, rotY, w, h, curtains = true, lightPool = false } = cfg;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    cabin.add(g);
    const fw = 0.11, fd = 0.24;
    // frame
    box(w + fw * 2, fw, fd, M.trim, 0, h / 2 + fw / 2, 0.02, g);
    box(w + fw * 2, fw, fd, M.trim, 0, -h / 2 - fw / 2, 0.02, g);
    box(fw, h, fd, M.trim, -w / 2 - fw / 2, 0, 0.02, g);
    box(fw, h, fd, M.trim, w / 2 + fw / 2, 0, 0.02, g);
    // muntins
    box(w, 0.045, 0.09, M.trim, 0, 0, 0.075, g, false);
    for (const fx of [-w / 3, w / 3]) box(0.045, h, 0.09, M.trim, fx, 0, 0.075, g, false);
    // glazing
    const glass = add(new THREE.PlaneGeometry(w, h), M.glass, 0, 0, 0.0, g, false, false);
    glass.renderOrder = 3;
    windowGlass.push(glass);
    // warm interior glow card, very subtle
    add(new THREE.PlaneGeometry(w * 0.94, h * 0.94), M.glassWarm, 0, 0, -0.05, g, false, false);
    // frost creeping in from the edges
    const frost = add(new THREE.PlaneGeometry(w, h), M.frost, 0, 0, 0.04, g, false, false);
    frost.renderOrder = 4;
    // Recessed jamb returns close the real wall opening.
    for(const side of [-1,1])box(.035,h,.30,M.trim,side*(w/2+.018),0,-.045,g);
    // outside sill + snow
    box(w + 0.34, 0.1, 0.36, M.trim, 0, -h / 2 - 0.1, 0.14, g);
    for (let i = 0; i < 3; i++) {
      snowBlob(-w * 0.34 + i * w * 0.34, -h / 2 - 0.02, 0.17,
        0.1 + w * 0.08, 0.035, 0.13, g);
    }
    // interior curtains
    if (curtains) {
      const cw = w * 0.27;
      for (const s of [-1, 1]) {
        const c = curtain(cw, h * 1.18, s === -1 ? M.fabricRust : M.fabricCream);
        c.position.set(s * (w / 2 - cw * 0.25), 0.03, -0.2);
        g.add(c);
      }
      // simple rod
      const rod = add(new THREE.CylinderGeometry(0.022, 0.022, w + 0.48, 7), M.iron, 0, h / 2 + 0.17, -0.22, g, false);
      rod.rotation.z = Math.PI / 2;
    }
    // warm spray on the snow / deck outside
    if (lightPool) {
      const world = new THREE.Vector3();
      g.getWorldPosition(world);
      const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 1.9, h * 2.6),
        new THREE.MeshBasicMaterial({
          map: tex.lightPool, color: 0xffb66b, transparent: true,
          opacity: 0.30, blending: THREE.AdditiveBlending, depthWrite: false
        })
      );
      pool.castShadow = false;
      pool.receiveShadow = false;
      cabin.add(pool);
      pool.position.set(world.x+Math.sin(rotY)*1.7,0,world.z+Math.cos(rotY)*1.7);
      pool.position.y=rotY===0?.574:terrainHeight(pool.position.x,pool.position.z)+.020;
      pool.rotation.x = -Math.PI / 2;
      pool.rotation.z = rotY;
      pool.renderOrder = 1;
      lightPools.push(pool);
    }
    return g;
  }

  makeWindow({ x: -3.55, y: 2.02, z: 3.46, rotY: 0, w: 0.92, h: 1.23, lightPool: true });
  makeWindow({ x: 2.38, y: 2.03, z: 3.46, rotY: 0, w: 2.12, h: 1.23, lightPool: true });
  makeWindow({ x: 2.7, y: 2.03, z: -3.46, rotY: Math.PI, w: 1.48, h: 1.21, lightPool: true });
  makeWindow({ x: -4.68, y: 2.03, z: 0.8, rotY: -Math.PI / 2, w: 1.18, h: 1.21, lightPool: false });
  makeWindow({ x: 4.68, y: 2.03, z: -1.6, rotY: Math.PI / 2, w: 1.2, h: 1.21, lightPool: false });

  /* ================================================================ */
  /*  PORCH                                                           */
  /* ================================================================ */
  for (let i = 0; i < 17; i++) {
    box(0.41, 0.075, 2.45, M.floor, -3.5 + i * 0.435, 0.52, 4.78);
  }
  box(7.4, 0.2, 2.35, M.trim, 0, 0.39, 4.78, cabin, true);
  // supports under deck
  for (const x of [-3.2, 0, 3.2]) cyl(0.1, 0.12, 0.4, 7, M.stone, x, 0.2, 5.7, cabin, false);
  // steps
  for (let i = 0; i < 3; i++) {
    box(2.85, 0.14, 0.55, M.floor, 0, 0.36 - i * 0.13, 6.15 + i * 0.45);
  }
  snowBlob(-1.2, 0.44, 6.35, 0.7, 0.04, 0.4);
  // porch posts
  for (const x of [-3.5, 3.5]) {
    box(0.2, 2.72, 0.2, M.trim, x, 1.85, 5.72);
    const brace = box(0.12, 0.9, 0.12, M.trim, x, 2.94, 5.35, cabin, false);
    brace.rotation.x = -0.7;
  }
  box(7.3, 0.2, 0.22, M.trim, 0, 3.15, 5.74);
  // side railings
  for (const side of [-1, 1]) {
    const x = side * 3.52;
    box(0.12, 0.12, 1.9, M.trim, x, 1.06, 4.85);
    for (let i = 0; i < 7; i++) {
      box(0.07, 0.55, 0.07, M.trim, x, 0.78, 3.98 + i * 0.27, cabin, false);
    }
    for (const z of [3.95, 5.65]) box(0.14, 1.0, 0.14, M.trim, x, 0.78, z);
  }
  // porch roof (lean-to)
  const porchAngle = Math.atan2(0.48, 2.4);
  const porchRoof = new THREE.Group();
  porchRoof.position.set(0, 3.36, 4.78);
  porchRoof.rotation.x = porchAngle;
  cabin.add(porchRoof);
  box(7.95, 0.13, 2.58, M.roof, 0, 0, 0, porchRoof);
  add(new RoundedBoxGeometry(8.05, 0.17, 2.68, 3, 0.07), M.snow, 0, 0.14, 0, porchRoof, true, true);
  for (let i = 0; i < 5; i++) {
    const b = add(new THREE.SphereGeometry(0.22 + rnd() * 0.2, 8, 5), M.snow,
      -3.4 + i * 1.6 + (rnd() - 0.5) * 0.3, 0.22, 1.2, porchRoof, false, true);
    b.scale.set(1.35, 0.16, 0.8);
  }
  // porch eave icicles
  {
    const geo = new THREE.ConeGeometry(0.035, 1, 5, 1);
    geo.rotateX(Math.PI); geo.translate(0, -0.5, 0);
    const inst = new THREE.InstancedMesh(geo, M.ice, 22);
    const d = new THREE.Object3D();
    for (let i = 0; i < 22; i++) {
      d.position.set(-3.8 + (i / 21) * 7.6, 3.02, 6.01);
      d.scale.set(0.7, 0.18 + rnd() * 0.55, 0.7);
      d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
    }
    inst.castShadow = true; cabin.add(inst);
  }

  /* ================================================================ */
  /*  CHIMNEY                                                         */
  /* ================================================================ */
  const chimneyX = -0.92, chimneyZ = -4.25;
  box(1.55, 1.1, 1.45, M.stone, chimneyX, 0.55, chimneyZ);
  box(1.42, 2.2, 1.34, M.stone, chimneyX, 2.15, chimneyZ);
  box(1.3, 1.7, 1.24, M.stone, chimneyX, 4.0, chimneyZ);
  box(1.2, 5.6, 1.16, M.stone, chimneyX, 7.4, chimneyZ);
  // ledges & snow shelves
  for (const [y, s] of [[1.5, 1.56], [3.2, 1.42], [4.9, 1.3], [6.4, 1.24], [7.55, 1.18]]) {
    box(s, 0.11, s, M.stone, chimneyX, y, chimneyZ, cabin, true);
    snowBlob(chimneyX, y + 0.07, chimneyZ, s * 0.44, 0.045, s * 0.4);
  }
  box(1.4, 0.13, 1.34, M.stone, chimneyX, 10.25, chimneyZ);
  box(1.18, 0.08, 1.18, M.iron, chimneyX, 10.32, chimneyZ);
  // a simple black stovepipe and rain cap
  cyl(0.36, 0.42, 1.0, 12, M.iron, chimneyX, 10.84, chimneyZ, cabin, true);
  cyl(0.58, 0.58, 0.075, 14, M.iron, chimneyX, 11.38, chimneyZ, cabin, false);
  cyl(0.12, 0.16, 0.2, 8, M.iron, chimneyX, 11.5, chimneyZ, cabin, false);
  snowBlob(chimneyX, 11.43, chimneyZ, 0.4, 0.045, 0.4);
  const smokeOrigin = new THREE.Vector3(chimneyX + 0.02, 11.56, chimneyZ + 0.02);
  // soot stain
  const soot = add(new THREE.CircleGeometry(0.55, 16), new THREE.MeshStandardMaterial({
    color: 0x151515, transparent: true, opacity: 0.3, roughness: 1, depthWrite: false
  }), chimneyX, 11.42, chimneyZ + 0.62, cabin, false, false);
  soot.rotation.x = -Math.PI / 2;

  /* ================================================================ */
  /*  FIREPLACE                                                       */
  /* ================================================================ */
  const fireX = -0.92, fireZ = -3.17;
  // hearth
  box(2.65, 0.12, 0.82, M.stone, fireX, 0.63, -2.84);
  // surround pillars and lintel
  box(0.46, 1.55, 0.55, M.stone, fireX - 1.05, 1.33, -3.15);
  box(0.46, 1.55, 0.55, M.stone, fireX + 1.05, 1.33, -3.15);
  box(2.55, 0.4, 0.55, M.stone, fireX, 2.25, -3.15);
  box(2.2, 1.10, 0.42, M.stone, fireX, 2.70, -3.18);
  // chimney breast to the roof
  box(1.95, .14, 0.4, M.stone, fireX, 3.20, -3.18);
  // black firebox
  box(1.64,1.20,.10,M.black,fireX,1.26,-3.89,cabin,false);
  box(.09,1.20,.80,M.black,fireX-.82,1.26,-3.47,cabin,false);
  box(.09,1.20,.80,M.black,fireX+.82,1.26,-3.47,cabin,false);
  box(1.64,.09,.80,M.black,fireX,1.90,-3.47,cabin,false);
  box(.74,.50,.70,M.black,fireX,2.08,-3.87,cabin,false);
  box(1.64, 0.12, 1.12, M.black, fireX, 0.68, -3.28, cabin, false);
  // mantel
  box(2.9, 0.16, 0.5, M.trim, fireX, 2.05, -2.96);
  // fire tools & basket
  cyl(0.3, 0.25, 0.45, 10, M.iron, fireX + 1.55, 0.8, -2.82);
  for (let i = 0; i < 5; i++) {
    const log = cyl(0.055, 0.065, 0.8, 6, M.bark, fireX + 1.55 + (rnd() - 0.5) * 0.2, 1.08 + i * 0.03, -2.82 + (rnd() - 0.5) * 0.2, cabin, false);
    log.rotation.z = Math.PI / 2; log.rotation.y = rnd() * 0.6;
  }
  // fire logs
  for (let i = 0; i < 4; i++) {
    const log = cyl(0.085, 0.1, 1.08, 8, new THREE.MeshStandardMaterial({
      color: 0x2b1c13, roughness: 0.95, emissive: 0x3b0e00, emissiveIntensity: 0.6
    }), fireX + (rnd() - 0.5) * 0.2, 0.8 + (i % 2) * 0.12, -2.92 + (rnd() - 0.5) * 0.16, cabin, false);
    log.rotation.z = Math.PI / 2 + (rnd() - 0.5) * 0.18;
    log.rotation.y = (rnd() - 0.5) * 0.6;
  }
  for (let i = 0; i < 16; i++) {
    const e = add(new THREE.DodecahedronGeometry(0.035 + rnd() * 0.04, 0), M.ember,
      fireX + (rnd() - 0.5) * 1.2, 0.68 + rnd() * 0.08, -3.0 + (rnd() - 0.5) * 0.35, cabin, false);
  }
  // procedural flame planes
  const fireMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv; uniform float uTime;
      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
      }
      float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.02; a*=0.5; } return v; }
      void main(){
        vec2 uv=vUv; float t=uTime;
        float x=uv.x-0.5;
        float n=fbm(vec2(uv.x*3.2, uv.y*3.4 - t*1.5));
        float sway=sin(uv.y*6.5+t*2.7+n*4.0)*0.13*uv.y;
        float width=(0.32-uv.y*0.17)*(0.85+0.2*sin(t*2.2));
        float body=1.0-smoothstep(width*0.12,width,abs(x+sway));
        body*=smoothstep(0.0,0.09,uv.y);
        body*=1.0-smoothstep(0.58,0.98,uv.y);
        float flame=body*(0.4+n*1.2);
        flame*=smoothstep(0.16,0.7,flame);
        vec3 col=mix(vec3(1.0,0.12,0.01),vec3(1.0,0.48,0.05),smoothstep(0.08,0.5,flame));
        col=mix(col,vec3(1.0,0.9,0.6),smoothstep(0.55,0.92,flame));
        float a=flame*0.68;
        a*=smoothstep(0.0,0.07,uv.y);
        if(a<0.015) discard;
        gl_FragColor=vec4(col*0.88,a);
      }
    `
  });
  const flameGroup = new THREE.Group();
  flameGroup.position.set(fireX, 1.22, -2.93);
  cabin.add(flameGroup);
  for (const ry of [-0.75, 0, 0.75]) {
    const p = add(new THREE.PlaneGeometry(1.25, 1.15), fireMat, 0, 0, 0, flameGroup, false, false);
    p.rotation.y = ry;
    p.renderOrder = 6;
  }
  const fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glowWarm, color: 0xff7b32, transparent: true, opacity: 0.42,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  fireGlow.position.set(fireX, 1.05, -2.78);
  fireGlow.scale.set(1.9, 1.35, 1);
  cabin.add(fireGlow);
  // embers / sparks
  const sparkCount = 42;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkSeed = [];
  for (let i = 0; i < sparkCount; i++) {
    sparkSeed.push({ x: fireX + (rnd() - 0.5) * 0.8, y: 0.9 + rnd() * 1.4, z: -2.9 + (rnd() - 0.5) * 0.3, p: rnd() * 10, s: 0.3 + rnd() * 0.5 });
    sparkPos[i * 3] = sparkSeed[i].x; sparkPos[i * 3 + 1] = sparkSeed[i].y; sparkPos[i * 3 + 2] = sparkSeed[i].z;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    color: 0xffa040, size: 0.035, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  cabin.add(sparks);
  const fireLight = new THREE.PointLight(0xff8a3a, 6, 8, 2);
  fireLight.position.set(fireX, 1.25, -2.55);
  fireLight.castShadow = false;
  cabin.add(fireLight);
  // A single shadow-casting spot gives crisp, believable firelight shadows
  // without the cost of six point-light shadow faces.
  const fireSpot = new THREE.SpotLight(0xff9a55, 8, 10, 1.12, 0.9, 2);
  fireSpot.position.set(fireX, 1.45, -2.82);
  fireSpot.target.position.set(fireX, 0.9, 2.2);
  fireSpot.castShadow = true;
  fireSpot.shadow.mapSize.set(1024, 1024);
  fireSpot.shadow.bias = -0.0025;
  fireSpot.shadow.normalBias = 0.02;
  fireSpot.shadow.camera.near = 0.3;
  fireSpot.shadow.camera.far = 12;
  cabin.add(fireSpot, fireSpot.target);
  // warm wall glow
  add(new THREE.PlaneGeometry(2.5, 1.7), new THREE.MeshBasicMaterial({
    color: 0xff7a34, transparent: true, opacity: 0.08,
    blending: THREE.AdditiveBlending, depthWrite: false
  }), fireX, 1.4, -2.91, cabin, false, false);

  // mantel decor: garland, candles, stockings
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    const x = fireX - 1.28 + t * 2.56;
    const y = 2.16 + Math.sin(t * Math.PI * 4) * 0.04;
    const sprig = add(new THREE.ConeGeometry(0.045, 0.2 + rnd() * 0.1, 4), i % 3 ? M.leaf : M.leafLight,
      x, y, -2.75 + Math.sin(t * 9) * 0.06, cabin, false);
    sprig.rotation.z = (rnd() - 0.5) * 1.2;
    sprig.rotation.x = 0.8;
    if (i % 4 === 0) {
      add(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshStandardMaterial({ color: 0xa31e24, roughness: 0.5 }),
        x, y + 0.03, -2.72, cabin, false);
    }
    if (i % 3 === 0) {
      const b = add(new THREE.SphereGeometry(0.022, 6, 4), M.bulbWarm, x, y - 0.04, -2.69, cabin, false, false);
    }
  }
  for (let i = 0; i < 3; i++) {
    const x = fireX - 0.72 + i * 0.72;
    cyl(0.055, 0.07, 0.22 + rnd() * 0.12, 8, M.candle, x, 2.26, -2.9, cabin, false);
    const fl = add(new THREE.ConeGeometry(0.026, 0.11, 6), M.flame, x, 2.42, -2.9, cabin, false, false);
    flames.push(fl);
  }
  // stockings
  const stockingCols = [0x7a2026, 0xd1b998, 0x3e5748];
  for (let i = 0; i < 3; i++) {
    const x = fireX - 0.7 + i * 0.7;
    const mat = new THREE.MeshStandardMaterial({ color: stockingCols[i], roughness: 0.9 });
    const leg = rbox(0.24, 0.5, 0.1, 0.05, mat, x, 1.77, -2.77, cabin, false);
    leg.rotation.z = 0.05;
    const toe = add(new THREE.SphereGeometry(0.15, 9, 7), mat, x + 0.09, 1.53, -2.77, cabin, false);
    toe.scale.set(1.15, 0.7, 0.7);
    box(0.24, 0.1, 0.12, M.fabricCream, x, 2.0, -2.77, cabin, false);
  }
  // wreath above mantel
  {
    const wr = add(new THREE.TorusGeometry(0.47, 0.085, 7, 26), M.leaf, fireX, 2.86, -2.92, cabin, false);
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      const sp = add(new THREE.ConeGeometry(0.05, 0.22, 4), i % 2 ? M.leafLight : M.leaf,
        fireX + Math.cos(a) * 0.48, 2.86 + Math.sin(a) * 0.48, -2.88, cabin, false);
      sp.rotation.z = -a + Math.PI / 2;
      if (i % 5 === 0) add(new THREE.SphereGeometry(0.035, 5, 4), new THREE.MeshStandardMaterial({ color: 0x9e1d23 }),
        fireX + Math.cos(a) * 0.52, 2.86 + Math.sin(a) * 0.52, -2.86, cabin, false);
    }
  }

  /* ================================================================ */
  /*  INTERIOR — rugs, sofa, chairs, table, kitchen, shelves           */
  /* ================================================================ */
  // warm interior plank floor accent (boards)
  const rug = add(new THREE.PlaneGeometry(3.7, 2.9), M.woolRug, -0.75, 0.652, 0.1, cabin, false, true);
  rug.rotation.x = -Math.PI / 2;
  // A softly irregular woven hearth mat, with visible fibres and a fringed edge.
  const furCanvas=document.createElement('canvas');furCanvas.width=1024;furCanvas.height=768;
  const fc=furCanvas.getContext('2d');fc.clearRect(0,0,1024,768);
  fc.beginPath();
  for(let i=0;i<=160;i++){const a=i/160*Math.PI*2,r=1+.025*Math.sin(a*13)+.018*Math.sin(a*21+1);const x=512+Math.cos(a)*445*r,y=384+Math.sin(a)*292*r;i?fc.lineTo(x,y):fc.moveTo(x,y);}fc.closePath();
  fc.fillStyle='#b9a58b';fc.fill();fc.save();fc.clip();
  for(let i=0;i<12000;i++){
    const x=rnd()*1024,y=rnd()*768,a=-.7+rnd()*.7;
    fc.strokeStyle=['#cbbb9f','#dcccb0','#ac9679','#e2d1b8'][i%4];fc.lineWidth=.5+rnd()*1.5;
    fc.beginPath();fc.moveTo(x,y);fc.quadraticCurveTo(x+3,y-3,x+Math.cos(a)*(6+rnd()*10),y+Math.sin(a)*(6+rnd()*10));fc.stroke();
  }
  fc.restore();
  for(let i=0;i<800;i++){const a=i/800*Math.PI*2,r=1+.025*Math.sin(a*13)+.018*Math.sin(a*21+1),x=512+Math.cos(a)*445*r,y=384+Math.sin(a)*292*r;
    fc.strokeStyle=i%2?'#cdbb9f':'#ab967c';fc.lineWidth=1.1;fc.beginPath();fc.moveTo(x,y);fc.lineTo(x+Math.cos(a)*(6+rnd()*11),y+Math.sin(a)*(6+rnd()*11));fc.stroke();}
  const furMap=new THREE.CanvasTexture(furCanvas);furMap.colorSpace=THREE.SRGBColorSpace;furMap.anisotropy=8;
  const sheep=add(new THREE.PlaneGeometry(1.9,1.36),new THREE.MeshStandardMaterial({map:furMap,alphaTest:.25,transparent:true,roughness:1,bumpMap:furMap,bumpScale:.012,color:0xc5b18f}),-.2,.667,-2.16,cabin,false,true);
  sheep.rotation.x=-Math.PI/2;

  function leg(x, z, h = 0.3, parent = cabin) {
    return cyl(0.045, 0.055, h, 7, M.trim, x, h / 2, z, parent);
  }

  function makeSofa(x, z, rotY) {
    const g = new THREE.Group();
    g.position.set(x, 0.64, z); g.rotation.y = rotY; cabin.add(g);
    rbox(2.55, 0.4, 1.0, 0.1, M.fabricGreen, 0, 0.24, 0, g);
    const back = rbox(2.55, 1.0, 0.26, 0.09, M.fabricGreen, 0, 0.78, -0.44, g);
    back.rotation.x = -0.1;
    rbox(0.26, 0.62, 0.94, 0.08, M.fabricGreen, -1.18, 0.52, 0, g);
    rbox(0.26, 0.62, 0.94, 0.08, M.fabricGreen, 1.18, 0.52, 0, g);
    for (const sx of [-0.63, 0.63]) rbox(1.14, 0.18, 0.86, 0.07, M.fabricCream, sx, 0.49, 0.03, g);
    for (const px of [-0.78, 0.78]) {
      const p = rbox(0.44, 0.44, 0.16, 0.07, px < 0 ? M.fabricRust : M.fabricCream, px, 0.7, -0.28, g);
      p.rotation.z = px < 0 ? 0.15 : -0.12; p.rotation.x = -0.15;
    }
    // throw
    const throwM = rbox(0.95, 0.06, 1.15, 0.03, M.fabricRust, 0.45, 0.55, 0.18, g);
    throwM.rotation.y = 0.08; throwM.rotation.z = 0.03;
    for (const [lx, lz] of [[-1.12, 0.36], [1.12, 0.36], [-1.12, -0.36], [1.12, -0.36]]) {
      leg(lx, lz, 0.18, g).position.y = 0.09;
    }
    return g;
  }
  makeSofa(0.65, 1.35, Math.PI);

  function makeArmchair(x, z, rotY, fabric) {
    const g = new THREE.Group();
    g.position.set(x, 0.64, z); g.rotation.y = rotY; cabin.add(g);
    rbox(1.15, 0.36, 0.95, 0.12, fabric, 0, 0.3, 0, g);
    rbox(1.15, 0.9, 0.24, 0.1, fabric, 0, 0.78, -0.4, g);
    rbox(0.23, 0.55, 0.9, 0.08, fabric, -0.57, 0.53, 0, g);
    rbox(0.23, 0.55, 0.9, 0.08, fabric, 0.57, 0.53, 0, g);
    rbox(0.88, 0.16, 0.78, 0.07, M.fabricCream, 0, 0.53, 0.02, g);
    const cushion = rbox(0.52, 0.52, 0.14, 0.07, M.fabricRust, 0, 0.72, -0.25, g);
    cushion.rotation.x = -0.12;
    for (const [lx, lz] of [[-0.48, 0.34], [0.48, 0.34], [-0.48, -0.34], [0.48, -0.34]]) {
      leg(lx, lz, 0.23, g).position.y = 0.16;
    }
    return g;
  }
  // Left-wall aisle is now a full-width staircase; chairs moved to the loft.
  // Keep the right aisle clear for approaching the birthday table.

  // coffee table
  {
    const g = new THREE.Group();
    g.position.set(-0.85, 0.64, 0.0); cabin.add(g);
    rbox(1.6, 0.1, 0.9, 0.04, M.trim, 0, 0.45, 0, g);
    for (const [x, z] of [[-0.67, 0.36], [0.67, 0.36], [-0.67, -0.36], [0.67, -0.36]]) {
      leg(x, z, 0.45, g).position.y = 0.22;
    }
    box(1.3, 0.04, 0.6, M.trim, 0, 0.16, 0, g);
    // mug
    const mug = cyl(0.052, 0.048, 0.11, 10, M.ceramic, 0.3, 0.56, 0.12, g, false);
    const handle = add(new THREE.TorusGeometry(0.036, 0.01, 6, 12), M.ceramic, 0.35, 0.56, 0.12, g, false);
    // books
    for (let i = 0; i < 3; i++) {
      box(0.3 - i * 0.02, 0.04, 0.22, M.book([0x6f3c30, 0x394b45, 0x9b8057][i]), -0.32, 0.525 + i * 0.042, -0.1, g, false).rotation.y = 0.1 * i;
    }
    // candle jar
    cyl(0.05, 0.055, 0.1, 10, M.ceramicGreen, -0.54, 0.555, 0.16, g, false);
    const fl = add(new THREE.ConeGeometry(0.014, 0.055, 5), M.flame, -0.54, 0.635, 0.16, g, false, false);
    flames.push(fl);
    // tiny bowl
    const bowl = add(new THREE.SphereGeometry(0.09, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.ceramic, 0.12, 0.535, -0.18, g, false);
    bowl.scale.y = 0.4;
  }

  // dining table & chairs
  function makeChair(x, z, rotY, fabric = M.fabricCream) {
    const g = new THREE.Group();
    g.position.set(x, 0.64, z); g.rotation.y = rotY; cabin.add(g);
    rbox(0.52, 0.08, 0.5, 0.03, M.trim, 0, 0.5, 0, g);
    rbox(0.52, 0.6, 0.08, 0.03, M.trim, 0, 0.78, -0.22, g);
    rbox(0.44, 0.1, 0.4, 0.04, fabric, 0, 0.56, 0.02, g);
    for (const [lx, lz] of [[-0.2, 0.2], [0.2, 0.2], [-0.2, -0.2], [0.2, -0.2]]) {
      cyl(0.022, 0.028, 0.5, 6, M.trim, lx, 0.25, lz, g, false);
    }
    return g;
  }
  {
    const tx = 2.85, tz = -1.55;
    const top = cyl(0.72, 0.72, 0.09, 24, M.trim, tx, 1.05, tz, cabin, true);
    cyl(0.16, 0.28, 0.45, 12, M.trim, tx, 0.8, tz);
    cyl(0.38, 0.45, 0.08, 16, M.trim, tx, 0.61, tz);
    makeChair(tx - 0.95, tz + 0.25, Math.PI / 2 + 0.2);
    makeChair(tx + 0.85, tz - 0.55, -Math.PI / 2 - 0.5);
    makeChair(tx + 0.25, tz + 1.0, Math.PI - 0.1);
    // table setting
    for (const [px, pz] of [[-0.32, 0.2], [0.34, -0.2]]) {
      cyl(0.16, 0.16, 0.018, 18, M.ceramic, tx + px, 1.11, tz + pz, cabin, false);
      cyl(0.11, 0.11, 0.018, 18, new THREE.MeshStandardMaterial({ color: 0x6f4631, roughness: 0.7 }), tx + px, 1.12, tz + pz, cabin, false);
      cyl(0.06, 0.055, 0.12, 10, M.ceramic, tx + px + 0.28, 1.16, tz + pz - 0.1, cabin, false);
    }
    // vase with dried branches
    cyl(0.08, 0.11, 0.25, 12, M.ceramicGreen, tx, 1.23, tz, cabin, false);
    for (let i = 0; i < 7; i++) {
      const br = cyl(0.006, 0.009, 0.55 + rnd() * 0.3, 4, M.bark, tx + (rnd() - 0.5) * 0.1, 1.6, tz + (rnd() - 0.5) * 0.1, cabin, false);
      br.rotation.z = (rnd() - 0.5) * 0.6; br.rotation.x = (rnd() - 0.5) * 0.5;
    }
    candles.push(cyl(0.05, 0.06, 0.18, 8, M.candle, tx + 0.35, 1.19, tz + 0.35, cabin, false));
    const fl = add(new THREE.ConeGeometry(0.024, 0.09, 5), M.flame, tx + 0.35, 1.32, tz + 0.35, cabin, false, false);
    flames.push(fl);
  }

  // kitchen counter along right wall
  {
    const kx = 4.12, kz = 2.05;
    box(0.7, 0.85, 1.85, M.trim, kx, 1.05, kz);
    box(0.78, 0.08, 1.95, M.stone, kx, 1.51, kz);
    // cabinet doors
    for (let i = 0; i < 3; i++) {
      box(0.03, 0.62, 0.5, M.logDark, kx - 0.37, 1.05, kz - 0.58 + i * 0.58, cabin, false);
      const knob = add(new THREE.SphereGeometry(0.022, 6, 4), M.brass, kx - 0.385, 1.14, kz - 0.58 + i * 0.58, cabin, false);
    }
    // sink
    box(0.45, 0.035, 0.55, M.iron, kx, 1.555, kz + 0.3, cabin, false);
    const basin = box(0.38, 0.1, 0.46, new THREE.MeshStandardMaterial({ color: 0x76797a, roughness: 0.35, metalness: 0.7 }), kx, 1.515, kz + 0.3, cabin, false);
    // faucet
    const f = add(new THREE.TorusGeometry(0.12, 0.018, 6, 12, Math.PI), M.brass, kx + 0.1, 1.65, kz + 0.3, cabin, false);
    f.rotation.y = Math.PI / 2;
    cyl(0.018, 0.018, 0.3, 6, M.brass, kx + 0.19, 1.64, kz + 0.3, cabin, false);
    // cutting board + jars
    rbox(0.42, 0.035, 0.3, 0.02, M.log, kx, 1.57, kz - 0.72, cabin, false);
    for (let i = 0; i < 3; i++) {
      cyl(0.055, 0.065, 0.16, 8, i === 1 ? M.ceramicGreen : M.ceramic, kx - 0.02, 1.63, kz - 1.0 + i * 0.16, cabin, false);
      cyl(0.06, 0.06, 0.02, 8, M.brass, kx - 0.02, 1.72, kz - 1.0 + i * 0.16, cabin, false);
    }
    // open shelf & mugs
    box(0.28, 0.05, 1.6, M.trim, kx - 0.2, 2.28, kz, cabin, true);
    for (let i = 0; i < 4; i++) {
      const mx = kx - 0.22, mz = kz - 0.62 + i * 0.4;
      cyl(0.07, 0.065, 0.14, 9, i % 2 ? M.ceramicGreen : M.ceramic, mx, 2.38, mz, cabin, false);
      add(new THREE.TorusGeometry(0.05, 0.012, 5, 10), M.ceramic, mx - 0.07, 2.38, mz, cabin, false);
    }
    // copper pans on the wall
    for (let i = 0; i < 3; i++) {
      const pan = cyl(0.16, 0.16, 0.03, 16, M.copper, 4.48, 2.3, kz - 0.55 + i * 0.45, cabin, false);
      pan.rotation.z = Math.PI / 2;
      const handle = box(0.24, 0.025, 0.035, M.iron, 4.3, 2.3, kz - 0.55 + i * 0.45, cabin, false);
    }
  }

  // Former shelf / coat corner is reserved for stair access.
  if (false) {
    const bx = -4.28, bz = 2.22;
    box(0.34, 2.25, 1.5, M.trim, bx, 1.72, bz);
    box(0.3, 2.1, 1.35, M.black, bx + 0.36, 1.72, bz);
    for (let s = 0; s < 4; s++) {
      box(0.32, 0.055, 1.36, M.trim, bx + 0.18, 0.9 + s * 0.48, bz, cabin, false);
      let bx2 = bz - 0.6;
      while (bx2 < bz + 0.6) {
        const bw = 0.045 + rnd() * 0.07;
        const bh = 0.24 + rnd() * 0.17;
        const col = [0x6f3c30, 0x394b45, 0x9b8057, 0x303c54, 0x7d6c50, 0x55393d][Math.floor(rnd() * 6)];
        box(bw, bh, 0.24, M.book(col), bx + 0.23, 0.95 + s * 0.48 + bh / 2, bx2 + bw / 2, cabin, false).rotation.x = (rnd() - 0.5) * 0.08;
        bx2 += bw + 0.008;
      }
    }
    // little plant on top
    cyl(0.1, 0.08, 0.14, 8, M.ceramicGreen, bx + 0.2, 2.94, bz + 0.4, cabin, false);
    for (let i = 0; i < 6; i++) {
      const l = add(new THREE.ConeGeometry(0.09, 0.25, 4), M.leaf, bx + 0.2 + (rnd() - 0.5) * 0.1, 3.08, bz + 0.4 + (rnd() - 0.5) * 0.1, cabin, false);
      l.rotation.z = (rnd() - 0.5) * 1.2; l.rotation.x = (rnd() - 0.5) * 1.2;
    }
    add(new THREE.SphereGeometry(0.07, 7, 5), M.brass, bx + 0.2, 3.0, bz - 0.45, cabin, false);
  }

  // Coat rack removed from the stair entry.
  if (false) {
    const cx = -3.85, cz = 3.0;
    cyl(0.055, 0.07, 1.9, 7, M.trim, cx, 1.5, cz);
    for (let i = 0; i < 4; i++) {
      const peg = cyl(0.025, 0.025, 0.22, 5, M.brass, cx, 2.1, cz, cabin, false);
      peg.rotation.z = Math.PI / 2; peg.rotation.y = i * Math.PI / 2;
    }
    // coat
    const coat = rbox(0.5, 1.15, 0.22, 0.06, M.fabricRust, cx + 0.25, 1.55, cz - 0.05, cabin, true);
    coat.rotation.z = 0.05;
    // scarf
    box(0.14, 0.9, 0.06, M.fabricCream, cx - 0.1, 1.45, cz + 0.05, cabin, false).rotation.z = 0.12;
    // boots
    for (const dx of [-0.18, 0.2]) {
      const boot = rbox(0.16, 0.34, 0.28, 0.05, M.bark, cx + dx, 0.82, cz + 0.35, cabin, false);
      boot.rotation.y = (rnd() - 0.5) * 0.2;
    }
  }

  // sideboard + framed paintings
  {
    box(1.45, 0.85, 0.36, M.trim, 3.0, 1.06, -3.05, cabin, true);
    box(1.5, 0.07, 0.42, M.stone, 3.0, 1.52, -3.05, cabin, false);
    for (let i = 0; i < 2; i++) {
      box(0.6, 0.6, 0.03, M.logDark, 2.66 + i * 0.72, 1.07, -2.85, cabin, false);
      add(new THREE.SphereGeometry(0.02, 5, 4), M.brass, 2.66 + i * 0.72 + 0.22, 1.1, -2.83, cabin, false);
    }
    // lamp
    cyl(0.05, 0.08, 0.35, 8, M.brass, 3.15, 1.75, -3.0, cabin, false);
    const shade = add(new THREE.CylinderGeometry(0.14, 0.24, 0.28, 14, 1, true), M.fabricCream, 3.15, 2.02, -3.0, cabin, false, false);
    const bulb = add(new THREE.SphereGeometry(0.05, 8, 6), M.bulb, 3.15, 1.96, -3.0, cabin, false, false);
    // framed art on side walls
    const art = (x, y, z, rotY, mat, w = 1.0, h = 0.72) => {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; cabin.add(g);
      box(w + 0.13, h + 0.13, 0.06, M.trim, 0, 0, 0, g, false);
      add(new THREE.PlaneGeometry(w, h), mat, 0, 0, 0.045, g, false);
      return g;
    };
    art(4.40, 2.58, 1.35, -Math.PI / 2, M.paintingA, 0.9, 0.65);
    art(-4.40, 2.55, -1.0, Math.PI / 2, M.paintingB, 0.9, 0.65);
    // small clock on the right wall
    const clock = add(new THREE.CylinderGeometry(0.15, 0.15, 0.045, 24), M.trim, 4.40, 2.56, 0.2, cabin, false);
    clock.rotation.z = Math.PI / 2;
    const face = add(new THREE.CircleGeometry(0.126, 24), new THREE.MeshStandardMaterial({ color: 0xe8ddc3, roughness: 0.8 }),
      4.37, 2.56, 0.2, cabin, false);
    face.rotation.y = -Math.PI / 2;
    for (let i = 0; i < 2; i++) {
      const hand = box(0.008, i ? 0.055 : 0.085, 0.006, M.iron, 4.36, 2.56 + (i ? 0.02 : 0.03), 0.2, cabin, false);
      hand.rotation.y = Math.PI / 2;
      hand.rotation.x = i ? 0.6 : -0.2;
      clockHands.push(hand);
    }
  }

  // A winter birthday bouquet: soft blush petals, eucalyptus and a glazed vase.
  {
    const px = 3.9, pz = 2.95;
    const vase=new THREE.LatheGeometry([new THREE.Vector2(.16,0),new THREE.Vector2(.23,.04),new THREE.Vector2(.26,.3),new THREE.Vector2(.18,.53),new THREE.Vector2(.14,.61)],32);
    add(vase,M.ceramic,px,.66,pz,cabin,true);
    const petalMats=[0xeabebf,0xf1d9ce,0xbc8490].map(color=>new THREE.MeshPhysicalMaterial({color,roughness:.65,side:THREE.DoubleSide,sheen:.35,sheenColor:new THREE.Color(0xffe5df),sheenRoughness:.8}));
    for(let i=0;i<11;i++){
      const a=i*2.399,r=.14+Math.sqrt(i/11)*.3;
      const fx=px+Math.cos(a)*r,fz=pz+Math.sin(a)*r,fy=1.34+rnd()*.17;
      const stem=add(new THREE.CylinderGeometry(.009,.014,fy-1.1,7),M.leaf,fx,(fy+1.1)/2,fz,cabin,false);stem.rotation.z=Math.cos(a)*.12;
      for(let j=0;j<3;j++){
        const leaf=add(new THREE.SphereGeometry(1,10,6),M.leafLight,fx+Math.sin(j*2.1)*.10,1.25+j*.13,fz+Math.cos(j*2.1)*.10,cabin,false);leaf.scale.set(.055,.012,.12);leaf.rotation.z=j*.7;
      }
      for(let layer=0;layer<3;layer++)for(let j=0;j<5;j++){
        const angle=j*Math.PI*.4+layer*.6,rr=.018+layer*.027;
        const petal=add(new THREE.SphereGeometry(1,14,9),petalMats[i%3],fx+Math.cos(angle)*rr,fy+layer*.012,fz+Math.sin(angle)*rr,cabin,false);
        petal.scale.set(.045+layer*.014,.018,.065+layer*.018);petal.rotation.set(.35*Math.sin(angle),-angle,.35*Math.cos(angle));
      }
    }
    for (let i = 0; i < 10; i++) {
      const b = add(new THREE.SphereGeometry(0.022, 6, 4), M.bulbWarm, px + (rnd() - 0.5) * 0.7, 1.25 + rnd() * 1.0, pz + (rnd() - 0.5) * 0.3, cabin, false, false);
    }
  }

  /* ================================================================ */
  /*  LIGHT FIXTURES                                                  */
  /* ================================================================ */
  // chandelier from the ridge
  {
    const cx = 0, cy = 2.66, cz = 0.15;
    cyl(0.012, 0.012, .54, 5, M.iron, cx, cy + .27, cz, cabin, false);
    add(new THREE.TorusGeometry(0.55, 0.032, 6, 24), M.iron, cx, cy, cz, cabin, false).rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = cx + Math.cos(a) * 0.55, z = cz + Math.sin(a) * 0.55;
      cyl(0.035, 0.045, 0.2, 7, M.candle, x, cy + 0.12, z, cabin, false);
      const f = add(new THREE.ConeGeometry(0.025, 0.09, 5), M.flame, x, cy + 0.27, z, cabin, false, false);
      flames.push(f);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex.glowWarm, color: 0xffb35f, transparent: true, opacity: 0.4,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      glow.position.set(x, cy + 0.28, z); glow.scale.set(0.5, 0.5, 1); cabin.add(glow);
    }
    const ringLight = new THREE.PointLight(0xffd5ab, 13, 10, 2);
    ringLight.position.set(cx, cy + 0.1, cz);
    cabin.add(ringLight);
  }
  // dining pendant
  {
    cyl(0.015, 0.015, .85, 5, M.iron, 2.85, 2.87, -1.55, cabin, false);
    const shade = add(new THREE.CylinderGeometry(0.18, 0.42, 0.34, 16, 1, true), M.iron, 2.85, 2.45, -1.55, cabin, false, false);
    const bulb = add(new THREE.SphereGeometry(0.08, 10, 8), M.bulb, 2.85, 2.47, -1.55, cabin, false, false);
    const light = new THREE.PointLight(0xffd3af, 5, 6.5, 2);
    light.position.set(2.85, 2.38, -1.55); cabin.add(light);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.glowWarm, color: 0xffb265, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.position.set(2.85, 2.4, -1.55); glow.scale.set(1.1, 1.1, 1); cabin.add(glow);
  }
  // Stair lights replace the floor lamp in this narrow aisle.
  if (false) {
    const lx = -3.75, lz = 1.2;
    cyl(0.035, 0.045, 1.5, 8, M.iron, lx, 1.4, lz, cabin, false);
    cyl(0.18, 0.22, 0.04, 12, M.iron, lx, 0.67, lz, cabin, false);
    const shade = add(new THREE.CylinderGeometry(0.2, 0.32, 0.34, 14, 1, true), M.fabricCream, lx, 2.25, lz, cabin, false, false);
    add(new THREE.SphereGeometry(0.06, 8, 6), M.bulb, lx, 2.17, lz, cabin, false, false);
  }
  // wall sconces beside fireplace
  for (const sx of [-2.35, 0.52]) {
    const bracket = box(0.06, 0.25, 0.18, M.iron, sx, 2.35, -3.18, cabin, false);
    const cup = add(new THREE.CylinderGeometry(0.08, 0.05, 0.12, 8), M.brass, sx, 2.48, -3.18, cabin, false);
    add(new THREE.ConeGeometry(0.04, 0.12, 5), M.flame, sx, 2.58, -3.18, cabin, false, false);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.glowWarm, color: 0xffb060, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    gl.position.set(sx, 2.58, -3.16); gl.scale.set(0.45, 0.45, 1); cabin.add(gl);
  }

  /* ================================================================ */
  /*  EXTERIOR DECOR                                                  */
  /* ================================================================ */
  // hanging lantern by the door
  const lanternPos = new THREE.Vector3(-2.82, 2.72, 4.28);  {
    cyl(0.012, 0.012, 0.55, 5, M.iron, lanternPos.x, lanternPos.y + 0.45, lanternPos.z, cabin, false);
    const lg = new THREE.Group();
    lg.position.copy(lanternPos); cabin.add(lg);
    box(0.3, 0.06, 0.3, M.iron, 0, 0.22, 0, lg);
    box(0.3, 0.06, 0.3, M.iron, 0, -0.22, 0, lg);
    for (const [dx, dz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) {
      box(0.035, 0.48, 0.035, M.iron, dx, 0, dz, lg, false);
    }
    const lanternGlass = add(new THREE.CylinderGeometry(0.13, 0.13, 0.38, 4), new THREE.MeshBasicMaterial({
      color: 0xffbf72, transparent: true, opacity: 0.45, depthWrite: false
    }), 0, 0, 0, lg, false, false);
    lanternGlass.rotation.y = Math.PI / 4;
    const flame = add(new THREE.ConeGeometry(0.045, 0.16, 6), M.flame, 0, -0.07, 0, lg, false, false);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.glowWarm, color: 0xffb564, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.set(1.8, 1.8, 1); glow.position.set(0, 0, 0); lg.add(glow);
    add(new THREE.ConeGeometry(0.22, 0.16, 4), M.iron, 0, 0.32, 0, lg, false);
    const lanternSpot = new THREE.SpotLight(0xffc58f, 14, 8, 0.95, 0.84, 2);
    lanternSpot.position.copy(lanternPos).add(new THREE.Vector3(0, -0.05, 0));
    lanternSpot.target.position.set(-1.45, 1.0, 3.75);
    lanternSpot.castShadow = true;
    lanternSpot.shadow.mapSize.set(1024, 1024);
    lanternSpot.shadow.bias = -0.003;
    lanternSpot.shadow.normalBias = 0.02;
    lanternSpot.shadow.camera.near = 0.2;
    lanternSpot.shadow.camera.far = 12;
    cabin.add(lanternSpot, lanternSpot.target);
    candles.push(flame);
  }
  // warm light spilling out of the open door (the bright doorway card does
  // the visible work; this light is intentionally not added to the scene so
  // it does not cost a shader slot)
  const doorSpillLight = new THREE.PointLight(0xffa456, 0, 7, 2);
  doorSpillLight.position.set(-1.58, 1.5, 2.78);

  // porch string lights
  {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const x = -3.65 + t * 7.3;
      const y = 3.02 - Math.sin(t * Math.PI) * 0.3;
      pts.push(new THREE.Vector3(x, y, 5.83));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = add(new THREE.TubeGeometry(curve, 30, 0.012, 5, false), M.iron, 0, 0, 0, cabin, false);
    for (let i = 0; i <= 15; i++) {
      const t = i / 15;
      const p = curve.getPoint(t);
      const bulb = add(new THREE.SphereGeometry(0.04, 7, 5), M.bulb, p.x, p.y - 0.08, p.z, cabin, false, false);
      stringBulbs.push(bulb);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex.glowWarm, color: 0xffb35e, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      glow.position.set(p.x, p.y - 0.08, p.z); glow.scale.set(0.28, 0.28, 1); cabin.add(glow);
      spritesGlow.push(glow);
    }
  }

  // porch bench and cushion
  {
    const bx = 2.55, bz = 4.55;
    box(1.65, 0.09, 0.5, M.trim, bx, 1.05, bz);
    box(1.65, 0.5, 0.08, M.trim, bx, 1.33, bz + 0.2);
    for (const dx of [-0.68, 0.68]) {
      box(0.09, 0.5, 0.5, M.trim, bx + dx, 0.78, bz);
    }
    rbox(1.45, 0.12, 0.42, 0.04, M.fabricRust, bx, 1.15, bz + 0.02, cabin, true);
    snowBlob(bx + 0.3, 1.14, bz - 0.1, 0.4, 0.035, 0.18);
  }

  // woodpile against the left wall
  {
    const wx = -5.35, wz = 3.2;
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 5 - row; i++) {
        const log = cyl(0.12, 0.13, 1.4, 7, M.bark, wx, 0.72 + row * 0.22, wz - 0.5 + i * 0.25, cabin, true);
        log.rotation.x = Math.PI / 2;
      }
    }
    box(1.5, 0.12, 0.5, M.snow, wx, 1.72, wz, cabin, false);
    // chopping block and axe
    cyl(0.26, 0.3, 0.42, 10, M.bark, -4.55, 0.23, 6.3, cabin, true);
    const handle = box(0.045, 0.75, 0.045, M.trim, -4.55, 0.78, 6.34, cabin, false);
    handle.rotation.z = 0.16;
    const head = box(0.28, 0.1, 0.07, M.iron, -4.47, 1.14, 6.34, cabin, false);
    head.rotation.z = 0.16;
  }

  // little sled on the snowy bank
  {
    const sl = new THREE.Group();
    sl.position.set(5.7, 0.18, 5.6); sl.rotation.y = -0.5; cabin.add(sl);
    for (const dx of [-0.35, 0.35]) {
      const runner = box(0.055, 0.055, 1.55, M.brass, dx, 0.05, 0, sl, false);
      runner.rotation.x = 0.08;
      const curl = add(new THREE.TorusGeometry(0.15, 0.028, 5, 12, Math.PI), M.brass, dx, 0.2, 0.78, sl, false);
      curl.rotation.y = Math.PI / 2;
    }
    for (let i = 0; i < 4; i++) box(0.8, 0.04, 0.12, M.trim, 0, 0.18, -0.5 + i * 0.34, sl, false);
    snowBlob(0, 0.25, 0.1, 0.4, 0.03, 0.5, sl);
  }

  // small path lanterns (removed in favour of the cleaner snow path)

  // snow drifts around the foundation
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const rx = 5.15 + rnd() * 0.85, rz = 3.85 + rnd() * 0.85;
    const x = Math.cos(a) * rx, z = Math.sin(a) * rz;
    const b = snowBlob(x, 0.03, z, 0.55 + rnd() * 0.6, 0.12 + rnd() * 0.14, 0.45 + rnd() * 0.5, cabin, M.snowSoft);
    b.rotation.y = rnd() * Math.PI;
  }

  /* ================================================================ */
  /*  KETTLE STEAM                                                    */
  /* ================================================================ */
  const steamSprites = [];
  for (let i = 0; i < 7; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex.smoke, color: 0xdde8f2, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.NormalBlending
    }));
    sp.position.set(4.0, 1.8, 1.8);
    sp.scale.set(0.25, 0.25, 1);
    cabin.add(sp);
    steamSprites.push({ sp, age: i / 7, phase: rnd() * 6, speed: 0.16 + rnd() * 0.1 });
  }

  contactShadow(cabin,0,.648,1.75,1.60,.68,.20);
  contactShadow(cabin,-.6,.648,.1,.90,.66,.21);
  contactShadow(cabin,2.85,.648,-1.55,.91,.87,.18);
  contactShadow(cabin,3.0,.648,-3.02,.86,.32,.22);
  contactShadow(cabin,-.92,.696,-2.96,1.34,.55,.24);

  /* ================================================================ */
  /*  STATIC-BATCH OPTIMISATION                                       */
  /*  Merge the hundreds of little hand-placed props into one mesh per */
  /*  material. Animated pieces are explicitly excluded.               */
  /* ================================================================ */
  doorPivot.traverse(o => { o.userData.noMerge = true; });
  flameGroup.traverse(o => { o.userData.noMerge = true; });
  doorwayGlow.userData.noMerge = true;
  doorClick.userData.noMerge = true;
  flames.forEach(f => { f.userData.noMerge = true; });
  stringBulbs.forEach(b => { b.userData.noMerge = true; });
  clockHands.forEach(h => { h.userData.noMerge = true; });
  lightPools.forEach(p => { p.userData.noMerge = true; });

  cabin.updateMatrixWorld(true);
  cabin.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const s = o.getWorldScale(new THREE.Vector3());
    const r = o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z);
    if (r < 0.5) o.castShadow = false;
  });

  const animatedMaterials=new Set([fireGlow.material,doorwayGlow.material,...steamSprites.map(o=>o.sp.material)]);
  const sharedMaterials=new Map();
  cabin.traverse(o=>{const m=o.material;if(!m||Array.isArray(m)||m.isShaderMaterial||animatedMaterials.has(m))return;
    const key=[m.type,m.color?.getHex(),m.roughness,m.metalness,m.opacity,m.transparent,m.side,m.depthWrite,m.blending,m.alphaTest,m.emissive?.getHex(),m.emissiveIntensity,m.clearcoat,m.sheen,m.map?.uuid,m.normalMap?.uuid,m.bumpMap?.uuid,m.userData.surfaceUvRepeat].join('|');
    if(sharedMaterials.has(key))o.material=sharedMaterials.get(key);else sharedMaterials.set(key,m);
  });
  (function batchStatics(root) {
    const buckets = new Map();
    const originals = [];
    const isAnimated = (mesh) => {
      let p = mesh;
      while (p) {
        if (p.userData && p.userData.noMerge) return true;
        p = p.parent;
      }
      return false;
    };
    root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
      if (!o.geometry || Array.isArray(o.material)) return;
      if (o.material.transparent || o.material.isShaderMaterial) return;
      if (isAnimated(o)) return;
      if (!o.geometry.attributes || !o.geometry.attributes.position) return;
      const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}|${o.receiveShadow ? 1 : 0}`;
      if (!buckets.has(key)) {
        buckets.set(key, { material: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [] });
      }
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      }
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) {
        const count = g.attributes.position.count;
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
      }
      g.clearGroups();
      buckets.get(key).geos.push(g);
      originals.push(o);
    });
    originals.forEach(o => { if (o.parent) o.parent.remove(o); });
    let mergedCount = 0;
    for (const bucket of buckets.values()) {
      if (bucket.geos.length < 2) {
        // A single mesh is already cheap; put it back by creating a clone in
        // world space (kept simple by rebuilding one mesh from the geometry).
        const g = bucket.geos[0];
        const m = new THREE.Mesh(g, bucket.material);
        m.castShadow = bucket.cast; m.receiveShadow = bucket.receive;m.userData.staticPaletteBatch=true;
        root.add(m); mergedCount++;
        continue;
      }
      const merged = BufferGeometryUtils.mergeGeometries(bucket.geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, bucket.material);
      m.castShadow = bucket.cast; m.receiveShadow = bucket.receive;m.userData.staticPaletteBatch=true;
      root.add(m);
      mergedCount++;
      bucket.geos.forEach(g => g.dispose());
    }
    console.log(`[cabin] statics merged into ${mergedCount} batches`);
  })(cabin);

  cabin.traverse(o=>{if(o.isLight){o.userData.lightZone=(Math.abs(o.position.x)<4.5&&Math.abs(o.position.z)<3.35)?'interior':'outdoor';if(!o.name)o.name=o.userData.lightZone+' cabin '+o.type;}});
  fireLight.name='Fireplace amber bounce';fireSpot.name='Fireplace warm key';
  // Public interior framing.
  const interiorCamera = new THREE.Vector3(-2.25, 1.9, 1.6);
  const interiorTarget = new THREE.Vector3(0.25, 1.25, -1.55);

  /* ================================================================ */
  /*  UPDATE                                                          */
  /* ================================================================ */
  const doorState = { target: 0, current: 0, velocity: 0, moving: false, requests: 0 };
  let baseFireIntensity = 6;
  let baseFireSpot = 8;
  const state = {
    group: cabin,
    doorPivot, doorMeshes, doorClick, doorState,
    fireLight, doorSpillLight, doorwayGlow, fireMat, flames,
    stringBulbs, spritesGlow, lightPools, smokeOrigin,
    windowGlass, steamSprites, clockHands,
    interiorCamera,
    interiorTarget,
    setDoor(open) { const target=open?1:0;if(target!==doorState.target){doorState.target=target;doorState.moving=true;doorState.requests++;} },
    isDoorOpen() { return doorState.current > 0.55; },
    getDoorAmount() { return doorState.current; },
    update(time, dt) {
      // Exact critically damped motion is stable at 30/60/120 Hz. Keeping the
      // velocity on a reversed request avoids a sudden hinge jump; the final
      // latch snaps only below an imperceptible fraction of a degree.
      const step=Math.max(0,Math.min(.12,dt)),omega=9;
      const error=doorState.current-doorState.target,c=doorState.velocity+omega*error,decay=Math.exp(-omega*step);
      doorState.current=THREE.MathUtils.clamp(doorState.target+(error+c*step)*decay,0,1);
      doorState.velocity=(doorState.velocity-omega*c*step)*decay;
      if(Math.abs(doorState.current-doorState.target)<.0004&&Math.abs(doorState.velocity)<.005){doorState.current=doorState.target;doorState.velocity=0;}
      doorState.moving=doorState.current!==doorState.target;
      const e = doorState.current * doorState.current * (3 - 2 * doorState.current);
      doorPivot.rotation.y = e * 1.55;
      doorwayGlow.material.opacity = Math.pow(e, 1.6) * 0.055;
      doorSpillLight.intensity = e * 7;
      lightPools.forEach((p, i) => {
        p.material.opacity = 0.24 + Math.sin(time * 0.7 + i * 2.1) * 0.025;
      });
      fireMat.uniforms.uTime.value = time;
      const flicker = 0.82 + 0.10 * Math.sin(time * 8.3) + 0.05 * Math.sin(time * 19.7 + 1.2) + 0.03 * Math.sin(time * 31.0);
      fireLight.intensity = baseFireIntensity * flicker;
      fireSpot.intensity = baseFireSpot * flicker;
      fireLight.position.x = fireX + Math.sin(time * 5.2) * 0.035;
      fireLight.position.z = -2.55 + Math.cos(time * 4.2) * 0.025;
      fireGlow.material.opacity = 0.28 + flicker * 0.18;
      fireGlow.scale.set(1.75 + flicker * 0.25, 1.25 + flicker * 0.18, 1);
      // flames gently dancing
      flames.forEach((f, i) => {
        const s = 0.9 + 0.18 * Math.sin(time * 9 + i * 1.7) + 0.08 * Math.sin(time * 23 + i);
        f.scale.set(1, s, 1);
        f.position.y = f.userData.baseY ?? f.position.y;
      });
      // string lights twinkle
      stringBulbs.forEach((b, i) => {
        const s = 0.85 + 0.15 * Math.sin(time * 2.1 + i * 0.9);
        b.scale.setScalar(s);
      });
      spritesGlow.forEach((s, i) => {
        s.material.opacity = 0.38 + 0.18 * Math.sin(time * 2.1 + i * 0.9);
      });
      // embers drifting up
      const sp = sparkGeo.attributes.position.array;
      for (let i = 0; i < sparkSeed.length; i++) {
        const q = sparkSeed[i];
        const life = (time * q.s + q.p) % 2.2;
        sp[i * 3] = q.x + Math.sin(time * 3 + q.p) * 0.12 * life;
        sp[i * 3 + 1] = 0.85 + life * 0.75;
        sp[i * 3 + 2] = q.z + Math.cos(time * 2.2 + q.p) * 0.1 * life;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      // kettle steam
      steamSprites.forEach((s, i) => {
        s.age += dt * s.speed;
        if (s.age > 1) s.age -= 1;
        const t = s.age;
        s.sp.position.set(4.0 + Math.sin(time * 1.1 + s.phase) * 0.12 * (0.3 + t) + t * 0.15, 1.8 + t * 0.8, 1.8 + Math.cos(time + s.phase) * 0.08 * t);
        const sc = 0.1 + t * 0.45;
        s.sp.scale.set(sc, sc * 1.3, 1);
        s.sp.material.opacity = Math.sin(Math.PI * t) * 0.18;
      });
      // clock hands crawl
      if (clockHands.length) {
        const now = new Date();
        const hours = (now.getHours() % 12) + now.getMinutes() / 60;
        clockHands[0].rotation.x = -0.2 - hours / 12 * Math.PI * 2;
        clockHands[1].rotation.x = -0.2 - (now.getMinutes() / 60) * Math.PI * 2;
      }
    },
    flickerFire() {
      baseFireIntensity = 12;
      baseFireSpot = 16;
      setTimeout(() => { baseFireIntensity = 6; baseFireSpot = 8; }, 2200);
      for (let i = 0; i < 12; i++) {
        const q = sparkSeed[Math.floor(rnd() * sparkSeed.length)];
        q.p = rnd() * 10; q.s = 0.6 + rnd() * 0.7;
      }
    }
  };
  shareSurfaceMaterials(cabin,{exclude:[doorwayGlow.material,...lightPools.map(o=>o.material)]});
  state.staticPaletteBatching=rebatchSharedSurfaces(cabin);
  return state;
}
