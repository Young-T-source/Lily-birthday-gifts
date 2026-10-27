import * as THREE from 'three';
import { HAND_MESH } from './hand-mesh-data.js';

// Original sculpt + skeletal articulation. Motion is target-driven, as in a FPS
// interaction viewmodel: wrist approaches first, fingers settle at contact, then
// release before the elbow returns. Reference notes: assets/HAND_REFERENCES.txt.
export const TOUCH_DURATION = 4.8;
export const TOUCH_CONTACT_TIME = 1.72;
const V = THREE.Vector3;
const clamp = THREE.MathUtils.clamp;
const smoother = t => { t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10); };
const phase = (t,a,b) => smoother((t-a)/(b-a));

function unpack(text, Type) {
  const str=atob(text),bytes=new Uint8Array(str.length);
  for(let i=0;i<str.length;i++)bytes[i]=str.charCodeAt(i);
  return new Type(bytes.buffer);
}

function continuousGeometry() {
  const g=new THREE.BufferGeometry();
  const decode=(encoded,size)=>{const raw=unpack(encoded.data,Uint16Array),out=new Float32Array(raw.length);
    for(let i=0;i<raw.length;i++)out[i]=encoded.min[i%size]+raw[i]*encoded.scale[i%size];return out;};
  g.setAttribute('position',new THREE.BufferAttribute(decode(HAND_MESH.positions,3),3));
  g.setAttribute('uv',new THREE.BufferAttribute(decode(HAND_MESH.uv,2),2));
  for(const [name,size,Type,normalized] of [
    ['normal',3,Int16Array,true],['color',3,Uint8Array,true],
    ['skinIndex',4,Uint8Array,false],['skinWeight',4,Uint8Array,true]
  ])g.setAttribute(name,new THREE.BufferAttribute(unpack(HAND_MESH[{normal:'normals',color:'colors'}[name]||name],Type),size,normalized));
  g.setIndex(new THREE.BufferAttribute(unpack(HAND_MESH.indices,Uint16Array),1));
  g.computeBoundingSphere();
  return g;
}

function mirroredGeometry(source) {
  // Explicitly mirror vertices and winding. A negative-scale ancestor of a
  // skinned mesh makes some GLTF/Blender skin exporters reverse joint flexion.
  const g=source.clone();
  for(const name of ['position','normal']){
    const a=g.getAttribute(name);for(let i=0;i<a.count;i++)a.setX(i,-a.getX(i));a.needsUpdate=true;
  }
  const index=g.index.array;
  for(let i=0;i<index.length;i+=3){const temp=index[i+1];index[i+1]=index[i+2];index[i+2]=temp;}
  g.computeBoundingSphere();return g;
}

function textures() {
  const c=document.createElement('canvas');c.width=c.height=256;
  const ctx=c.getContext('2d'),data=ctx.createImageData(256,256);
  let seed=10629;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<data.data.length;i+=4){const n=(random()-.5)*5;
    data.data[i]=245+n;data.data[i+1]=228+n;data.data[i+2]=219+n;data.data[i+3]=255;}
  ctx.putImageData(data,0,0);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;
  const poresCanvas=document.createElement('canvas');poresCanvas.width=poresCanvas.height=256;
  const pc=poresCanvas.getContext('2d'),poresData=pc.createImageData(256,256);
  for(let i=0;i<poresData.data.length;i+=4){const value=128+(random()-.5)*35;
    poresData.data[i]=poresData.data[i+1]=poresData.data[i+2]=value;poresData.data[i+3]=255;}
  pc.putImageData(poresData,0,0);const pores=new THREE.CanvasTexture(poresCanvas);pores.anisotropy=4;
  const k=document.createElement('canvas');k.width=k.height=128;const kc=k.getContext('2d');
  kc.fillStyle='#aaa4a0';kc.fillRect(0,0,128,128);kc.lineWidth=1;
  for(let y=0;y<128;y+=4)for(let x=0;x<128;x+=4){kc.strokeStyle=(x+y)%8?'#b6b0ac':'#d4ceca';
    kc.beginPath();kc.moveTo(x,y);kc.lineTo(x+2,y+4);kc.lineTo(x+4,y);kc.stroke();}
  const knit=new THREE.CanvasTexture(k);knit.wrapS=knit.wrapT=THREE.RepeatWrapping;knit.repeat.set(5,18);
  return {map,pores,knit};
}

