import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createStreetPhysics } from './street-physics.js';
import { StreetBroadphase } from './street-broadphase.js';

const BASE_SOLVER_ITERATIONS = 7;
const ARTICULATED_SOLVER_ITERATIONS = 12;

export function createSupplySupportLayout() {
  const foundations = [], stackSpacers = [];
  [-17, -49, -82, -113, -140].forEach((z, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    for (const [slot, x, zz, groundY] of [[0, side * 11.1, z, 0.04], [1, side * 12.65, z, 0.165], [2, side * 12.65, z - 1.55, 0.165]]) {
      const topY = 0.32;
      foundations.push({ id: `loading-pallet-${index}-${slot}`, x, y: (groundY + topY) / 2, z: zz,
        sx: 1.5, sy: topY - groundY, sz: 1.5, groundY, topY, c: '#273844' });
    }
    stackSpacers.push({ id: `stack-spacer-${index}`, x: side * 12.65, y: 1.695, z,
      sx: 1.5, sy: 0.05, sz: 1.5, c: '#344655' });
  });
  return { foundations, stackSpacers };
}

/** Neutral city security, crime response, and bounded rigid-body voxel debris. */
export function createSimulation({ scene, camera, colliders = [], assets = {}, civilians = null,
  dynamicProps = [], streetColliders = [], groundSurfaces = [], groundHeightAt = () => 0, getExternalSolids = () => [],
  bounds = { minX: -65, maxX: 65, minZ: -150, maxZ: 40 }, patrolRoutes = [], onEvent = () => {} }) {
  const travelBounds = { minX: bounds.minX + 1.2, maxX: bounds.maxX - 1.2,
    minZ: bounds.minZ + 1.2, maxZ: bounds.maxZ - 1.2 };
  const group = new THREE.Group();
  group.name = 'Combat and destruction';
  scene.add(group);

  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
  world.broadphase = new StreetBroadphase();
  // The default dense collision matrix clears millions of empty entries for
  // this city. Sparse contact history scales with actual touching objects.
  world.collisionMatrix = new CANNON.ObjectCollisionMatrix();
  world.collisionMatrixPrevious = new CANNON.ObjectCollisionMatrix();
  world.allowSleep = true;
  world.solver.iterations = BASE_SOLVER_ITERATIONS;
  const physicsMaterial = new CANNON.Material('concrete and metal');
  world.defaultContactMaterial.friction = 0.52;
  world.defaultContactMaterial.restitution = 0.24;
  world.addContactMaterial(new CANNON.ContactMaterial(physicsMaterial, physicsMaterial, {
    friction: 0.52, restitution: 0.24,
  }));
  const floor = new CANNON.Body({ mass: 0, material: physicsMaterial });
  floor.addShape(new CANNON.Plane());
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  floor.position.y = groundHeightAt(0, 0);
  world.addBody(floor);
  const obstacles = colliders.map(({ x, y, z, sx, sy, sz }) => {
    const center = new THREE.Vector3(x, y, z);
    const size = new THREE.Vector3(sx, sy, sz);
    const body = new CANNON.Body({ mass: 0, material: physicsMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)));
    body.position.set(x, y, z);
    world.addBody(body);
    return new THREE.Box3().setFromCenterAndSize(center, size);
  });
  const streetGrid=new Map(),streetTiles=new Map(),streetCell=16;
  const staticShapes=[...streetColliders,...groundSurfaces],groundSet=new Set(groundSurfaces);
  let groundIndex=0;
  for(const spec of staticShapes){
    if(![spec.x,spec.y,spec.z,spec.sx,spec.sy,spec.sz].every(Number.isFinite)||Math.min(spec.sx,spec.sy,spec.sz)<=0)continue;
    const tx=Math.floor(spec.x/8),tz=Math.floor(spec.z/8),key=groundSet.has(spec)?'ground-'+groundIndex++:tx+','+tz;
    let tile=streetTiles.get(key);
    if(!tile){tile=new CANNON.Body({mass:0,material:physicsMaterial});tile.position.set(tx*8+4,0,tz*8+4);streetTiles.set(key,tile);}
    tile.addShape(new CANNON.Box(new CANNON.Vec3(spec.sx/2,spec.sy/2,spec.sz/2)),
      new CANNON.Vec3(spec.x-tile.position.x,spec.y,spec.z-tile.position.z),new CANNON.Quaternion().setFromEuler(0,spec.ry||0,0));
    const cosine=Math.abs(Math.cos(spec.ry||0)),sine=Math.abs(Math.sin(spec.ry||0)),hx=(spec.sx*cosine+spec.sz*sine)/2,hz=(spec.sz*cosine+spec.sx*sine)/2;
    const record={...spec,isGround:groundSet.has(spec),center:new THREE.Vector3(spec.x,spec.y,spec.z),inverse:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-(spec.ry||0)),
      local:new THREE.Box3(new THREE.Vector3(-spec.sx/2,-spec.sy/2,-spec.sz/2),new THREE.Vector3(spec.sx/2,spec.sy/2,spec.sz/2))};
    for(let x=Math.floor((spec.x-hx)/streetCell);x<=Math.floor((spec.x+hx)/streetCell);x++)for(let z=Math.floor((spec.z-hz)/streetCell);z<=Math.floor((spec.z+hz)/streetCell);z++){
      const gridKey=x+','+z;if(!streetGrid.has(gridKey))streetGrid.set(gridKey,[]);streetGrid.get(gridKey).push(record);
    }
  }
  for(const body of streetTiles.values())world.addBody(body);
  const streetPhysics=createStreetPhysics({scene,world,material:physicsMaterial,props:dynamicProps,groundHeightAt});
  civilians?.attachPhysics?.({world,material:physicsMaterial,groundHeightAt});
  const streetRay=new THREE.Ray(),streetOrigin=new THREE.Vector3(),streetDirection=new THREE.Vector3(),streetPoint=new THREE.Vector3();
  function streetDistance(origin,direction,maximum){
    const endX=origin.x+direction.x*maximum,endZ=origin.z+direction.z*maximum,seen=new Set();let nearest=maximum;
    for(let x=Math.floor(Math.min(origin.x,endX)/streetCell);x<=Math.floor(Math.max(origin.x,endX)/streetCell);x++)for(let z=Math.floor(Math.min(origin.z,endZ)/streetCell);z<=Math.floor(Math.max(origin.z,endZ)/streetCell);z++){
      for(const shape of streetGrid.get(x+','+z)||[]){
        if(seen.has(shape))continue;seen.add(shape);
        streetOrigin.copy(origin).sub(shape.center).applyQuaternion(shape.inverse);streetDirection.copy(direction).applyQuaternion(shape.inverse);streetRay.set(streetOrigin,streetDirection);
        if(shape.local.containsPoint(streetOrigin))return 0;
        if(streetRay.intersectBox(shape.local,streetPoint))nearest=Math.min(nearest,streetOrigin.distanceTo(streetPoint));
      }
    }return nearest;
  }

  const ownedGeometries = [];
  const ownedMaterials = [];
  const ownGeometry = (geometry) => { ownedGeometries.push(geometry); return geometry; };
  const material = (color, emissive = 0x000000, intensity = 0) => {
    const value = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.65, metalness: 0.4 });
    ownedMaterials.push(value);
    return value;
  };
  const boxGeometry = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
  const shellMat = material(0x253440);
  const orangeMat = material(0x713318, 0xff5c18, 0.32);
  const cyanMat = material(0x14ddde, 0x06ffff, 3);
  const pinkMat = material(0xce3478, 0xff0a71, 2);
  const blackMat = material(0x101e2b);
  const debrisMaterials = [shellMat, blackMat, orangeMat, pinkMat, cyanMat];
  const supplySupports = createSupplySupportLayout();
  const temp = new THREE.Vector3();
  const impactPoint = new THREE.Vector3();
  const ray = new THREE.Ray();
  const drones = [];
  const crates = [];
  const reportedCivilianDeaths = new Set();
  const debris = [];
  const effects = [];
  let elapsed = 0;
  let kills = 0;
  let wantedLevel = 0;
  let heat = 0;
  let crimeReason = '';
  let securityState = 'PATROL';
  let lastCrimeAt = -Infinity;
  let unseenTime = 0;
  let searchRemaining = 0;
  const lastKnownPosition = new THREE.Vector3();
  let disposed = false;

  const emit = (type, details = {}) => onEvent({ type, ...details });

  function cube(parent, scale, position, mat) {
    const mesh = new THREE.Mesh(boxGeometry, mat);
    mesh.scale.set(...scale);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function template(kind, height) {
    const result = new THREE.Group();
    if (assets[kind]) {
      const model = assets[kind].clone(true);
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = height / Math.max(size.y, 0.01);
      model.scale.multiplyScalar(scale);
      model.position.sub(center.multiplyScalar(scale));
      model.position.y += height / 2;
      model.traverse((child) => {
        if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
      });
      result.add(model);
    } else if (kind === 'drone') {
      cube(result, [1.1, 0.45, 0.72], [0, 0.24, 0], shellMat);
      cube(result, [0.62, 0.17, 0.1], [0, 0.27, 0.4], cyanMat);
      for (const side of [-1, 1]) {
        cube(result, [0.46, 0.2, 0.96], [side * 0.85, 0.2, 0], blackMat);
        cube(result, [0.26, 0.08, 0.55], [side * 0.85, 0.07, 0], cyanMat);
      }
    } else {
      cube(result, [1.25, 1.25, 1.25], [0, 0.625, 0], orangeMat);
      for (const side of [-1, 1]) {
        cube(result, [0.11, 1.31, 1.31], [side * 0.4, 0.65, 0], blackMat);
      }
      cube(result, [0.64, 0.15, 0.05], [0, 0.82, 0.65], pinkMat);
    }
    return result;
  }

  // Supply stacks live beside loading bays; the boulevard remains unobstructed.
  const foundationGroup = new THREE.Group();
  foundationGroup.name = 'Supply loading foundations';
  group.add(foundationGroup);
  for (const support of supplySupports.foundations) {
    cube(foundationGroup, [support.sx - 0.04, support.sy - 0.05, support.sz - 0.04],
      [support.x, support.groundY + (support.sy - 0.05) / 2, support.z], blackMat);
    cube(foundationGroup, [support.sx, 0.05, support.sz], [support.x, support.topY - 0.025, support.z], shellMat);
    const body = new CANNON.Body({ mass: 0, material: physicsMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(support.sx / 2, support.sy / 2, support.sz / 2)));
    body.position.set(support.x, support.y, support.z);
    world.addBody(body);
  }
  const crateLocations = [];
  [-17, -49, -82, -113, -140].forEach((z, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    crateLocations.push([side * 11.1, z, 0.3], [side * 12.65, z, 0.3],
      [side * 12.65, z - 1.55, 0.3], [side * 12.65, z, 1.7]);
  });
  crateLocations.forEach(([x, z, base], index) => {
    const visual = template('crate', 1.35);
    visual.position.set(x, base + 0.02, z);
    // This thin stacking board belongs to the upper cell and disappears with it,
    // preserving a physical connection without leaving a floating spacer behind.
    if (base > 1) cube(visual, [1.5, 0.05, 1.5], [0, -0.025, 0], shellMat);
    group.add(visual);
    const center = new THREE.Vector3(x, base + 0.7, z);
    const bounds = new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(1.5, 1.4, 1.5));
    const body = new CANNON.Body({ mass: 0, material: physicsMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.75, 0.7, 0.75)));
    body.position.set(x, base + 0.7, z);
    world.addBody(body);
    crates.push({ index, visual, center, bounds, body, health: 2, destroyed: false, chainAt: 0 });
  });

  const legacyPatrols = [[0, 3.8, -28], [-3, 4.3, -55], [3, 3.7, -90], [0, 4.2, -120]];
  const configuredPatrols = patrolRoutes.filter(route => Array.isArray(route.points)
    && route.points.some(point => Number.isFinite(point.x) && Number.isFinite(point.z)));
  const patrolDefinitions = configuredPatrols.length ? configuredPatrols : legacyPatrols.map(([x, height, z]) => ({
    region: 'Kasumi Ward', height, points: [{ x, z }],
  }));
  patrolDefinitions.forEach((definition, index) => {
    const height = Number.isFinite(definition.height) ? definition.height : 4.1 + index % 3 * 0.2;
    const routePoints = definition.points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.z))
      .map(point => new THREE.Vector3(THREE.MathUtils.clamp(point.x, travelBounds.minX, travelBounds.maxX), height,
        THREE.MathUtils.clamp(point.z, travelBounds.minZ, travelBounds.maxZ)));
    const position = routePoints[0];
    const visual = template('drone', 0.7);
    visual.name = `City security patrol ${index + 1}`;
    visual.position.copy(position);
    group.add(visual);
    const statusMaterials = [];
    visual.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const recolor = (source) => {
        if (!source.emissive || source.emissive.getHex() === 0 || source.emissiveIntensity === 0) return source;
        const copy = source.clone();
        copy.emissive.setHex(0x23e6ff);
        if (copy.color) copy.color.setHex(0x42dce5);
        ownedMaterials.push(copy);
        statusMaterials.push(copy);
        return copy;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(recolor) : recolor(mesh.material);
    });
    const glow = new THREE.PointLight(0x23e6ff, 2, 4, 2);
    glow.position.y = 0.25;
    visual.add(glow);
    const healthGroup = new THREE.Group();
    healthGroup.position.y = 1.3;
    healthGroup.visible = false;
    visual.add(healthGroup);
    const healthPips = [];
    for (let i = 0; i < 3; i++) healthPips.push(cube(healthGroup, [0.25, 0.07, 0.05], [(i - 1) * 0.32, 0, 0], pinkMat));
    drones.push({ index, visual, home: position.clone(), region: definition.region || 'Kasumi Ward',
      routePoints, routeIndex: routePoints.length > 1 ? 1 : 0,
      patrolSpeed: THREE.MathUtils.clamp(definition.speed || 5.2, 2, 8),
      responsePosition: position.clone(), responding: false, responseUntil: 0,
      health: 3, alive: true, disabledUntil: 0,
      fireAt: 2 + index * 0.6, pendingShotAt: 0, hostile: false, seesPlayer: false,
      healthGroup, healthPips, glow, statusMaterials });
  });

  function blocked(origin, direction, distance) {
    ray.set(origin, direction);
    for (const obstacle of obstacles) {
      if (obstacle.containsPoint(origin)) return true;
      if (ray.intersectBox(obstacle, impactPoint) && impactPoint.distanceTo(origin) < distance - 0.08) return true;
    }
    return streetDistance(origin,direction,distance)<distance-.08||Boolean(streetPhysics.raycast(origin,direction,distance-.08))||
      getExternalSolids().some(box=>Boolean(shotOrientedBox(origin,direction,box,distance-.08)));
  }

  function dronePositionBlocked(x, y, z) {
    if (x < travelBounds.minX || x > travelBounds.maxX || z < travelBounds.minZ || z > travelBounds.maxZ) return true;
    return obstacles.some(box => x + 1.15 > box.min.x && x - 1.15 < box.max.x
      && y + 1 > box.min.y && y - 0.2 < box.max.y
      && z + 0.85 > box.min.z && z - 0.85 < box.max.z);
  }

  function shotBox(origin,direction,box,maximum) {
    // Ray.intersectBox returns the exit face when the origin is inside. A gun
    // inside cover must be blocked at zero distance, never shoot out of the wall.
    if(box.containsPoint(origin))return {point:origin.clone(),distance:0,normal:direction.clone().negate()};
    const point=new THREE.Ray(origin,direction).intersectBox(box,new THREE.Vector3());
    if(!point)return null;const distance=origin.distanceTo(point);if(distance>maximum+1e-7)return null;
    let best=Infinity,normal=new THREE.Vector3();
    for(const axis of ['x','y','z'])for(const side of [-1,1]) {
      const gap=Math.abs(point[axis]-(side<0?box.min[axis]:box.max[axis]));
      if(gap<best){best=gap;normal.set(0,0,0);normal[axis]=side;}
    }
    return {point,distance,normal};
  }

  function shotOrientedBox(origin,direction,box,maximum) {
    // Fixtures retain their exact rotating/translated shape, including an
    // inside-cover hit at zero distance. Do not fill the open space in a frame.
    if(maximum<0)return null;
    const dx=origin.x-box.x,dy=origin.y-box.y,dz=origin.z-box.z;
    const along=THREE.MathUtils.clamp(-(dx*direction.x+dy*direction.y+dz*direction.z),0,maximum);
    const radius=Math.hypot(box.sx,box.sy,box.sz)/2;
    if((dx+direction.x*along)**2+(dy+direction.y*along)**2+(dz+direction.z*along)**2>radius*radius+1e-7)return null;
    const center=new THREE.Vector3(box.x,box.y,box.z),offset=new THREE.Vector3(dx,dy,dz);
    const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),box.ry||0),inverse=rotation.clone().invert();
    const local=new THREE.Box3(new THREE.Vector3(-box.sx/2,-box.sy/2,-box.sz/2),new THREE.Vector3(box.sx/2,box.sy/2,box.sz/2));
    const contact=shotBox(offset.applyQuaternion(inverse),direction.clone().applyQuaternion(inverse),local,maximum);
    if(contact){contact.point.applyQuaternion(rotation).add(center);contact.normal.applyQuaternion(rotation);}
    return contact;
  }

  /** Side-effect-free closest shot target. All vectors are independent copies. */
  function traceShot(origin,direction,maximum=110) {
    if(![origin?.x,origin?.y,origin?.z,direction?.x,direction?.y,direction?.z,maximum].every(Number.isFinite)||maximum<0)
      throw new TypeError('traceShot requires finite vectors and a nonnegative range');
    const start=new THREE.Vector3(origin.x,origin.y,origin.z),dir=new THREE.Vector3(direction.x,direction.y,direction.z).normalize();
    let distance=dir.lengthSq()>0?maximum:0,target=null,targetType='',normal=null,point=start.clone().addScaledVector(dir,distance);
    const accept=(contact,type,object)=>{
      if(!contact||contact.distance<0||contact.distance>maximum+1e-7)return;
      if(contact.distance<distance-1e-7||(!targetType&&contact.distance<=distance+1e-7)) {
        distance=contact.distance;point=contact.point.clone();normal=contact.normal?.clone()||dir.clone().negate();targetType=type;target=object;
      }
    };
    for(const obstacle of obstacles)accept(shotBox(start,dir,obstacle,distance),'wall',obstacle);
    // The physical base plane and the actual raised pavement slabs both stop fire.
    if(start.y<=floor.position.y+1e-7)accept({point:start.clone(),distance:0,normal:new THREE.Vector3(0,1,0)},'ground',floor);
    else if(dir.y< -1e-8) {
      const d=(floor.position.y-start.y)/dir.y;
      if(d<=distance)accept({point:start.clone().addScaledVector(dir,d),distance:d,normal:new THREE.Vector3(0,1,0)},'ground',floor);
    }
    const end=start.clone().addScaledVector(dir,distance),seen=new Set();
    for(let x=Math.floor(Math.min(start.x,end.x)/streetCell);x<=Math.floor(Math.max(start.x,end.x)/streetCell);x++)for(let z=Math.floor(Math.min(start.z,end.z)/streetCell);z<=Math.floor(Math.max(start.z,end.z)/streetCell);z++) {
      for(const shape of streetGrid.get(x+','+z)||[]) {
        if(seen.has(shape))continue;seen.add(shape);
        const localOrigin=start.clone().sub(shape.center).applyQuaternion(shape.inverse),localDirection=dir.clone().applyQuaternion(shape.inverse);
        const contact=shotBox(localOrigin,localDirection,shape.local,distance);
        if(contact){const rotation=shape.inverse.clone().invert();contact.point.applyQuaternion(rotation).add(shape.center);contact.normal.applyQuaternion(rotation);}
        accept(contact,shape.isGround?'ground':'street-solid',shape);
      }
    }
    for(const drone of drones)if(drone.alive) {
      const bounds=new THREE.Box3().setFromCenterAndSize(drone.visual.position.clone().add(new THREE.Vector3(0,.4,0)),new THREE.Vector3(2.3,1.2,1.7));
      accept(shotBox(start,dir,bounds,distance),'drone',drone);
    }
    for(const crate of crates)if(!crate.destroyed)accept(shotBox(start,dir,crate.bounds,distance),'crate',crate);
    for(const prop of streetPhysics.getColliders()) {
      const bounds=new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(prop.x,prop.y,prop.z),new THREE.Vector3(prop.sx,prop.sy,prop.sz));
      accept(shotBox(start,dir,bounds,distance),'street-prop',prop);
    }
    for(const fixture of getExternalSolids())accept(shotOrientedBox(start,dir,fixture,distance),'street-solid',fixture);
    // Tiny tolerance includes a body exactly at the camera's selected aim point,
    // while accept() keeps any equally near opaque cover in front of that body.
    const person=civilians?.raycast(start,dir,distance+(targetType?0:1e-7));
    if(person&&Number.isFinite(person.distance))accept({point:start.clone().addScaledVector(dir,person.distance),distance:person.distance,normal:person.normal},person.corpse?'civilian-corpse':'civilian',person);
    return {point,distance,targetType,target,normal};
  }

  function setDroneStatus(drone, hostile) {
    drone.hostile = hostile;
    const color = hostile ? 0xff2969 : 0x23e6ff;
    drone.glow.color.setHex(color);
    drone.statusMaterials.forEach((mat) => {
      mat.emissive.setHex(color);
      if (mat.color) mat.color.setHex(hostile ? 0xeb457c : 0x42dce5);
    });
    drone.healthGroup.visible = hostile && drone.alive;
  }

  function dispatchDrone(drone, position) {
    if (!drone.responding) {
      drone.pendingShotAt = 0;
      drone.fireAt = elapsed + 1.4 + drone.index % 3 * 0.2;
    }
    drone.responding = true;
    drone.responsePosition.copy(position);
    drone.responseUntil = elapsed + 18;
    if (!drone.hostile) setDroneStatus(drone, true);
  }

  function reportCrime(type, severity = 1, position = null) {
    const previousLevel = wantedLevel;
    const previousReason = crimeReason;
    const previousCrimeAt = lastCrimeAt;
    const weight = THREE.MathUtils.clamp(Number.isFinite(severity) ? severity : 1, 1, 3);
    heat = Math.min(100, heat + 22 * weight);
    wantedLevel = heat >= 66 ? 3 : heat >= 40 ? 2 : 1;
    crimeReason = String(type || 'PUBLIC DISTURBANCE').replaceAll('_', ' ').toUpperCase();
    lastCrimeAt = elapsed;
    unseenTime = 0;
    searchRemaining = 25;
    securityState = 'SEARCHING';
    if (position) lastKnownPosition.copy(position);
    for (const drone of drones) {
      if (!drone.alive) continue;
      // A district alert dispatches nearby patrols. Distant patrols retain their
      // route until they actually encounter the wanted player in their district.
      if (drone.visual.position.distanceTo(lastKnownPosition) < 90) dispatchDrone(drone, lastKnownPosition);
    }
    emit('crime', { reason: crimeReason, wantedLevel, level: wantedLevel, heat });
    if (previousLevel !== wantedLevel || previousReason !== crimeReason || elapsed - previousCrimeAt > 2) {
      emit('toast', { text: `SECURITY ALERT ${wantedLevel}  //  ${crimeReason}` });
    }
    return wantedLevel;
  }

  function clearWanted() {
    wantedLevel = 0;
    heat = 0;
    crimeReason = '';
    securityState = 'PATROL';
    unseenTime = 0;
    searchRemaining = 0;
    for (const drone of drones) {
      drone.pendingShotAt = 0;
      drone.seesPlayer = false;
      drone.responding = false;
      drone.responseUntil = 0;
      setDroneStatus(drone, false);
    }
    emit('wantedCleared');
    emit('toast', { text: 'SECURITY ALERT CLEARED  //  PATROLS RESUMED' });
  }

  function removeEffect(index) {
    const effect = effects[index];
    group.remove(effect.visual);
    effect.visual.geometry?.dispose();
    effect.visual.material?.dispose();
    effects.splice(index, 1);
  }

  function line(start, end, color, lifetime = 0.1, opacity = 0.9) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const visual = new THREE.Line(geometry, mat);
    group.add(visual);
    effects.push({ visual, life: lifetime, maxLife: lifetime, type: 'line', opacity });
    while (effects.length > 80) removeEffect(0);
  }

  function pulse(position, color, radius, lifetime = 0.55) {
    const geometry = new THREE.SphereGeometry(1, 16, 8);
    const mat = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.65, depthWrite: false });
    const visual = new THREE.Mesh(geometry, mat);
    visual.position.copy(position);
    group.add(visual);
    effects.push({ visual, life: lifetime, maxLife: lifetime, type: 'pulse', radius, opacity: 0.65 });
    while (effects.length > 80) removeEffect(0);
  }

  function removeDebris(index) {
    const piece = debris[index];
    world.removeBody(piece.body);
    group.remove(piece.visual);
    debris.splice(index, 1);
  }

  function breakVoxels(center, power = 1, count = 28, direction = null) {
    for (let i = 0; i < count; i++) {
      while (debris.length >= 120) removeDebris(0);
      const size = 0.18 + Math.random() * 0.19;
      const visual = new THREE.Mesh(boxGeometry, debrisMaterials[i % debrisMaterials.length]);
      visual.scale.setScalar(size);
      visual.castShadow = true;
      visual.receiveShadow = true;
      const body = new CANNON.Body({ mass: size * size * size * 90, material: physicsMaterial,
        linearDamping: 0.13, angularDamping: 0.21, allowSleep: true, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.8 });
      body.addShape(new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2)));
      const dx = (i % 4 - 1.5) * 0.3;
      const dy = (Math.floor(i / 4) % 3 - 1) * 0.3;
      const dz = (Math.floor(i / 12) - 1) * 0.3;
      body.position.set(center.x + dx, Math.max(size, center.y + dy), center.z + dz);
      body.quaternion.setFromEuler(Math.random(), Math.random(), Math.random());
      const outward = new CANNON.Vec3(dx + (Math.random() - 0.5) * 0.5, 0.65 + Math.random() * 0.7, dz + (Math.random() - 0.5) * 0.5);
      outward.normalize();
      outward.scale((3 + Math.random() * 5) * power * body.mass, outward);
      if (direction) {
        outward.x += direction.x * body.mass * power * 4;
        outward.z += direction.z * body.mass * power * 4;
      }
      world.addBody(body);
      body.applyImpulse(outward);
      body.angularVelocity.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
      visual.position.copy(body.position);
      visual.quaternion.copy(body.quaternion);
      group.add(visual);
      debris.push({ visual, body, size, expireAt: elapsed + 10 + Math.random() * 6 });
    }
  }

  function damageDrone(drone, amount, direction = null, showPulse = true) {
    if (!drone.alive) return;
    drone.health -= amount;
    drone.healthPips.forEach((pip, index) => { pip.visible = index < drone.health; });
    if(showPulse)pulse(drone.visual.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 0xff3477, 1.3, 0.17);
    if (drone.health <= 0) {
      drone.alive = false;
      drone.visual.visible = false;
      drone.pendingShotAt = 0;
      kills++;
      breakVoxels(drone.visual.position, 1.2, 24, direction);
      if(showPulse)pulse(drone.visual.position, 0xff7040, 3.6, 0.32);
      emit('toast', { text: `SENTINEL NEUTRALIZED  //  ${kills}/${drones.length}` });
      emit('kill', { kills });
    }
  }

  function destroyCrate(crate, power = 1, direction = null, showPulse = true) {
    if (crate.destroyed) return;
    crate.destroyed = true;
    crate.visual.visible = false;
    crate.chainAt = 0;
    world.removeBody(crate.body);
    breakVoxels(crate.center, power, 32, direction);
    if(showPulse)pulse(crate.center, 0xff672b, 3.4 * power, 0.35);
    emit('explosion', { position: crate.center.clone() });
    for (const nearby of crates) {
      if (!nearby.destroyed && !nearby.chainAt && nearby.center.distanceTo(crate.center) < 4) {nearby.chainAt = elapsed + 0.15 + Math.random() * 0.1;nearby.chainPulse=showPulse;}
    }
    for (const drone of drones) {
      if (drone.alive && drone.visual.position.distanceTo(crate.center) < 5) damageDrone(drone, 2, direction, showPulse);
    }
  }

  function shoot(aimOrigin, aimDirection, {muzzleOrigin} = {}) {
    const eye=new THREE.Vector3(aimOrigin.x,aimOrigin.y,aimOrigin.z),origin=muzzleOrigin?new THREE.Vector3(muzzleOrigin.x,muzzleOrigin.y,muzzleOrigin.z):eye.clone();
    const aim=traceShot(eye,aimDirection),aimPoint=aim.point.clone();
    let dir=aimPoint.clone().sub(origin);
    if(dir.lengthSq()<1e-12)dir.set(aimDirection.x,aimDirection.y,aimDirection.z);
    dir.normalize();
    let actual=traceShot(origin,dir,origin.distanceTo(aimPoint));
    const eyeToMuzzle=origin.clone().sub(eye),mountDistance=eyeToMuzzle.length();
    let obstructed=false;
    if(mountDistance>1e-6) {
      const guard=traceShot(eye,eyeToMuzzle.normalize(),mountDistance);
      if(guard.targetType&&guard.distance<mountDistance-1e-5) {
        obstructed=true;
        // The barrel may visually extend through a thin wall. Keep the shot on
        // the near cover surface and never damage the target beyond that cover.
        // Containment in an opaque solid already blocks at the muzzle. A
        // zero-distance damageable target beyond cover must still lose to it.
        const muzzleInsideCover=actual.distance<=1e-7&&['wall','street-solid','ground'].includes(actual.targetType);
        if(!muzzleInsideCover) {
          actual=guard.distance<=1e-7?{...guard,point:origin.clone(),distance:0}:{...guard,distance:origin.distanceTo(guard.point)};
          if(actual.distance>1e-7)dir.copy(actual.point).sub(origin).normalize();
        }
      }
    }
    const {point,distance,normal}=actual;
    let target=actual.target,targetType=actual.targetType;
    obstructed=obstructed||point.distanceTo(aimPoint)>.002;
    let civilianResult = null;
    if (targetType === 'civilian') {
      civilianResult = civilians.damage(target.id, 60, { direction: dir.clone(), cause: 'gunshot', speed: 0 });
      if (!civilianResult?.hit) { target = null; targetType = ''; }
    }
    const offense = targetType === 'civilian'
      ? civilianResult.killed ? 'CIVILIAN HOMICIDE' : 'ASSAULT ON CIVILIAN'
      : targetType === 'drone' ? 'ASSAULT ON SECURITY' : targetType === 'crate'||targetType==='street-prop' ? 'PROPERTY DAMAGE' : 'PUBLIC WEAPON DISCHARGE';
    const severity = targetType === 'civilian' ? civilianResult.killed ? 3 : 2 : targetType === 'drone' ? 2 : 1;
    reportCrime(offense, severity, origin);
    if (targetType === 'drone') damageDrone(target, 1, dir, false);
    if (targetType === 'crate') { target.health--; if (target.health <= 0) destroyCrate(target, 1.1, dir, false); }
    if (targetType === 'street-prop') streetPhysics.shoot(target.id,point,dir);
    if (targetType === 'civilian-corpse') civilians.impulse?.(target.id,dir,point);
    if (targetType === 'civilian') civilianFeedback(target.id, 60, civilianResult.killed, point, dir, 'gunshot', 0);
    const hit=Boolean(target)&&['drone','crate','street-prop','civilian','civilian-corpse'].includes(targetType);
    if(targetType!=='civilian'&&hit)emit('hit', { targetType });
    const record={hit,point:point.clone(),targetType,origin:origin.clone(),direction:dir.clone(),aimPoint,obstructed,distance,normal:normal?.clone()||null,
      ...(targetType==='civilian'?{civilianId:target.id,killed:Boolean(civilianResult.killed)}:{})};
    emit('shot',record);
    return record;
  }

  function emp(position) {
    reportCrime('UNAUTHORIZED EMP DISCHARGE', 2, position);
    pulse(position, 0x23f1ff, 20, 0.8);
    let affected = 0;
    for (const drone of drones) {
      if (drone.alive && drone.visual.position.distanceTo(position) < 20) {
        drone.disabledUntil = elapsed + 7;
        drone.pendingShotAt = 0;
        damageDrone(drone, 2);
        affected++;
      }
    }
    for (const crate of crates) {
      if (!crate.destroyed && crate.center.distanceTo(position) < 20) { destroyCrate(crate, 1.4); affected++; }
    }
    emit('toast', { text: affected ? `EMP OVERLOAD  //  ${affected} SYSTEMS HIT` : 'EMP DISCHARGED  //  NO TARGETS IN RANGE' });
    return affected;
  }

  function ram(position, speed) {
    if (Math.abs(speed) < 6) return false;
    let hit = false;
    for (const crate of crates) {
      if (!crate.destroyed && Math.hypot(position.x - crate.center.x, position.z - crate.center.z) < 2.5) {
        const direction = crate.center.clone().sub(position).normalize();
        destroyCrate(crate, Math.min(2.4, Math.abs(speed) / 10), direction);
        hit = true;
      }
    }
    if (hit) reportCrime('VEHICULAR PROPERTY DAMAGE', 1, position);
    return hit;
  }

  function civilianFeedback(id, damage, killed, point, direction, cause, speed) {
    const details = { id, targetType: 'civilian', damage, killed: Boolean(killed),
      point: point.clone(), position: point.clone(), direction: direction.clone(), cause, speed };
    emit('hit', details);
    emit('civilianHit', details);
    if (cause === 'vehicle') emit('civilianImpact', details);
    if (killed && !reportedCivilianDeaths.has(id)) {
      reportedCivilianDeaths.add(id);
      emit('civilianKilled', { ...details, civilianCasualties: civilians.getState().dead });
    }
  }

  /** Called after an accepted car movement segment; never from bumper probes. */
  function ramCivilians(from, to, yaw, speed) {
    if (!civilians || !Number.isFinite(speed) || !Number.isFinite(yaw)) return [];
    const movement = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
    if (movement.lengthSq() < 1e-10) return [];
    // Actual displacement determines the impulse direction, including reverse
    // travel and partial/sliding movement resolved by the vehicle controller.
    const direction = movement.normalize();
    const impacts = civilians.vehicleImpact(from, to, { yaw, speed, halfWidth: 1.45, halfLength: 2.64 }) || [];
    // Slow accepted motion still updates the civilian contact latch, so backing
    // away below the damage threshold releases it for a later separate impact.
    if (Math.abs(speed) < 4) return [];
    const processed = [], seen = new Set();
    for (const impact of impacts) {
      if (!impact || seen.has(impact.id) || !(impact.damage > 0) || reportedCivilianDeaths.has(impact.id)) continue;
      seen.add(impact.id);
      const point = impact.point ? new THREE.Vector3(impact.point.x, impact.point.y, impact.point.z) : to.clone();
      civilianFeedback(impact.id, impact.damage, impact.killed, point, direction, 'vehicle', speed);
      pulse(point, 0xffc18c, 0.32, 0.15);
      reportCrime(impact.killed ? 'VEHICULAR HOMICIDE' : 'VEHICULAR ASSAULT', impact.killed ? 3 : 2, to);
      processed.push(impact);
    }
    return processed;
  }

  function ramStreet(from,to,yaw,speed){
    const hits=streetPhysics.ram(from,to,{yaw,speed});
    if(hits.length){
      if(Math.abs(speed)>=6)reportCrime('VEHICULAR PROPERTY DAMAGE',1,to);
      for(const hit of hits)emit('streetImpact',{...hit,position:hit.point});
    }return hits;
  }

  function update(dt, time, player) {
    if (disposed) return;
    const delta = Math.min(Math.max(dt, 0), 0.1);
    // Combat time advances only while the caller runs the simulation. The visual
    // scene clock may continue during menus; using it here would expire EMPs and
    // drone wind-ups while paused and remove the initial combat grace period.
    elapsed += delta;
    // Jointed bodies need more contact convergence than loose street props.
    // Use the measured higher budget only while an articulated assembly is
    // awake; persistent sleeping or simplified remains keep the normal cost.
    world.solver.iterations = civilians?.needsArticulatedSolver?.()
      ? ARTICULATED_SOLVER_ITERATIONS : BASE_SOLVER_ITERATIONS;
    world.step(1 / 60, delta, 4);
    streetPhysics.update(delta);
    for (let i = debris.length - 1; i >= 0; i--) {
      const piece = debris[i];
      if (elapsed >= piece.expireAt || piece.body.position.y < -20) { removeDebris(i); continue; }
      piece.visual.position.copy(piece.body.position);
      piece.visual.quaternion.copy(piece.body.quaternion);
      const remaining = piece.expireAt - elapsed;
      piece.visual.scale.setScalar(piece.size * Math.min(1, remaining / 0.8));
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i];
      effect.life -= delta;
      if (effect.life <= 0) { removeEffect(i); continue; }
      const progress = 1 - effect.life / effect.maxLife;
      effect.visual.material.opacity = effect.opacity * (1 - progress);
      if (effect.type === 'pulse') effect.visual.scale.setScalar(0.1 + progress * effect.radius);
    }
    for (const crate of crates) {
      if (crate.chainAt && elapsed >= crate.chainAt) destroyCrate(crate, 1.15, null, crate.chainPulse!==false);
    }
    if (!player?.position) return;
    const playerTarget = player.position.clone();
    playerTarget.y = Math.max(playerTarget.y, 1.1);
    let observed = false;
    // Neutral patrols never acquire the player as a target. Wanted searches use
    // only actual sight and a remembered location, never an occluded live target.
    for (const drone of drones) {
      drone.seesPlayer = false;
      if (!wantedLevel || !drone.alive || elapsed < drone.disabledUntil || player.dead) continue;
      const gun = drone.visual.position.clone().add(new THREE.Vector3(0, 0.25, 0));
      const aim = playerTarget.clone().sub(gun);
      const distance = aim.length();
      drone.seesPlayer = distance < 35 && !blocked(gun, aim.normalize(), distance);
      if (drone.seesPlayer) dispatchDrone(drone, playerTarget);
      else if (drone.responding && elapsed > drone.responseUntil) {
        drone.responding = false;
        drone.pendingShotAt = 0;
      }
      observed ||= drone.seesPlayer;
    }
    if (wantedLevel > 0) {
      if (observed) {
        lastKnownPosition.copy(playerTarget);
        unseenTime = 0;
        searchRemaining = 0;
        securityState = 'PURSUIT';
      } else {
        unseenTime += delta;
        securityState = 'SEARCHING';
        searchRemaining = Math.max(0, 25 - (elapsed - lastCrimeAt), 8 - unseenTime);
        if (elapsed - lastCrimeAt >= 25 - 1e-6 && unseenTime >= 8 - 1e-6) clearWanted();
      }
    }
    for (const drone of drones) {
      if (!drone.alive) continue;
      const disabled = elapsed < drone.disabledUntil;
      const hostile = wantedLevel > 0 && drone.responding;
      if (drone.hostile !== hostile) setDroneStatus(drone, hostile);
      drone.glow.color.setHex(disabled ? 0x23ffff : hostile ? 0xff2969 : 0x23e6ff);
      drone.glow.intensity = disabled ? 0.4 + Math.sin(elapsed * 17) * 0.25 : 2;
      if (disabled) {
        drone.pendingShotAt = 0;
        drone.visual.rotation.z = Math.sin(elapsed * 14) * 0.12;
        drone.visual.position.y = THREE.MathUtils.damp(drone.visual.position.y, 2.2 + Math.sin(elapsed * 3) * 0.06, 2, delta);
        continue;
      }
      let targetX = drone.home.x + Math.sin(elapsed * 0.5 + drone.index * 2) * 2;
      let targetZ = drone.home.z + Math.cos(elapsed * 0.3 + drone.index) * 3;
      let movementSpeed = drone.patrolSpeed;
      if (drone.routePoints.length > 1) {
        let waypoint = drone.routePoints[drone.routeIndex];
        if (Math.hypot(waypoint.x - drone.visual.position.x, waypoint.z - drone.visual.position.z) < 1.5) {
          drone.routeIndex = (drone.routeIndex + 1) % drone.routePoints.length;
          waypoint = drone.routePoints[drone.routeIndex];
        }
        targetX = waypoint.x;
        targetZ = waypoint.z;
      }
      if (hostile && drone.seesPlayer) {
        temp.copy(drone.visual.position).sub(playerTarget);
        temp.y = 0;
        temp.normalize().multiplyScalar(11);
        targetX = THREE.MathUtils.clamp(playerTarget.x + temp.x, travelBounds.minX, travelBounds.maxX);
        targetZ = THREE.MathUtils.clamp(playerTarget.z + temp.z, travelBounds.minZ, travelBounds.maxZ);
        movementSpeed = 12;
      } else if (hostile) {
        targetX = THREE.MathUtils.clamp(drone.responsePosition.x + Math.sin(elapsed * 0.7 + drone.index) * 5, travelBounds.minX, travelBounds.maxX);
        targetZ = THREE.MathUtils.clamp(drone.responsePosition.z + Math.cos(elapsed * 0.45 + drone.index) * 6, travelBounds.minZ, travelBounds.maxZ);
        movementSpeed = 8;
      }
      const headingX = targetX - drone.visual.position.x;
      const headingZ = targetZ - drone.visual.position.z;
      const distanceToTarget = Math.hypot(headingX, headingZ);
      const travelDistance = Math.min(distanceToTarget * (1 - Math.exp(-0.8 * delta)), movementSpeed * delta);
      const steps = Math.max(1, Math.ceil(travelDistance / 0.45));
      const stepX = distanceToTarget > 0 ? headingX / distanceToTarget * travelDistance / steps : 0;
      const stepZ = distanceToTarget > 0 ? headingZ / distanceToTarget * travelDistance / steps : 0;
      for (let step = 0; step < steps; step++) {
        const nextX = drone.visual.position.x + stepX;
        const nextZ = drone.visual.position.z + stepZ;
        if (!dronePositionBlocked(nextX, drone.visual.position.y, drone.visual.position.z)) drone.visual.position.x = nextX;
        if (!dronePositionBlocked(drone.visual.position.x, drone.visual.position.y, nextZ)) drone.visual.position.z = nextZ;
      }
      drone.visual.position.y = THREE.MathUtils.damp(drone.visual.position.y, drone.home.y + Math.sin(elapsed * 2 + drone.index) * 0.24, 2, delta);
      drone.visual.rotation.z = Math.sin(elapsed * 1.8 + drone.index) * 0.045;
      drone.visual.rotation.y = hostile && drone.seesPlayer
        ? Math.atan2(playerTarget.x - drone.visual.position.x, playerTarget.z - drone.visual.position.z)
        : Math.atan2(headingX, headingZ);
      drone.healthGroup.quaternion.copy(camera.quaternion);
      drone.healthGroup.quaternion.premultiply(drone.visual.quaternion.clone().invert());
      if (!hostile || !drone.seesPlayer || player.dead) {
        drone.pendingShotAt = 0;
        continue;
      }
      const gun = drone.visual.position.clone().add(new THREE.Vector3(0, 0.25, 0));
      const aim = playerTarget.clone().sub(gun);
      const aimDistance = aim.length();
      aim.normalize();
      const clearSight = aimDistance < 30 && !blocked(gun, aim, aimDistance);
      if (drone.pendingShotAt && elapsed >= drone.pendingShotAt) {
        drone.pendingShotAt = 0;
        if (clearSight) {
          line(gun, playerTarget, 0xff2169, 0.17);
          player.damage?.(player.inVehicle ? 4 : 7);
          emit('enemyShot', { position: gun });
        }
      }
      if (clearSight && !drone.pendingShotAt && elapsed >= drone.fireAt) {
        line(gun, playerTarget, 0xff274f, 0.35, 0.28);
        drone.pendingShotAt = elapsed + 0.38;
        drone.fireAt = elapsed + (3 - wantedLevel * 0.3) + Math.random() * 1.1;
      }
    }
  }

  function reset() {
    elapsed = 0;
    kills = 0;
    reportedCivilianDeaths.clear();
    world.solver.iterations = BASE_SOLVER_ITERATIONS;
    streetPhysics.reset();
    wantedLevel = 0;
    heat = 0;
    crimeReason = '';
    securityState = 'PATROL';
    lastCrimeAt = -Infinity;
    unseenTime = 0;
    searchRemaining = 0;
    lastKnownPosition.set(0, 0, 0);
    while (debris.length) removeDebris(debris.length - 1);
    while (effects.length) removeEffect(effects.length - 1);
    for (const crate of crates) {
      if (crate.destroyed) world.addBody(crate.body);
      crate.destroyed = false;
      crate.health = 2;
      crate.chainAt = 0;
      crate.chainPulse = true;
      crate.visual.visible = true;
    }
    for (const drone of drones) {
      drone.health = 3;
      drone.alive = true;
      drone.disabledUntil = 0;
      drone.pendingShotAt = 0;
      drone.fireAt = elapsed + 3 + drone.index * 0.6;
      drone.visual.visible = true;
      drone.visual.position.copy(drone.home);
      drone.visual.rotation.set(0, 0, 0);
      drone.healthPips.forEach((pip) => { pip.visible = true; });
      drone.seesPlayer = false;
      drone.responding = false;
      drone.responseUntil = 0;
      drone.responsePosition.copy(drone.home);
      drone.routeIndex = drone.routePoints.length > 1 ? 1 : 0;
      setDroneStatus(drone, false);
    }
    // Their spawn resolver reads the live props. Restore bins, parked wrecks
    // and destroyed crates before those positions are sampled.
    civilians?.reset();
  }

  function getState() {
    const civilianState = civilians?.getState() || { total: 0, alive: 0, dead: 0, injured: 0 };
    const regions = new Map();
    for (const drone of drones) {
      if (!regions.has(drone.region)) regions.set(drone.region, { name: drone.region, patrols: 0, responding: 0 });
      const region = regions.get(drone.region);
      region.patrols++;
      if (drone.alive && drone.hostile) region.responding++;
    }
    return {
      kills, securityKills: kills, civilianCasualties: civilianState.dead, civilians: { ...civilianState },
      streetPhysics: streetPhysics.getState(), physics: { bodies: world.bodies.length,streetTiles: streetTiles.size,streetShapes: staticShapes.length,solverIterations:world.solver.iterations },
      totalDrones: drones.length, wantedLevel, heat, crimeReason, securityState,
      searchRemaining, interactPrompt: '',
      remainingTargets: drones.filter((drone) => drone.alive).map((drone) => ({
        id: drone.index + 1, region: drone.region,
        x: drone.visual.position.x, y: drone.visual.position.y, z: drone.visual.position.z, hostile: drone.hostile,
      })),
      debrisCount: debris.length, regions: [...regions.values()],
    };
  }

  function getSolidProps() {
    return crates.filter((crate) => !crate.destroyed).map(({ bounds }) => ({
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
      z: (bounds.min.z + bounds.max.z) / 2,
      sx: bounds.max.x - bounds.min.x,
      sy: bounds.max.y - bounds.min.y,
      sz: bounds.max.z - bounds.min.z,
    })).concat(streetPhysics.getColliders(),getExternalSolids());
  }

  function dispose() {
    disposed = true;
    while (debris.length) removeDebris(debris.length - 1);
    while (effects.length) removeEffect(effects.length - 1);
    scene.remove(group);
    streetPhysics.dispose();
    ownedGeometries.forEach((geometry) => geometry.dispose());
    ownedMaterials.forEach((mat) => mat.dispose());
    world.bodies.slice().forEach((body) => world.removeBody(body));
  }

  return { world, physicsMaterial, streetPhysics, update, traceShot, shoot, emp, ram, ramCivilians, ramStreet, interact: () => false, reportCrime, reset, getState, getSolidProps,
    getSupportProps: () => supplySupports, dispose };
}
