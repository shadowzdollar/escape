// Pack the CC0 Quaternius city/nature models into one compressed kit:
//   node dev/pack-city.mjs <folder with the downloaded .glb files>
// Each model becomes a root node named after it (all transforms baked, primitives
// joined per material). Models with an `lod` ratio also get a simplified copy named
// "<name>__lod1" for distant chunks. Shared textures are deduplicated, resized and
// stored as WebP; geometry is Draco-compressed.
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, join, weld, dedup, prune, draco, simplify, clearNodeTransform, mergeDocuments, textureCompress } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import fs from 'node:fs';

const [src] = process.argv.slice(2);
const OUT = 'public/models/city/kit.glb';

// name: [source file, hi ratio (1 = untouched), lod1 ratio (0 = none), flat]
// flat = untextured faceted model: normals are dropped (the game shades it with flatShading),
// so the simplifier can collapse across the hard edges.
const MODELS = {
  // street / park trees (textured "Stylized Nature MegaKit" family)
  tree0: ['Tree_0', 0.6, 0.2], tree1: ['Tree_1', 0.45, 0.18], tree2: ['Tree_2', 0.55, 0.2], tree3: ['Tree_3', 0.6, 0.2], tree4: ['Tree_4', 0.42, 0.16],
  maple0: ['Twisted_Tree_0', 0.35, 0.15], maple1: ['Twisted_Tree_1', 0.35, 0.15],
  pine0: ['Pine_T1', 0.7, 0.25], pine1: ['Pine_T2', 1, 0.25], pineSnow: ['Pine_Tree_with_Snow_0', 1, 0.35, true],
  palm0: ['Palm_Tree_0', 1, 0.25], palm1: ['Palm_Tree_1', 1, 0.25], palm2: ['Palm_Tree_2', 1, 0.25],
  // shrubs and ground cover
  bushFlowers: ['Bush_with_Flowers_0', 1, 0.4], bush: ['Bush_5', 1, 0], hedge: ['Hedge_0', 0.5, 0.25], bushSnow: ['Bush_Snow_0', 1, 0],
  fern: ['Fern_0', 1, 0], plant: ['Plant_Big_0', 1, 0], flowers0: ['Flower_Group_0', 1, 0], flowers1: ['Flower_Group_1', 1, 0],
  grass: ['Grass_Wispy_0', 1, 0], grassTuft: ['Grass_0', 1, 0], clover: ['Clover_0', 1, 0],
  rocks0: ['Rocks_T0', 0.08, 0], rocks1: ['Rocks_T1', 0.15, 0], rock0: ['Rock_Medium_0', 1, 0], rock1: ['Rock_Medium_1', 1, 0],
  // street furniture
  hydrant: ['Fire_Hydrant_0', 0.6, 0.15], trashcan: ['Trashcan_1', 0.6, 0.15, true], dumpster: ['Dumpster_0', 1, 0], trashBags: ['Trash_Bags_0', 0.5, 0],
  boxes: ['Cardboard_Boxes_2', 1, 0], cone: ['Traffic_Cone_0', 1, 0], streetlight: ['Streetlight_0', 0.5, 0.15],
  fence: ['Metal_Fence_0', 1, 0], barrier: ['Traffic_Barrier_0', 1, 0], plasticBarrier: ['Plastic_Barrier_0', 1, 0],
  // rooftops
  ac: ['Air_Conditioner_0', 0.5, 0.1, true], acStack: ['Ac_Stacked_0', 0.5, 0.1, true], antenna: ['Roof_Antenna_0', 0.6, 0.15], waterTower: ['Water_Tower_0', 1, 0.3],
  // European townhouses for the old-town district
  house0: ['Town_House_0', 0.12, 0.05, true], house1: ['Town_House_1', 0.3, 0.1, true], house2: ['Town_House_2', 0.7, 0.25, true],
  houseLarge: ['Large_Town_House_0', 0.35, 0.12, true], houseSmall: ['Small_Building_0', 0.6, 0.22, true],
  building: ['Building_0', 0.4, 0.15, true], buildingBig: ['Big_Building_0', 0.5, 0.18, true],
};

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(), 'draco3d.decoder': await draco3d.createDecoderModule(),
});

// Load one model, bake every node transform into its vertices, and join primitives per material.
async function prepare(file, ratio, name, flat, lod) {
  const doc = await io.read(`${src}/${file}.glb`);
  for (const a of doc.getRoot().listAnimations()) a.dispose();
  await doc.transform(flatten());
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  for (const n of doc.getRoot().listNodes()) if (n.getMesh()) clearNodeTransform(n);
  if (flat) for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) p.setAttribute('NORMAL', null);
  await doc.transform(join({ keepNamed: false }), weld());
  if (ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: lod ? 0.12 : 0.05, lockBorder: false }));
  await doc.transform(prune());
  // one root node per model: <name>, holding all its mesh nodes
  const root = doc.createNode(name);
  for (const n of [...scene.listChildren()]) { scene.removeChild(n); root.addChild(n); }
  scene.addChild(root);
  return doc;
}

const master = new Document();
master.createBuffer();
const masterScene = master.createScene('kit');
master.getRoot().setDefaultScene(masterScene);
const merge = (doc) => {
  mergeDocuments(master, doc);
  for (const s of master.getRoot().listScenes()) {
    if (s === masterScene) continue;
    for (const n of s.listChildren()) { s.removeChild(n); masterScene.addChild(n); }
    s.dispose();
  }
};

for (const [name, [file, hi, lo, flat = false]] of Object.entries(MODELS)) {
  if (!fs.existsSync(`${src}/${file}.glb`)) { console.log('skip (missing)', file); continue; }
  try {
    const a = await prepare(file, hi, name, flat, false);
    let tris = 0;
    for (const m of a.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
    merge(a);
    let loT = 0;
    if (lo > 0) {
      const b = await prepare(file, lo, name + '__lod1', flat, true);
      for (const m of b.getRoot().listMeshes()) for (const p of m.listPrimitives()) loT += p.getIndices().getCount() / 3;
      merge(b);
    }
    console.log(name.padEnd(14), file.padEnd(22), String(tris).padStart(6), 'tris', lo ? `lod1 ${loT}` : '');
  } catch (e) {
    console.log('FAILED', name, file, e.message);
  }
}
// all buffers into one, shared textures/materials merged, textures shrunk to WebP
const buf = master.getRoot().listBuffers()[0];
for (const a of master.getRoot().listAccessors()) a.setBuffer(buf);
for (const b of master.getRoot().listBuffers()) if (b !== buf) b.dispose();
await master.transform(
  dedup(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 82 }),
  draco({ method: 'edgebreaker', quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
);
fs.mkdirSync('public/models/city', { recursive: true });
await io.write(OUT, master);
console.log('textures', master.getRoot().listTextures().length, 'materials', master.getRoot().listMaterials().length);
console.log(OUT, (fs.statSync(OUT).size / 1024) | 0, 'KB');
