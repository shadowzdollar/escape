import * as CANNON from 'cannon-es';

const DYNAMIC=CANNON.Body.DYNAMIC,STATIC=CANNON.Body.STATIC,SLEEPING=CANNON.Body.SLEEPING;

/** Cached static street tiles plus a rebuilt moving-body grid. Every pair is
 * owned by its earliest active body and the lowest shared X/Z cell. This keeps
 * multicell boxes exact without allocating a string/set entry per candidate.
 */
export class StreetBroadphase extends CANNON.Broadphase {
  constructor(){super();this.useBoundingBoxes=true;this.cell=16;this.staticGrid=new Map();this.staticRecords=new Map();this.globalStatic=new Set();}
  range(body){
    if(body.aabbNeedsUpdate)body.updateAABB();
    const a=body.aabb,c=this.cell,x0=Math.floor(a.lowerBound.x/c),x1=Math.floor(a.upperBound.x/c),z0=Math.floor(a.lowerBound.z/c),z1=Math.floor(a.upperBound.z/c);
    const global=!Number.isFinite(x0+x1+z0+z1)||(x1-x0+1)*(z1-z0+1)>4096;
    return{body,x0,x1,z0,z1,global,lowX:a.lowerBound.x,highX:a.upperBound.x,lowZ:a.lowerBound.z,highZ:a.upperBound.z,
      active:body.type!==STATIC&&!(body.type===DYNAMIC&&body.sleepState===SLEEPING),order:body.index,
      civilianId:body.userData?.type==='civilian-ragdoll'?body.userData.civilianId:null};
  }
  insert(grid,record,staticBody=false){
    for(let x=record.x0;x<=record.x1;x++){
      let column=grid.get(x);if(!column){column=new Map();grid.set(x,column);}
      for(let z=record.z0;z<=record.z1;z++){let cell=column.get(z);if(!cell){cell=staticBody?new Set():[];column.set(z,cell);}if(staticBody)cell.add(record);else cell.push(record);}
    }
  }
  removeStatic(body,record){
    if(record.global)this.globalStatic.delete(record);
    else for(let x=record.x0;x<=record.x1;x++){
      const column=this.staticGrid.get(x);if(!column)continue;
      for(let z=record.z0;z<=record.z1;z++){const cell=column.get(z);cell?.delete(record);if(!cell?.size)column.delete(z);}if(!column.size)this.staticGrid.delete(x);
    }
    this.staticRecords.delete(body);
  }
  testPair(a,b,p1,p2){
    const first=a.body,second=b.body;
    if(first===second||(first.type!==DYNAMIC&&second.type!==DYNAMIC)||(b.active&&b.order<a.order))return;
    // Retired compounds release their collision bit, but still cannot collide
    // with their own umbrella. Other civilians and sleeping receivers stay solid.
    if(a.civilianId!=null&&a.civilianId===b.civilianId)return;
    if(!this.needBroadphaseCollision(first,second))return;
    this.intersectionTest(first,second,p1,p2);
  }
  collisionPairs(world,p1,p2){
    const movingGrid=new Map(),globalMoving=[],sources=[],records=new Map();
    for(const [body,r]of this.staticRecords){
      const a=body.aabb;
      // An external AABB query may have consumed aabbNeedsUpdate already.
      if(body.world!==world||body.type!==STATIC||body.aabbNeedsUpdate||a.lowerBound.x!==r.lowX||a.upperBound.x!==r.highX||a.lowerBound.z!==r.lowZ||a.upperBound.z!==r.highZ)this.removeStatic(body,r);
    }
    for(const body of world.bodies){
      let r;
      if(body.type===STATIC){
        r=this.staticRecords.get(body);
        if(!r){r=this.range(body);this.staticRecords.set(body,r);if(r.global)this.globalStatic.add(r);else this.insert(this.staticGrid,r,true);}
      }else{
        r=this.range(body);if(r.active)sources.push(r);if(r.global)globalMoving.push(r);else this.insert(movingGrid,r);
      }
      records.set(body,r);
    }
    for(const a of sources){
      if(a.body.type===DYNAMIC)for(const b of this.globalStatic)this.testPair(a,b,p1,p2);
      for(const b of globalMoving)this.testPair(a,b,p1,p2);
      // Match the former first-visit order: globals before finite world records.
      if(a.global){for(const b of records.values())if(!b.global)this.testPair(a,b,p1,p2);continue;}
      for(let x=a.x0;x<=a.x1;x++){
        const staticColumn=a.body.type===DYNAMIC?this.staticGrid.get(x):null,movingColumn=movingGrid.get(x);
        for(let z=a.z0;z<=a.z1;z++){
          for(const b of staticColumn?.get(z)||[])if(x===Math.max(a.x0,b.x0)&&z===Math.max(a.z0,b.z0))this.testPair(a,b,p1,p2);
          for(const b of movingColumn?.get(z)||[])if(x===Math.max(a.x0,b.x0)&&z===Math.max(a.z0,b.z0))this.testPair(a,b,p1,p2);
        }
      }
    }
  }
  aabbQuery(world,aabb,result=[]){for(const body of world.bodies){if(body.aabbNeedsUpdate)body.updateAABB();if(body.aabb.overlaps(aabb))result.push(body);}return result;}
}
