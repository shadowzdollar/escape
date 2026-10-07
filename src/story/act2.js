// ACT II — sequences 5-8: the frozen army, the sands of Giza, the river war, the blackout.
import { L, talk, go, foot, boat, swim, collect, survive, evade, wreck, heli, kill, takedown, tail, steal, deliver, hold, clear, race, plant, scout, meet, P, V } from './dsl.js';

export const ACT2 = [
  // =====================================================================================
  {
    title: 'WHITEOUT', map: 'snow',
    tagline: 'In Frostbite, the army does the Consortium\'s dirty work.',
    desc: 'The Ledger leads to Frostbite, where arms dealer Nadia Volkova sells army weapons stolen by Colonel Drago. Kai needs Nadia\'s help — and Drago\'s tanks.',
    missions: [
      {
        title: 'COLD WELCOME',
        brief: 'Nadia only works with drivers who survive the ice. Show her.',
        steps: [
          meet('MEET NADIA', [L('NADIA', 'Mercer. Kade said you would come. Then you killed him.'), L('KAI', 'He was working for the Consortium.'), L('NADIA', 'So am I. Maybe. Drive for me first. Then we talk.')], { at: P.oldtown, rig: 'woman2' }),
          race('RACE ACROSS THE ICE', 6, { each: 24 }),
          talk([L('NADIA', 'You did not crash. Rare in Frostbite.'), L('NADIA', 'Colonel Drago sells me army trucks. I want one he has not sold me.')]),
        ],
      },
      {
        title: 'FROZEN ASSETS',
        brief: 'Steal an army supply truck from a guarded depot.',
        steps: [
          steal('STEAL THE ARMY SUPPLY TRUCK', V.armored({ color: '#4f5a36', livery: null }), { at: P.near(200, 360), guards: 4, guardRig: 'swat' }),
          deliver('DELIVER IT TO NADIA', P.far, { threat: 2, intact: 0.35 }),
          talk([L('NADIA', 'Rifles. Mines. And a letter to Drago signed by the Commissioner. You were right.')]),
        ],
      },
      {
        title: 'ARMS DEAL',
        brief: 'Guard Nadia while she sells the weapons — the buyers do not like surprises.',
        loadout: { smg: 120 },
        steps: [
          go('ESCORT NADIA TO THE DEAL', P.parking),
          hold('GUARD THE DEAL', 50, { at: P.last, radius: 18, wave: 3, rig: 'swat', say: [L('NADIA', 'Military police! Somebody talked. Hold them off!')] }),
          clear('FINISH THE AMBUSH', 6, { at: P.last, rig: 'swat' }),
          evade('GET NADIA OUT', 8, { threat: 3 }),
        ],
      },
      {
        title: 'IRON MONSTER',
        brief: 'Drago parks a tank behind his barracks. Nadia wants it. So do you.',
        steps: [
          talk([L('NADIA', 'One tank. Behind the barracks. Guarded, but the guards are cold and bored.')]),
          steal('STEAL THE TANK', V.tank(), { at: P.near(200, 380), guards: 4, guardRig: 'swat' }),
          deliver('DRIVE THE TANK TO NADIA\'S HANGAR', P.far, { threat: 4 }),
          talk([L('DRAGO', 'Whoever took my tank: I will find you, and I will hang you from it.')]),
        ],
      },
      {
        title: 'TANK WAR',
        brief: 'You have a tank. Drago has more. Fight them in the streets.',
        vehicle: { car: 'goliath' },
        steps: [
          talk([L('NADIA', 'Drago is sending police and tanks to get his toy back. Show him what it can do.')], { threat: 4 }),
          wreck('DESTROY THE POLICE BLOCKADE', 4, { threat: 4 }),
          wreck('DESTROY DRAGO\'S TANKS', 2, { of: 'tank', threat: 5 }),
          evade('HIDE THE TANK', 9, { threat: 4 }),
        ],
      },
      {
        title: 'SNOWBLIND',
        brief: 'A blizzard is coming. Use it to scout Drago\'s radar posts unseen.',
        steps: [
          scout('SCOUT THE RADAR POSTS', 3, { guards: 1 }),
          kill('SILENCE THE RADAR OFFICER', { at: P.block(['plaza', 'park'], 150, 350), rig: 'swat', guards: 3, strict: true }),
          evade('SLIP AWAY IN THE STORM', 7, { threat: 2 }),
        ],
      },
      {
        title: 'DRAGO\'S SIGNAL',
        brief: 'Jam Drago\'s communications, then deal with the helicopter that comes looking.',
        loadout: { rpg: 6 },
        steps: [
          plant('PLANT THE JAMMERS', 3, { boom: false, verb: 'JAMMER ACTIVE', guards: 2 }),
          heli('SHOOT DOWN THE SEARCH HELICOPTER', 1, { threat: 3 }),
          evade('LOSE THE PATROLS', 8, { threat: 3 }),
        ],
      },
      {
        title: 'THE PASS',
        brief: 'Drago\'s weapon convoy is driving through the city. Stop it and grab the cargo.',
        loadout: { rpg: 6 },
        steps: [
          takedown('DESTROY THE CONVOY TRUCK', { vehicle: V.armored({ hp: 800, color: '#4f5a36', livery: null }), escorts: 3, escortType: 'swat', threat: 4 }),
          collect('COLLECT THE WEAPON CRATES', 4, { spread: [10, 80], item: 'CRATE', threat: 4 }),
          evade('ESCAPE THE ARMY', 9, { threat: 4 }),
        ],
      },
      {
        title: 'BUNKER',
        brief: 'Drago keeps the Consortium\'s orders in a bunker. Take it.',
        loadout: { smg: 180, rpg: 6 },
        steps: [
          go('REACH THE BUNKER', P.industrial, { threat: 2 }),
          clear('STORM THE BUNKER', 12, { at: P.last, rig: 'swat', threat: 2 }),
          hold('HOLD THE BUNKER WHILE ROSA COPIES THE FILES', 45, { at: P.last, rig: 'swat', wave: 4, threat: 3 }),
          talk([L('ROSA', 'Files copied. Kai, Drago answers to a General. Kane. He commands half the army.')]),
        ],
      },
      {
        title: 'THE COLONEL',
        brief: 'Colonel Drago is personally leading the hunt. Finish him.',
        unlock: 'rhino',
        loadout: { smg: 200, rpg: 8 },
        steps: [
          talk([L('DRAGO', 'You want me, thief? I am at the parade ground. Come and take me.')]),
          kill('ELIMINATE COLONEL DRAGO', { at: P.parking, armed: true, rig: 'swat', hp: 320, guards: 8, alertThreat: 5 }),
          survive('SURVIVE THE ARMY\'S REVENGE', 40, { threat: 5 }),
          evade('LOSE THEM IN THE SNOW', 10, { threat: 4 }),
          talk([L('NADIA', 'You did it. Now take this, a gift: an armoured car. Do not get it scratched.'), L('ROSA', 'The Ledger points south. Giza. Someone called the Curator moves the Consortium\'s gold.')]),
        ],
      },
    ],
  },
  // =====================================================================================
  {
    title: 'SANDS OF GIZA', map: 'giza',
    tagline: 'Treasures older than empires. Paid for in blood.',
    desc: 'The Consortium hides its fortune in smuggled antiquities, laundered through Giza by the mysterious Curator. Kai finds an ally in Tariq, a fixer who knows every street along the Nile.',
    missions: [
      {
        title: 'THE NILE',
        brief: 'Arrive by river and find Tariq, the only man in Giza the Curator does not own.',
        steps: [
          boat('TAKE THE BOAT DOWN THE NILE', P.river(250, 450)),
          meet('MEET TARIQ', [L('TARIQ', 'You are the driver everybody wants dead. Welcome to Giza.'), L('TARIQ', 'The Curator is a ghost. But his men are not.')], { at: P.oldtown, rig: 'farmer' }),
          talk([L('ROSA', 'Tariq, we need to see the whole city.'), L('TARIQ', 'Then climb. Old Giza has the best views in the world.')]),
        ],
      },
      {
        title: 'ANCIENT ROUTES',
        brief: 'Learn the city. Reach the viewpoints Tariq shows you.',
        steps: [
          scout('SYNCHRONIZE THE VIEWPOINTS', 4),
          go('DRIVE TO THE PYRAMIDS', P.pyramid),
          talk([L('TARIQ', 'Every night, trucks drive into the desert from here. Empty in, full out.')]),
        ],
      },
      {
        title: 'FELUCCA RUN',
        brief: 'The Curator moves artifacts by boat. Steal one of his speedboats with the cargo still on board.',
        steps: [
          steal('STEAL THE CURATOR\'S BOAT', V.boat('speed'), { at: P.near(150, 300), guards: 2, guardRig: 'punk' }),
          deliver('BRING THE BOAT TO TARIQ\'S DOCK', P.river(400, 650), { threat: 2 }),
          talk([L('TARIQ', 'Golden masks. Stolen from three museums. Each one worth a city block.')]),
        ],
      },
      {
        title: 'THE CURATOR\'S MEN',
        brief: 'The Curator\'s men are searching the market for you. Find them first.',
        loadout: { smg: 150 },
        steps: [
          go('GO TO THE MARKET SQUARE', P.plaza),
          clear('DEAL WITH THE CURATOR\'S MEN', 8, { at: P.last }),
          evade('LOSE THE POLICE', 8, { threat: 3 }),
        ],
      },
      {
        title: 'TOMB RAIDERS',
        brief: 'The Curator buried a fortune near the pyramids. Dig it up before his trucks arrive.',
        steps: [
          go('DRIVE TO THE PYRAMIDS', P.pyramid),
          collect('RECOVER THE BURIED CRATES', 5, { spread: [50, 200], item: 'CRATE' }),
          go('REACH THE AIRSTRIP', P.airstrip, { threat: 3 }),
          talk([L('TARIQ', 'A plane was waiting. It flew off empty. Ha!')]),
        ],
      },
      {
        title: 'SHADOW OF THE SPHINX',
        brief: 'Follow the Curator\'s head of security and remove him without a sound.',
        steps: [
          tail('FOLLOW THE SECURITY CHIEF', { vehicle: V.sedan('#e9c46a'), to: P.sphinx, min: 22, max: 120 }),
          kill('ELIMINATE THE SECURITY CHIEF', { at: P.last, rig: 'adventurer', guards: 5, guardRig: 'punk2', strict: true }),
          evade('DISAPPEAR', 6, { threat: 1 }),
        ],
      },
      {
        title: 'SANDSTORM',
        brief: 'A sandstorm hides you — and the police. Race through it to reach Tariq.',
        steps: [
          race('RACE THROUGH THE STORM', 7, { each: 22 }),
          survive('SURVIVE THE POLICE IN THE STORM', 40, { threat: 4 }),
          evade('LOSE THEM', 9, { threat: 4 }),
        ],
      },
      {
        title: 'MARKET DAY',
        brief: 'The Curator\'s accountant is shopping in the market. Remove him and steal his ledgers.',
        steps: [
          kill('ELIMINATE THE ACCOUNTANT', { at: P.plaza, rig: 'business', guards: 4, guardRig: 'punk', flee: true, alertThreat: 2 }),
          collect('GRAB HIS LEDGERS', 3, { spread: [20, 120], item: 'LEDGER' }),
          plant('BURN THE CURATOR\'S WAREHOUSES', 2, { fuse: 10 }),
          evade('ESCAPE', 9, { threat: 3 }),
        ],
      },
      {
        title: 'PYRAMID HEIST',
        brief: 'The Curator\'s gold is leaving in an armoured van. Take the whole van.',
        steps: [
          steal('STEAL THE GOLD VAN', V.armored({ color: '#c9a227', livery: null }), { at: P.near(200, 360), guards: 5, armed: true }),
          deliver('DELIVER THE GOLD TO TARIQ', P.far, { intact: 0.45, threat: 4 }),
          talk([L('CURATOR', 'You took my gold, driver. I will take everything you love.')]),
        ],
      },
      {
        title: 'THE CURATOR',
        brief: 'The Curator is finally out in the open. End him before he flies away.',
        unlock: 'veyra',
        loadout: { rpg: 8 },
        steps: [
          talk([L('TARIQ', 'He is at the Sphinx with a small army. And a helicopter.')]),
          kill('ELIMINATE THE CURATOR', { at: P.sphinx, rig: 'business', guards: 8, guardRig: 'punk2', flee: true, carModel: 'super', hp: 150, alertThreat: 4 }),
          heli('SHOOT DOWN HIS GUNSHIPS', 2, { threat: 3 }),
          evade('LEAVE GIZA', 10, { threat: 4 }),
          talk([L('ROSA', 'The Curator laundered gold through the harbour back home. Harbor Master Quill.'), L('KAI', 'Home, then.')]),
        ],
      },
    ],
  },
  // =====================================================================================
  {
    title: 'THE RIVER WAR', map: 'city',
    tagline: 'The river runs through the city. So does the money.',
    desc: 'Back in Metro City, Harbor Master Quill controls every boat on the river and every crate that crosses it. To reach him, Kai has to take the water.',
    missions: [
      {
        title: 'HOME AGAIN',
        brief: 'The city has changed while you were away. Look around.',
        steps: [
          talk([L('DIMA', 'Kai! You came back. The city is worse. Voss has police on every bridge.'), L('ROSA', 'Then we use the river.')]),
          scout('RE-SYNCHRONIZE THE CITY', 3),
          boat('TEST THE RIVER ROUTES', P.river(250, 500)),
        ],
      },
      {
        title: 'DOCK RATS',
        brief: 'Quill\'s dock workers are armed thugs. Clear the docks and take a boat.',
        loadout: { smg: 150 },
        steps: [
          go('REACH THE DOCKS', P.industrial),
          clear('CLEAR THE DOCKS', 8, { at: P.last }),
          steal('TAKE A FAST BOAT', V.boat('speed'), { at: P.near(100, 250) }),
          boat('ESCAPE BY RIVER', P.river(350, 600), { threat: 2 }),
        ],
      },
      {
        title: 'CONTRABAND',
        brief: 'Quill\'s boats drop contraband at secret points along the river. Steal all of it.',
        steps: [
          boat('REACH THE FIRST DROP', P.river(200, 400)),
          boat('REACH THE SECOND DROP', P.river(200, 400), { threat: 1 }),
          boat('REACH THE THIRD DROP', P.river(200, 400), { threat: 2 }),
          evade('LOSE THE RIVER POLICE', 8, { threat: 2 }),
        ],
      },
      {
        title: 'PATROL',
        brief: 'With a police boat, you could get close to Quill\'s yacht. Steal one.',
        steps: [
          steal('STEAL A POLICE BOAT', V.boat('police'), { at: P.near(150, 300), guards: 2 }),
          deliver('BRING IT TO DIMA\'S PIER', P.river(400, 650), { threat: 2 }),
        ],
      },
      {
        title: 'QUILL\'S LEDGER',
        brief: 'Quill\'s bookkeeper is taking the river ledger downstream. Follow the boat.',
        steps: [
          boat('GET ON THE WATER', P.river(40, 120)),
          tail('FOLLOW THE BOOKKEEPER\'S BOAT', { vehicle: V.boat('speed'), to: P.river(500, 800), min: 18, max: 120, at: P.river(60, 120), speed: 15 }),
          kill('TAKE THE LEDGER', { at: P.block(['industrial', 'parking'], 40, 200), rig: 'business', guards: 3, flee: true }),
        ],
      },
      {
        title: 'BRIDGES',
        brief: 'Voss\'s checkpoints sit on the bridges. Blow up the guard posts.',
        loadout: { rpg: 4 },
        steps: [
          plant('MINE THE BRIDGE CHECKPOINTS', 3, { fuse: 10, guards: 2 }),
          wreck('DESTROY THE CHECKPOINT CARS', 3, { threat: 3 }),
          evade('ESCAPE', 9, { threat: 3 }),
        ],
      },
      {
        title: 'GUNBOAT',
        brief: 'Dima built you a gunboat. Use it to take the river.',
        vehicle: { boat: 'gunboat' },
        steps: [
          talk([L('DIMA', 'Rockets, machine gun, armour. Quill will cry into his tea.')], { threat: 3 }),
          wreck('SINK THE POLICE BOATS', 3, { of: 'boat', threat: 3 }),
          boat('CONTROL THE RIVER', P.river(350, 600), { threat: 3 }),
          evade('LOSE THEM', 8, { threat: 3 }),
        ],
      },
      {
        title: 'HIGH TIDE',
        brief: 'Quill\'s men are attacking Dima\'s pier. Defend it.',
        loadout: { smg: 200, rpg: 5 },
        steps: [
          go('RACE BACK TO THE PIER', P.near(200, 350)),
          hold('DEFEND THE PIER', 60, { at: P.last, radius: 20, wave: 4 }),
          clear('FINISH THEM', 5, { at: P.last }),
        ],
      },
      {
        title: 'SINK THEM',
        brief: 'Quill\'s armoured patrol boat escorts every shipment. Sink it.',
        vehicle: { boat: 'gunboat' },
        steps: [
          takedown('SINK QUILL\'S PATROL BOAT', { vehicle: V.boat('patrol'), at: P.river(80, 160), threat: 2 }),
          wreck('SINK THE ESCORTS', 2, { of: 'boat', threat: 3 }),
        ],
      },
      {
        title: 'QUILL',
        brief: 'Quill has run out of boats. Corner him at the harbour office.',
        unlock: 'patrol',
        loadout: { smg: 200, rpg: 6 },
        steps: [
          kill('ELIMINATE HARBOR MASTER QUILL', { at: P.industrial, armed: true, rig: 'worker', hp: 260, guards: 6, guardRig: 'punk', alertThreat: 3 }),
          boat('ESCAPE BY RIVER', P.river(300, 600), { threat: 3 }),
          evade('LOSE THE POLICE', 9, { threat: 3 }),
          talk([L('ROSA', 'Quill\'s phone talked to one number every day. A woman called the Whisper.'), L('DIMA', 'The Whisper is a legend. Voss\'s spymaster. Nobody has seen her face.')]),
        ],
      },
    ],
  },
  // =====================================================================================
  {
    title: 'BLACKOUT', map: 'night',
    tagline: 'In the dark, every enemy is a whisper.',
    desc: 'The Whisper runs the Consortium\'s eyes and ears: cameras, phones, informants. To blind her, Kai plunges the whole city into darkness.',
    missions: [
      {
        title: 'LIGHTS OUT',
        brief: 'Black out four substations. Without power, the Whisper\'s cameras go dark.',
        steps: [
          plant('SABOTAGE THE SUBSTATIONS', 4, { blocks: ['industrial', 'parking', 'downtown'], guards: 2, fuse: 12 }),
          evade('ESCAPE IN THE DARK', 9, { threat: 3 }),
        ],
      },
      {
        title: 'WHISPERS',
        brief: 'Someone close to the Whisper wants out. Find them.',
        steps: [
          scout('LISTEN FROM THE ROOFTOPS', 3),
          meet('MEET THE INFORMANT', [L('WHISPER', 'Hello, Kai. Did you think my informants would not tell me about you?'), L('KAI', 'It is a trap.'), L('WHISPER', 'Everything is.')], { at: P.park, rig: 'woman2' }),
          survive('SURVIVE THE TRAP', 40, { threat: 4 }),
          evade('ESCAPE', 9, { threat: 4 }),
        ],
      },
      {
        title: 'THE LISTENER',
        brief: 'The Whisper\'s surveillance van is listening to the city. Follow it to its base.',
        steps: [
          tail('FOLLOW THE SURVEILLANCE VAN', { vehicle: V.van('#111111'), to: P.far, min: 24, max: 120 }),
          plant('BUG THEIR BASE', 1, { at: P.last, boom: false, verb: 'BUG PLANTED', guards: 4 }),
          evade('GET OUT', 7, { threat: 2 }),
        ],
      },
      {
        title: 'DARK STREETS',
        brief: 'Rosa needs a copy of the Whisper\'s files, delivered across the dark city in minutes.',
        steps: [
          race('DELIVER THE FILES', 8, { each: 20 }),
          evade('LOSE THE PATROLS', 8, { threat: 3 }),
        ],
      },
      {
        title: 'SAFEHOUSE BURNING',
        brief: 'The Whisper found the hideout. Fight for it.',
        loadout: { smg: 200, rpg: 6 },
        steps: [
          talk([L('ROSA', 'Kai! They are at the hideout! Dima is here!')], { threat: 3 }),
          hold('DEFEND THE HIDEOUT', 60, { at: P.near(40, 100), radius: 18, wave: 5, rig: 'swat', threat: 3 }),
          survive('SURVIVE THE SWAT RESPONSE', 40, { threat: 4 }),
          evade('ESCAPE WITH DIMA AND ROSA', 9, { threat: 4 }),
        ],
      },
      {
        title: 'COUNTER-SPY',
        brief: 'Three of the Whisper\'s agents know your face. Remove all three.',
        steps: [
          kill('ELIMINATE THE FIRST AGENT', { at: P.park, rig: 'business', guards: 3, flee: true }),
          kill('ELIMINATE THE SECOND AGENT', { at: P.oldtown, rig: 'woman2', guards: 3, flee: true }),
          kill('ELIMINATE THE THIRD AGENT', { at: P.plaza, rig: 'business', guards: 4, flee: true }),
          evade('DISAPPEAR', 8, { threat: 3 }),
        ],
      },
      {
        title: 'GHOST PROTOCOL',
        brief: 'The Whisper drives a black interceptor that radar cannot see. Steal it.',
        steps: [
          steal('STEAL THE GHOST', V.car('ghost'), { at: P.near(220, 380), guards: 5 }),
          deliver('DRIVE IT TO DIMA', P.far, { threat: 4 }),
          wreck('SHAKE OFF THE PURSUIT', 4, { threat: 4 }),
        ],
      },
      {
        title: 'THE NETWORK',
        brief: 'The Whisper backs up everything on hidden drives around the city. Find them all.',
        steps: [
          collect('COLLECT THE HIDDEN DRIVES', 6, { item: 'DRIVE', spread: [120, 340], threat: 2 }),
          evade('LOSE THEM', 9, { threat: 3 }),
          talk([L('ROSA', 'She is meeting Voss tonight. I know where.')]),
        ],
      },
      {
        title: 'TRAP',
        brief: 'Voss knows about the meeting too. It is a trap — for both of you.',
        loadout: { rpg: 8 },
        steps: [
          survive('SURVIVE THE AMBUSH', 50, { threat: 5 }),
          heli('SHOOT DOWN THE GUNSHIPS', 2, { threat: 4 }),
          evade('ESCAPE', 10, { threat: 4 }),
        ],
      },
      {
        title: 'THE WHISPER',
        brief: 'The Whisper is running. Follow her — and finish it.',
        unlock: 'ghost',
        steps: [
          tail('FOLLOW THE WHISPER', { vehicle: V.super('#111111', { hp: 260 }), to: P.far, min: 22, max: 120, onSpot: 'chase' }),
          kill('CONFRONT THE WHISPER', { at: P.last, rig: 'woman2', guards: 6, hp: 100, flee: true, carModel: 'super', alertThreat: 3 }),
          talk([L('WHISPER', 'You think this is about Voss? Voss is a dog on a leash.'), L('WHISPER', 'The leash goes to the army. To General Kane. And Kane answers to the Architect.')]),
          evade('LEAVE THE CITY', 10, { threat: 3 }),
        ],
      },
    ],
  },
];
