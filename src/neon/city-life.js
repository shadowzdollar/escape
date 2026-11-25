import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { SCENE_PLACEMENTS } from './asset-placements.js';
import { getKinematicPoseController } from './kinematic-pose.js';

// Renderer-independent street activity metadata is shared with the Blender scene.
const route = (region, type, x1, x2, z1, z2, clockwise = true, phase = 0.12) => ({ region, type, x1, x2, z1, z2, clockwise, phase });
export const CITY_TRAFFIC_ROUTES = [
  route('Kasumi Ward', 'taxi', -90, 0, -180, 50, true, 0.07),
  route('Kasumi Ward', 'sport', 0, 90, -180, 50, false, 0.31),
  route('Lantern Market', 'van', -210, -90, 50, 140, true, 0.18),
  route('Lantern Market', 'taxi', -310, -210, 50, 140, false, 0.54),
  route('Iron Docks', 'bus', 90, 210, 50, 140, true, 0.38),
  route('Iron Docks', 'van', 210, 310, -70, 50, false, 0.68),
  route('Stacktown', 'bus', -310, -210, -300, -180, true, 0.16),
  route('Stacktown', 'van', -210, -90, -420, -300, false, 0.63),
  route('Meridian East', 'sport', 90, 210, -300, -180, true, 0.42),
  route('Meridian East', 'sport', 210, 310, -420, -300, false, 0.78),
  route('Crown Plaza', 'bus', -90, 0, -540, -420, true, 0.26),
  route('Crown Plaza', 'taxi', 0, 90, -420, -300, false, 0.57),
  route('Kasumi Ward', 'taxi', -90, 0, -180, 50, false, 0.62),
  route('Lantern Market', 'taxi', -210, -90, 50, 140, false, 0.81),
  route('Iron Docks', 'van', 210, 310, -70, 50, true, 0.22),
  route('Meridian East', 'sport', 90, 210, -300, -180, false, 0.09),
].map((item, index) => ({ ...item, id: `ambient-route-${index + 1}` }));

const TYPES = {
  taxi: { width: 2.08, length: 4.6, height: 1.7, speed: 8.6, color: '#dca63d', accent: '#ffbd4a' },
  van: { width: 2.3, length: 5.2, height: 2.65, speed: 7.2, color: '#247e81', accent: '#5cf5d9' },
  sport: { width: 2.18, length: 4.9, height: 1.28, speed: 10.8, color: '#aa326b', accent: '#ff49bc' },
  bus: { width: 2.58, length: 7.4, height: 2.8, speed: 6.7, color: '#386898', accent: '#82caff' },
};

function roundedLane(config) {
  const inset = config.clockwise ? 4 : -4;
  const left = config.x1 + inset, right = config.x2 - inset;
  const low = config.z1 + inset, high = config.z2 - inset;
  const radius = 6.5, points = [];
  const arc = (x, z, start) => {
    for (let step = 0; step <= 16; step++) {
      const angle = start + step / 16 * Math.PI / 2;
      points.push({ x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius });
    }
  };
  arc(right - radius, low + radius, -Math.PI / 2);
  arc(right - radius, high - radius, 0);
  arc(left + radius, high - radius, Math.PI / 2);
  arc(left + radius, low + radius, Math.PI);
  if (!config.clockwise) points.reverse();
  const lengths = [], offsets = [];
  let length = 0;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    offsets.push(length);
    const segment = Math.hypot(next.x - point.x, next.z - point.z);
    lengths.push(segment); length += segment;
  });
  return { points, lengths, offsets, length };
}

function samplePath(path, distance) {
  const offset = ((distance % path.length) + path.length) % path.length;
  let index = path.offsets.length - 1;
  while (index > 0 && path.offsets[index] > offset) index--;
  const a = path.points[index], b = path.points[(index + 1) % path.points.length];
  const t = (offset - path.offsets[index]) / Math.max(path.lengths[index], 0.001);
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
    yaw: Math.atan2(-(b.x - a.x), -(b.z - a.z)) };
}

