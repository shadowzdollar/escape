// The long story: 12 sequences x 10 story missions (acts 1-3), plus 20 side contracts
// per sequence generated from templates. Difficulty rises with story progress and the
// player's rank; every mission is a chain of checkpointed steps (engine.js).
import { mulberry32 } from '../utils.js';
import { ACT1 } from './act1.js';
import { ACT2 } from './act2.js';
import { ACT3 } from './act3.js';
import { L, talk, go, foot, boat, collect, survive, evade, wreck, heli, kill, takedown, tail, steal, deliver, hold, clear, race, plant, scout, meet, P, V } from './dsl.js';

export const STORY_TITLE = 'THE LONG ROAD';
const RAW = [...ACT1, ...ACT2, ...ACT3];

// ------------------------------------------------------------------ mission framing
// Every mission gets preparation objectives before the main job (gear stashes, a
// viewpoint, a contact with intel, a clean car) and an aftermath after it (shake off
// pursuit, lay low, debrief) — so each one plays as a long, multi-part operation.
const HANDLER = ['ROSA', 'ROSA', 'DIMA', 'BROKER', 'NADIA', 'TARIQ', 'DIMA', 'ROSA', 'BROKER', 'ROSA', 'ROSA', 'TARIQ'];
const GEAR_LINES = ['I left supplies in a couple of stashes. Grab them on the way.', 'You will need gear for this. Two stashes, marked on your map.', 'Pick up the kit first. Never go in empty-handed.'];
const INTEL_LINES = [
  ['They change the guard every hour. Go when the new ones are still yawning.', 'Thanks. Keep your head down.'],
  ['The people you want are nervous. Nervous people make mistakes.', 'Then I will be patient.'],
  ['Police changed frequencies last night. Rosa has the new ones now.', 'Good to know.'],
  ['Stay off the main avenue. They watch it with cameras.', 'Side streets it is.'],
  ['Somebody paid the patrols to look the other way tonight. Not for you, for them.', 'Then they will be busy.'],
];
const DEBRIEF = [
  'Good work. Get some sleep. I will call you.',
  'Clean job. The Consortium is bleeding.',
  'Every one of these brings us closer to the top.',
  'Lay low for a while. The scanners are still buzzing.',
  'That was close. Too close. But we are still standing.',
  'They will feel that one for weeks.',
];
const PAY_LINES = ['Here. Counted twice. Do not spend it all on paint jobs.', 'The client is happy. When the client is happy, I am happy.', 'Money is in the bag. Pleasure doing business.'];
const CONTACT_RIGS = ['casual', 'hoodie', 'worker', 'farmer', 'woman2', 'business'];
const CLEAN_COLORS = ['#3a3f47', '#6c757d', '#1d3557', '#8d99ae', '#495057'];

