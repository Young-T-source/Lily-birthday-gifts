import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

import { loadSceneTextures } from './textures-runtime.js';
import {
  createSky, createMountains, createTerrain, createPath,
  createForest, createSnowfall, createSmoke, createGroundMist
} from './environment.js';
import { buildCabin } from './cabin.js';
import { createWalkController } from './walk.js';
import { loadBlenderDetails } from './props.js';
import { setupBirthdayGame } from './birthday-game.js';

/* ================================================================== */
/*  HARNESS                                                           */
/* ================================================================== */
import { Soundscape } from './soundscape-v4.js';
import { manageLighting } from './lighting-v4.js';
import { createCelebrationDecor } from './celebration-decor.js';
import { mountBirthdayInvitation } from './invitation-v8.js';
import { MEDIA } from './local-media.js';
/* ================================================================== */
/*  BOOT                                                              */
/* ================================================================== */
const canvas = document.getElementById('scene');
const app = document.getElementById('app');
const btnMain = document.getElementById('btn-main');
const btnFire = document.getElementById('btn-fire');
const btnSound = document.getElementById('btn-sound');
const hint = document.getElementById('hint');
const modeBadge = document.getElementById('mode-badge');
const tooltip = document.getElementById('door-tooltip');
const toastEl = document.getElementById('toast');
const deg = document.getElementById('degrees');
const btnWalk = document.getElementById('btn-walk');
const btnQuality = document.getElementById('btn-quality');

let renderer, scene, camera, composer, bloomPass, gradePass, fxaaPass, controls;
let textures, environment, cabin, smoke, snowfall, sky, mist, dust, forest, terrain, lighting, celebrationDecor;
let walk, blenderDetails = null, walkReturnMode = 'outside', birthday = null;
const invitation=mountBirthdayInvitation({photos:MEDIA.invitationPhotos||[],onEnter(){
  app.inert=false;
  birthday?.enter();
}});
const sound = new Soundscape();
let mode = 'outside';
let transition = null;
let firstFrame = true;
let toastTimer = 0;
let lowGraphics = new URLSearchParams(location.search).get('quality') === 'low';
let qualityChoice='auto',qualityLevel=lowGraphics?'low':innerWidth<700?'balanced':'high',qualityChangedAt=-100,introMotion=true,introAge=0,shadowDirty=true;
// Keep at least one rendered pixel per CSS pixel in every preset. The low
// preset reduces geometry, particles, bloom and shadows instead of smearing
// the whole scene (including the birthday lettering) below native resolution.
const QUALITY={high:{dpr:1.5,samples:4,shadow:2048},balanced:{dpr:1.25,samples:2,shadow:1024},low:{dpr:1,samples:0,shadow:512}};
const renderSize={width:0,height:0,pixelRatio:0,devicePixelRatio:0};
const renderBufferSize=new THREE.Vector2(),renderLogicalSize=new THREE.Vector2();
const renderViewport=new THREE.Vector4(),renderPhysicalViewport=new THREE.Vector4();
function getRenderCssSize(){
  // The app is the layout authority: window.innerWidth can differ from the
  // actual canvas host during browser zoom, side panels and viewport changes.
  return {width:Math.max(1,Math.round(app.clientWidth||window.innerWidth||1)),height:Math.max(1,Math.round(app.clientHeight||window.innerHeight||1))};
}
function getRenderPixelRatio(){
  return Math.max(1,Math.min(Number(window.devicePixelRatio)||1,QUALITY[qualityLevel].dpr));
}
function syncRenderSize(force=false){
  if(!renderer)return false;
  const {width,height}=getRenderCssSize(),devicePixelRatio=Number(window.devicePixelRatio)||1,pixelRatio=getRenderPixelRatio();
  if(!force&&renderSize.width===width&&renderSize.height===height&&renderSize.pixelRatio===pixelRatio&&renderSize.devicePixelRatio===devicePixelRatio)return false;
  // r160 setPixelRatio() changes only the drawing buffer, and setSize()'s
  // default writes fixed inline CSS pixels. Do not leave either size behind.
  renderer.setRenderTarget(null);
  if(renderer.getPixelRatio()!==pixelRatio)renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width,height,false);
  canvas.style.width='100%';canvas.style.height='100%';
  renderer.setViewport(0,0,width,height);
  renderer.setScissor(0,0,width,height);renderer.setScissorTest(false);
  renderer.getDrawingBufferSize(renderBufferSize);
  // Composer's width is physical pixels here, with its own DPR fixed at one.
  // This exactly matches renderer's floored buffer size even at fractional
  // DPR, and cannot accidentally multiply an already physical size again.
  if(composer){composer.setPixelRatio(1);composer.setSize(renderBufferSize.x,renderBufferSize.y);}
  if(fxaaPass)fxaaPass.uniforms.resolution.value.set(1/renderBufferSize.x,1/renderBufferSize.y);
  if(camera){camera.aspect=width/height;if(!walk?.active&&!transition&&mode==='outside')camera.fov=outsideFov();camera.updateProjectionMatrix();}
  Object.assign(renderSize,{width,height,pixelRatio,devicePixelRatio});
  syncPointScale();return true;
}
function renderWorld(){
  syncRenderSize();
  // All post passes must finish on the entire default framebuffer. Reset
  // viewport/scissor explicitly so an auxiliary render cannot leave a crop.
  renderer.setRenderTarget(null);renderer.setScissorTest(false);
  renderer.setViewport(0,0,renderSize.width,renderSize.height);
  composer.render();
}
function renderSizingStats(){
  const gl=renderer.getContext();
  renderer.getSize(renderLogicalSize);renderer.getDrawingBufferSize(renderBufferSize);
  renderer.getViewport(renderViewport);renderer.getCurrentViewport(renderPhysicalViewport);
  const target=composer?.renderTarget1,otherTarget=composer?.renderTarget2;
  const cssSize=[app.clientWidth,app.clientHeight],canvasCssSize=[canvas.clientWidth,canvas.clientHeight];
  const bufferSize=renderBufferSize.toArray(),glBufferSize=[gl.drawingBufferWidth,gl.drawingBufferHeight];
  const targetSize=target?[target.width,target.height]:null;
  return {cssSize,canvasCssSize,logicalSize:renderLogicalSize.toArray(),bufferSize,canvasSize:[canvas.width,canvas.height],glBufferSize,
    composerTargetSize:targetSize,composerOtherTargetSize:otherTarget?[otherTarget.width,otherTarget.height]:null,composerPixelRatio:1,
    viewport:renderViewport.toArray(),physicalViewport:renderPhysicalViewport.toArray(),targetViewport:target?.viewport.toArray(),scissorTest:renderer.getScissorTest(),
    devicePixelRatio:Number(window.devicePixelRatio)||1,
    fullViewport:cssSize[0]===canvasCssSize[0]&&cssSize[1]===canvasCssSize[1]&&bufferSize[0]===canvas.width&&bufferSize[1]===canvas.height&&bufferSize[0]===glBufferSize[0]&&bufferSize[1]===glBufferSize[1]&&targetSize?.[0]===bufferSize[0]&&targetSize?.[1]===bufferSize[1]&&renderViewport.x===0&&renderViewport.y===0&&renderViewport.z===cssSize[0]&&renderViewport.w===cssSize[1]&&renderPhysicalViewport.z===bufferSize[0]&&renderPhysicalViewport.w===bufferSize[1]&&!renderer.getScissorTest()};
}
function invalidateShadows(reason='all'){shadowDirty=true;lighting?.invalidateShadows(reason);}
function syncPointScale(){const p=renderer.getPixelRatio();sky?.setPixelRatio?.(p);forest?.setPixelRatio?.(p);birthday?.effects.setPixelRatio?.(p);snowfall?.setPixelRatio?.(p);}
let slowSamples=0,lastShadowTime=-1,lastMoonShadowTime=-1,qualityClock=0;
const doorPerformance={requests:0,movingFrames:0,maxMovingFrameMs:0,lastMovingFrameMs:0,programsAtReady:0,programsAddedDuringMoves:0,programsAfterWarmup:0};
let previousDoorMoving=false,previousProgramCount=0;
const doorwayPerformance={zoneTransitions:0,frames:0,maxFrameMs:0,programsAdded:0};
let doorwayWatchUntil=0,previousDoorwayWatching=false,lastInsideForDoorway=false;