export function createTrafficVehicle(type) {
  const spec = TYPES[type] || TYPES.taxi, parts = [];
  const add = (x, y, z, sx, sy, sz, c, kind = 'solid') => parts.push({ x, y, z, sx, sy, sz, c, kind });
  const w = spec.width, l = spec.length;
  add(0, 0.48, 0, w - 0.16, 0.48, l, '#152430');
  add(0, 0.79, 0, w, 0.39, l - 0.26, spec.color);
  add(0, 0.39, 0, w + 0.07, 0.09, l - 0.55, '#202d39');
  for (const side of [-1, 1]) {
    add(side * (w / 2 + 0.02), 0.46, l * 0.31, 0.29, 0.66, 0.68, '#101820');
    add(side * (w / 2 + 0.02), 0.46, -l * 0.31, 0.29, 0.66, 0.68, '#101820');
    add(side * (w / 2 + 0.18), 0.46, l * 0.31, 0.035, 0.27, 0.31, '#58717c');
    add(side * (w / 2 + 0.18), 0.46, -l * 0.31, 0.035, 0.27, 0.31, '#58717c');
    add(side * w * 0.36, 0.8, -l / 2 + 0.115, w * 0.22, 0.12, 0.045, '#b7faff', 'glow');
    add(side * w * 0.36, 0.79, l / 2 - 0.112, w * 0.22, 0.09, 0.05, '#ff4665', 'glow');
    add(side * (w / 2 + 0.014), 0.34, 0, 0.024, 0.035, l * 0.61, spec.accent, 'glow');
    add(side * (w / 2 + 0.08), 1.21, -l * 0.16, 0.16, 0.14, 0.2, '#314953');
    add(side * w * 0.47, 1.07, -l * 0.16, 0.085, 0.21, 0.1, '#293b46');
    add(side * w * 0.5, 1.18, -l * 0.16, 0.35, 0.08, 0.1, '#293b46');
  }
  add(0, 0.69, -l / 2 - 0.01, w * 0.35, 0.1, 0.06, '#0c1521');
  add(0, 0.56, l / 2 + 0.012, 0.4, 0.11, 0.025, '#d5ddb1');
  if (type === 'bus') {
    add(0, 1.78, 0.06, w - 0.13, 1.84, l - 0.32, spec.color);
    add(0, 2.29, -l / 2 + 0.19, w - 0.34, 0.65, 0.12, '#335368');
    add(0, 2.75, -l / 2 + 0.21, 1.38, 0.15, 0.05, '#ffd36a', 'glow');
    for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
      add(side * (w / 2 - 0.035), 2.05, -l * 0.36 + i * l * 0.14, 0.05, 0.73, l * 0.105, '#427b90');
      add(side * (w / 2 - 0.007), 2.34, -l * 0.36 + i * l * 0.14, 0.023, 0.06, l * 0.09, '#95d9de', 'glow');
    }
    add(0, 2.79, -0.6, w * 0.55, 0.17, 1.3, '#293b4c');
    add(0, 2.79, 1.25, w * 0.55, 0.17, 0.8, '#293b4c');
  } else if (type === 'van') {
    add(0, 1.78, 0.55, w - 0.08, 1.6, l * 0.64, spec.color);
    add(0, 1.32, -l * 0.31, w - 0.25, 0.8, l * 0.26, '#2d6068');
    add(0, 1.55, -l * 0.425, w - 0.48, 0.46, 0.08, '#233e52');
    for (const side of [-1, 1]) {
      add(side * (w / 2 - 0.03), 1.75, 0.1, 0.05, 0.27, 1.3, '#8ae0ca', 'glow');
      for (let i = 0; i < 5; i++) add(side * w / 2, 1.55, 0.2 + i * 0.43, 0.035, 1.25, 0.055, '#315c69');
    }
    add(0, 2.64, 0.35, 1.45, 0.15, 1.8, '#293b46');
  } else {
    const sports = type === 'sport';
    add(0, sports ? 1.12 : 1.27, 0.12, w * 0.77, sports ? 0.36 : 0.65, l * 0.43, '#213947');
    add(0, sports ? 1.31 : 1.62, 0.23, w * 0.69, 0.1, l * 0.28, spec.color);
    add(0, sports ? 1.16 : 1.32, 0.11 - l * 0.215, w * 0.65, sports ? 0.25 : 0.38, 0.045, '#426980');
    for (const side of [-1, 1]) add(side * w * 0.395, sports ? 1.13 : 1.3, 0.08, 0.035, sports ? 0.22 : 0.34, l * 0.31, '#33566d');
    if (sports) {
      add(0, 1.08, l * 0.4, w + 0.14, 0.09, 0.4, '#293249');
      for (const side of [-1, 1]) add(side * w * 0.33, 0.93, l * 0.4, 0.09, 0.3, 0.12, '#273642');
    } else {
      add(0, 1.69, 0.05, 0.63, 0.06, 0.3, '#35404b');
      add(0, 1.83, 0.05, 0.76, 0.25, 0.38, '#ffcf57', 'glow');
      add(0, 1.83, -0.15, 0.42, 0.065, 0.022, '#4b351b');
      for (const side of [-1, 1]) for (let i = 0; i < 5; i++) add(side * (w / 2 + 0.012), 0.87, -0.5 + i * 0.24, 0.023, 0.075, 0.14, i % 2 ? '#182a32' : '#dec162');
    }
  }
  return { ...spec, height: Math.max(...parts.map(part => part.y + part.sy / 2)), boxes: parts };
}

