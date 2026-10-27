import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LAYOUT } from './scene-layout.js';
import { terrainHeight } from './environment.js';

// A sign's light belongs to its frame. Dark ink is never added to the emissive
// channel: doing that made even a 2K atlas look milky after bloom and exposure.
const PANEL_COPY = [
  {title:'Lily’s lovely house',sub:'为你亮着灯，等你回家',pink:false},
  {title:'生日快乐，小李朋友',sub:'2026.10.29 · 愿你一直被温柔以待',pink:true},
  {title:'HAPPY BIRTHDAY, LILY',sub:'今晚，所有美好都属于你',pink:true},
  {title:'Welcome, birthday girl',sub:'一间为你准备的小屋',pink:false}
];
export function createCelebrationPanelTexture(row,w,h){
  const {title,sub,pink}=PANEL_COPY[row],c=document.createElement('canvas');
  c.width=2048;c.height=Math.round(c.width*h/w);const q=c.getContext('2d');
  const bg=pink?'#ffe7ee':'#fff4e3',ink=pink?'#4e2039':'#462b32',secondary='#68404b';
  q.fillStyle=bg;q.fillRect(0,0,c.width,c.height);
  q.strokeStyle='#ba8655';q.lineWidth=7;q.strokeRect(22,22,c.width-44,c.height-44);
  q.strokeStyle=pink?'#edb6c8':'#e4c9a0';q.lineWidth=3;q.strokeRect(36,36,c.width-72,c.height-72);
  q.textAlign='center';q.textBaseline='middle';q.fillStyle=ink;
  const family=row===0||row===3?'Georgia, "Microsoft YaHei", serif':'"Microsoft YaHei", "PingFang SC", Arial, sans-serif';
  let titleSize=Math.min(c.height*.39,row===2?158:245);
  const titleFont=()=>`700 ${titleSize}px ${family}`;q.font=titleFont();
  while(titleSize>12&&q.measureText(title).width>c.width-180){titleSize-=1;q.font=titleFont();}
  const titleY=c.height*.42,titleWidth=q.measureText(title).width;q.fillText(title,c.width/2,titleY);
  let subSize=Math.min(c.height*.17,row===2?59:79);q.fillStyle=secondary;q.font=`600 ${subSize}px "Microsoft YaHei", "PingFang SC", Arial, sans-serif`;
  while(subSize>12&&q.measureText(sub).width>c.width-210){subSize-=1;q.font=`600 ${subSize}px "Microsoft YaHei", "PingFang SC", Arial, sans-serif`;}
  q.fillText(sub,c.width/2,c.height*.74);
  // The little hearts stay outside the text's safety margin.
  for(const x of [70,c.width-70]){const y=c.height*.46;q.fillStyle='#ad7947';q.beginPath();q.moveTo(x,y);q.bezierCurveTo(x-21,y-21,x-31,y+8,x,y+30);q.bezierCurveTo(x+31,y+8,x+21,y-21,x,y);q.fill();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=16;
  t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;
  t.userData.signClarity={title,subtitle:sub,ink,background:bg,secondary,titleSize,subtitleSize:subSize,titleY,titleWidth,source:[c.width,c.height],physical:[w,h],texelsPerMetre:Math.min(c.width/w,c.height/h),aspectError:Math.abs((c.width/c.height)/(w/h)-1),independentTexture:true};
  return t;
}

// Metric scenography. Everything is on a carrier, or tied to a real support.
// No collision body is added: the broad centre aisle, door and stairs stay clear.
export function createCelebrationDecor({ scene, textures }) {
  const group = new THREE.Group();
  group.name = 'Lily · a house dressed for her birthday';
  group.userData.celebrationDecor = true;
  scene.add(group);
  const batches = new Map(), balloons = [[], [], []], bulbs = [], moving = [];
  const d = new THREE.Object3D(), color = new THREE.Color();
  const palette = [0xf4a3c1, 0xffe9cf, 0xe9c384];
  let seed = 10292026;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const M = {
    pearl: palette.map(c => new THREE.MeshPhysicalMaterial({ color: c, roughness: .23,
      metalness: .12, clearcoat: .95, clearcoatRoughness: .16, sheen: .30,
      sheenColor: new THREE.Color(0xfff4e7), sheenRoughness: .45,
      emissive: c, emissiveIntensity: .065, envMapIntensity: 1.4 })),
    ribbon: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true,
      roughness: .43, metalness: .08, sheen: .85, sheenColor: new THREE.Color(0xffd3df),
      sheenRoughness: .38, clearcoat: .12, side: THREE.DoubleSide,
      emissive: 0x8b4058, emissiveIntensity: .12 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xddb77d, roughness: .29, metalness: .72,
      emissive: 0xb5783d, emissiveIntensity: .06 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xf6e6d2, roughness: .48,
      emissive: 0xcaa38c, emissiveIntensity: .09 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x9b806a, roughness: .75, metalness: .20 }),
    warm: new THREE.MeshBasicMaterial({ color: 0xffd3a0, toneMapped: false }),
    pink: new THREE.MeshBasicMaterial({ color: 0xff92c1, toneMapped: false }),
    bulbs: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
  };
  Object.values(M).flat().forEach(m => { m.name ||= 'Birthday celebration surface'; });

  function batch(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], cast = false) {
    d.position.set(...position); d.rotation.set(...rotation); d.scale.set(...scale); d.updateMatrix();
    geometry.applyMatrix4(d.matrix);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
    if (material.vertexColors && !geometry.attributes.color) {
      const c = new Float32Array(geometry.attributes.position.count * 3); c.fill(1);
      geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    const key = material.uuid + ':' + cast;
    if (!batches.has(key)) batches.set(key, { material, cast, geometries: [] });
    batches.get(key).geometries.push(geometry.index ? geometry.toNonIndexed() : geometry);
  }
  const box = (w, h, depth, mat, xyz, rotation) => batch(new RoundedBoxGeometry(w, h, depth, 2, Math.min(.025, depth * .2, h * .2)), mat, xyz, rotation, undefined, true);
  function tube(points, radius, mat = M.brass, closed = false) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new THREE.Vector3(...p)), closed, 'centripetal');
    batch(new THREE.TubeGeometry(curve, Math.min(160, Math.max(16, points.length * 2)), radius, 5, closed), mat);
    return curve;
  }
  function tintGeometry(g, hex) {
    const c = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  }
  function silkStrip(points, width, hex = 0xe29ab3, segments = 40) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), p = [], uv = [], indices = [];
    for (let i = 0; i <= segments; i++) {
      const u = i / segments, c = curve.getPoint(u), tangent = curve.getTangent(u);
      const across = new THREE.Vector3(-tangent.y, tangent.x, .12 * Math.sin(u * Math.PI * 8)).normalize();
      for (const side of [-1, 1]) { const q = c.clone().addScaledVector(across, side * width / 2); p.push(q.x, q.y, q.z); uv.push(u, (side + 1) / 2); }
      if (i < segments) { const j = i * 2; indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); batch(tintGeometry(g, hex), M.ribbon);
  }
  function bow(x, y, z, s = 1) {
    for (const side of [-1, 1]) {
      silkStrip([[x,y,z+.03],[x+side*.28*s,y+.24*s,z+.14*s],[x+side*.63*s,y+.14*s,z+.08*s],
        [x+side*.53*s,y-.15*s,z+.15*s],[x,y,z+.06]], .17*s, 0xf0adc5);
      silkStrip([[x+side*.05*s,y,z+.11*s],[x+side*.15*s,y-.37*s,z+.16*s],[x+side*.28*s,y-.74*s,z+.05*s]], .19*s, 0xda8caa);
    }
    batch(tintGeometry(new RoundedBoxGeometry(.23*s,.18*s,.17*s,3,.045*s),0xefb0c5),M.ribbon,[x,y,z+.13*s]);
  }
  function balloon(p, radius, materialIndex, tilt = 0) {
    balloons[materialIndex].push({ p: p.clone(), radius, tilt, phase: rand() * Math.PI * 2 });
    // The tied latex neck is distinct from the main inflated shell.
    batch(new THREE.ConeGeometry(radius*.14,radius*.26,5),M.pearl[materialIndex],[p.x,p.y-radius*1.18,p.z],[0,0,Math.PI+tilt]);
  }

  // An open-bottom heart arch keeps a > 5 m central passage. Smaller balloons
  // interlace the main pearl balloons rather than making a stack of equal balls.
  const archPoints = [[-4.15,.38,9.45],[-4.25,2.0,9.38],[-3.85,3.60,9.25],[-2.70,4.65,9.22],
    [-1.22,4.55,9.22],[0,3.72,9.24],[1.22,4.55,9.22],[2.70,4.65,9.22],[3.85,3.60,9.25],[4.25,2.0,9.38],[4.15,.38,9.45]];
  const arch = new THREE.CatmullRomCurve3(archPoints.map(p => new THREE.Vector3(...p)));
  tube(archPoints,.022,M.brass);
  for (let i=0;i<61;i++) {
    const u=i/60,p=arch.getPointAt(u),r=.19+rand()*.095;
    p.x+=(rand()-.5)*.07;p.y+=(rand()-.5)*.07;p.z+=(rand()-.5)*.24;
    balloon(p,r,i%7===0?2:i%4===0?1:0,(rand()-.5)*.38);
    if(i%3===0){const q=p.clone().add(new THREE.Vector3((rand()-.5)*.35,(rand()-.5)*.26,.24));balloon(q,r*.57,(i+1)%3,(rand()-.5)*.4);}
  }
  for(const x of [-4.15,4.15]) {
    const y=terrainHeight(x,9.45);
    box(.60,.10,.60,M.cream,[x,y+.055,9.45]);box(.42,.06,.42,M.brass,[x,y+.13,9.45]);
    for(let j=0;j<3;j++)balloon(new THREE.Vector3(x+(j-1)*.21,y+.32+(j%2)*.16,9.4+.08*(j%2)),.20,j%3,.25*(j-1));
  }
  // A complete, woven heart is visible beside the entry arch, with a clear
  // central opening and no planar heart sticker masquerading as a model.
  const heartCentre=new THREE.Vector3(5.25,2.03,10.5),heartScale=.078;
  const heartPoints=[];
  for(let i=0;i<=64;i++){const t=i/64*Math.PI*2;heartPoints.push([heartCentre.x+16*Math.sin(t)**3*heartScale,
    heartCentre.y+(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))*heartScale,heartCentre.z]);}
  const heartCurve=tube(heartPoints,.018,M.brass,true);
  for(let i=0;i<43;i++){const p=heartCurve.getPointAt(i/43);p.z+=(i%2?-.075:.075);balloon(p,.14+(i%3)*.015,i%5===0?2:i%3===0?1:0,(rand()-.5)*.4);}
  bow(heartCentre.x,heartCentre.y-1.30,heartCentre.z+.18,.6);
  tube([[5.25,.10,10.5],[5.25,.64,10.5]],.018,M.brass);
  box(.70,.10,.55,M.cream,[5.25,terrainHeight(5.25,10.5)+.05,10.5]);

  // Four independent 2K faces retain their exact carrier aspect ratio and full
  // mip chains. Their warm / pink highlight is separate, physical tube lighting.
  const signFaces=[];
  function plaque(row,w,h,x,y,z,{standing=false,rotation=0}={}){
    const sign=new THREE.Group();sign.name=['Lily’s lovely house · illuminated standing sign','Birthday wishes · illuminated standing sign','Birthday eave banner','Welcome plaque'][row];sign.position.set(x,y,z);sign.rotation.y=rotation;group.add(sign);
    // Allocate geometry directly to the final batch, including local yaw.
    const transform=(g,lx,ly,lz,mat)=>{const q=new THREE.Vector3(lx,ly,lz).applyAxisAngle(new THREE.Vector3(0,1,0),rotation).add(new THREE.Vector3(x,y,z));batch(g,mat,q.toArray(),[0,rotation,0]);};
    transform(new RoundedBoxGeometry(w+.11,h+.11,.10,3,.035),0,0,0,M.brass);
    transform(new RoundedBoxGeometry(w+.055,h+.055,.112,3,.03),0,0,.016,M.cream);
    const map=createCelebrationPanelTexture(row,w,h),signMat=new THREE.MeshStandardMaterial({map,roughness:.88,metalness:0});
    signMat.name='High contrast birthday ink on a lit physical plaque';
    const face=new THREE.Mesh(new THREE.PlaneGeometry(w,h),signMat);face.name='Readable 2K plaque · '+PANEL_COPY[row].title;face.position.z=.079;face.receiveShadow=true;face.userData.noMerge=true;face.userData.diegeticText=true;face.userData.signClarity={...map.userData.signClarity,row};sign.add(face);signFaces.push(face);
    const contour=[[-w/2-.045,-h/2-.045,.086],[-w/2-.045,h/2+.045,.086],[w/2+.045,h/2+.045,.086],[w/2+.045,-h/2-.045,.086]];
    const world=contour.map(p=>new THREE.Vector3(...p).applyAxisAngle(new THREE.Vector3(0,1,0),rotation).add(new THREE.Vector3(x,y,z)));
    tube(world,.010,row===1?M.pink:M.warm,true);
    for(let i=0;i<30;i++){const a=i/30*Math.PI*2;const lx=Math.cos(a)*(w/2+.06),ly=Math.sin(a)*(h/2+.06);if(Math.abs(Math.cos(a))>.85||Math.abs(Math.sin(a))>.85){const p=new THREE.Vector3(lx,ly,.103).applyAxisAngle(new THREE.Vector3(0,1,0),rotation).add(new THREE.Vector3(x,y,z));bulbs.push({p,r:.017,color:row===1?0xffb9d5:0xffdfac});}}
    if(standing){const ground=terrainHeight(x,z);for(const side of [-1,1]){
      const supportTop=y-h*.32,base=ground+.11;transform(new THREE.CylinderGeometry(.027,.034,supportTop-base,10),side*w*.34,(supportTop+base)/2-y,-.015,M.brass);
      transform(new RoundedBoxGeometry(.38,.07,.55,2,.02),side*w*.34,ground+.045-y,0,M.cream);
    }}
    return sign;
  }
  plaque(0,2.45,.82,-3.10,1.66,7.20,{standing:true,rotation:.10});
  plaque(1,2.60,.89,3.10,1.72,7.20,{standing:true,rotation:-.12});
  // The roof plaque is raised above the foreground balloons' sight line. Two
  // brass uprights connect it to the fascia rather than leaving it floating.
  plaque(2,5.90,.84,0,6.29,5.72);
  for(const x of [-2.50,2.50])box(.035,.89,.035,M.brass,[x,6.20,5.65]);
  plaque(3,1.42,.40,-1.58,3.24,6.14);

  // Every band is tied to the real fascia or wall, with folded silk bows.
  for(const side of [-1,1]){
    const x=side*3.35;
    bow(x,4.74,3.62,.75);
    silkStrip([[side*4.18,5.80,3.63],[side*4.13,4.95,3.67],[side*4.22,4.10,3.64],[side*4.15,3.62,3.65]],.20,0xd69bb4);
    // Large upper-storey heart lights read as a celebration from the first view.
    const heart=[];for(let i=0;i<=64;i++){const t=i/64*Math.PI*2;heart.push([side*3.40+16*Math.sin(t)**3*.026,4.70+(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))*.026,3.66]);}
    tube(heart,.018,M.pink,true);heart.forEach((p,i)=>{if(i%3===0)bulbs.push({p:new THREE.Vector3(...p),r:.024,color:0xffc7de});});
  }
  bow(0,6.96,5.72,.72);
  // Champagne outlines bring out both the high roof and the human-scale porch.
  const outlines=[ [[-5.60,5.96,5.40],[0,5.94,5.40],[5.60,5.96,5.40]],
    [[-3.76,3.03,6.09],[0,2.91,6.10],[3.76,3.03,6.09]],
    [[-3.51,.59,5.83],[-3.51,3.03,5.83]],[[3.51,.59,5.83],[3.51,3.03,5.83]] ];
  for(const points of outlines){const curve=tube(points,.010,M.warm);const n=Math.ceil(curve.getLength()/.25);for(let i=0;i<=n;i++)bulbs.push({p:curve.getPointAt(i/n),r:.022,color:i%5===0?0xffa8cb:0xffd4a0});}
  // Fabric pennants retain a lit fabric body when bloom is disabled.
  for(const [span,y,z,n] of [[6.8,3.02,6.12,15],[9.6,5.88,5.46,19]]){
    for(let i=0;i<n;i++){const x=-span/2+(i+.5)*span/n,drop=Math.sin((i+.5)/n*Math.PI)*.14,top=y-drop;
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([x-.12,top,z,x+.12,top,z,x+.035,top-.32,z+.035],3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,1,1,.5,0],2));g.computeVertexNormals();batch(tintGeometry(g,palette[i%3]),M.ribbon);
    }
  }

  // Soft, woven carpets. Their height is 8–19 mm above the underlying mats,
  // well below the physical walking floor, without coplanar flicker.
  function rugTexture(title,subtitle,welcome=false){
    const c=document.createElement('canvas');c.width=1536;c.height=1024;const q=c.getContext('2d');
    const g=q.createLinearGradient(0,0,1536,1024);g.addColorStop(0,'#e7afc1');g.addColorStop(1,'#cb8fa8');q.fillStyle=g;q.fillRect(0,0,1536,1024);
    for(let y=0;y<1024;y+=3){q.strokeStyle=y%2?'rgba(255,239,229,.11)':'rgba(105,53,79,.12)';q.lineWidth=1;q.beginPath();q.moveTo(0,y);q.lineTo(1536,y);q.stroke();}
    for(let x=0;x<1536;x+=4){q.fillStyle=x%3?'rgba(255,242,231,.055)':'rgba(109,57,82,.065)';q.fillRect(x,0,1,1024);}
    for(const inset of [34,49,73]){q.strokeStyle=inset===49?'#a9718b':'#f7d7ce';q.lineWidth=inset===49?4:8;q.strokeRect(inset,inset,1536-inset*2,1024-inset*2);}
    q.fillStyle='#fff0dd';q.textAlign='center';q.textBaseline='middle';q.font=`600 ${welcome?140:126}px "Microsoft YaHei",Georgia,serif`;q.fillText(title,768,425,1270);
    q.font='55px "Microsoft YaHei",Georgia,serif';q.fillText(subtitle,768,603,1250);
    for(const x of [250,1286]){q.fillStyle='#f2d6ca';q.beginPath();q.moveTo(x,735);q.bezierCurveTo(x-60,680,x-100,755,x,810);q.bezierCurveTo(x+100,755,x+60,680,x,735);q.fill();}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=16;return t;
  }
  const rugMaps=[rugTexture('生日快乐，Lily','愿新的一岁，甜甜的、暖暖的'),rugTexture('Welcome, Lily','把今天，过成最喜欢的样子',true),rugTexture('愿你一直被爱','HAPPY BIRTHDAY · 2026.10.29')];
  const rugSpecs=[{p:[-1.48,LAYOUT.floor+.021,2.15],w:2.05,h:1.25,map:0,name:'Pink birthday welcome rug inside the door'},
    {p:[-1.57,.574,4.60],w:2.30,h:1.42,map:1,name:'Pink porch welcome rug'},
    {p:[1.45,LAYOUT.upperFloor+.031,-.65],w:2.80,h:2.40,map:2,name:'Rose birthday rug upstairs'}];
  for(const spec of rugSpecs){
    const m=new THREE.MeshStandardMaterial({map:rugMaps[spec.map],bumpMap:rugMaps[spec.map],bumpScale:.0025,roughness:.97,color:0xfff0f5,emissive:0x8b4667,emissiveIntensity:.045});
    m.name=spec.name;const rug=new THREE.Mesh(new THREE.PlaneGeometry(spec.w,spec.h),m);rug.name=spec.name;rug.rotation.x=-Math.PI/2;rug.position.set(...spec.p);rug.receiveShadow=true;group.add(rug);
    // Fine cream tassels are actual geometry, batched with the cream carriers.
    for(const edge of [-1,1])for(let i=0;i<Math.floor(spec.w/.045);i++){
      const x=spec.p[0]-spec.w/2+.025+i*.045,z=spec.p[2]+edge*(spec.h/2+.025);
      batch(new THREE.CylinderGeometry(.002,.002,.049,3),M.cream,[x,spec.p[1]-.001,z],[Math.PI/2,0,(i%3-1)*.06]);
    }
  }
  // The small pool uses a true alpha falloff, never a solid coloured rectangle.
  const glow=document.createElement('canvas');glow.width=glow.height=128;const qc=glow.getContext('2d'),gg=qc.createRadialGradient(64,64,0,64,64,64);gg.addColorStop(0,'rgba(255,221,189,.55)');gg.addColorStop(.32,'rgba(255,184,209,.22)');gg.addColorStop(1,'rgba(255,169,205,0)');qc.fillStyle=gg;qc.fillRect(0,0,128,128);
  const glowTex=new THREE.CanvasTexture(glow),glowMat=new THREE.MeshBasicMaterial({map:glowTex,transparent:true,opacity:.44,depthWrite:false,blending:THREE.AdditiveBlending,color:0xffc8b5,toneMapped:false});
  for(const [x,z,r] of [[-3.10,7.20,1.75],[3.10,7.20,1.85],[0,8.6,3.7],[5.25,10.5,1.65]])batch(new THREE.PlaneGeometry(r*2,r*2),glowMat,[x,terrainHeight(x,z)+.052,z],[-Math.PI/2,0,0]);

  // Three instanced latex batches: all subtle motion is one matrix upload per
  // material and never creates new meshes or WebGL programs while walking.
  const balloonGeo=new THREE.SphereGeometry(1,18,12);
  const balloonMeshes=balloons.map((entries,index)=>{
    const mesh=new THREE.InstancedMesh(balloonGeo,M.pearl[index],entries.length);mesh.name=['Blush pearl balloon weave','Ivory pearl balloon weave','Champagne pearl balloon weave'][index];mesh.castShadow=false;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    entries.forEach((entry,i)=>{d.position.copy(entry.p);d.rotation.set(.04*Math.sin(entry.phase),0,entry.tilt);d.scale.set(entry.radius*.92,entry.radius*1.13,entry.radius*.88);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);});mesh.computeBoundingSphere();group.add(mesh);return mesh;
  });
  // Bulbs are one vertex-coloured instance draw, rather than hundreds of lights.
  const bulbsGeo=new THREE.SphereGeometry(1,7,5),bulbMesh=new THREE.InstancedMesh(bulbsGeo,M.bulbs,bulbs.length);bulbMesh.name='Birthday highlight bulbs · one instanced draw';
  bulbs.forEach((b,i)=>{d.position.copy(b.p);d.rotation.set(0,0,0);d.scale.setScalar(b.r);d.updateMatrix();bulbMesh.setMatrixAt(i,d.matrix);bulbMesh.setColorAt(i,color.set(b.color));});bulbMesh.instanceMatrix.needsUpdate=true;if(bulbMesh.instanceColor)bulbMesh.instanceColor.needsUpdate=true;bulbMesh.computeBoundingSphere();group.add(bulbMesh);
  for(const b of batches.values()){
    const g=mergeGeometries(b.geometries,false);b.geometries.forEach(q=>q.dispose());if(!g)throw new Error('Celebration batch attributes do not match');g.computeBoundingSphere();const m=new THREE.Mesh(g,b.material);m.name='Birthday static surface / light batch';m.castShadow=b.cast;m.receiveShadow=!b.material.isMeshBasicMaterial;group.add(m);
  }
  const gardenLight=new THREE.PointLight(0xffc6a2,13,10,2);gardenLight.name='Celebration balloon and illuminated signs';gardenLight.position.set(1.1,3.5,8.5);gardenLight.userData.lightZone='outdoor';gardenLight.userData.celebrationPriority=4;group.add(gardenLight);
  const rugLight=new THREE.PointLight(0xffd2b8,6,5.3,2);rugLight.name='Birthday pink welcome rug and hands';rugLight.position.set(-1.25,2.65,2.25);rugLight.userData.lightZone='interior';rugLight.userData.celebrationPriority=3;group.add(rugLight);
  group.updateMatrixWorld(true);
  let elapsed=0,phaseClock=-1;
  return {
    group,
    update(time,dt){
      elapsed=Number.isFinite(time)?time:elapsed+Math.min(.1,Math.max(0,dt||0));
      // 12 Hz is enough for a very small tied-balloon sway, without steady
      // matrix traffic for every tree, bulb or rigid sign in the scene.
      const phase=Math.floor(elapsed*12);if(phase===phaseClock)return;phaseClock=phase;
      balloonMeshes.forEach((mesh,index)=>{balloons[index].forEach((entry,i)=>{const amplitude=.006+entry.radius*.018;d.position.copy(entry.p);d.position.x+=Math.sin(elapsed*.65+entry.phase)*amplitude;d.position.z+=Math.sin(elapsed*.49+entry.phase)*amplitude*.7;d.rotation.set(.04*Math.sin(entry.phase),0,entry.tilt+Math.sin(elapsed*.5+entry.phase)*.006);d.scale.set(entry.radius*.92,entry.radius*1.13,entry.radius*.88);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);});mesh.instanceMatrix.needsUpdate=true;});
    },
    getStats(){
      let meshes=0,triangles=0;const materials=new Set(),bounds=new THREE.Box3().setFromObject(group);
      group.traverse(o=>{if(!o.isMesh)return;meshes++;(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});
      return {balloons:balloons.reduce((n,a)=>n+a.length,0),heartBalloonRing:43,highlightBulbs:bulbs.length,signs:4,readableStandingSigns:2,signFaces:signFaces.map(f=>f.userData.signClarity),rugs:3,actualLights:2,shadowLights:0,meshes,materials:materials.size,triangles:Math.round(triangles),noCollisionBodies:true,minimumCentralArchClearance:5.5,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
    }
  };
}