// A continuous sleeve from cuff to shoulder. The shoulder remains behind/below
// the camera and the elbow is solved from arm lengths, so no open cut end appears.
function makeSleeve(material,cuffMaterial) {
  const rows=24,sides=18,positions=new Float32Array((rows+1)*(sides+1)*3),normals=new Float32Array(positions.length),uv=[] ,indices=[];
  for(let row=0;row<=rows;row++)for(let j=0;j<=sides;j++){
    uv.push(j/sides,row/rows);
    if(row<rows&&j<sides){const k=row*(sides+1)+j;indices.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal',new THREE.BufferAttribute(normals,3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);
  const sleeve=new THREE.Mesh(geo,material);sleeve.name='Connected knit sleeve • wrist to hidden shoulder';sleeve.frustumCulled=false;sleeve.receiveShadow=true;
  const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.026,.028,.034,36,6,true),cuffMaterial);
  cuff.name='Soft ribbed cuff';cuff.frustumCulled=false;cuff.receiveShadow=true;
  const ribMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.00045,.00045,.031,5,1),cuffMaterial,32);
  cuff.add(ribMesh);const ribMatrix=new THREE.Matrix4();
  // Narrow woven ribs belong to the cuff, instead of a rigid white wrist ring.
  for(let i=0;i<32;i++){const a=i/32*Math.PI*2;
    ribMatrix.makeTranslation(Math.cos(a)*.027,0,Math.sin(a)*.027);ribMesh.setMatrixAt(i,ribMatrix);}
  const elbow=new V(),axis=new V(),toward=new V(),bend=new V(),p=new V(),tangent=new V(),across=new V(),up=new V(),cuffAxis=new V();
  const a=new V(),b=new V(),c=new V(),d=new V(),ref=new V(0,1,0),shoulder=new V(),bendReference=new V(),tangentMiddle=new V(),tangentEnd=new V(),normal=new V();
  let updates=0;
  function update(wrist,wristQ,side) {
    shoulder.set(side*.245,-.405,.145);
    a.set(0,-.0005,.070).applyQuaternion(wristQ).add(wrist);
    cuffAxis.set(0,0,1).applyQuaternion(wristQ);
    cuff.position.copy(a).addScaledVector(cuffAxis,.009);
    cuff.quaternion.setFromUnitVectors(ref,cuffAxis);
    axis.subVectors(a,shoulder);const distance=axis.length();axis.normalize();
    // Analytic two-bone elbow; modest extension only when a menu places the target
    // a little farther away. The reachable target is clamped by the gesture below.
    const upper=.36,fore=.35,L=Math.min(distance,upper+fore-.002);
    const along=(upper*upper-fore*fore+L*L)/(2*Math.max(.001,L));
    const height=Math.sqrt(Math.max(.001,upper*upper-along*along));
    bendReference.set(side*.65,-1,.05);bend.copy(bendReference).addScaledVector(axis,-bendReference.dot(axis)).normalize();
    elbow.copy(shoulder).addScaledVector(axis,along).addScaledVector(bend,height);
    // Cubic sleeve curve uses the wrist tangent and solved elbow to retain a
    // natural bent arm without visibly segmented cylinders.
    b.copy(a).addScaledVector(cuffAxis,.145);
    c.copy(elbow).lerp(shoulder,.30);d.copy(shoulder);
    for(let row=0;row<=rows;row++){
      const t=row/rows,s=1-t;
      p.copy(a).multiplyScalar(s*s*s).addScaledVector(b,3*s*s*t).addScaledVector(c,3*s*t*t).addScaledVector(d,t*t*t);
      tangent.copy(b).sub(a).multiplyScalar(3*s*s).addScaledVector(tangentMiddle.subVectors(c,b),6*s*t).addScaledVector(tangentEnd.subVectors(d,c),3*t*t).normalize();
      across.crossVectors(tangent,ref).normalize();if(across.lengthSq()<.1)across.set(1,0,0);
      up.crossVectors(across,tangent).normalize();
      const radius=.026+(.051-.026)*Math.pow(t,.65);
      const folds=(Math.sin(t*55+side)*.0016+Math.sin(t*24)*.0020)*Math.sin(Math.PI*t);
      for(let j=0;j<=sides;j++){
        const ang=j/sides*Math.PI*2,wrinkle=folds*(.55+.45*Math.sin(ang+2*t));
        toward.copy(p).addScaledVector(across,Math.cos(ang)*(radius+wrinkle)).addScaledVector(up,Math.sin(ang)*(radius*.88+wrinkle));
        const i=(row*(sides+1)+j)*3;positions[i]=toward.x;positions[i+1]=toward.y;positions[i+2]=toward.z;
        // Analytic swept-ellipse normals follow the limb with no triangle walk
        // and no computeVertexNormals allocation/upload pass every frame.
        normal.copy(across).multiplyScalar(Math.cos(ang)).addScaledVector(up,Math.sin(ang)/.88).normalize();
        normals[i]=normal.x;normals[i+1]=normal.y;normals[i+2]=normal.z;
      }
    }
    geo.attributes.position.needsUpdate=true;geo.attributes.normal.needsUpdate=true;updates++;
  }
  return {sleeve,cuff,update,get updates(){return updates;}};
}

