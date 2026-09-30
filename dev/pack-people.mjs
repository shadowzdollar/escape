// Optimise the CC0 Quaternius character GLBs: keep the shared animation set in one
// file, strip animations from the rest, weld/dedupe and meshopt-compress geometry.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, draco, resample } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';
const [src, dst] = process.argv.slice(2);
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
  'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule(),
});
const names = fs.readdirSync(src).filter((f) => f.endsWith('.glb'));
for (const f of names) {
  const doc = await io.read(`${src}/${f}`);
  const keepAnims = f === 'business.glb';
  if (!keepAnims) for (const a of doc.getRoot().listAnimations()) a.dispose();
  else for (const a of doc.getRoot().listAnimations()) a.setName(a.getName().replace('CharacterArmature|', ''));
  // Draco decodes back to the original float space (unlike meshopt quantization), so
  // sub-meshes keep one shared bind space and can be merged at runtime.
  await doc.transform(resample(), dedup(), weld(), prune(), draco({ method: 'edgebreaker', quantizePosition: 16, quantizeNormal: 10 }));
  const out = f === 'business.glb' ? 'business.glb' : f;
  await io.write(`${dst}/${out}`, doc);
  console.log(f, (fs.statSync(`${src}/${f}`).size / 1024) | 0, 'KB ->', (fs.statSync(`${dst}/${out}`).size / 1024) | 0, 'KB');
}