function hashId(id) { let h = 7; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

function prepStep(kind, r, handler, seqN) {
  const pk = (a) => a[Math.floor(r() * a.length)];
  if (kind === 'gear') return collect('PICK UP GEAR FROM THE STASHES', 2, { item: 'GEAR', spread: [80, 220], say: [L(handler, pk(GEAR_LINES))] });
  if (kind === 'scout') return scout('SYNCHRONIZE A VIEWPOINT', 1, { say: [L(handler, 'Get eyes on the area first. Find a high spot and look around.')] });
  if (kind === 'car') return steal('GET A CLEAN CAR', V.sedan(pk(CLEAN_COLORS), { hp: 220 }), { at: P.near(90, 200), say: [L(handler, 'Your ride is too hot. Take something nobody is looking for.')] });
  const [a, b] = pk(INTEL_LINES);
  return meet('GET INTEL FROM A CONTACT', [L('CONTACT', a), L('KAI', b)], { at: P.block(['oldtown', 'park', 'plaza', 'suburb', 'midtown'], 140, 320), rig: pk(CONTACT_RIGS) });
}

function frame(m, seqN, kind) {
  const r = mulberry32(hashId(m.id));
  const handler = m.giver || HANDLER[seqN - 1];
  const steps = [...m.steps];
  const boatOps = !!m.vehicle?.boat || steps.some((x) => x.boat || x.vehicle?.boat || x.to?.river);
  const heavy = !!m.vehicle;
  if (m.intro) return steps; // the opening cinematic leads straight into the getaway
  // ---- preparation
  const pool = boatOps ? [] : heavy ? ['gear'] : ['gear', 'scout', 'intel', 'car', 'intel', 'gear'];
  const nPrep = !pool.length ? 0 : kind === 'contract' ? 1 : steps.length <= 3 ? 2 : 1;
  const pre = [];
  for (let k = 0; k < nPrep; k++) {
    let pk = pool[Math.floor(r() * pool.length)];
    if (pre.some((x) => x._prep === pk)) pk = pool.find((x) => !pre.some((y) => y._prep === x)) || pk;
    if (pk === 'car' && steps[0]?.t === 'steal') pk = 'gear';
    pre.push({ ...prepStep(pk, r, handler, seqN), _prep: pk });
  }
  // ---- aftermath
  const post = [];
  const maxThreat = Math.max(-1, ...steps.map((x) => x.threat ?? -1), ...steps.map((x) => x.alertThreat ?? -1));
  const lastAction = [...steps].reverse().find((x) => x.t !== 'talk');
  if (!m.final) {
    if (maxThreat >= 1 && lastAction?.t !== 'evade') post.push(evade('SHAKE OFF ANY PURSUIT', 7, { threat: Math.min(maxThreat, 3) }));
    if (kind === 'contract') {
      post.push(meet('COLLECT YOUR PAYMENT', [L(handler, r() < 0.5 ? PAY_LINES[0] : PAY_LINES[Math.floor(r() * PAY_LINES.length)])], { at: P.block(['oldtown', 'park', 'plaza', 'suburb', 'midtown'], 150, 350), rig: pick(r, CONTACT_RIGS) }));
    } else if (boatOps) {
      post.push(boat('MOOR AT THE HIDEOUT PIER', P.river(200, 420), { threat: -1, end: [L(handler, DEBRIEF[Math.floor(r() * DEBRIEF.length)])] }));
    } else {
      post.push(go('LAY LOW AT A SAFEHOUSE', P.near(260, 460), { threat: -1, end: [L(handler, DEBRIEF[Math.floor(r() * DEBRIEF.length)])] }));
    }
  }
  return [...pre, ...steps, ...post];
}

// ------------------------------------------------------------------ story missions
export const SEQUENCES = RAW.map((seq, si) => {
  const n = si + 1;
  const s = { ...seq, n, id: `s${n}` };
  s.missions = seq.missions.map((m, mi) => ({
    ...m,
    steps: frame({ ...m, id: `s${n}m${mi + 1}` }, n, 'story'),
    id: `s${n}m${mi + 1}`,
    kind: 'story',
    seq: n,
    n: mi + 1,
    map: m.map || seq.map,
    seqTitle: seq.title,
    diff: Math.min(0.95, 0.04 + si * 0.078 + mi * 0.006),
    reward: m.reward || 350 + si * 230 + mi * 35,
    xp: m.xp || 140 + si * 45 + mi * 6,
  }));
  return s;
});

export const STORY = SEQUENCES.flatMap((s) => s.missions);
export const STORY_FINAL = STORY[STORY.length - 1].id;

// ------------------------------------------------------------------ rank
// Rank 1-50 from XP; contracts get harder with rank.
export function rankOf(xp = 0) { return Math.min(50, Math.floor(Math.sqrt(xp / 110)) + 1); }
export function xpForRank(r) { return (r - 1) ** 2 * 110; }

// ------------------------------------------------------------------ side contracts
const FIRST = ['Viktor', 'Lena', 'Marco', 'Jade', 'Otis', 'Sana', 'Rico', 'Mila', 'Bruno', 'Iris', 'Dex', 'Nora', 'Hugo', 'Zara', 'Felix', 'Yuki', 'Omar', 'Tess'];
const LAST = ['Graves', 'Moreau', 'Vance', 'Okafor', 'Petrov', 'Castillo', 'Lindqvist', 'Haddad', 'Novak', 'Duarte', 'Kowalski', 'Bauer', 'Sato', 'Reyna'];
const GANGS = ['the Rats', 'the Vipers', 'the Red Hand', 'the Night Owls', 'the Iron Saints', 'the Jackals', 'the Long Knives'];
const COLORS = ['#e63946', '#2f6fe0', '#f4a300', '#111111', '#7b2ff7', '#2a9d8f', '#c0c0c0', '#ff6b6b'];
const BROKERS = ['BROKER', 'ROSA', 'TARIQ', 'BROKER'];

const CONTRACT_TYPES = [
  {
    key: 'bounty', name: 'BOUNTY', min: 1,
    make: (r, c) => {
      const who = `${pick(r, FIRST)} ${pick(r, LAST)}`;
      return {
        title: `BOUNTY: ${who.toUpperCase()}`,
        brief: `${who} owes the wrong people. The contract pays if they never make another payment.`,
        steps: [
          talk([L(c.giver, `${who} is hiding behind bodyguards. Quiet is worth a bonus.`)]),
          kill(`ELIMINATE ${who.toUpperCase()}`, { at: P.block(pick(r, [['park'], ['plaza'], ['oldtown', 'midtown'], ['parking']]), 150, 380), rig: pick(r, ['business', 'adventurer', 'punk', 'woman2']), guards: 2 + Math.floor(c.tier / 2), flee: r() < 0.6, hp: 60 + c.tier * 12, alertThreat: Math.min(5, 1 + Math.floor(c.tier / 2)) }),
          evade('GET AWAY', 6 + c.tier, { threat: Math.min(5, 1 + Math.floor(c.tier / 2)) }),
        ],
      };
    },
  },
  {
    key: 'hotcar', name: 'HOT CAR', min: 1,
    make: (r, c) => {
      const car = pick(r, [V.sports(pick(r, COLORS)), V.super(pick(r, COLORS)), V.sedan(pick(r, COLORS)), V.truck(pick(r, COLORS))]);
      return {
        title: `HOT CAR: ${pick(r, ['THE COLLECTOR', 'SHOWROOM JOB', 'SPOILED RICH KID', 'THE DEALERSHIP', 'TRACK DAY'])}`,
        brief: 'A buyer wants a very specific car, delivered without a scratch.',
        steps: [
          steal('STEAL THE CAR', car, { at: P.near(160, 340), guards: Math.floor(c.tier / 2) }),
          deliver('DELIVER IT TO THE BUYER', P.far, { intact: 0.4 + Math.min(0.3, c.tier * 0.03), threat: Math.min(5, 1 + Math.floor(c.tier / 2)) }),
          evade('LOSE ANY TAIL', 6, { threat: Math.min(4, Math.floor(c.tier / 2)) }),
        ],
      };
    },
  },
  {
    key: 'courier', name: 'COURIER', min: 1,
    make: (r, c) => ({
      title: `COURIER: ${pick(r, ['EXPRESS', 'MIDNIGHT RUN', 'NO QUESTIONS', 'RED ENVELOPE', 'HOT PACKAGE'])}`,
      brief: 'Pick up a package and race it across town. Late is the same as never.',
      steps: [
        collect('PICK UP THE PACKAGE', 1, { spread: [120, 260], item: 'PACKAGE' }),
        race('DELIVER IT IN TIME', 4 + Math.min(5, c.tier), { each: 22 - Math.min(5, c.tier * 0.5) }),
        evade('GO DARK', 6, { threat: Math.min(4, Math.floor(c.tier / 2)) }),
      ],
    }),
  },
  {
    key: 'convoy', name: 'CONVOY', min: 2,
    make: (r, c) => ({
      title: `CONVOY: ${pick(r, ['ARMOURED CASH', 'GOLD RUN', 'EVIDENCE TRUCK', 'PAYROLL', 'WEAPONS SHIPMENT'])}`,
      brief: 'An armoured truck is crossing the city with an escort. Stop it and take the cargo.',
      loadout: { rpg: 3 + Math.floor(c.tier / 2) },
      steps: [
        takedown('DESTROY THE TRUCK', { vehicle: V.armored({ hp: 600 + c.tier * 60 }), escorts: 1 + Math.floor(c.tier / 3), escortType: c.tier > 5 ? 'swat' : 'patrol', threat: Math.min(5, 2 + Math.floor(c.tier / 3)) }),
        collect('GRAB THE CARGO', 3, { spread: [10, 70], item: 'CRATE' }),
        evade('ESCAPE', 8 + Math.floor(c.tier / 2), { threat: Math.min(5, 2 + Math.floor(c.tier / 3)) }),
      ],
    }),
  },
  {
    key: 'turf', name: 'TURF WAR', min: 1,
    make: (r, c) => {
      const gang = pick(r, GANGS);
      return {
        title: `TURF WAR: ${gang.toUpperCase()}`,
        brief: `${gang} are moving in on a friend's territory. Push them out.`,
        loadout: { smg: 80 + c.tier * 20 },
        steps: [
          go('DRIVE TO THE TURF', P.block(['parking', 'industrial', 'plaza', 'park'], 150, 380)),
          clear(`DEFEAT ${gang.toUpperCase()}`, 5 + c.tier, { at: P.last }),
          hold('HOLD THE TURF', 30 + c.tier * 4, { at: P.last, wave: 2 + Math.floor(c.tier / 2) }),
        ],
      };
    },
  },
  {
    key: 'sabotage', name: 'SABOTAGE', min: 2,
    make: (r, c) => ({
      title: `SABOTAGE: ${pick(r, ['BLACK FRIDAY', 'SHORT CIRCUIT', 'DOMINO', 'SPARKS', 'LIGHTS OUT'])}`,
      brief: 'A rival business needs a very bad week. Plant the charges, walk away, do not look back.',
      steps: [
        plant('PLANT THE CHARGES', 2 + Math.min(3, Math.floor(c.tier / 2)), { guards: Math.min(3, Math.floor(c.tier / 2)), fuse: 12 }),
        evade('GET CLEAR', 7 + Math.floor(c.tier / 2), { threat: Math.min(5, 2 + Math.floor(c.tier / 3)) }),
      ],
    }),
  },
  {
    key: 'ghost', name: 'GHOST RUN', min: 1,
    make: (r, c) => ({
      title: `GHOST RUN: ${pick(r, ['DEAD DROPS', 'TREASURE HUNT', 'BREADCRUMBS', 'PAPER CHASE'])}`,
      brief: 'Money is hidden all over the map. Collect it before the police connect the dots.',
      steps: [
        collect('COLLECT THE DROPS', 3 + Math.min(4, c.tier), { item: 'DROP', spread: [100, 320], threat: Math.min(4, Math.floor(c.tier / 2)) }),
        evade('DISAPPEAR', 7 + Math.floor(c.tier / 2), { threat: Math.min(5, 1 + Math.floor(c.tier / 2)) }),
      ],
    }),
  },
  {
    key: 'tail', name: 'SHADOW', min: 2,
    make: (r, c) => {
      const who = `${pick(r, FIRST)} ${pick(r, LAST)}`;
      return {
        title: `SHADOW: ${who.toUpperCase()}`,
        brief: `Find out where ${who} goes at night. Then make sure they never go there again.`,
        steps: [
          tail(`FOLLOW ${who.toUpperCase()}`, { vehicle: V.sedan(pick(r, COLORS)), to: P.far, min: 18 + c.tier, max: 115 - c.tier * 2, onSpot: c.tier > 4 ? 'chase' : undefined }),
          kill('FINISH THE JOB', { at: P.last, rig: pick(r, ['business', 'punk2', 'woman2']), guards: 2 + Math.floor(c.tier / 2), flee: true, alertThreat: 2 }),
          evade('VANISH', 7, { threat: 2 }),
        ],
      };
    },
  },
  {
    key: 'wrecking', name: 'WRECKING CREW', min: 2,
    make: (r, c) => ({
      title: `WRECKING CREW: ${pick(r, ['BENT COPPERS', 'TICKET QUOTA', 'BLUE MONDAY', 'SIREN SONG'])}`,
      brief: 'A corrupt precinct needs its car pool reduced. Permanently.',
      loadout: { carGuns: 20 + c.tier * 3 },
      steps: [
        wreck('WRECK POLICE CARS', 3 + Math.floor(c.tier / 1.5), { threat: Math.min(5, 2 + Math.floor(c.tier / 3)) }),
        evade('LOSE THE REST', 8 + Math.floor(c.tier / 2), { threat: Math.min(5, 2 + Math.floor(c.tier / 3)) }),
      ],
    }),
  },
  {
    key: 'sky', name: 'SKY HUNTER', min: 6,
    make: (r, c) => ({
      title: `SKY HUNTER: ${pick(r, ['ROTOR KILL', 'BIRDS OF PREY', 'FALLING STARS'])}`,
      brief: 'Gunships have been terrorising the district. Bring them down.',
      loadout: { rpg: 6 + c.tier },
      steps: [
        heli('SHOOT DOWN THE GUNSHIPS', 1 + Math.floor(c.tier / 4), { threat: Math.min(5, 3 + Math.floor(c.tier / 4)) }),
        evade('HIDE', 9, { threat: 4 }),
      ],
    }),
  },
  {
    key: 'river', name: 'RIVER RUN', min: 1,
    make: (r, c) => ({
      title: `RIVER RUN: ${pick(r, ['SMUGGLER\'S WAKE', 'LOW TIDE', 'WATERLINE', 'UNDER THE BRIDGES'])}`,
      brief: 'Run contraband down the river, past the police boats.',
      steps: [
        boat('REACH THE PICKUP', P.river(150, 350)),
        boat('MAKE THE DROP', P.river(300, 600), { threat: Math.min(4, 1 + Math.floor(c.tier / 2)) }),
        evade('LOSE THE RIVER POLICE', 7, { threat: Math.min(4, 1 + Math.floor(c.tier / 2)) }),
      ],
    }),
  },
  {
    key: 'survival', name: 'HEAT WAVE', min: 3,
    make: (r, c) => ({
      title: `HEAT WAVE: ${pick(r, ['DECOY', 'BAIT', 'DISTRACTION', 'RED HERRING'])}`,
      brief: 'Your friends need the police busy for a while. Be the most wanted person in town.',
      steps: [
        survive('KEEP THE POLICE BUSY', 40 + c.tier * 6, { threat: Math.min(6, 3 + Math.floor(c.tier / 3)) }),
        evade('ESCAPE', 9 + Math.floor(c.tier / 2), { threat: Math.min(5, 3 + Math.floor(c.tier / 3)) }),
      ],
    }),
  },
];

function pick(r, a) { return a[Math.floor(r() * a.length)]; }

const CONTRACTS_PER_SEQ = 20;
const contractCache = new Map();

// The 20 contracts of a sequence (deterministic). `rank` raises their difficulty.
export function contractsFor(seqN, rank = 1) {
  const key = `${seqN}|${rank}`;
  if (contractCache.has(key)) return contractCache.get(key);
  const seq = SEQUENCES[seqN - 1];
  const list = [];
  for (let k = 0; k < CONTRACTS_PER_SEQ; k++) {
    const r = mulberry32(seqN * 1000 + k * 37 + 11);
    const tier = Math.min(10, Math.floor((seqN - 1) * 0.8 + k / 6 + rank / 6));
    const types = CONTRACT_TYPES.filter((t) => seqN >= t.min);
    const T = types[(k + Math.floor(r() * types.length)) % types.length];
    const giver = pick(r, BROKERS);
    const m = T.make(r, { tier, giver });
    m.steps = frame({ ...m, id: `c${seqN}_${k + 1}`, giver }, seqN, 'contract');
    list.push({
      ...m,
      id: `c${seqN}_${k + 1}`,
      kind: 'contract',
      type: T.name,
      seq: seqN,
      n: k + 1,
      map: seq.map,
      seqTitle: seq.title,
      tier,
      diff: Math.min(1, 0.05 + (seqN - 1) * 0.07 + rank * 0.006 + k * 0.004),
      reward: 250 + seqN * 160 + tier * 70,
      xp: 70 + seqN * 22 + tier * 10,
    });
  }
  contractCache.set(key, list);
  return list;
}

export const TOTAL_MISSIONS = STORY.length + SEQUENCES.length * CONTRACTS_PER_SEQ;

// ------------------------------------------------------------------ lookups & progress
export function getMission(id, save = null) {
  const s = STORY.find((m) => m.id === id);
  if (s) return s;
  const m = /^c(\d+)_(\d+)$/.exec(id);
  if (m) return contractsFor(+m[1], rankOf(save?.story?.xp || window.game?.save?.story?.xp || 0))[+m[2] - 1];
  return null;
}

const done = (save, id) => !!save.story?.done?.[id];

export function storyUnlocked(save, m) {
  const i = STORY.indexOf(m);
  return i === 0 || done(save, STORY[i - 1].id);
}

export function sequenceUnlocked(save, seq) { return storyUnlocked(save, seq.missions[0]); }

export function nextStoryMission(save) {
  return STORY.find((m) => !done(save, m.id) && storyUnlocked(save, m)) || null;
}

export function progress(save) {
  const story = STORY.filter((m) => done(save, m.id)).length;
  let contracts = 0;
  for (const id of Object.keys(save.story?.done || {})) if (id.startsWith('c')) contracts++;
  return { story, contracts, total: story + contracts, pct: Math.round((story / STORY.length) * 100) };
}
