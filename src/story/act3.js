// ACT III — sequences 9-12: the general's war, the mountain bunker, the commissioner, the architect.
import { L, talk, go, foot, boat, swim, collect, survive, evade, wreck, heli, kill, takedown, tail, steal, deliver, hold, clear, race, plant, scout, meet, P, V } from './dsl.js';

export const ACT3 = [
  // =====================================================================================
  {
    title: 'SCORCHED EARTH', map: 'desert',
    tagline: 'General Kane does not hunt. He burns.',
    desc: 'General Kane declares Dust Valley a military zone and sends tanks and gunships to find the driver. Kai answers with war machines of his own.',
    missions: [
      {
        title: 'WAR COMES',
        brief: 'The army has arrived in Dust Valley. Survive the first strike.',
        steps: [
          talk([L('KANE', 'Attention, Dust Valley. A terrorist is hiding among you. Anyone who helps him will be treated as an enemy.')], { threat: 5 }),
          survive('SURVIVE THE FIRST STRIKE', 50, { threat: 5 }),
          evade('GET OUT OF THE KILL ZONE', 10, { threat: 4 }),
          talk([L('BROKER', 'Kai, I kept your old garage. And something new for you inside.')]),
        ],
      },
      {
        title: 'TECHNICAL',
        brief: 'The Broker armed a desert truck for you. Take the war to the army.',
        vehicle: { car: 'warhog' },
        steps: [
          talk([L('BROKER', 'Rockets in the back, gun on the roof. Go and make some noise.')], { threat: 4 }),
          wreck('DESTROY ARMY VEHICLES', 5, { threat: 4 }),
          evade('PULL BACK', 9, { threat: 4 }),
        ],
      },
      {
        title: 'SUPPLY LINES',
        brief: 'Cut Kane\'s supply lines. Two convoys, no survivors.',
        loadout: { rpg: 8 },
        steps: [
          takedown('DESTROY THE FIRST CONVOY', { vehicle: V.armored({ hp: 800, color: '#7a6c4a', livery: null }), escorts: 2, escortType: 'swat', threat: 4 }),
          takedown('DESTROY THE SECOND CONVOY', { vehicle: V.armored({ hp: 900, color: '#7a6c4a', livery: null }), escorts: 3, escortType: 'swat', threat: 4 }),
          evade('ESCAPE', 9, { threat: 4 }),
        ],
      },
      {
        title: 'SCORCHED',
        brief: 'Kane\'s fuel and ammunition depots keep his tanks running. Blow them all.',
        steps: [
          plant('DESTROY THE DEPOTS', 4, { blocks: ['industrial', 'parking'], guards: 2, fuse: 12 }),
          survive('SURVIVE THE COUNTERATTACK', 40, { threat: 5 }),
          evade('ESCAPE', 10, { threat: 4 }),
        ],
      },
      {
        title: 'AIR RAID',
        brief: 'Kane\'s gunships rule the sky. Bring them down.',
        loadout: { rpg: 14 },
        steps: [
          heli('SHOOT DOWN THE GUNSHIPS', 3, { threat: 4 }),
          evade('HIDE FROM THE AIR', 9, { threat: 4 }),
        ],
      },
      {
        title: 'TANK HUNTER',
        brief: 'Three tanks guard the valley road. Hunt them on foot with rockets.',
        loadout: { rpg: 14 },
        steps: [
          wreck('DESTROY THE TANKS', 3, { of: 'tank', threat: 5 }),
          evade('ESCAPE', 10, { threat: 4 }),
        ],
      },
      {
        title: 'THE DESERTER',
        brief: 'A soldier wants to tell the world what Kane is doing. Get him out alive.',
        steps: [
          meet('MEET THE DESERTER', [L('BROKER', 'He says Kane plans to put the whole country under martial law.'), L('KAI', 'Then he talks to the press. Get in.')], { at: P.oldtown, rig: 'swat' }),
          deliver('DRIVE THE DESERTER TO THE JOURNALISTS', P.far, { vehicle: V.van('#e9e2d0'), intact: 0.35, threat: 5 }),
          evade('LOSE THE ARMY', 10, { threat: 4 }),
        ],
      },
      {
        title: 'IRON WALL',
        brief: 'The army is surrounding the Broker\'s town. Hold the line.',
        loadout: { smg: 250, rpg: 8 },
        steps: [
          go('REACH THE TOWN SQUARE', P.plaza),
          hold('HOLD THE SQUARE', 75, { at: P.last, radius: 20, wave: 5, rig: 'swat', threat: 5 }),
          clear('BREAK THE SIEGE', 8, { at: P.last, rig: 'swat' }),
        ],
      },
      {
        title: 'KANE\'S CONVOY',
        brief: 'Kane himself is touring the front. Follow his convoy. Strike when it stops.',
        steps: [
          tail('FOLLOW KANE\'S CONVOY', { vehicle: V.armored({ hp: 1000, color: '#4b5320', livery: null }), to: P.far, min: 26, max: 130, onSpot: 'chase' }),
          talk([L('ROSA', 'It is a decoy! Kane is not in the convoy. It was a body double.'), L('KANE', 'Clever thief. But not clever enough. See you in the mountains.')]),
          evade('ESCAPE THE TRAP', 10, { threat: 5 }),
        ],
      },
      {
        title: 'NO RETREAT',
        brief: 'Take a tank and drive the army out of Dust Valley.',
        unlock: 'warhog',
        vehicle: { car: 'goliath' },
        steps: [
          wreck('DESTROY THE ARMY', 6, { threat: 5 }),
          heli('SHOOT DOWN THE GUNSHIPS', 2, { threat: 5 }),
          evade('ROLL OUT', 10, { threat: 4 }),
          talk([L('BROKER', 'The army is leaving the valley. You did it, driver.'), L('ROSA', 'Kane is in his mountain bunker in Frostbite. And Nadia is with him.')]),
        ],
      },
    ],
  },
  // =====================================================================================
  {
    title: 'COLD STEEL', map: 'snow',
    tagline: 'The general waits in the mountains. So does a traitor.',
    desc: 'General Kane has retreated to his fortress in Frostbite. Nadia is no longer on Kai\'s side. Getting to Kane means fighting through the deadliest defences in the country.',
    missions: [
      {
        title: 'RETURN TO THE ICE',
        brief: 'Back in Frostbite. Nadia is not answering. Find another way to get a tank.',
        steps: [
          talk([L('ROSA', 'Nadia\'s hangar is empty. She took everything.'), L('KAI', 'Then I take a tank from the army. Again.')]),
          steal('STEAL A TANK', V.tank(), { at: P.near(200, 380), guards: 6, guardRig: 'swat' }),
          deliver('HIDE THE TANK', P.far, { threat: 5 }),
        ],
      },
      {
        title: 'SKY SHIELD',
        brief: 'Kane\'s gunships patrol the city. Clear the sky.',
        loadout: { rpg: 16 },
        steps: [
          heli('SHOOT DOWN THE GUNSHIPS', 4, { threat: 4 }),
          evade('HIDE', 9, { threat: 4 }),
        ],
      },
      {
        title: 'FROZEN LINES',
        brief: 'Blow up the radar and missile posts that protect the bunker.',
        steps: [
          plant('DESTROY THE MISSILE POSTS', 4, { guards: 3, fuse: 12 }),
          survive('SURVIVE THE ALERT', 45, { threat: 5 }),
          evade('ESCAPE', 10, { threat: 4 }),
        ],
      },
      {
        title: 'WHITE DEATH',
        brief: 'Kane\'s elite soldiers are hunting you in the old town. Hunt them back.',
        loadout: { smg: 250, rpg: 6 },
        steps: [
          go('REACH THE OLD TOWN', P.oldtown),
          clear('DEFEAT THE ELITE SOLDIERS', 14, { at: P.last, rig: 'swat' }),
          evade('ESCAPE', 9, { threat: 4 }),
        ],
      },
      {
        title: 'THE BRIDGE',
        brief: 'Hold the bridge while Rosa hacks the bunker\'s defences.',
        loadout: { smg: 250, rpg: 10 },
        steps: [
          go('REACH THE BRIDGE', P.river(150, 300), { radius: 20 }),
          hold('HOLD THE BRIDGE', 80, { at: P.last, radius: 24, wave: 5, rig: 'swat', threat: 5 }),
          talk([L('ROSA', 'Defences down! But Kai… someone gave Kane our plan. It was Nadia.')]),
        ],
      },
      {
        title: 'BETRAYED AGAIN',
        brief: 'Nadia sold you to Kane. The whole army knows where you are.',
        steps: [
          talk([L('NADIA', 'Nothing personal, Mercer. Kane pays better than you.')], { threat: 6 }),
          survive('SURVIVE THE AIR STRIKE', 60, { threat: 6 }),
          evade('VANISH', 12, { threat: 5 }),
        ],
      },
      {
        title: 'NADIA',
        brief: 'Nadia is running with Kane\'s money. Catch her.',
        steps: [
          takedown('STOP NADIA', { vehicle: V.super('#9fe7ff', { hp: 420, speed: 50 }), escorts: 3, escortType: 'interceptor', threat: 4 }),
          talk([L('NADIA', 'Kane will not save you, Mercer. And neither will your friends. Ask Dima where he goes at night.'), L('KAI', 'What does that mean?')]),
          evade('ESCAPE', 10, { threat: 4 }),
        ],
      },
      {
        title: 'THE MOUNTAIN',
        brief: 'Race up to the mountain road and scout the bunker.',
        steps: [
          race('RACE TO THE MOUNTAIN ROAD', 8, { each: 22 }),
          scout('SCOUT THE BUNKER', 3, { guards: 2 }),
        ],
      },
      {
        title: 'GATES OF THE BUNKER',
        brief: 'Break into Kane\'s bunker.',
        loadout: { smg: 300, rpg: 10 },
        steps: [
          go('REACH THE BUNKER GATES', P.industrial, { threat: 3 }),
          clear('FIGHT THROUGH THE GATES', 12, { at: P.last, rig: 'swat', threat: 3 }),
          plant('BLOW THE BLAST DOORS', 3, { at: P.last, fuse: 8 }),
          hold('HOLD UNTIL THE DOORS OPEN', 40, { at: P.last, rig: 'swat', wave: 5, threat: 5 }),
        ],
      },
      {
        title: 'GENERAL KANE',
        brief: 'Kane is cornered in his own fortress. Finish this.',
        unlock: 'goliath',
        loadout: { smg: 300, rpg: 12 },
        steps: [
          talk([L('KANE', 'You are a car thief, Mercer. I command armies. Kneel.')], { threat: 4 }),
          kill('ELIMINATE GENERAL KANE', { at: P.parking, armed: true, rig: 'swat', hp: 450, guards: 10, alertThreat: 6, threat: 4 }),
          heli('SHOOT DOWN HIS GUNSHIPS', 2, { threat: 6 }),
          evade('ESCAPE THE MOUNTAIN', 12, { threat: 5 }),
          talk([L('KANE', 'Fool… the Architect knew you would come. He has always known. He raised you.'), L('ROSA', 'Kai… what did he mean?')]),
        ],
      },
    ],
  },
  // =====================================================================================
  {
    title: 'THE COMMISSIONER', map: 'city',
    tagline: 'The city wakes up. Its masters do not.',
    desc: 'With the army broken, only Commissioner Voss stands between Kai and the Architect. Kai turns the city against the man who owns it.',
    missions: [
      {
        title: 'HOMECOMING',
        brief: 'Metro City is under police control. Find out how bad it is.',
        steps: [
          talk([L('DIMA', 'Welcome home, Kai. Voss has declared a curfew. Police on every corner.'), L('KAI', 'Nadia said something about you, Dima.'), L('DIMA', 'Nadia says many things. Go to work.')]),
          scout('SYNCHRONIZE THE CITY', 4, { guards: 1 }),
          evade('SLIP AWAY', 8, { threat: 3 }),
        ],
      },
      {
        title: 'TURNING THE CITY',
        brief: 'Copies of the Ledger are hidden in the city. Get them to the press.',
        steps: [
          collect('COLLECT THE LEDGER COPIES', 6, { item: 'LEDGER COPY', spread: [120, 340], threat: 2 }),
          deliver('DELIVER THEM TO THE NEWSPAPER', P.downtown, { vehicle: V.van('#ffffff'), threat: 4 }),
          talk([L('RADIO', '…breaking news: documents link Commissioner Voss to a secret organisation called the Consortium…')]),
        ],
      },
      {
        title: 'VOSS\'S MACHINE',
        brief: 'Voss is deleting the evidence. Destroy his servers first.',
        steps: [
          plant('DESTROY THE PRECINCT SERVERS', 4, { guards: 3, fuse: 12 }),
          evade('ESCAPE', 10, { threat: 4 }),
        ],
      },
      {
        title: 'THE RALLY',
        brief: 'Voss is moving to a safe location. Follow his motorcade.',
        steps: [
          tail('FOLLOW VOSS\'S MOTORCADE', { vehicle: V.armored({ hp: 1100, color: '#111111' }), to: P.far, min: 26, max: 130 }),
          talk([L('ROSA', 'He has stopped at City Hall. That is his fortress now.')]),
        ],
      },
      {
        title: 'MOTORCADE',
        brief: 'Voss is moving between hideouts in an armoured car. Hit it.',
        loadout: { rpg: 12 },
        steps: [
          takedown('DESTROY THE ARMOURED CAR', { vehicle: V.armored({ hp: 1100, color: '#111111' }), escorts: 4, escortType: 'swat', threat: 5 }),
          talk([L('VOSS', 'A decoy, Mercer. I have dozens. And you have one life.')]),
          evade('ESCAPE', 10, { threat: 5 }),
        ],
      },
      {
        title: 'ALL UNITS',
        brief: 'Voss sends every police officer in the city after you. Survive.',
        steps: [
          survive('SURVIVE THE CITY-WIDE MANHUNT', 90, { threat: 6 }),
          evade('VANISH', 12, { threat: 5 }),
        ],
      },
      {
        title: 'CITY HALL',
        brief: 'Storm City Hall\'s defences.',
        loadout: { smg: 300, rpg: 10 },
        steps: [
          go('REACH CITY HALL', P.plaza, { threat: 3 }),
          clear('BREAK THE DEFENCE', 14, { at: P.last, rig: 'swat', threat: 3 }),
          hold('HOLD THE SQUARE', 60, { at: P.last, rig: 'swat', wave: 5, threat: 5 }),
        ],
      },
      {
        title: 'THE TOWER',
        brief: 'Voss is hiding in a downtown tower. Scout it and cut its defences.',
        steps: [
          scout('SCOUT THE TOWER', 3, { guards: 2 }),
          plant('CUT THE POWER AND ALARMS', 3, { guards: 2, fuse: 12 }),
          evade('PULL BACK', 9, { threat: 4 }),
        ],
      },
      {
        title: 'LAST STAND',
        brief: 'Voss throws everything at you: SWAT, helicopters, tanks.',
        loadout: { rpg: 14 },
        steps: [
          wreck('BREAK THE POLICE LINES', 6, { threat: 5 }),
          heli('SHOOT DOWN THE GUNSHIPS', 3, { threat: 5 }),
          evade('ESCAPE', 12, { threat: 5 }),
        ],
      },
      {
        title: 'COMMISSIONER VOSS',
        brief: 'Voss is making a run for it. This is the end of the Commissioner.',
        unlock: 'toro',
        loadout: { smg: 300, rpg: 10 },
        steps: [
          kill('ELIMINATE COMMISSIONER VOSS', { at: P.downtown, rig: 'business', guards: 10, flee: true, carModel: 'super', hp: 160, alertThreat: 5 }),
          talk([L('VOSS', 'You think I was the top, Mercer? Ask your old friend.'), L('VOSS', 'Ask Dima why he sent you into that vault. Ask him who the Architect is.')]),
          evade('GET OUT OF THE CITY', 12, { threat: 5 }),
          talk([L('ROSA', 'Kai… I decrypted the last name in the Ledger. The Architect. It is Dima.'), L('KAI', 'No. He raised me. He taught me to drive.'), L('ROSA', 'He planned the heist. He wanted the Ledger back. He is in Giza.')]),
        ],
      },
    ],
  },
  // =====================================================================================
  {
    title: 'THE ARCHITECT', map: 'giza',
    tagline: 'The road ends where it began.',
    desc: 'Dima — mentor, father figure, master of the Consortium — waits in Giza with the last of his power. Kai and Rosa go to end the Consortium for good.',
    missions: [
      {
        title: 'THE TRUTH',
        brief: 'Tariq has news about Dima. Meet him.',
        steps: [
          meet('MEET TARIQ', [L('TARIQ', 'Your Dima has bought half the city. His men are everywhere.'), L('TARIQ', 'He has a plane at the airstrip. When it flies, he disappears forever.')], { at: P.oldtown, rig: 'farmer' }),
          scout('SCOUT DIMA\'S CITY', 3, { guards: 2 }),
          talk([L('DIMA', 'Kai. My boy. I hoped you would never read that drive.'), L('KAI', 'You used me.'), L('DIMA', 'I made you. There is a difference.')]),
        ],
      },
      {
        title: 'OLD FRIEND',
        brief: 'Dima\'s men are moving the Consortium\'s money to the airstrip. Follow them.',
        steps: [
          tail('FOLLOW DIMA\'S TRUCK', { vehicle: V.armored({ hp: 900, color: '#c9a227', livery: null }), to: P.airstrip, min: 26, max: 130, onSpot: 'chase' }),
          clear('DEAL WITH THE GUARDS AT THE AIRSTRIP', 8, { at: P.airstrip }),
          evade('ESCAPE', 10, { threat: 4 }),
        ],
      },
      {
        title: 'THE ARCHITECT\'S GUARD',
        brief: 'Dima\'s private army controls the market. Take it back.',
        loadout: { smg: 350, rpg: 10 },
        steps: [
          go('GO TO THE MARKET', P.plaza),
          clear('DEFEAT DIMA\'S GUARD', 16, { at: P.last, rig: 'swat' }),
          evade('ESCAPE', 10, { threat: 5 }),
        ],
      },
      {
        title: 'SANDS OF TIME',
        brief: 'The Consortium\'s secret accounts open with six keys hidden around the city. Get them first.',
        steps: [
          collect('COLLECT THE ACCOUNT KEYS', 6, { item: 'KEY', spread: [140, 380], threat: 3 }),
          race('OUTRUN DIMA\'S MEN', 8, { each: 20, threat: 3 }),
          evade('LOSE THEM', 10, { threat: 4 }),
        ],
      },
      {
        title: 'NILE FIRE',
        brief: 'Dima\'s boats guard the river. Burn them.',
        vehicle: { boat: 'gunboat' },
        steps: [
          wreck('SINK DIMA\'S BOATS', 4, { of: 'boat', threat: 4 }),
          boat('TAKE THE RIVER', P.river(400, 700), { threat: 4 }),
        ],
      },
      {
        title: 'PHARAOH\'S GATE',
        brief: 'Dima\'s command post hides among the pyramids. Blow it apart.',
        loadout: { rpg: 14 },
        steps: [
          go('DRIVE TO THE PYRAMIDS', P.pyramid),
          plant('MINE THE COMMAND POSTS', 4, { at: P.pyramid, guards: 3, fuse: 12 }),
          heli('SHOOT DOWN THE GUNSHIPS', 2, { threat: 5 }),
        ],
      },
      {
        title: 'ALL OR NOTHING',
        brief: 'Dima calls in every favour he has. The whole Consortium is coming for you.',
        steps: [
          talk([L('DIMA', 'Everything I built, Kai. Every police officer, every soldier. All of them, against you.')], { threat: 6 }),
          survive('SURVIVE THE CONSORTIUM', 120, { threat: 6 }),
          evade('VANISH', 12, { threat: 5 }),
        ],
      },
      {
        title: 'DIMA',
        brief: 'Dima wants to talk. At the Sphinx. Alone.',
        loadout: { smg: 350, rpg: 12 },
        steps: [
          meet('MEET DIMA AT THE SPHINX', [L('DIMA', 'You came. I knew you would.'), L('DIMA', 'Join me, Kai. The Consortium needs a driver. A son.'), L('KAI', 'I already had a father. I thought it was you.')], { at: P.sphinx, rig: 'business' }),
          clear('FIGHT DIMA\'S BODYGUARDS', 12, { at: P.last, rig: 'swat', threat: 3 }),
          takedown('CHASE DIMA DOWN', { vehicle: V.super('#ff9f1c', { hp: 600, speed: 52 }), at: P.near(50, 100), escorts: 4, escortType: 'interceptor', threat: 5 }),
          talk([L('DIMA', 'Clever boy… but the plane… it is already fuelled…'), L('ROSA', 'Kai, the Ledger! He had it with him. He is sending it to the plane!')]),
        ],
      },
      {
        title: 'THE PLANE',
        brief: 'The Ledger is on its way to Dima\'s plane. Stop it at the airstrip.',
        loadout: { rpg: 14 },
        steps: [
          go('RACE TO THE AIRSTRIP', P.airstrip, { threat: 6 }),
          hold('HOLD THE AIRSTRIP', 60, { at: P.airstrip, radius: 24, wave: 6, rig: 'swat', threat: 5 }),
          heli('SHOOT DOWN THE ESCORT GUNSHIPS', 3, { threat: 6 }),
        ],
      },
      {
        title: 'THE LONG ROAD HOME',
        brief: 'Get Rosa and the Ledger out of Giza. The whole world is about to read it.',
        unlock: 'velox',
        final: true,
        steps: [
          meet('PICK UP ROSA', [L('ROSA', 'I have the Ledger. All of it. Let us go home.'), L('KAI', 'Home. I do not know where that is anymore.'), L('ROSA', 'Wherever we stop running.')], { at: P.oldtown, rig: 'woman2' }),
          deliver('DRIVE ROSA TO THE AIRSTRIP', P.airstrip, { vehicle: V.armored({ color: '#2b2d42' }), intact: 0.3, threat: 6 }),
          heli('CLEAR THE SKY FOR TAKE-OFF', 3, { threat: 5 }),
          talk([L('RADIO', '…the Consortium files are now public. Arrests are being made in four cities…'), L('ROSA', 'It is over, Kai.'), L('KAI', 'No. It is the first quiet road I have driven in years.'), L('TARIQ', 'The engine is running, my friends. Go.')], { threat: -1 }),
        ],
      },
    ],
  },
];