export function createCityLifeLayout() {
  const vehicles = CITY_TRAFFIC_ROUTES.map((config, index) => {
    const shape = createTrafficVehicle(config.type), path = roundedLane(config);
    const distance = path.length * config.phase, pose = samplePath(path, distance);
    return { id: `ambient-vehicle-${index + 1}`, routeId: config.id, routeIndex: index, type: config.type,
      region: config.region, x: pose.x, y: -0.097, z: pose.z, yaw: pose.yaw, speed: shape.speed,
      width: shape.width, length: shape.length, height: shape.height, distance,
      routeLength: path.length, routePoints: path.points, boxes: shape.boxes };
  });
  const props = [], assemblies = [];
  let assembly = null;
  const beginAssembly = (id, region, mountType, x, z) => {
    assembly = { id, region, mountType, anchor: { x, y: -0.05, z }, supportIds: [] };
    assemblies.push(assembly);
  };
  const add = (x, y, z, sx, sy, sz, c, kind = 'solid', motion = null, phase = 0) => {
    const part = { id: `${assembly.id}/part-${props.length}`, attachedTo: assembly.id,
      x, y, z, sx, sy, sz, c, kind, motion, phase };
    props.push(part); return part;
  };
  const support = (...args) => {
    const part = add(...args); part.role = 'support'; assembly.supportIds.push(part.id); return part;
  };
  const lanternAnchors = [[-224, 88], [-196, 118], [-104, 77], [-296, 93]];
  lanternAnchors.forEach(([x, z], index) => {
    beginAssembly(`life-lantern-string-${index}`, 'Lantern Market', 'ground-supported-cable', x, z);
    for (const end of [-1, 1]) {
      support(x, 3.25, z + end * 5.5, 0.13, 6.5, 0.13, '#354654');
      support(x, 0.13, z + end * 5.5, 0.45, 0.26, 0.45, '#34404b');
    }
    support(x, 6.3, z, 0.035, 0.035, 11, '#35424e');
    for (let j = 0; j < 5; j++) {
      const zz = z - 4.4 + j * 2.2, phase = index * 2 + j;
      support(x, 6.195, zz, 0.035, 0.25, 0.035, '#484552');
      add(x, 5.83, zz, 0.53, 0.71, 0.53, j % 2 ? '#ff4f8c' : '#ffb640', 'glow', 'lantern', phase);
      add(x, 6.08, zz, 0.61, 0.08, 0.61, '#302f39', 'solid', 'sway', phase);
      add(x, 5.47, zz, 0.35, 0.1, 0.35, '#6a343c', 'solid', 'sway', phase);
    }
  });
  for (const [index, x, z] of [[0, 104, -236], [1, 224, -350], [2, 196, -258]]) {
    beginAssembly(`life-meridian-projector-${index}`, 'Meridian East', 'ground-mounted-projection', x, z);
    support(x, 0.23, z, 1.75, 0.46, 1.75, '#274755');
    support(x, 0.62, z, 0.8, 0.32, 0.8, '#304c5d');
    add(x, 0.8, z, 0.38, 0.05, 0.38, '#81faff', 'glow').role = 'projector-lens';
    add(x, 2.75, z, 0.035, 3.9, 0.035, '#1986a0', 'glow').role = 'projection-beam';
    for (let i = 0; i < 28; i++) {
      const angle = i / 28 * Math.PI * 2;
      add(x + Math.cos(angle) * 1.5, 4.5 + Math.sin(angle) * 1.5, z,
        0.16, 0.16, 0.16, i % 3 ? '#25e9ef' : '#8b62ff', 'glow', `hologram:${x}:${z}`, index + angle);
    }
    for (let i = 0; i < 7; i++) add(x, 2 + i * 0.45, z, 0.13, 0.13, 0.13, '#80faff', 'glow', `hologram:${x}:${z}`, index + i);
  }
  for (const [x, z] of [[-14, -468], [14, -342]]) {
    beginAssembly(`life-crown-sculpture-${x}`, 'Crown Plaza', 'ground-mounted-kinetic-sculpture', x, z);
    support(x, 0.3, z, 2.6, 0.6, 2.6, '#364b60');
    support(x, 2.65, z, 0.18, 4.2, 0.18, '#496278');
    support(x, 4.8, z, 0.4, 0.18, 0.4, '#75838d');
    support(x, 4.8, z, 4.1, 0.065, 0.065, '#486170', 'solid', `crown:${x}:${z}`);
    support(x, 4.8, z, 4.1, 0.065, 0.065, '#486170', 'solid', `crown:${x}:${z}`).ry = Math.PI / 2;
    for (let i = 0; i < 36; i++) {
      const angle = i / 36 * Math.PI * 2;
      support(x + Math.cos(angle) * 2, 4.8, z + Math.sin(angle) * 2,
        0.393, 0.075, 0.075, '#57768b', 'solid', `crown:${x}:${z}`).ry = -angle - Math.PI / 2;
      add(x + Math.cos(angle) * 2, 4.8, z + Math.sin(angle) * 2,
        0.12, 0.3, 0.12, i % 4 ? '#b8dfff' : '#ffe3a0', 'glow', `crown:${x}:${z}`, angle);
    }
  }
  for (const [x, z, color] of [[-14, -88, '#ff3fa9'], [14, -33, '#24edf4'], [-224, -236, '#ff9854'], [-104, -365, '#ffb45a']]) {
    beginAssembly(`life-service-beacon-${x}-${z}`, Math.abs(x) < 20 ? 'Kasumi Ward' : 'Stacktown', 'ground-mounted-beacon', x, z);
    support(x, 3.05, z, 0.1, 6.1, 0.1, '#3f4853');
    support(x, 0.13, z, 0.4, 0.26, 0.4, '#3f4853');
    for (let j = 0; j < 4; j++) add(x, 5.3 + j * 0.18, z, 0.42, 0.065, 0.42, color, 'glow', 'beacon', j * 0.6 + x);
  }
  for (const [index, x, z] of [[0, 196, 83], [1, 224, -25], [2, 296, 12], [3, 104, 105]]) {
    beginAssembly(`life-docks-vent-${index}`, 'Iron Docks', 'ground-mounted-vent', x, z);
    support(x, 0.14, z, 1.1, 0.28, 1.1, '#3b484e');
    for (let rib = 0; rib < 6; rib++) add(x - 0.42 + rib * 0.168, 0.31, z, 0.075, 0.08, 0.9, '#657177');
  }
  const regions = [
    { name: 'Kasumi Ward', activity: 'Late-night taxis and pulsing street signs' },
    { name: 'Lantern Market', activity: 'Delivery traffic and flickering lantern streets' },
    { name: 'Iron Docks', activity: 'Heavy transports and rising vent steam' },
    { name: 'Stacktown', activity: 'Civic buses, service beacons, and drifting paper' },
    { name: 'Meridian East', activity: 'Sports cars and rotating holographic arrays' },
    { name: 'Crown Plaza', activity: 'Quiet shuttles and orbiting light sculptures' },
  ];
  // Footings reach the common base slab, including the narrow unpaved strips
  // between road surfacing and raised parcels; their authored top stays fixed.
  for (const prop of props) if (prop.role === 'support' && prop.sy < 1 && Math.abs(prop.y - prop.sy / 2) < 0.001) {
    prop.y -= 0.025; prop.sy += 0.05;
  }
  return { vehicles, props, regions, assemblies };
}

function trafficFootprint(vehicle, pose=vehicle) {
  if(vehicle.wrecked&&vehicle.body){vehicle.body.updateAABB();const a=vehicle.body.aabb;return {id:vehicle.id,x:(a.lowerBound.x+a.upperBound.x)/2,z:(a.lowerBound.z+a.upperBound.z)/2,yaw:0,halfWidth:(a.upperBound.x-a.lowerBound.x)/2,halfLength:(a.upperBound.z-a.lowerBound.z)/2};}
  const local=vehicle.localFootprint,c=Math.cos(pose.yaw),s=Math.sin(pose.yaw);
  return {id:vehicle.id,x:pose.x+local.x*c+local.z*s,z:pose.z-local.x*s+local.z*c,yaw:pose.yaw,halfWidth:local.halfWidth,halfLength:local.halfLength};
}

