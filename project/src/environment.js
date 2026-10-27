import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, fbm } from './textures.js';

/* ================================================================== */
/*  NIGHT SKY  —  deep teal-to-indigo gradient, moon, stars           */
/* ================================================================== */
export function createSky(scene) {
  const skyGeo = new THREE.SphereGeometry(150, 48, 32);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uMoonDir: { value: new THREE.Vector3(-0.52, 0.5, -0.69).normalize() },
      uTime: { value: 0 }
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vDir;
      uniform vec3 uMoonDir;
      uniform float uTime;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float hash3(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
      float noise3(vec3 p) {
        vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float cloudFbm(vec3 p) { float n=0.0,a=0.5; for(int i=0;i<4;i++){ n+=noise3(p)*a;p=p*2.03+vec3(7.1,3.3,1.8);a*=0.5;}return n; }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 zenith = vec3(0.012, 0.025, 0.065);
        vec3 mid    = vec3(0.017, 0.042, 0.090);
        vec3 horizon= vec3(0.052, 0.085, 0.142);
        vec3 col = mix(horizon, mid, smoothstep(0.42, 0.66, h));
        col = mix(col, zenith, smoothstep(0.64, 0.98, h));
        // faint warm town/aurora glow low on the back horizon
        float glow = pow(max(0.0, 1.0 - abs(d.y + 0.02) * 3.2), 3.0);
        col += vec3(0.09, 0.075, 0.045) * glow * (0.35 + 0.25 * sin(d.x * 2.0));
        // moon halo
        float m = max(0.0, dot(d, uMoonDir));
        col += vec3(0.36, 0.46, 0.62) * pow(m, 90.0) * 0.55;
        col += vec3(0.12, 0.20, 0.34) * pow(m, 7.0) * 0.22;
        // Quiet, drifting cirrus: two FBM scales, rather than a stationary sine stripe.
        vec3 drift=vec3(uTime*.0012,0.0,uTime*.0007);
        float cloudField=cloudFbm(d*5.6+drift)*.7+cloudFbm(d*12.2-drift*.45)*.3;
        float cloud=smoothstep(.43,.75,cloudField)*smoothstep(.06,.30,d.y)*.10;
        float silver=pow(m,28.0)*smoothstep(.45,.62,cloudField);
        col=mix(col,vec3(.10,.14,.19)+vec3(.12,.16,.20)*silver,cloud);
        // A low-contrast dusty Milky Way, kept darker in the moon's halo.
        float galaxyDistance=dot(d,normalize(vec3(-.46,-.31,.83)))/.16;
        float band=exp(-galaxyDistance*galaxyDistance);
        float dust=cloudFbm(d*21.0+vec3(9.0,2.0,6.0));
        float galaxy=band*smoothstep(.18,.7,d.y)*(.014+.042*dust)*(1.0-pow(m,10.0)*.9);
        col+=vec3(.60,.78,.88)*galaxy;
        // dither to prevent banding
        float n = hash(gl_FragCoord.xy + uTime * 0.001) * 0.006;
        gl_FragColor = vec4(col + n, 1.0);
      }
    `
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  scene.add(sky);

  /* A dense, distant stellar hemisphere. Tiny sharp stars stay distinguishable
     from the much larger foreground snow; a diagonal band adds depth. */
  const starCount = 10400;
  const rnd = mulberry32(901);
  const pos = new Float32Array(starCount * 3);
  const size = new Float32Array(starCount);
  const phase = new Float32Array(starCount);
  const color = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    let theta, y, r, sx, sz;
    do {
      theta = rnd() * Math.PI * 2;
      y = 0.045 + rnd() * 0.955;
      r = Math.sqrt(1 - y * y);
      sx = Math.cos(theta) * r; sz = Math.sin(theta) * r;
      // Additional stars follow a gently irregular Milky Way, without a flat
      // texture or an opaque painted cloud behind the birthday fireworks.
    } while (i >= 7300 && Math.abs(sx * -.46 + y * -.31 + sz * .831) > .105 + rnd() * .13);
    const rad = 126;
    pos[i * 3] = sx * rad;
    pos[i * 3 + 1] = y * rad;
    pos[i * 3 + 2] = sz * rad;
    size[i] = .94 + Math.pow(rnd(), 5.0) * 2.1;
    phase[i] = rnd() * 100;
    const tint = rnd();
    const luminance = .64 + rnd() * .62;
    const tintColor = tint < .08 ? [1,.90,.78] : tint < .13 ? [.68,.83,1] : [.86,.91,1];
    for(let k=0;k<3;k++) color[i*3+k]=tintColor[k]*luminance;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aPhase; attribute vec3 aColor;
      varying vec3 vColor; varying float vTwinkle; varying float vBright;
      uniform float uTime; uniform float uPixelRatio;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize, .80, 4.4) * uPixelRatio;
        vColor = aColor;
        vBright = smoothstep(2.0, 3.1, aSize);
        vTwinkle = .85 + .12 * sin(uTime * (.26 + fract(aPhase) * .65) + aPhase) + .03 * sin(uTime * 1.4 + aPhase * 3.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vTwinkle; varying float vBright;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        float a = exp(-d * d * 28.0) * smoothstep(.5, .39, d);
        float rays = max(exp(-abs(p.x)*42.), exp(-abs(p.y)*42.)) * exp(-d*7.0);
        a += rays * vBright * .22;
        a *= vTwinkle;
        gl_FragColor = vec4(vColor, a);
      }
    `
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.name = '10,400 distant stars • dense Milky Way';
  stars.frustumCulled = false;
  scene.add(stars);

  /* The opaque lunar disc writes depth before transparent stars. Only the
     halo is additive; stars can never shine through the moon's surface. */
  const moonGroup = new THREE.Group();
  const moonDir = new THREE.Vector3(-0.52, 0.5, -0.69).normalize().multiplyScalar(118);
  const glow1 = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeMoonTexture(true), color: 0xcdddff, transparent: true,
    opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  glow1.scale.set(25, 25, 1); glow1.position.copy(moonDir);
  const disc = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeMoonTexture(false), color: 0xfff8e8, transparent: false,
    opacity: 1, alphaTest:.5, blending: THREE.NormalBlending, depthWrite: true, fog: false
  }));
  disc.scale.set(4.4, 4.4, 1); disc.position.copy(moonDir);
  moonGroup.add(glow1, disc);
  scene.add(moonGroup);

  return {
    sky, stars, starMat, skyMat, moonGroup,
    setPixelRatio(dpr) { starMat.uniforms.uPixelRatio.value=Math.max(.5,Number(dpr)||1); },
    setQuality(value) {
      const tier=typeof value==='string'?value:value?.name||value?.tier||'high';
      // Stars cost one draw call. Preserve a dense sky even in the lightest tier.
      starGeo.setDrawRange(0,tier==='low'?7800:tier==='balanced'?9200:starCount);
    },
    update(time) {
      starMat.uniforms.uTime.value = time;
      skyMat.uniforms.uTime.value = time;
    }
  };
}

