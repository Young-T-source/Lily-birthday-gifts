import * as THREE from 'three';
import { terrainHeight } from './environment.js';
import { LAYOUT, stairHeight, inUpperFloor } from './scene-layout.js';

// Authored against cabin.js: logs are centred at x=±4.60/z=±3.38.
// The nominal doorway is wider, but the cut log ends intrude .24 m.
const BODY_RADIUS = LAYOUT.bodyRadius;
const EYE_HEIGHT = 1.64;
const DOOR = Object.freeze({ x: -1.58, z: 3.40, minX: -2.08, maxX: -1.07,
  minZ: 3.20, maxZ: 3.58, hingeX: -2.25, width: 1.36 });
const FLOOR = 0.65;
const DECK = 0.5575;
const BOUNDS = 40 - BODY_RADIUS;
const WALK_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp',
  'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
const clamp = THREE.MathUtils.clamp;

/**
 * Walking is entirely opt-in; the module owns no UI or animation loop.
 * update(dt, elapsed) must be called instead of OrbitControls.update while active.
 * Mobile input: +X right, +Z forward; lookBy uses pointer movement in pixels.
 * Stop restores the orbit pose that was visible before start().
 */
export function createWalkController({ camera, canvas, orbitControls, cabin,
  onInsideChange = () => {}, onExit = () => {}, onInteract = () => false, onEscape=()=>false, toast = () => {} }) {
  if (!camera || !canvas || !cabin) throw new Error('Walking needs camera, canvas and cabin');
  const keys = new Set();
  const position = new THREE.Vector3(-1.40, 0, 7.7);
  const velocity = new THREE.Vector2();
  const analog = new THREE.Vector2();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const forward = new THREE.Vector3();
  let active = false, inside = false, yaw = 0, pitch = 0.015;
  let paused = false;
  let drag = null, orbitSnapshot = null, explicitPose = false;
  let blocked = false, blockedBy = null, distanceTravelled = 0, bobPhase = 0;
  let visualEyeY = 0, doorNoticeAt = -100, lastElapsed = 0;
  let requestedDoorOpen = null;
  let lastStyle = { cursor: '', touchAction: '' };

  const boxes = [];
  const box = (name,minX,maxX,minZ,maxZ,minY=-1,maxY=3.35,structural=false) => boxes.push({name,minX,maxX,minZ,maxZ,minY,maxY,structural});
  // Walls and glass are solid on both floors. Front door is the sole exterior opening.
  box('left wall',-4.79,-4.42,-3.64,3.64,-1,6.4,true);
  box('right wall',4.42,4.79,-3.64,3.64,-1,6.4,true);
  box('back wall',-4.99,4.99,-3.57,-3.20,-1,6.4,true);
  box('front wall left',-4.99,DOOR.minX,DOOR.minZ,DOOR.maxZ,-1,6.4,true);
  box('front wall right',DOOR.maxX,4.99,DOOR.minZ,DOOR.maxZ,-1,6.4,true);
  box('wall above entrance',DOOR.minX,DOOR.maxX,DOOR.minZ,DOOR.maxZ,2.94,6.4,true);
  box('chimney',-1.72,-.12,-5.23,-3.55,-1,12,true);
  box('left porch railing',-3.60,-3.44,3.88,5.84,.55,1.68,true);
  box('right porch railing',3.44,3.60,3.88,5.84,.55,1.68,true);
  box('left porch post',-3.61,-3.39,5.61,5.83,-1,5,true);
  box('right porch post',3.39,3.61,5.61,5.83,-1,5,true);
  box('porch bench',1.71,3.39,4.25,4.84,.55,1.5);
  box('sofa',-.66,1.96,.83,1.89,.65,1.99);
  box('coffee table',-1.65,-.05,-.45,.45,.65,1.15);
  box('fireplace hearth',-2.40,.57,-3.48,-2.37,.65,3.35);
  boxes.push({name:'dining table',shape:'circle',x:2.85,z:-1.55,radius:.72,minY:.65,maxY:1.12});
  const chair=(name,x,z,angle)=>boxes.push({name,shape:'obb',x,z,halfX:.29,halfZ:.29,angle,minY:.65,maxY:1.72});
  chair('dining chair left',1.90,-1.30,Math.PI/2+.2);
  chair('dining chair back',3.70,-2.10,-Math.PI/2-.5);
  chair('dining chair front',3.10,-.55,Math.PI-.1);
  box('kitchen counter',3.71,4.54,1.04,3.07,.65,1.56);
  box('sideboard',2.23,3.77,-3.28,-2.81,.65,1.57);
  boxes.push({name:'winter bouquet',shape:'circle',x:3.90,z:2.95,radius:.29,minY:.65,maxY:1.55});
  // Outside structural items: arch piers and the two log piles.
  box('stacked firewood',-5.58,-5.12,2.00,4.44,-1,1.78);
  boxes.push({name:'wood chopping block',shape:'circle',x:-4.55,z:6.3,radius:.30,minY:-1,maxY:1.2});
  boxes.push({name:'wooden sled',shape:'obb',x:5.7,z:5.6,halfX:.43,halfZ:.86,angle:-.5,minY:-1,maxY:.85});

  function doorAmount() {
    return clamp(Number(cabin.getDoorAmount?.()) || 0, 0, 1);
  }
  function doorDistance() {
    return Math.hypot(position.x - DOOR.x, position.z - DOOR.z);
  }
  function groundAt(x,z,hint=position.y-EYE_HEIGHT) {
    const stair=stairHeight(x,z);
    if(stair!==null)return stair;
    if(hint>2.55&&inUpperFloor(x,z))return LAYOUT.upperFloor;
    const snow = terrainHeight(x, z) + 0.045;
    if (Math.abs(x) < 4.43 && z > -3.22 && z < 3.42) return FLOOR;
    // A short sill joins the .5575 m porch to the .65 m indoor floor.
    if (x > DOOR.minX - 0.08 && x < DOOR.maxX + 0.08 && z >= 3.42 && z < 3.84) {
      return THREE.MathUtils.lerp(FLOOR, DECK, (z - 3.42) / 0.42);
    }
    if (Math.abs(x) < 3.69 && z >= 3.56 && z <= 6.025) return DECK;
    // Continuous accessibility surface over the three authored wooden steps.
    // Anchors follow the visible step tops .17/.30/.43 and the deck .5575.
    if (Math.abs(x) < 1.425 && z >= 6.025 && z < 7.58) {
      const anchors = [[6.025, DECK], [6.43, 0.43], [6.88, 0.30], [7.325, 0.17], [7.58, snow]];
      for (let i = 1; i < anchors.length; i++) {
        if (z <= anchors[i][0]) {
          const a = anchors[i - 1], b = anchors[i];
          return Math.max(snow, THREE.MathUtils.lerp(a[1], b[1], (z - a[0]) / (b[0] - a[0])));
        }
      }
    }
    return snow;
  }

  function intersectsBox(x,z,b,r=BODY_RADIUS){
    if(b.shape==='circle')return Math.hypot(x-b.x,z-b.z)<r+b.radius-1e-6;
    if(b.shape==='obb'){
      const dx=x-b.x,dz=z-b.z,c=Math.cos(b.angle),s=Math.sin(b.angle);
      const lx=c*dx-s*dz,lz=s*dx+c*dz;
      return (lx-clamp(lx,-b.halfX,b.halfX))**2+(lz-clamp(lz,-b.halfZ,b.halfZ))**2<r*r-1e-8;
    }
    const dx=x-clamp(x,b.minX,b.maxX),dz=z-clamp(z,b.minZ,b.maxZ);
    return dx*dx+dz*dz<r*r-1e-8;
  }
  function collisionAt(x,z,feet=groundAt(x,z)){
    for(const b of boxes){
      if(feet>=b.maxY-.035||feet+LAYOUT.bodyHeight<=b.minY+.035)continue;
      if(intersectsBox(x,z,b))return b.name;
    }
    if(feet>2.9)return null;
    if(doorAmount()<=.78&&intersectsBox(x,z,DOOR))return 'closed door';
    const amount=doorAmount();
    if(amount>.01){
      const eased=amount*amount*(3-2*amount),angle=eased*1.55;
      const vx=DOOR.width*Math.cos(angle),vz=-DOOR.width*Math.sin(angle);
      const t=clamp(((x-DOOR.hingeX)*vx+(z-DOOR.z)*vz)/(DOOR.width*DOOR.width),0,1);
      if((x-DOOR.hingeX-vx*t)**2+(z-DOOR.z-vz*t)**2<(BODY_RADIUS+.085)**2)return 'swinging door';
    }
    return null;
  }
  function canReach(point,maxDistance=2.3){
    const end=point.clone?point:new THREE.Vector3(...point);
    if(camera.position.distanceTo(end)>maxDistance)return false;
    // No touching through walls, upper floor or stairwell guard. Furniture tops remain reachable.
    const start=camera.position,feet=position.y-EYE_HEIGHT;
    if(feet<2.3&&end.y>3.5||feet>2.8&&end.y<3.35)return false;
    for(let i=1;i<29;i++){
      const t=i/30,x=THREE.MathUtils.lerp(start.x,end.x,t),y=THREE.MathUtils.lerp(start.y,end.y,t),z=THREE.MathUtils.lerp(start.z,end.z,t);
      for(const b of boxes)if(b.structural&&y>b.minY&&y<b.maxY&&intersectsBox(x,z,b,.015))return false;
    }
    return true;
  }
  function syncInside(force = false) {
    const next = inside
      ? Math.abs(position.x) < 4.55 && position.z > -3.45 && position.z < 3.54
      : Math.abs(position.x) < 4.43 && position.z > -3.22 && position.z < 3.20;
    if (force || next !== inside) {
      inside = next;
      onInsideChange(inside, getState());
    }
  }
  function orientCamera() {
    euler.set(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
    camera.position.set(position.x, visualEyeY, position.z);
    camera.updateMatrixWorld();
  }
  function readOrbit() {
    if (!orbitControls) return null;
    const props = ['enabled', 'autoRotate', 'enableDamping', 'minDistance', 'maxDistance',
      'minPolarAngle', 'maxPolarAngle', 'rotateSpeed'];
    const snapshot = { position: camera.position.clone(), quaternion: camera.quaternion.clone(),
      target: orbitControls.target.clone(), fov: camera.fov, props: {} };
    for (const p of props) snapshot.props[p] = orbitControls[p];
    return snapshot;
  }

  function start() {
    if (active) return getState();
    orbitSnapshot = readOrbit();
    if (!explicitPose) {
      // The left side of the real steps overlaps the door's clear corridor;
      // a straight W approach reaches the handle without wall-slide drift.
      position.set(-1.40, 0, 7.7);
      yaw = 0; pitch = 0.015;
    }
    explicitPose = false;
    position.y = groundAt(position.x, position.z) + EYE_HEIGHT;
    visualEyeY = position.y;
    velocity.set(0, 0); analog.set(0, 0); keys.clear();
    blocked = false; blockedBy = null; bobPhase = 0;
    active = true;
    if (orbitControls) { orbitControls.enabled = false; orbitControls.autoRotate = false; }
    lastStyle = { cursor: canvas.style.cursor, touchAction: canvas.style.touchAction };
    canvas.style.cursor = 'grab'; canvas.style.touchAction = 'none';
    camera.fov = 62;
    camera.updateProjectionMatrix();
    orientCamera();
    syncInside(true);
    return getState();
  }
  function stop() {
    if (!active) return getState();
    active = false;
    keys.clear(); analog.set(0, 0); velocity.set(0, 0);
    releaseDrag();
    canvas.style.cursor = lastStyle.cursor;
    canvas.style.touchAction = lastStyle.touchAction;
    if (orbitSnapshot && orbitControls) {
      camera.position.copy(orbitSnapshot.position);
      camera.quaternion.copy(orbitSnapshot.quaternion);
      camera.fov = orbitSnapshot.fov;
      camera.updateProjectionMatrix();
      orbitControls.target.copy(orbitSnapshot.target);
      Object.assign(orbitControls, orbitSnapshot.props);
      orbitControls.enabled = true;
      orbitControls.autoRotate = false;
      orbitControls.update();
    } else if (orbitControls) {
      camera.getWorldDirection(forward);
      orbitControls.target.copy(camera.position).addScaledVector(forward, 3);
      orbitControls.minDistance = 0.5;
      orbitControls.enabled = true;
      orbitControls.update();
    }
    const state = getState();
    onExit(state);
    return state;
  }

  function tryMove(x, z) {
    const nextGround=groundAt(x,z);
    const reason = collisionAt(x,z,nextGround);
    if (reason) { blocked = true; blockedBy = reason; return false; }
    // A raised deck can be approached using its real stairs, not by passing
    // horizontally through its side. Walking down from its edge is allowed.
    if (Math.abs(nextGround - groundAt(position.x, position.z)) > 0.26) {
      blocked = true; blockedBy = 'step or floor edge'; return false;
    }
    distanceTravelled += Math.hypot(x - position.x, z - position.z);
    position.x = x; position.z = z; position.y=nextGround+EYE_HEIGHT;
    return true;
  }

  function update(dt, elapsed = lastElapsed + dt) {
    if (!active || paused) return;
    lastElapsed = Number.isFinite(elapsed) ? elapsed : lastElapsed;
    dt = clamp(Number(dt) || 0, 0, 0.10);
    blocked = false; blockedBy = null;
    const kx = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    const kz = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
    let ix = clamp(kx + analog.x, -1, 1), iz = clamp(kz + analog.y, -1, 1);
    const norm = Math.hypot(ix, iz);
    if (norm > 1) { ix /= norm; iz /= norm; }
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3.45 : 2.15;
    const vx = (Math.cos(yaw) * ix - Math.sin(yaw) * iz) * speed;
    const vz = (-Math.sin(yaw) * ix - Math.cos(yaw) * iz) * speed;
    const damping = 1 - Math.exp(-dt * 15);
    velocity.x += (vx - velocity.x) * damping;
    velocity.y += (vz - velocity.y) * damping;
    const dx = velocity.x * dt, dz = velocity.y * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.055));
    for (let i = 0; i < steps; i++) {
      tryMove(clamp(position.x + dx / steps, -BOUNDS, BOUNDS), position.z);
      tryMove(position.x, clamp(position.z + dz / steps, -BOUNDS, BOUNDS));
    }
    position.y = groundAt(position.x, position.z) + EYE_HEIGHT;
    // Small walking sway, not a constant camera oscillation when standing.
    const motion = Math.min(1, Math.hypot(velocity.x, velocity.y) / 2.15);
    bobPhase += dt * motion * 10.5;
    const targetY = position.y + Math.sin(bobPhase) * 0.012 * motion;
    visualEyeY += (targetY - visualEyeY) * (1 - Math.exp(-dt * 18));
    orientCamera();
    syncInside();
    if (blockedBy === 'closed door' && lastElapsed - doorNoticeAt > 4) {
      doorNoticeAt = lastElapsed;
      toast('木门关着，按 E 或点击「开门」');
    }
  }

  function interact() {
    if (!active) return false;
    if (paused || onInteract()) return true;
    if (doorDistance() > 2.3) { toast('靠近木门后，再按 E 开关门'); return false; }
    const target = typeof cabin.doorState?.target === 'number' ? cabin.doorState.target
      : requestedDoorOpen === null ? (doorAmount() > 0.5 ? 1 : 0) : Number(requestedDoorOpen);
    const open = target < 0.5;
    // Closing through the occupant would strand them inside the collider.
    // Check the full inward swing sector as well as the threshold itself.
    const hx = position.x - DOOR.hingeX, hz = position.z - DOOR.z;
    const swingAngle = Math.atan2(-hz, hx);
    const inSwing = Math.hypot(hx, hz) < DOOR.width + BODY_RADIUS + 0.10 &&
      swingAngle > -0.20 && swingAngle < 2.12;
    const inThreshold = position.x > DOOR.minX - 0.25 && position.x < DOOR.maxX + 0.25 &&
      position.z > DOOR.minZ - 0.30 && position.z < DOOR.maxZ + 0.30;
    if (!open && (inThreshold || inSwing)) {
      toast('请先离开门口，再关门');
      return false;
    }
    requestedDoorOpen = open;
    cabin.setDoor(open);
    toast(open ? '木门打开了，向前走进暖屋' : '木门轻轻合上');
    return true;
  }

  function getState() {
    return {
      active, inside, yaw, pitch,
      position: { x: position.x, y: position.y, z: position.z },
      positionArray: position.toArray(),
      cameraPosition: camera.position.toArray(),
      speed: Math.hypot(velocity.x, velocity.y),
      blocked, blockedBy, distanceTravelled,
      groundHeight: groundAt(position.x, position.z), eyeHeight: EYE_HEIGHT,
      floor:position.y-EYE_HEIGHT>3.2?2:1, onStairs:stairHeight(position.x,position.z)!==null,
      doorDistance: doorDistance(), nearDoor: doorDistance() <= 2.3,
      doorAmount: doorAmount(), doorPassable: doorAmount() > 0.78,
      input: { x: analog.x, z: analog.y },
      keys: [...keys]
    };
  }
  function setPose(pos, newYaw = yaw, newPitch = pitch) {
    const x = Array.isArray(pos) ? Number(pos[0]) : Number(pos?.x);
    const z = Array.isArray(pos) ? Number(pos[2]) : Number(pos?.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    const nx = clamp(x, -BOUNDS, BOUNDS), nz = clamp(z, -BOUNDS, BOUNDS);
    const requestedY=Array.isArray(pos)?Number(pos[1]):Number(pos?.y);
    const ground=groundAt(nx,nz,requestedY>2?requestedY:0);
    if (collisionAt(nx,nz,ground)) return false;
    position.set(nx,ground+EYE_HEIGHT,nz);
    if (Number.isFinite(newYaw)) yaw = newYaw;
    if (Number.isFinite(newPitch)) pitch = clamp(newPitch, -1.35, 1.35);
    visualEyeY = position.y;
    velocity.set(0, 0);
    explicitPose = !active;
    if (active) { orientCamera(); syncInside(); }
    return true;
  }
  function setMoveInput(axisX, axisZ) {
    analog.set(clamp(Number(axisX) || 0, -1, 1), clamp(Number(axisZ) || 0, -1, 1));
  }
  function lookBy(dx, dy) {
    if (!active) return;
    yaw -= (Number(dx) || 0) * 0.0026;
    pitch = clamp(pitch - (Number(dy) || 0) * 0.0022, -1.35, 1.35);
    orientCamera();
  }
  function releaseDrag() {
    if (drag && canvas.hasPointerCapture?.(drag.id)) canvas.releasePointerCapture(drag.id);
    drag = null;
    if (active) canvas.style.cursor = 'grab';
  }
  function editableTarget(target) {
    return !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  }
  function keyCode(event) {
    if (event.code) return event.code;
    const k = (event.key || '').toLowerCase();
    if (k.length === 1 && /[wasde]/.test(k)) return `Key${k.toUpperCase()}`;
    if (k === 'shift') return 'ShiftLeft';
    return event.key;
  }
  window.addEventListener('keydown', event => {
    if(event.key==='Escape'&&onEscape()){event.preventDefault();event.stopImmediatePropagation();return;}
    if (!active || paused || editableTarget(event.target)) return;
    const code = keyCode(event);
    if (code === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); stop(); return;
    }
    if (code === 'KeyE') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) interact();
      return;
    }
    if (WALK_KEYS.has(code)) { event.preventDefault(); keys.add(code); }
  }, true);
  window.addEventListener('keyup', event => {
    const code = keyCode(event);
    keys.delete(code);
    if (active && WALK_KEYS.has(code)) event.preventDefault();
  });
  window.addEventListener('blur', () => {
    keys.clear(); analog.set(0, 0); velocity.set(0, 0); releaseDrag();
  });
  canvas.addEventListener('pointerdown', event => {
    if (!active || paused || drag || (event.button !== 0 && event.button !== 2 && event.pointerType !== 'touch')) return;
    event.preventDefault();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', event => {
    if (!active || paused || !drag || event.pointerId !== drag.id) return;
    lookBy(event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX; drag.y = event.clientY;
  });
  canvas.addEventListener('pointerup', event=>{if(drag?.id===event.pointerId)releaseDrag();});
  canvas.addEventListener('pointercancel', event=>{if(drag?.id===event.pointerId)releaseDrag();});
  canvas.addEventListener('lostpointercapture', event=>{if(drag?.id===event.pointerId)drag=null;});
  canvas.addEventListener('contextmenu', event => { if (active) event.preventDefault(); });

  position.y = groundAt(position.x, position.z) + EYE_HEIGHT;
  return { get active() { return active; }, start, stop, update, interact, getState,
    setPose, setMoveInput, lookBy, canReach,
    getColliders:()=>boxes.map(b=>({...b})),
    probe:(x,z,feet)=>({ground:groundAt(x,z,feet??0),blockedBy:collisionAt(x,z,feet??groundAt(x,z,0))}),
    setPaused(value){paused=!!value;keys.clear();analog.set(0,0);velocity.set(0,0);releaseDrag();},
    addCollider(name,x,z,r=.55,minY=-1,maxY=2.8){boxes.push({name,shape:'circle',x,z,radius:r,minY,maxY});},
    addColliderBox(data){boxes.push({...data,minY:data.minY??.65,maxY:data.maxY??3.3});}
  };
}
