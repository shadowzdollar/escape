export const WORLD_AUDIO_LIMITS=Object.freeze({traffic:6,machinery:6,oneShots:24,history:96});
export const DISTRICT_AUDIO=Object.freeze({
  'Kasumi Ward':{hum:57,air:1150,rain:.065,pulse:1.1,tone:.011},
  'Lantern Market':{hum:74,air:1800,rain:.058,pulse:1.65,tone:.009},
  'Iron Docks':{hum:43,air:580,rain:.070,pulse:.46,tone:.021},
  'Stacktown':{hum:61,air:920,rain:.060,pulse:.72,tone:.012},
  'Meridian East':{hum:98,air:2300,rain:.052,pulse:1.28,tone:.006},
  'Crown Plaza':{hum:82,air:1400,rain:.047,pulse:.58,tone:.008}
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const number=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
export function audioPosition(value){return Array.isArray(value)?{x:number(value[0]),y:number(value[1],1.75),z:number(value[2])}:{x:number(value?.x),y:number(value?.y,1.75),z:number(value?.z)};}
export function listenerPose(position,yaw=0,pitch=0){
  const y=number(yaw),p=clamp(number(pitch),-Math.PI/2,Math.PI/2),s=Math.sin(y),c=Math.cos(y),sp=Math.sin(p),cp=Math.cos(p);
  return{position:audioPosition(position),forward:{x:-s*cp,y:sp,z:-c*cp},up:{x:s*sp,y:cp,z:c*sp}};
}
// Retain close source identities; never manufacture source positions.
export function selectAudioSources(values,position,limit,maxDistance,previousIds=[]){
  const p=audioPosition(position),seen=new Set();
  return (Array.isArray(values)?values:[]).filter(v=>{
    if(!v||v.id===undefined||seen.has(String(v.id))||v.active===false||v.waiting||v.wrecked)return false;
    if(!Number.isFinite(v.x)||!Number.isFinite(v.z))return false;seen.add(String(v.id));return true;
  }).map(v=>({...v,id:String(v.id),y:number(v.y,.8),distance:Math.hypot(v.x-p.x,number(v.y,.8)-p.y,v.z-p.z)}))
    .filter(v=>v.distance<=maxDistance).sort((a,b)=>(a.distance-(previousIds.includes(a.id)?3:0))-(b.distance-(previousIds.includes(b.id)?3:0))||a.id.localeCompare(b.id)).slice(0,limit);
}
export function createLocomotionTracker(){
  let distance=0,totalDistance=0,wasGrounded=null,airTime=0,side=0,steps=0,landings=0;
  return{
    update(dt,state){
      const events=[],active=Boolean(state.playing)&&!state.inVehicle&&state.enabled!==false,grounded=Boolean(state.grounded),time=clamp(number(dt),0,.25),position=audioPosition(state.position);
      if(!active){distance=0;airTime=0;wasGrounded=null;return events;}
      const surface=number(state.groundY)>.09?'paver':'road';
      if(!grounded){airTime+=time;distance=0;wasGrounded=false;return events;}
      if(wasGrounded===false&&airTime>.17){events.push({type:'landing',surface,position,airTime,strength:clamp(airTime,0,1)});landings++;}
      wasGrounded=true;airTime=0;
      const speed=Math.abs(number(state.speed)),moved=Math.max(0,number(state.distanceMoved));
      // No catch-up sounds after pauses or test teleports.
      if(moved>Math.max(4,speed*time*2.5)){distance=0;return events;}
      if(speed<.1||moved<.00001){if(speed<.1)distance=0;return events;}
      distance+=moved;totalDistance+=moved;const stride=clamp(.66+speed*.22,.68,3);
      for(let i=0;i<2&&distance>=stride;i++){distance-=stride;side=1-side;steps++;events.push({type:'step',surface,side,distance:totalDistance-distance,position});}
      return events;
    },
    getState(){return{steps,landings,distanceRemainder:distance,totalDistance,airTime,grounded:wasGrounded};}
  };
}

export function createWorldAudio({context:ctx,bus,onLocomotion=()=>{}}){
  const nodes=[],sources=[],traffic=[],machinery=[],locomotion=createLocomotionTracker();
  let active=false,time=0,district='Kasumi Ward',pose=listenerPose(),motorSpeed=0,motorDriving=false,disposed=false;
  const node=v=>(nodes.push(v),v),source=v=>(sources.push(v),v);
  const gain=(value=0)=>{const v=node(ctx.createGain());v.gain.value=value;return v;};
  const set=(param,value,smoothing=.07)=>{param.cancelScheduledValues(ctx.currentTime);param.setTargetAtTime(value,ctx.currentTime,smoothing);};
  const worldBus=gain();worldBus.connect(bus);
  const buffer=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate),data=buffer.getChannelData(0);let seed=861321;
  for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/2147483648-1)*.65;}
  const rain=source(node(ctx.createBufferSource()));rain.buffer=buffer;rain.loop=true;
  const rainFilter=node(ctx.createBiquadFilter());rainFilter.type='lowpass';rainFilter.frequency.value=1150;
  const rainGain=gain();rain.connect(rainFilter);rainFilter.connect(rainGain);rainGain.connect(worldBus);rain.start();
  const districtTone=source(node(ctx.createOscillator())),districtGain=gain();districtTone.type='sine';districtTone.frequency.value=57;districtTone.connect(districtGain);districtGain.connect(worldBus);districtTone.start();
  const motor=source(node(ctx.createOscillator())),motorFilter=node(ctx.createBiquadFilter()),motorGain=gain();motor.type='sawtooth';motor.frequency.value=34;motorFilter.type='lowpass';motorFilter.frequency.value=420;motor.connect(motorFilter);motorFilter.connect(motorGain);motorGain.connect(worldBus);motor.start();
  function slot(index,type){
    const oscillator=source(node(ctx.createOscillator())),filter=node(ctx.createBiquadFilter()),level=gain(),panner=node(ctx.createPanner());
    oscillator.type=type==='traffic'?'sawtooth':'triangle';oscillator.frequency.value=50;filter.type='lowpass';filter.frequency.value=type==='traffic'?500:800;
    panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=type==='traffic'?3:2;panner.maxDistance=type==='traffic'?75:35;panner.rolloffFactor=1.3;
    oscillator.connect(filter);filter.connect(level);level.connect(panner);panner.connect(worldBus);oscillator.start();
    return{index,type,oscillator,filter,level,panner,id:null,position:null,targetGain:0,frequency:50,distance:null,pending:null,relocateAt:0};
  }
  for(let i=0;i<WORLD_AUDIO_LIMITS.traffic;i++)traffic.push(slot(i,'traffic'));
  for(let i=0;i<WORLD_AUDIO_LIMITS.machinery;i++)machinery.push(slot(i,'machinery'));
  function setPosition(panner,p,at=ctx.currentTime){
    if(panner.positionX){panner.positionX.setValueAtTime(p.x,at);panner.positionY.setValueAtTime(p.y,at);panner.positionZ.setValueAtTime(p.z,at);}
    else panner.setPosition(p.x,p.y,p.z);
  }
  function setListener(){
    const listener=ctx.listener;
    if(listener.positionX){for(const[prefix,v]of[['position',pose.position],['forward',pose.forward],['up',pose.up]])for(const axis of ['x','y','z'])listener[prefix+axis.toUpperCase()].setValueAtTime(v[axis],ctx.currentTime);}
    else{listener.setPosition(pose.position.x,pose.position.y,pose.position.z);listener.setOrientation(pose.forward.x,pose.forward.y,pose.forward.z,pose.up.x,pose.up.y,pose.up.z);}
  }
  function updatePool(pool,values,type,profile){
    const selected=active?selectAudioSources(values,pose.position,pool.length,type==='traffic'?75:35,pool.map(v=>v.id)):[],targets=new Map(selected.map(v=>[v.id,v]));
    for(const s of pool)if(s.id&&targets.has(s.id)){s.pending=targets.get(s.id);targets.delete(s.id);}else s.pending=null;
    for(const s of pool){
      if(!s.pending&&targets.size){const[id,value]=targets.entries().next().value;targets.delete(id);s.pending=value;}
      const target=s.pending;
      if(!target){s.targetGain=0;set(s.level.gain,0,.025);s.id=null;s.position=null;s.distance=null;s.relocateAt=0;continue;}
      const changed=s.id!==target.id,previous=s.position;
      s.id=target.id;s.position={x:target.x,y:target.y+(type==='traffic'?.65:0),z:target.z};s.distance=target.distance;
      const speed=Math.abs(number(target.speed));
      s.frequency=type==='traffic'?(target.type==='bus'?31:target.type==='sport'?47:37)+Math.min(speed,30)*4.4:profile.hum+(s.index%3)*13;
      s.targetGain=type==='traffic'?(target.type==='bus'?.062:.046)*(0.58+Math.min(speed,14)/20):.016+(s.index%3)*.003;
      if(changed){
        // Reposition a reused voice only during its short silent crossover.
        s.relocateAt=ctx.currentTime+(previous?.035:0);s.level.gain.cancelScheduledValues(ctx.currentTime);
        s.level.gain.setValueAtTime(s.level.gain.value,ctx.currentTime);s.level.gain.linearRampToValueAtTime(0,s.relocateAt);
        setPosition(s.panner,s.position,s.relocateAt);s.level.gain.linearRampToValueAtTime(s.targetGain,s.relocateAt+.09);
      }else if(ctx.currentTime>=s.relocateAt+.09){setPosition(s.panner,s.position);set(s.level.gain,s.targetGain,.08);}
      set(s.oscillator.frequency,s.frequency,.12);set(s.filter.frequency,type==='traffic'?240+Math.min(speed,24)*44:profile.air*.62,.2);
    }
  }
  return{
    setMotor(speed,driving){motorSpeed=number(speed);motorDriving=Boolean(driving);},
    update(dt,state={}){
      if(disposed)return;active=Boolean(state.playing)&&Boolean(state.enabled);time+=clamp(number(dt),0,.25);pose=listenerPose(state.position,state.yaw,state.pitch);setListener();
      const name=typeof state.district==='string'?state.district:state.district?.name;if(DISTRICT_AUDIO[name])district=name;
      const profile=DISTRICT_AUDIO[district];set(worldBus.gain,active?1:0,.025);set(rainFilter.frequency,profile.air,.7);set(rainGain.gain,active?profile.rain:0,.5);
      set(districtTone.frequency,profile.hum,.65);set(districtGain.gain,active?profile.tone*(.85+.15*Math.sin(time*profile.pulse)):0,.3);
      const driving=state.inVehicle??motorDriving,speed=Math.abs(number(state.speed,motorSpeed));set(motor.frequency,34+Math.min(speed,40)*4.5,.1);set(motorFilter.frequency,300+Math.min(speed,40)*28,.12);set(motorGain.gain,active&&driving?.065:0,.035);
      updatePool(traffic,state.traffic,'traffic',profile);updatePool(machinery,state.emitters,'machinery',profile);
      for(const event of locomotion.update(dt,{...state,enabled:active}))onLocomotion(event);
    },
    getState(){const summarize=pool=>pool.map(s=>({slot:s.index,id:s.id,position:s.position?{...s.position}:null,distance:s.distance,gain:active?s.targetGain:0,frequency:s.frequency,panningModel:s.panner.panningModel}));return{active,district,profile:{...DISTRICT_AUDIO[district]},listener:{position:{...pose.position},forward:{...pose.forward},up:{...pose.up}},nodeCount:disposed?0:nodes.length,loopSources:disposed?0:sources.length,limits:{traffic:traffic.length,machinery:machinery.length},traffic:summarize(traffic),machinery:summarize(machinery),locomotion:locomotion.getState(),worldGainTarget:active?1:0};},
    dispose(){if(disposed)return;disposed=true;active=false;for(const s of sources){try{s.stop();}catch{}}for(const n of nodes)n.disconnect();}
  };
}
