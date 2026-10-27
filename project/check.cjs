const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname,out=path.resolve(root,'..');
(async()=>{
  const html=fs.readFileSync(path.join(out,'index.html'),'utf8');
  assert(html.includes('给 Lily 的生日雪夜'));
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,1);new vm.Script(scripts[0][1]);
  assert(!/https?:\/\//.test(html.replace(scripts[0][0],'')),'No external page dependency');
  const content=await import('./src/story-data.js');
  assert.equal(content.STORIES.length,7);
  assert.equal(new Set(content.STORIES.map(s=>s.id)).size,7);
  assert(content.STORIES.some(s=>s.id==='letter'));
  for(const f of ['assets/hearth_props.glb','assets/birthday_props.glb']){
    const b=fs.readFileSync(path.join(root,f));assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(4),2);
  }
  // Exercise first-person movement, collision and reading pause against Three.
  const deps=fs.existsSync(path.join(root,'node_modules/esbuild'))?path.join(root,'node_modules'):'C:/页面/winter-cabin-build/node_modules';
  const esbuild=require(path.join(deps,'esbuild'));const THREE=await import(require('node:url').pathToFileURL(path.join(deps,'three/build/three.module.js')).href);
  const js=await esbuild.build({entryPoints:[path.join(root,'src/walk.js')],bundle:true,platform:'node',format:'cjs',write:false,nodePaths:[deps]});
  const listeners={};global.window={addEventListener:(type,fn)=>{(listeners[type]??=[]).push(fn);}};
  const sandbox={exports:{},module:{exports:{}},require,console,window:global.window};vm.runInNewContext(js.outputFiles[0].text,sandbox);
  const camera=new THREE.PerspectiveCamera(62,1.6,.08,200),target=new THREE.Vector3();
  const pointerListeners={};const canvas={style:{},addEventListener(type,fn){(pointerListeners[type]??=[]).push(fn);},hasPointerCapture(){return false;},setPointerCapture(){}};
  const orbit={target,enabled:true,update(){}};let door=0,interactions=0;
  const cabin={doorState:{target:0},getDoorAmount:()=>door,setDoor:v=>{door=Number(v);}};
  let escaped=0;const walk=sandbox.module.exports.createWalkController({camera,canvas,orbitControls:orbit,cabin,onEscape:()=>{escaped++;return true;},onInteract:()=>{interactions++;return true;}});
  assert(walk.setPose([0,0,11],0,0));walk.start();
  const key={code:'KeyW',key:'w',target:null,preventDefault(){},stopImmediatePropagation(){}};
  listeners.keydown.forEach(fn=>fn(key));const a=walk.getState().position.z;walk.update(.1,1);assert(walk.getState().position.z<a);
  walk.setPaused(true);const b=walk.getState().position.z;listeners.keydown.forEach(fn=>fn(key));walk.update(.1,2);assert.equal(walk.getState().position.z,b);
  walk.setPaused(false);walk.interact();assert.equal(interactions,1);
  assert.equal(walk.setPose([-.8,0,0],0,0),false,'Coffee table remains solid');
  assert(walk.setPose([-1.4,0,4],0,0));listeners.keydown.forEach(fn=>fn(key));for(let i=0;i<30;i++)walk.update(.1,3+i*.1);assert(walk.getState().position.z>3.5,'Closed door remains solid');
  const emit=(type,id,x=100)=>{for(const fn of pointerListeners[type]||[])fn({pointerId:id,clientX:x,clientY:100,button:0,pointerType:'touch',preventDefault(){}});};
  const beforeYaw=walk.getState().yaw;emit('pointerdown',1);emit('pointerdown',2,150);emit('pointermove',2,180);assert.equal(walk.getState().yaw,beforeYaw,'Second finger cannot replace look pointer');emit('pointerup',2);emit('pointermove',1,120);assert.notEqual(walk.getState().yaw,beforeYaw,'Second finger release must not cancel primary drag');emit('lostpointercapture',1);const releasedYaw=walk.getState().yaw;emit('pointermove',1,180);assert.equal(walk.getState().yaw,releasedYaw,'Lost capture releases look');
  walk.setPaused(true);listeners.keydown.forEach(fn=>fn({...key,key:'Escape',code:'Escape'}));assert.equal(escaped,1,'Esc reaches gesture cancellation while paused');
  delete global.window;
  console.log(JSON.stringify({pageSyntax:'pass',chapters:7,glbAssets:2,walking:'pass',readingPause:'pass',furnitureCollision:'pass',closedDoorCollision:'pass',multiPointer:'pass',escapeWhilePaused:'pass'},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
