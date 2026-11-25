/** Cache immutable pavement footprints for the many foot, tire and prop queries.
 * This is the ground layer only: raised stairs/landings remain solid colliders,
 * so a person underneath a landing is not lifted onto its highest surface.
 */
export function createGroundHeightSampler(surfaces,{baseHeight=.057,cellSize=16}={}){
  if(!Number.isFinite(cellSize)||cellSize<=0)throw new RangeError('Ground cell size must be positive');
  const columns=new Map(),global=[];
  for(const surface of surfaces){
    const {x,y,z,sx,sy,sz}=surface,yaw=surface.ry||0;
    if(![x,y,z,sx,sy,sz,yaw].every(Number.isFinite)||sx<=0||sz<=0||sy<0)continue;
    const c=Math.cos(yaw),s=Math.sin(yaw),hx=sx/2,hz=sz/2;
    const item={x,z,c,s,hx,hz,top:y+sy/2};
    const ex=Math.abs(c)*hx+Math.abs(s)*hz,ez=Math.abs(s)*hx+Math.abs(c)*hz;
    // Expand only the indexing bounds against rounding at a rotated corner.
    // The final footprint comparison retains the original exact inequality.
    const x0=Math.floor((x-ex-1e-9)/cellSize),x1=Math.floor((x+ex+1e-9)/cellSize);
    const z0=Math.floor((z-ez-1e-9)/cellSize),z1=Math.floor((z+ez+1e-9)/cellSize);
    if((x1-x0+1)*(z1-z0+1)>4096){global.push(item);continue;}
    for(let ix=x0;ix<=x1;ix++){
      let column=columns.get(ix);if(!column){column=new Map();columns.set(ix,column);}
      for(let iz=z0;iz<=z1;iz++){
        let cell=column.get(iz);if(!cell){cell=[];column.set(iz,cell);}cell.push(item);
      }
    }
  }
  return function groundHeightAt(x,z){
    let height=baseHeight;
    const local=columns.get(Math.floor(x/cellSize))?.get(Math.floor(z/cellSize));
    if(local)for(let i=0;i<local.length;i++){
      const v=local[i],dx=x-v.x,dz=z-v.z;
      if(Math.abs(dx*v.c-dz*v.s)<=v.hx&&Math.abs(dx*v.s+dz*v.c)<=v.hz)height=Math.max(height,v.top);
    }
    for(let i=0;i<global.length;i++){
      const v=global[i],dx=x-v.x,dz=z-v.z;
      if(Math.abs(dx*v.c-dz*v.s)<=v.hx&&Math.abs(dx*v.s+dz*v.c)<=v.hz)height=Math.max(height,v.top);
    }
    return height;
  };
}
