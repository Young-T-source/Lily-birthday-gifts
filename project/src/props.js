import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PROP_DATA } from './props-data.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { shareSurfaceMaterials, rebatchSharedSurfaces } from './diegetic-text.js';

export async function loadBlenderDetails(scene){
  if(!PROP_DATA)return null;
  const bytes=Uint8Array.from(atob(PROP_DATA),c=>c.charCodeAt(0));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');
  const root=new THREE.Group();root.name='Blender · Handcrafted brass lanterns and tea';
  const put=(name,x,y,z,scale=1,ry=0)=>{
    const original=gltf.scene.getObjectByName(name);
    if(!original)throw new Error('Blender asset missing: '+name);
    const o=original.clone(true);o.name=name+' · placed';o.position.set(x,y,z);o.scale.setScalar(scale);o.rotation.y=ry;
    o.traverse(c=>{if(c.isMesh){c.castShadow=!c.material.transparent;c.receiveShadow=true;}});
    root.add(o);return o;
  };
  // A lantern on the snowy porch, a second beside the hearth, and tea on the table.
  put('Lantern',2.75,.56,5.35,.92,-.3);
  put('Lantern',-1.35,.65,-2.38,.82,.2);
  put('Kettle',4.12,1.592,1.30,.95,-.9);
  put('Mug',3.62,1.56,-3.02,1,.7);
  // These four still lifes contain no moving lids. Merge by shared material,
  // retaining glass as its own surface so transparency can still be sorted.
  root.updateMatrixWorld(true);const buckets=new Map(),remove=[],materialCache=new Map();
  root.traverse(o=>{
    if(!o.isMesh||o.isSkinnedMesh||Array.isArray(o.material)||o.userData.dynamic)return;
    const m=o.material;
    const key=[m.type,m.color?.getHex(),m.roughness,m.metalness,m.opacity,m.transparent,m.side,m.emissive?.getHex(),m.emissiveIntensity,m.map?.uuid||'',m.normalMap?.uuid||''].join('|');
    if(!materialCache.has(key))materialCache.set(key,m);
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrixWorld);g.clearGroups();
    for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);
    if(!g.attributes.normal)g.computeVertexNormals();
    if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(g);remove.push(o);
  });
  remove.forEach(o=>o.removeFromParent());
  for(const [key,geos] of buckets){const g=mergeGeometries(geos,false),m=materialCache.get(key);const mesh=new THREE.Mesh(g,m);mesh.name='Blender still-life material batch';mesh.castShadow=!m.transparent;mesh.receiveShadow=true;mesh.userData.staticPaletteBatch=true;root.add(mesh);geos.forEach(v=>v.dispose());}
  shareSurfaceMaterials(root);
  const staticPaletteBatching=rebatchSharedSurfaces(root);
  scene.add(root);
  const glow=new THREE.PointLight(0xffb56e,1.7,3.4,2);glow.name='Porch lantern reflection';glow.userData.lightZone='outdoor';glow.position.set(2.75,.88,5.35);scene.add(glow);
  return {group:root,source:'Blender 5.2 · hearth_props.glb',count:4,drawBatches:buckets.size-staticPaletteBatching.saved,staticPaletteBatching};
}
