// Named scene anchors shared by the runtime, structural blueprint and Blender.
// Dimensions include the complete visible asset, including wheels and trim.
export const SCENE_PLACEMENTS = {
  interceptor: { id:'VEHICLE-PLAYER',asset:'interceptor',role:'player vehicle spawn',mountType:'grounded',x:-3.8,y:.065,z:23.5,ry:-.2,sx:2.895,sy:1.364,sz:5.278 },
  parkedCar: { id:'VEHICLE-PARKED',asset:'interceptor',role:'parking strip',mountType:'grounded',x:-9.2,y:.065,z:-74,ry:Math.PI,sx:2.895,sy:1.364,sz:5.278 },
  mercenary: { id:'HERO-SPAWN',asset:'mercenary',role:'player spawn',mountType:'grounded',x:1.2,y:.057,z:26.8,ry:0,scale:1.12,sx:1.263,sy:2.163,sz:.824 },
  kioskWest: { id:'SHOP-WEST',asset:'kiosk',role:'noodle kiosk',mountType:'grounded',x:-13.4,y:.17,z:8,ry:Math.PI/2,sx:2,sy:2.54,sz:3.18 },
  kioskEast: { id:'SHOP-EAST',asset:'kiosk',role:'noodle kiosk',mountType:'grounded',x:13.5,y:.17,z:-58,ry:-Math.PI/2,sx:2,sy:2.54,sz:3.18 },
  patrolAV: { id:'AIRCRAFT-HERO',asset:'av',role:'hovering aircraft',mountType:'powered flight',x:14,y:33,z:-6,ry:-.25,scale:1.2,sx:7.45,sy:2.5,sz:9.48 }
};
