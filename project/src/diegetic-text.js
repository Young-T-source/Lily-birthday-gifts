import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A label has a physical carrier. Its face responds to the same light as the room.
const backs = new Map();
const labelPages=[],labelMaterials=new Map();
function placeLabel(texture,w,h,kind){
  // Keep the source lettering at its authored resolution. The former 512 px
  // cap discarded 50–75% of every room / memory sign before it reached WebGL.
  // Match the physical aspect ratio, and reserve a generous mip-safe gutter.
  const size=2048,pad=12,im=texture.image,iw=im.width,ih=im.height;
  const tw=Math.min(1536,Math.max(256,Math.min(iw,Math.ceil(w*1100)))),th=Math.max(48,Math.round(tw*h/w));
  let page=labelPages[labelPages.length-1];
  if(!page){const c=document.createElement('canvas');c.width=c.height=size;const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=16;page={canvas:c,texture:t,x:pad,y:pad,row:0,index:0};labelPages.push(page);}
  if(page.x+tw+pad>size){page.x=pad;page.y+=page.row+pad*2;page.row=0;}
  if(page.y+th+pad>size){const c=document.createElement('canvas');c.width=c.height=size;const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=16;page={canvas:c,texture:t,x:pad,y:pad,row:0,index:labelPages.length};labelPages.push(page);}
  const {x,y}=page,ctx=page.canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(im,0,0,iw,ih,x,y,tw,th);
  ctx.drawImage(im,0,0,iw,1,x,y-pad,tw,pad);ctx.drawImage(im,0,ih-1,iw,1,x,y+th,tw,pad);
  ctx.drawImage(im,0,0,1,ih,x-pad,y,pad,th);ctx.drawImage(im,iw-1,0,1,ih,x+tw,y,pad,th);
  // Bleed the corners too: trilinear filtering must never sample another label
  // or the transparent black canvas outside its allocation.
  for(const sx of [0,1])for(const sy of [0,1])ctx.drawImage(im,sx?iw-1:0,sy?ih-1:0,1,1,sx?x+tw:x-pad,sy?y+th:y-pad,pad,pad);
  page.x+=tw+pad*2;page.row=Math.max(page.row,th);page.texture.needsUpdate=true;
  page.texture.minFilter=THREE.LinearMipmapLinearFilter;page.texture.magFilter=THREE.LinearFilter;page.texture.generateMipmaps=true;
  const key=page.index+':'+kind;if(!labelMaterials.has(key))labelMaterials.set(key,new THREE.MeshStandardMaterial({map:page.texture,roughness:kind==='paper'?.94:kind==='brass'?.5:.85,metalness:kind==='brass'?.30:0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1}));
  const geometry=new THREE.PlaneGeometry(w*.98,h*.97),uv=geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(x+uv.getX(i)*tw)/size,1-(y+(1-uv.getY(i))*th)/size);
  return {geometry,material:labelMaterials.get(key),sampling:{source:[iw,ih],allocation:[x,y,tw,th],atlasSize:size,gutter:pad,texelsPerMetre:Math.min(tw/w,th/h),aspectError:Math.abs((tw/th)/(w/h)-1)}};
}
function backMaterial(kind) {
  if (!backs.has(kind)) backs.set(kind, new THREE.MeshStandardMaterial({
    color:kind==='brass'?0xa8814a:kind==='wood'?0x694d36:0xeadbc2,
    roughness:kind==='brass'?.42:kind==='wood'?.79:.94, metalness:kind==='brass'?.72:0
  }));
  return backs.get(kind);
}
function carrier(texture,w,h,kind,opts={}) {
  const g=new THREE.Group();g.name=`Physical ${kind} text`;g.userData.diegeticText=true;
  const d=opts.depth??(kind==='paper'?.004:kind==='brass'?.012:.035);
  const backing=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),backMaterial(kind));backing.castShadow=true;backing.receiveShadow=true;g.add(backing);
  const label=placeLabel(texture,w,h,kind),face=new THREE.Mesh(label.geometry,label.material);face._v4TextSource=texture;face.position.z=d/2+.0006;face.receiveShadow=true;face.userData.diegeticText=true;face.userData.noMerge=true;face.userData.textSampling=label.sampling;g.add(face);
  g.userData.textFace=face;
  if(opts.frame){
    const r=Math.min(.018,w*.025,h*.04),m=backMaterial(opts.frame==='brass'?'brass':'wood');
    for(const x of [-1,1]){const b=new THREE.Mesh(new THREE.BoxGeometry(r,h+r,d+.012),m);b.position.x=x*(w/2);g.add(b);}
    for(const y of [-1,1]){const b=new THREE.Mesh(new THREE.BoxGeometry(w+r,r,d+.012),m);b.position.y=y*(h/2);g.add(b);}
  }
  return g;
}
export const paperCard=(texture,w,h,opts={})=>carrier(texture,w,h,'paper',opts);
export const brassPlate=(texture,w,h,opts={})=>carrier(texture,w,h,'brass',opts);
export const carvedSign=(texture,w,h,opts={})=>carrier(texture,w,h,'wood',opts);

