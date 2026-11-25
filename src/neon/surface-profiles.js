// Local industrial finishes. Blender reads these exact base values as well.
// Profile tags apply only to opaque metal pieces; panes and paving keep their
// existing material system even when a shared assembly carries the same tag.
export const SURFACE_PROFILES = Object.freeze({
  paintedSteel:Object.freeze({name:'Faded industrial paint',roughness:.64,metalness:.32,roughnessRange:[.54,.82]}),
  oxide:Object.freeze({name:'Localized oxidation',roughness:.83,metalness:.06,roughnessRange:[.73,.96]}),
  contactMetal:Object.freeze({name:'Exposed working metal',roughness:.4,metalness:.78,roughnessRange:[.28,.55]})
});

export function surfaceProfileFor(box){
  if(box.kind!=='metal'||!box.materialProfile)return '';
  if(!Object.hasOwn(SURFACE_PROFILES,box.materialProfile))throw new Error('Unknown surface profile: '+box.materialProfile);
  return box.materialProfile;
}
