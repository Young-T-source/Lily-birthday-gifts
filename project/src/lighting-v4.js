import * as THREE from 'three';

export function manageLighting(scene){
  scene.updateMatrixWorld(true);
  const world=new THREE.Vector3(),targetWorld=new THREE.Vector3(),viewer=new THREE.Vector3(),entries=[];
  let hemi,ambient,moon;
  scene.traverse(light=>{
    if(!light.isLight)return;
    if(light.isHemisphereLight){hemi=light;return;}
    if(light.isAmbientLight){ambient=light;return;}
    if(light.isDirectionalLight){moon=light;return;}
    light.getWorldPosition(world);
    const zone=light.userData.lightZone||(Math.abs(world.x)<4.45&&world.z>-3.35&&world.z<3.35&&world.y<7?'interior':'outdoor');
    light.userData.lightZone=zone;
    entries.push({light,zone,base:light.intensity,shadow:light.castShadow,position:world.clone()});
  });
  const windowLamp=entries.find(e=>e.light.name==='Loft warm sitting area');
  const hearthLamp=entries.filter(e=>e.zone==='interior'&&e.light.isPointLight&&e.light.position.y<3.4).sort((a,b)=>b.base-a.base)[0];
  const indoorViews=[windowLamp?.light,hearthLamp?.light].filter(Boolean);

  // Three r160 keys every lit material by the number/type of visible lights
  // and shadow maps. Source lights must never change that key at the doorway.
  // Persistent slots keep 4 spots + 6 points + 2 spot shadows in both rooms;
  // unused slots have zero intensity, but stay visible and keep their maps.
  const slots=[];
  for(let i=0;i<4;i++){
    const light=new THREE.SpotLight(0xffd3af,0,12,.9,.85,2);
    light.name='Stable warm spot slot '+i;light.castShadow=i<2;
    light.shadow.autoUpdate=false;light.shadow.needsUpdate=light.castShadow;
    light.shadow.mapSize.set(1024,1024);light.userData.lightingSlot=true;
    scene.add(light,light.target);slots.push({light,source:null});
  }
  for(let i=0;i<6;i++){
    const light=new THREE.PointLight(0xffd3af,0,10,2);
    light.name='Stable warm point slot '+i;light.userData.lightingSlot=true;
    scene.add(light);slots.push({light,source:null});
  }
  for(const e of entries){e.light.visible=false;e.light.castShadow=false;}
  if(moon){moon.castShadow=true;moon.shadow.autoUpdate=false;moon.shadow.needsUpdate=true;}

  let insideLast=null,selectionAge=1,allowed=new Set(),selectionChanges=0,shadowInvalidations=0;
  let moonDirty=true,localDirty=true;
  function choose(inside){
    const zone=inside?'interior':'outdoor',reserved=inside?[]:indoorViews;
    const score=e=>{
      const light=e.light,power=light.intensity;
      light.getWorldPosition(e.position);
      return (light.name.includes('Firework')?10000:0)+(light.userData.celebrationPriority||0)*100+
        (light.name.includes('Focused memory')&&power>.1?150:0)+(light.isSpotLight?28:0)+
        Math.min(24,Math.max(e.base,power))*2+85/(2+e.position.distanceTo(viewer));
    };
    const ranked=entries.filter(e=>e.zone===zone&&!reserved.includes(e.light)).map(e=>({e,score:score(e)})).sort((a,b)=>b.score-a.score);
    const budget=(inside?7:9)-reserved.length;
    const spotCount=Math.min(ranked.filter(o=>o.e.light.isSpotLight).length,inside?1:4,budget);
    const picks=[...ranked.filter(o=>o.e.light.isSpotLight).slice(0,spotCount),...ranked.filter(o=>o.e.light.isPointLight).slice(0,budget-spotCount)].map(o=>o.e.light);
    const next=new Set([...reserved,...picks]);
    if(next.size!==allowed.size||[...next].some(light=>!allowed.has(light)))selectionChanges++;
    allowed=next;
    const selected=entries.filter(e=>allowed.has(e.light));
    const shadowSpots=selected.filter(e=>e.light.isSpotLight&&e.shadow).slice(0,2);
    const regularSpots=selected.filter(e=>e.light.isSpotLight&&!shadowSpots.includes(e)).slice(0,2);
    const pointLights=selected.filter(e=>e.light.isPointLight).slice(0,6);
    function bind(pool,sources){
      const pending=sources.filter(source=>!pool.some(slot=>slot.source===source));
      for(const slot of pool){
        if(sources.includes(slot.source))continue;
        const source=pending.shift()||null;
        if(source!==slot.source){slot.source=source;if(slot.light.castShadow){localDirty=true;slot.light.shadow.needsUpdate=true;}}
      }
    }
    bind(slots.slice(0,2),shadowSpots);bind(slots.slice(2,4),regularSpots);bind(slots.slice(4),pointLights);
  }
  function update(inside,dt,beat=0,cameraPosition){
    if(cameraPosition)viewer.copy(cameraPosition);selectionAge+=dt;
    const changed=inside!==insideLast;
    if(changed||selectionAge>.45){choose(inside);selectionAge=0;}insideLast=inside;
    if(hemi)hemi.intensity=THREE.MathUtils.damp(hemi.intensity,inside?.60:1.02,1.8,dt);
    if(ambient)ambient.intensity=THREE.MathUtils.damp(ambient.intensity,inside?.30:.24,1.8,dt);
    if(moon)moon.intensity=THREE.MathUtils.damp(moon.intensity,inside?.36:1.85,1.8,dt);
    const pulse=inside&&beat>0&&beat<=.4?.58+.42*Math.abs(beat-.2)/.2:1;
    for(const slot of slots){
      const light=slot.light,source=slot.source?.light;
      if(!source){light.intensity=0;continue;}
      source.updateWorldMatrix(true,false);source.getWorldPosition(world);
      if(light.castShadow&&light.position.distanceToSquared(world)>.000004){localDirty=true;light.shadow.needsUpdate=true;}
      light.position.copy(world);light.color.copy(source.color);
      light.intensity=source.intensity*pulse;light.distance=source.distance;light.decay=source.decay;
      light.userData.lightZone=slot.source.zone;
      if(light.isSpotLight){
        source.target.updateWorldMatrix(true,false);source.target.getWorldPosition(targetWorld);
        if(light.castShadow&&light.target.position.distanceToSquared(targetWorld)>.000004){localDirty=true;light.shadow.needsUpdate=true;}
        light.target.position.copy(targetWorld);light.angle=source.angle;light.penumbra=source.penumbra;
        if(light.castShadow){
          const a=light.shadow,b=source.shadow;a.bias=b.bias;a.normalBias=b.normalBias;a.radius=b.radius;
          if(a.camera.near!==b.camera.near||a.camera.far!==b.camera.far){a.camera.near=b.camera.near;a.camera.far=b.camera.far;a.camera.updateProjectionMatrix();a.needsUpdate=true;localDirty=true;}
        }
      }
    }
    // A slot may bind a nearer lamp without crossing a room boundary. Tell
    // the main scheduler to open its global shadow-update gate in that case.
    return changed||localDirty;
  }
  function invalidateShadows(reason='all'){
    if(reason!=='door'&&reason!=='interior')moonDirty=true;
    if(reason!=='forest')localDirty=true;
  }
  function flushShadows(includeMoon=true){
    let updates=0;
    if(localDirty){for(const {light} of slots)if(light.castShadow){light.shadow.needsUpdate=true;updates++;}localDirty=false;}
    if(moonDirty&&includeMoon&&moon){moon.shadow.needsUpdate=true;moonDirty=false;updates++;}
    if(updates)shadowInvalidations++;
    return updates>0;
  }
  function stats(){
    const assigned=slots.filter(slot=>slot.source);
    return {localLights:assigned.length,visibleLights:slots.length+3,activeLights:assigned.filter(slot=>slot.light.intensity>.0001).length+3,
      shadowLights:slots.filter(slot=>slot.light.castShadow).length+(moon?.castShadow?1:0),
      activeNames:assigned.map(slot=>slot.source.light.name),selectionChanges,shadowInvalidations,
      shaderSignature:'directional:1/1,spot:4/2,point:6/0,hemi:1,ambient:1',stableSlots:true};
  }
  return {update,invalidateShadows,flushShadows,stats};
}