// Small solid-color props differ in pigment, not in shader structure. Preserve
// their exact linear color and PBR values on vertices, using one lit material.
// Textured wood, translucent glass, cloth sheen and animated materials stay separate.
const surfacePalettes=new Map();
export function shareSurfaceMaterials(root,{exclude=[]}={}){
  const excluded=new Set(exclude),counts={surfaces:0,sourceMaterials:new Set()};
  root.traverse(o=>{
    const m=o.material,g=o.geometry;
    if(!o.isMesh||o.isSkinnedMesh||o.isInstancedMesh||!g||!m||Array.isArray(m)||o._v4SourceMaterial||excluded.has(m)||m.userData.independentAnimation)return;
    const basic=m.type==='MeshBasicMaterial',standard=m.type==='MeshStandardMaterial';
    if(!basic&&!standard)return;
    if(standard&&(m.transparent||m.map||m.normalMap||m.roughnessMap||m.metalnessMap||m.emissiveMap||m.aoMap||m.bumpMap||m.alphaMap||m.displacementMap||m.envMap))return;
    if(basic&&(m.alphaMap||m.envMap))return;
    if(Object.prototype.hasOwnProperty.call(m,'onBeforeCompile'))return;
    const key=[m.type,m.side,m.transparent,m.depthWrite,m.depthTest,m.visible,m.blending,m.blendSrc,m.blendDst,m.blendEquation,m.alphaTest,m.polygonOffset,m.polygonOffsetFactor,m.polygonOffsetUnits,m.flatShading,m.fog,m.toneMapped,basic?m.map?.uuid:'',m.envMapIntensity].join('|');
    if(!surfacePalettes.has(key)){
      const shared=basic?new THREE.MeshBasicMaterial():new THREE.MeshStandardMaterial();
      for(const k of ['side','transparent','depthWrite','depthTest','visible','blending','blendSrc','blendDst','blendEquation','alphaTest','polygonOffset','polygonOffsetFactor','polygonOffsetUnits','flatShading','fog','toneMapped','envMapIntensity'])if(k in m)shared[k]=m[k];
      shared.name=basic?'Shared light / contact surface palette':'Shared exact PBR surface palette';shared.userData.surfacePalette=true;shared.vertexColors=true;shared.color.set(0xffffff);shared.opacity=1;
      if(basic)shared.map=m.map;
      else{
        shared.roughness=.7;shared.metalness=0;
        shared.onBeforeCompile=shader=>{
          shader.vertexShader='attribute vec2 surfaceParams; attribute vec3 surfaceEmission; varying vec2 vSurfaceParams; varying vec3 vSurfaceEmission;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceParams=surfaceParams;vSurfaceEmission=surfaceEmission;');
          shader.fragmentShader='varying vec2 vSurfaceParams; varying vec3 vSurfaceEmission;\n'+shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=vSurfaceParams.x;').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=vSurfaceParams.y;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vSurfaceEmission;');
        };
        shared.customProgramCacheKey=()=> 'exact-vertex-surface-palette-v4';
      }
      surfacePalettes.set(key,shared);
    }
    const geometry=g.clone(),n=g.attributes.position.count,oldColor=g.getAttribute('color'),colors=new Float32Array(n*(basic?4:3)),params=standard?new Float32Array(n*2):null,emission=standard?new Float32Array(n*3):null;
    for(let i=0;i<n;i++){
      const stride=basic?4:3;colors[i*stride]=m.color.r*(m.vertexColors&&oldColor?oldColor.getX(i):1);colors[i*stride+1]=m.color.g*(m.vertexColors&&oldColor?oldColor.getY(i):1);colors[i*stride+2]=m.color.b*(m.vertexColors&&oldColor?oldColor.getZ(i):1);
      if(basic)colors[i*4+3]=m.opacity*(m.vertexColors&&oldColor?.itemSize===4?oldColor.getW(i):1);
      else{params[i*2]=m.roughness;params[i*2+1]=m.metalness;emission[i*3]=m.emissive.r*m.emissiveIntensity;emission[i*3+1]=m.emissive.g*m.emissiveIntensity;emission[i*3+2]=m.emissive.b*m.emissiveIntensity;}
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,basic?4:3));
    if(standard){geometry.setAttribute('surfaceParams',new THREE.BufferAttribute(params,2));geometry.setAttribute('surfaceEmission',new THREE.BufferAttribute(emission,3));}
    // Kept outside userData so GLTF extras do not serialize resource graphs.
    o._v4SourceMaterial=m;o._v4SourceGeometry=g;o.geometry=geometry;o.material=surfacePalettes.get(key);counts.surfaces++;counts.sourceMaterials.add(m);
  });
  return {surfaces:counts.surfaces,sourceMaterials:counts.sourceMaterials.size};
}
// Blender/GLTF archiving may restore the original per-object material channels.
export function rebatchSharedSurfaces(parent){
  let ancestor=parent;while(ancestor){if(ancestor.userData.dynamic||ancestor.userData.noMerge)return {before:0,after:0,saved:0};ancestor=ancestor.parent;}
  const buckets=new Map();let before=0;
  for(const o of parent.children){
    if(!o.isMesh||o.isSkinnedMesh||o.isInstancedMesh||!o.userData.staticPaletteBatch||o.userData.noMerge||o.userData.diegeticText||!o.material?.userData.surfacePalette||!o._v4SourceMaterial)continue;
    const attrs=Object.entries(o.geometry.attributes).map(([k,a])=>k+':'+a.itemSize+':'+a.normalized).sort().join(',');
    const key=[o.material.uuid,o.castShadow,o.receiveShadow,o.renderOrder,o.visible,o.layers.mask,attrs].join('|');
    if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);before++;
  }
  let after=0;
  for(const objects of buckets.values()){
    if(objects.length<2){after++;continue;}
    const geos=[],originals=[];let vertexOffset=0;
    for(const o of objects){o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);g.clearGroups();geos.push(g);
      const source=o._v4SourceGeometry.index?o._v4SourceGeometry.toNonIndexed():o._v4SourceGeometry.clone();source.applyMatrix4(o.matrix);source.clearGroups();
      originals.push({geometry:source,material:o._v4SourceMaterial,vertexOffset,vertexCount:g.attributes.position.count});vertexOffset+=g.attributes.position.count;
    }
    const geometry=mergeGeometries(geos,false);if(!geometry){after+=objects.length;geos.forEach(g=>g.dispose());originals.forEach(q=>q.geometry.dispose());continue;}
    geometry.computeBoundingSphere();const first=objects[0],mesh=new THREE.Mesh(geometry,first.material);mesh.name='Static shared-surface batch';mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.renderOrder=first.renderOrder;mesh.visible=first.visible;mesh.layers.mask=first.layers.mask;mesh.userData.staticPaletteBatch=true;mesh._v4SourceBatches=originals;
    objects.forEach(o=>o.removeFromParent());parent.add(mesh);geos.forEach(g=>g.dispose());after++;
  }
  return {before,after,saved:before-after};
}
export function restoreSourceMaterials(root){
  const objects=[];root.traverse(o=>objects.push(o));
  for(const o of objects){
    if(o._v4SourceBatches){const parent=o.parent;if(!parent)continue;for(const q of o._v4SourceBatches){const mesh=new THREE.Mesh(q.geometry,q.material);mesh.name='Original archived prop surface';mesh.castShadow=o.castShadow;mesh.receiveShadow=o.receiveShadow;parent.add(mesh);}o.removeFromParent();}
    else if(o._v4SourceMaterial){o.material=o._v4SourceMaterial;o.geometry=o._v4SourceGeometry;}
  }
}

