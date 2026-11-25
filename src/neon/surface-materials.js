import * as THREE from 'three';
import {SURFACE_PROFILES} from './surface-profiles.js';
import {injectFootContactAO} from './foot-contact.js';

// Metre-scaled, deterministic detail survives arbitrary voxel dimensions and
// instancing. The concrete, painted metal and paving keep their authored colors.
// These are runtime surface shaders; the editable Blender mesh stays cubical.
export const SURFACE_NOISE_GLSL = `
float surfHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float surfNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(surfHash(i),surfHash(i+vec2(1.,0.)),f.x),mix(surfHash(i+vec2(0.,1.)),surfHash(i+1.),f.x),f.y);}
float surfaceWater(vec2 p){
  float basin=surfNoise(p*vec2(.27,.19))*.76+surfNoise(p*.83+7.4)*.24;
  return smoothstep(.54,.65,basin);
}`;

export function createSurfaceMaterial(kind,profile=''){
  const pavement=kind==='pavement',metal=kind==='metal';
  if(profile&&(!metal||!Object.hasOwn(SURFACE_PROFILES,profile)))throw new Error('Invalid surface profile '+profile+' for '+kind);
  const finish=profile?SURFACE_PROFILES[profile]:null;
  const material=new THREE.MeshStandardMaterial({roughness:finish?.roughness??(pavement?.91:metal?.57:.86),metalness:finish?.metalness??(pavement?.025:metal?.66:.08)});
  material.name=`Voxel surface / ${kind}${profile?' / '+profile:''}`;
  material.userData.surfaceProfile=profile;
  material.onBeforeCompile=shader=>{
    const varyings='varying vec3 vSurfaceWorld; varying vec3 vSurfaceNormal; varying vec3 vSurfaceLocal; varying vec3 vSurfaceSize; varying vec3 vSurfaceFace;';
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\n${varyings}`)
      .replace('#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
        vSurfaceNormal=inverseTransformDirection(normalize(transformedNormal),viewMatrix);`)
      .replace('#include <project_vertex>',`#include <project_vertex>
        vec4 surfaceVertex=vec4(transformed,1.);
        vSurfaceSize=vec3(1.);
        #ifdef USE_INSTANCING
          surfaceVertex=instanceMatrix*surfaceVertex;
          vSurfaceSize=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
        #endif
        vSurfaceLocal=position*vSurfaceSize;vSurfaceFace=abs(normal);
        vSurfaceWorld=(modelMatrix*surfaceVertex).xyz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\n${varyings}\n${SURFACE_NOISE_GLSL}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec3 face=abs(vSurfaceNormal);
        vec2 surfaceUV=face.y>.5?vSurfaceWorld.xz:face.x>.5?vSurfaceWorld.zy:vSurfaceWorld.xy;
        vec2 localUV=vSurfaceFace.y>.5?vSurfaceLocal.xz:vSurfaceFace.x>.5?vSurfaceLocal.zy:vSurfaceLocal.xy;
        vec2 moduleSize=vSurfaceFace.y>.5?vSurfaceSize.xz:vSurfaceFace.x>.5?vSurfaceSize.zy:vSurfaceSize.xy;
        float surfaceDistance=length(vViewPosition);
        float detailFade=1.-smoothstep(16.,65.,surfaceDistance);
        float grain=surfHash(floor(${metal?'localUV':'surfaceUV'}*31.));
        float stain=surfNoise(${metal?'localUV':'surfaceUV'}*vec2(.63,.18));
        float lowerDirt=(1.-smoothstep(.15,1.9,vSurfaceWorld.y))*(1.-face.y)*(.4+.6*stain);
        float edgeDistance=min(moduleSize.x*.5-abs(localUV.x),moduleSize.y*.5-abs(localUV.y));
        float surfaceEdge=1.-smoothstep(.008,.03,edgeDistance);
        float water=surfaceWater(vSurfaceWorld.xz);
        ${pavement?`
          bool groundFace=face.y>.8&&vSurfaceWorld.y<.5&&vSurfaceSize.x>.8&&vSurfaceSize.z>.8;
          bool asphalt=groundFace&&vSurfaceWorld.y<.08;
          float grit=(grain-.5)*.20*detailFade;
          diffuseColor.rgb*=1.+grit;
          if(asphalt){
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.016,.024,.031),.24);
            diffuseColor.rgb*=mix(.91,1.13,stain)*(1.-water*.16);
            float aggregate=step(.93,grain)*detailFade;
            diffuseColor.rgb+=aggregate*vec3(.008,.009,.010);
          }else if(groundFace){
            vec2 slab=vec2(vSurfaceWorld.x/1.2+mod(floor(vSurfaceWorld.z/.72),2.)*.5,vSurfaceWorld.z/.72);
            vec2 cell=fract(slab),edge=min(cell,1.-cell);
            float joint=1.-smoothstep(.006,.019,min(edge.x,edge.y));
            float slabTint=.91+surfHash(floor(slab))*.17;
            diffuseColor.rgb*=slabTint*(1.-joint*.34*detailFade);
          }
        `:profile==='oxide'?`
          diffuseColor.rgb*=(.89+grain*.15*detailFade)*(.94+stain*.09)*(1.-lowerDirt*.08);
        `:profile==='contactMetal'?`
          float brush=mix(.5,surfHash(floor(localUV*vec2(105.,5.))),detailFade);
          diffuseColor.rgb*=(.98+brush*.04)*(.98+stain*.04)*(1.-lowerDirt*.035);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.22,.25,.25),surfaceEdge*detailFade*.06);
        `:metal?`
          float brush=mix(.5,surfHash(floor(localUV*vec2(105.,5.))),detailFade);
          diffuseColor.rgb*=(.95+brush*.1)*(.91+stain*.13)*(1.-lowerDirt*.18);
          float abrasion=surfaceEdge*step(.63,grain)*detailFade;
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.16,.18),abrasion*.12);
        `:`
          diffuseColor.rgb*=(.96+(grain-.5)*.08*detailFade+stain*.07)*(1.-lowerDirt*.22);
          diffuseColor.rgb*=1.-surfaceEdge*.09*detailFade;
        `}`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        ${profile==='oxide'?'roughnessFactor=clamp(roughnessFactor+(stain-.5)*.08+(grain-.5)*.04*detailFade,.73,.96);':profile==='contactMetal'?'roughnessFactor=clamp(roughnessFactor+(stain-.5)*.10,.28,.55);':profile==='paintedSteel'?'roughnessFactor=clamp(roughnessFactor+(stain-.5)*.16+lowerDirt*.10,.54,.82);':pavement?'roughnessFactor=clamp(roughnessFactor-water*.38*face.y+(grain-.5)*.07*detailFade,.39,1.);':metal?'roughnessFactor=clamp(roughnessFactor+(stain-.5)*.2+lowerDirt*.16,.35,.88);':'roughnessFactor=clamp(roughnessFactor+(stain-.5)*.12,.69,1.);'}`);
    injectFootContactAO(shader,{worldPosition:'vSurfaceWorld',worldNormal:'vSurfaceNormal'});
  };
  material.customProgramCacheKey=()=>`voxel-world-surfaces-v2-${kind}-${profile}-foot-contact-v1`;
  return material;
}