function makeMoonTexture(glowOnly) {
  const s = glowOnly ? 256 : 128;
  const c = document.createElement('canvas'); c.width = c.height = s;
  const ctx = c.getContext('2d');
  if (glowOnly) {
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.05, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.22, 'rgba(220,235,255,0.2)');
    g.addColorStop(0.55, 'rgba(180,210,255,0.06)');
    g.addColorStop(1, 'rgba(160,190,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  } else {
    const g = ctx.createRadialGradient(s * 0.44, s * 0.4, s * 0.03, s / 2, s / 2, s * 0.49);
    g.addColorStop(0, '#fffdf6');
    g.addColorStop(0.65, '#e9eefc');
    g.addColorStop(1, '#bdcbe1');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.46, 0, Math.PI * 2); ctx.fill();
    // craters
    ctx.globalAlpha = 0.15; ctx.fillStyle = '#8f9bbd';
    for (const [x, y, r] of [[0.42, 0.4, 0.1], [0.58, 0.55, 0.07], [0.48, 0.65, 0.05], [0.34, 0.58, 0.04]]) {
      ctx.beginPath(); ctx.arc(s * x, s * y, s * r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ================================================================== */
/*  DISTANT MOUNTAINS                                                 */
/* ================================================================== */
export function createMountains(scene) {
  const group = new THREE.Group();
  group.name = 'Birthday distant mountain occluders';
  group.userData.isBirthdayMountainOccluder = true;
  const rnd = mulberry32(713);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2e445c, roughness: 1, metalness: 0, flatShading: true,
    emissive: 0x091422, emissiveIntensity: 0.35, fog: true
  });
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0xa9bdd2, roughness: 0.95, metalness: 0, flatShading: true, fog: true
  });
  for (let i = 0; i < 19; i++) {
    const a = (i / 19) * Math.PI * 2 + rnd() * 0.12;
    const radius = 84 + rnd() * 26;
    const h = 7 + rnd() * 11;
    const r = 10 + rnd() * 13;
    const segments=5 + Math.floor(rnd() * 3);
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, segments, 1), mat);
    m.position.set(Math.cos(a) * radius, h * 0.5 - 5, Math.sin(a) * radius);
    m.rotation.y = rnd() * Math.PI;
    group.add(m);
    // Use the exact same cone slope, facets and rotation. The snow starts at
    // 71% of the mountain height, so its foot radius is exactly 29% of r.
    // Polygon offset avoids z-fighting without a floating brim or bare tip.
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * .29, h * .29, segments, 1), snowMat);
    cap.position.set(m.position.x, h * .855 - 5, m.position.z);
    cap.rotation.y = m.rotation.y;
    group.add(cap);
  }
  snowMat.polygonOffset=true;snowMat.polygonOffsetFactor=-1;snowMat.polygonOffsetUnits=-1;
  scene.add(group);
  return group;
}

/* ================================================================== */
/*  TERRAIN — gentle snow dunes, flattened around the cabin           */
/* ================================================================== */
export function terrainHeight(x, z) {
  const r = Math.hypot(x * 0.92, z);
  const flat = THREE.MathUtils.smoothstep(r, 7.0, 16.0);
  const n = fbm(x * 0.045 + 11, z * 0.045 + 3, 4, 4) - 0.5;
  const n2 = fbm(x * 0.12, z * 0.12, 9, 3) - 0.5;
  const far = fbm(x * 0.012, z * 0.012, 15, 3) - 0.5;
  let h = n * 2.6 + n2 * 0.5 + far * 4.5;
  h *= flat;
  // a shallow hollow at the doorstep, keeps the cabin grounded
  h -= Math.exp(-r * r / 90) * 0.1;
  // Shallow wind-combed ridges give the walking surface a physical contour.
  const drift = Math.sin(x * 1.23 + z * .28) * .017 + Math.sin(z * 2.14 - x * .31) * .009;
  h += drift * THREE.MathUtils.smoothstep(r, 6.7, 12.5);
  return h;
}

