import * as THREE from 'three';
import { createTactileHands } from './first-person-hands.js';

/** Birthday atmosphere, world-space fireworks, tactile hands and snow prints.
 * All animation is driven by the caller. Nothing here takes over the camera.
 * Fireworks and the birthday lettering are genuine world-space particles.
 */
export function createBirthdayEffects({ scene, camera, textures, terrainHeight = () => 0, lowGraphics = false }) {
  const group = new THREE.Group();
  group.name = 'Lily • birthday sky and footsteps';
  scene.add(group);
  const random = makeRandom(10292026);
  const clamp = THREE.MathUtils.clamp;
  const capacity = 28000; let particleBudget=lowGraphics?10000:22000, qualityName=lowGraphics?"low":"high";
  const positions = new Float32Array(capacity * 3);
  const origins = new Float32Array(capacity * 3);
  const velocities = new Float32Array(capacity * 3);
  const bornAt = new Float64Array(capacity);
  const colors = new Float32Array(capacity * 3);
  const lifetimes = new Float32Array(capacity);
  const ages = new Float32Array(capacity);
  const sizes = new Float32Array(capacity);
  const alphas = new Float32Array(capacity);
  const kinds = new Uint8Array(capacity);
  let cursor = 0, activeCount = 0, showTime = -1, eventCursor = 0;
  let launched = 0, exploded = 0, flashAmount = 0, elapsed = 0, showStartedAt = 0, pyroClock=0, paused=false, skipRemaining=0, uploadFrames=0, lastTrailCount=0, lastPyroCount=0, burstListener=null;
  // The final shells and their smoke finish before a slow meteor shower.
  // The handover is automatic and uses the same pausable show clock.
  const fireworksDuration = 49, wishDuration = 44, meteorOverlap = 0;
  const meteorStart = fireworksDuration - meteorOverlap;
  const celebrationDuration = fireworksDuration + wishDuration;
  const rockets = [];
  const palette = [
    new THREE.Color('#ff426f'), new THREE.Color('#ffb938'),
    new THREE.Color('#5affb6'), new THREE.Color('#44cfff'),
    new THREE.Color('#6485ff'), new THREE.Color('#bf75ff'),
    new THREE.Color('#ff7adc'), new THREE.Color('#fff1be')
  ];
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  particleGeometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));
  particleGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
  const particleMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.8) } },
    vertexShader: `
      attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
      varying vec3 vColor; varying float vAlpha; uniform float uPixelRatio;
      void main(){
        vec4 mv=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(aSize*310./max(1.,-mv.z),0.,46.)*uPixelRatio;
        vColor=aColor;vAlpha=aAlpha;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha;
      void main(){
        float r=length(gl_PointCoord-.5)*2.;
        if(r>1.||vAlpha<.004)discard;
        float halo=exp(-r*r*5.5)*.38;
        float core=exp(-r*r*42.)*.72;
        gl_FragColor=vec4(mix(vColor*1.15,vec3(1.35),core*.08),(halo+core)*vAlpha*.82);
      }`
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.name = 'Pooled pyrotechnic embers';
  particles.frustumCulled = false;
  particles.renderOrder = 7;
  group.add(particles);

  // Fine luminous filaments preserve the width of a real chrysanthemum shell.
  // Their endpoints use the same analytic ballistics as the ember heads, so
  // low frame rates cannot make the bursts shrink or freeze in a tiny circle.
  const trailCapacity = 18000; let trailBudget=lowGraphics?10000:18000;
  const trailPositions = new Float32Array(trailCapacity * 6);
  const trailColors = new Float32Array(trailCapacity * 6);
  const trailAlphas = new Float32Array(trailCapacity * 2);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setAttribute('aColor', new THREE.BufferAttribute(trailColors, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(trailAlphas, 1).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setDrawRange(0, 0);
  const trailMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aColor;attribute float aAlpha;varying vec3 vColor;varying float vAlpha;
      void main(){vColor=aColor;vAlpha=aAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vColor;varying float vAlpha;
      void main(){gl_FragColor=vec4(vColor*1.35,vAlpha*.53);}`
  });
  const trails = new THREE.LineSegments(trailGeometry, trailMaterial);
  trails.name = 'Wide pyrotechnic chrysanthemum filaments';
  trails.frustumCulled = false; trails.renderOrder = 7; group.add(trails);

  // A second, normally blended pool gives the bursts translucent residual smoke.
  const smokeCapacity = 90;
  const smokePos = new Float32Array(smokeCapacity * 3);
  const smokeAge = new Float32Array(smokeCapacity);
  const smokeLife = new Float32Array(smokeCapacity);
  const smokeSize = new Float32Array(smokeCapacity);
  const smokeAlpha = new Float32Array(smokeCapacity);
  let smokeCursor = 0;
  const smokeGeometry = new THREE.BufferGeometry();
  smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePos, 3).setUsage(THREE.DynamicDrawUsage));
  smokeGeometry.setAttribute('aSize', new THREE.BufferAttribute(smokeSize, 1).setUsage(THREE.DynamicDrawUsage));
  smokeGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(smokeAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  const smokeMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms:{uPixelRatio:{value:1}},
    vertexShader: `attribute float aSize;attribute float aAlpha;varying float vAlpha;uniform float uPixelRatio;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;
        gl_PointSize=clamp(aSize*290./max(1.,-p.z),0.,150.)*uPixelRatio;vAlpha=aAlpha;}`,
    fragmentShader: `varying float vAlpha;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;
        float n=sin(p.x*24.+sin(p.y*17.))*sin(p.y*21.)*.09;
        float a=smoothstep(1.,.13,r+n)*vAlpha;
        gl_FragColor=vec4(.20,.23,.29,a);}`
  });
  const smoke = new THREE.Points(smokeGeometry, smokeMaterial);
  smoke.frustumCulled = false;
  smoke.renderOrder = 6;
  group.add(smoke);

  const flash = new THREE.PointLight(0xffcbb5, 0, 160, 2); flash.name="Firework sky reflection"; flash.userData.lightZone="outdoor";
  flash.position.set(0, 32, -32);
  group.add(flash);
  const reflection=new THREE.Mesh(new THREE.CircleGeometry(22,48),new THREE.MeshBasicMaterial({map:textures.glowSoft||null,color:0xffd0ab,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
  reflection.rotation.x=-Math.PI/2;reflection.position.set(0,.10,8);reflection.name='Ephemeral firework colour on snow';group.add(reflection);
  const lettering = createSkyLettering(lowGraphics, random);
  group.add(lettering.group);
  const aurora = createAurora(random, lowGraphics);
  aurora.group.visible=false;
  const meteorWish = createMeteorWish({ lowGraphics, duration: wishDuration + meteorOverlap, scene, camera });
  group.add(meteorWish.group);
  const footprints = createFootprints({ group, terrainHeight, textures, lowGraphics });
  const hands = createTactileHands();
  scene.add(hands.anchor);

  // Nine launch trails climb together and all open at 3.2 s. Their crowns
  // overlap across the whole vista, rather than repeating a small central ring.
  // Later waves leave the middle clear while the birthday words are readable.
  // [launch time, x, altitude, z, shell style, colour, flight duration]
  const cues = [
    [.4,-76,58,-78,0,0,2.8],[.4,-57,70,-79,2,1,2.8],
    [.4,-38,64,-72,0,2,2.8],[.4,-19,80,-80,3,3,2.8],
    [.4,0,69,-68,4,6,2.8],[.4,19,81,-80,3,4,2.8],
    [.4,38,65,-72,0,5,2.8],[.4,57,72,-79,2,0,2.8],
    [.4,76,59,-78,0,1,2.8],
    [11,-49,65,-77,2,3,2.7],[11,0,77,-84,1,6,2.7],[11,49,66,-77,2,2,2.7],
    [17,-65,72,-81,3,5,2.8],[17,65,73,-81,3,1,2.8],
    [28,-65,69,-81,2,0,2.8],[28,65,70,-81,2,4,2.8],
    [37,-64,75,-84,3,2,2.8],[37,0,83,-87,4,7,2.8],[37,64,76,-84,3,6,2.8]
  ];
  const openingVolleyCount = 9;

  function emit(x, y, z, vx, vy, vz, color, life, size, kind = 0, initialAge = 0) {
    const i = cursor;
    cursor = (cursor + 1) % particleBudget;
    const j = i * 3;
    positions[j] = x; positions[j + 1] = y; positions[j + 2] = z;
    origins[j] = x; origins[j + 1] = y; origins[j + 2] = z;
    bornAt[i] = pyroClock - initialAge;
    velocities[j] = vx; velocities[j + 1] = vy; velocities[j + 2] = vz;
    const tint = .80 + random() * .26;
    colors[j] = color.r * tint; colors[j + 1] = color.g * tint; colors[j + 2] = color.b * tint;
    ages[i] = 0; lifetimes[i] = life; sizes[i] = size; alphas[i] = 1; kinds[i] = kind;
  }

  function emitSmoke(x, y, z, size = 1) {
    const i = smokeCursor;
    smokeCursor = (i + 1) % smokeCapacity;
    smokePos[i * 3] = x; smokePos[i * 3 + 1] = y; smokePos[i * 3 + 2] = z;
    smokeAge[i] = 0; smokeLife[i] = 5 + random() * 4;
    smokeSize[i] = size; smokeAlpha[i] = .15;
  }

  function launch(cue) {
    const [, x, y, z, style] = cue;
    const duration = cue[6] ?? 2.8;
    const colorIndex = cue[5] ?? launched % palette.length;
    const startX = x * .48;
    rockets.push({ x: startX, y: .7, z: z + 4, vx: (x - startX) / duration,
      vy: (y - .7 + 1.4 * duration * duration) / duration,
      vz: -4 / duration, age: 0, duration, style,
      color: palette[colorIndex], colorIndex,
      startX, startZ: z + 4, targetX: x, targetY: y, targetZ: z,
      launchTime: cue[0], trailAccumulator: 0 });
    launched++;
  }

  function burst(rocket) {
    exploded++;
    flashAmount = 1; burstListener?.({position:new THREE.Vector3(rocket.x,rocket.y,rocket.z),color:rocket.color.clone(),style:rocket.style});
    flash.color.copy(rocket.color);reflection.material.color.copy(rocket.color);
    flash.position.set(rocket.x, rocket.y - 3, rocket.z + 4);
    const willow = rocket.style === 3;
    const finale = rocket.style === 4;
    const count = qualityName==='low' ? (finale?900:620) : qualityName==='balanced' ? (finale?1300:900) : (finale?1600:1050);
    const speed = finale ? 19.5 : willow ? 17.0 : 18.1;
    const life = willow ? 7.1 : 5.9;
    const initialAge = Math.max(0, rocket.age - rocket.duration);
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const yy = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - yy * yy));
      const theta = phi * i + random() * .10;
      const radius = speed * (.76 + random() * .24);
      const color = i % 11 === 0 ? palette[7] : rocket.color;
      emit(rocket.x, rocket.y, rocket.z,
        Math.cos(theta) * r * radius * (rocket.style===2?1.22:1), yy * radius * (rocket.style===2?.65:.94),
        Math.sin(theta) * r * radius * .64, color,
        life * (.79 + random() * .25), .56 + random() * .78, willow ? 1 : 0, initialAge);
    }
    // Inner pistil and a ring break the perfectly uniform sphere.
    const ringCount = qualityName === 'low' ? 110 : 180;
    for (let i = 0; i < ringCount; i++) {
      const a = i / ringCount * Math.PI * 2;
      const s = 5.4 + random() * 1.2;
      emit(rocket.x, rocket.y, rocket.z, Math.cos(a) * s, Math.sin(a) * s,
        (random() - .5) * .9, rocket.color, 3.0 + random(), .66, 0, initialAge);
    }
    // Slender secondary spokes give each shell a chrysanthemum crown.
    const spokes = qualityName === 'low' ? 18 : 32;
    for (let i = 0; i < spokes; i++) {
      const a = i / spokes * Math.PI * 2;
      for (let j = 0; j < 9; j++) {
        const s = speed * (.48 + j * .06);
        emit(rocket.x, rocket.y, rocket.z, Math.cos(a) * s,
          Math.sin(a) * s * .92, (random() - .5) * 1.4,
          j % 3 ? rocket.color : palette[7], 4.5 + j * .17, .44 + j * .035, 1, initialAge);
      }
    }
    for (let i = 0; i < 9; i++) emitSmoke(rocket.x + (random() - .5) * 2,
      rocket.y + (random() - .5), rocket.z, 2 + random());
    if (rocket.style === 1) emitHeart(rocket.x, rocket.y, rocket.z - .8, finale ? 5.3 : 3.8);
  }

  function emitHeart(x, y, z, scale) {
    const color = palette[6];
    const count = lowGraphics ? 115 : 220;
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(a), 3) / 17;
      const hy = (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17;
      emit(x + hx * scale, y + hy * scale, z + (random() - .5) * .16,
        hx * .18, hy * .18, (random() - .5) * .04, color, 5.1 + random(), .86, 3);
    }
  }

  function startFireworks() {
    showTime = 0; eventCursor = 0;
    rockets.length = 0;
    launched = 0; exploded = 0;
    lifetimes.fill(0); alphas.fill(0); sizes.fill(0);
    smokeLife.fill(0); smokeAlpha.fill(0);
    meteorWish.reset();
    showStartedAt = performance.now();pyroClock=0;paused=false;skipRemaining=0;particles.visible=true;smoke.visible=true;trails.visible=true;
    lettering.group.visible = true;
    lettering.material.uniforms.uAge.value = 0;
    return { duration: celebrationDuration, fireworksDuration, wishDuration, meteorOverlap, totalShells: cues.length, openingVolleyCount, message: lettering.message, target: lettering.target.clone() };
  }

  function update(dt, time, walkState = {}) {
    dt = clamp(Number(dt) || 0, 0, .1);
    const gestureDt=dt;
    dt=(paused||document.hidden)?0:dt;
    if(skipRemaining>0){skipRemaining-=dt;if(skipRemaining<=0){showTime=-1;lifetimes.fill(0);alphas.fill(0);smokeLife.fill(0);rockets.length=0;lettering.group.visible=false;meteorWish.update(-1);} }
    const previousActive=activeCount;let particleDirty=false,smokeDirty=false;
    pyroClock+=dt;
    elapsed = Number(time) || elapsed + dt;
    // The quiet sky belongs to the stars.
    if (showTime >= 0) {
      // Keep the show readable for the same real duration on slower devices.
      showTime += dt;
      if (!skipRemaining && dt>0) { while(eventCursor<cues.length&&showTime>=cues[eventCursor][0])launch(cues[eventCursor++]); }
      lettering.material.uniforms.uAge.value = showTime;
      lettering.material.uniforms.uTime.value = elapsed;
      lettering.update(showTime);
      meteorWish.update(!skipRemaining && showTime >= meteorStart ? showTime - meteorStart : -1);
      if (showTime > celebrationDuration) { showTime = -1; lettering.group.visible = false; meteorWish.update(-1); }
    }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.age = Math.max(0, showTime - r.launchTime);
      const travel = Math.min(r.duration, r.age);
      r.x = r.startX + r.vx * travel;
      r.y = .7 + r.vy * travel - 1.4 * travel * travel;
      r.z = r.startZ + r.vz * travel;
      r.trailAccumulator += dt;
      const interval = lowGraphics ? .021 : .011;
      let trailEmits=0;while (r.trailAccumulator > interval && trailEmits++<4 && dt>0) {
        r.trailAccumulator -= interval;
        emit(r.x, r.y, r.z, -r.vx * .08 + (random() - .5) * .26,
          -.7 - random() * .7, (random() - .5) * .22, palette[7], .65 + random() * .55, .55 + random() * .5, 2);
        emit(r.x, r.y, r.z, 0, 0, 0, palette[7], .05, 1.8, 2);
      }
      if (r.age >= r.duration) { burst(r); rockets.splice(i, 1); }
    }
    activeCount = 0;
    let trailCount = 0;
    const pyroNow = pyroClock;let pyroCount=0;
    for (let i = 0; i < capacity; i++) {
      if (lifetimes[i] <= 0) continue;particleDirty=dt>0;
      const age = ages[i] = Math.max(0, pyroNow - bornAt[i]);
      if (age >= lifetimes[i]) { lifetimes[i] = 0; alphas[i] = 0; sizes[i] = 0; continue; }
      activeCount++;
      const k = i * 3, kind = kinds[i];
      const drag = kind === 1 ? .24 : kind === 3 ? 2.2 : kind === 2 ? .85 : .34;
      const gravity = kind === 3 ? .12 : kind === 2 ? .5 : 1.12;
      const travel = (1 - Math.exp(-drag * age)) / drag;
      positions[k] = origins[k] + velocities[k] * travel;
      positions[k + 1] = origins[k + 1] + (velocities[k + 1] + gravity / drag) * travel - gravity * age / drag;
      positions[k + 2] = origins[k + 2] + velocities[k + 2] * travel;
      const t = age / lifetimes[i];
      const fade = Math.pow(1 - t, kind === 1 ? .7 : .9);
      const shimmer = kind === 2 ? 1 : .8 + .2 * Math.sin(age * 19 + i * 2.17);
      alphas[i] = fade * shimmer * Math.min(1, age * 26 + .25);
      if(kind!==2)pyroCount++;
      if (trailCount < trailBudget) {
        const previousAge = Math.max(0, age - (kind === 1 ? 1.1 : kind===2?.10:.55));
        const previousTravel = (1 - Math.exp(-drag * previousAge)) / drag;
        const j = trailCount * 6, a = trailCount * 2;
        trailPositions[j] = origins[k] + velocities[k] * previousTravel;
        trailPositions[j + 1] = origins[k + 1] + (velocities[k + 1] + gravity / drag) * previousTravel - gravity * previousAge / drag;
        trailPositions[j + 2] = origins[k + 2] + velocities[k + 2] * previousTravel;
        for (let c = 0; c < 3; c++) {
          trailPositions[j + 3 + c] = positions[k + c];
          trailColors[j + c] = trailColors[j + 3 + c] = colors[k + c];
        }
        trailAlphas[a] = alphas[i] * .13; trailAlphas[a + 1] = alphas[i] * .86;
        trailCount++;
      }
    }
    trailGeometry.setDrawRange(0, trailCount * 2);
    if(particleDirty || previousActive!==activeCount){
      for(const name of ['position','aColor','aAlpha'])trailGeometry.attributes[name].needsUpdate=true;
      for(const name of ['position','aColor','aSize','aAlpha'])particleGeometry.attributes[name].needsUpdate=true;uploadFrames++;
    }
    particles.visible=activeCount>0;trails.visible=trailCount>0;lastTrailCount=trailCount;lastPyroCount=pyroCount;
    for (let i = 0; i < smokeCapacity; i++) {
      if (smokeLife[i] <= 0) continue;smokeDirty=dt>0;
      smokeAge[i] += dt;
      if (smokeAge[i] >= smokeLife[i]) { smokeLife[i] = 0; smokeAlpha[i] = 0; continue; }
      const t = smokeAge[i] / smokeLife[i];
      smokePos[i * 3] += dt * .16;
      smokePos[i * 3 + 1] += dt * .12;
      smokeSize[i] += dt * .35;
      smokeAlpha[i] = Math.sin(t * Math.PI) * .14;
    }
    if(smokeDirty)for (const name of ['position', 'aSize', 'aAlpha']) smokeGeometry.attributes[name].needsUpdate = true;
    smoke.visible=smokeLife.some(l=>l>0);
    flashAmount *= Math.exp(-dt * 9.8);
    flash.intensity = flashAmount * 2600;reflection.material.opacity=flashAmount*.40;reflection.visible=flashAmount>.004;
    footprints.update(dt, walkState);
    hands.update(document.hidden?0:gestureDt, elapsed, camera, walkState);
  }

  return {
    update, startFireworks, playTouch: hands.playTouch, cancelTouch:()=>hands.cancel?.(),
    setPaused(value){paused=!!value;},
    skip(){if(showTime>=0){skipRemaining=1.4;eventCursor=cues.length;lettering.group.visible=false;meteorWish.update(-1);}},
    onBurst(fn){burstListener=fn;},
    setPixelRatio(p){particleMaterial.uniforms.uPixelRatio.value=p;smokeMaterial.uniforms.uPixelRatio.value=p;lettering.material.uniforms.uPixelRatio.value=p;meteorWish.setPixelRatio?.(p);},
    setQuality(q){qualityName=typeof q==='string'?q:q.name;lowGraphics=qualityName==='low';particleBudget=lowGraphics?10000:qualityName==='balanced'?16000:22000;trailBudget=lowGraphics?10000:18000;meteorWish.setQuality(qualityName);},
    touchContactTime: hands.contactTime, skyTarget: lettering.target.clone(),
    async prepare(renderer){
      const oldHands=hands.anchor.visible,oldText=lettering.group.visible,oldMeteors=meteorWish.group.visible;
      hands.anchor.visible=true;lettering.group.visible=true;meteorWish.group.visible=true;
      try{await renderer.compileAsync(scene,camera);}
      finally{hands.anchor.visible=oldHands;lettering.group.visible=oldText;meteorWish.group.visible=oldMeteors;}
    },
    getStats: () => ({
      fireworksActive: showTime >= 0, fireworksTime: Math.max(0, showTime),
      celebrationPhase: showTime < 0 ? 'idle' : showTime < fireworksDuration ? 'fireworks' : 'wish',
      wishRemaining: showTime >= fireworksDuration ? Math.max(0, celebrationDuration - showTime) : 0,
      meteorsCount: meteorWish.count, meteorsActive: meteorWish.active,
      meteorClusters: meteorWish.clusters, meteorClustersSeen: meteorWish.clustersSeen,
      meteorCapacity: meteorWish.capacity, meteorUploadFrames: meteorWish.uploadFrames,
      meteorTransition: showTime >= meteorStart && showTime < fireworksDuration,
      meteorTransitionBlend: showTime >= 0 ? THREE.MathUtils.smoothstep(showTime, meteorStart, fireworksDuration) : 0,
      meteorOverlap, fireworksDuration, wishDuration, celebrationDuration,
      shellsPlanned: cues.length, openingVolleyCount, openingBurstTime: 3.2,
      meteorMaxActive: meteorWish.maxActive, meteorFlightRange: meteorWish.flightRange,
      meteorMeanSpeed: meteorWish.meanSpeed, meteorOccluded: meteorWish.occluded,
      meteorPathsBehindMountains: meteorWish.pathsBehindMountains, meteorOcclusionMode: meteorWish.occlusionMode, meteorPlanMilliseconds: meteorWish.planMilliseconds,
      launched, exploded, paused, skipping:skipRemaining>0, particleCount: activeCount, particleCapacity: particleBudget, trailCapacity:trailBudget,trailCount:lastTrailCount,pyroCount:lastPyroCount,uploadFrames,quality:qualityName,
      textParticleCount: lettering.count, skyMessage: lettering.message,
      footprintCount: footprints.count, footprintsCreated: footprints.created,
      footprintCapacity: footprints.capacity, lanternVisible: false,
      handsVisible: hands.anchor.visible, touchCount: hands.count, handMotion: hands.getStats(),
      skyTextCrisp: lettering.material.uniforms.uPixelRatio.value>=1, pointPixelRatio:particleMaterial.uniforms.uPixelRatio.value, skyTextAltitude: lettering.target.y
    })
  };
}

function makeRandom(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function createSkyLettering(lowGraphics, random) {
  const message = 'Lily，生日快乐';
  const group = new THREE.Group(); group.name = 'Suspended birthday wish • crisp ivory lettering';
  group.visible = false;
  const targetPoint = new THREE.Vector3(5, 28, -38);
  const canvas = document.createElement('canvas');
  canvas.width = 1536; canvas.height = 480;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font='180px "KaiTi", "STKaiti", "Songti SC", Georgia, serif';
  ctx.fillText(message,canvas.width/2,205,1450);
  ctx.font='36px Georgia,serif';ctx.fillText('2026 · 10 · 29',canvas.width/2,374);
  const textMap = new THREE.CanvasTexture(canvas);
  textMap.colorSpace = THREE.SRGBColorSpace; textMap.anisotropy = 8;
  textMap.generateMipmaps = true; textMap.minFilter = THREE.LinearMipmapLinearFilter;
  const coreMaterial = new THREE.MeshBasicMaterial({ map: textMap, color: 0xfff3df,
    transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false,
    side: THREE.DoubleSide });
  const core = new THREE.Mesh(new THREE.PlaneGeometry(31, 9.6875), coreMaterial);
  core.position.copy(targetPoint); core.renderOrder = 9;
  core.name = 'Legible world-space Chinese birthday blessing'; group.add(core);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const target = [], start = [], color = [], phase = [], size = [];
  const stride = 5;
  for (let y = 12; y < canvas.height - 10; y += stride) {
    for (let x = 15; x < canvas.width - 15; x += stride) {
      if (data[(y * canvas.width + x) * 4 + 3] < 100) continue;
      const tx = targetPoint.x+(x - canvas.width / 2) * (31 / canvas.width);
      const ty = targetPoint.y + (canvas.height / 2 - y) * (31 / canvas.width);
      target.push(tx, ty, targetPoint.z + .025 + (random() - .5) * .08);
      const a = random() * Math.PI * 2;
      const r = 5 + random() * 18;
      start.push(Math.cos(a) * r, 30 + Math.sin(a) * r * .5, -28 - random() * 12);
      const mix = random();
      color.push(1, .80 + mix * .16, .61 + mix * .24);
      phase.push(random() * Math.PI * 2); size.push(.21 + random() * .05);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(target, 3));
  geo.setAttribute('aStart', new THREE.Float32BufferAttribute(start, 3));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(color, 3));
  geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uAge: { value: 0 }, uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.8) } },
    vertexShader: `
      attribute vec3 aStart;attribute vec3 aColor;attribute float aPhase;attribute float aSize;
      uniform float uAge;uniform float uTime;uniform float uPixelRatio;
      varying vec3 vColor;varying float vAlpha;
      void main(){
        float gather=smoothstep(20.,25.,uAge);
        float dissolve=smoothstep(33.,39.,uAge);
        vec3 p=mix(aStart,position,gather);
        p.x+=sin(uTime*.45+aPhase)*.016*gather;
        p.y+=cos(uTime*.4+aPhase)*.015;
        p+=normalize(aStart-position)*dissolve*3.;
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(aSize*280./max(1.,-mv.z),1.,8.)*uPixelRatio;
        float twinkle=.85+.15*sin(uTime*1.2+aPhase);
        vAlpha=smoothstep(19.5,22.,uAge)*(1.-dissolve)*twinkle*.94;
        vColor=aColor;
      }`,
    fragmentShader: `varying vec3 vColor;varying float vAlpha;
      void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
        float a=exp(-r*r*3.5)*vAlpha*.90;gl_FragColor=vec4(vColor*2.2,a);}`
  });
  const points = new THREE.Points(geo, material);
  points.name = `World-space birthday wish • ${message}`;
  points.frustumCulled = false; points.renderOrder = 8; group.add(points);
  return { group, points, material, count: target.length / 3, message, target: targetPoint,
    update(age) {
      const a = THREE.MathUtils.smoothstep(age, 23.0, 25.0);
      const b = 1 - THREE.MathUtils.smoothstep(age, 33.0, 39.0);
      coreMaterial.opacity = a * b * .42;
    } };
}

/** Six dense families share a radiant and drift slowly across the full view.
 * Every destination is traced into the actual opaque mountain meshes. Heads
 * stay luminous until geometry hides them; there is no mid-air end fade.
 * Two fixed-buffer draw calls cover all 72 meteors, tails and leading sparks. */
function createMeteorWish({ lowGraphics, duration = 44, scene, camera }) {
  const group = new THREE.Group(); group.name = 'After the fireworks • a meteor wishing sky';
  group.visible = false;
  const random = makeRandom(102930), segments = 24, beads = 9;
  const families = Array.from({ length: 6 }, (_, cluster) => ({ time: .15 + cluster * 5, count: 12 }));
  const tints = [new THREE.Color('#fff4dd'), new THREE.Color('#ffdda9'), new THREE.Color('#ffe0ee')];
  const events = [];
  families.forEach((family, cluster) => {
    for (let member = 0; member < family.count; member++) {
      const hero = member === 0 || member === 5 || member === 9;
      events.push({ cluster, member, hero, tint: tints[(member + cluster) % tints.length],
        phase: random() * Math.PI * 2, time: family.time + member * .095 + random() * .13,
        startNdcX: -1.14 - random() * .10, startNdcY: .56 + random() * .36,
        nominalEndNdcX: .43 + random() * .46, depth: 128 + (member % 3) * 6 + random() * 5,
        duration: 12 + random() * 2, tail: hero ? 1.95 : 1.5 + random() * .25,
        brightness: hero ? 1.18 : .55 + random() * .28, width: hero ? .92 : .51 + random() * .18,
        x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, occlusionProgress: 1, endpointOccluded: false });
    }
  });
  const raycaster = new THREE.Raycaster(), forward = new THREE.Vector3();
  const ndc = new THREE.Vector2(), point = new THREE.Vector3(), delta = new THREE.Vector3();
  let occluders = [], pathsBehindMountains = 0, occlusionMode = 'waiting for show camera', planMilliseconds = 0;
  let ridgeEdges = [];
  function buildRidgeEdges() {
    ridgeEdges = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (const root of occluders) root.traverse(mesh => {
      if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
      const geometry = mesh.geometry, attribute = geometry.attributes.position, index = geometry.index;
      const count = index ? index.count : attribute.count;
      for (let triangle = 0; triangle < count; triangle += 3) {
        const vertices = [];
        for (let corner = 0; corner < 3; corner++) {
          const vertex = index ? index.getX(triangle + corner) : triangle + corner;
          a.fromBufferAttribute(attribute, vertex).applyMatrix4(mesh.matrixWorld);
          if (b.copy(a).sub(camera.position).dot(forward) <= camera.near) break;
          a.project(camera); vertices.push([a.x, a.y]);
        }
        if (vertices.length !== 3) continue;
        for (let edge = 0; edge < 3; edge++) ridgeEdges.push([...vertices[edge], ...vertices[(edge + 1) % 3]]);
      }
    });
  }
  function ridgeAt(x) {
    let top = -Infinity;
    for (const [ax, ay, bx, by] of ridgeEdges) {
      if (x < Math.min(ax, bx) || x > Math.max(ax, bx)) continue;
      const y = Math.abs(bx - ax) < 1e-8 ? Math.max(ay, by) : ay + (by - ay) * (x - ax) / (bx - ax);
      top = Math.max(top, y);
    }
    return Number.isFinite(top) ? top : null;
  }
  function intersections(x, y) {
    ndc.set(x, y); raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(occluders, true);
  }
  function hiddenAt(e, progress) {
    point.set(e.x + e.dx * progress, e.y + e.dy * progress, e.z + e.dz * progress);
    delta.copy(point).sub(camera.position); const distance = delta.length();
    raycaster.set(camera.position, delta.multiplyScalar(1 / Math.max(.001, distance)));
    const hit = raycaster.intersectObjects(occluders, true)[0];
    return !!hit && hit.distance < distance - .03;
  }
  function planPaths() {
    const began = performance.now();
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); scene.updateMatrixWorld(true);
    camera.getWorldDirection(forward);
    const mountains = scene.getObjectByName('Birthday distant mountain occluders');
    occluders = mountains ? [mountains] : [];
    buildRidgeEdges();
    pathsBehindMountains = 0;
    for (const e of events) {
      raycaster.setFromCamera(ndc.set(e.startNdcX, e.startNdcY), camera);
      const start = raycaster.ray.at(e.depth / raycaster.ray.direction.dot(forward), new THREE.Vector3());
      let destinationX = e.nominalEndNdcX, end;
      // Project mountain triangle edges once, then solve their upper skyline
      // at this screen x. This replaces thousands of per-meteor ray scans and
      // keeps starting the birthday show responsive. Final rays still verify
      // actual opaque surfaces; narrow gaps fall through to a nearby mountain.
      for (const offset of [0, -.12, .12, -.24, .24, -.36, .36]) {
        const x = THREE.MathUtils.clamp(e.nominalEndNdcX + offset, .12, .93);
        const ridge = ridgeAt(x);
        if (ridge === null || ridge < -1.45 || ridge > .65) continue;
        // Short cones have shallow screen-space height, so never assume that
        // a fixed drop below a ridge still intersects the mountain's side.
        for (const below of [.025, .012, .004, .001, .0002]) {
          const hit = intersections(x, ridge - below)[0];
          if (hit) {
            end = raycaster.ray.at(hit.distance + 28, new THREE.Vector3());
            destinationX = x; break;
          }
        }
        if (end) break;
      }
      if (!end && mountains) {
        // A face-centre ray is a final geometric fallback for exceptionally
        // narrow projected facets. It still ends behind a real visible cone.
        const candidates = mountains.children.filter(mesh => mesh.isMesh).map(mesh => {
          const projected = mesh.getWorldPosition(new THREE.Vector3()).project(camera);
          return { projected, score: Math.abs(projected.x - e.nominalEndNdcX) };
        }).filter(({projected:p}) => p.x > .12 && p.x < .96 && p.y > -1.45 && p.y < .65).sort((a,b)=>a.score-b.score);
        for (const {projected:p} of candidates) {
          const hit = intersections(p.x, p.y)[0];
          if (hit) { end = raycaster.ray.at(hit.distance + 28, new THREE.Vector3()); destinationX = p.x; break; }
        }
      }
      if (!end) {
        // Standalone previews without terrain still use a continuous farward
        // path; production always has the named mountain ring above.
        raycaster.setFromCamera(ndc.set(destinationX, -.9), camera);
        end = raycaster.ray.at(170 / raycaster.ray.direction.dot(forward), new THREE.Vector3());
      }
      e.x = start.x; e.y = start.y; e.z = start.z;
      e.dx = end.x - start.x; e.dy = end.y - start.y; e.dz = end.z - start.z;
      e.endpointOccluded = hiddenAt(e, 1);
      if (e.endpointOccluded) {
        pathsBehindMountains++;
        // This threshold is telemetry only. Actual hiding is GPU depth test.
        let clear = 0, blocked = 1;
        for (let step = 0; step < 6; step++) {
          const mid = (clear + blocked) * .5;
          if (hiddenAt(e, mid)) blocked = mid; else clear = mid;
        }
        e.occlusionProgress = blocked;
      } else e.occlusionProgress = 1;
      e.endNdcX = destinationX;
    }
    occlusionMode = pathsBehindMountains === events.length ? 'actual mountain depth test' : 'mountain geometry unavailable';
    planMilliseconds = performance.now() - began;
    // Numeric route records are useful for offline geometric verification.
    // They are not copied into the once-per-second HUD telemetry.
    group.userData.meteorPaths = events.map(e => ({ cluster: e.cluster, member: e.member, time: e.time,
      start: [e.x, e.y, e.z], end: [e.x + e.dx, e.y + e.dy, e.z + e.dz],
      duration: e.duration, tail: e.tail, startNdc: [e.startNdcX, e.startNdcY],
      occlusionProgress: e.occlusionProgress, endpointOccluded: e.endpointOccluded }));
  }
  const vertexCount = events.length * segments * 6;
  const positions = new Float32Array(vertexCount * 3);
  const uv = new Float32Array(vertexCount * 2);
  const strength = new Float32Array(vertexCount), tint = new Float32Array(vertexCount * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute('aStrength', new THREE.BufferAttribute(strength, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
  const triangleVertices = [[0,-1],[1,-1],[0,1],[0,1],[1,-1],[1,1]];
  for (let index = 0; index < events.length; index++) {
    for (let segment = 0; segment < segments; segment++) {
      for (let corner = 0; corner < 6; corner++) {
        const vertex = (index * segments + segment) * 6 + corner;
        const [step, side] = triangleVertices[corner];
        uv[vertex * 2] = (segment + step) / segments;
        uv[vertex * 2 + 1] = (side + 1) * .5;
        tint[vertex * 3] = events[index].tint.r;
        tint[vertex * 3 + 1] = events[index].tint.g;
        tint[vertex * 3 + 2] = events[index].tint.b;
      }
    }
  }
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aStrength;attribute vec3 aTint;
      varying vec2 vUv;varying float vStrength;varying vec3 vTint;
      void main(){vUv=uv;vStrength=aStrength;vTint=aTint;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;varying float vStrength;varying vec3 vTint;
      void main(){float across=abs(vUv.y*2.-1.);
        float halo=exp(-across*across*4.8)*.24;
        float core=exp(-across*across*78.);
        float tail=pow(max(0.,1.-vUv.x),1.35);
        float a=(halo+core*.87)*tail*vStrength;
        gl_FragColor=vec4(mix(vTint*1.3,vec3(1.5,1.43,1.29),core*.52),a*.90);}`
  });
  const ribbons = new THREE.Mesh(geometry, material);
  ribbons.name = 'Long tapering meteor afterglow'; ribbons.frustumCulled = false; ribbons.renderOrder = 8;
  group.add(ribbons);
  const sparkCount = events.length * (beads + 1);
  const headPositions = new Float32Array(sparkCount * 3), headAlpha = new Float32Array(sparkCount);
  const headSizes = new Float32Array(sparkCount), headTints = new Float32Array(sparkCount * 3);
  for (let index = 0; index < events.length; index++) {
    for (let bead = 0; bead <= beads; bead++) {
      const i = index * (beads + 1) + bead;
      headSizes[i] = bead === 0 ? (events[index].hero ? 1.25 : .82) : .19 + .18 * (1 - bead / beads);
      headTints[i * 3] = events[index].tint.r;
      headTints[i * 3 + 1] = events[index].tint.g;
      headTints[i * 3 + 2] = events[index].tint.b;
    }
  }
  const headGeometry = new THREE.BufferGeometry();
  headGeometry.setAttribute('position', new THREE.BufferAttribute(headPositions, 3).setUsage(THREE.DynamicDrawUsage));
  headGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(headAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  headGeometry.setAttribute('aSize', new THREE.BufferAttribute(headSizes, 1));
  headGeometry.setAttribute('aTint', new THREE.BufferAttribute(headTints, 3));
  const headMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    uniforms:{uPixelRatio:{value:1}},
    vertexShader: `attribute float aAlpha;attribute float aSize;attribute vec3 aTint;
      varying float vAlpha;varying vec3 vTint;uniform float uPixelRatio;
      void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(aSize*690./max(1.,-mv.z),1.1,14.)*uPixelRatio;vAlpha=aAlpha;vTint=aTint;}`,
    fragmentShader: `varying float vAlpha;varying vec3 vTint;
      void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
        float a=exp(-r*r*7.)*.55+exp(-r*r*38.);
        gl_FragColor=vec4(mix(vTint*1.2,vec3(1.5),.40),a*vAlpha);}`
  });
  const heads = new THREE.Points(headGeometry, headMaterial);
  heads.name = 'Meteor ivory-gold leading sparks and granular tails'; heads.frustumCulled = false; heads.renderOrder = 8;
  group.add(heads);
  let count = 0, active = 0, clustersSeen = 0, lastTime = -Infinity, uploadFrames = 0;
  let maxActive = 0, occluded = 0;
  let quality = lowGraphics ? 'low' : 'high';
  function update(time) {
    group.visible = time >= 0 && time <= duration;
    if (!group.visible) { active = 0; occluded = 0; lastTime = -Infinity; return; }
    // Reading, pausing and a background tab preserve every head and trail.
    if (time === lastTime) return;
    lastTime = time; count = 0; active = 0; occluded = 0;
    let seenFamilies = 0;
    for (let index = 0; index < events.length; index++) {
      const e = events[index], age = time - e.time;
      if (age >= 0) { count++; seenFamilies |= 1 << e.cluster; }
      const visible = age >= 0 && age < e.duration + e.tail;
      if (visible) { active++; if (age / e.duration >= e.occlusionProgress) occluded++; }
      // Brightness only eases in at the far edge. At the end, the mountain
      // depth buffer progressively covers the bright head and its full tail.
      const envelope = THREE.MathUtils.smoothstep(age, 0, .42) * e.brightness;
      const length = Math.hypot(e.dx, e.dy), nx = -e.dy / length, ny = e.dx / length;
      for (let segment = 0; segment < segments; segment++) {
        for (let corner = 0; corner < 6; corner++) {
          const vertex = (index * segments + segment) * 6 + corner;
          const along = uv[vertex * 2], side = uv[vertex * 2 + 1] * 2 - 1;
          const priorAge = Math.max(0, Math.min(e.duration, age - along * e.tail));
          const progress = priorAge / e.duration;
          const width = (.07 + .24 * Math.sin(along * Math.PI)) * side * e.width;
          const v = vertex * 3;
          positions[v] = e.x + e.dx * progress + nx * width;
          positions[v + 1] = e.y + e.dy * progress + ny * width;
          positions[v + 2] = e.z + e.dz * progress;
          strength[vertex] = visible && age - along * e.tail >= 0 ? envelope : 0;
        }
      }
      for (let bead = 0; bead <= beads; bead++) {
        const i = index * (beads + 1) + bead;
        const along = bead / (beads + 1), priorAge = age - along * e.tail;
        const progress = Math.min(1, Math.max(0, priorAge / e.duration));
        const drift = bead === 0 ? 0 : Math.sin(age * 4 + e.phase + bead * 2.1) * .065 * along;
        headPositions[i * 3] = e.x + e.dx * progress + nx * drift;
        headPositions[i * 3 + 1] = e.y + e.dy * progress + ny * drift;
        headPositions[i * 3 + 2] = e.z + e.dz * progress;
        const twinkle = bead === 0 ? 1 : (.70 + .30 * Math.sin(age * 10 + e.phase + bead * 2.17)) * (1 - along);
        headAlpha[i] = visible && priorAge >= 0
          && (quality !== 'low' || bead === 0 || bead % 2 === 0) ? envelope * twinkle : 0;
      }
    }
    maxActive = Math.max(maxActive, active);
    const seen = seenFamilies.toString(2).replace(/0/g, '').length;
    clustersSeen = Math.max(clustersSeen, seen);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aStrength.needsUpdate = true;
    headGeometry.attributes.position.needsUpdate = true;
    headGeometry.attributes.aAlpha.needsUpdate = true;
    uploadFrames++;
  }
  return { group, update, setPixelRatio(p){headMaterial.uniforms.uPixelRatio.value=p;},
    setQuality(q){quality=q;lastTime=-Infinity;},
    reset() { planPaths(); count = 0; active = 0; maxActive = 0; occluded = 0; clustersSeen = 0; lastTime = -Infinity; group.visible = false; },
    get count() { return count; }, get active() { return active; },
    get maxActive(){return maxActive;},get occluded(){return occluded;},
    get pathsBehindMountains(){return pathsBehindMountains;},get occlusionMode(){return occlusionMode;},get planMilliseconds(){return planMilliseconds;},
    get flightRange(){return [Math.min(...events.map(e=>e.duration)), Math.max(...events.map(e=>e.duration))];},
    get meanSpeed(){return events.reduce((sum,e)=>sum+Math.hypot(e.dx,e.dy,e.dz)/e.duration,0)/events.length;},
    get clusters(){return families.length;},get clustersSeen(){return clustersSeen;},
    get capacity(){return events.length;},get uploadFrames(){return uploadFrames;} };
}

