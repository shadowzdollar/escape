import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Blender material slots become per-vertex color and emission, so an entire
// detailed vehicle or terminal can be rendered in one draw call.
export function batchVoxelAsset(source,name){
  source.updateMatrixWorld(true);
  const geometries=[];
  source.traverse(object=>{
    if(!object.isMesh)return;
    const original=object.geometry;
    const parts=Array.isArray(object.material)?original.groups:[{start:0,count:original.index?original.index.count:original.attributes.position.count,materialIndex:0}];
    const expanded=original.index?original.toNonIndexed():original.clone();
    for(const part of parts){
      const material=Array.isArray(object.material)?object.material[part.materialIndex]:object.material;
      const count=part.count,geometry=new THREE.BufferGeometry();
      for(const key of ['position','normal']){const attribute=expanded.getAttribute(key);if(attribute){const values=new Float32Array(count*3);for(let i=0;i<count;i++){values[i*3]=attribute.getX(part.start+i);values[i*3+1]=attribute.getY(part.start+i);values[i*3+2]=attribute.getZ(part.start+i)}geometry.setAttribute(key,new THREE.BufferAttribute(values,3))}}
      geometry.applyMatrix4(object.matrixWorld);
      const colors=new Float32Array(count*3),emission=new Float32Array(count*3),c=material.color||new THREE.Color(1,1,1),e=(material.emissive||new THREE.Color()).clone().multiplyScalar(material.emissiveIntensity??1);
      e.multiplyScalar(name==='interceptor'?.48:name==='av'?.35:.8);
      for(let i=0;i<count;i++){c.toArray(colors,i*3);e.toArray(emission,i*3)}
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('voxelEmission',new THREE.BufferAttribute(emission,3));
      if(!geometry.attributes.normal)geometry.computeVertexNormals();geometries.push(geometry);
    }
    expanded.dispose();
  });
  const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
  const material=new THREE.MeshStandardMaterial({vertexColors:true,metalness:.48,roughness:.47});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec3 voxelEmission; varying vec3 vVoxelEmission;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvVoxelEmission = voxelEmission;');
    shader.fragmentShader='varying vec3 vVoxelEmission;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;','vec3 totalEmissiveRadiance = vVoxelEmission;');
  };
  material.customProgramCacheKey=()=> 'blender-voxel-emission-v1';
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;
  return mesh;
}
