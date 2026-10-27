import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYOUT } from './scene-layout.js';
import { paperCard, brassPlate, carvedSign, interactionMaterial, contactShadow, shareSurfaceMaterials, rebatchSharedSurfaces } from './diegetic-text.js';

// A built second storey: full floor, a stairwell, handrails, glazing and keepsakes.
export function createBirthdayLoft({scene,textures}) {
  const group=new THREE.Group();group.name='Lily · birthday and love upstairs';scene.add(group);
  const targets=[],colliders=[],F=LAYOUT.upperFloor,flames=[];let bookAmount=0,bookTarget=0,musicTurn=0,touchCount=0;
  const map=textures.floor.map.clone();map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(3,2);map.needsUpdate=true;
  const mats={wood:new THREE.MeshStandardMaterial({color:0xbba18d,map,roughness:.65}),
    trim:new THREE.MeshStandardMaterial({color:0x624839,map:textures.darkWood.map,roughness:.53}),
    wall:new THREE.MeshStandardMaterial({color:0x99745d,map:textures.log.map,normalMap:textures.log.normalMap,normalScale:new THREE.Vector2(.23,.23),roughness:.82}),
    cream:new THREE.MeshPhysicalMaterial({color:0xe4cabc,roughness:.73,sheen:.6,sheenColor:new THREE.Color(0xffe8da),map:textures.knitCream.map}),
    rose:new THREE.MeshPhysicalMaterial({color:0xbd788c,roughness:.69,sheen:.7,sheenColor:new THREE.Color(0xffccdb),map:textures.knitCream.map}),
    brass:new THREE.MeshStandardMaterial({color:0xcb9e70,metalness:.82,roughness:.27}),
    ceramic:new THREE.MeshPhysicalMaterial({color:0xefdaca,roughness:.25,clearcoat:.8}),
    glass:new THREE.MeshPhysicalMaterial({color:0xc8d7e5,roughness:.08,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}),
    wax:new THREE.MeshStandardMaterial({color:0xf6dfc8,roughness:.5}),
    warm:new THREE.MeshBasicMaterial({color:0xffc997,toneMapped:false}),
    pink:new THREE.MeshBasicMaterial({color:0xff91b8,toneMapped:false}),
    paper:new THREE.MeshStandardMaterial({color:0xf4e7d5,roughness:.92})};
  const add=(g,m,x,y,z,p=group)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=!m.transparent;o.receiveShadow=true;p.add(o);return o;};
  const box=(w,h,d,m,x,y,z,p=group)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z,p);
  const round=(w,h,d,m,x,y,z,r=.04,p=group)=>add(new RoundedBoxGeometry(w,h,d,3,r),m,x,y,z,p);
  const cyl=(r,h,m,x,y,z,p=group)=>add(new THREE.CylinderGeometry(r,r,h,32),m,x,y,z,p);
  function tube(points,r,mat,parent=group){return add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(16,points.length*3),r,6,false),mat,0,0,0,parent);}
  function sign(text,subtitle,w,h,x,y,z,rot=0,dark=true){
    const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*h/w);const ctx=c.getContext('2d');
    ctx.fillStyle=dark?'#342b30':'#f0dfca';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#d6ae80';ctx.lineWidth=6;ctx.strokeRect(18,18,c.width-36,c.height-36);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=dark?'#fff2df':'#543747';
    let size=Math.min(c.height*(subtitle?.40:.58),195);ctx.font=`700 ${size}px "Microsoft YaHei", Georgia, serif`;
    while(size>12&&ctx.measureText(text).width>c.width-116){size-=1;ctx.font=`700 ${size}px "Microsoft YaHei", Georgia, serif`;}
    ctx.fillText(text,c.width/2,c.height*(subtitle?.36:.5));
    if(subtitle){ctx.fillStyle=dark?'#f0d6c7':'#633a4d';ctx.font=`600 ${Math.min(c.height*.20,68)}px "Microsoft YaHei", sans-serif`;ctx.fillText(subtitle,c.width/2,c.height*.76,c.width-116);}
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=16;
    const o=dark?carvedSign(tex,w,h):paperCard(tex,w,h,{frame:'wood'});o.position.set(x,y,z);group.add(o);o.rotation.y=rot;return o;
  }
  function collider(name,minX,maxX,minZ,maxZ,minY=F,maxY=6.2,structural=false){colliders.push({name,minX,maxX,minZ,maxZ,minY,maxY,structural});}
  // Main floor and the two ends of the stairwell. The opening is genuinely empty.
  box(7.46,.18,6.4,mats.wood,.69,F-.09,0);
  box(1.4,.18,.7,mats.wood,-3.73,F-.09,-2.85);
  box(1.4,.18,.75,mats.wood,-3.73,F-.09,2.825);
  for(let x=-2.85;x<4.4;x+=.28)box(.008,.004,6.28,mats.trim,x,F+.003,0);
  for(const z of [-3.27,3.27])box(9.03,.24,.20,mats.trim,0,F-.04,z);
  for(const x of [-4.49,4.49])box(.20,.24,6.5,mats.trim,x,F-.04,0);
  // Upper log walls with a real broad front window and smaller side windows.
  for(let row=0;row<14;row++){
    const y=3.56+row*.25;
    box(9.22,.252,.26,mats.wall,0,y,-3.38);
    if(y>4.0&&y<5.55){box(2.18,.252,.26,mats.wall,-3.52,y,3.38);box(2.18,.252,.26,mats.wall,3.52,y,3.38);}
    else box(9.22,.252,.26,mats.wall,0,y,3.38);
    for(const x of [-4.6,4.6]){
      if(y>4.0&&y<5.55){box(.26,.252,2.66,mats.wall,x,y,-2.05);box(.26,.252,2.66,mats.wall,x,y,2.05);}
      else box(.26,.252,6.78,mats.wall,x,y,0);
    }
  }
  // Front picture window, clear glass to look out at meteors.
  box(4.98,.12,.19,mats.trim,0,4.0,3.39);box(4.98,.12,.19,mats.trim,0,5.55,3.39);
  for(const x of [-2.44,0,2.44])box(.09,1.55,.19,mats.trim,x,4.78,3.39);
  box(4.79,1.42,.014,mats.glass,0,4.78,3.40);
  for(const x of [-4.61,4.61]){box(.1,1.55,1.5,mats.glass,x,4.78,0);for(const z of [-.76,.76])box(.19,1.65,.09,mats.trim,x,4.78,z);box(.2,.09,1.62,mats.trim,x,4.0,0);box(.2,.09,1.62,mats.trim,x,5.55,0);}
  // Wide oak staircase: 18 risers with brass nosing and low warm step lights.
  const s=LAYOUT.stair,run=(s.maxZ-s.minZ)/s.steps,rise=(F-LAYOUT.floor)/s.steps;
  for(let i=0;i<s.steps;i++){
    const z=s.maxZ-(i+.5)*run,y=LAYOUT.floor+(i+1)*rise;
    box(s.maxX-s.minX,.10,run+.012,mats.wood,(s.minX+s.maxX)/2,y-.05,z);
    box(s.maxX-s.minX,rise,.035,mats.trim,(s.minX+s.maxX)/2,y-rise/2,z+run/2);
    box(s.maxX-s.minX-.06,.012,.018,mats.brass,(s.minX+s.maxX)/2,y+.006,z+run/2-.012);
    if(i%3===0)box(.14,.022,.025,mats.warm,s.minX+.10,y-.06,z+run/2+.025);
  }
  for(const x of [s.minX+.025,s.maxX-.025]){
    tube([[x,1.55,s.maxZ],[x,F+.90,s.minZ]],.035,mats.trim);
    for(let i=0;i<=9;i++){const t=i/9,z=s.maxZ-t*(s.maxZ-s.minZ),y=.65+t*2.8;cyl(.018,.91,mats.brass,x,y+.455,z);}
    // Rail collision follows the slope rather than blocking the entire floor.
    for(let i=0;i<18;i++){const z=s.maxZ-(i+.5)*run,y=.65+(i+.5)*rise;collider('stair handrail',x-.035,x+.035,z-run/2,z+run/2,y,y+1.05,true);}
  }
  const stairLamp=new THREE.PointLight(0xffd6ac,2.0,5.5,2);stairLamp.name='Oak staircase warm light';stairLamp.userData.lightZone='interior';stairLamp.position.set(-3.45,4.0,-.45);group.add(stairLamp);
  // Solid guard along the open stairwell edge upstairs, with an exit at its top.
  for(const z of [-2.15,-1.55,-.95,-.35,.25,.85,1.45,2.05,2.45])cyl(.023,1.0,mats.brass,-2.99,F+.5,z);
  tube([[-2.99,F+1.01,-2.28],[-2.99,F+1.01,2.48]],.035,mats.trim);
  collider('upstairs stairwell guard',-3.04,-2.94,-2.28,2.49,F,F+1.06,true);
  tube([[-4.37,F+1.01,2.5],[-3,F+1.01,2.5]],.035,mats.trim);
  collider('upstairs front guard',-4.40,-2.94,2.46,2.54,F,F+1.06,true);
  const stairPlate=sign('楼上的心意','',.40,.12,-3.06,1.65,2.54);stairPlate.rotation.y=-.22;for(const x of [-3.22,-2.91])tube([[x,1.71,2.54],[x,1.80,2.46]],.004,mats.brass);
  sign('走到这里，用了 805 天','',.60,.06,-3.70,.65+9*rise-.08,s.maxZ-8*run+.020);
  // Warm rose sitting area with stitched cushions, rug and a hand-bound future book.
  const rug=add(new THREE.PlaneGeometry(3.65,3.2),new THREE.MeshStandardMaterial({map:textures.rug.map,color:0xd7b6b7,roughness:.98}),-.65,F+.011,.55);rug.rotation.x=-Math.PI/2;
  round(2.5,.30,.85,mats.rose,-.65,F+.28,1.75,.10);
  round(2.5,.70,.22,mats.rose,-.65,F+.70,2.11,.09);
  for(const x of [-1.77,.47]){round(.23,.55,.85,mats.rose,x,F+.55,1.75,.08);cyl(.045,.2,mats.brass,x,F+.10,1.75);}
  for(const x of [-1.23,-.07]){round(1.03,.15,.69,mats.cream,x,F+.50,1.73,.06);const p=round(.42,.39,.15,mats.rose,x,F+.76,1.94,.07);p.rotation.z=x<-.5?.13:-.13;}
  collider('rose loveseat',-1.94,.64,1.29,2.27,F,F+1.12);
  cyl(.61,.06,mats.wood,-.65,F+.55,.12);cyl(.055,.47,mats.brass,-.65,F+.28,.12);cyl(.34,.04,mats.brass,-.65,F+.02,.12);
  colliders.push({name:'future book table',shape:'circle',x:-.65,z:.12,radius:.61,minY:F,maxY:F+.6});
  const book=new THREE.Group();book.name='Our next chapter · hinged keepsake book';book.position.set(-.68,F+.60,.13);group.add(book);
  round(.48,.035,.34,mats.paper,0,.018,0,.008,book);box(.51,.014,.37,mats.rose,0,0,0,book);
  const cover=new THREE.Group();cover.position.set(-.25,.04,0);book.add(cover);cover.userData.dynamic=true;round(.51,.018,.37,mats.rose,.25,0,0,.007,cover);
  // Unwritten cream pages and a real pen leave her room to write the next chapter.
  const pen=new THREE.Group();pen.position.set(-.52,F+.643,.13);pen.visible=false;pen.userData.dynamic=true;pen.rotation.y=.16;group.add(pen);
  const barrel=add(new THREE.CylinderGeometry(.006,.006,.24,12),mats.brass,0,0,0,pen);barrel.rotation.x=Math.PI/2;
  const nib=add(new THREE.ConeGeometry(.006,.027,12),mats.trim,0,0,-.133,pen);nib.rotation.x=-Math.PI/2;
  sign('这里，收藏以后','',1.20,.36,-.32,5.08,-3.236,0,false);
  // The three photograph frames are owned by birthday-world to retain setPhoto().
  // A glass-domed rose music box and a small handwritten wish pedestal.
  cyl(.40,.055,mats.wood,2.25,F+.77,.64);for(const x of [2.02,2.48])for(const z of [.42,.86])cyl(.023,.75,mats.brass,x,F+.375,z);
  colliders.push({name:'rose music table',shape:'circle',x:2.25,z:.64,radius:.40,minY:F,maxY:F+.8});
  const roseBox=new THREE.Group();roseBox.name='A rose that keeps turning';roseBox.position.set(2.25,F+.81,.64);group.add(roseBox);
  cyl(.16,.065,mats.ceramic,0,.032,0,roseBox);cyl(.12,.02,mats.brass,0,.073,0,roseBox);
  const flower=new THREE.Group();flower.userData.dynamic=true;roseBox.add(flower);cyl(.007,.22,mats.brass,0,.19,0,flower);
  for(let ring=0;ring<4;ring++)for(let n=0;n<7;n++){const a=n/7*Math.PI*2+ring*.4,r=.014+ring*.012;const petal=add(new THREE.SphereGeometry(1,14,9),mats.rose,Math.cos(a)*r,.31-ring*.008,Math.sin(a)*r,flower);petal.scale.set(.03,.028,.010);petal.rotation.set(.3,a,.2);}
  const roseGlass=mats.glass.clone();roseGlass.opacity=.12;const dome=add(new THREE.SphereGeometry(.19,32,20,0,Math.PI*2,0,Math.PI/2),roseGlass,0,.085,0,roseBox);dome.scale.y=2;dome.userData.noMerge=true;
  const fogGlass=new THREE.MeshStandardMaterial({color:0xf0ebe4,roughness:.95,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});const condensation=add(new THREE.SphereGeometry(.191,24,16,0,Math.PI*2,0,Math.PI/2),fogGlass,0,.085,0,roseBox);condensation.scale.y=2;condensation.userData.noMerge=true;
  const roseWords=sign('只为你珍藏','',.25,.047,2.25,F+.842,.805,0,false);
  // One small heart in the window is enough; the exterior keeps its quiet silhouette.
  sign('Happy Birthday, Lily','',1.10,.28,0,3.05,3.72);
  for(const x of [-.43,.43])tube([[x,3.57,3.72],[x,3.19,3.72]],.004,mats.brass);
  const heart=[];for(let i=0;i<=72;i++){const t=i/72*Math.PI*2;heart.push([.75+16*Math.sin(t)**3*.014,4.80+(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))*.014,3.24]);}
  tube(heart,.009,mats.warm);
  // Window candles and upper-room soft fill.
  for(const x of [-2.12,-1.87,1.87,2.12]){cyl(.05,.15,mats.wax,x,4.11,3.15);const f=add(new THREE.SphereGeometry(.025,10,8),mats.warm,x,4.23,3.15);f.scale.set(.65,1.8,.65);f.userData.noMerge=true;flames.push(f);}
  for(const [x,z,intensity]of [[-.2,.4,3.2],[2.7,-1.9,1.8]]){const light=new THREE.PointLight(0xffd9b2,intensity,7,2);light.name=x<1?'Loft warm sitting area':'Loft wardrobe and memory wall';light.userData.lightZone='interior';light.position.set(x,5.65,z);group.add(light);cyl(.23,.10,mats.ceramic,x,5.82,z);cyl(.18,.02,mats.warm,x,5.755,z);}
  // Dedicated downstairs cake table, with room to reach it from the main aisle.
  const C=LAYOUT.cake;cyl(C.radius,.055,mats.ceramic,C.x,C.standY-.0275,C.z);cyl(.07,.70,mats.brass,C.x,1.04,C.z);cyl(.29,.06,mats.brass,C.x,.68,C.z);
  colliders.push({name:'birthday cake pedestal',shape:'circle',x:C.x,z:C.z,radius:C.radius,minY:.65,maxY:1.44});
  function target(id,title,position,viewPose,action){const hit=add(new THREE.BoxGeometry(.65,.48,.5),interactionMaterial,...position);targets.push({id,title,kind:'interior',object:hit,position:new THREE.Vector3(...position),viewPose,action,floor:F});}
  target('loft-book','一起写下去的未来',[-.68,F+.66,.13],[-.65,F,-.80],'翻开下一页');
  target('loft-rose','玻璃罩里的玫瑰',[2.25,F+1.04,.64],[1.40,F,.64],'轻触，听一段心意');
  function interact(id){touchCount++;if(id==='loft-book'){bookTarget=bookTarget?0:1;targets[0].action=bookTarget?'轻轻合上':'翻开下一页';return {message:'这一页，留给你写。'};}musicTurn=15.2;return {message:'像这朵被珍藏的玫瑰，你一直是我心里特别的那一个。'};}
  contactShadow(group,-.65,F+.014,1.75,1.40,.65,.25);
  contactShadow(group,-.65,F+.015,.12,.68,.55,.19);
  contactShadow(group,2.25,F+.014,.64,.47,.44,.18);
  contactShadow(group,2.95,F+.014,-2.80,1.05,.51,.24);
  contactShadow(group,2.65,.658,2.4,.47,.44,.18);
  // Batch static geometry, retaining moving covers and flower stems.
  group.updateMatrixWorld(true);const buckets=new Map(),remove=[];
  group.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||o.material.transparent||o.userData.noMerge)return;let p=o;while(p&&p!==group){if(p.userData.dynamic)return;p=p.parent;}const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));const key=o.material.uuid;if(!buckets.has(key))buckets.set(key,{mat:o.material,geos:[]});buckets.get(key).geos.push(g);remove.push(o);});
  remove.forEach(o=>o.removeFromParent());for(const b of buckets.values()){const g=mergeGeometries(b.geos);const m=new THREE.Mesh(g,b.mat);m.castShadow=true;m.receiveShadow=true;m.userData.staticPaletteBatch=true;group.add(m);b.geos.forEach(g=>g.dispose());}
  shareSurfaceMaterials(group,{exclude:[fogGlass,roseGlass]});
  const staticPaletteBatching=rebatchSharedSurfaces(group);group.userData.staticPaletteBatching=staticPaletteBatching;
  return {group,targets,colliders,interact,update(dt,time){bookAmount+=(bookTarget-bookAmount)*(1-Math.exp(-dt*3));cover.rotation.z=bookAmount*2.75;pen.visible=bookAmount>.18;if(musicTurn>0){musicTurn=Math.max(0,musicTurn-dt);const elapsed=15.2-musicTurn;fogGlass.opacity=elapsed<1.2?.30*Math.sin(Math.PI*elapsed/1.2):0;if(elapsed>=1.2)flower.rotation.y+=dt*.52;}else fogGlass.opacity=0;flames.forEach((f,i)=>f.scale.y=1.8+Math.sin(time*4+i)*.12);},stats:()=>({floor:F,stairs:18,bookOpen:!!bookTarget,musicBoxPlaying:musicTurn>0,touches:touchCount,animating:Math.abs(bookTarget-bookAmount)>.002||musicTurn>0})};
}
