// Metres. Shared by modelling and navigation so invisible blockers cannot drift.
export const LAYOUT = Object.freeze({
  floor: .65, upperFloor: 3.45, bodyRadius: .23, bodyHeight: 1.73,
  stair: {minX:-4.36,maxX:-3.04,minZ:-2.50,maxZ:2.45,steps:18},
  cake: {x:2.65,y:1.45,z:2.40,standY:1.44,radius:.43},
  wardrobe: {x:2.95,y:3.45,z:-2.82}
});
export function stairHeight(x,z){
  const s=LAYOUT.stair;
  if(x<s.minX||x>s.maxX||z<s.minZ||z>s.maxZ)return null;
  const step=Math.min(s.steps,Math.floor((s.maxZ-z)/(s.maxZ-s.minZ)*s.steps)+1);
  return LAYOUT.floor+step/s.steps*(LAYOUT.upperFloor-LAYOUT.floor);
}
export function inUpperFloor(x,z){
  if(x < -4.42 || x > 4.42 || z < -3.20 || z > 3.20)return false;
  const s=LAYOUT.stair;
  return !(x<s.maxX+.035&&x>s.minX-.035&&z>s.minZ&&z<s.maxZ);
}