let aoTexture;const aoMaterials=new Map();
export const interactionMaterial=new THREE.MeshBasicMaterial({visible:false,transparent:true,opacity:0,depthWrite:false});
export function contactShadow(parent,x,y,z,rx,rz,opacity=.22){
  if(!aoTexture){const c=document.createElement('canvas');c.width=c.height=128;const q=c.getContext('2d'),g=q.createRadialGradient(64,64,4,64,64,64);g.addColorStop(0,'rgba(0,0,0,.76)');g.addColorStop(.48,'rgba(0,0,0,.34)');g.addColorStop(1,'rgba(0,0,0,0)');q.fillStyle=g;q.fillRect(0,0,128,128);aoTexture=new THREE.CanvasTexture(c);}
  if(!aoMaterials.has(opacity))aoMaterials.set(opacity,new THREE.MeshBasicMaterial({map:aoTexture,color:0x19202c,transparent:true,opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
  const m=new THREE.Mesh(new THREE.PlaneGeometry(rx*2,rz*2),aoMaterials.get(opacity));m.name='Soft contact shadow';m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.userData.noMerge=true;parent.add(m);return m;
}

// Original small watercolor studies; intentionally no invented private portrait.
export function memoryWatercolor(index=0){
  const c=document.createElement('canvas');c.width=480;c.height=640;const q=c.getContext('2d');
  let seed=1029+index*73;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const palettes=[['#ded2c2','#a8b4b4','#657d79'],['#e8d4c6','#c3a5a2','#786c75'],['#d8dce1','#8c9ea8','#526873']];const p=palettes[index%3];
  q.fillStyle='#f4ead9';q.fillRect(0,0,480,640);
  for(let i=0;i<110;i++){q.fillStyle=p[i%3];q.globalAlpha=.018+rand()*.04;q.beginPath();q.ellipse(rand()*480,rand()*520,55+rand()*170,30+rand()*90,rand()*2,0,Math.PI*2);q.fill();}
  q.globalAlpha=1;q.fillStyle='#eee6d5';q.beginPath();q.moveTo(0,440);q.quadraticCurveTo(230,385,480,445);q.lineTo(480,640);q.lineTo(0,640);q.fill();
  for(let i=0;i<14;i++){const x=rand()*480,y=350+rand()*120,h=55+rand()*150;q.globalAlpha=.16+rand()*.22;q.fillStyle=p[2];q.beginPath();q.moveTo(x,y-h);q.lineTo(x-h*.29,y);q.lineTo(x+h*.29,y);q.closePath();q.fill();}
  q.globalAlpha=.84;q.fillStyle=index===1?'#785b67':'#536570';
  for(const [x,h] of [[216,78],[264,72]]){q.beginPath();q.arc(x,458-h,9,0,Math.PI*2);q.fill();q.beginPath();q.moveTo(x-7,469-h);q.lineTo(x-14,450);q.lineTo(x+14,450);q.lineTo(x+7,469-h);q.closePath();q.fill();q.fillRect(x-9,446,5,20);q.fillRect(x+4,446,5,20);}
  q.strokeStyle='#6d6268';q.lineWidth=4;q.beginPath();q.moveTo(226,423);q.lineTo(253,423);q.stroke();
  q.globalAlpha=.16;for(let i=0;i<3000;i++){q.fillStyle=rand()>.5?'#fffaf1':'#958a78';q.fillRect(rand()*480,rand()*640,rand()*2+1,1);}q.globalAlpha=1;
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
