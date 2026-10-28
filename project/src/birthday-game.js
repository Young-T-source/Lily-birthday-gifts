import * as THREE from 'three';
import { createBirthdayWorld } from './birthday-world.js';
import { createBirthdayEffects } from './birthday-effects.js';
import { mountBirthdayUI } from './birthday-ui.js';
import { MEDIA } from './local-media.js';
import { terrainHeight } from './environment.js';
import { createInteriorInteractions } from './interior-interactions.js';
import { createBirthdayLoft } from './birthday-loft.js';
import { PERSONAL, BEATS } from './personal.js';
import { createMemoryGallery } from './memory-gallery-v9.js';
import { createTreasureTree } from './treasure-tree-v9.js';

export function setupBirthdayGame({scene,camera,renderer,textures,walk,controls,cabin,sound,toast,smoke,snowfall,saveKeepsake}) {
  const world=createBirthdayWorld({scene,textures,hasAlbum:!!MEDIA.albumPhotos?.length});
  world.targets.filter(t=>t.id!=='letter').forEach(t=>walk.addCollider('memory '+t.id,t.position.x,t.position.z,.64));
  const effects=createBirthdayEffects({scene,camera,textures,terrainHeight,lowGraphics:innerWidth<700});
  const interior=createInteriorInteractions({scene,textures});
  const loft=createBirthdayLoft({scene,textures});
  const gallery=createMemoryGallery({scene,camera,textures,photos:MEDIA.albumPhotos||[]});
  const treasure=createTreasureTree({scene,textures,terrainHeight});treasure.group.visible=false;
  for(const c of [...interior.colliders,...loft.colliders,...treasure.colliders])walk.addColliderBox(c);
  const insideTargets=[...interior.targets,...loft.targets];
  const targets=[...world.targets,...insideTargets,...gallery.targets,treasure.target];
  const indoors=t=>t.kind==='interior'||t.kind==='album'||t.id==='letter';
  const reach=t=>t.kind==='album'?9:t.kind==='interior'?1.60:1.80;
  const weather=[...(smoke?.layers||[]).map(l=>({u:l.mat.uniforms.uOpacity,show:.12})),...(snowfall?.group||[]).map(o=>({u:o.material.uniforms.uOpacity,show:.26}))].map(o=>({...o,base:o.u.value}));
  const opened=new Set();
  let near=null,reading=false,begun=false,lastNearId='',touching=null,lastPhase='idle',actionTime=0,ending=null,endingDone=false,caption=null,lastStep=0,stepSide=0,manualPaused=false,lightBeat=0,visitTime=0;
  let readingReturnPose=null;
  let song=MEDIA.music?new Audio(MEDIA.music):null;
  if(song){song.loop=true;song.volume=.33;}
  const ui=mountBirthdayUI({
    albumPhotos:MEDIA.albumPhotos||[],
    onBegin:begin,
    onNavigate:openMemory,
    onBirthdayNote:openBirthdayNote,
    onAlbum:()=>openAlbum(),
    onVisitAlbum:visitAlbum,
    onVisitInterior:visitInterior,
    onStairs:visitStairs,
    onBirthdayRoom:visitBirthdayRoom,
    onBirthdaySigns:visitBirthdaySigns,
    onInteract:activateTarget,
    onFireworks:celebrate,
    onPauseShow(){manualPaused=!manualPaused;effects.setPaused(manualPaused||reading);ui.setShowPaused(manualPaused);},
    onSkip(){manualPaused=false;effects.setPaused(false);effects.skip();},
    onCancel:cancelTouch,
    onSave:()=>saveKeepsake?.(),
    onMusic:options=>options?.edit?document.querySelector('#gift-music-file')?.click():toggleMusic(),
    onPhotoUpload:()=>document.querySelector('#gift-photo-files')?.click(),
    onClose:closeReading,
    onOpen:pause
  });
  ui.setMusicAvailable?.(!!song);
  effects.onBurst(({position,style})=>sound.firework?.(position.distanceTo(camera.position),position.x-camera.position.x,style));
  const loader=new THREE.TextureLoader();
  MEDIA.photos.forEach((src,i)=>loader.load(src,t=>{t.colorSpace=THREE.SRGBColorSpace;world.setPhoto(i,t);}));
  if(new URLSearchParams(location.search).get('edit')==='1')mountEditor();
  world.ready?.catch(e=>{console.warn('Birthday props:',e);toast('部分桌面装饰暂未载入，回忆和烟花仍可使用');});

  function begin(){
    if(begun)return;begun=true;document.body.classList.add('gift-started');
    const portrait=innerWidth/innerHeight<.85;
    walk.setPose([portrait?.45:-.60,0,portrait?22:17],0,.10);walk.start();
    world.revealForecourt?.();treasure.group.visible=true;lightBeat=.8;
    sound.setEnabled(true).then(()=>syncAudio());
    if(song){sound.attachMusic?.(song);}if(song)song.play().then(()=>ui.setMusicPlaying(true)).catch(()=>ui.setMusicPlaying(false));
    toast('梦琪，欢迎来到为你留灯的雪夜。沿暖灯寻找「美好的回忆」',6500);
    const now=new Date();if(now.getMonth()===9&&now.getDate()===29&&now.getHours()===23&&now.getMinutes()===59)toast('生日快乐，最后一分钟。明天，也会好好爱你。',6500);
  }
  function syncAudio(){ui.setAudioState?.({available:!!song,enabled:sound.enabled,playing:!!song&&!song.paused});const button=document.querySelector('#btn-sound');button?.classList.toggle('on',sound.enabled);button?.setAttribute('aria-pressed',String(sound.enabled));}
  function cancelTouch(){if(!touching)return false;if(touching.canceling)return true;effects.cancelTouch?.();touching.canceling=true;touching.cancelAge=0;touching.cancelCamera=camera.position.clone();walk.setPaused(true);ui.setTouching?.(false);return true;}
  function resetTouch(){if(touching){camera.position.copy(touching.baseCamera);touching=null;}effects.cancelTouch?.();ui.setTouching?.(false);}
  function cancelEnding(){ending=null;endingDone=false;ui.setEnding?.(false);}
  function pause(){cancelEnding();reading=true;effects.setPaused(true);sound.setReading?.(true);if(song)song.volume=.083;walk.setPaused(true);controls.enabled=false;document.body.classList.add('birthday-reading');}
  function closeReading(){reading=false;effects.setPaused(manualPaused);sound.setReading?.(false);if(song)song.volume=.33;if(readingReturnPose&&effects.getStats().fireworksActive){walk.setPose(readingReturnPose.positionArray,readingReturnPose.yaw,readingReturnPose.pitch);}readingReturnPose=null;walk.setPaused(false);controls.enabled=!walk.active;document.body.classList.remove('birthday-reading','reading-memory','reading-letter');}
  function mark(id){opened.add(id);world.setOpened(id);world.focus?.(id);ui.setProgress([...opened]);}
  function openMemory(id){
    if(!reading&&effects.getStats().fireworksActive)readingReturnPose=walk.getState();
    resetTouch();
    if(!begun)begin();
    const target=world.targets.find(t=>t.id===id);if(!target)return;
    if(!walk.active)walk.start();
    const p=target.position;
    const poses=id==='letter'?[[.5,0,-.25],[-1.8,0,1.8],[-2.2,0,.8]]:[[p.x,0,p.z+2.6],[p.x+2.4,0,p.z],[p.x-2.4,0,p.z]];
    for(const q of poses){
      const y=(id==='letter'?.65:terrainHeight(q[0],q[2])+.045)+1.64;
      const sideOffset=id!=='letter'&&innerWidth>900?1.1:0;
      const dx=p.x+sideOffset-q[0],dz=p.z-q[2],dy=p.y+.4-y;
      if(walk.setPose(q,Math.atan2(-dx,-dz),Math.atan2(dy,Math.hypot(dx,dz))))break;
    }
    if(id==='letter')cabin.setDoor(true);
    pause();mark(id);
    document.body.classList.toggle('reading-memory',id!=='letter');
    document.body.classList.toggle('reading-letter',id==='letter');
    ui.openStory(id);
  }
  function keepReadingPose(){if(!reading&&effects.getStats().fireworksActive)readingReturnPose=walk.getState();}
  function openBirthdayNote(){if(!begun)begin();keepReadingPose();resetTouch();document.body.classList.remove('reading-memory','reading-letter');ui.openBirthdayNote();}
  function openAlbum(photoId){if(!begun)begin();keepReadingPose();resetTouch();document.body.classList.remove('reading-memory','reading-letter');ui.openAlbum(photoId);}
  function visitAlbum(){
    cancelEnding();if(!begun)begin();ui.close();closeReading();resetTouch();cabin.setDoor(true);if(!walk.active)walk.start();
    const pose=gallery.getOverviewPose();walk.setPose(pose.position,pose.yaw,pose.pitch);
    toast('28 张照片，都在这里。轻点任一相框，可以放大、翻页，看看那时的我们。',6500);
  }
  function openSecretLetter(){
    if(!treasure.unlocked)return false;
    keepReadingPose();resetTouch();ui.unlockSecretLetter();ui.openLetter();document.body.classList.add('reading-letter');return true;
  }
  function visitStairs(){
    cancelEnding();
    if(!begun)begin();ui.close();closeReading();resetTouch();walk.setPaused(false);cabin.setDoor(true);if(!walk.active)walk.start();
    walk.setPose([-3.70,0,2.90],0,.04);toast('沿左侧的暖灯慢慢上楼，楼上还藏着一些心意。',5000);
  }
  function visitBirthdayRoom(){
    cancelEnding();if(!begun)begin();ui.close();closeReading();resetTouch();walk.setPaused(false);cabin.setDoor(true);if(!walk.active)walk.start();
    walk.setPose([1.45,3.45,1.65],0,-.64);toast('每一步，都想给你铺上祝福。',4000);
  }
  function visitBirthdaySigns(){
    cancelEnding();if(!begun)begin();ui.close();closeReading();resetTouch();walk.setPaused(false);cabin.setDoor(true);if(!walk.active)walk.start();
    const portrait=innerWidth/innerHeight<.9;
    walk.setPose([portrait?3.10:.05,0,portrait?11.5:12.6],0,portrait?-.10:.035);toast('生日快乐，小李朋友。',3500);
  }
  function visitInterior(id){
    cancelEnding();
    if(!begun)begin();ui.close();closeReading();
    const target=insideTargets.find(t=>t.id===id);if(!target)return;
    resetTouch();walk.setPaused(false);cabin.setDoor(true);visitTime=actionTime;
    if(!walk.active)walk.start();
    const fallback={
      'interior-clock':[-2.12,0,-.35],
      'interior-wardrobe':[-3.30,0,-1.65],
      'interior-gift':[1.48,0,-1.75],
      'interior-tea':[-.23,0,-.9],
      'interior-cake':[3.07,0,2.35]
    };
    const q=target.viewPose||fallback[id],p=target.position;
    const dx=p.x-q[0],dz=p.z-q[2],dy=p.y-((q[1]||.65)+1.64);
    if(!walk.setPose(q,Math.atan2(-dx,-dz),Math.atan2(dy,Math.hypot(dx,dz)))){
      toast('沿着炉火旁的小路走近它，轻点或按 E。',4000);return;
    }
    toast(`${target.title} · ${target.action||'轻触'}，会有一点小惊喜`,3800);
  }
  function activateTarget(id){
    const target=targets.find(t=>t.id===id);if(!target||reading||touching)return;
    const state=walk.getState();
    if(indoors(target)!==state.inside)return;
    if(target.kind==='album'){if(camera.position.distanceTo(target.position)<=reach(target))openAlbum(target.photoId);return;}
    const memory=target.kind!=='interior';
    if(!walk.canReach(target.position,memory?1.80:1.60)||(!memory&&!state.inside)){toast('再靠近一点，就可以轻轻触碰。');return;}
    const beat=BEATS[id]||{duration:4.2,gesture:'open',sound:'paper'};
    const duration=effects.playTouch?.(target.position,beat.gesture,{duration:beat.duration})||beat.duration;
    touching={id,age:0,duration,beat,memory,treasure:target.kind==='treasure',note:id==='letter',contactTime:effects.touchContactTime??1.72,baseCamera:camera.position.clone(),lean:target.position.clone().sub(camera.position).normalize().multiplyScalar(Math.min(.40,Math.max(0,camera.position.distanceTo(target.position)-1.12))),done:false};
    walk.setPaused(true);
    ui.setTouching?.(true);
  }
  function interact(){if(reading||touching)return true;if(!near)return false;activateTarget(near.id);return true;}
  function celebrate(){
    if(!begun)begin();ui.close();closeReading();
    cabin.setDoor(true);if(!walk.active)walk.start();
    const portrait=innerWidth/innerHeight<.78;
    resetTouch();ending=null;endingDone=false;ui.setEnding?.(false);manualPaused=false;walk.setPaused(false);
    walk.setPose([portrait?5:0,0,portrait?28:26],0,portrait?.51:.48);effects.startFireworks();
    ui.setShowState?.(true);ui.setShowPaused?.(false);
    document.body.classList.add('birthday-fireworks');
  }
  async function toggleMusic(){
    if(song){
      if(song.paused){try{await sound.setEnabled(true);sound.attachMusic?.(song);await song.play();syncAudio();}catch{toast('请再点击一次，允许播放这首歌');}}
      else{song.pause();ui.setMusicPlaying(false);}
    }else{
      const on=!sound.enabled;await sound.setEnabled(on);syncAudio();
    }
  }
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let pointerDown=null;const activePointers=new Set();
  renderer.domElement.addEventListener('pointerdown',e=>{activePointers.add(e.pointerId);if(activePointers.size>1){pointerDown=null;return;}pointerDown={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now()};});
  const clearPointer=e=>{activePointers.delete(e.pointerId);if(pointerDown?.id===e.pointerId)pointerDown=null;};
  renderer.domElement.addEventListener('pointercancel',clearPointer);
  renderer.domElement.addEventListener('lostpointercapture',clearPointer);
  window.addEventListener('blur',()=>{activePointers.clear();pointerDown=null;});
  window.addEventListener('pointerup',clearPointer);
  renderer.domElement.addEventListener('pointerup',e=>{
    activePointers.delete(e.pointerId);const down=pointerDown;pointerDown=null;
    if(!begun||reading||touching||!down||down.id!==e.pointerId||activePointers.size||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7||performance.now()-down.t>700)return;
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
    let selected=null,dist=Infinity;
    const state=walk.getState();
    for(const target of targets){
      if(walk.active&&indoors(target)!==state.inside)continue;
      const hit=ray.intersectObject(target.object,true)[0];if(hit&&hit.distance<dist){selected=target;dist=hit.distance;}
    }
    // Physical reach in first person. The optional map offers accessible chapter selection.
    if(selected&&(!walk.active||dist<reach(selected))&&(!walk.active||selected.kind==='album'||walk.canReach(selected.position,reach(selected)))){e.stopImmediatePropagation();activateTarget(selected.id);}
    else if(walk.active&&ray.intersectObjects(cabin.doorMeshes,false).length){e.stopImmediatePropagation();walk.interact();}
  });
  function mountEditor(){
    const panel=document.createElement('aside');panel.id='gift-editor';
    panel.innerHTML='<b>布置这份礼物</b><label>回忆墙照片（最多三张）</label><input id="gift-photo-files" type="file" accept="image/*" multiple><label>背景音乐</label><input id="gift-music-file" type="file" accept="audio/*"><p>这里只在本机预览素材，不上传。正式保存请将照片与音乐放入 assets 对应文件夹，再运行「重新生成.cmd」。</p><button type="button">收起设置</button>';
    document.body.append(panel);panel.querySelector('button').onclick=()=>panel.hidden=true;
    panel.querySelector('#gift-photo-files').onchange=e=>{
      [...e.target.files].slice(0,3).forEach((file,i)=>{const url=URL.createObjectURL(file);loader.load(url,t=>{t.colorSpace=THREE.SRGBColorSpace;world.setPhoto(i,t);URL.revokeObjectURL(url);});});
      toast('照片已放进二楼回忆墙；正式文件可通过重新生成保存',4500);
    };
    panel.querySelector('#gift-music-file').onchange=async e=>{
      const file=e.target.files[0];if(!file)return;song?.pause();song=new Audio(URL.createObjectURL(file));song.loop=true;song.volume=.33;
      ui.setMusicAvailable?.(true);
      try{await sound.setEnabled(true);sound.attachMusic?.(song);await song.play();ui.setMusicPlaying(true);toast('背景音乐已加入本次预览');}catch{toast('点击右上角音乐按钮播放');}
    };
  }
  return {
    world,effects,interior,loft,gallery,treasure,ui,interact,visitInterior,visitStairs,visitAlbum,cancelTouch,syncAudio,
    enter(){return ui.begin();},
    get lightBeat(){return lightBeat;},
    handleEscape(){if(touching)return cancelTouch();if(reading){ui.close();return true;}if(effects.getStats().fireworksActive){manualPaused=false;ui.setShowPaused?.(false);effects.setPaused(false);effects.skip();return true;}return false;},
    get isReading(){return reading;},
    ready(){ui.setReady();},
    update(dt,time){
      dt=document.hidden?0:Math.min(.1,Math.max(0,dt));actionTime+=dt;lightBeat=Math.max(0,lightBeat-dt);syncAudio();
      world.update(dt,time);
      interior.update(dt,time);loft.update(dt,time);treasure.update(reading?0:dt,time);
      if(touching){
        touching.age+=dt;const age=touching.age;
        const smooth=v=>{v=THREE.MathUtils.clamp(v,0,1);return v*v*v*(v*(v*6-15)+10);};
        const leanWeight=smooth(age/1.45)*(1-smooth((age-(touching.duration-1.75))/1.65));
        camera.position.copy(touching.baseCamera).addScaledVector(touching.lean,leanWeight);camera.updateMatrixWorld(true);
        if(touching.canceling){touching.cancelAge+=dt;camera.position.lerpVectors(touching.cancelCamera,touching.baseCamera,smooth(touching.cancelAge/.28));if(touching.cancelAge>=.28){touching=null;walk.setPaused(false);}}
        else if(!touching.done&&age>=touching.contactTime){
          touching.done=true;sound.touch?.(touching.beat.sound);
          if(touching.treasure){treasure.open();}
          else if(touching.note){ui.setTouching?.(false);openBirthdayNote();}
          else if(touching.memory){const id=touching.id;world.setOpened(id);ui.setTouching?.(false);openMemory(id);}
          else {const result=touching.id.startsWith('loft-')?loft.interact(touching.id):interior.interact(touching.id);caption={point:targets.find(t=>t.id===touching.id).position.clone(),text:touching.beat.line||result?.message,age:0};if(touching.id==='interior-cake')lightBeat=.4;}
        }
        if(touching?.treasure&&touching.done&&age>=touching.contactTime+.95){openSecretLetter();}
        if(touching&&age>=touching.duration){camera.position.copy(touching.baseCamera);camera.updateMatrixWorld(true);touching=null;walk.setPaused(false);ui.setTouching?.(false);}
      }
      if(caption){caption.age+=dt;const p=caption.point.clone().project(camera);ui.setWorldCaption?.(caption.text,{x:Math.max(.16,Math.min(.84,(p.x+1)/2)),y:Math.max(.22,Math.min(.62,(1-p.y)/2-.13))},caption.age<6.5&&p.z<1);if(caption.age>7)caption=null;}
      const state=walk.getState();effects.update(dt,time,{...state,active:walk.active&&!reading,speed:reading?0:state.speed});
      const skyStats=effects.getStats(),playing=skyStats.fireworksActive;
      gallery.update(dt,time,{showActive:playing,showTime:skyStats.fireworksTime,phase:skyStats.celebrationPhase,paused:manualPaused,reading,inside:state.inside});
      if(skyStats.celebrationPhase!==lastPhase){lastPhase=skyStats.celebrationPhase;ui.setWishPhase?.(lastPhase==='wish');}
      ui.setWishRemaining?.(skyStats.wishRemaining,skyStats.wishDuration);
      weather.forEach(w=>{w.u.value+=(w.base*(playing?w.show:1)-w.u.value)*Math.min(1,dt*2);});
      if(document.body.classList.contains('birthday-fireworks')&&!playing){document.body.classList.remove('birthday-fireworks');ui.setShowState?.(false);ending={age:0,from:camera.position.clone(),quaternion:camera.quaternion.clone()};walk.setPaused(true);}
      if(ending&&!reading){ending.age+=dt;const t=THREE.MathUtils.smoothstep(ending.age,0,3.0);const y=walk.probe(-1.3,9).ground+state.eyeHeight;camera.position.lerpVectors(ending.from,new THREE.Vector3(-1.3,y,9),t);const look=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.06,0,0,'YXZ'));camera.quaternion.slerpQuaternions(ending.quaternion,look,t);if(ending.age>=3){walk.setPose([-1.3,0,9],0,-.06);walk.setPaused(reading);ending=null;endingDone=true;ui.setEnding?.(true);}}
      if(state.active&&state.speed>.08&&!reading&&!touching&&state.distanceTravelled-lastStep>.75){lastStep=state.distanceTravelled;sound.step?.(state.inside?(state.onStairs?'stairs':'wood'):'snow',stepSide++%2);}
      near=null;
      if(begun&&!reading&&!touching&&walk.active){
        let min=Infinity;const forward=camera.getWorldDirection(new THREE.Vector3());
        for(const t of targets){
          if(indoors(t)!==state.inside)continue;
          const delta=t.position.clone().sub(camera.position),d=delta.length();
          const alignment=delta.normalize().dot(forward);
          if(d>reach(t)||alignment<(t.kind==='album'?.94:.35)||(t.kind!=='album'&&!walk.canReach(t.position,reach(t))))continue;
          const score=(1-alignment)*3+d*.07;
          if(score<min){min=score;near=t;}
        }
      }
      if((near?.id||'')+(near?.action||'')!==lastNearId){lastNearId=(near?.id||'')+(near?.action||'');ui.setNearTarget(near);}
    },
    stats(){return{begun,reading,ending:!!ending,endingDone,opened:[...opened],near:near?.id||null,touching:touching?.id||null,worldTargets:world.targets.length,interior:interior.stats(),loft:loft.stats(),gallery:gallery.stats(),treasure:treasure.stats(),effects:effects.getStats(),hasMusic:!!song,audioEnabled:sound.enabled,photos:MEDIA.albumPhotos?.length||MEDIA.photos.length};}
  };
}
