import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeight } from './environment.js';
import { BIRTHDAY_PROP_DATA } from './birthday-props-data.js';
import { paperCard, brassPlate, carvedSign, interactionMaterial, contactShadow, memoryWatercolor, shareSurfaceMaterials, rebatchSharedSurfaces } from './diegetic-text.js';

/* Original, metric-scale birthday scenography. All textures are authored here;
   the five still-life keepsakes are authored with Blender in make_birthday.py. */
export function createBirthdayWorld({scene, textures,hasAlbum=false}) {
  const group=new THREE.Group();group.name='Lily · a winter birthday, seven memories';scene.add(group);
  const targets=[], photoFrames=[], flameLights=[], openings=[], haloAnimations=[];
  const staticBatchRoots=new Set();
  const forecourt=new THREE.Group();forecourt.name='Memories revealed after the invitation';forecourt.visible=false;group.add(forecourt);
  const snowY=(x,z)=>terrainHeight(x,z)+.035;
  const mat=(color,roughness=.6,metalness=0,extra={})=>new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
  const woodMap=textures?.darkWood?.map?.clone();
  if(woodMap){woodMap.repeat.set(1.8,.7);woodMap.wrapS=woodMap.wrapT=THREE.RepeatWrapping;}
  const M={
    wood:mat(0x805e42,.72,0,{map:woodMap}), walnut:mat(0x493224,.67),
    gold:mat(0xc6a165,.33,.78), goldDark:mat(0x82613b,.43,.72),
    cream:mat(0xe9dfcc,.66), paper:mat(0xe9d9b9,.9), ivory:mat(0xf8f0dc,.4),
    rose:mat(0xab6165,.69), red:mat(0x8d3039,.82), navy:mat(0x203846,.67),
    iron:mat(0x30383b,.4,.68), black:mat(0x151d21,.5),
    sage:mat(0x3b6552,.82), snow:mat(0xf0f5fc,.93),
    glow:new THREE.MeshBasicMaterial({color:0xffd79c,toneMapped:false}),
    pinkGlow:new THREE.MeshBasicMaterial({color:0xffb7b5,toneMapped:false}),
    silk:mat(0xe5bc63,.73), glass: new THREE.MeshPhysicalMaterial({color:0xffdca0,roughness:.1,transparent:true,opacity:.21,depthWrite:false,side:THREE.DoubleSide}),
  };
  const add=(geo,material,parent,x=0,y=0,z=0)=>{
    const o=new THREE.Mesh(geo,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  };
  const box=(w,h,d,material,p,x=0,y=0,z=0,r=.012)=>add(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w*.2,h*.2,d*.2)),material,p,x,y,z);
  const cyl=(r1,r2,h,material,p,x=0,y=0,z=0,n=20)=>add(new THREE.CylinderGeometry(r1,r2,h,n),material,p,x,y,z);
  const ball=(r,material,p,x=0,y=0,z=0)=>add(new THREE.SphereGeometry(r,14,9),material,p,x,y,z);
  const torus=(r,t,material,p,x=0,y=0,z=0)=>add(new THREE.TorusGeometry(r,t,7,24),material,p,x,y,z);
  const line=(points,r,material,p,closed=false)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(q=>q.isVector3?q:new THREE.Vector3(...q)),closed,'catmullrom',.2);
    return add(new THREE.TubeGeometry(curve,Math.max(12,points.length*3),r,6,closed),material,p);
  };
  function canvasTexture(w,h,draw){
    const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=16;return t;
  }
  function textPanel(title,subtitle,w=1.3,h=.34,{dark=true,size=42,rose=false}={}){
    const texture=canvasTexture(1024,Math.round(1024*h/w),(c,cw,ch)=>{
      c.clearRect(0,0,cw,ch);c.fillStyle=dark?'rgba(23,35,39,.94)':'#ede1c8';c.fillRect(0,0,cw,ch);
      c.strokeStyle=rose?'#c8908c':'#b3935b';c.lineWidth=2;c.strokeRect(14,14,cw-28,ch-28);
      c.textAlign='center';c.textBaseline='middle';c.fillStyle=dark?'#f2e6d0':'#3c4545';
      let titleSize=Math.min(ch*(subtitle?.38:.58),Math.max(size,112));
      const font=()=>`700 ${titleSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;c.font=font();
      while(titleSize>12&&c.measureText(title).width>cw-72){titleSize-=1;c.font=font();}
      c.fillText(title,cw/2,subtitle?ch*.37:ch*.5);
      if(subtitle){c.fillStyle=dark?'#ead4b1':'#62503d';c.font=`600 ${Math.min(ch*.19,52)}px "Microsoft YaHei", sans-serif`;c.fillText(subtitle,cw/2,ch*.74,cw-72);}
    });
    return dark?carvedSign(texture,w,h):paperCard(texture,w,h);
  }
  function consolidate(parent){
    const entries=new Map(),remove=[];parent.updateWorldMatrix(true,true);const inv=parent.matrixWorld.clone().invert();
    parent.traverse(o=>{
      if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)||o.userData.noMerge)return;
      let p=o;while(p&&p!==parent){if(p.userData.dynamic)return;p=p.parent;}
      const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));
      for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);
      if(!g.attributes.normal)g.computeVertexNormals();
      if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
      if(!entries.has(o.material))entries.set(o.material,[]);entries.get(o.material).push(g);remove.push(o);
    });
    for(const [material,geos] of entries){
      const g=mergeGeometries(geos,false);if(g){const mesh=new THREE.Mesh(g,material);mesh.castShadow=!material.transparent;mesh.receiveShadow=true;mesh.userData.staticPaletteBatch=true;parent.add(mesh);}else console.warn('Birthday merge skipped');
      geos.forEach(g=>g.dispose());
    }
    remove.forEach(o=>o.removeFromParent());
    staticBatchRoots.add(parent);
  }
  const glowTexture=canvasTexture(128,128,(c,w,h)=>{
    const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,218,157,.65)');g.addColorStop(.15,'rgba(255,202,125,.3)');g.addColorStop(.5,'rgba(255,194,108,.08)');g.addColorStop(1,'rgba(255,190,110,0)');c.fillStyle=g;c.fillRect(0,0,w,h);
  });
  function halo(parent,x,y,z,size=.9){
    const m=new THREE.SpriteMaterial({map:glowTexture,color:0xffddac,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.75,toneMapped:false});
    const s=new THREE.Sprite(m);s.position.set(x,y,z);s.scale.set(size,size,1);parent.add(s);return s;
  }
  const poolMats=new Map();
  function lightPool(parent,x,y,z,r=1,opacity=.12){
    if(!poolMats.has(opacity))poolMats.set(opacity,new THREE.MeshBasicMaterial({map:glowTexture,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,color:0xffd49c}));
    const o=new THREE.Mesh(new THREE.PlaneGeometry(r*2,r*2),poolMats.get(opacity));
    o.rotation.x=-Math.PI/2;o.position.set(x,y,z);parent.add(o);return o;
  }
  function lantern(x,z,scale=.72,parent=group,localY){
    const y=localY??snowY(x,z);const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);
    cyl(.16,.2,.055,M.iron,g,0,.028,0);cyl(.1,.14,.07,M.goldDark,g,0,.09,0);
    const glass=cyl(.105,.105,.26,M.glass,g,0,.26,0);glass.castShadow=false;
    for(let i=0;i<4;i++){const a=i*Math.PI/2; cyl(.011,.011,.31,M.gold,g,.112*Math.cos(a),.25,.112*Math.sin(a),8);}
    cyl(.15,.13,.065,M.iron,g,0,.42,0);cyl(.045,.13,.1,M.iron,g,0,.5,0);
    cyl(.024,.028,.13,M.ivory,g,0,.19,0,12);ball(.035,M.glow,g,0,.28,0).scale.set(.55,1,.55);
    const handle=torus(.078,.009,M.gold,g,0,.575,0);handle.rotation.y=Math.PI/2;
    consolidate(g);lightPool(group,x,y+.015,z,1,.16);
    return g;
  }

  /* WARM, QUIET FRONT GARDEN --------------------------------------- */
  // Two warm strings set a human-scale ceiling to the forecourt.
  const festoon=new THREE.Group();festoon.name='Warm festoon lights';group.add(festoon);
  for(const side of [-1,1]){
    const start=new THREE.Vector3(side*4.8,3.8,4.9),end=new THREE.Vector3(side*5.8,2.9,12.5),pts=[];
    for(let i=0;i<=32;i++){const t=i/32;pts.push(start.clone().lerp(end,t).add(new THREE.Vector3(0,-Math.sin(t*Math.PI)*.72,0)));}
    line(pts,.009,M.iron,festoon);
    for(let i=1;i<20;i++){
      const t=i/20;const p=start.clone().lerp(end,t);p.y-=Math.sin(t*Math.PI)*.72;
      cyl(.01,.012,.11,M.iron,festoon,p.x,p.y-.05,p.z,6);ball(.035,M.glow,festoon,p.x,p.y-.14,p.z);
    }
    cyl(.035,.055,3.0,M.walnut,festoon,end.x,snowY(end.x,end.z)+1.5,end.z,10);
  }
  consolidate(festoon);
  // Lamps lead from the heart gate to the porch without blocking the door.
  const path=[[-1.6,11.6],[-1.65,9.4],[-1.7,7.1],[-2.8,5.3],[1.8,11.6],[1.6,8.4],[.8,6.1]];
  path.forEach(([x,z],i)=>lantern(x,z,.63+(i%2)*.07));
  // Delicate meadow stakes, with little white winter flowers.
  const gardenStatic=new THREE.Group();group.add(gardenStatic);
  for(const s of [-1,1])for(let i=0;i<14;i++){
    const x=s*(2.25+Math.sin(i*1.7)*.28),z=7.1+i*.43,y=snowY(x,z),h=.19+(i%4)*.035;
    line([[x,y,z],[x+.02,y+h,z]],.004,M.sage,gardenStatic);
    for(let p=0;p<5;p++){const a=p*Math.PI*2/5;const petal=ball(.031,M.cream,gardenStatic,x+Math.cos(a)*.029,y+h,z+Math.sin(a)*.029);petal.scale.set(.7,.3,1);}
    ball(.012,M.gold,gardenStatic,x,y+h+.007,z);
  }
  consolidate(gardenStatic);

  /* MEMORY RELIQUARIES --------------------------------------------- */
  const stations=[
    {id:'arrival',title:'第一封消息',date:'2024.08.15',x:-5.9,z:9.1,rot:.22,n:1},
    {id:'yellow',title:'淡黄色裙子的你',date:'2024 · 开学季',x:-7.1,z:5.3,rot:.5,n:2},
    {id:'campus',title:'被留好的那个座位',date:'白马校区',x:-7.1,z:.1,rot:.8,n:3},
    {id:'city',title:'第一次牵起你的手',date:'玄武湖 · 那一天',x:6.1,z:8.1,rot:-.45,n:4},
    {id:'journey',title:'陪你到大行宫',date:'大一 · 冬天',x:7.6,z:3.6,rot:-.7,n:5},
    {id:'courage',title:'你送来的光，我一直带着',date:'从白马到新庄',x:6.8,z:-2.2,rot:-1.15,n:6},
  ];
  function makeChest(st){
    const g=new THREE.Group();g.name=`Memory ${st.n}: ${st.title}`;g.position.set(st.x,snowY(st.x,st.z),st.z);g.rotation.y=st.rot;forecourt.add(g);
    const base=new THREE.Group();g.add(base);
    // A low wooden plinth gives the little exhibit a place in the real snow.
    box(1.23,.12,.94,M.walnut,base,0,.075,0,.04);box(1.15,.026,.88,M.snow,base,0,.144,0,.02);
    const chestY=.17;
    box(.77,.33,.48,M.wood,base,0,chestY+.165,0,.023);
    for(const x of [-.29,.29])box(.038,.34,.495,M.goldDark,base,x,chestY+.165,0,.005);
    for(const x of [-.387,.387])for(const z of [-.239,.239])box(.022,.08,.025,M.gold,base,x,chestY+.045,z,.005);
    for(const x of [-.29,.29])for(let j=0;j<3;j++)ball(.009,M.gold,base,x,chestY+.045+j*.115,.253).scale.z=.4;
    // Separate hinged, subtly barrelled lid.
    const lid=new THREE.Group();lid.userData.dynamic=true;lid.position.set(0,chestY+.33,-.23);g.add(lid);
    const lidBody=box(.79,.14,.49,M.wood,lid,0,.065,.23,.027);
    for(const x of [-.29,.29])box(.04,.15,.503,M.goldDark,lid,x,.067,.23,.009);
    box(.12,.15,.018,M.gold,lid,0,-.01,.484,.009);
    const key=cyl(.014,.014,.006,M.black,lid,0,-.007,.496,12);key.rotation.x=Math.PI/2;
    box(.009,.023,.006,M.black,lid,0,-.023,.499,.001);
    for(const x of [-.23,.23]){const hinge=cyl(.014,.014,.09,M.gold,lid,x,0,0,12);hinge.rotation.z=Math.PI/2;}
    consolidate(base);consolidate(lid);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.4,.18,1.08,24,1,true),new THREE.MeshBasicMaterial({color:0xffca79,transparent:true,opacity:.025,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));beam.position.y=.86;g.add(beam);
    const glow=halo(g,0,.65,0,1.1);const pool=lightPool(g,0,.157,0,.8,.35);
    // A real wax seal on the lid replaces the floating exhibit board.
    const seal=cyl(.047,.050,.009,M.red,lid,0,.147,.23,24);
    const numberTexture=canvasTexture(128,128,(c,w,h)=>{c.fillStyle='#842f3b';c.fillRect(0,0,w,h);c.fillStyle='#d9b87b';c.font='58px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(String(st.n).padStart(2,'0'),w/2,h/2);});
    const sealFace=new THREE.Mesh(new THREE.CircleGeometry(.040,24),new THREE.MeshStandardMaterial({map:numberTexture,roughness:.72}));sealFace.rotation.x=-Math.PI/2;sealFace.position.set(0,.153,.23);lid.add(sealFace);
    contactShadow(g,0,.009,0,.74,.59,.28);
    const hit=new THREE.Mesh(new THREE.BoxGeometry(1.3,1.25,1.2),interactionMaterial);hit.position.y=.72;hit.name=`Interact · ${st.id}`;g.add(hit);
    const target={id:st.id,title:st.title,kind:'memory',object:hit,group:g,position:new THREE.Vector3(st.x,g.position.y+.72,st.z),opened:false};
    targets.push(target);openings.push({id:st.id,lid,amount:0,target:0,glow,beam,pool});
    const exhibit=new THREE.Group();exhibit.position.set(0,0,-1.05);g.add(exhibit);
    const light=new THREE.PointLight(0xffcd91,1.25,3.7,2);light.name=`Memory lantern ${st.n}`;light.userData.lightZone='outdoor';light.position.set(0,1.35,.2);g.add(light);target.light=light;haloAnimations.push({light,glow,base:1.25,id:st.id});
    return {g,base,exhibit,target};
  }
  function phone(p,x,y,z,angle,text){
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.set(-.14,angle,0);p.add(g);
    box(.22,.39,.022,M.goldDark,g,0,0,0,.02);box(.198,.355,.027,M.navy,g,0,0,.005,.012);
    const screen=canvasTexture(256,448,(c,w,h)=>{
      c.fillStyle='#172b32';c.fillRect(0,0,w,h);c.fillStyle='#e6d7ba';c.font='20px Georgia';c.textAlign='center';c.fillText(text,w/2,54);
      for(let i=0;i<4;i++){c.fillStyle=i%2?'#a2bfaa':'#e4d2ad';const xx=i%2?98:17;c.fillRect(xx,100+i*65,140,41);c.fillStyle='#27433e';c.font='15px sans-serif';c.fillText(['你好呀','很高兴认识你','原来你这么有趣','故事，从这里开始'][i],xx+70,126+i*65,126);}
      c.fillStyle='#b89865';c.fillRect(42,414,172,3);
    });
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(.18,.323),new THREE.MeshStandardMaterial({map:screen,emissiveMap:screen,emissive:0xffffff,emissiveIntensity:.14,roughness:.38}));plane.position.set(0,-.005,.02);g.add(plane);
    ball(.005,M.black,g,0,.169,.021);return g;
  }
  function book(p,x,y,z,color=0x896e50,rot=0,open=false){
    const b=new THREE.Group();b.position.set(x,y,z);b.rotation.y=rot;p.add(b);
    if(!open){box(.24,.035,.31,M.paper,b,0,0,0);const cover=mat(color,.8);box(.253,.006,.32,cover,b,0,.022,0);box(.253,.006,.32,cover,b,0,-.022,0);}
    else{for(const s of [-1,1]){const page=box(.21,.012,.3,M.paper,b,s*.103,.02,0);page.rotation.z=s*.08;for(let i=0;i<7;i++)box(.15,.001,.002,M.goldDark,b,s*.103,.03,-.103+i*.028,.0001);}}
    return b;
  }
  function chair(p,x,z,angle=0,small=1){
    const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(small);g.rotation.y=angle;p.add(g);
    box(.45,.055,.44,M.wood,g,0,.46,0);box(.45,.47,.05,M.wood,g,0,.72,-.2);box(.4,.055,.39,M.cream,g,0,.51,0);
    for(const xx of [-.17,.17])for(const zz of [-.17,.17])cyl(.013,.017,.45,M.iron,g,xx,.23,zz,8);
    return g;
  }
  const stationObjects={};
  for(const st of stations)stationObjects[st.id]=makeChest(st);
  // 01 — two screens and a warm thread across a long-distance conversation.
  {
    const p=stationObjects.arrival.exhibit;
    box(1.18,.07,.65,M.walnut,p,0,.38,0);for(const x of [-.45,.45])cyl(.024,.035,.35,M.goldDark,p,x,.19,0);
    phone(p,-.34,.64,0,.25,'2024.08.15');phone(p,.34,.64,0,-.25,'HELLO, LILY');
    line([[-.23,.55,.06],[-.12,.76,.06],[0,.72,.06],[.12,.76,.06],[.23,.55,.06]],.009,M.glow,p);
  }
  // 02 — the little pale-yellow dress on a dressmaker's stand, the first podium.
  {
    const p=stationObjects.yellow.exhibit;
    cyl(.16,.19,.04,M.goldDark,p,-.27,.04,0);cyl(.012,.012,.95,M.gold,p,-.27,.5,0,10);
    cyl(.105,.11,.23,M.silk,p,-.27,.79,0,22);cyl(.11,.27,.32,M.silk,p,-.27,.52,0,28);
    torus(.112,.014,M.cream,p,-.27,.7,0).rotation.x=Math.PI/2;
    for(const s of [-1,1]){const sleeve=box(.13,.16,.15,M.silk,p,-.27+s*.115,.85,0,.035);sleeve.rotation.z=s*.5;}
    const bow=ball(.034,M.cream,p,-.27,.7,.12);bow.scale.set(1.8,.6,.45);
    box(.32,.45,.24,M.wood,p,.33,.27,0);box(.46,.05,.33,M.wood,p,.33,.52,0);
    const mic=cyl(.004,.004,.16,M.iron,p,.37,.62,0,6);mic.rotation.z=-.3;ball(.012,M.iron,p,.395,.697,0);
  }
  // 03 — two places, one book opened; a saved seat is a small act of love.
  {
    const p=stationObjects.campus.exhibit;
    box(1.18,.065,.51,M.wood,p,0,.69,0);for(const x of [-.5,.5])for(const z of [-.17,.17])cyl(.014,.017,.67,M.iron,p,x,.35,z,8);
    chair(p,-.31,.47,Math.PI,.82);chair(p,.31,.47,Math.PI,.82);
    book(p,-.25,.74,0,0x8a6157,.1,true);book(p,.36,.76,.05,0x4f705f,-.12);
    box(.25,.045,.32,M.rose,p,.33,.84,.47,.03);
  }
  // 04 — red scarf, paired gloves, a bench and the route home; panda loads below.
  let pandaStation;
  {
    const p=stationObjects.city.exhibit;
    box(1.36,.085,.46,M.wood,p,0,.47,0);for(const x of [-.54,.54]){box(.055,.46,.38,M.iron,p,x,.24,0);box(.06,.46,.06,M.iron,p,x,.7,-.17);}
    for(let i=0;i<3;i++)box(1.36,.09,.045,M.wood,p,0,.64+i*.115,-.18);
    // A soft red scarf drapes over the timber back and across the seat.
    line([[-.27,.97,-.16],[-.28,.83,-.12],[-.28,.53,.05],[-.19,.51,.16],[-.04,.34,.23]],.044,M.red,p);
    for(const s of [-1,1]){
      const glove=box(.09,.028,.145,M.cream,p,s*.052,.535,.1,.025);glove.rotation.y=s*.18;
      ball(.029,M.cream,p,s*.108,.543,.14).scale.set(.5,.5,1);
    }
    // Small pizza plate, with a single shared slice, rather than a restaurant logo.
    cyl(.13,.14,.018,M.cream,p,-.53,.53,.04);const slice=add(new THREE.CylinderGeometry(.105,.105,.013,3),mat(0xe3ad5c,.63),p,-.53,.548,.04);slice.rotation.y=.3;
    pandaStation=p;consolidate(p);
  }
  // 05 — the two cases and the transfer sign carry the story without figures.
  {
    const p=stationObjects.journey.exhibit;
    for(const [x,y,color] of [[-.26,.36,M.navy],[.29,.27,M.rose]]){
      const h=y*1.55;box(.34,h,.21,color,p,x,h/2+.1,0,.04);
      for(const xx of [-.11,.11]){ball(.035,M.iron,p,x+xx,.07,.04);cyl(.008,.008,.19,M.goldDark,p,x+xx,h+.18,0,8);}
      box(.24,.025,.035,M.gold,p,x,h+.28,0);
      for(const xx of [-.1,0,.1])box(.008,h*.7,.008,M.goldDark,p,x+xx,h/2+.1,.11,.001);
    }
    cyl(.019,.023,1.24,M.iron,p,0,.62,-.17,8);
    const sign=textPanel('大行宫 · DA XING GONG','再多一次换乘，也想陪你走',1.48,.4,{size:41});sign.position.set(0,1.24,-.15);p.add(sign);consolidate(p);
  }
  // 06 — facing seats, an open dialogue, a small glow where the words waited.
  {
    const p=stationObjects.courage.exhibit;
    chair(p,-.48,0,.56,.84);chair(p,.48,0,-.56,.84);
    box(.37,.035,.32,M.wood,p,0,.45,.05);for(const x of [-.13,.13])cyl(.012,.014,.43,M.goldDark,p,x,.23,.05,8);
    const candle=cyl(.035,.039,.12,M.ivory,p,0,.525,.05);ball(.018,M.glow,p,0,.607,.05).scale.set(.6,1.5,.6);consolidate(p);
  }

  for(const o of Object.values(stationObjects))consolidate(o.exhibit);

  /* THE LETTER — sealed, at the quiet centre of the cabin ----------- */
  const letterGroup=new THREE.Group();letterGroup.name='A letter for Lily';letterGroup.position.set(-1.26,1.157,.22);letterGroup.rotation.y=.19;group.add(letterGroup);
  // The real coffee table surface is 1.14 m. A letter rests above its free edge.
  const envelope=box(.34,.013,.23,M.paper,letterGroup,0,.008,0,.009);envelope.rotation.z=.015;
  const seam=line([[-.16,.017,-.105],[0,.023,.03],[.16,.017,-.105]],.002,M.goldDark,letterGroup);
  const wax=cyl(.033,.035,.008,M.rose,letterGroup,0,.026,.022,24);
  const imprint=torus(.022,.0016,M.gold,letterGroup,0,.031,.022);imprint.rotation.x=-Math.PI/2;
  const initial=textPanel('L','',.025,.025,{dark:false,size:190});initial.rotation.x=-Math.PI/2;initial.position.set(0,.034,.022);letterGroup.add(initial);
  const letterLabel=textPanel('给 Lily','2026.10.29',.19,.09,{dark:false,size:43});letterLabel.rotation.x=-Math.PI/2;letterLabel.position.set(-.045,.018,-.054);letterGroup.add(letterLabel);
  halo(letterGroup,0,.12,0,.48);
  const letterHit=new THREE.Mesh(new THREE.BoxGeometry(.62,.62,.5),interactionMaterial);letterHit.position.y=.19;letterGroup.add(letterHit);
  targets.push({id:'letter',title:'给 Lily 的生日小笺',kind:'letter',object:letterHit,group:letterGroup,position:new THREE.Vector3(-1.26,1.33,.22)});

  /* PRIVATE PHOTOGRAPHS — framed on the upstairs memory wall. */
  const framePositions=[[-1.8,4.13,-3.214],[-.33,4.13,-3.214],[1.14,4.13,-3.214]];
  framePositions.forEach(([x,y,z],i)=>{
    const f=new THREE.Group();f.name=`Lily indoor photograph ${i+1}`;f.position.set(x,y,z);group.add(f);
    box(.90,1.15,.035,M.goldDark,f,0,0,-.018,.008);box(.854,1.103,.038,M.paper,f,0,0,.004,.006);
    const photo=new THREE.Mesh(new THREE.PlaneGeometry(.75,.94),new THREE.MeshStandardMaterial({map:memoryWatercolor(i),roughness:.87}));photo.position.set(0,.025,.025);photo.receiveShadow=true;f.add(photo);
    photoFrames.push({group:f,mesh:photo,placeholder:true});
  });
  // A small image, a folded note and one dried rose make the mantel lived-in.
  const hearthFrame=new THREE.Group();hearthFrame.name='A little photograph by the fire';hearthFrame.position.set(-1.91,2.30,-2.83);hearthFrame.rotation.y=.12;group.add(hearthFrame);
  box(.24,.30,.026,M.goldDark,hearthFrame,0,0,0,.005);const hearthPhoto=new THREE.Mesh(new THREE.PlaneGeometry(.208,.265),new THREE.MeshStandardMaterial({map:photoFrames[0].mesh.material.map,roughness:.9}));hearthPhoto.position.z=.015;hearthFrame.add(hearthPhoto);
  box(.12,.025,.11,M.walnut,hearthFrame,0,-.153,-.01,.005);
  if(hasAlbum){photoFrames.forEach(f=>f.group.removeFromParent());photoFrames.length=0;hearthFrame.removeFromParent();}
  const note=textPanel('给你留着灯','',.22,.085,{dark:false});note.position.set(-.43,2.145,-2.86);note.rotation.x=-Math.PI/2;group.add(note);
  line([[-.73,2.145,-2.91],[-.47,2.15,-2.79]],.003,M.sage,group);for(let i=0;i<6;i++){const petal=ball(.019,M.rose,group,-.72+Math.sin(i)*.011,2.16,-2.91+Math.cos(i)*.012);petal.scale.y=.45;}
  const doorPlateTex=canvasTexture(512,256,(c,w,h)=>{c.fillStyle='#a98450';c.fillRect(0,0,w,h);c.fillStyle='#302a26';c.textAlign='center';c.font='52px Georgia';c.fillText('Lily · 10.29',w/2,108);c.font='22px Georgia';c.fillText('a light left on for you',w/2,171);});
  const doorPlate=brassPlate(doorPlateTex,.22,.12);doorPlate.position.set(-2.55,1.55,3.56);group.add(doorPlate);

  // Warm picture-book motes, used sparingly above the forecourt.
  const motesGeo=new THREE.BufferGeometry(),motes=new Float32Array(90*3);
  for(let i=0;i<90;i++){const a=i*2.399,r=2+Math.sqrt(i/90)*8;motes[i*3]=Math.cos(a)*r;motes[i*3+1]=.5+(i*1.618%4);motes[i*3+2]=5+Math.sin(a)*r;}
  motesGeo.setAttribute('position',new THREE.BufferAttribute(motes,3));
  const motePoints=new THREE.Points(motesGeo,new THREE.PointsMaterial({size:.032,color:0xffd99e,transparent:true,opacity:.56,depthWrite:false,blending:THREE.AdditiveBlending}));forecourt.add(motePoints);

  /* TRUE BLENDER ASSETS -------------------------------------------- */
  const assetMaterials=new Map();
  function sharedAssetMaterial(m){
    const key=[m.type,m.color?.getHex(),m.roughness,m.metalness,m.opacity,m.transparent,m.side,m.depthWrite,m.alphaTest,m.emissive?.getHex(),m.emissiveIntensity,m.map?.uuid||'',m.normalMap?.uuid||''].join('|');
    if(!assetMaterials.has(key))assetMaterials.set(key,m);return assetMaterials.get(key);
  }
  const ready=(async()=>{
    const bytes=Uint8Array.from(atob(BIRTHDAY_PROP_DATA),c=>c.charCodeAt(0));
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');
    const put=(name,parent,x,y,z,scale=1,ry=0)=>{
      const src=gltf.scene.getObjectByName(name);if(!src)throw new Error('Birthday Blender asset missing: '+name);
      const o=src.clone(true);o.name=name+' · Lily';o.position.set(x,y,z);o.rotation.set(0,ry,0);o.scale.setScalar(scale);
      o.traverse(m=>{if(m.isMesh){m.castShadow=!m.material.transparent;m.receiveShadow=true;if(m.name.includes('Flame'))m.userData.flame=true;m.material=sharedAssetMaterial(m.material);}});
      parent.add(o);consolidate(o);return o;
    };
    // The kitchen stone worktop has empty space at the front end, 1.552 m high.
    put('BirthdayCake',group,2.65,1.45,2.40,1.30,-.38);
    put('MilkTea',group,-.59,1.15,.23,1.1,.28);
    put('MilkTea',group,-.33,1.15,-.27,.96,-.18);
    put('PandaBackpack',group,.28,.66,1.76,1.12,Math.PI*.94);
    put('CosplayMask',group,4.1,1.56,1.76,1.08,-1.05);
    put('NumberTenKeepsake',group,4.1,1.56,2.97,1.26,-1.0);
    put('PandaBackpack',pandaStation,.43,.515,0,.86,-.1);
    const cakeLight=new THREE.PointLight(0xffbc75,.65,2,2);cakeLight.name='Birthday candle reflection';cakeLight.userData.lightZone='interior';cakeLight.position.set(2.65,1.96,2.40);group.add(cakeLight);flameLights.push(cakeLight);
    const smallSign=textPanel('Lily，生日快乐','2026.10.29',.20,.085,{dark:false,size:43});smallSign.position.set(2.85,1.50,2.22);smallSign.rotation.x=-.55;smallSign.rotation.y=-.45;group.add(smallSign);box(.03,.06,.025,M.goldDark,group,2.85,1.47,2.22,.003);
    // A future invitation, rather than an invented shared gaming memory.
    const gamePhone=new THREE.Group();gamePhone.name='The next duo match, with Lily';gamePhone.position.set(4.04,1.77,2.03);gamePhone.rotation.set(-.10,-Math.PI/2,0);group.add(gamePhone);
    box(.245,.405,.027,M.goldDark,gamePhone,0,0,0,.018);
    const gameMap=canvasTexture(384,640,(c,w,h)=>{
      const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#152b3e');bg.addColorStop(1,'#24453f');c.fillStyle=bg;c.fillRect(0,0,w,h);
      c.strokeStyle='#61785f';c.lineWidth=9;c.beginPath();c.moveTo(60,440);c.lineTo(60,190);c.lineTo(315,190);c.moveTo(60,440);c.lineTo(315,190);c.moveTo(60,440);c.lineTo(315,440);c.lineTo(315,190);c.stroke();
      for(const [x,y] of [[60,440],[315,190]]){c.fillStyle='#e8c584';c.beginPath();c.moveTo(x,y-24);c.lineTo(x+18,y);c.lineTo(x,y+24);c.lineTo(x-18,y);c.closePath();c.fill();}
      c.fillStyle='#f3d7a2';c.textAlign='center';c.font='27px "Microsoft YaHei",sans-serif';c.fillText('下一局，一起',w/2,535);c.font='17px "Microsoft YaHei",sans-serif';c.fillStyle='#b0c3bd';c.fillText('王者荣耀 · 双排待办',w/2,577);
      c.font='19px Georgia';c.fillStyle='#d1b17e';c.fillText('LILY  /  PLAYER TWO',w/2,88);
    });
    const gameScreen=new THREE.Mesh(new THREE.PlaneGeometry(.219,.374),new THREE.MeshStandardMaterial({map:gameMap,emissiveMap:gameMap,emissive:0xffffff,emissiveIntensity:.14,roughness:.38}));gameScreen.position.z=.019;gamePhone.add(gameScreen);
    shareSurfaceMaterials(group,{exclude:openings.map(o=>o.beam.material)});
    const batchResults=[...staticBatchRoots].map(parent=>rebatchSharedSurfaces(parent));
    return {source:'Original Blender birthday_props.glb',assets:7,staticPaletteBatching:{before:batchResults.reduce((n,q)=>n+q.before,0),after:batchResults.reduce((n,q)=>n+q.after,0),saved:batchResults.reduce((n,q)=>n+q.saved,0)}};
  })();
  ready.catch(e=>console.error('Birthday keepsakes:',e));

  let focused=null;
  const focusLight=new THREE.PointLight(0xffc88b,0,4.8,2);focusLight.name='Focused memory lantern';focusLight.userData.lightZone='outdoor';group.add(focusLight);
  targets.forEach(t=>{if(t.light)t.light.visible=false;});
  function setOpened(id){const o=openings.find(o=>o.id===id);if(o){o.target=1;const target=targets.find(t=>t.id===id);if(target)target.opened=true;}if(id==='letter'){letterGroup.userData.opened=true;}}
  function focus(id){focused=id??null;const target=targets.find(t=>t.id===focused&&t.light);if(target){target.light.getWorldPosition(focusLight.position);focusLight.intensity=2.5;}else focusLight.intensity=0;}
  focus(null);
  function setPhoto(index,texture){
    const f=photoFrames[index];if(!f||!texture)return false;texture.colorSpace=THREE.SRGBColorSpace;
    // Cover-crop the photo in the 4:5 opening, preserving a person's proportions.
    const im=texture.image,ratio=im?.width&&im?.height?im.width/im.height:.8,targetRatio=.75/.94;
    texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.repeat.set(1,1);texture.offset.set(0,0);
    if(ratio>targetRatio){texture.repeat.x=targetRatio/ratio;texture.offset.x=(1-texture.repeat.x)/2;}
    else{texture.repeat.y=ratio/targetRatio;texture.offset.y=(1-texture.repeat.y)/2;}
    texture.needsUpdate=true;f.mesh.material.map=texture;f.mesh.material.needsUpdate=true;f.placeholder=false;if(index===0){hearthPhoto.material.map=texture;hearthPhoto.material.needsUpdate=true;}return true;
  }
  function update(dt,t){
    const smooth=1-Math.exp(-Math.min(dt,.1)*5);
    for(const o of openings){o.amount+=(o.target-o.amount)*smooth;o.lid.rotation.x=-o.amount*1.12;o.beam.material.opacity=.022+o.amount*.035;o.glow.material.opacity=.55+o.amount*.25;}
    for(const a of haloAnimations){const target=a.base*(focused===a.id?2.35:focused?.78:1);a.light.intensity+=(target-a.light.intensity)*smooth;}
    for(const l of flameLights)l.intensity=.65+Math.sin(t*7.7)*.035+Math.sin(t*12.1)*.02;
    motePoints.rotation.y=Math.sin(t*.025)*.035;
  }
  return {group,targets,photoFrames,setPhoto,setOpened,focus,update,ready,flameLights,forecourt,revealForecourt(){forecourt.visible=true;},forecourtRevealed:()=>forecourt.visible};
}