export function createTerrain(scene, textures) {
  const geo = new THREE.PlaneGeometry(190, 190, 220, 220);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const colors = [];
  const cLow = new THREE.Color(0xc2cedb);
  const cHigh = new THREE.Color(0xf1f5fc);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = terrainHeight(x, z);
    p.setY(i, h);
    const t = THREE.MathUtils.clamp(h * 0.25 + 0.5, 0, 1);
    const c = cLow.clone().lerp(cHigh, t);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  // All three maps share the already uploaded images. Their ground UVs are
  // expressed in metres in the shader; no duplicate texture uploads are needed.
  const terrainSnowMap = textures.snow.map;
  const terrainSnowNormal = textures.snow.normalMap;
  const terrainSnowRoughness = textures.snow.roughnessMap;
  const mat = new THREE.MeshStandardMaterial({
    map: terrainSnowMap,
    normalMap: terrainSnowNormal,
    normalScale: new THREE.Vector2(.35, .35),
    roughnessMap: terrainSnowRoughness,
    color: 0xffffff,
    vertexColors: true,
    roughness: .78,
    metalness: 0.0,
    envMapIntensity: .55
  });
  const snowTime={value:0}, sparkleStrength={value:1};
  mat.onBeforeCompile=shader=>{
    shader.uniforms.uSnowTime=snowTime;shader.uniforms.uSnowSparkle=sparkleStrength;
    shader.vertexShader='varying vec3 vSnowWorld;\nuniform float uSnowTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
      // Independent scales hide repeats in the large ground plane.
      #ifdef USE_MAP
        vMapUv=position.xz*.23;
      #endif
      #ifdef USE_NORMALMAP
        vNormalMapUv=position.xz*.83+vec2(sin(uSnowTime*.03)*.004,uSnowTime*.0015);
      #endif
      #ifdef USE_ROUGHNESSMAP
        vRoughnessMapUv=position.xz*.57;
      #endif`);
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvSnowWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader='varying vec3 vSnowWorld;\nuniform float uSnowTime;\nuniform float uSnowSparkle;\nfloat snowHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float broad=sin(vSnowWorld.x*.13+vSnowWorld.z*.071)*sin(vSnowWorld.z*.19-vSnowWorld.x*.053);
      diffuseColor.rgb*=.965+broad*.035;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float driftPhase=vSnowWorld.x*9.4+vSnowWorld.z*2.3+sin(vSnowWorld.z*.72)*.55;
      float finePhase=vSnowWorld.x*31.1-vSnowWorld.z*11.7;
      vec3 windSlope=vec3(cos(driftPhase)*.026+cos(finePhase)*.008,0.0,cos(driftPhase)*.012);
      normal=normalize(normal+mat3(viewMatrix)*windSlope);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      // Sparse crystalline glints, not a uniformly luminous snow surface.
      vec2 grainUv=vSnowWorld.xz*37.0;
      float grain=snowHash(floor(grainUv));
      float facet=pow(max(0.0,dot(normal,normalize(vViewPosition))),16.0);
      float resolving=1.0-smoothstep(.45,1.4,max(fwidth(grainUv.x),fwidth(grainUv.y)));
      float glint=smoothstep(.991,.999,grain)*facet*resolving*uSnowSparkle;
      totalEmissiveRadiance+=vec3(.11,.15,.20)*glint;`);
  };
  mat.customProgramCacheKey=()=> 'winter-ground-metres-ripples-glints-v4';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  scene.add(mesh);
  const contacts=makeContactShadows([
    [0,0,5.1,4.3,.32],[-3.95,2.6,1.3,1.5,.20],[4.15,1.4,1.25,2.4,.19],
    [-7.5,6.5,1.35,1.05,.23],[7.3,-6.3,1.7,1.3,.23],[-9.5,-8.2,2.0,1.6,.23],
    [8.5,8.2,1.1,.9,.19],[12,-2,1.5,1.1,.22]
  ]);
  scene.add(contacts);
  return { mesh, mat, contacts,
    update(time){snowTime.value=time;},
    setQuality(value){const tier=typeof value==='string'?value:value?.name||value?.tier||'high';sparkleStrength.value=tier==='low'?0:1;}
  };
}

// One instanced draw call per contact-shadow group. This is deliberately
// independent of shadow-map refreshes, so resting objects always feel grounded.
let contactTexture;
function makeContactShadows(spots) {
  if(!contactTexture){
    const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
    const gradient=ctx.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0,'rgba(255,255,255,.8)');gradient.addColorStop(.30,'rgba(255,255,255,.45)');gradient.addColorStop(.72,'rgba(255,255,255,.11)');gradient.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);contactTexture=new THREE.CanvasTexture(c);
  }
  const mat=new THREE.MeshBasicMaterial({map:contactTexture,color:0x18283c,transparent:true,opacity:.34,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,fog:true});
  mat.name='contact-shadow: blue-grey ambient occlusion';
  const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(2,2),mat,spots.length),matrix=new THREE.Matrix4();
  const quat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
  for(let i=0;i<spots.length;i++){
    const [x,z,rx,rz]=spots[i];matrix.compose(new THREE.Vector3(x,terrainHeight(x,z)+.015,z),quat,new THREE.Vector3(rx,rz,1));mesh.setMatrixAt(i,matrix);
  }
  mesh.name='Soft contact shadows';mesh.renderOrder=1;mesh.instanceMatrix.needsUpdate=true;
  return mesh;
}

/* ================================================================== */
/*  STONE PATH and little snow-capped boulders                        */
/* ================================================================== */
export function createPath(scene, textures) {
  const group = new THREE.Group();
  const rnd = mulberry32(404);
  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stone.map, normalMap: textures.stone.normalMap,
    color: 0x8e9296, roughness: 0.95, metalness: 0.02
  });
  const snowMat = new THREE.MeshStandardMaterial({
    map: textures.snow.map, normalMap: textures.snow.normalMap,
    color: 0xf3f8ff, roughness: .78,envMapIntensity:.55,normalScale:new THREE.Vector2(.35,.35)
  });
  for (let i = 0; i < 15; i++) {
    const z = 6.15 + i * 0.88;
    const x = 0.1 + Math.sin(i * 0.42 + 0.4) * 0.55 + (rnd() - 0.5) * 0.25;
    const y = terrainHeight(x, z) - .025;
    const g = new THREE.Group();
    const s = 0.34 + rnd() * 0.24;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stoneMat);
    stone.scale.set(1.3, 0.22, 1.0);
    stone.rotation.y = rnd() * Math.PI;
    stone.castShadow = true; stone.receiveShadow = true;
    g.add(stone);
    const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(s * 0.7, 1), snowMat);
    cap.scale.set(0.9, 0.10, 0.72);
    cap.position.set(0, s * 0.12, -s * 0.04);
    cap.rotation.y = stone.rotation.y;
    cap.receiveShadow = true;
    g.add(cap);
    g.position.set(x, y, z);
    group.add(g);
  }
  // The lane is partly covered, with irregular wind-packed shoulders rather
  // than a line of stones balanced above a perfectly flat sheet of snow.
  for(let i=0;i<12;i++){
    const z=6.3+i*1.05,side=i%2?1:-1,x=.1+Math.sin(i*.42+.4)*.55+side*(.72+rnd()*.16);
    const drift=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),snowMat),p=drift.geometry.attributes.position;
    for(let j=0;j<p.count;j++)p.setY(j,p.getY(j)*(1+Math.sin(p.getX(j)*5+i)*.18));
    drift.geometry.computeVertexNormals();drift.scale.set(.35+rnd()*.24,.055+rnd()*.035,.48+rnd()*.22);
    drift.position.set(x,terrainHeight(x,z)+.018,z);drift.rotation.y=rnd()*3;drift.receiveShadow=true;group.add(drift);
  }
  // boulders
  const boulderSpots = [[-7.5, 6.5, 1.2], [7.3, -6.3, 1.5], [-9.5, -8.2, 1.8], [8.5, 8.2, 0.9], [12, -2, 1.3]];
  for (const [x, z, s] of boulderSpots) {
    const y = terrainHeight(x, z);
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), stoneMat);
    b.scale.set(1.25, 0.6, 1.0);
    b.rotation.set(rnd(), rnd() * 6, rnd() * 0.3);
    b.position.set(x, y + s * 0.2, z);
    b.castShadow = true; b.receiveShadow = true;
    group.add(b);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(s * 1.1, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), snowMat);
    cap.scale.set(1.18, 0.45, 1.0);
    cap.position.set(x, y + s * 0.53, z);
    cap.rotation.y = b.rotation.y;
    cap.receiveShadow = true;
    group.add(cap);
  }
  // This lane never moves. Merge its small stones and snow shoulders into two
  // material batches, instead of paying more than fifty draw calls per frame.
  group.updateMatrixWorld(true);
  const batches=new Map();
  group.traverse(o=>{if(o.isMesh){const geometry=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrixWorld);if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(geometry);}});
  group.clear();
  for(const [material,geometries]of batches){
    const merged=BufferGeometryUtils.mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    const mesh=new THREE.Mesh(merged,material);mesh.receiveShadow=true;mesh.castShadow=true;group.add(mesh);
  }
  scene.add(group);
  return group;
}

/* ================================================================== */
/*  PINE FOREST — merged geometries + instancing                      */
/* ================================================================== */
// An alpha-tested branch atlas: hundreds of thin, tapered individual needles.
// Its empty background remains empty geometry, leaving sky between the sprays.
function makeNeedleSprayTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const ctx = c.getContext('2d'), rnd = mulberry32(774);
  const stem = (a, b, width, color) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); };
  stem([16, 129], [500, 129], 4, '#625744');
  for (let i = 0; i < 42; i++) {
    const x = 28 + i * 10.8, spread = 20 + Math.sin(i / 42 * Math.PI) * 77;
    for (const side of [-1, 1]) {
      const endX = x + 55 + rnd() * 48, endY = 128 + side * spread;
      stem([x, 128], [endX, endY], 2.1, '#3e4b32');
      for (let n = 0; n < 10; n++) {
        const t = n / 10, sx = x + (endX - x) * t, sy = 128 + (endY - 128) * t;
        const length = 15 + rnd() * 19, shade = rnd();
        const tint = shade > .75 ? '#71846b' : shade > .35 ? '#38563f' : '#1f3c2c';
        stem([sx, sy], [sx + length * (.45 + rnd() * .4), sy + side * length * (.50 + rnd() * .55)], 1.3 + rnd(), tint);
        // A few warm silvery tips catch the moon; no uniformly white cone.
        if (rnd() > .87) stem([sx + 3, sy], [sx + length * .65, sy + side * length * .55], .8, '#9aaa8c');
      }
    }
  }
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; return texture;
}

function buildPineVariant(seed) {
  const rnd = mulberry32(seed), trunkGeos = [], foliageGeos = [], snowGeos = [];
  const h = 5.7 + rnd() * 1.1;
  const trunk = new THREE.CylinderGeometry(.035, .18, h, 7, 4);
  const tp = trunk.attributes.position;
  for (let j = 0; j < tp.count; j++) {
    const y = tp.getY(j) + h / 2, sway = Math.sin(y / h * Math.PI) * .075;
    tp.setXYZ(j, tp.getX(j) + sway, y, tp.getZ(j) + Math.sin(y * 1.7 + seed) * .018);
  }
  trunk.computeVertexNormals(); trunkGeos.push(trunk);
  const up = new THREE.Vector3(0, 1, 0), scratch = new THREE.Matrix4();
  const woody = (from, to, radius) => {
    const direction = to.clone().sub(from), branch = new THREE.CylinderGeometry(radius * .35, radius, direction.length(), 4, 1);
    branch.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, direction.clone().normalize()));
    branch.translate(...from.clone().add(to).multiplyScalar(.5).toArray()); trunkGeos.push(branch);
  };
  const card = (from, to, width, angle) => {
    const xAxis = to.clone().sub(from).normalize();
    let yAxis = new THREE.Vector3().crossVectors(xAxis, up).normalize();
    yAxis.applyAxisAngle(xAxis, angle);
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    scratch.makeBasis(xAxis, yAxis, zAxis);
    const g = new THREE.PlaneGeometry(from.distanceTo(to), width);
    g.applyMatrix4(scratch); g.translate(...from.clone().add(to).multiplyScalar(.5).toArray()); foliageGeos.push(g);
  };
  const levels = 8;
  for (let level = 0; level < levels; level++) {
    const t = level / (levels - 1), y = .8 + t * (h - 1.07);
    const radius = (.34 + Math.pow(1 - t, .84) * 1.85) * (.91 + rnd() * .14);
    const branchCount = level < 5 ? 7 : 6;
    const snowBranch = Math.floor(rnd()*branchCount);
    const phase = level * 2.39996 + seed * .45;
    for (let b = 0; b < branchCount; b++) {
      const a = phase + b * Math.PI * 2 / branchCount + (rnd() - .5) * .22;
      const reach = radius * (.80 + rnd() * .27), drop = .16 + (1 - t) * .34;
      const from = new THREE.Vector3(.035, y, 0);
      const bend = new THREE.Vector3(Math.cos(a) * reach * .58, y - drop, Math.sin(a) * reach * .58);
      const tip = new THREE.Vector3(Math.cos(a) * reach, y - drop + .16 + t * .13, Math.sin(a) * reach);
      woody(from, bend, .035 * (1 - t * .65)); woody(bend, tip, .021 * (1 - t * .55));
      const sprayFrom = from.clone().lerp(bend, .18);
      const width = Math.max(.27, reach * .55);
      // Two crossed sprays retain individual needle silhouettes with only
      // 108 cards/tree; the previous 173-card tree wasted fill-rate and faces.
      card(sprayFrom, tip, width, Math.PI*.23);
      card(sprayFrom, tip, width*.88, -Math.PI*.28);
      // Eight connected snow pockets, resting on boughs. Small irregular
      // upper hemispheres have upward normals and no rounded white tiers.
      if (b===snowBranch) {
        const snow = new THREE.SphereGeometry(1, 6, 3, 0, Math.PI * 2, 0, Math.PI * .57);
        const sp = snow.attributes.position;
        for (let j = 0; j < sp.count; j++) {
          const n = 1 + Math.sin(sp.getX(j) * 6 + seed + level) * .10;
          sp.setX(j, sp.getX(j) * n); sp.setZ(j, sp.getZ(j) * n);
        }
        snow.scale(reach * (.35 + rnd() * .06), .09 + rnd() * .035, width * (.42 + rnd() * .08));
        snow.rotateY(-a); const mid = bend.clone().lerp(tip, .22 + rnd() * .18);
        snow.translate(mid.x, mid.y + .055, mid.z); snow.computeVertexNormals(); snowGeos.push(snow);
      }
    }
  }
  // The slender terminal leader has needles, not a rounded snowball.
  const topFrom = new THREE.Vector3(0, h - .7, 0), topTo = new THREE.Vector3(.015, h + .2, 0);
  card(topFrom, topTo, .4, 0); card(topFrom, topTo, .4, Math.PI / 2);
  const merge = arr => { const merged = BufferGeometryUtils.mergeGeometries(arr); arr.forEach(g => g.dispose()); return merged; };
  return { trunk: merge(trunkGeos), foliage: merge(foliageGeos), snow: merge(snowGeos), height: h };
}

// Visible bulbs follow the outer branches, rather than disappearing on trunks.
function addForestCelebration(group, trees, glowTexture) {
  const decorated=trees.filter(p=>Math.hypot(p.x,p.z)<30).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)).slice(0,8);
  const wires=[],bulbPositions=[];
  decorated.forEach((p,treeIndex)=>{
    const points=[],ground=terrainHeight(p.x,p.z);
    for(let i=0;i<=84;i++){
      const t=i/84,angle=t*Math.PI*2*2.8+p.rot,r=(1.85-t*1.15)*p.scale;
      points.push(new THREE.Vector3(p.x+Math.cos(angle)*r,ground+(.85+t*4.8)*p.scale,p.z+Math.sin(angle)*r));
    }
    const curve=new THREE.CatmullRomCurve3(points);
    wires.push(new THREE.TubeGeometry(curve,80,.009,3,false));
    for(let i=0;i<77;i++)bulbPositions.push(curve.getPointAt(i/76));
    if(treeIndex<4){
      const heart=[];
      for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;heart.push(new THREE.Vector3(p.x+16*Math.pow(Math.sin(a),3)*.041*p.scale,ground+(3.35+(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))*.043)*p.scale,p.z+1.95*p.scale));}
      const h=new THREE.CatmullRomCurve3(heart);wires.push(new THREE.TubeGeometry(h,64,.012,4,false));
      for(let i=0;i<34;i++)bulbPositions.push(h.getPointAt(i/34));
    }
  });
  if(wires.length){
    const geo=BufferGeometryUtils.mergeGeometries(wires);wires.forEach(g=>g.dispose());
    group.add(new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x514536,roughness:.78,metalness:.14})));
  }
  const mat=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});mat.name='emitter: champagne and blush forest celebration lights';
  const bulbs=new THREE.InstancedMesh(new THREE.SphereGeometry(.052,6,4),mat,bulbPositions.length),matrix=new THREE.Matrix4();
  const colors=[new THREE.Color(0xffdcad),new THREE.Color(0xffe8cc),new THREE.Color(0xff9ebe)];
  bulbPositions.forEach((p,i)=>{matrix.makeTranslation(p.x,p.y,p.z);bulbs.setMatrixAt(i,matrix);bulbs.setColorAt(i,colors[i%7===0?2:i%2]);});
  bulbs.instanceMatrix.needsUpdate=true;bulbs.computeBoundingSphere();group.add(bulbs);
  const halos=new THREE.BufferGeometry().setFromPoints(bulbPositions);
  const halo=new THREE.Points(halos,new THREE.PointsMaterial({map:glowTexture,color:0xffc9b7,size:.38,transparent:true,opacity:.36,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));halo.name='Forest lamp halos retained in every quality tier';group.add(halo);
  return {bulbs,decoratedTrees:decorated.length,bulbCount:bulbPositions.length,heartCount:Math.min(4,decorated.length)};
}

// Low-detail pine atlas, built locally. Crossed alpha-cut cards replace only
// distant geometry; near trees always retain woody branches and needle sprays.
function makeDistantPineTexture(){
  const c=document.createElement('canvas');c.width=256;c.height=512;const ctx=c.getContext('2d'),rnd=mulberry32(904);
  ctx.strokeStyle='#443d32';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(128,500);ctx.lineTo(128,18);ctx.stroke();
  for(let level=0;level<33;level++){
    const t=level/33,y=46+t*419,reach=12+t*98;
    for(const side of [-1,1]){
      const endX=128+side*reach,endY=y+12+t*20;
      ctx.strokeStyle=level%3?'#2e4439':'#46594a';ctx.lineWidth=3+t*8;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(128,y);ctx.lineTo(endX,endY);ctx.stroke();
      for(let n=1;n<10;n++){
        const q=n/10,x=128+(endX-128)*q,yy=y+(endY-y)*q;
        ctx.lineWidth=1.5+t*2;ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+side*(6+t*8),yy-6-rnd()*10);ctx.stroke();
      }
      if(level%4===1){ctx.strokeStyle='#9bafbc';ctx.lineWidth=2+t*3;ctx.beginPath();ctx.moveTo(128+side*reach*.25,y+2);ctx.lineTo(128+side*reach*.82,y+10+t*13);ctx.stroke();}
    }
  }
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;
}

function addPineWind(material, uniforms){
  const deformation=`
    #include <begin_vertex>
    #ifdef USE_INSTANCING
      vec3 pineOrigin=(instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
    #else
      vec3 pineOrigin=vec3(0.0);
    #endif
    float pineHeight=max(transformed.y,0.0);
    float pineSway=sin(uPineTime*.71+pineOrigin.x*.21+pineOrigin.z*.17)+.32*sin(uPineTime*1.51+pineOrigin.z*.39);
    float pineCross=cos(uPineTime*.57+pineOrigin.x*.19);
    transformed.x+=pineSway*pineHeight*pineHeight*.0028*uPineWind;
    transformed.z+=pineCross*pineHeight*pineHeight*.0016*uPineWind;
  `;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uPineTime=uniforms.time;shader.uniforms.uPineWind=uniforms.strength;
    shader.vertexShader='uniform float uPineTime;\nuniform float uPineWind;\n'+shader.vertexShader;
    // The normals follow the derivative of the same bend. The inverse transpose
    // introduced by instancing is applied by Three after this object-space step.
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`
      #include <beginnormal_vertex>
      #ifdef USE_INSTANCING
        vec3 normalOrigin=(instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
      #else
        vec3 normalOrigin=vec3(0.0);
      #endif
      float normalH=max(position.y,0.0);
      float slopeX=(sin(uPineTime*.71+normalOrigin.x*.21+normalOrigin.z*.17)+.32*sin(uPineTime*1.51+normalOrigin.z*.39))*normalH*.0056*uPineWind;
      float slopeZ=cos(uPineTime*.57+normalOrigin.x*.19)*normalH*.0032*uPineWind;
      objectNormal=normalize(vec3(objectNormal.x,objectNormal.y-objectNormal.x*slopeX-objectNormal.z*slopeZ,objectNormal.z));
    `).replace('#include <begin_vertex>',deformation);
  };
  material.customProgramCacheKey=()=> 'pine-bend-visible-and-shadow-v4';
}

function makeCanopyPowder(group, trees, uniforms, glowTexture){
  const count=8*30,positions=new Float32Array(count*3),seeds=new Float32Array(count*4),rnd=mulberry32(7017);
  const chosen=[...trees].sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)).slice(0,8);
  chosen.forEach((p,ti)=>{for(let j=0;j<30;j++){
    const i=ti*30+j;positions.set([p.x+(rnd()-.5)*1.7,terrainHeight(p.x,p.z)+(3.5+rnd()*1.7)*p.scale,p.z+(rnd()-.5)*1.5],i*3);
    seeds.set([ti*.53+rnd()*.35,rnd(),rnd(),rnd()],i*4);
  }});
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('aSeed',new THREE.BufferAttribute(seeds,4));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:uniforms.time,uDpr:{value:1},uMap:{value:glowTexture}},
    vertexShader:`attribute vec4 aSeed;uniform float uTime;uniform float uDpr;varying float vOpacity;
      void main(){float age=mod(uTime-aSeed.x+6.2,6.2);float life=2.1+aSeed.y*.7;vec3 p=position;
      p.x+=age*(.43+aSeed.y*.22);p.z+=sin(age*1.4+aSeed.z*6.28)*.25;p.y-=age*.48+age*age*.22;
      vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((1.6+aSeed.w*1.8)*60.0/max(5.0,-mv.z),.7,5.0)*uDpr;
      vOpacity=smoothstep(0.0,.20,age)*(1.0-smoothstep(life*.3,life,age))*.28;}`,
    fragmentShader:`uniform sampler2D uMap;varying float vOpacity;void main(){float a=texture2D(uMap,gl_PointCoord).a*vOpacity;if(a<.005)discard;gl_FragColor=vec4(.77,.85,.94,a);}`});
  const points=new THREE.Points(geo,material);points.name='Wind-released canopy snow powder';points.frustumCulled=false;group.add(points);
  return {points,material,count};
}

export function createForest(scene, textures) {
  const rnd = mulberry32(1987);
  const variants = [buildPineVariant(2), buildPineVariant(7), buildPineVariant(12), buildPineVariant(18)];
  const trunkMat = new THREE.MeshStandardMaterial({
    map: textures.darkWood.map, normalMap: textures.darkWood.normalMap,
    color: 0x5b422f, roughness: 0.92
  });
  const foliageMat = new THREE.MeshStandardMaterial({
    map: makeNeedleSprayTexture(), alphaTest: .42, side: THREE.DoubleSide,
    color: 0xa3bd9c, roughness: .91, metalness: 0, flatShading: false,
    emissive: 0x06140a, emissiveIntensity: .12
  });
  const snowMat = new THREE.MeshStandardMaterial({
    map: textures.snow.map, normalMap: textures.snow.normalMap,
    color: 0xe7eff8, roughness: .78, metalness: 0,envMapIntensity:.55,
    normalScale: new THREE.Vector2(.35,.35)
  });
  const counts = variants.map(() => 0);
  const placements = variants.map(() => []);
  const cameraXZ = new THREE.Vector2(12.2, 19.2);
  const cabinXZ = new THREE.Vector2(0, 0);
  const seg = new THREE.Vector2().subVectors(cameraXZ, cabinXZ);
  const segLen = seg.length();
  const segDir = seg.clone().normalize();

  const addTree = (x, z, scale, rot) => {
    const vi = Math.floor(rnd() * variants.length);
    placements[vi].push({ x, z, scale, rot });
    counts[vi]++;
  };

  let attempts = 0;
  while (placements.reduce((a, p) => a + p.length, 0) < 88 && attempts < 3000) {
    attempts++;
    const a = rnd() * Math.PI * 2;
    const radius = 13 + Math.pow(rnd(), 0.72) * 47;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    // keep the view corridor to the cabin open
    const rel = new THREE.Vector2(x - cabinXZ.x, z - cabinXZ.y);
    const proj = rel.dot(segDir);
    if (proj > 0 && proj < segLen + 4) {
      const distToLine = Math.abs(rel.x * segDir.y - rel.y * segDir.x);
      if (distToLine < 4.8 + proj * 0.06) continue;
    }
    // keep the path clear
    if (Math.abs(x - 0.3) < 3.4 && z > 5.2 && z < 22) continue;
    // keep cabin clearing clear
    if (Math.hypot(x * 0.9, z) < 11.5) continue;
    // don't put a pine between the camera and the cabin
    if (Math.hypot(x - cameraXZ.x, z - cameraXZ.y) < 8.5) continue;
    const scale = 0.68 + rnd() * 0.52 + (radius > 35 ? 0.1 : 0);
    addTree(x, z, scale, rnd() * Math.PI * 2);
  }

  // deliberate framing trees, kept low and at the edges of frame
  addTree(-14.2, 7.2, 0.98, 0.4);
  addTree(-6.7, -10.6, 1.05, 1.2);
  addTree(15.6, 4.4, 1.0, 0.9);
  addTree(-16.4, -2.2, 1.08, 2.8);

  const group = new THREE.Group();group.name='Living winter forest';
  const meshes=[],lodRecords=[],windUniforms={time:{value:0},strength:{value:1}};
  [trunkMat,foliageMat,snowMat].forEach(mat=>addPineWind(mat,windUniforms));
  const depthFor=mat=>{const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:mat.map,alphaTest:mat.alphaTest,side:mat.side});addPineWind(depth,windUniforms);return depth;};
  const depths=[depthFor(trunkMat),depthFor(foliageMat),depthFor(snowMat)];
  const distantMat=new THREE.MeshStandardMaterial({map:makeDistantPineTexture(),alphaTest:.42,side:THREE.DoubleSide,color:0xa7b9ab,roughness:.94,metalness:0});
  addPineWind(distantMat,windUniforms);const distantDepth=depthFor(distantMat);
  variants.forEach((v,vi)=>{
    const list=placements[vi];if(!list.length)return;
    const near=[new THREE.InstancedMesh(v.trunk,trunkMat,list.length),new THREE.InstancedMesh(v.foliage,foliageMat,list.length),new THREE.InstancedMesh(v.snow,snowMat,list.length)];
    const cardA=new THREE.PlaneGeometry(4.55,v.height+.2);cardA.translate(0,(v.height+.2)/2,0);
    const cardB=cardA.clone();cardB.rotateY(Math.PI/2);
    const farGeometry=BufferGeometryUtils.mergeGeometries([cardA,cardB]);cardA.dispose();cardB.dispose();
    const far=new THREE.InstancedMesh(farGeometry,distantMat,list.length);far.customDepthMaterial=distantDepth;far.castShadow=false;far.receiveShadow=false;far.name='Distant pine silhouettes';
    const matrices=[],colors=[],q=new THREE.Quaternion(),color=new THREE.Color();
    list.forEach(p=>{
      const y=terrainHeight(p.x,p.z)-.1;p.heightScale=p.scale*(.9+rnd()*.28);
      q.setFromAxisAngle(new THREE.Vector3(0,1,0),p.rot);
      matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x,y,p.z),q,new THREE.Vector3(p.scale,p.heightScale,p.scale)));
      color.setHSL(.31+rnd()*.035,.15+rnd()*.11,.70+rnd()*.18);colors.push(color.clone());
    });
    near.forEach((mesh,i)=>{mesh.castShadow=true;mesh.receiveShadow=true;mesh.customDepthMaterial=depths[i];mesh.name=['Pine trunks and branches','Pine needle sprays','Pine branch snow'][i];group.add(mesh);meshes.push(mesh);});
    group.add(far);meshes.push(far);lodRecords.push({list,near,far,matrices,colors,selection:new Uint8Array(list.length).fill(255)});
  });
  const treePlacements=placements.flat(),decorations=addForestCelebration(group,treePlacements,textures.glowSoft);
  const nearest=[...treePlacements].sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)).slice(0,8);
  group.add(makeContactShadows(nearest.map(p=>[p.x,p.z,1.20*p.scale,.95*p.scale,.25])));
  const powder=makeCanopyPowder(group,treePlacements,windUniforms,textures.glowSoft);
  let quality='high',pixelRatio=1,lastLod=-100,lastShadow=-100,nearCount=0,farCount=0;
  const lastCamera=new THREE.Vector3(12.2,2,19.2);
  function updateLod(camera,force=false){
    if(camera?.position)lastCamera.copy(camera.position);else if(camera?.isVector3)lastCamera.copy(camera);
    const radius=quality==='low'?29:quality==='balanced'?43:55;
    nearCount=0;farCount=0;
    for(const record of lodRecords){
      let changed=force;
      for(let i=0;i<record.list.length;i++){
        const p=record.list[i],distance=Math.hypot(p.x-lastCamera.x,p.z-lastCamera.z),old=record.selection[i];
        const selected=distance<(radius+(force?0:old===0?3:old===1?-3:0))?0:1;
        if(selected!==old){record.selection[i]=selected;changed=true;}
      }
      if(changed){
        let close=0,distant=0;
        for(let i=0;i<record.list.length;i++){
          if(record.selection[i]===0){for(const mesh of record.near)mesh.setMatrixAt(close,record.matrices[i]);record.near[1].setColorAt(close,record.colors[i]);close++;}
          else record.far.setMatrixAt(distant++,record.matrices[i]);
        }
        for(const mesh of record.near){mesh.count=close;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();if(mesh.boundingSphere)mesh.boundingSphere.radius+=.6;}
        if(record.near[1].instanceColor)record.near[1].instanceColor.needsUpdate=true;
        record.far.count=distant;record.far.instanceMatrix.needsUpdate=true;record.far.computeBoundingSphere();if(record.far.boundingSphere)record.far.boundingSphere.radius+=.6;
      }
      nearCount+=record.near[0].count;farCount+=record.far.count;
    }
  }
  updateLod(null,true);scene.add(group);
  return {group,meshes,placements:treePlacements,decorations,windUniforms,
    setPixelRatio(dpr){pixelRatio=Math.max(.5,Number(dpr)||1);powder.material.uniforms.uDpr.value=pixelRatio;},
    setQuality(value){quality=typeof value==='string'?value:value?.name||value?.tier||'high';powder.points.visible=quality!=='low';updateLod(null,true);},
    update(time,camera){
      windUniforms.time.value=time;
      windUniforms.strength.value=.83+.22*Math.sin(time*.19)+.18*Math.sin(time*.071+1.3);
      if(time-lastLod>.65){updateLod(camera);lastLod=time;}
      // The visible and customDepthMaterial passes use identical uniforms. The
      // main renderer can throttle invalidation instead of rendering shadows
      // every frame on an otherwise static scene.
      const interval=quality==='low'?.25:quality==='balanced'?.16:.10;
      if(time-lastShadow>=interval){lastShadow=time;return true;}return false;
    },
    getStats(){
      let triangles=0;group.traverse(o=>{if(o.isMesh&&o.visible&&o.geometry){const g=o.geometry;triangles+=(g.index?g.index.count:g.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
      return {trees:treePlacements.length,nearTrees:nearCount,billboardTrees:farCount,triangles:Math.round(triangles),cardsPerNearTree:108,canopySnowPockets:8,canopyPowder:powder.points.visible?powder.count:0,quality,pixelRatio,wind:windUniforms.strength.value,heartCount:decorations.heartCount};
    }
  };
}
/* ================================================================== */
/*  SNOWFALL — two soft layers of drifting flakes                     */
/* ================================================================== */
function snowfallMaterial(texture, opacity, sizeScale, color, roofUniforms) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 }, uOpacity: { value: opacity },
      uSize: { value: sizeScale }, uColor: { value: new THREE.Color(color) },
      uPixelRatio: { value: 1 }, uMap: { value: texture },
      uMainRoof:roofUniforms.main,uPorchRoof:roofUniforms.porch,uRoofSlope:roofUniforms.slope
    },
    vertexShader: /* glsl */`
      attribute float aSpeed; attribute float aPhase; attribute float aScale;
      uniform float uTime; uniform float uSize; uniform float uPixelRatio;
      uniform vec4 uMainRoof; uniform vec4 uPorchRoof; uniform vec4 uRoofSlope;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float fall = mod(p.y - uTime * aSpeed, 28.0);
        p.y = fall;
        p.x += sin(uTime * 0.45 + aPhase) * 1.4 + uTime * 0.22;
        p.z += cos(uTime * 0.32 + aPhase * 1.7) * 0.9 + uTime * 0.1;
        p.x = mod(p.x + 30.0, 60.0) - 30.0;
        p.z = mod(p.z + 30.0, 60.0) - 30.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(10.0 * uPixelRatio, aScale * uSize * uPixelRatio * (96.0 / max(1.0, -mv.z)));
        vAlpha = smoothstep(0.0, 3.0, fall) * (1.0 - smoothstep(24.0, 28.0, fall));
        vAlpha *= 0.55 + 0.45 * sin(aPhase + uTime * 0.8);
        // Bounds are shared uniforms controlled by setRoofBounds(). Evaluate
        // the animated position after drifting/wrapping, not the seed point.
        float roofHeight = uMainRoof.z - abs(p.z) * uMainRoof.w;
        bool underMainRoof = abs(p.x)<uMainRoof.x && abs(p.z)<uMainRoof.y && p.y<roofHeight+uRoofSlope.z;
        float porchHeight = uPorchRoof.w - (p.z-uPorchRoof.y)*uRoofSlope.y;
        bool underPorchRoof = abs(p.x)<uPorchRoof.x && p.z>uPorchRoof.y && p.z<uPorchRoof.z && p.y<porchHeight+uRoofSlope.w;
        if (underMainRoof || underPorchRoof) vAlpha = 0.0;
        // Near-camera bokeh should never look like snow inside the room.
        vAlpha *= smoothstep(0.45, 1.75, -mv.z);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity; uniform sampler2D uMap;
      varying float vAlpha;
      void main() {
        vec4 tex = texture2D(uMap, gl_PointCoord);
        float a = tex.a * vAlpha * uOpacity;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `
  });
}

export function createSnowfall(scene, textures) {
  const roofUniforms={main:{value:new THREE.Vector4(6.15,5.48,9.05,.558)},porch:{value:new THREE.Vector4(4.22,3.20,6.35,3.896)},slope:{value:new THREE.Vector4(0,.20,.20,.18)}};
  const make = (count, area, size, opacity, color) => {
    const rnd = mulberry32(551 + count);
    const pos = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    const phase = new Float32Array(count);
    const scale = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * area;
      pos[i * 3 + 1] = rnd() * 28;
      pos[i * 3 + 2] = (rnd() - 0.5) * area;
      speed[i] = 0.45 + rnd() * 0.9;
      phase[i] = rnd() * 100;
      scale[i] = 0.4 + rnd() * 1.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    const mat = snowfallMaterial(textures.glowSoft, opacity, size, color, roofUniforms);
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    return { points, mat };
  };
  const far = make(2700, 62, .55, .53, 0xeaf3ff);
  const near = make(400, 24, .88, .25, 0xf7faff);
  let quality='high';
  const pixelRatio=dpr=>{const value=Math.max(.5,Number(dpr)||1);far.mat.uniforms.uPixelRatio.value=value;near.mat.uniforms.uPixelRatio.value=value;};
  return {
    group: [far.points, near.points],
    roofUniforms,
    setPixelRatio:pixelRatio,
    setRoofBounds(bounds={}){
      const main=bounds.main||{},porch=bounds.porch||{},m=roofUniforms.main.value,p=roofUniforms.porch.value,s=roofUniforms.slope.value;
      m.set(main.halfWidth??m.x,main.halfDepth??m.y,main.ridgeHeight??m.z,main.slope??m.w);
      p.set(porch.halfWidth??p.x,porch.minZ??p.y,porch.maxZ??p.z,porch.heightAtMinZ??p.w);
      s.y=porch.slope??s.y;s.z=main.margin??s.z;s.w=porch.margin??s.w;
    },
    setQuality(value){
      quality=typeof value==='string'?value:value?.name||value?.tier||'high';
      far.points.geometry.setDrawRange(0,quality==='low'?1200:quality==='balanced'?2200:2700);
      near.points.geometry.setDrawRange(0,quality==='low'?100:quality==='balanced'?240:400);
    },
    getStats(){return {quality,farFlakes:Math.min(2700,far.points.geometry.drawRange.count),nearFlakes:Math.min(400,near.points.geometry.drawRange.count),pixelRatio:far.mat.uniforms.uPixelRatio.value,roofBoundsConfigurable:true};},
    update(time, pixelRatio) {
      far.mat.uniforms.uTime.value = time;
      near.mat.uniforms.uTime.value = time;
      if(Number.isFinite(pixelRatio)){far.mat.uniforms.uPixelRatio.value=pixelRatio;near.mat.uniforms.uPixelRatio.value=pixelRatio;}
    }
  };
}

/* ================================================================== */
/*  CHIMNEY SMOKE — layered, curling wisps                            */
/* ================================================================== */
export function createSmoke(scene, textures, origin) {
  const group = new THREE.Group();
  scene.add(group);
  const rnd = mulberry32(4747);

  const makeLayer = (count, sizeScale, opacity, colorA, colorB, speedScale) => {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.attributes.position = base.attributes.position;
    geo.attributes.uv = base.attributes.uv;
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      seeds[i * 4] = rnd();
      seeds[i * 4 + 1] = (0.8 + rnd() * 0.5) * speedScale;
      seeds[i * 4 + 2] = rnd();
      seeds[i * 4 + 3] = rnd();
    }
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geo.instanceCount = count;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uOrigin: { value: origin.clone() },
        uMap: { value: textures.smoke },
        uOpacity: { value: opacity },
        uSize: { value: sizeScale },
        uColorA: { value: new THREE.Color(colorA) },
        uColorB: { value: new THREE.Color(colorB) }
      },
      vertexShader: /* glsl */`
        attribute vec4 aSeed;
        uniform float uTime;
        uniform vec3 uOrigin;
        uniform float uSize;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vAge;
        void main() {
          float phase = aSeed.x;
          float life = 12.5 + aSeed.z * 6.0;
          float age = fract(phase + uTime * aSeed.y / life);
          float rise = age * (6.2 + aSeed.z * 1.8);
          float curl = sin(uTime * 0.21 + phase * 6.283 + age * 5.2) * (0.10 + age * 0.95);
          float curl2 = cos(uTime * 0.16 + phase * 4.1 + age * 3.4) * (0.08 + age * 0.55);
          float spreadX = (aSeed.w - 0.5) * (0.16 + age * 0.72);
          float spreadZ = (aSeed.z - 0.5) * (0.14 + age * 0.50);
          vec3 world = uOrigin + vec3(curl + spreadX + age * age * 3.7 + age * 0.45, rise, curl2 + spreadZ + age * 0.55);
          vec4 mv = modelViewMatrix * vec4(world, 1.0);
          float size = (0.48 + aSeed.z * 0.72) * (0.50 + age * 2.6) * uSize;
          float ang = aSeed.w * 6.283 + uTime * 0.09 * (aSeed.w - 0.5);
          float cs = cos(ang), sn = sin(ang);
          vec2 p = position.xy;
          p = mat2(cs, -sn, sn, cs) * p;
          p.x *= 0.82;
          p.y *= 1.18;
          mv.xy += p * size;
          gl_Position = projectionMatrix * mv;
          vUv = uv;
          vAge = age;
          float fadeIn = smoothstep(0.0, 0.065, age);
          float fadeOut = 1.0 - smoothstep(0.52, 1.0, age);
          vAlpha = fadeIn * fadeOut * (0.65 + 0.35 * sin(phase * 8.0));
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform sampler2D uMap;
        uniform float uOpacity;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vAge;
        void main() {
          vec2 uv = vUv;
          vec4 tex = texture2D(uMap, uv);
          // Keep the noisy sprite soft at its perimeter and preserve clear
          // warm-gray wisps instead of opaque dark soot.
          float edge = 1.0 - smoothstep(0.25, 0.50, length(uv - 0.5));
          float a = tex.a * edge * vAlpha * uOpacity;
          if (a < 0.004) discard;
          vec3 col = mix(uColorA, uColorB, smoothstep(0.08, 0.7, vAge));
          col = mix(vec3(0.62, 0.58, 0.52), col, smoothstep(0.0, 0.32, vAge));
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    group.add(mesh);
    return { mesh, mat };
  };

  const layers = [
    makeLayer(46, 1.08, 0.34, 0xc1bbb2, 0xcdd5df, 1.0),
    makeLayer(24, 1.65, 0.18, 0xb5b6b7, 0xd5dde7, 0.85)
  ];

  const state = {
    group,
    layers,
    origin: origin.clone(),
    update(dt, time) {
      for (const l of layers) l.mat.uniforms.uTime.value = time;
    },
    setOrigin(v) {
      state.origin.copy(v);
      for (const l of layers) l.mat.uniforms.uOrigin.value.copy(v);
    }
  };
  return state;
}

/* ================================================================== */
/*  GROUND MIST                                                       */
/* ================================================================== */
export function createGroundMist(scene, textures) {
  const group=new THREE.Group(),rnd=mulberry32(808),count=9,geo=new THREE.PlaneGeometry(1,1);
  const phases=new Float32Array(count),opacities=new Float32Array(count),poses=[],timeUniform={value:0};
  for(let i=0;i<count;i++){
    phases[i]=i;opacities[i]=.035+rnd()*.03;
    poses.push({width:14+rnd()*18,depth:6+rnd()*8,angle:rnd()*Math.PI,x:(rnd()-.5)*40,y:.35+rnd()*.4,z:(rnd()-.5)*40});
  }
  geo.setAttribute('aMistPhase',new THREE.InstancedBufferAttribute(phases,1));
  geo.setAttribute('aMistOpacity',new THREE.InstancedBufferAttribute(opacities,1));
  const mat=new THREE.MeshBasicMaterial({map:textures.glowSoft,color:0x9fb2c8,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending,fog:true});
  mat.name='atmosphere: instanced soft clearing mist';
  mat.onBeforeCompile=shader=>{
    shader.uniforms.uMistTime=timeUniform;
    shader.vertexShader='uniform float uMistTime;\nattribute float aMistPhase;\nattribute float aMistOpacity;\nvarying vec3 vMistWorldPosition;\nvarying float vMistOpacity;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      vec4 mistWorldPosition=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        mistWorldPosition=instanceMatrix*mistWorldPosition;
      #endif
      mistWorldPosition.x+=sin(uMistTime*.055+aMistPhase)*1.25;
      mistWorldPosition=modelMatrix*mistWorldPosition;
      vMistWorldPosition=mistWorldPosition.xyz;
      vMistOpacity=aMistOpacity*(.75+.25*sin(uMistTime*.1+aMistPhase));
      vec4 mvPosition=viewMatrix*mistWorldPosition;
      gl_Position=projectionMatrix*mvPosition;
    `);
    shader.fragmentShader='varying vec3 vMistWorldPosition;\nvarying float vMistOpacity;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 clearing=(vMistWorldPosition.xz-vec2(0.0,.35))/vec2(7.5,8.0);
      float softNoise=sin(vMistWorldPosition.x*.32+sin(vMistWorldPosition.z*.27))*.055+sin(vMistWorldPosition.z*.61)*.025;
      float clearingFade=smoothstep(.84,1.20,length(clearing)+softNoise);
      diffuseColor.a*=clearingFade*vMistOpacity;
    `);
  };
  mat.customProgramCacheKey=()=> 'soft-rounded-instanced-clearing-mist-v4';
  const mesh=new THREE.InstancedMesh(geo,mat,count),dummy=new THREE.Object3D();
  poses.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(-Math.PI/2,0,p.angle);dummy.scale.set(p.width,p.depth,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
  mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;mesh.renderOrder=2;mesh.name='Nine mist wisps in one draw call';
  group.add(mesh);scene.add(group);
  return {group,update(time){timeUniform.value=time;}};
}