function createAurora(random, lowGraphics) {
  const group = new THREE.Group();
  group.name = 'Quiet lavender aurora';
  const geo = new THREE.PlaneGeometry(120, 34, 48, 16);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv;uniform float uTime;
      void main(){vUv=uv;vec3 p=position;
        p.z+=sin(p.x*.055+uTime*.035)*5.;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform float uTime;
      void main(){float x=vUv.x;float y=vUv.y;
        float wave=.42+sin(x*7.+uTime*.025)*.07+sin(x*19.-uTime*.04)*.035;
        float curtain=exp(-abs(y-wave)*8.)*(.6+.4*sin(x*120.+sin(x*13.)*5.));
        float mask=smoothstep(0.,.18,x)*smoothstep(1.,.78,x)*smoothstep(.04,.28,y)*smoothstep(.95,.48,y);
        vec3 col=mix(vec3(.20,.38,.38),vec3(.28,.18,.42),smoothstep(.25,.8,x));
        gl_FragColor=vec4(col,curtain*mask*.12);}`
  });
  const curtain = new THREE.Mesh(geo, material);
  curtain.position.set(-15, 38, -100); curtain.rotation.z = -.12;
  group.add(curtain);
  const count = lowGraphics ? 80 : 160;
  const p = new Float32Array(count * 3), phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    p[i * 3] = (random() - .5) * 70;
    p[i * 3 + 1] = 10 + random() * 42;
    p[i * 3 + 2] = -30 - random() * 65;
    phases[i] = random() * 6.28;
  }
  const stars = new THREE.BufferGeometry();
  stars.setAttribute('position', new THREE.BufferAttribute(p, 3));
  stars.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aPhase;uniform float uTime;varying float vAlpha;
      void main(){vec3 p=position;p.x+=sin(uTime*.06+aPhase)*.8;
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(95./max(1.,-mv.z),1.,3.);
        vAlpha=(.35+.25*sin(uTime*.5+aPhase));}`,
    fragmentShader: `varying float vAlpha;void main(){float r=length(gl_PointCoord-.5)*2.;
      gl_FragColor=vec4(.83,.73,.62,exp(-r*r*8.)*vAlpha);}`
  });
  const dust = new THREE.Points(stars, starMat);
  group.add(dust);
  return { group, update(t) { material.uniforms.uTime.value = t; starMat.uniforms.uTime.value = t; } };
}