// Four separating axes retain the true rotated car shape at bends and stops.
export function trafficFootprintsOverlap(a,b,padding=0) {
  const ac=Math.cos(a.yaw),as=Math.sin(a.yaw),bc=Math.cos(b.yaw),bs=Math.sin(b.yaw),dx=b.x-a.x,dz=b.z-a.z;
  for(const [x,z] of [[ac,-as],[as,ac],[bc,-bs],[bs,bc]]) {
    const extent=(a.halfWidth+padding/2)*Math.abs(x*ac-z*as)+(a.halfLength+padding/2)*Math.abs(x*as+z*ac)+(b.halfWidth+padding/2)*Math.abs(x*bc-z*bs)+(b.halfLength+padding/2)*Math.abs(x*bs+z*bc);
    if(Math.abs(dx*x+dz*z)>=extent)return false;
  }
  return true;
}

const anchorBlocker=p=>({id:p.id,x:p.x,z:p.z,yaw:p.ry||0,halfWidth:p.sx/2,halfLength:p.sz/2});

/** Traffic keeps its own occupancy reservations independently of the pedestrian. */
export function createTrafficController({vehicles:authoredVehicles=createCityLifeLayout().vehicles,getVehicleBlockers,getPlayerPosition}={}) {
  const paths=CITY_TRAFFIC_ROUTES.map(roundedLane);
  const vehicles=authoredVehicles.map(vehicle=>{
    const minX=Math.min(...vehicle.boxes.map(p=>p.x-p.sx/2)),maxX=Math.max(...vehicle.boxes.map(p=>p.x+p.sx/2));
    const minZ=Math.min(...vehicle.boxes.map(p=>p.z-p.sz/2)),maxZ=Math.max(...vehicle.boxes.map(p=>p.z+p.sz/2));
    const minY=Math.min(...vehicle.boxes.map(p=>p.y-p.sy/2)),maxY=Math.max(...vehicle.boxes.map(p=>p.y+p.sy/2));
    return {...vehicle,spawnDistance:vehicle.distance,velocity:0,active:false,waiting:true,blockedBy:null,laps:0,health:100,wrecked:false,lastRam:-Infinity,damageZones:[],damagedParts:0,brokenLamps:0,
      bodyCenter:{x:(minX+maxX)/2,y:(minY+maxY)/2,z:(minZ+maxZ)/2},bodyHalfHeight:(maxY-minY)/2,baseLocalY:minY,
      path:paths[vehicle.routeIndex],localFootprint:{x:(minX+maxX)/2,z:(minZ+maxZ)/2,halfWidth:(maxX-minX)/2,halfLength:(maxZ-minZ)/2}};
  });
  let rememberedBlockers=[anchorBlocker(SCENE_PLACEMENTS.interceptor)];
  let rememberedPlayer={x:SCENE_PLACEMENTS.mercenary.x,z:SCENE_PLACEMENTS.mercenary.z};
  let physics=null,clock=0;
  const parked=anchorBlocker(SCENE_PLACEMENTS.parkedCar);
  function readBlockers(override) {
    const supplied=override??getVehicleBlockers?.();
    if(Array.isArray(supplied))rememberedBlockers=supplied.filter(b=>[b.x,b.z,b.yaw,b.halfWidth,b.halfLength].every(Number.isFinite)&&b.halfWidth>0&&b.halfLength>0).map(b=>({...b}));
    // A movable parked interceptor replaces its authored reservation by id.
    // Retaining both positions would leave an invisible obstacle at its spawn.
    const byId=new Map([[parked.id,parked]]);
    for(const blocker of rememberedBlockers)byId.set(blocker.id||'owned vehicle',blocker);
    return [...byId.values()];
  }
  function currentPlayer(supplied) {
    const position=supplied??getPlayerPosition?.()??rememberedPlayer;
    if(position&&Number.isFinite(position.x)&&Number.isFinite(position.z))rememberedPlayer={x:position.x,z:position.z};
    return rememberedPlayer;
  }
  function obstruction(vehicle,pose,blockers,padding=.28) {
    const footprint=trafficFootprint(vehicle,pose);
    for(const blocker of blockers)if(trafficFootprintsOverlap(footprint,blocker,padding))return blocker.id||'player vehicle';
    for(const other of vehicles)if(other!==vehicle&&other.active&&trafficFootprintsOverlap(footprint,trafficFootprint(other),padding))return other.id;
    return null;
  }
  function activateWaiting(blockers,playerPosition) {
    for(const vehicle of vehicles) {
      if(vehicle.active||vehicle.wrecked)continue;
      const pose=samplePath(vehicle.path,vehicle.distance);
      vehicle.x=pose.x;vehicle.z=pose.z;vehicle.yaw=pose.yaw;
      vehicle.blockedBy=obstruction(vehicle,pose,blockers,.8);
      if(!vehicle.blockedBy&&playerPosition&&Math.hypot(pose.x-playerPosition.x,pose.z-playerPosition.z)<7)vehicle.blockedBy='pedestrian';
      if(!vehicle.blockedBy){vehicle.active=true;vehicle.waiting=false;vehicle.velocity=0;}
    }
  }
  function safeMovement(vehicle,pose,blockers) {
    const distance=Math.hypot(pose.x-vehicle.x,pose.z-vehicle.z),turn=Math.atan2(Math.sin(pose.yaw-vehicle.yaw),Math.cos(pose.yaw-vehicle.yaw));
    const radius=Math.hypot(vehicle.localFootprint.halfWidth,vehicle.localFootprint.halfLength);
    // The largest corner moves <12cm per sample inside a 28cm reservation gap.
    // This covers translation, turning and the continuous wrap back to lap zero.
    const samples=Math.max(1,Math.ceil((distance+Math.abs(turn)*radius)/.12));
    for(let i=1;i<=samples;i++) {
      const t=i/samples,at={x:vehicle.x+(pose.x-vehicle.x)*t,z:vehicle.z+(pose.z-vehicle.z)*t,yaw:vehicle.yaw+turn*t};
      const blocked=obstruction(vehicle,at,blockers);
      if(blocked)return blocked;
    }
    return null;
  }
  function update(dt,playerPosition,override) {
    playerPosition=currentPlayer(playerPosition);
    const delta=Math.min(Math.max(dt||0,0),.1),blockers=readBlockers(override).concat({id:'PLAYER-BODY',...playerPosition,yaw:0,halfWidth:.45,halfLength:.45});
    clock+=delta;
    for(const vehicle of vehicles)if(vehicle.wrecked&&vehicle.body)syncWreck(vehicle);
    // If an external reset places the owned car at an occupied point, withdraw
    // the invalid ambient reservation until that exact point clears. It is never
    // rendered or exposed as a collider inside the player's vehicle.
    for(const vehicle of vehicles)if(vehicle.active&&!vehicle.wrecked&&blockers.some(b=>trafficFootprintsOverlap(trafficFootprint(vehicle),b))) {
      vehicle.active=false;vehicle.waiting=true;vehicle.velocity=0;
    }
    activateWaiting(blockers,playerPosition);
    for(const vehicle of vehicles) {
      if(!vehicle.active||vehicle.wrecked)continue;
      const previousX=vehicle.x,previousZ=vehicle.z,previousYaw=vehicle.yaw;
      const aheadX=-Math.sin(vehicle.yaw),aheadZ=-Math.cos(vehicle.yaw),own=trafficFootprint(vehicle);
      let desiredSpeed=vehicle.speed;
      if(playerPosition)desiredSpeed*=THREE.MathUtils.clamp((Math.hypot(playerPosition.x-vehicle.x,playerPosition.z-vehicle.z)-8)/10,0,1);
      const obstacles=blockers.concat(vehicles.filter(other=>other!==vehicle&&other.active).map(other=>trafficFootprint(other)));
      for(const other of obstacles) {
        const dx=other.x-own.x,dz=other.z-own.z,ahead=dx*aheadX+dz*aheadZ,lateral=Math.abs(dx*aheadZ-dz*aheadX);
        const relative=other.yaw-vehicle.yaw;
        const sideExtent=other.halfWidth*Math.abs(Math.cos(relative))+other.halfLength*Math.abs(Math.sin(relative));
        const forwardExtent=other.halfLength*Math.abs(Math.cos(relative))+other.halfWidth*Math.abs(Math.sin(relative));
        if(ahead>0&&ahead<28&&lateral<own.halfWidth+sideExtent+.5) {
          const gap=ahead-own.halfLength-forwardExtent-1.2;
          desiredSpeed=Math.min(desiredSpeed,Math.sqrt(Math.max(0,2*5.5*gap)));
        }
      }
      const acceleration=desiredSpeed<vehicle.velocity?9:2.1;
      vehicle.velocity+=THREE.MathUtils.clamp(desiredSpeed-vehicle.velocity,-acceleration*delta,acceleration*delta);
      vehicle.blockedBy=null;
      const steps=Math.max(1,Math.ceil(vehicle.velocity*delta/.22)),subDelta=delta/steps;
      for(let step=0;step<steps;step++) {
        const nextDistance=vehicle.distance+vehicle.velocity*subDelta,pose=samplePath(vehicle.path,nextDistance);
        const turn=Math.atan2(Math.sin(pose.yaw-vehicle.yaw),Math.cos(pose.yaw-vehicle.yaw));
        pose.yaw=vehicle.yaw+turn*(1-Math.exp(-12*subDelta));
        let blocked=safeMovement(vehicle,pose,blockers);
        if(!blocked&&playerPosition&&Math.hypot(pose.x-playerPosition.x,pose.z-playerPosition.z)<7)blocked='pedestrian';
        if(blocked){vehicle.velocity=0;vehicle.blockedBy=blocked;break;}
        if(nextDistance>=vehicle.path.length)vehicle.laps++;
        vehicle.distance=nextDistance%vehicle.path.length;vehicle.x=pose.x;vehicle.z=pose.z;vehicle.yaw=pose.yaw;
      }
      vehicle.motionVelocity={x:delta?(vehicle.x-previousX)/delta:0,z:delta?(vehicle.z-previousZ)/delta:0,yaw:delta?Math.atan2(Math.sin(vehicle.yaw-previousYaw),Math.cos(vehicle.yaw-previousYaw))/delta:0};
    }
    if(physics)for(const vehicle of vehicles)syncBody(vehicle);
  }
  function syncWreck(vehicle) {
    const body=vehicle.body,offset=body.quaternion.vmult(new CANNON.Vec3(vehicle.bodyCenter.x,vehicle.bodyCenter.y,vehicle.bodyCenter.z));
    vehicle.x=body.position.x-offset.x;vehicle.y=body.position.y-offset.y;vehicle.z=body.position.z-offset.z;
    const forward=body.quaternion.vmult(new CANNON.Vec3(0,0,-1));vehicle.yaw=Math.atan2(-forward.x,-forward.z);vehicle.velocity=Math.hypot(body.velocity.x,body.velocity.z);
    body.aabbNeedsUpdate=true;
  }
  function syncBody(vehicle) {
    const body=vehicle.body;if(!body)return;
    body.collisionFilterMask=vehicle.active?-1:0;body.collisionResponse=vehicle.active;
    if(vehicle.wrecked)return;
    vehicle.y=(physics.groundHeightAt?.(vehicle.x,vehicle.z)??.033)-vehicle.baseLocalY;
    body.quaternion.setFromEuler(0,vehicle.yaw,0);
    const offset=body.quaternion.vmult(new CANNON.Vec3(vehicle.bodyCenter.x,vehicle.bodyCenter.y,vehicle.bodyCenter.z));
    body.position.set(vehicle.x+offset.x,vehicle.y+offset.y,vehicle.z+offset.z);
    body.previousPosition.copy(body.position);body.interpolatedPosition.copy(body.position);
    const motion=vehicle.active?vehicle.motionVelocity:null;
    // Accepted traffic poses stay fixed through every internal physics step;
    // their motion still transfers momentum through contact equations.
    body.velocity.set(motion?.x||0,0,motion?.z||0);body.angularVelocity.set(0,motion?.yaw||0,0);body.aabbNeedsUpdate=true;
    physics.poseController.setTarget(body,{position:body.position,quaternion:body.quaternion,velocity:body.velocity,angularVelocity:body.angularVelocity});
  }
  function attachPhysics({world,material,groundHeightAt,onImpact}={}) {
    if(!world)throw new Error('Traffic physics needs the shared Cannon world.');
    if(physics)for(const vehicle of vehicles)if(vehicle.body){physics.poseController.unregister(vehicle.body);physics.world.removeBody(vehicle.body);}
    if(physics?.contacts)for(const contact of physics.contacts)physics.world.removeContactMaterial(contact);
    const rollingMaterial=new CANNON.Material('traffic wheels and body');
    const surfaces=new Set([material,world.defaultMaterial,...world.bodies.map(body=>body.material)].filter(Boolean));
    const contacts=[...surfaces].map(surface=>new CANNON.ContactMaterial(rollingMaterial,surface,{friction:.004,restitution:.1}));
    contacts.push(new CANNON.ContactMaterial(rollingMaterial,rollingMaterial,{friction:.03,restitution:.16}));
    contacts.forEach(contact=>world.addContactMaterial(contact));
    physics={world,material:rollingMaterial,groundHeightAt,onImpact,contacts,poseController:getKinematicPoseController(world)};
    for(const vehicle of vehicles) {
      const body=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,material:rollingMaterial,allowSleep:true});
      body.addShape(new CANNON.Box(new CANNON.Vec3(vehicle.localFootprint.halfWidth,vehicle.bodyHalfHeight,vehicle.localFootprint.halfLength)));
      body.linearDamping=.32;body.angularDamping=.48;body.sleepSpeedLimit=.14;body.sleepTimeLimit=1.3;body.userData={id:vehicle.id,type:'traffic'};
      vehicle.body=body;world.addBody(body);syncBody(vehicle);
    }
    return {bodies:vehicles.map(v=>v.body),count:vehicles.length};
  }
  function damageWeight(vehicle,part) {
    return vehicle.damageZones.reduce((weight,zone)=>Math.max(weight,zone.strength*Math.exp(-((part.x-zone.x)**2+(part.z-zone.z)**2)/5)),0);
  }
  function ram(from,to,{yaw=0,speed=0}={}) {
    if(!physics||![from.x,from.z,to.x,to.z,yaw,speed].every(Number.isFinite)||Math.abs(speed)<3)return [];
    const travel=Math.hypot(to.x-from.x,to.z-from.z);if(travel<.00001)return [];
    const direction=new CANNON.Vec3((to.x-from.x)/travel,0,(to.z-from.z)/travel),magnitude=Math.abs(speed),hits=[];
    const count=Math.max(1,Math.ceil(travel/.12));
    for(const vehicle of vehicles) {
      if(!vehicle.active||clock-vehicle.lastRam<.7)continue;
      vehicle.body.updateAABB();
      const carLow=Math.min(from.y??.033,to.y??.033),carHigh=Math.max(from.y??.033,to.y??.033)+SCENE_PLACEMENTS.interceptor.sy;
      if(vehicle.body.aabb.upperBound.y<carLow||vehicle.body.aabb.lowerBound.y>carHigh)continue;
      let impactPose=null;
      for(let i=0;i<=count;i++) {
        const t=i/count,pose={x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t,yaw,halfWidth:SCENE_PLACEMENTS.interceptor.sx/2,halfLength:SCENE_PLACEMENTS.interceptor.sz/2};
        if(trafficFootprintsOverlap(pose,trafficFootprint(vehicle),.12)){impactPose=pose;break;}
      }
      if(!impactPose)continue;
      const body=vehicle.body;
      if(!vehicle.wrecked){
        syncBody(vehicle);physics.poseController.unregister(body);body.type=CANNON.Body.DYNAMIC;body.mass={sport:1000,taxi:1300,van:2100,bus:4000}[vehicle.type]||1300;body.updateMassProperties();
        body.velocity.set(-Math.sin(vehicle.yaw)*vehicle.velocity,0,-Math.cos(vehicle.yaw)*vehicle.velocity);vehicle.wrecked=true;body.userData.wrecked=true;
      }
      vehicle.active=true;vehicle.waiting=false;vehicle.lastRam=clock;vehicle.blockedBy=null;
      const damage=Math.min(100,Math.round(18+(magnitude-3)*6));vehicle.health=Math.max(0,vehicle.health-damage);
      const c=Math.cos(vehicle.yaw),s=Math.sin(vehicle.yaw),dx=impactPose.x-vehicle.x,dz=impactPose.z-vehicle.z;
      const localX=THREE.MathUtils.clamp(dx*c-dz*s,-vehicle.localFootprint.halfWidth,vehicle.localFootprint.halfWidth),localZ=THREE.MathUtils.clamp(dx*s+dz*c,-vehicle.localFootprint.halfLength,vehicle.localFootprint.halfLength);
      vehicle.damageZones.push({x:localX,z:localZ,strength:Math.max(.35,Math.min(1,damage/75))});if(vehicle.damageZones.length>4)vehicle.damageZones.shift();
      vehicle.damagedParts=vehicle.boxes.filter(p=>p.kind!=='glow'&&p.y>.6&&damageWeight(vehicle,p)>.15).length;
      vehicle.brokenLamps=vehicle.boxes.filter(p=>p.kind==='glow'&&damageWeight(vehicle,p)>.22).length;
      const point=new THREE.Vector3(vehicle.x+localX*c+localZ*s,body.position.y-vehicle.bodyHalfHeight+Math.min(.8,vehicle.bodyHalfHeight),vehicle.z-localX*s+localZ*c);
      const momentum=Math.min(30000,1450*magnitude*.8),impulse=new CANNON.Vec3(direction.x*momentum,momentum*.055,direction.z*momentum);
      body.wakeUp();body.applyImpulse(impulse,new CANNON.Vec3(point.x-body.position.x,point.y-body.position.y,point.z-body.position.z));
      if(body.angularVelocity.length()>5)body.angularVelocity.scale(5/body.angularVelocity.length(),body.angularVelocity);
      const result={id:vehicle.id,damage,point,speed:magnitude,health:vehicle.health,wrecked:true};hits.push(result);physics.onImpact?.(result);
    }
    return hits;
  }
  function reset(override) {
    clock=0;
    for(const vehicle of vehicles){vehicle.distance=vehicle.spawnDistance;vehicle.velocity=0;vehicle.motionVelocity=null;vehicle.active=false;vehicle.waiting=true;vehicle.blockedBy=null;vehicle.laps=0;vehicle.health=100;vehicle.wrecked=false;vehicle.damageZones=[];vehicle.damagedParts=0;vehicle.brokenLamps=0;vehicle.lastRam=-Infinity;if(vehicle.body){vehicle.body.type=CANNON.Body.KINEMATIC;vehicle.body.mass=0;vehicle.body.userData.wrecked=false;vehicle.body.updateMassProperties();vehicle.body.velocity.setZero();vehicle.body.angularVelocity.setZero();vehicle.body.force.setZero();vehicle.body.torque.setZero();vehicle.body.wakeUp();}}
    activateWaiting(readBlockers(override),currentPlayer(getPlayerPosition?.()??{x:SCENE_PLACEMENTS.mercenary.x,z:SCENE_PLACEMENTS.mercenary.z}));
    if(physics)for(const vehicle of vehicles)syncBody(vehicle);
  }
  function getTrafficState() {
    return vehicles.map(v=>({id:v.id,routeId:v.routeId,region:v.region,type:v.type,x:v.x,y:v.y,z:v.z,yaw:v.yaw,speed:v.velocity,active:v.active,waiting:v.waiting,blockedBy:v.blockedBy,distance:v.distance,routeLength:v.path.length,laps:v.laps,footprint:trafficFootprint(v),health:v.health,wrecked:v.wrecked,damagedParts:v.damagedParts,brokenLamps:v.brokenLamps,bodyVelocity:v.body?{x:v.body.velocity.x,y:v.body.velocity.y,z:v.body.velocity.z}:null,quaternion:v.body?{x:v.body.quaternion.x,y:v.body.quaternion.y,z:v.body.quaternion.z,w:v.body.quaternion.w}:null}));
  }
  function getTrafficColliders() {
    return vehicles.filter(v=>v.active).map(v=>{if(v.wrecked&&v.body){v.body.updateAABB();const a=v.body.aabb;return {id:v.id,x:(a.lowerBound.x+a.upperBound.x)/2,y:(a.lowerBound.y+a.upperBound.y)/2,z:(a.lowerBound.z+a.upperBound.z)/2,sx:a.upperBound.x-a.lowerBound.x,sy:a.upperBound.y-a.lowerBound.y,sz:a.upperBound.z-a.lowerBound.z};}const f=trafficFootprint(v),c=Math.abs(Math.cos(f.yaw)),s=Math.abs(Math.sin(f.yaw));return {id:v.id,x:f.x,y:v.y+v.height/2,z:f.z,sx:2*(c*f.halfWidth+s*f.halfLength),sy:v.height,sz:2*(s*f.halfWidth+c*f.halfLength)};});
  }
  function afterPhysics(){if(physics)for(const vehicle of vehicles)if(vehicle.body)physics.poseController.clearContactHints(vehicle.body);}
  function dispose(){if(physics){for(const v of vehicles)if(v.body){physics.poseController.unregister(v.body);physics.world.removeBody(v.body);}for(const contact of physics.contacts||[])physics.world.removeContactMaterial(contact);}physics=null;}
  reset();
  return {vehicles,update,reset,getTrafficState,getTrafficColliders,attachPhysics,afterPhysics,ram,damageWeight,dispose};
}