const OUTSIDE_POSE = {
  pos: new THREE.Vector3(15.2, 7.1, 26.6),
  target: new THREE.Vector3(0.0, 3.2, 0.6)
};
const outsideFov=()=>{const {width,height}=getRenderCssSize();return width/height<.78?64:46;};

function toast(message, duration = 2600) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

function updateTemperature() {
  // A playful, slowly wandering winter temperature.
  const base = -13.5 + Math.sin(Date.now() / 90000) * 1.2;
  deg.textContent = `${base.toFixed(0)}°`;
}

function init() {
  const t0 = performance.now();
  let stageIndex=0;const stages=['renderer','textures','environment','cabin','lights+envmap','post+controls','pre-render','first render'];
  const loadingLines=['邀请，写给唯一的你','将回忆，收藏进这一夜','等星光落满窗前','让童话拥有家的模样','把祝福藏进每一处微光','你喜欢的，值得被记住','愿21岁的每一天，都被温柔以待','童话已为你展开'];
  const mark=(label)=>{app.dataset.loadStage=label;stageIndex=Math.max(stageIndex,stages.indexOf(label)+1);invitation.setProgress({progress:stageIndex/stages.length,stage:loadingLines[stageIndex-1]});console.log('[cabin] '+label+' +'+Math.round(performance.now()-t0)+'ms');};
  const breathe=()=>new Promise(resolve=>setTimeout(resolve,25));
  return (async () => {
  invitation.setProgress({progress:0,stage:'将回忆，收藏进这一夜'});
  await breathe();
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'default',
    stencil: false
  });
  if(renderer.capabilities.maxTextureSize<4096||(navigator.deviceMemory&&navigator.deviceMemory<4))qualityLevel='low';
  syncRenderSize(true);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.info.autoReset = false;
  mark('renderer');await breathe();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1420);
  scene.fog = new THREE.FogExp2(0x0b1723, 0.0125);

  camera = new THREE.PerspectiveCamera(outsideFov(), window.innerWidth / window.innerHeight, 0.08, 240);
  camera.position.copy(OUTSIDE_POSE.pos);
  camera.lookAt(OUTSIDE_POSE.target);

  textures = await loadSceneTextures();
  mark('textures');
  await breathe();

  sky = createSky(scene);
  createMountains(scene);
  terrain = createTerrain(scene, textures);
  createPath(scene, textures);
  forest = createForest(scene, textures);
  mist = createGroundMist(scene, textures);
  mark('environment');
  await breathe();

  cabin = buildCabin(scene, textures);
  blenderDetails = await loadBlenderDetails(scene, textures);
  smoke = createSmoke(scene, textures, cabin.smokeOrigin);
  mark('cabin');
  await breathe();

  snowfall = createSnowfall(scene, textures);
  createDust();
  createLighting();
  createEnvironmentMap();
  mark('lights+envmap');
  await breathe();

  // Snow-softening bump on the ground material after textures are in place
  terrain.mat.envMapIntensity = 0.55;

  setupPost();
  setupControls();
  setupWalking();
  for (const tree of forest.placements) walk.addCollider('pine trunk',tree.x,tree.z,.20*(tree.s||tree.scale||1),-2,20);
  setupUI();
  setupDoorInteraction();
  bindEvents();
  birthday = setupBirthdayGame({scene,camera,renderer,textures,walk,controls,cabin,sound,toast,smoke,snowfall,saveKeepsake});
  celebrationDecor = createCelebrationDecor({scene,textures});
  mark('post+controls');
  await Promise.all([birthday.world.ready.catch(()=>{}),birthday.gallery.ready]);
  // Source snapshots support the separate Blender export and CPU asset audit.
  // The live world renders the shared geometry and can release those copies.
  scene.traverse(o=>{delete o._v4SourceGeometry;delete o._v4SourceMaterial;delete o._v4SourceBatches;delete o._v4TextSource;});
  await breathe();

  // Warm interior window spill: real spotlights over the porch and snow.
  addWindowSpill(-3.55, 3.66, 0, 14);
  addWindowSpill(2.38, 3.66, 0, 20);
  lighting=manageLighting(scene);lighting.update(false,.1,0,camera.position);setQuality(qualityLevel,true);qualityChangedAt=-100;syncPointScale();

  // First render + fade
  mark('pre-render');
  await birthday.effects.prepare(renderer);
  await breathe();
  // Texture uploads and the first indoor draw belong to the loading screen,
  // not the first push on the door. Both views use the same fixed light slots.
  const uploadTextures=new Set();
  scene.traverse(o=>{for(const material of (Array.isArray(o.material)?o.material:[o.material]))if(material){for(const value of Object.values(material))if(value?.isTexture)uploadTextures.add(value);for(const uniform of Object.values(material.uniforms||{}))if(uniform?.value?.isTexture)uploadTextures.add(uniform.value);}});
  let uploaded=0;for(const texture of uploadTextures){renderer.initTexture(texture);if(++uploaded%12===0)await breathe();}
  lighting.flushShadows(true);
  renderWorld();
  const outsidePosition=camera.position.clone(),outsideQuaternion=camera.quaternion.clone(),outsideFovValue=camera.fov;
  camera.position.copy(cabin.interiorCamera);camera.lookAt(cabin.interiorTarget);camera.fov=55;camera.updateProjectionMatrix();
  lighting.update(true,0,0,camera.position);lighting.invalidateShadows();lighting.flushShadows(true);renderer.shadowMap.needsUpdate=true;
  renderWorld();await breathe();
  camera.position.copy(outsidePosition);camera.quaternion.copy(outsideQuaternion);camera.fov=outsideFovValue;camera.updateProjectionMatrix();
  lighting.update(false,0,0,camera.position);lighting.invalidateShadows();lighting.flushShadows(true);renderer.shadowMap.needsUpdate=true;
  renderWorld();
  doorPerformance.programsAtReady=doorPerformance.programsAfterWarmup=renderer.info.programs?.length||0;previousProgramCount=doorPerformance.programsAtReady;
  mark('first render');
  // The forest and cabin are static, so the only thing that needs to refresh
  // its shadow map is the opening door. This keeps the scene fluid.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = false;
    setTimeout(() => {
      app.classList.add('ready');
      birthday.ready();
      invitation.setReady();
      // The birthday invitation opens the experience after the scene is ready.
    }, 320);

  window.__CABIN__ = {
    scene, renderer, cabin, smoke, snowfall,
    camera,
    walk,
    get mode() { return mode; },
    get transitioning() { return !!transition; },
    stats() {
      return {
        mode,
        transitioning: !!transition,
        door: cabin.getDoorAmount(),
        walking: !!walk?.active,
        walk: walk?.getState(),
        blenderProps: !!blenderDetails,
        shadowLights: (()=>{let n=0;scene.traverse(o=>{if(o.isLight&&o.castShadow)n++;});return n;})(),
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        lights: scene.children.filter(o => o.isLight).length,
        dpr: renderer.getPixelRatio(),quality:qualityLevel,lightBudget:lighting?.stats(),forest:forest?.getStats?.(),
        fps: +fps.toFixed(1),
        camera: camera.position.toArray().map(n => +n.toFixed(2))
      };
    },
    openDoor() { cabin.setDoor(true); },
    closeDoor() { cabin.setDoor(false); },
    doorScreen() {
      const v = new THREE.Vector3();
      cabin.doorClick.getWorldPosition(v);
      v.project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v.y * 0.5 + 0.5) * window.innerHeight,
        inFront: v.z < 1
      };
    },
    enter: enterCabin,
    exit: exitCabin,
    addFire() { addFire(); },
    setLowGraphics(v) { setQuality(v?"low":"high",true); },
    controls,
    composer,
    bloomPass,
    gradePass
  };
  window.__BIRTHDAY__ = {stats:()=>birthday.stats()};
  window.__CABIN__.exportCabin = async () => {
    const root = new THREE.Group();
    root.name = 'Winter_Cabin_Blender_Assembly';
    root.add(cabin.group.clone(true));
    if(blenderDetails?.group) root.add(blenderDetails.group.clone(true));
    root.traverse(o => {
      if (o.isSprite || o.isPoints || o.isLine || (o.isMesh && (Array.isArray(o.material) ? o.material : [o.material]).some(m=>m?.isShaderMaterial))) o.visible=false;
    });
    const glb = await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true,maxTextureSize:512});
    const bytes = new Uint8Array(glb);let result='';
    for(let i=0;i<bytes.length;i+=32768) result += String.fromCharCode(...bytes.subarray(i,i+32768));
    return btoa(result);
  };

  animate(performance.now());
  })();
}