function createFootprints({ group, terrainHeight, textures, lowGraphics }) {
  const capacity = 900,visibleCapacity=240;
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 448;
  const ctx = canvas.getContext('2d');
  function bootPath(offset = 0) {
    ctx.beginPath();
    ctx.moveTo(68 - offset, 63);
    ctx.bezierCurveTo(65 - offset, 12 - offset, 190 + offset, 12 - offset, 191 + offset, 70);
    ctx.bezierCurveTo(205 + offset, 135, 170 + offset, 226, 171 + offset, 289);
    ctx.bezierCurveTo(202 + offset, 374, 192 + offset, 416 + offset, 128, 418 + offset);
    ctx.bezierCurveTo(62 - offset, 418 + offset, 56 - offset, 379, 78 - offset, 300);
    ctx.bezierCurveTo(92 - offset, 239, 50 - offset, 136, 68 - offset, 63);
    ctx.closePath();
  }
  // Powder displaced to the rim, with a compacted icy sole below. The geometry
  // is shallow and dished, so the imprint catches moonlight from grazing views.
  ctx.clearRect(0, 0, 256, 448);
  ctx.shadowColor = 'rgba(44,66,86,.28)'; ctx.shadowBlur = 18;
  bootPath(10); ctx.fillStyle = 'rgba(210,225,239,.64)'; ctx.fill();
  ctx.shadowBlur = 0;
  bootPath(5); ctx.fillStyle = '#d7e2ec'; ctx.fill();
  bootPath(-2); ctx.fillStyle = '#99adbf'; ctx.fill();
  ctx.save(); bootPath(-4); ctx.clip();
  const gradient = ctx.createLinearGradient(40, 0, 200, 448);
  gradient.addColorStop(0, '#8098ad'); gradient.addColorStop(.45, '#a5b7c7'); gradient.addColorStop(1, '#91a7b9');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 448);
  ctx.lineWidth = 5; ctx.strokeStyle = '#b6c5d2';
  for (let y = 82; y < 410; y += 28) {
    ctx.beginPath(); ctx.moveTo(68, y - 12); ctx.lineTo(124, y + 9); ctx.lineTo(189, y - 12); ctx.stroke();
  }
  ctx.lineWidth = 3; ctx.strokeStyle = '#879fb2';
  for (let y = 70; y < 420; y += 29) {
    ctx.beginPath(); ctx.moveTo(71, y - 9); ctx.lineTo(126, y + 12); ctx.lineTo(188, y - 9); ctx.stroke();
  }
  ctx.restore();
  const grain = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const noise = makeRandom(40129);
  for (let i = 0; i < grain.data.length; i += 4) {
    if (!grain.data[i + 3]) continue;
    const n = (noise() - .5) * 13;
    grain.data[i] += n; grain.data[i + 1] += n; grain.data[i + 2] += n;
    grain.data[i + 3] *= .90 + noise() * .10;
  }
  ctx.putImageData(grain, 0, 0);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(.255, .435, 16, 24);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const xx = p.getX(i) / .1275, zz = p.getZ(i) / .2175;
    const edge = Math.max(Math.abs(xx) * 1.20, Math.abs(zz));
    p.setY(i, .009 + Math.exp(-Math.pow((edge - .75) * 9, 2)) * .022);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: .08,
    color: 0xe3ecf4, roughness: .94, metalness: .01, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  mesh.name = 'Persistent boot imprints • compressed snow and tread';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.receiveShadow = true; mesh.castShadow = false; mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  group.add(mesh);
  const dummy = new THREE.Object3D(), empty = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, empty);
  mesh.count = 0;
  const normal = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const terrainQ = new THREE.Quaternion(), yawQ = new THREE.Quaternion();
  let count = 0, created = 0, cursor = 0, nextLeft = true, distance = 0;
  let lastDistance = null, lastX = null, lastZ = null;
  function onSnow(x, z, state) {
    if (state.inside) return false;
    if (Math.abs(x) < 5.04 && z > -3.85 && z < 6.4) return false;
    if (Math.abs(x) < 1.65 && z >= 6.1 && z < 7.65) return false;
    const h = terrainHeight(x, z);
    if (Number.isFinite(state.groundHeight) && state.groundHeight - h > .16) return false;
    return true;
  }
  function stamp(state) {
    const yaw = Number(state.yaw) || 0;
    const side = nextLeft ? -1 : 1; nextLeft = !nextLeft;
    const x = state.position.x + Math.cos(yaw) * .092 * side;
    const z = state.position.z - Math.sin(yaw) * .092 * side;
    if (!onSnow(x, z, state)) return;
    const eps = .075;
    const dhx = (terrainHeight(x + eps, z) - terrainHeight(x - eps, z)) / (2 * eps);
    const dhz = (terrainHeight(x, z + eps) - terrainHeight(x, z - eps)) / (2 * eps);
    normal.set(-dhx, 1, -dhz).normalize();
    terrainQ.setFromUnitVectors(up, normal);
    yawQ.setFromAxisAngle(up, yaw + side * .055);
    dummy.position.set(x, terrainHeight(x, z) + .006, z);
    dummy.quaternion.copy(terrainQ).multiply(yawQ); dummy.scale.set(1, 1, 1);
    dummy.updateMatrix(); mesh.setMatrixAt(cursor%visibleCapacity, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
    cursor = (cursor + 1) % capacity; count = Math.min(capacity, count + 1); created++;
    mesh.count = Math.min(count,visibleCapacity);
  }
  return {
    capacity, get count() { return count; }, get created() { return created; },
    update(dt, state) {
      if (!state.active || !state.position) { lastDistance = null; lastX = lastZ = null; distance = 0; return; }
      const traveled = Number(state.distanceTravelled);
      let delta = 0;
      if (Number.isFinite(traveled)) {
        if (lastDistance !== null) delta = Math.max(0, Math.min(1, traveled - lastDistance));
        lastDistance = traveled;
      } else if (lastX !== null) delta = Math.min(1, Math.hypot(state.position.x - lastX, state.position.z - lastZ));
      lastX = state.position.x; lastZ = state.position.z;
      distance += delta;
      const step = Number(state.speed) > 3 ? .64 : .49;
      if (distance >= step) { distance %= step; stamp(state); }
    }
  };
}