export function createTactileHands() {
  const anchor=new THREE.Group();anchor.name='First-person hands • original sculpt, skeletal fingers and solved sleeves';anchor.visible=false;
  const maps=textures(),geometry=continuousGeometry();
  const skin=new THREE.MeshPhysicalMaterial({color:0xfff7f2,map:maps.map,bumpMap:maps.pores,bumpScale:.00010,vertexColors:true,roughness:.48,
    metalness:0,clearcoat:.025,clearcoatRoughness:.7,sheen:.11,sheenColor:new THREE.Color('#f5d4ca'),sheenRoughness:.85});
  const nails=new THREE.MeshPhysicalMaterial({color:0xf4d6d6,roughness:.27,clearcoat:.4,clearcoatRoughness:.32});
  const fabric=new THREE.MeshStandardMaterial({color:0xe3c4c9,roughness:.94,bumpMap:maps.knit,bumpScale:.0008});
  const cuffMaterial=new THREE.MeshStandardMaterial({color:0xecd7d5,roughness:.94,bumpMap:maps.knit,bumpScale:.0010});
  const rigs=[];
  for(const side of [-1,1]){
    const wrist=new THREE.Group();wrist.name=side<0?'Left wrist / supporting hand':'Right wrist / leading hand';anchor.add(wrist);
    const mirror=new THREE.Group();wrist.add(mirror);
    const bones=HAND_MESH.bones.map((b,i)=>{
      const bone=new THREE.Bone();bone.name=b.name;
      const head=new V(...b.head),parent=b.parent<0?new V():new V(...HAND_MESH.bones[b.parent].head);head.x*=side;parent.x*=side;
      bone.position.copy(head.sub(parent));return bone;
    });
    HAND_MESH.bones.forEach((b,i)=>{if(b.parent>=0)bones[b.parent].add(bones[i]);else mirror.add(bones[i]);});
    const hand=new THREE.SkinnedMesh(side<0?mirroredGeometry(geometry):geometry,skin);hand.name=side<0?'Lily left • connected anatomical skin':'Lily right • connected anatomical skin';
    hand.frustumCulled=false;hand.receiveShadow=true;mirror.add(hand);mirror.updateMatrixWorld(true);
    const skeleton=new THREE.Skeleton(bones);hand.bind(skeleton);
    for(const finger of HAND_MESH.fingers){
      const tipBone=bones[finger.bones[2]],start=HAND_MESH.bones[finger.bones[2]].head,end=HAND_MESH.bones[finger.bones[2]].tail;
      const len=new V(...start).distanceTo(new V(...end)),r=finger.radius*.74;
      const plate=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),nails);
      plate.position.set(side*(end[0]-start[0])*.56,r*.80,-len*.56);
      plate.rotation.x=-.075;plate.scale.set(r*.77,.00065,len*.28);tipBone.add(plate);
    }
    const thumbPlate=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),nails);
    thumbPlate.position.set(-side*.009,.0058,-.013);thumbPlate.rotation.y=side*.61;thumbPlate.scale.set(.005,.00075,.008);bones[14].add(thumbPlate);
    const sleeve=makeSleeve(fabric,cuffMaterial);anchor.add(sleeve.sleeve,sleeve.cuff);
    const tips=[];
    // Only distal finger vertices can be the front surface in these restrained
    // poses. Testing this small support set avoids CPU-skinning the whole hand.
    const hp=hand.geometry.attributes.position,hi=hand.geometry.attributes.skinIndex,hw=hand.geometry.attributes.skinWeight;
    for(let i=0;i<hp.count;i++){
      let distal=0;for(let j=0;j<4;j++)if([3,6,9,12,14].includes(hi.getComponent(i,j)))distal+=hw.getComponent(i,j);
      if(distal>.75)tips.push(i);
    }
    rigs.push({side,wrist,mirror,bones,hand,sleeve,tips,boneMatrices:bones.map(()=>new THREE.Matrix4()),from:new V(),fromQ:new THREE.Quaternion()});
  }
  let playing=false,gestureType='touch',touchCount=0,target=null,lastAge=0,gestureDuration=TOUCH_DURATION,canceling=false,cancelAge=0,cancelCount=0;
  const CANCEL_DURATION=.26;
  const localPoint=new V(),goal=new V(),rest=new V(),control1=new V(),control2=new V(),tip=new V(),front=new V(),desired=new V(),base=new V(),weighted=new V(),curveOffset=new V();
  const restQ=new THREE.Quaternion(),smoothState={};
  function playTouch(point,type='touch',options={}){
    target=point&&Number.isFinite(point.x)?new V(point.x,point.y,point.z):null;
    if(typeof type==='object'){options=type;type=options.gesture||'touch';}
    const requested=typeof options==='number'?options:options?.duration;
    gestureDuration=clamp(Number(requested)||TOUCH_DURATION,2.8,12);
    gestureType=String(type);playing=true;canceling=false;cancelAge=0;touchCount++;lastAge=0;
    // No appearance at a stale last-contact pose: park both wrists below the
    // lower frustum before the first visible update.
    for(const r of rigs){r.wrist.position.set(r.side*.25,-1.02,-.25);r.wrist.rotation.set(0,0,0);r.sleeve.update(r.wrist.position,r.wrist.quaternion,r.side);}
    anchor.visible=false;return gestureDuration;
  }
  function cancel(){
    if(!playing||canceling)return canceling;
    canceling=true;cancelAge=0;cancelCount++;
    for(const r of rigs){r.from.copy(r.wrist.position);r.fromQ.copy(r.wrist.quaternion);}
    return true;
  }
  function animate(age,camera,state){
    anchor.position.copy(camera.position);anchor.quaternion.copy(camera.quaternion);anchor.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    if(target)localPoint.copy(target).applyMatrix4(camera.matrixWorldInverse);else localPoint.set(0,-.16,-.7);
    const open=/open|wardrobe|closet|gift|unwrap/.test(gestureType),tea=/tea|stir/.test(gestureType),clock=/clock/.test(gestureType);
    const releaseStart=Math.max(2.02,gestureDuration-1.88),releaseEnd=gestureDuration-.40;
    for(const r of rigs){
      const {side,wrist,bones,sleeve}=r,lag=side<0?.16:0;
      const a=age-lag;
      const reach=phase(a,.12,1.60),release=phase(a,releaseStart,releaseEnd);
      const contact=phase(a,1.43,1.80)*(1-phase(a,releaseStart-.30,releaseStart+.11));
      const reachWeight=reach*(1-release);
      // A gently extended wrist exposes the back of the slender hand and its
      // fingers, while bringing the fingertips upward to the actual contact.
      // Flat horizontal hands were occluded by their own cuffs in first-person.
      wrist.rotation.set(.10+reachWeight*(clock?.48:.36)+(side<0?.025:0)+contact*.035,
        -side*(.10+.035*reachWeight),side*(.09+.07*reachWeight));
      for(let fi=0;fi<HAND_MESH.fingers.length;fi++){
        const f=HAND_MESH.fingers[fi],delay=fi*.035;
        const grasp=phase(a,1.47+delay,1.91+delay)*(1-phase(a,releaseStart-.32+delay,releaseStart+.18+delay));
        const anticipation=phase(a,.35+delay,1.20+delay)*(1-phase(a,1.44,1.80));
        const leadingIndex=side>0&&fi===0&&(clock||!open&&!tea);
        const baseCurl=.065+fi*.020;
        const strength=open?.46:tea?.34:leadingIndex?.012:clock?.32:.055;
        bones[f.bones[0]].rotation.x=-(baseCurl-anticipation*.035+grasp*strength);
        bones[f.bones[1]].rotation.x=-(.055+fi*.012-anticipation*.020+grasp*(open?.62:tea?.49:leadingIndex?.015:.075));
        bones[f.bones[2]].rotation.x=-(.030+grasp*(open?.28:leadingIndex?.012:.055));
        bones[f.bones[0]].rotation.y=side*(fi-1.3)*.012*(1-contact);
      }
      bones[13].rotation.set(-.055-contact*.14,side*(.02+contact*.10),-side*contact*.06);
      bones[14].rotation.x=-.08-contact*.29;
      // Measure the actual deformed fingertip support surface after joint flexion.
      // The wrist is solved from that surface and the camera-space target, rather
      // than a fixed -0.93m wrist depth. The target is supplied as a physical
      // contact point by the interaction, so clock faces and cake fronts agree.
      wrist.updateMatrixWorld(true);front.set(0,0,Infinity);
      const skeleton=r.hand.skeleton,hp=r.hand.geometry.attributes.position,hi=r.hand.geometry.attributes.skinIndex,hw=r.hand.geometry.attributes.skinWeight;
      for(let i=0;i<bones.length;i++)r.boneMatrices[i].multiplyMatrices(bones[i].matrixWorld,skeleton.boneInverses[i]);
      for(const i of r.tips){base.fromBufferAttribute(hp,i).applyMatrix4(r.hand.bindMatrix);tip.set(0,0,0);
        for(let j=0;j<4;j++){const weight=hw.getComponent(i,j);if(weight)tip.addScaledVector(weighted.copy(base).applyMatrix4(r.boneMatrices[hi.getComponent(i,j)]),weight);}
        tip.applyMatrix4(r.hand.bindMatrixInverse).applyQuaternion(wrist.quaternion);
        if(tip.z<front.z)front.copy(tip);}
      const spread=open?.070:tea?.060:clock?.085:.085;
      desired.copy(localPoint);
      if(side<0){desired.x-=spread;desired.y-=open?.055:.065;desired.z+=.038;}
      // Sub-millimetre clearance keeps skin on the near side of the contact
      // plane; the support hand sits slightly behind the leading fingertips.
      desired.z+=.002;
      goal.copy(desired).sub(front);
      const rawDepth=goal.z;goal.z=clamp(goal.z,-1.48,-.23);
      goal.x=clamp(goal.x,-.48,.48);goal.y=clamp(goal.y,-.66,.30);
      rest.set(side*.255,-1.02,-.24);
      control1.set(side*.29,-.65,-.34);control2.copy(goal).add(curveOffset.set(side*.035,-.045,.11));
      const u=reachWeight,v=1-u;
      wrist.position.copy(rest).multiplyScalar(v*v*v).addScaledVector(control1,3*v*v*u).addScaledVector(control2,3*v*u*u).addScaledVector(goal,u*u*u);
      const settle=(1-phase(a,1.62,2.20))*phase(a,1.48,1.67)*Math.sin((a-1.50)*13)*.0012;
      wrist.position.y+=settle+Math.sin(age*2.7+side)*.0007*contact;
      if(tea&&side>0){wrist.position.x+=Math.cos((a-1.75)*5)*.006*contact;wrist.position.y+=Math.sin((a-1.75)*5)*.006*contact;}
      sleeve.update(wrist.position,wrist.quaternion,side);
      const contactPoint=tip.copy(front).add(wrist.position);
      smoothState[side<0?'left':'right']={reach:+reachWeight.toFixed(4),contact:+contact.toFixed(4),wrist:wrist.position.toArray(),
        targetDepth:localPoint.z,solvedWristDepth:goal.z,depthClamped:Math.abs(rawDepth-goal.z)>.00001,
        contactPoint:contactPoint.toArray(),contactError:contactPoint.distanceTo(desired),nearPlaneClearance:contactPoint.z-localPoint.z};
    }
    lastAge=age;
  }
  return {anchor,playTouch,cancel,contactTime:TOUCH_CONTACT_TIME,get duration(){return gestureDuration;},
    get canceling(){return canceling;},get active(){return playing;},
    get count(){return touchCount;},
    getStats:()=>({age:lastAge,duration:gestureDuration,contactTime:TOUCH_CONTACT_TIME,active:playing,visible:anchor.visible,canceling,cancelAge,cancelDuration:CANCEL_DURATION,cancelCount,
      phase:canceling?'canceling':!playing?'idle':lastAge<.12?'anticipation':lastAge<TOUCH_CONTACT_TIME?'reach':lastAge<Math.max(2.02,gestureDuration-1.88)?'contact':'withdraw',
      topology:'continuous skinned mesh',encoding:HAND_MESH.encoding,verticesPerHand:HAND_MESH.vertexCount,trianglesPerHand:HAND_MESH.triangleCount,jointsPerHand:rigs[0].bones.length,
      sleeveVerticesPerHand:rigs[0].sleeve.sleeve.geometry.attributes.position.count,sleeveNormalMode:'analytic swept ellipse',...smoothState}),
    update(dt,time,camera,state){
      if(!playing){anchor.visible=false;return;}
      // Reading/pausing keeps the visible pose; it cannot erase a chest-opening
      // gesture on the next frame. Cancellation remains responsive when paused.
      const step=clamp(Number(dt)||0,0,.10);
      if(canceling){
        cancelAge+=step;const weight=smoother(cancelAge/CANCEL_DURATION);
        anchor.position.copy(camera.position);anchor.quaternion.copy(camera.quaternion);
        for(const r of rigs){rest.set(r.side*.255,-1.02,-.24);r.wrist.position.lerpVectors(r.from,rest,weight);r.wrist.quaternion.slerpQuaternions(r.fromQ,restQ,weight);r.sleeve.update(r.wrist.position,r.wrist.quaternion,r.side);
          smoothState[r.side<0?'left':'right']={wrist:r.wrist.position.toArray(),reach:null,contact:0,contactPoint:null,contactError:null,nearPlaneClearance:null};}
        if(cancelAge>=CANCEL_DURATION){playing=false;canceling=false;anchor.visible=false;}else anchor.visible=true;
        return;
      }
      if(state.active===false||state.paused)return;
      lastAge+=step;
      if(lastAge>gestureDuration){playing=false;anchor.visible=false;return;}
      animate(lastAge,camera,state);anchor.visible=lastAge>=.12;
    }
  };
}