function createLighting() {
  const hemi = new THREE.HemisphereLight(0xb8c9e4, 0x7e6052, 1.02);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xe5c4b6, 0.24);
  scene.add(ambient);

  const moon = new THREE.DirectionalLight(0xa7c4ff, 1.8);
  moon.position.set(-26, 34, -30);
  moon.target.position.set(0, 1.5, 0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -22;
  moon.shadow.camera.right = 22;
  moon.shadow.camera.top = 23;
  moon.shadow.camera.bottom = -18;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 90;
  moon.shadow.bias = -0.00045;
  moon.shadow.normalBias = 0.045;
  scene.add(moon, moon.target);
  // A broad, warm forecourt bounce lights timber, ribbons and pearl balloons.
  // It has no shadow map; the moon and lanterns retain the directional detail.
  const partyFill=new THREE.SpotLight(0xffd3b2,78,29,1.08,.86,2);
  partyFill.name='Celebration facade warm fill';partyFill.userData.lightZone='outdoor';partyFill.userData.celebrationPriority=5;
  partyFill.position.set(5.8,7.6,12.3);partyFill.target.position.set(0,2.8,2.0);
  scene.add(partyFill,partyFill.target);
}

function addWindowSpill(x, z, rotY, intensity) {
  const spot = new THREE.SpotLight(0xffb36e, intensity, 11, 0.72, 0.9, 2);
  spot.position.set(x, 2.1, z);
  spot.target.position.set(x + Math.sin(rotY) * 2.8, 0.12, z + Math.cos(rotY) * 2.8);
  spot.castShadow = x > 0;
  if (spot.castShadow) {
    spot.position.z -= .58;
    spot.position.y = 2.35;
    spot.target.position.set(x+.35,.08,z+4.2);
    spot.intensity = 36;
    spot.shadow.mapSize.set(lowGraphics?512:1024,lowGraphics?512:1024);
    spot.shadow.camera.near=.12;spot.shadow.camera.far=12;
    spot.shadow.bias=-.00015;spot.shadow.normalBias=.012;
  }
  scene.add(spot, spot.target);
}

