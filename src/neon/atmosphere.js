import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { SURFACE_NOISE_GLSL } from './surface-materials.js';

// Weather and water are real-time scene effects, not a concept-image backdrop.
export function createAtmosphere(scene,renderer,bounds={minX:-60,maxX:60,minZ:-170,maxZ:40},{groundHeightAt=()=>.057}={}){
  const uniforms={time:{value:0},center:{value:new THREE.Vector3(0,0,0)}};
  const sky=new THREE.Mesh(new THREE.SphereGeometry(490,32,20),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,uniforms:{},
    vertexShader:'varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`varying vec3 vDirection; void main(){float h=normalize(vDirection).y;vec3 horizon=vec3(.012,.046,.071);vec3 zenith=vec3(.001,.007,.018);vec3 c=mix(horizon,zenith,smoothstep(0.,.85,h));float cloud=sin(vDirection.x*.035+sin(vDirection.z*.018))*sin(vDirection.y*.061);c+=vec3(.003,.007,.01)*cloud;gl_FragColor=vec4(c,1.);}`
  }));sky.name='Midnight monsoon sky';scene.add(sky);

  const road=new Reflector(new THREE.PlaneGeometry(bounds.maxX-bounds.minX+4,bounds.maxZ-bounds.minZ+4),{clipBias:.004,textureWidth:Math.min(innerWidth,1280),textureHeight:Math.min(innerHeight,900),color:0x76828d,multisample:0});
  road.rotation.x=-Math.PI/2;road.position.set((bounds.minX+bounds.maxX)/2,.057,(bounds.minZ+bounds.maxZ)/2);road.name='Rainwater / isolated street puddles';
  const mat=road.material;mat.transparent=true;mat.depthWrite=false;mat.uniforms.uTime=uniforms.time;
  mat.vertexShader=mat.vertexShader.replace('varying vec4 vUv;','varying vec4 vUv; varying vec3 vWorld;').replace('vUv = textureMatrix * vec4( position, 1.0 );','vUv = textureMatrix * vec4( position, 1.0 );vWorld=(modelMatrix*vec4(position,1.)).xyz;');
  mat.fragmentShader=mat.fragmentShader.replace('varying vec4 vUv;',`varying vec4 vUv; varying vec3 vWorld; uniform float uTime;
    ${SURFACE_NOISE_GLSL}`);
  mat.fragmentShader=mat.fragmentShader.replace('vec4 base = texture2DProj( tDiffuse, vUv );',`
    vec2 q=vUv.xy/vUv.w;
    float wet=surfaceWater(vWorld.xz);
    float grit=surfHash(floor(vWorld.xz*23.));
    float r=surfNoise(vWorld.xz*4.+uTime*.17);
    vec3 eyeToWater=cameraPosition-vWorld;
    float grazing=pow(1.-clamp(eyeToWater.y/max(length(eyeToWater),.001),0.,1.),3.);
    float farFade=1.-smoothstep(90.,230.,length(eyeToWater));
    q+=vec2(sin(vWorld.z*38.+uTime*2.1),cos(vWorld.x*23.-uTime*1.4))*.00028;
    q.x+=(r-.5)*.0014;
    vec3 reflected=texture2D(tDiffuse,q).rgb*.36;
    reflected+=texture2D(tDiffuse,q+vec2(.0018,.001)).rgb*.16;
    reflected+=texture2D(tDiffuse,q+vec2(-.0018,-.001)).rgb*.16;
    reflected+=texture2D(tDiffuse,q+vec2(.003,.0025)).rgb*.10;
    reflected+=texture2D(tDiffuse,q+vec2(-.003,-.0025)).rgb*.10;
    reflected+=texture2D(tDiffuse,q+vec2(0.,.004)).rgb*.12;
    vec4 base=vec4(reflected,1.);
  `).replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );','gl_FragColor = vec4( base.rgb * (.92 + grit * .08), (.018 + wet * (.17 + grazing * .35)) * farFade );');
  scene.add(road);

  const count=6800,vertices=new Float32Array(count*6),data=new Float32Array(count*4);
  let seed=1579;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  for(let i=0;i<count;i++){
    const x=(random()-.5)*160,y=random()*95,z=(random()-.5)*220,speed=17+random()*18;
    for(let j=0;j<2;j++){const k=i*2+j;vertices.set([x,y,z],k*3);data.set([speed,j],k*2)}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(vertices,3));geo.setAttribute('rainData',new THREE.BufferAttribute(data,2));
  const rain=new THREE.LineSegments(geo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms,
    vertexShader:`attribute vec2 rainData;uniform float time;uniform vec3 center;varying float vAlpha;
    void main(){vec3 p=position;p.y=mod(p.y-time*rainData.x,95.);p.xz+=center.xz;p.y+=rainData.y*(.32+rainData.x*.014);p.x+=rainData.y*.06;
    vec4 mv=modelViewMatrix*vec4(p,1.);vAlpha=clamp(1.-length(mv.xyz)/150.,0.,1.)*(.16+rainData.x*.003);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying float vAlpha;void main(){gl_FragColor=vec4(.31,.59,.76,vAlpha);}`
  }));rain.frustumCulled=false;rain.name='Monsoon / 6800 animated rain streaks';scene.add(rain);

  // Depth-tested soft vapor sheets: street steam and the illuminated city haze.
  const vapor=[];
  function fogSheet(x,y,z,w,h,c,opacity,phase){
    const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:uniforms.time,tint:{value:new THREE.Color(c)},opacity:{value:opacity},phase:{value:phase}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform float time,opacity,phase;uniform vec3 tint;
      float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      // Clipped reflection views can interpolate slightly outside the sheet's
      // UV range. A fractional power of a negative edge poisons the HDR image
      // and spreads into a large black region through the bloom passes.
      void main(){vec2 q=vUv*vec2(5.,4.)+vec2(time*.022,phase-time*.075);float f=n(q)*.5+n(q*2.3)*.25+n(q*4.2)*.125;float edge=pow(max(0.,sin(vUv.x*3.14159)*sin(vUv.y*3.14159)),1.5);gl_FragColor=vec4(tint,edge*f*opacity);}`
    });const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);mesh.position.set(x,y,z);scene.add(mesh);vapor.push(mesh);
  }
  for(let i=0;i<7;i++)fogSheet(0,12+i*3,-12-i*36,75+i*4,30+i*4,i%2?'#2781b8':'#205c87',.12,i*3.3);
  for(let i=0;i<9;i++)fogSheet((i%2?-1:1)*10.8,1.8,20-i*20,5,4.5,'#87bfc5',.25,i*6.1);

  const splashCount=180,dummy=new THREE.Object3D(),splashGeo=new THREE.RingGeometry(.76,1,8);
  const splashes=new THREE.InstancedMesh(splashGeo,new THREE.MeshBasicMaterial({color:'#81b9d0',transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}),splashCount);
  const splashSeeds=Array.from({length:splashCount},()=>({x:(random()-.5)*24,z:(random()-.5)*85,t:random(),ground:.057}));scene.add(splashes);splashes.frustumCulled=false;
  return {road,update(dt,time,playerPosition){
    uniforms.time.value=time;uniforms.center.value.copy(playerPosition);sky.position.copy(playerPosition);
    for(let i=0;i<splashCount;i++){const s=splashSeeds[i],t=(time*.8+s.t)%1,x=s.x+playerPosition.x,z=s.z+playerPosition.z;s.ground=groundHeightAt(x,z);dummy.position.set(x,s.ground+.014,z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.setScalar(t*.11);dummy.updateMatrix();splashes.setMatrixAt(i,dummy.matrix)}splashes.instanceMatrix.needsUpdate=true;
  }};
}