export function createCityLife(scene, city, options={}) {
  const layout = createCityLifeLayout(), group = new THREE.Group();
  group.name = 'District street life'; scene.add(group);
  const geometry = new THREE.BoxGeometry(1, 1, 1), dummy = new THREE.Object3D(), color = new THREE.Color();
  const wreckQuaternion=new THREE.Quaternion(),wreckPosition=new THREE.Vector3();
  const solidMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.45 });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const steamMaterial = new THREE.MeshBasicMaterial({ color: 0x85a7bb, transparent: true, opacity: 0.15, depthWrite: false });
  const paperMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  const traffic=createTrafficController({vehicles:layout.vehicles,getVehicleBlockers:options.getVehicleBlockers,getPlayerPosition:options.getPlayerPosition});
  const vehicles=traffic.vehicles;
  const records = { solid: [], glow: [] };
  layout.props.forEach(part => records[part.kind].push({ part, vehicle: null }));
  vehicles.forEach(vehicle => vehicle.boxes.forEach(part => records[part.kind].push({ part, vehicle })));
  const meshes = {};
  for (const kind of ['solid', 'glow']) {
    const mesh = new THREE.InstancedMesh(geometry, kind === 'solid' ? solidMaterial : glowMaterial, records[kind].length);
    mesh.name = `Street life / ${kind}`; mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    records[kind].forEach(({ part }, index) => mesh.setColorAt(index, color.set(part.c).multiplyScalar(kind === 'glow' ? 2.3 : 1)));
    group.add(mesh); meshes[kind] = mesh;
  }
  const steamSources = [[196, 83], [224, -25], [296, 12], [104, 105]];
  const steam = new THREE.InstancedMesh(geometry, steamMaterial, 64);
  steam.name = 'Iron Docks / vent steam'; steam.frustumCulled = false; group.add(steam);
  const paper = new THREE.InstancedMesh(geometry, paperMaterial, 28);
  paper.name = 'Stacktown / windblown paper'; paper.frustumCulled = false; group.add(paper);
  for (let i = 0; i < 28; i++) paper.setColorAt(i, color.set(i % 3 ? '#b0a58e' : '#598080'));
  const motes = new THREE.InstancedMesh(geometry, glowMaterial, 72);
  motes.name = 'Meridian East / data motes'; motes.frustumCulled = false; group.add(motes);
  for (let i = 0; i < 72; i++) motes.setColorAt(i, color.set(i % 4 ? '#29bbcc' : '#985bd4').multiplyScalar(1.7));
  const stats = { vehicles: vehicles.length, types: Object.keys(TYPES), districts: layout.regions,
    movingVoxelParts: vehicles.reduce((n, v) => n + v.boxes.length, 0), lanterns: 20, holograms: 3,
    lightSculptures: 2, steamParticles: 64, paperParticles: 28, dataMotes: 72, drawCalls: 5 };

  function setBox(mesh, index, x, y, z, sx, sy, sz, yaw = 0, rx = 0, rz = 0) {
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(rx, yaw, rz); dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }

  function update(dt, time, playerPosition, vehicleBlockers) {
    traffic.update(dt,playerPosition,vehicleBlockers);
    for (const kind of ['solid', 'glow']) {
      const mesh = meshes[kind];
      records[kind].forEach(({ part, vehicle }, index) => {
        let x = part.x, y = part.y, z = part.z, yaw = part.ry || 0;
        if (vehicle) {
          if(!vehicle.active){setBox(mesh,index,0,0,0,0,0,0);return;}
          const weight=traffic.damageWeight(vehicle,part);
          mesh.setColorAt(index,color.set(part.c).multiplyScalar(kind==='glow'?2.3:1-.45*weight));
          if(vehicle.wrecked&&vehicle.body){
            if(kind==='glow'&&weight>.22){setBox(mesh,index,0,0,0,0,0,0);return;}
            const body=vehicle.body,center=vehicle.bodyCenter,panel=part.y>.6&&kind!=='glow';
            const dent=panel?weight:0;
            dummy.position.set(part.x*(1-dent*.08)-center.x,part.y-center.y-dent*.17,part.z*(1-dent*.09)-center.z);
            dummy.scale.set(part.sx*(1-dent*.12),part.sy*(1-dent*.2),part.sz*(1-dent*.14));
            dummy.rotation.set(Math.sin(index*1.73)*dent*.19,0,Math.cos(index*2.1)*dent*.16);
            wreckQuaternion.set(body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w);
            wreckPosition.set(body.position.x,body.position.y,body.position.z);
            dummy.position.applyQuaternion(wreckQuaternion).add(wreckPosition);dummy.quaternion.premultiply(wreckQuaternion);dummy.updateMatrix();
            mesh.setMatrixAt(index,dummy.matrix);return;
          }
          const cos = Math.cos(vehicle.yaw), sin = Math.sin(vehicle.yaw);
          x = vehicle.x + part.x * cos + part.z * sin;
          z = vehicle.z - part.x * sin + part.z * cos;
          y = vehicle.y + part.y; yaw = vehicle.yaw;
        } else if (part.motion) {
          const phase = part.phase;
          if (part.motion === 'lantern' || part.motion === 'sway') {
            if (part.motion === 'lantern') mesh.setColorAt(index, color.set(part.c).multiplyScalar(1.9 + Math.sin(time * 2.3 + phase) * 0.3));
          } else if (part.motion.startsWith('hologram:') || part.motion.startsWith('crown:')) {
            const [, cx, cz] = part.motion.split(':').map(Number);
            const angle = time * (part.motion.startsWith('crown') ? 0.3 : 0.65);
            x = cx + Math.cos(angle) * (part.x - cx) + Math.sin(angle) * (part.z - cz);
            z = cz - Math.sin(angle) * (part.x - cx) + Math.cos(angle) * (part.z - cz);
            if (part.motion.startsWith('hologram')) y += Math.sin(time * 1.1 + phase) * 0.3;
            yaw += angle;
          } else if (part.motion === 'beacon') mesh.setColorAt(index, color.set(part.c).multiplyScalar(1.5 + Math.max(0, Math.sin(time * 3 + phase)) * 2));
        }
        setBox(mesh, index, x, y, z, part.sx, part.sy, part.sz, yaw);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
    for (let i = 0; i < 64; i++) {
      const source = steamSources[i % steamSources.length], age = (time * 0.11 + i * 0.618) % 1;
      const size = (0.35 + age * 1.0) * Math.sqrt(Math.max(0, Math.sin(age * Math.PI)));
      setBox(steam, i, source[0] + Math.sin(i * 2.7 + age * 3) * age * 1.8,
        0.45 + age * 8, source[1] + age * 2.2 + Math.cos(i) * 0.6, size, size * 0.85, size, i + age);
    }
    for (let i = 0; i < 28; i++) {
      const side = i % 2 ? -224 : -104, drift = (time * 0.42 + i * 1.73) % 24;
      setBox(paper, i, side + Math.sin(time * 0.65 + i) * 2,
        0.2 + Math.abs(Math.sin(time * 0.55 + i * 0.8)) * 0.65, -222 - (i % 4) * 38 - drift,
        0.2, 0.018, 0.29, time * 0.3 + i, Math.sin(time + i) * 0.5, Math.cos(time * 0.9 + i) * 0.25);
    }
    for (let i = 0; i < 72; i++) {
      const baseX = i % 2 ? 224 : 104, baseZ = i % 2 ? -350 : -236, age = (time * 0.045 + i * 0.618) % 1;
      const size = 0.025 + Math.sin(age * Math.PI) * 0.045;
      setBox(motes, i, baseX + Math.sin(time * 0.15 + i * 2.3) * 3,
        1.5 + age * 7, baseZ + Math.cos(time * 0.19 + i * 1.7) * 3, size, size * 2.4, size);
    }
    steam.instanceMatrix.needsUpdate = paper.instanceMatrix.needsUpdate = motes.instanceMatrix.needsUpdate = true;
  }
  function dispose() {
    traffic.dispose();
    scene.remove(group); geometry.dispose();
    [solidMaterial, glowMaterial, steamMaterial, paperMaterial].forEach(material => material.dispose());
  }
  update(0, 0, null);
  return { update, stats, getTrafficColliders:traffic.getTrafficColliders, getTrafficState:traffic.getTrafficState,
    attachPhysics:traffic.attachPhysics,afterPhysics:traffic.afterPhysics,ram:traffic.ram,
    reset(vehicleBlockers){traffic.reset(vehicleBlockers);update(0,0,null,vehicleBlockers);},dispose };
}
