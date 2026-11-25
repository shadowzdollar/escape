import * as THREE from 'three';

export const RELOAD_DURATION = 1.65;
const smooth = (a,b,x) => THREE.MathUtils.smoothstep(x,a,b);

/** Animated Blender hierarchy; the exported socket is the only firing origin. */
export function createWeaponRig({source,flashSource,camera,avatar}) {
  const view=new THREE.Group(),held=new THREE.Group();
  view.name='M-09 first-person weapon rig';held.name='M-09 held weapon rig';
  camera.add(view);avatar.add(held);
  const rigs=[view,held].map((root,index)=>{
    const model=source.clone(true);root.add(model);
    const muzzle=model.getObjectByName('muzzle_socket');
    if(!muzzle)throw new Error('Blender carbine is missing muzzle_socket');
    const parts={};for(const name of ['bolt','magazine','trigger']){
      const mesh=model.getObjectByName(name);if(mesh)parts[name]={mesh,position:mesh.position.clone(),rotation:mesh.rotation.clone()};
    }
    const flash=flashSource.clone(true);flash.name='Angular muzzle flash';muzzle.add(flash);flash.visible=false;
    flash.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.depthWrite=false;o.material.toneMapped=false;o.frustumCulled=false;}});
    const lamp=new THREE.PointLight('#8efcff',0,4.5,2);lamp.name='Muzzle flash light';muzzle.add(lamp);
    root.scale.setScalar(index===0?.82:.95);
    root.visible=false;
    model.traverse(o=>{if(o.isMesh){o.frustumCulled=false;
      const shade=material=>{const copy=material.clone();copy.emissiveIntensity*=.30;return copy;};
      // Calibrate the authored neon strips for the game's bloom exposure.
      if(!flash.getObjectById(o.id))o.material=Array.isArray(o.material)?o.material.map(shade):shade(o.material);
    }});
    return {root,model,muzzle,parts,flash,lamp};
  });
  // Voxel gloves stay attached to the grip and fore-end as the weapon recoils.
  const cube=new THREE.BoxGeometry(1,1,1),armor=new THREE.MeshStandardMaterial({color:'#2c3e50',metalness:.55,roughness:.45});
  const edge=new THREE.MeshStandardMaterial({color:'#647b89',metalness:.65,roughness:.38});
  const light=new THREE.MeshStandardMaterial({color:'#34b7cb',emissive:'#22c9e5',emissiveIntensity:.55});
  function block(pos,size,mat,parent=rigs[0].model){const mesh=new THREE.Mesh(cube,mat);mesh.position.set(...pos);mesh.scale.set(...size);mesh.frustumCulled=false;parent.add(mesh);return mesh;}
  const right=block([.055,-.13,.075],[.11,.10,.15],armor);
  const forearm=block([.07,-.24,.26],[.12,.13,.36],armor);forearm.rotation.x=-.30;
  for(let i=0;i<3;i++)block([.115,-.11+i*.025,.02],[.025,.018,.10],edge);
  block([.09,-.17,.24],[.015,.015,.15],light);
  const support=new THREE.Group();support.name='Support glove';rigs[0].model.add(support);
  block([-.04,-.085,-.40],[.13,.09,.14],armor,support);
  const left=block([-.17,-.18,-.21],[.115,.12,.34],armor,support);left.rotation.y=.48;left.rotation.x=-.3;
  for(let i=0;i<3;i++)block([-.075,-.075,-.46+i*.03],[.13,.025,.018],edge,support);
  block([-.17,-.125,-.21],[.035,.012,.13],light,support);
  right.name='Trigger glove';

  let kick=0,kickV=0,pitch=0,pitchV=0,roll=0,rollV=0,age=10,shots=0;
  let swayX=0,swayY=0,oldYaw=0,oldPitch=0,draw=0,reloading=0,current=0,lastContext={};
  function update(dt,context) {
    lastContext=context;
    const {time=0,bob=0,moving=false,lookYaw=0,lookPitch=0,drawn=false,active=false,thirdPerson=false,reloadTime=0}=context;
    current=thirdPerson?1:0;
    if(dt>0){
      age+=dt;
      let remaining=Math.min(dt,.1);while(remaining>0){const h=Math.min(remaining,1/180);remaining-=h;
        kickV+=(-430*kick-30*kickV)*h;kick+=kickV*h;
        pitchV+=(-340*pitch-27*pitchV)*h;pitch+=pitchV*h;
        rollV+=(-300*roll-25*rollV)*h;roll+=rollV*h;
      }
      const deltaYaw=THREE.MathUtils.euclideanModulo(lookYaw-oldYaw+Math.PI,Math.PI*2)-Math.PI;
      swayX=THREE.MathUtils.damp(swayX,THREE.MathUtils.clamp(deltaYaw/dt,-2,2)*-.012,12,dt);
      swayY=THREE.MathUtils.damp(swayY,THREE.MathUtils.clamp((lookPitch-oldPitch)/dt,-2,2)*-.01,12,dt);
      draw=THREE.MathUtils.damp(draw,drawn?1:0,15,dt);
    }
    oldYaw=lookYaw;oldPitch=lookPitch;
    reloading=reloadTime>0?THREE.MathUtils.clamp(1-reloadTime/RELOAD_DURATION,0,1):0;
    const reloadPose=reloadTime>0?smooth(0,.18,reloading)*(1-smooth(.76,1,reloading)):0;
    const magazineTravel=reloadTime>0?smooth(.20,.39,reloading)*(1-smooth(.57,.78,reloading)):0;
    const rack=reloadTime>0?smooth(.75,.81,reloading)*(1-smooth(.84,.94,reloading)):0;
    const step=moving?1:0,breath=Math.sin(time*1.7)*.0025;
    view.position.set(.245+swayX+Math.sin(bob*.5)*.009*step-reloadPose*.04,
      -.27+breath-Math.abs(Math.sin(bob))*.008*step-reloadPose*.105-(1-draw)*.24,
      -.43+kick+reloadPose*.09+(1-draw)*.12);
    view.rotation.set(pitch+swayY-reloadPose*.16-(1-draw)*.28,swayX*.6,-roll-reloadPose*.48+(1-draw)*.24);
    held.position.set(.34,1.25-reloadPose*.10,-.36+kick);
    held.rotation.set(lookPitch+pitch-reloadPose*.15,0,-roll-reloadPose*.22);
    support.position.set(-magazineTravel*.025,-magazineTravel*.22,magazineTravel*.25);
    for(let i=0;i<rigs.length;i++){
      const rig=rigs[i];rig.root.visible=active&&drawn&&current===i;
      const cycle=age<.12?Math.sin(Math.min(1,age/.12)*Math.PI):0;
      if(rig.parts.bolt){const p=rig.parts.bolt;p.mesh.position.copy(p.position);p.mesh.position.z+=(cycle+ rack)*.046;}
      if(rig.parts.magazine){const p=rig.parts.magazine;p.mesh.position.copy(p.position);p.mesh.position.y-=magazineTravel*.24;p.mesh.position.z+=magazineTravel*.06;p.mesh.rotation.copy(p.rotation);p.mesh.rotation.x-=magazineTravel*.15;}
      if(rig.parts.trigger){const p=rig.parts.trigger;p.mesh.rotation.copy(p.rotation);p.mesh.rotation.x-=Math.exp(-age*38)*.20;}
      rig.flash.visible=rig.root.visible&&age<.045;
      rig.flash.scale.setScalar(.85+Math.exp(-age*60)*.55);
      rig.flash.rotation.z=shots*2.39996;
      rig.flash.traverse(o=>{if(o.isMesh)o.material.opacity=Math.max(0,1-age/.045);});
      rig.lamp.intensity=rig.root.visible?Math.max(0,1-age/.055)*9:0;
    }
    view.updateWorldMatrix(true,true);held.updateWorldMatrix(true,true);
  }
  function fire(){shots++;age=0;kickV+=1.15;pitchV+=1.5;rollV+=(shots%2?1:-1)*.36;update(0,lastContext);}
  function reset(){kick=kickV=pitch=pitchV=roll=rollV=swayX=swayY=draw=0;age=10;shots=0;update(0,{...lastContext,drawn:false,reloadTime:0});}
  function getMuzzle(target=new THREE.Vector3()){rigs[current].muzzle.getWorldPosition(target);return target;}
  function getState(){const rig=rigs[current];return {source:'Blender pulse-carbine.glb',socket:'muzzle_socket',muzzle:getMuzzle().toArray(),visible:rig.root.visible,view:current?'third-person':'first-person',shots,age,reloading,kick,pitch,flash:rig.flash.visible,
    bolt:rig.parts.bolt?.mesh.position.toArray(),magazine:rig.parts.magazine?.mesh.position.toArray()};}
  return {view,held,update,fire,reset,getMuzzle,getState};
}
