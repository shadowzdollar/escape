import { createWorldAudio, WORLD_AUDIO_LIMITS } from './world-audio.js';

// Procedural synthesis only: no recorded voices, music or external samples.
export function createAudio() {
  let ctx,master,limiter,output,world,enabled=false,disposed=false;
  let latest={playing:false,position:{x:0,y:1.75,z:0},yaw:0,pitch:0};
  let motorSpeed=0,motorDriving=false,serial=0,peakShots=0,dropped=0;
  const voices=new Set(),history=[],counts={},buffers=new Map();
  const remember=(kind,details={})=>{counts[kind]=(counts[kind]||0)+1;history.push({id:++serial,kind,time:ctx?.currentTime||0,...details});if(history.length>WORLD_AUDIO_LIMITS.history)history.shift();};
  function noiseBuffer(){
    if(buffers.has('transient'))return buffers.get('transient');
    const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.65),ctx.sampleRate),data=buffer.getChannelData(0);let seed=78131;
    for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
    buffers.set('transient',buffer);return buffer;
  }
  function init(){
    if(ctx||disposed)return;const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AudioContext)return;
    ctx=new AudioContext();master=ctx.createGain();master.gain.value=0;
    limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=3;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.16;
    output=ctx.createGain();output.gain.value=.75;master.connect(limiter);limiter.connect(output);output.connect(ctx.destination);
    world=createWorldAudio({context:ctx,bus:master,onLocomotion:locomotion});
  }
  function voice({type='sine',frequency=220,end=80,duration=.13,volume=.1,noise=false,filter=1600,delay=0}){
    if(!enabled||!ctx||disposed||!latest.playing)return false;
    if(voices.size>=WORLD_AUDIO_LIMITS.oneShots){dropped++;return false;}
    const source=noise?ctx.createBufferSource():ctx.createOscillator(),gain=ctx.createGain(),nodes=[source,gain],now=ctx.currentTime+delay;
    if(noise){source.buffer=noiseBuffer();const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=filter;source.connect(low);low.connect(gain);nodes.push(low);}
    else{source.type=type;source.frequency.setValueAtTime(frequency,now);source.frequency.exponentialRampToValueAtTime(Math.max(15,end),now+duration);source.connect(gain);}
    gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.setValueAtTime(.00001,now);gain.gain.linearRampToValueAtTime(Math.min(.3,volume),now+.003);gain.gain.exponentialRampToValueAtTime(.00001,now+duration);gain.connect(master);
    const record={source,nodes,end:now+duration+.025};voices.add(record);peakShots=Math.max(peakShots,voices.size);
    source.onended=()=>{for(const node of nodes)node.disconnect();voices.delete(record);};source.start(now);source.stop(record.end);return true;
  }
  function stopVoices(){for(const v of [...voices]){try{v.source.stop();}catch{}for(const n of v.nodes)n.disconnect();voices.delete(v);}}
  function locomotion(event){
    if(event.type==='step'){
      const hard=event.surface==='paver',variation=1+Math.sin(serial*2.399)*.065;
      voice({noise:true,filter:hard?3300:1250,duration:hard?.065:.115,volume:(hard?.125:.105)*variation});
      voice({frequency:hard?190:108,end:hard?82:48,duration:hard?.075:.11,volume:hard?.095:.08});
      remember('footstep',{surface:event.surface,distance:event.distance,side:event.side,position:event.position});
    }else{
      voice({noise:true,filter:900,duration:.15,volume:.08+event.strength*.04});voice({frequency:78,end:30,duration:.19,volume:.09+event.strength*.035});
      remember('landing',{surface:event.surface,airTime:event.airTime,position:event.position});
    }
  }
  function effect(kind,fn){if(!enabled||!ctx||!latest.playing||disposed)return;fn();remember(kind);}
  return{
    async toggle(){init();if(!ctx||disposed)return false;enabled=!enabled;if(enabled&&ctx.state==='suspended')await ctx.resume();master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(enabled?.55:0,ctx.currentTime,.025);if(!enabled)stopVoices();world.update(0,{...latest,distanceMoved:0,enabled});return enabled;},
    get enabled(){return enabled},
    update(dt,state={}){const wasPlaying=latest.playing;latest={...latest,...state};if(state.speed===undefined)latest.speed=motorSpeed;if(state.inVehicle===undefined)latest.inVehicle=motorDriving;if(wasPlaying&&!latest.playing)stopVoices();world?.update(dt,{...latest,enabled});},
    shot(){effect('shot',()=>{voice({type:'sawtooth',frequency:170,end:35,duration:.13,volume:.20});voice({noise:true,filter:3400,duration:.075,volume:.13});voice({type:'square',frequency:1000,end:210,duration:.055,volume:.022});});},
    hit(){effect('hit',()=>voice({type:'triangle',frequency:550,end:800,duration:.05,volume:.14}));},
    emp(){effect('emp',()=>voice({type:'sawtooth',frequency:55,end:1200,duration:.8,volume:.2}));},
    hack(){effect('hack',()=>{for(let i=0;i<4;i++)voice({frequency:300+i*160,end:400+i*200,duration:.22,volume:.075,delay:i*.13});});},
    damage(){effect('damage',()=>voice({type:'triangle',frequency:70,end:30,duration:.3,volume:.19}));},
    reload(){effect('reload',()=>{voice({noise:true,filter:4100,duration:.045,volume:.07});voice({type:'square',frequency:800,end:300,duration:.075,volume:.045});});},
    motor(speed,driving){motorSpeed=Number.isFinite(speed)?speed:0;motorDriving=Boolean(driving);world?.setMotor(motorSpeed,motorDriving);},
    getState(){const worldState=world?.getState()||null;return{origin:'procedural Web Audio synthesis; no recorded voices or sampled music',initialized:Boolean(ctx),disposed,enabled,playing:Boolean(latest.playing),contextState:ctx?.state||'uninitialized',time:ctx?.currentTime||0,oneShots:{active:voices.size,peak:peakShots,limit:WORLD_AUDIO_LIMITS.oneShots,dropped},counts:{...counts},events:history.map(e=>({...e})),output:{masterTarget:enabled?.55:0,limiterThreshold:-12,limiterRatio:20,limiterReduction:limiter?.reduction||0},world:worldState,nodeCount:disposed?0:(ctx?3:0)+(worldState?.nodeCount||0)+[...voices].reduce((n,v)=>n+v.nodes.length,0)};},
    async dispose(){if(disposed)return;disposed=true;enabled=false;stopVoices();world?.dispose();master?.disconnect();limiter?.disconnect();output?.disconnect();if(ctx&&ctx.state!=='closed')await ctx.close();buffers.clear();}
  };
}
