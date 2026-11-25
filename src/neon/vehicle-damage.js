import * as THREE from 'three';

/** Persistent, local damage to the owned Blender vehicle without modifying shared assets. */
export function createVehicleDamage(vehicle) {
  const surfaces=[];let integrity=100,impacts=0;
  vehicle.traverse(mesh=>{
    if(!mesh.isMesh)return;
    mesh.geometry=mesh.geometry.clone();
    surfaces.push({mesh,position:mesh.geometry.attributes.position.array.slice(),color:mesh.geometry.attributes.color?.array.slice(),emission:mesh.geometry.attributes.voxelEmission?.array.slice()});
  });
  function hit(worldPoint,speed) {
    const magnitude=Math.abs(speed);if(magnitude<3)return false;
    vehicle.updateMatrixWorld(true);
    const strength=Math.min(.38,.035+magnitude*.012);
    integrity=Math.max(0,integrity-Math.max(2,Math.round(magnitude*.9)));impacts++;
    for(const surface of surfaces){
      const {mesh}=surface,point=mesh.worldToLocal(new THREE.Vector3(worldPoint.x,worldPoint.y,worldPoint.z));
      const p=mesh.geometry.attributes.position,c=mesh.geometry.attributes.color,e=mesh.geometry.attributes.voxelEmission;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
        const weight=Math.max(0,1-Math.hypot(x-point.x,(y-point.y)*.5,z-point.z)/2.1);
        if(!weight)continue;
        const inward=new THREE.Vector3(-point.x,0,-point.z).normalize();
        p.setXYZ(i,x+inward.x*weight*strength,y-weight*strength*.35,z+inward.z*weight*strength);
        if(c){const shade=1-weight*.22;c.setXYZ(i,c.getX(i)*shade,c.getY(i)*shade,c.getZ(i)*shade);}
        if(e&&weight>.38)e.setXYZ(i,0,0,0);
      }
      p.needsUpdate=true;if(c)c.needsUpdate=true;if(e)e.needsUpdate=true;
      mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
    }
    return true;
  }
  function reset(){
    integrity=100;impacts=0;
    for(const s of surfaces){
      for(const [attribute,original] of [['position',s.position],['color',s.color],['voxelEmission',s.emission]])if(original){s.mesh.geometry.attributes[attribute].array.set(original);s.mesh.geometry.attributes[attribute].needsUpdate=true;}
      s.mesh.geometry.computeVertexNormals();s.mesh.geometry.computeBoundingSphere();
    }
  }
  return {hit,reset,getState:()=>({integrity,impacts})};
}
