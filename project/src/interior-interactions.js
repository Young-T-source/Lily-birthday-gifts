import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYOUT } from './scene-layout.js';
import { paperCard, contactShadow, shareSurfaceMaterials, rebatchSharedSurfaces, interactionMaterial } from './diegetic-text.js';

/* Original, metre-scale objects for Lily. All surfaces are procedural and remain
   available in the single offline HTML. Doors, clock hands and lids are separate
   physical parts; the garments are sewn surfaces, not dress-shaped cones. */
export function createInteriorInteractions({scene,textures}) {
  const group=new THREE.Group();group.name='Lily · things you can really touch';scene.add(group);
  const targets=[],colliders=[],touches={};let elapsed=0,clockTouch=-100,giftTouch=-100,teaTouch=-100,cakeTouch=-100;
  const std=(color,roughness=.58,metalness=0,opts={})=>new THREE.MeshStandardMaterial({color,roughness,metalness,...opts});
  const physical=(color,roughness=.3,opts={})=>new THREE.MeshPhysicalMaterial({color,roughness,...opts});
  const fabric=clothTexture(),lace=laceTexture();
  const M={
    wood:std(0xe4c3b2,.47,0,{map:textures?.log?.map,normalMap:textures?.log?.normalMap,normalScale:new THREE.Vector2(.12,.12)}),
    painted:physical(0xd9b0ac,.39,{clearcoat:.28,clearcoatRoughness:.36}),
    edge:std(0xefd6c8,.48),inside:std(0xddcfc0,.83,0,{bumpMap:fabric,bumpScale:.009}),
    gold:std(0xba9767,.25,.85),goldDark:std(0x85674a,.38,.71),roseGold:std(0xd6a08b,.24,.83),
    velvet:std(0x582f46,.87,0,{bumpMap:fabric,bumpScale:.012}),
    pink:physical(0xd6a5af,.69,{sheen:.65,sheenColor:new THREE.Color(0xf6c4cf),sheenRoughness:.77,bumpMap:fabric,bumpScale:.007,side:THREE.DoubleSide}),
    navy:physical(0x273948,.75,{sheen:.55,sheenColor:new THREE.Color(0x526878),sheenRoughness:.7,bumpMap:fabric,bumpScale:.007,side:THREE.DoubleSide}),
    lavender:physical(0xb8a5bf,.63,{sheen:.64,sheenColor:new THREE.Color(0xe7d7ee),sheenRoughness:.72,bumpMap:fabric,bumpScale:.007,side:THREE.DoubleSide}),
    ivory:physical(0xe9e2d3,.74,{sheen:.35,sheenColor:new THREE.Color(0xf7eee0),bumpMap:fabric,bumpScale:.006,side:THREE.DoubleSide}),
    lace:std(0xeee6d6,.86,0,{map:lace,alphaTest:.38,side:THREE.DoubleSide}),
    clock:physical(0xe4afb7,.22,{clearcoat:1,clearcoatRoughness:.18}),
    pearl:physical(0xf4e6d8,.23,{clearcoat:.8,metalness:.16}),
    glass:physical(0xe1eef3,.08,{transparent:true,opacity:.18,depthWrite:false,metalness:.08,clearcoat:1}),
    ribbon:physical(0xad657b,.46,{sheen:.9,sheenColor:new THREE.Color(0xf8c6d1),sheenRoughness:.45,side:THREE.DoubleSide}),
    wrapping:std(0xe6d4ba,.73,0,{bumpMap:fabric,bumpScale:.005}),paper:std(0xf4e8d4,.91),
    dark:std(0x443b39,.52),tea:std(0xb47a46,.37),glow:new THREE.MeshBasicMaterial({color:0xffd7a0,toneMapped:false})
  };
  const add=(geo,mat,parent,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=!mat.transparent;m.receiveShadow=true;m.userData.staticPaletteBatch=true;parent.add(m);return m;};
  const box=(w,h,d,mat,p,x=0,y=0,z=0,r=.013)=>add(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w*.22,h*.22,d*.22)),mat,p,x,y,z);
  const cylinder=(r1,r2,h,mat,p,x=0,y=0,z=0,segments=28)=>add(new THREE.CylinderGeometry(r1,r2,h,segments),mat,p,x,y,z);
  const ball=(r,mat,p,x=0,y=0,z=0)=>add(new THREE.SphereGeometry(r,18,12),mat,p,x,y,z);
  const tube=(points,r,mat,p,closed=false)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(q=>new THREE.Vector3(...q)),closed,'catmullrom',.3),Math.max(20,points.length*5),r,7,closed),mat,p);
  const ring=(r,t,mat,p,x=0,y=0,z=0)=>add(new THREE.TorusGeometry(r,t,8,44),mat,p,x,y,z);
  function texture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
  function clothTexture(){const t=texture(256,256,(c,w,h)=>{c.fillStyle='#969696';c.fillRect(0,0,w,h);for(let i=0;i<w;i++){c.fillStyle=i%3===0?'#c4c4c4':'#888888';c.fillRect(i,0,1,h);c.fillStyle=i%4===0?'#b7b7b7':'#999999';c.globalAlpha=.34;c.fillRect(0,i,w,1);c.globalAlpha=1;}});t.colorSpace=THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(7,7);return t;}
  function laceTexture(){const t=texture(256,128,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='#fff9ed';c.lineWidth=4;for(let x=0;x<w+1;x+=32){c.beginPath();c.moveTo(x,0);c.lineTo(x+16,40);c.lineTo(x+32,0);c.moveTo(x,36);c.bezierCurveTo(x+5,96,x+27,96,x+32,36);c.stroke();for(let p=0;p<6;p++){c.beginPath();c.ellipse(x+16+Math.cos(p*Math.PI/3)*9,48+Math.sin(p*Math.PI/3)*9,7,3,p*Math.PI/3,0,7);c.stroke();}c.beginPath();c.arc(x+16,48,4,0,7);c.stroke();}for(const y of [2,9,17]){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}});t.wrapS=THREE.RepeatWrapping;t.repeat.set(12,1);return t;}
  function panel(text,w,h,font=48,color='#543337',background='#f0e2cd'){
    const map=texture(1024,Math.round(1024*h/w),(c,cw,ch)=>{c.fillStyle=background;c.fillRect(0,0,cw,ch);c.strokeStyle='#bc9871';c.lineWidth=3;c.strokeRect(12,12,cw-24,ch-24);c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';let size=Math.min(ch*.54,Math.max(font,88));const face=()=>`700 ${size}px "Microsoft YaHei",Georgia,serif`;c.font=face();while(size>12&&c.measureText(text).width>cw-64){size-=1;c.font=face();}c.fillText(text,cw/2,ch/2);});
    return paperCard(map,w,h);
  }
  function mergeStatic(parent){parent.updateWorldMatrix(true,true);const inverse=parent.matrixWorld.clone().invert(),buckets=new Map(),remove=[];parent.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)||o.userData.noMerge)return;let q=o;while(q&&q!==parent){if(q.userData.dynamic)return;q=q.parent;}const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));if(!g.attributes.normal)g.computeVertexNormals();if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(g);remove.push(o);});for(const [material,geos]of buckets){const geometry=mergeGeometries(geos);if(geometry){const m=new THREE.Mesh(geometry,material);m.castShadow=!material.transparent;m.receiveShadow=true;parent.add(m);}geos.forEach(g=>g.dispose());}remove.forEach(o=>o.removeFromParent());}
  function target(id,title,action,center,size,viewPose,message,gesture='touch'){
    const proxy=new THREE.Mesh(new THREE.BoxGeometry(...size),interactionMaterial);proxy.position.set(...center);proxy.name=`Touch · ${id}`;group.add(proxy);
    const t={id,title,action,kind:'interior',object:proxy,position:new THREE.Vector3(...center),viewPose,message,gesture,reach:2.35};targets.push(t);touches[id]=0;return t;
  }

  // A real cabinet with joinery, rose-gold hardware and fully hinged doors.
  const wardrobe=new THREE.Group();wardrobe.name='Lily’s wardrobe · three hanging dresses';wardrobe.position.set(2.95,3.45,-2.82);group.add(wardrobe);
  const body=new THREE.Group();wardrobe.add(body);
  box(1.68,.16,.63,M.painted,body,0,.17,0,.022);box(1.72,.09,.67,M.edge,body,0,.285,0,.018);
  for(const x of [-.69,.69])for(const z of [-.23,.23]){const leg=cylinder(.045,.065,.19,M.edge,body,x,.095,z);for(let f=0;f<6;f++){const a=f*Math.PI/3;tube([[x+Math.cos(a)*.043,.04,z+Math.sin(a)*.043],[x+Math.cos(a)*.036,.17,z+Math.sin(a)*.036]],.003,M.goldDark,body);}}
  box(1.56,1.97,.045,M.inside,body,0,1.29,-.293,.009);
  for(const x of [-.788,.788]){box(.09,1.96,.61,M.painted,body,x,1.29,0,.017);box(.021,1.87,.025,M.gold,body,x+(x>0?-.021:.021),1.29,.31,.005);}
  box(1.72,.10,.67,M.painted,body,0,2.29,0,.017);box(1.79,.072,.72,M.edge,body,0,2.375,0,.018);box(1.73,.039,.68,M.goldDark,body,0,2.326,0,.006);
  box(1.47,.055,.51,M.inside,body,0,.39,0,.008);box(1.48,.045,.51,M.inside,body,0,2.09,0,.006);
  const rod=cylinder(.012,.012,1.43,M.gold,body,0,1.99,-.025);rod.rotation.z=Math.PI/2;
  box(1.34,.012,.025,M.glow,body,0,2.074,.176,.003);
  const wardrobeLabel=panel('Lily’s little wardrobe',1.13,.13,47);wardrobeLabel.position.set(0,2.236,.343);body.add(wardrobeLabel);
  // Cedar drawer with folded stockings and a satin ribbon case.
  box(1.36,.19,.43,M.inside,body,0,.505,-.026,.013);for(let i=0;i<3;i++)box(.35,.026,.32,[M.ivory,M.pink,M.lavender][i],body,-.43+i*.43,.617,0,.012);
  const drawerPull=tube([[-.12,.51,.205],[-.1,.49,.231],[.1,.49,.231],[.12,.51,.205]],.009,M.gold,body);
  mergeStatic(body);
  const wardrobeLight=new THREE.PointLight(0xffd9a6,.32,2.1,2);wardrobeLight.position.set(0,1.93,.24);wardrobe.add(wardrobeLight);
  const doors=[];
  for(const side of [-1,1]){
    const hinge=new THREE.Group();hinge.name=side<0?'Wardrobe left hinged door':'Wardrobe right hinged door';hinge.position.set(side*.76,.318,.325);wardrobe.add(hinge);
    const center=-side*.376;box(.748,1.839,.045,M.painted,hinge,center,.919,0,.018);
    for(const y of [.42,1.365]){box(.626,.71,.019,M.edge,hinge,center,y,.03,.023);box(.548,.632,.022,M.painted,hinge,center,y,.045,.026);}
    for(const y of [.15,1.67]){const h=cylinder(.015,.015,.11,M.gold,hinge,0,y,0,16);}
    const pullX=center-side*.242;box(.03,.09,.018,M.goldDark,hinge,pullX,.943,.052,.008);
    const pull=tube([[pullX-.022,.949,.085],[pullX-.035,.982,.093],[pullX-.013,.992,.097],[pullX,.974,.098],[pullX+.013,.992,.097],[pullX+.035,.982,.093],[pullX+.022,.949,.085],[pullX,.927,.086],[pullX-.022,.949,.085]],.005,M.roseGold,hinge,true);
    mergeStatic(hinge);doors.push({hinge,side});
  }
  let doorAmount=0,doorTarget=0;
  const dresses=[];
  [-.485,0,.485].forEach((x,index)=>{
    const dress=new THREE.Group();dress.name=['Rosewater Lolita · lace and satin','Midnight constellation · velvet and cape','Lilac ribbon · ivory underskirt'][index];dress.position.set(x,1.98,-.045);dress.scale.x=.86;wardrobe.add(dress);
    const hanger=new THREE.Group();dress.add(hanger);tube([[0,.015,0],[.032,.045,0],[.034,.077,0],[.009,.089,0],[-.007,.073,0]],.005,M.gold,hanger);tube([[0,.015,0],[-.173,-.083,0],[.173,-.083,0],[0,.015,0]],.007,M.goldDark,hanger,true);
    const fabricMat=[M.pink,M.navy,M.lavender][index],trim=index===1?M.gold:M.ivory;
    // Ring-based bodice: shoulder slope, bust shaping and a fitted waist seam.
    const bodice=sewnSurface([{y:-.09,rx:.153,rz:.053},{y:-.16,rx:.181,rz:.074},{y:-.30,rx:.137,rz:.072},{y:-.44,rx:.113,rz:.063},{y:-.50,rx:.121,rz:.066}],fabricMat,48,1,.0015);dress.add(bodice);
    const collar=sewnSurface([{y:-.086,rx:.067,rz:.043},{y:-.125,rx:.092,rz:.052}],M.ivory,48,2,.004);dress.add(collar);
    for(const side of [-1,1]){
      const sleeve=ball(.092,fabricMat,dress,side*.174,-.19,0);sleeve.scale.set(.71,1.08,.80);sleeve.rotation.z=side*.3;
      const cuff=ring(.051,.012,trim,dress,side*.199,-.255,0);cuff.rotation.x=Math.PI/2;cuff.rotation.z=side*.28;
    }
    const skirtRings=[{y:-.48,rx:.119,rz:.071},{y:-.62,rx:.174,rz:.101},{y:-.86,rx:.231,rz:.143},{y:-1.18,rx:.264,rz:.169}];
    const skirtRadius=y=>{let a=skirtRings[0],b=skirtRings[1];if(y<=skirtRings.at(-1).y)return {...skirtRings.at(-1),y};if(y>=a.y)return {...a,y};for(let r=0;r<skirtRings.length-1;r++)if(y<=skirtRings[r].y&&y>=skirtRings[r+1].y){a=skirtRings[r];b=skirtRings[r+1];break;}const f=(y-a.y)/(b.y-a.y),s=f*f*(3-2*f);return {y,rx:THREE.MathUtils.lerp(a.rx,b.rx,s),rz:THREE.MathUtils.lerp(a.rz,b.rz,s)};};
    // An underskirt stays behind the entire dress. Only its longer lower hem
    // appears: crossing intersecting cloth shells creates false torn patches.
    const underRings=skirtRings.map(r=>({...r,rx:r.rx*.78,rz:r.rz*.76}));underRings.push({y:-1.255,rx:.251,rz:.156});
    const under=sewnSurface(underRings,index===1?M.navy:M.ivory,64,14,.0035);dress.add(under);
    const skirt=sewnSurface(skirtRings,fabricMat,80,index===1?10:15,.008);dress.add(skirt);
    if(index!==1)for(const y of [-.73,-.98,-1.18]){
      const ruffleRings=[y+.028,y-.028,y-.061].map((yy,j)=>{const r=skirtRadius(yy),offset=j===0?.020:.027;return {y:yy,rx:r.rx+offset,rz:r.rz+offset};});
      const flounce=sewnSurface(ruffleRings,M.ivory,80,24,.0055);dress.add(flounce);
      const laceRings=[y-.051,y-.092].map(yy=>{const r=skirtRadius(yy);return {y:yy,rx:r.rx+.031,rz:r.rz+.031};});
      const laceTrim=sewnSurface(laceRings,M.lace,80,24,.005);dress.add(laceTrim);
    }
    const belt=sewnSurface([{y:-.455,rx:.119,rz:.069},{y:-.51,rx:.125,rz:.072}],index===1?M.goldDark:M.ribbon,56,1,0);dress.add(belt);
    // Delicate corset lacing and tiny fabric-covered buttons lie on the cloth.
    for(let i=0;i<5;i++){
      const y=-.215-i*.045;if(index===0){tube([[-.028,y,.075],[.028,y-.045,.077]],.0025,M.ivory,dress);tube([[.028,y,.075],[-.028,y-.045,.077]],.0025,M.ivory,dress);}else ball(.007,M.pearl,dress,0,y,.076);
    }
    makeBow(dress,0,-.485,.085,index===1?M.goldDark:M.ribbon,.72);
    if(index===1){const cape=sewnSurface([{y:-.12,rx:.189,rz:.105},{y:-.48,rx:.224,rz:.142},{y:-1.10,rx:.281,rz:.194}],M.navy,56,9,.004,Math.PI*.50,Math.PI);dress.add(cape);for(let i=0;i<10;i++){const a=i*.91;ball(.0035,M.gold,dress,Math.sin(a)*.16,-.65-(i%5)*.083,.112+Math.cos(a)*.023);}const goldHem=sewnSurface([{y:-1.159,rx:.266,rz:.171},{y:-1.18,rx:.267,rz:.172}],M.goldDark,64,10,.008);dress.add(goldHem);}
    if(index===2){tube([[-.11,-.15,.045],[-.06,-.36,.077],[0,-.48,.087],[.06,-.36,.077],[.11,-.15,.045]],.008,M.ivory,dress);makeBow(dress,0,-.235,.08,M.ivory,.48);}
    const occasion=panel(['一起去春游','一起看星空','一起过生日'][index],.21,.061,36);occasion.position.set(0,-.34,.10);occasion.rotation.z=(index-1)*.07;dress.add(occasion);
    mergeStatic(dress);dresses.push({object:dress,phase:index*2.2});
  });
  colliders.push({name:'Lily wardrobe',minX:2.10,maxX:3.80,minZ:-3.15,maxZ:-2.48,minY:3.45,maxY:5.91});
  target('interior-wardrobe','Lily 的小衣橱','打开衣柜',[2.95,4.71,-2.45],[1.63,1.82,.16],[2.95,3.45,-1.47],'三套为你准备的裙子：玫瑰蕾丝、星夜披肩、紫丁香缎带。愿你一直自由地成为喜欢的自己。','open');

  // Rose porcelain heart clock, a true local-time analog dial under glass.
  const clock=new THREE.Group();clock.name='Rose porcelain heart clock · local time';clock.position.set(-1.27,1.145,-.305);clock.rotation.y=-.10;group.add(clock);
  const clockCase=new THREE.Group();clock.add(clockCase);
  const heartShape=makeHeartShape(.235);const hGeo=new THREE.ExtrudeGeometry(heartShape,{depth:.067,bevelEnabled:true,bevelThickness:.011,bevelSize:.010,bevelSegments:4,curveSegments:30});
  const shell=add(hGeo,M.clock,clockCase,0,.279,-.038);shell.castShadow=true;
  const rimPoints=[];for(let i=0;i<=120;i++){const a=i/120*Math.PI*2;rimPoints.push([16*Math.sin(a)**3/17*.235,.279+(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))/17*.235,.042]);}tube(rimPoints,.0035,M.roseGold,clockCase,true);
  for(const side of [-1,1]){const foot=ball(.033,M.gold,clockCase,side*.104,.037,-.002);foot.scale.set(1.2,.72,1.35);tube([[side*.105,.04,0],[side*.112,.165,-.005]],.013,M.roseGold,clockCase);}
  const dialTexture=texture(1024,1024,(c,w,h)=>{
    const grd=c.createRadialGradient(512,512,0,512,512,505);grd.addColorStop(0,'#fcf6e9');grd.addColorStop(1,'#e6d4bf');c.fillStyle=grd;c.fillRect(0,0,w,h);
    c.translate(512,512);for(let i=0;i<60;i++){const a=i*Math.PI/30;c.save();c.rotate(a);c.strokeStyle=i%5?'#ba997e':'#8c645c';c.lineWidth=i%5?2.5:6;c.beginPath();c.moveTo(0,-(i%5?440:419));c.lineTo(0,-462);c.stroke();c.restore();}
    c.fillStyle='#7d585a';c.textAlign='center';c.textBaseline='middle';c.font='43px Georgia';['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'].forEach((n,i)=>{const a=i*Math.PI/6;c.fillText(n,Math.sin(a)*355,-Math.cos(a)*355);});
    c.font='italic 55px Georgia';c.fillText('Lily',0,-135);c.font='23px Georgia';c.fillStyle='#ad8972';c.fillText('EVERY MOMENT, WITH YOU',0,173);c.font='27px Georgia';c.fillText('10 · 29',0,230);
  });
  const dial=add(new THREE.CircleGeometry(.145,80),std(0xffffff,.71,0,{map:dialTexture}),clockCase,0,.292,.044);
  ring(.148,.005,M.roseGold,clockCase,0,.292,.044);const glass=add(new THREE.CircleGeometry(.146,80),M.glass,clockCase,0,.292,.057);glass.castShadow=false;
  mergeStatic(clockCase);
  const clockHands=[];
  for(const [len,wid,mat,z]of [[.080,.011,M.goldDark,.051],[.112,.007,M.goldDark,.053],[.123,.0025,M.ribbon,.055]]){const hand=new THREE.Group();hand.position.set(0,.292,z);const shape=new THREE.Shape();shape.moveTo(-wid*.45,-.017);shape.lineTo(-wid*.5,len*.68);shape.lineTo(0,len);shape.lineTo(wid*.5,len*.68);shape.lineTo(wid*.45,-.017);shape.closePath();add(new THREE.ShapeGeometry(shape),mat,hand);clock.add(hand);clockHands.push(hand);}
  ball(.009,M.roseGold,clock,0,.292,.059).scale.z=.3;
  target('interior-clock','粉色心形台钟','轻触台钟',[-1.27,1.44,-.15],[.44,.48,.16],[-1.86,0,.85],'滴答，滴答。每一次认真相伴的此刻，都值得被珍藏。台钟显示的就是现在的时间。','touch');

  // An unwrapping gift at the free back edge of the dining table.
  const gift=new THREE.Group();gift.name='A birthday present · hinged satin-ribbon lid';gift.position.set(2.66,1.103,-1.94);gift.rotation.y=-.22;group.add(gift);
  const giftBase=new THREE.Group();gift.add(giftBase);box(.35,.225,.30,M.wrapping,giftBase,0,.12,0,.016);box(.318,.013,.267,M.velvet,giftBase,0,.234,0,.006);
  for(const x of [-.15,.15])box(.009,.014,.257,M.gold,giftBase,x,.235,0,.002);
  const giftCard=panel('下一页，想与你一起',.28,.088,64);giftCard.rotation.x=-Math.PI/2;giftCard.position.set(0,.245,.022);giftBase.add(giftCard);
  const pearlNecklace=[];for(let i=0;i<35;i++){const a=i/35*Math.PI*2;pearlNecklace.push([Math.cos(a)*.082,.25,Math.sin(a)*.083-.003]);}pearlNecklace.forEach(p=>ball(.005,M.pearl,giftBase,...p));
  const heartPendant=add(new THREE.ExtrudeGeometry(makeHeartShape(.018),{depth:.004,bevelEnabled:true,bevelThickness:.002,bevelSize:.002,bevelSegments:2}),M.roseGold,giftBase,0,.254,.083);heartPendant.rotation.x=-Math.PI/2;
  mergeStatic(giftBase);
  const giftLid=new THREE.Group();giftLid.position.set(0,.241,-.149);gift.add(giftLid);
  box(.371,.051,.32,M.wrapping,giftLid,0,.026,.149,.013);box(.061,.006,.322,M.ribbon,giftLid,0,.055,.149,.001);box(.373,.006,.049,M.ribbon,giftLid,0,.059,.149,.001);
  const giftBow=makeBow(giftLid,0,.088,.149,M.ribbon,.8,true);giftBow.userData.dynamic=true;mergeStatic(giftLid);let giftAmount=0,giftTarget=0;
  target('interior-gift','缎带里的生日礼物','打开礼物',[2.43,1.44,-1.94],[.49,.42,.44],[1.78,0,-2.08],'愿你被好好爱着，也永远有勇气奔向喜欢的生活。未来的下一页，我想和你一起写。','unwrap');

  // Small, physically scaled finishing details beside the existing Blender cake.
  const cakeDetails=new THREE.Group();cakeDetails.name='Cake · rose-gold serving rim and sugar petals';cakeDetails.position.set(2.65,1.45,2.40);cakeDetails.rotation.y=-.38;cakeDetails.scale.setScalar(1.30);group.add(cakeDetails);
  const cakePlate=ring(.225,.005,M.roseGold,cakeDetails,0,.012,0);cakePlate.rotation.x=Math.PI/2;
  // The source cake already has an actual gold “Lily” text topper and stakes;
  // retain that physical lettering rather than putting a second card through it.
  for(let i=0;i<14;i++){
    const a=i*2.4,r=.10+((i*7)%5)*.012;const p=ball(.010,M.pink,cakeDetails,Math.cos(a)*r,.268,Math.sin(a)*r);p.scale.set(.92,.21,1.3);p.rotation.y=a;
    if(i<5){const leaf=ball(.007,M.ivory,cakeDetails,Math.cos(a)*r,.271,Math.sin(a)*r);leaf.scale.set(.8,.15,1.4);leaf.rotation.y=a+.8;}
  }
  mergeStatic(cakeDetails);
  target('interior-cake','留给小李朋友的蛋糕','许一个生日愿望',[2.40,1.85,2.40],[.62,.65,.62],[1.79,0,2.40],'闭上眼睛，认真许一个愿望。愿小李朋友的每一年，都比上一年更快乐、更自由、更被爱着。','touch');

  // A teaspoon, condensation beads and a gentle tactile response at the tea cup.
  const teaDetails=new THREE.Group();teaDetails.name='Milk tea · condensation and rose-gold teaspoon';teaDetails.position.set(-.59,1.15,.23);group.add(teaDetails);
  const spoon=new THREE.Group();spoon.position.set(.07,.14,0);spoon.rotation.z=-.24;teaDetails.add(spoon);cylinder(.0022,.0022,.205,M.roseGold,spoon,0,.103,0,12);const bowl=ball(.012,M.roseGold,spoon,0,-.003,0);bowl.scale.set(.72,1.4,.24);
  const condensation=new THREE.InstancedMesh(new THREE.SphereGeometry(.0026,8,6),M.glass,45);const dropMatrix=new THREE.Matrix4(),dropScale=new THREE.Vector3(),dropQ=new THREE.Quaternion();for(let i=0;i<45;i++){const a=i*2.399;dropScale.set(.7,1.1+(i%3)*.3,.55);dropMatrix.compose(new THREE.Vector3(Math.sin(a)*.066,.047+(i%13)*.011,Math.cos(a)*.066),dropQ,dropScale);condensation.setMatrixAt(i,dropMatrix);}teaDetails.add(condensation);
  const teaCoaster=cylinder(.096,.096,.004,M.ribbon,teaDetails,0,.003,0,48);mergeStatic(spoon);
  const teaNote=panel('七分甜 · 和你一样',.16,.06,40);teaNote.rotation.x=-Math.PI/2;teaNote.rotation.z=.22;teaNote.position.set(.052,.006,.073);teaDetails.add(teaNote);
  const mistGlass=M.glass.clone();mistGlass.opacity=0;mistGlass.roughness=.83;const teaFog=add(new THREE.CylinderGeometry(.067,.066,.16,24,1,true),mistGlass,teaDetails,0,.126,0);teaFog.castShadow=false;
  const swirl=new THREE.Group();swirl.position.set(0,.238,0);teaDetails.add(swirl);for(let i=0;i<2;i++){const r=ring(.024+i*.015,.0015,M.ivory,swirl,0,0,0);r.rotation.x=Math.PI/2;r.scale.z=.58;}swirl.visible=false;
  target('interior-tea','甜甜的奶茶','轻轻搅一搅',[-.52,1.47,.18],[.24,.40,.24],[.40,0,-.20],'甜度刚刚好。以后的奶茶、蛋糕和很多个平凡的下午，都想陪你一起。','stir');

  // A quiet, warm shimmer rises from the cake only after making a wish.
  const wishGeo=new THREE.BufferGeometry(),wishPositions=new Float32Array(34*3);wishGeo.setAttribute('position',new THREE.BufferAttribute(wishPositions,3));
  const wishMap=texture(64,64,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'#fff5c7');g.addColorStop(.18,'rgba(255,227,159,.9)');g.addColorStop(1,'rgba(255,197,107,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
  const wishMat=new THREE.PointsMaterial({color:0xffe0a4,size:.028,map:wishMap,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});const wish=new THREE.Points(wishGeo,wishMat);wish.frustumCulled=false;group.add(wish);
  const giftSparkGeo=new THREE.BufferGeometry(),giftSparkPos=new Float32Array(18);giftSparkGeo.setAttribute('position',new THREE.BufferAttribute(giftSparkPos,3));
  const giftSparkMat=wishMat.clone();giftSparkMat.size=.020;const giftSparks=new THREE.Points(giftSparkGeo,giftSparkMat);gift.add(giftSparks);

  function interact(id){const t=targets.find(t=>t.id===id);if(!t)return null;touches[id]++;if(id==='interior-wardrobe'){doorTarget=doorTarget?0:1;t.action=doorTarget?'合上衣柜':'打开衣柜';}if(id==='interior-clock')clockTouch=elapsed;if(id==='interior-gift'){giftTarget=giftTarget?0:1;giftTouch=elapsed;t.action=giftTarget?'合上礼物':'打开礼物';}if(id==='interior-tea')teaTouch=elapsed;if(id==='interior-cake')cakeTouch=elapsed;
    return {id,title:t.title,message:t.message,gesture:t.gesture,duration:id==='interior-wardrobe'?1.4:1.1,position:t.position.clone(),open:id==='interior-wardrobe'?!!doorTarget:undefined};
  }
  contactShadow(group,2.95,3.462,-2.82,.88,.42,.26);contactShadow(group,2.65,.664,2.4,.43,.43,.22);
  function update(dt,time){elapsed+=Math.min(dt,.1);const smooth=1-Math.exp(-Math.min(dt,.12)*4.2);doorAmount+=(doorTarget-doorAmount)*smooth;doors.forEach(d=>d.hinge.rotation.y=d.side*doorAmount*(d.side>0?2.48:1.63));wardrobeLight.intensity=.26+doorAmount*.42;
    for(const d of dresses)d.object.rotation.z=Math.sin(elapsed*.55+d.phase)*.005*doorAmount;
    const date=new Date(),seconds=date.getSeconds()+date.getMilliseconds()/1000,minutes=date.getMinutes()+seconds/60,hours=date.getHours()%12+minutes/60;
    clockHands[0].rotation.z=-hours*Math.PI/6;clockHands[1].rotation.z=-minutes*Math.PI/30;clockHands[2].rotation.z=-seconds*Math.PI/30;
    const ct=elapsed-clockTouch;clock.rotation.z=ct<2?Math.sin(ct*13)*Math.exp(-ct*3)*.055:0;
    if(ct>=0&&ct<3){const rewind=Math.sin(ct/3*Math.PI);clockHands[2].rotation.z+=rewind*Math.PI*2;clockHands[1].rotation.z+=rewind*.105;}
    M.clock.emissive.setHex(0x8b3b36);M.clock.emissiveIntensity=ct<3?.10*Math.sin(ct/3*Math.PI):0;
    giftAmount+=(giftTarget-giftAmount)*smooth;giftLid.rotation.x=-giftAmount*1.30;
    giftBow.rotation.z=Math.sin(Math.min(1,(elapsed-giftTouch)/.7)*Math.PI)*.22;giftBow.scale.x=.8+giftAmount*.22;
    const gt=elapsed-giftTouch;giftSparks.visible=giftTarget===1&&gt>=0&&gt<2.7;giftSparkMat.opacity=giftSparks.visible?Math.sin(gt/2.7*Math.PI)*.65:0;
    if(giftSparks.visible){for(let i=0;i<6;i++){const a=i*Math.PI/3;giftSparkPos[i*3]=Math.cos(a)*(.035+gt*.026);giftSparkPos[i*3+1]=.28+gt*.075+i*.014;giftSparkPos[i*3+2]=Math.sin(a)*(.035+gt*.026);}giftSparkGeo.attributes.position.needsUpdate=true;}
    const tt=elapsed-teaTouch;spoon.rotation.y=tt<2.8?Math.sin(tt*9)*.22*Math.max(0,1-tt/2.8):0;teaDetails.rotation.z=tt<1.5?Math.sin(tt*8)*Math.exp(-tt*3)*.024:0;
    mistGlass.opacity=tt>=0&&tt<4?Math.sin(tt/4*Math.PI)*.14:0;swirl.visible=tt>=0&&tt<2.8;swirl.rotation.y=tt*2.4;
    const cakeT=elapsed-cakeTouch,active=cakeT>=0&&cakeT<4.8;wishMat.opacity=active?Math.sin(Math.min(1,cakeT/.5)*Math.PI/2)*Math.min(1,(4.8-cakeT)/1.5)*.6:0;
    if(active){for(let i=0;i<34;i++){const a=i*2.399+cakeT*.18,r=.08+(i%6)*.022;wishPositions[i*3]=2.65+Math.sin(a)*r;wishPositions[i*3+1]=2.02+((cakeT*.22+i*.035)%.9);wishPositions[i*3+2]=2.40+Math.cos(a)*r;}wishGeo.attributes.position.needsUpdate=true;}
  }
  update(0,0);
  shareSurfaceMaterials(group,{exclude:[M.clock,mistGlass]});
  const staticGroups=[];group.traverse(o=>{if(o.isGroup)staticGroups.push(o);});staticGroups.forEach(rebatchSharedSurfaces);
  return {group,targets,colliders,interact,update,stats:()=>({animating:Math.abs(doorAmount-doorTarget)>.002||Math.abs(giftAmount-giftTarget)>.002||elapsed-clockTouch<2,wardrobeOpen:doorTarget===1,wardrobeAmount:+doorAmount.toFixed(3),wardrobeDresses:3,giftOpen:giftTarget===1,giftAmount:+giftAmount.toFixed(3),clockLocalTime:new Date().toLocaleTimeString('zh-CN'),touches:{...touches},totalTouches:Object.values(touches).reduce((a,b)=>a+b,0)})};

  function sewnSurface(rings,material,segments=64,folds=12,amplitude=.008,start=0,arc=Math.PI*2){
    segments=Math.max(24,Math.round(segments*.62));
    const positions=[],uv=[],indices=[];const steps=Math.max(10,(rings.length-1)*6);
    for(let j=0;j<=steps;j++){
      const u=j/steps*(rings.length-1),ri=Math.min(rings.length-2,Math.floor(u)),f=u-ri,s=f*f*(3-2*f),a=rings[ri],b=rings[ri+1];const y=THREE.MathUtils.lerp(a.y,b.y,f),rx=THREE.MathUtils.lerp(a.rx,b.rx,s),rz=THREE.MathUtils.lerp(a.rz,b.rz,s);
      for(let i=0;i<=segments;i++){const theta=start+i/segments*arc,fold=Math.sin(theta*folds+.2)*amplitude*(.3+j/steps*.7)+Math.sin(theta*folds*2+.6)*amplitude*.22;positions.push(Math.sin(theta)*(rx+fold),y+Math.cos(theta*folds)*.002*j/steps,Math.cos(theta)*(rz+fold*.65));uv.push(i/segments,j/steps);if(j<steps&&i<segments){const k=j*(segments+1)+i;indices.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2);}}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
  }
  function makeHeartShape(size){const shape=new THREE.Shape();for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,x=16*Math.sin(a)**3/17*size,y=(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))/17*size;i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();return shape;}
  function makeBow(parent,x,y,z,material,scale=1,horizontal=false){const bow=new THREE.Group();bow.position.set(x,y,z);bow.scale.setScalar(scale);if(horizontal)bow.rotation.x=-Math.PI/2;parent.add(bow);
    for(const side of [-1,1]){const pts=[[0,0,0],[side*.043,.042,.009],[side*.105,.037,.004],[side*.116,-.002,0],[side*.065,-.015,.007],[0,0,0]];const path=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));const geo=new THREE.BufferGeometry(),pos=[],uv=[],idx=[];for(let i=0;i<=36;i++){const t=i/36,p=path.getPoint(t),tan=path.getTangent(t),across=new THREE.Vector3(-tan.y,tan.x,0).normalize().multiplyScalar(.013);for(const s of [-1,1]){pos.push(p.x+across.x*s,p.y+across.y*s,p.z+Math.sin(t*Math.PI)*.009);uv.push(t,(s+1)/2);}if(i<36){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}}geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();add(geo,material,bow);tube([[side*.005,-.008,0],[side*.016,-.055,.009],[side*.04,-.098,-.001]],.011,material,bow);}
    const knot=ball(.018,material,bow,0,0,.008);knot.scale.set(1,.7,.55);return bow;
  }
}
