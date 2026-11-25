// Shared editable voxel craft. Tuples: x, y, z, sizeX, sizeY, sizeZ, sRGB.
// The runtime and Blender exporter use the same geometry and frame-zero bob.
const immutable = rows => Object.freeze(rows.map(row => Object.freeze(row)));
export const AIRCRAFT_BODY_PARTS = immutable([
  [0,0,0,3.1,.45,1.7,'#2f4257'],[-.3,.36,0,1.7,.5,1.3,'#16364c'],[.3,-.3,0,2.2,.3,1.1,'#102133'],
  [-1.18,-.09,-.91,.65,.4,.53,'#33485b'],[1.18,-.09,-.91,.65,.4,.53,'#33485b'],[-1.18,-.09,.91,.65,.4,.53,'#33485b'],[1.18,-.09,.91,.65,.4,.53,'#33485b'],
  [-1.65,.14,-.61,.6,.17,.18,'#4b5d70'],[-1.65,.14,.61,.6,.17,.18,'#4b5d70'],[1.4,.22,0,.4,.16,1.3,'#405367'],[0,.68,0,.4,.12,.4,'#537083']
]);
export const AIRCRAFT_GLOW_PARTS = immutable(Array.from({length:4},(_,k)=>[
  k%2?1.18:-1.18,-.32,k<2?-.91:.91,.34,.08,.28,k%2?'#ff326c':'#2bd2ff'
]));