function createEnvironmentMap() {
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    const geo = new THREE.SphereGeometry(50, 32, 20);
    const mat = sky.skyMat.clone();
    const sphere = new THREE.Mesh(geo, mat);
    envScene.add(sphere);
    const rt = pmrem.fromScene(envScene, 0.02);
    scene.environment = rt.texture;
    geo.dispose(); mat.dispose(); pmrem.dispose();
  } catch (e) {
    console.warn('Environment map unavailable', e);
  }
}

function createDust() {
  const count = 180;
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 8.2;
    pos[i * 3 + 1] = 0.8 + Math.random() * 2.8;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 5.8;
    phase[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.PointsMaterial({
    map: textures.glowSoft, color: 0xffd8a4, size: 0.025,
    transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending,
    depthWrite: false, sizeAttenuation: true
  });
  dust = new THREE.Points(geo, mat);
  dust.frustumCulled = false;
  scene.add(dust);
}

function setupPost() {
  const {x:w,y:h}=renderer.getDrawingBufferSize(renderBufferSize);
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    samples: renderer.capabilities.isWebGL2 ? QUALITY[qualityLevel].samples : 0
  });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.54, 0.44, 0.78);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  gradePass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uTime;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(0.299,0.587,0.114));
        // cool the shadows a touch, keep the fire honey-warm
        c.rgb = mix(c.rgb, c.rgb * vec3(0.98,0.99,1.025), (1.0-smoothstep(0.02,0.36,l))*0.12);
        c.rgb += vec3(0.014,0.011,0.012) * pow(1.0-l,2.0);
        c.rgb = mix(c.rgb, c.rgb * vec3(1.05,1.00,0.92), smoothstep(0.58,1.0,l)*0.22);
        float vig = 1.0-smoothstep(0.38, 1.18, length(vUv - 0.5) * 1.35);
        c.rgb *= mix(0.94, 1.0, vig);
        float grain = fract(sin(dot(vUv * vec2(1280.0, 720.0) + uTime, vec2(12.9898, 78.233))) * 43758.5453);
        c.rgb += (grain - 0.5) * 0.006;
        gl_FragColor = c;
      }
    `
  });
  // Grade and its fine grain remain after antialiasing.
  // ANGLE clamps texture LOD bias to -16. Use the valid equivalent directly.
  fxaaPass=new ShaderPass({...FXAAShader,fragmentShader:FXAAShader.fragmentShader.replaceAll('-100.0','-16.0')});
  fxaaPass.uniforms.resolution.value.set(1/w,1/h);
  // Full-frame FXAA noticeably softened small Chinese glyphs and serifs in
  // the low preset. Native pixels are preferable; WebGL2 presets use MSAA.
  fxaaPass.enabled=false;composer.addPass(fxaaPass);composer.addPass(gradePass);
}

function setupControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(OUTSIDE_POSE.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.052;
  controls.enablePan = false;
  controls.minDistance = 8.5;
  controls.maxDistance = 40;
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = 1.46;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.72;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.28;
  controls.update();
  controls.addEventListener('start', () => {
    controls.autoRotate = false;introMotion=false;
  });
}

/* ------------------------------------------------------------------ */
/*  UI & interaction wiring                                           */
/* ------------------------------------------------------------------ */
function setupUI() {
  btnMain.addEventListener('click', () => {
    if (walk?.active) { walk.interact(); return; }
    if (transition) return;
    if (mode === 'outside') enterCabin();
    else exitCabin();
  });
  btnFire.addEventListener('click', () => {
    addFire();
  });
  btnSound.addEventListener('click', async () => {
    const next = !sound.enabled;
    const ok = await sound.setEnabled(next);
    if (!ok) { toast('当前浏览器不支持音频'); return; }
    btnSound.classList.toggle('on', next);
    btnSound.setAttribute('aria-pressed', String(next));
    btnSound.querySelector('span').textContent = next ? '声音开' : '声音关';
    birthday?.syncAudio?.();toast(next ? '环境声已开启' : '已静音');
  });
  btnWalk.addEventListener('click', () => {
    if (transition) { toast('等脚步停下，再开始漫步'); return; }
    if (walk.active) walk.stop();
    else walk.start();
  });
  btnQuality.addEventListener('click', () => {
    qualityChoice=['auto','high','balanced','low'][(['auto','high','balanced','low'].indexOf(qualityChoice)+1)%4];
    setQuality(qualityChoice==='auto'?(innerWidth<700?'balanced':'high'):qualityChoice);
  });
  btnQuality.textContent=lowGraphics?'画质 · 流畅':'画质 · 自适应';
  bindTouchWalking();
  updateTemperature();
  setInterval(updateTemperature, 30000);
}

function setupWalking() {
  walk = createWalkController({camera,canvas,orbitControls:controls,cabin,toast,
    onInteract(){return birthday?.interact() || false;},
    onEscape(){return birthday?.handleEscape?.()||false;},
    onInsideChange(inside){mode=inside?'inside':'outside';setUIMode(mode);sound.setInside(inside);},
    onExit(){
      mode=walkReturnMode;app.classList.remove('walking');
      btnWalk.querySelector('span').textContent='自由漫步';btnMain.disabled=false;
      setUIMode(mode);sound.setInside(mode==='inside');
    }
  });
  const start=walk.start;
  walk.start=(...args)=>{
    if(transition){toast('等脚步停下，再开始漫步');return;}
    if(walk.active)return;
    walkReturnMode=mode;
    const value=start(...args);
    app.classList.add('walking');btnWalk.querySelector('span').textContent='回到观景';
    tooltip.classList.remove('show');
    toast('WASD 移动 · 拖动环视 · E 轻触物件、回忆或木门 · Esc 观景',5200);
    return value;
  };
}
function setQuality(q,quiet=false) {
  qualityLevel=q;qualityChangedAt=qualityClock;lowGraphics=q==='low';const config=QUALITY[q];
  // Reuse passes and shader programs when changing preset. Only framebuffer
  // sample allocation and sizes change, avoiding another full shader warmup.
  if(!composer)setupPost();
  const samples=renderer.capabilities.isWebGL2?config.samples:0;
  for(const target of [composer.renderTarget1,composer.renderTarget2])if(target.samples!==samples){target.samples=samples;target.dispose();}
  syncRenderSize(true);
  scene.traverse(o=>{if(o.isLight&&o.shadow&&(o.shadow.mapSize.x!==config.shadow||o.shadow.mapSize.y!==config.shadow)){o.shadow.mapSize.set(config.shadow,config.shadow);o.shadow.map?.dispose();o.shadow.map=null;}});
  sky?.setQuality?.(q);terrain?.setQuality?.(q);forest?.setQuality?.(q);snowfall?.setQuality?.(q);birthday?.effects.setQuality(q);birthday?.gallery.setQuality(q);syncPointScale();invalidateShadows();
  bloomPass.enabled=q!=='low';const label={high:'细腻',balanced:'均衡',low:'流畅'}[q];btnQuality.textContent='画质 · '+label+(qualityChoice==='auto'?'（自动）':'');btnQuality.setAttribute('aria-label','切换画质，当前'+label);
  if(!quiet)toast('已切换'+label+'画质',2200);
}
function saveKeepsake(){
  renderWorld();const image=renderer.domElement,c=document.createElement('canvas');c.width=1920;c.height=1080;const ctx=c.getContext('2d');ctx.fillStyle='#0b1723';ctx.fillRect(0,0,c.width,c.height);
  const scale=Math.max(c.width/image.width,c.height/image.height),w=image.width*scale,h=image.height*scale;ctx.drawImage(image,(c.width-w)/2,(c.height-h)/2,w,h);
  const g=ctx.createLinearGradient(0,690,0,1080);g.addColorStop(0,'transparent');g.addColorStop(1,'#07121ee8');ctx.fillStyle=g;ctx.fillRect(0,690,1920,390);ctx.textAlign='center';ctx.fillStyle='#f5dfbc';ctx.font='44px Georgia,"KaiTi",serif';ctx.fillText('明年，还想和你一起看雪。',960,930);ctx.font='23px Georgia,serif';ctx.fillText('2026.10.29 · FOR LILY',960,996);
  document.querySelector('.keepsake-preview')?.remove();
  const panel=document.createElement('section');panel.className='keepsake-preview';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','这一夜的纪念图');panel.setAttribute('aria-modal','true');
  const picture=document.createElement('img');picture.src=c.toDataURL('image/png');picture.alt='2026年10月29日，给 Lily 的雪夜纪念图';
  const a=document.createElement('a');a.download='2026-10-29-雪夜.png';a.href=picture.src;a.textContent='下载纪念图';
  const close=document.createElement('button');close.textContent='回到雪夜';close.onclick=()=>{panel.remove();walk.setPaused(false);};
  const note=document.createElement('p');note.textContent='1920 × 1080 · 也可以长按图片保存';panel.append(picture,note,a,close);document.body.append(panel);walk.setPaused(true);close.focus();
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close.click();}});toast('纪念图已生成，可以下载或长按保存。',3000);
}
function bindTouchWalking(){
  const held=new Set();
  const sync=()=>walk.setMoveInput((held.has('right')?1:0)-(held.has('left')?1:0),(held.has('up')?1:0)-(held.has('down')?1:0));
  document.querySelectorAll('[data-move]').forEach(b=>{
    b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);held.add(b.dataset.move);sync();});
    const end=()=>{held.delete(b.dataset.move);sync();};
    b.addEventListener('pointerup',end);b.addEventListener('pointercancel',end);b.addEventListener('lostpointercapture',end);
  });
  window.addEventListener('blur',()=>{held.clear();sync();});
}

function setUIMode(next) {
  if (next === 'inside') {
    app.classList.add('inside');
    btnMain.querySelector('span').textContent = '回到雪林';
    btnMain.classList.add('secondary');
    modeBadge.textContent = '屋内 · 炉火正暖';
    hint.innerHTML = '拖动环视 · 滚轮靠近 · <kbd>Esc</kbd> 回到雪林';
    btnFire.classList.add('visible');
  } else {
    app.classList.remove('inside');
    btnMain.querySelector('span').textContent = '推门而入';
    btnMain.classList.remove('secondary');
    modeBadge.textContent = '松林雪夜 · 炉火已燃';
    hint.innerHTML = '拖动环视 · 滚轮拉近 · 点击木门进屋';
    btnFire.classList.remove('visible');
  }
}

function addFire() {
  if (!cabin) return;
  cabin.flickerFire();
  sound.creak();
  toast('添了一把干柴，炉火更旺了', 2400);
  const btn = btnFire;
  btn.classList.add('pulse');
  setTimeout(() => btn.classList.remove('pulse'), 700);
}

function setupDoorInteraction() {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downX = 0, downY = 0, downTime = 0;
  let hoverDoor = false;
  const hitDoor = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(cabin.doorMeshes, false);
    return hits.length > 0;
  };
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (walk?.active) { tooltip.classList.remove('show');return; }
    if (transition) { tooltip.classList.remove('show'); return; }
    const hit = hitDoor(e);
    hoverDoor = hit;
    renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    if (hit && mode === 'outside') {
      tooltip.classList.add('show');
      tooltip.style.left = `${e.clientX}px`;
      tooltip.style.top = `${e.clientY}px`;
      tooltip.querySelector('span').textContent = cabin.getDoorAmount() > 0.4 ? '走进暖屋' : '轻推木门';
    } else {
      tooltip.classList.remove('show');
    }
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    tooltip.classList.remove('show');
    renderer.domElement.style.cursor = 'grab';
  });
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if(e.isPrimary===false){downTime=-1e9;return;}downX = e.clientX; downY = e.clientY; downTime = performance.now();
    if (walk?.active) return;
    controls.autoRotate = false;
    renderer.domElement.style.cursor = 'grabbing';
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    renderer.domElement.style.cursor = hoverDoor ? 'pointer' : 'grab';
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved > 7 || performance.now() - downTime > 800) return;
    if (walk?.active) return;
    if (transition) return;
    if (mode !== 'outside') return;
    if (hitDoor(e)) {
      if (cabin.getDoorAmount() < 0.35) {
        cabin.setDoor(true);
        sound.creak();
        hint.innerHTML = '木门开了 · 再点一次，或者按「推门而入」';
        toast('门轴吱呀一声，暖光从屋里漫了出来', 3000);
      } else {
        enterCabin();
      }
    }
  });
}

function enterCabin() {
  if (walk?.active) { toast('先结束自由漫步，再切换观景');return; }
  if (transition) return;
  if (mode === 'inside') return;
  cabin.setDoor(true);
  sound.creak();
  sound.setInside(true);
  controls.autoRotate = false;
  controls.enabled = false;
  mode = 'entering';
  const fromPos = camera.position.clone();
  const path = new THREE.CatmullRomCurve3([
    fromPos,
    new THREE.Vector3(-1.4, 2.4, 9.4),
    new THREE.Vector3(-1.58, 2.0, 4.85),
    new THREE.Vector3(-1.58, 1.76, 3.45),
    cabin.interiorCamera.clone()
  ]);
  transition = {
    type: 'enter',
    t: 0,
    duration: 4.7,
    path,
    fromTarget: controls.target.clone(),
    toTarget: cabin.interiorTarget.clone(),
    fovFrom: camera.fov,
    fovTo: 55
  };
  btnMain.querySelector('span').textContent = '正在走进…';
  btnMain.disabled = true;
  hint.innerHTML = '门开了 · 沿着暖光走进去';
  tooltip.classList.remove('show');
}

function exitCabin() {
  if (walk?.active) { toast('先结束自由漫步，再切换观景');return; }
  if (transition) return;
  if (mode === 'outside') return;
  cabin.setDoor(true);
  sound.setInside(false);
  controls.enabled = false;
  controls.autoRotate = false;
  mode = 'exiting';
  const fromPos = camera.position.clone();
  const path = new THREE.CatmullRomCurve3([
    fromPos,
    new THREE.Vector3(-1.55, 1.8, 2.55),
    new THREE.Vector3(-1.55, 1.95, 3.55),
    new THREE.Vector3(-1.2, 2.6, 8.0),
    OUTSIDE_POSE.pos.clone()
  ]);
  transition = {
    type: 'exit',
    t: 0,
    duration: 4.2,
    path,
    fromTarget: controls.target.clone(),
    toTarget: OUTSIDE_POSE.target.clone(),
    fovFrom: camera.fov,
    fovTo: outsideFov(),
    closedDoor: false
  };
  btnMain.querySelector('span').textContent = '正在离开…';
  btnMain.disabled = true;
  hint.innerHTML = '门在身后轻轻合上';
}

function finishTransition() {
  if (!transition) return;
  if (transition.type === 'enter') {
    mode = 'inside';
    camera.position.copy(cabin.interiorCamera);
    camera.fov = 55;
    camera.updateProjectionMatrix();
    controls.target.copy(cabin.interiorTarget);
    controls.minDistance = 2.0;
    controls.maxDistance = 5.2;
    controls.minPolarAngle = 0.78;
    controls.maxPolarAngle = 1.53;
    controls.enabled = true;
    controls.update();
    btnMain.disabled = false;
    setUIMode('inside');
    toast('坐下烤烤火吧。点击右侧火焰，还能添柴', 4200);
    sound.setInside(true);
  } else {
    mode = 'outside';
    camera.position.copy(OUTSIDE_POSE.pos);
    camera.fov = outsideFov();
    camera.updateProjectionMatrix();
    controls.target.copy(OUTSIDE_POSE.target);
    controls.minDistance = 8.5;
    controls.maxDistance = 26;
    controls.minPolarAngle = 0.55;
    controls.maxPolarAngle = 1.46;
    controls.enabled = true;
    controls.autoRotate = false;
    controls.update();
    btnMain.disabled = false;
    setUIMode('outside');
    toast('雪还在下。小屋里，火会一直亮着', 3600);
    sound.setInside(false);
  }
  transition = null;
}

function bindEvents() {
  window.addEventListener('keydown', (e) => {
    if(!document.body.classList.contains('gift-started'))return;
    if(e.key==='Escape'&&birthday?.handleEscape?.()){e.preventDefault();return;}
    if(birthday?.isReading)return;
    if (walk?.active) { if(e.key.toLowerCase()==='f'&&mode==='inside')addFire();return; }
    if (e.key === 'Escape' && mode === 'inside' && !transition) exitCabin();
    if (e.key === 'Enter' && mode === 'outside' && !transition) enterCabin();
    if ((e.key === 'f' || e.key === 'F') && mode !== 'outside' && !transition) addFire();
  });
  window.addEventListener('resize', onResize);
  // Zoom/DPR changes can arrive separately from window.resize on Windows.
  // The cheap frame check below also catches monitor moves and missed events.
  window.visualViewport?.addEventListener('resize',onResize);
  document.addEventListener('visibilitychange',()=>{
    if(!loopStarted)return;
    cancelAnimationFrame(frameRequest);clearTimeout(backgroundRequest);
    queueFrame();
  });
}

function onResize() {
  syncRenderSize(true);
}

/* ------------------------------------------------------------------ */
/*  ANIMATION                                                         */
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();
let elapsed = 0;
let frames = 0;
let fpsTime = 0;
let fps = 0;
let lastDoorAmount = 0;
let frameRequest=0,backgroundRequest=0,loopStarted=false;
function queueFrame(){
  if(document.hidden)backgroundRequest=setTimeout(()=>animate(performance.now()),100);
  else frameRequest=requestAnimationFrame(animate);
}

function animate(now) {
  loopStarted=true;queueFrame();
  const rawDt = clock.getDelta();
  if(document.hidden)return;
  syncRenderSize();
  qualityClock+=Math.min(rawDt,1);
  const dt = Math.min(rawDt, 0.05);
  const flowDt = Math.min(rawDt, 0.12);
  elapsed += dt;
  frames++; fpsTime += rawDt;
  if (fpsTime > 1) {
    fps = frames / fpsTime; frames = 0; fpsTime = 0;
    app.dataset.fps = String(Math.round(fps));
    if(birthday)app.dataset.birthday = JSON.stringify(birthday.stats());
    if(walk)app.dataset.walk=JSON.stringify(walk.getState());
    app.dataset.render=JSON.stringify({fps:+fps.toFixed(1),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,dpr:renderer.getPixelRatio(),quality:qualityLevel,lights:lighting?.stats(),programCount:renderer.info.programs?.length||0,door:{...doorPerformance,amount:+cabin.getDoorAmount().toFixed(5),target:cabin.doorState.target,moving:cabin.doorState.moving,velocity:+cabin.doorState.velocity.toFixed(5)},doorway:{...doorwayPerformance,watching:previousDoorwayWatching},celebration:celebrationDecor?.getStats(),...renderSizingStats()});
    if(qualityChoice==='auto'&&qualityClock>6){slowSamples=fps<28?slowSamples+1:0;const ranks=['low','balanced','high'],rank=ranks.indexOf(qualityLevel);if(slowSamples>=2&&rank>0&&qualityClock-qualityChangedAt>20)setQuality(fps<15?'low':ranks[rank-1],true);else if(fps>56&&rank<2&&qualityClock-qualityChangedAt>60)setQuality(ranks[rank+1],true);}
  }

  if (walk?.active) {
    walk.update(flowDt,elapsed);
    const state=walk.getState();
    btnMain.querySelector('span').textContent=state.nearDoor?(cabin.doorState.target>.5?'关上木门':'推开木门'):'靠近木门';
    hint.innerHTML=state.inside?'靠近物件 · 点击或按 <kbd>E</kbd> 轻触 · 右上角可寻找小屋里的心意':'沿暖灯寻找「美好的回忆」 · <kbd>WASD</kbd> 移动 · 拖动环视';
    document.getElementById('walk-reticle').classList.toggle('near',state.nearDoor);
  } else if (transition) {
    transition.t += flowDt / transition.duration;
    const t = Math.min(1, transition.t);
    // extra-smooth ease for long camera moves
    const e = t * t * t * (t * (t * 6 - 15) + 10);
    camera.position.copy(transition.path.getPoint(e));
    const target = new THREE.Vector3().lerpVectors(transition.fromTarget, transition.toTarget, e);
    controls.target.copy(target);
    camera.lookAt(target);
    if (transition.fovFrom !== transition.fovTo) {
      camera.fov = THREE.MathUtils.lerp(transition.fovFrom, transition.fovTo, e);
      camera.updateProjectionMatrix();
    }
    if (transition.type === 'exit' && t > 0.58 && !transition.closedDoor) {
      cabin.setDoor(false);
      transition.closedDoor = true;
      setTimeout(() => sound.creak(), 250);
    }
    if (t >= 1) finishTransition();
  } else if (mode === 'inside') {
    // Keep the floating camera politely inside the room.
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -4.05, 4.05);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -2.7, 2.65);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 1.05, 2.95);
    controls.update();
  } else {
    controls.update();
  }

  if(!birthday?.stats().begun&&introMotion&&!matchMedia("(prefers-reduced-motion: reduce)").matches){introAge+=dt;const t=Math.min(1,introAge/12);camera.position.copy(OUTSIDE_POSE.pos).addScaledVector(new THREE.Vector3().subVectors(OUTSIDE_POSE.target,OUTSIDE_POSE.pos).normalize(),t*1.5);controls.update();}
  sky.update(elapsed);terrain?.update?.(elapsed);if(forest?.update?.(elapsed,camera))invalidateShadows('forest');
  celebrationDecor?.update(elapsed,dt);
  birthday?.update(rawDt,elapsed);
  mist.update(elapsed);
  snowfall.update(elapsed, renderer.getPixelRatio());
  smoke.update(flowDt, elapsed);
  cabin.update(elapsed, flowDt);
  if(birthday?.interior?.stats().animating||birthday?.loft?.stats().animating||birthday?.stats().touching)invalidateShadows('interior');
  const inside=walk?.getState().inside||mode==='inside';if(lighting?.update(inside,dt,birthday?.lightBeat,camera.position))invalidateShadows('interior');
  renderer.toneMappingExposure=THREE.MathUtils.damp(renderer.toneMappingExposure,inside?1.36:1.22,1.6,dt);
  if (dust) {
    const a = dust.geometry.attributes.position.array;
    const ph = dust.geometry.attributes.aPhase.array;
    for (let i = 0; i < ph.length; i++) {
      a[i * 3 + 1] += Math.sin(elapsed * 0.35 + ph[i]) * 0.0007;
      a[i * 3] += Math.cos(elapsed * 0.22 + ph[i]) * 0.0005;
    }
    dust.geometry.attributes.position.needsUpdate = true;
  }
  if (gradePass) gradePass.uniforms.uTime.value = elapsed;
  if (bloomPass) bloomPass.strength = .54;

  const doorAmount = cabin.getDoorAmount();
  const doorMoving=!!cabin.doorState.moving;
  if(inside!==lastInsideForDoorway){doorwayPerformance.zoneTransitions++;doorwayWatchUntil=elapsed+2;lastInsideForDoorway=inside;}
  if(doorMoving||transition)doorwayWatchUntil=elapsed+2;
  const doorwayWatching=elapsed<doorwayWatchUntil;
  if(previousDoorwayWatching||doorwayWatching){doorwayPerformance.frames++;doorwayPerformance.maxFrameMs=Math.max(doorwayPerformance.maxFrameMs,+(rawDt*1000).toFixed(2));}
  if(Math.abs(doorAmount-lastDoorAmount)>.0008){invalidateShadows('door');lastDoorAmount=doorAmount;}
  // Warm doorway maps follow the hinge. The expensive forest moon map is
  // cached through the motion and refreshed at the latch; interior idle no
  // longer forces every shadow map to redraw fifteen times per second.
  if(previousDoorMoving&&!doorMoving)invalidateShadows('all');
  const moonInterval=inside?.85:.35;
  if(elapsed-lastShadowTime>1/20&&shadowDirty){
    const includeMoon=!doorMoving&&elapsed-lastMoonShadowTime>moonInterval;
    if(lighting?.flushShadows(includeMoon))renderer.shadowMap.needsUpdate=true;
    if(includeMoon)lastMoonShadowTime=elapsed;
    shadowDirty=false;lastShadowTime=elapsed;
  }
  if(previousDoorMoving){const ms=rawDt*1000;doorPerformance.movingFrames++;doorPerformance.lastMovingFrameMs=+ms.toFixed(2);doorPerformance.maxMovingFrameMs=Math.max(doorPerformance.maxMovingFrameMs,+ms.toFixed(2));}
  doorPerformance.requests=cabin.doorState.requests;
  renderer.info.reset();
  renderWorld();
  const programs=renderer.info.programs?.length||0;
  if(previousDoorMoving||doorMoving)doorPerformance.programsAddedDuringMoves+=Math.max(0,programs-previousProgramCount);
  if(previousDoorwayWatching||doorwayWatching)doorwayPerformance.programsAdded+=Math.max(0,programs-previousProgramCount);
  previousProgramCount=programs;previousDoorMoving=doorMoving;previousDoorwayWatching=doorwayWatching;
  if (firstFrame) {
    firstFrame = false;
    app.classList.add('ready');
  }
}

/* ------------------------------------------------------------------ */
function boot() {
  try {
    init().catch(showBootError);
  } catch (err) {
    showBootError(err);
  }
}
function showBootError(err) {
  console.error(err);
  invitation.showError('童话世界暂时未能打开。请用较新的 Chrome 或 Edge 重试，并确认浏览器已开启硬件加速。'+(err?.message?'（'+err.message+'）':''));
}
// Let the painted loading screen appear before the synchronous scene build.
setTimeout(boot,60);
