// Shared authored character data for the runtime and editable Blender export.
// This factory owns fresh records; gameplay may mutate its returned population.
export const CIVILIAN_SOURCE_VERSION = 1;
export const CIVILIAN_COUNT = 284;
export const CIVILIAN_SEED = 29715;

export function createPedestrianTemplate(coat,umbrella,pick=a=>a[0]) {
  let umbrellaPart=false;
  const pieces=[],p=(x,y,z,sx,sy,sz,c,motion=0)=>pieces.push({x,y,z,sx,sy,sz,c,motion,umbrella:umbrellaPart});
  for(const side of [-1,1]) {
    const leg=side<0?1:2;
    p(side*.135,.22,.03,.2,.15,.33,'#131e2b',leg);p(side*.135,.36,0,.15,.22,.17,'#263c4d',leg);
    p(side*.135,.55,.025,.19,.12,.21,'#42505b',leg);p(side*.135,.71,0,.18,.28,.21,'#263141',leg);
    p(side*.18,.9,0,.12,.14,.25,'#3e4755');p(side*.29,1.24,0,.22,.21,.28,coat);
    p(side*.34,1.04,0,.15,.25,.19,'#283944',side<0?3:4);p(side*.34,.88,.035,.15,.1,.17,'#9d8c83',side<0?3:4);
    p(side*.26,1.38,0,.19,.12,.32,'#40505a');p(side*.24,1.1,.18,.12,.12,.05,'#625b58');
  }
  p(0,1.14,0,.46,.51,.31,coat);p(-.115,1.15,.17,.19,.49,.05,coat);p(.115,1.15,.17,.19,.49,.05,coat);
  p(0,1.2,.19,.034,.42,.03,'#afaa94');p(0,.89,0,.5,.12,.35,'#1b2938');
  p(0,1.3,-.24,.32,.36,.14,'#263b49');p(0,1.39,-.32,.18,.18,.025,'#723b48');
  p(0,1.49,0,.13,.12,.13,'#a28d83');p(0,1.65,.015,.3,.28,.27,'#9f8e88');p(0,1.82,-.015,.33,.12,.31,'#162a38');
  p(-.13,1.69,0,.05,.19,.29,'#263b46');p(.13,1.69,0,.05,.19,.29,'#263b46');p(0,1.69,.157,.27,.066,.037,'#59ccd6');
  p(.045,1.60,.164,.12,.025,.025,'#5a595a');p(-.26,1.41,.07,.12,.05,.12,'#ae5b57');
  if(umbrella) {
    umbrellaPart=true;
    p(.35,1.93,.1,.035,1.1,.035,'#4a6374');
    for(let ix=-3;ix<=3;ix++)for(let iz=-3;iz<=3;iz++) {
      if(Math.abs(ix)+Math.abs(iz)>4)continue;
      const tier=Math.max(Math.abs(ix),Math.abs(iz));
      p(.2+ix*.26,2.56-tier*.065,iz*.26,.27,.06,.27,pick(['#182a3c','#1b3546','#213e4d','#203248']));
      if(Math.abs(ix)+Math.abs(iz)===4)p(.2+ix*.26,2.525-tier*.065,iz*.26,.27,.025,.27,'#477f94');
    }
    p(.2,2.7,0,.055,.2,.055,'#4a6577');
  }
  return pieces;
}

export function createCityPopulation({districts,seed=CIVILIAN_SEED}) {
  let randomState=seed>>>0,draws=0;
  const rand=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;draws++;return randomState/4294967296;};
  const pick=a=>a[Math.floor(rand()*a.length)];
  const people=[];
  for(let i=0;i<CIVILIAN_COUNT;i++) {
    const side=i%2?-1:1,p={x:side*(12+rand()*2.0),z:27-rand()*192,speed:(rand()>.5?1:-1)*(.18+rand()*.44),phase:rand()*12,scale:.91+rand()*.17,minZ:-170,maxZ:34};
    if(i>32){p.x=(rand()-.5)*18;p.z=-65-rand()*98;}
    if(i>=44){
      const index=i-44,avenue=index%6,walkSide=Math.floor(index/6)%2?-1:1;
      p.x=[-310,-210,-90,90,210,310][avenue]+walkSide*(12.7+rand()*.7);
      p.z=135-(Math.floor(index/12)+rand()*.6)*34;p.minZ=-555;p.maxZ=150;p.speed*=1.6;
    }
    const district=districts.reduce((a,d)=>!a||Math.hypot(d.x-p.x,d.z-p.z)<Math.hypot(a.x-p.x,a.z-p.z)?d:a,null)?.name;
    const coatPalette=district==='Lantern Market'?['#b35b49','#ad8856','#567d87']:district==='Iron Docks'?['#c2a04e','#617c89','#b57a4a']:district==='Stacktown'?['#a75492','#7366a6','#61526d']:district==='Meridian East'?['#9dbaae','#719daf','#748752']:['#5d728c','#826977','#7a8376'];
    p.pieces=createPedestrianTemplate(pick(coatPalette),i%3===0,pick);people.push(p);
  }
  const stateAfterPeople=randomState,drawsAfterPeople=draws;
  // Aircraft continue the population stream; restarting it changes the city.
  const traffic=[];
  for(let i=0;i<16;i++)traffic.push({x:(rand()-.5)*(i<9?145:600),y:36+rand()*35,z:i<9?-55-rand()*190:130-rand()*670,speed:(i%2?1:-1)*(2.8+rand()*3.5),range:i<9?105:330});
  return {version:CIVILIAN_SOURCE_VERSION,people,airTraffic:traffic,
    rng:{seed:seed>>>0,stateAfterPeople,stateAfterAirTraffic:randomState,drawsAfterPeople,drawsTotal:draws}};
}
