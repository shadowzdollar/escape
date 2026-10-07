// ACT I — sequences 1-4: the heist, the betrayal, the Commissioner's dogs, the desert king.
import { L, talk, go, foot, boat, swim, collect, survive, evade, wreck, heli, kill, takedown, tail, steal, deliver, hold, clear, race, plant, scout, meet, P, V } from './dsl.js';

export const ACT1 = [
  // =====================================================================================
  {
    title: 'THE HEIST', map: 'city',
    tagline: 'One last job. It was never just about the money.',
    desc: 'Kai Mercer, the best getaway driver in Metro City, robs the First National Bank with an old crew. Inside the vault there is more than cash: a hard drive the bank was hiding — the Ledger.',
    missions: [
      {
        title: 'THE VAULT', intro: true,
        brief: 'The alarm is screaming and the whole precinct is on the radio. Get the cash and the drive out of downtown.',
        steps: [
          talk([L('ROSA', 'Kai, you are clear of the bank. Every patrol car in Metro City is coming your way.'), L('KAI', 'Then let us give them a show.')], { threat: 2 }),
          go('BREAK THROUGH THE POLICE NET', P.near(320, 460), { threat: 2, say: [L('RADIO', 'All units, armed robbery at First National. Suspect vehicle heading out of downtown.')] }),
          evade('LOSE THE POLICE', 8, { threat: 2, end: [L('ROSA', 'Scanners are going quiet. You lost them.')] }),
          talk([L('ROSA', 'Something is off. Silas says the vault had a sealed case nobody ordered us to take.'), L('KAI', 'I grabbed it anyway. Hard drive. Bank seal, no label.')]),
          go('REACH THE SAFEHOUSE GARAGE', P.near(260, 420), { say: [L('ROSA', 'Bring it to the garage. Dima is waiting.')] }),
          talk([L('DIMA', 'Kai! Look at you, still in one piece.'), L('DIMA', 'Leave the drive with me. I know a man who can open anything.')], { secs: 2 }),
        ],
      },
      {
        title: 'LOOSE ENDS',
        brief: 'The crew dropped cash bags all over town during the getaway. Collect them before the police do.',
        steps: [
          meet('MEET DIMA IN THE OLD TOWN', [L('DIMA', 'The others panicked and threw bags out of the windows. Amateurs.'), L('DIMA', 'Four bags. Find them before some kid on a bicycle does.')], { at: P.oldtown }),
          collect('COLLECT THE DROPPED CASH', 4, { item: 'CASH BAG', say: [L('ROSA', 'I marked the bags from the traffic cameras.')] }),
          talk([L('RADIO', 'Patrols, be advised: suspect seen collecting stolen money downtown.')], { threat: 1 }),
          evade('SHAKE OFF THE PATROLS', 6, { threat: 1 }),
          go('BRING THE CASH TO THE GARAGE', P.near(250, 400), { end: [L('DIMA', 'All of it. Good. The drive is another story — it is encrypted like a military safe.')] }),
        ],
      },
      {
        title: 'HOT WHEELS',
        brief: 'Your car is burned: every camera in the city has seen it. Steal a collector\'s sports car from a private party.',
        steps: [
          talk([L('DIMA', 'Your plates are on every screen in the precinct. You need a new ride.'), L('DIMA', 'A banker is showing off his car at a garden party. Two security men. Be quiet about it.')]),
          steal('STEAL THE BANKER\'S CAR', V.sports('#c0c0c0'), { at: P.near(200, 340), guards: 2, say: [L('ROSA', 'Walk in, do not run. Guards notice running.')] }),
          go('TAKE IT TO DIMA\'S CHOP SHOP', P.near(350, 520), { threat: 1, say: [L('RADIO', 'Reported vehicle theft, silver sports coupe.')] }),
          evade('LOSE THE PATROL', 6, { threat: 1 }),
          talk([L('DIMA', 'Beautiful. New plates, new paint. Nobody will know.'), L('KAI', 'What about the drive?'), L('DIMA', 'Patience. Rosa is working on it.')]),
        ],
      },
      {
        title: 'SWIM FOR IT',
        brief: 'A courier for the bank is waiting across the river. Cross on foot, by water, and take back what he is carrying.',
        steps: [
          talk([L('ROSA', 'The bank sent a courier to recover the drive. He is camped by the river.'), L('ROSA', 'The bridges have checkpoints. You go under them.')]),
          foot('GET OUT AND WALK TO THE RIVERBANK', P.river(40, 120)),
          swim('SWIM ACROSS THE RIVER', { say: [L('KAI', 'This water is freezing.'), L('ROSA', 'Then swim faster.')] }),
          collect('FIND THE COURIER\'S DROP BAGS', 3, { spread: [60, 160], item: 'PACKAGE' }),
          boat('TAKE A BOAT DOWN THE RIVER', P.river(250, 450), { say: [L('ROSA', 'There is a speedboat moored on the bank. Take it.')] }),
          talk([L('ROSA', 'The packages have bank letterhead. Names. Accounts. Someone very rich is very scared of that drive.')]),
        ],
      },
      {
        title: 'THE FENCE',
        brief: 'A fence named Greaves is selling information about the heist. Follow his courier to find out who is buying.',
        steps: [
          talk([L('DIMA', 'Greaves is a fence. He is telling people we have the drive.'), L('DIMA', 'His courier just left. Follow him — and do not get close.')]),
          tail('FOLLOW THE COURIER', { vehicle: V.sedan('#6b705c'), to: P.far, min: 18, max: 110, say: [L('ROSA', 'Stay behind him. If he sees you in his mirror, he runs.')] }),
          foot('GET CLOSER ON FOOT', P.last, { radius: 14 }),
          kill('TAKE DOWN GREAVES', { at: P.last, rig: 'business', guards: 2, hp: 60, flee: true, alertThreat: 1, say: [L('ROSA', 'Greaves is the one in the suit. Silent is better.')] }),
          evade('GET AWAY', 6, { threat: 1, end: [L('KAI', 'Greaves had a phone. One number: COMMISSIONER\'S OFFICE.')] }),
        ],
      },
      {
        title: 'FIRST BLOOD',
        brief: 'A gang called the Rats wants the drive for themselves. They are waiting in the park. Show them who owns these streets.',
        steps: [
          talk([L('ROSA', 'The Rats put a price on your head. They are gathering in the park.'), L('KAI', 'Then I will go to them.')]),
          go('DRIVE TO THE PARK', P.park),
          clear('BEAT THE RATS', 6, { at: P.last, say: [L('ROSA', 'Use the car if you have to. They have guns.')] }),
          hold('HOLD THE PARK', 35, { at: P.last, radius: 18, wave: 3, say: [L('ROSA', 'More of them are coming. Hold your ground!')] }),
          evade('LOSE THE POLICE', 7, { threat: 2, say: [L('RADIO', 'Shots fired in the park. All units respond.')] }),
        ],
      },
      {
        title: 'ROSA\'S EYES',
        brief: 'Rosa needs cameras across the city to watch the people hunting you. Climb to the best views and set them up.',
        steps: [
          talk([L('ROSA', 'If they are watching us, we watch them. I need eyes on the city.'), L('ROSA', 'Stand at each spot for a few seconds. My cameras do the rest.')]),
          scout('SYNCHRONIZE THE VIEWPOINTS', 3, { say: [L('KAI', 'Like a tourist with a hidden camera.')] }),
          plant('INSTALL SIGNAL RELAYS', 2, { boom: false, verb: 'RELAY INSTALLED', guards: 1, guardRig: 'worker' }),
          talk([L('ROSA', 'Network online. And — oh. The drive just answered. It has a name inside.'), L('ROSA', 'THE CONSORTIUM. Seven names and an eighth that only says: THE ARCHITECT.')]),
        ],
      },
      {
        title: 'THE BUYER',
        brief: 'Silas has found a buyer for the drive. Meet him, and be ready if the deal goes wrong.',
        steps: [
          talk([L('SILAS', 'Kai, brother. I found a buyer. Big money. We all retire.'), L('KAI', 'We do not even know what it is.'), L('SILAS', 'Exactly why we sell it.')]),
          meet('MEET THE BUYER AT THE PLAZA', [L('BROKER', 'You must be the driver. Show me the drive.'), L('KAI', 'Show me the money first.'), L('BROKER', 'Ah. About that…')], { at: P.plaza, rig: 'business' }),
          clear('IT\'S A TRAP — FIGHT BACK', 7, { at: P.last, rig: 'swat' }),
          takedown('STOP THE BUYER\'S CAR', { vehicle: V.sports('#1b263b'), at: P.near(60, 110), say: [L('ROSA', 'The broker is getting away in a black coupe!')] }),
          evade('DISAPPEAR', 7, { threat: 2 }),
        ],
      },
      {
        title: 'BETRAYAL',
        brief: 'Somebody told the police where the crew was hiding. The safehouse is surrounded.',
        steps: [
          talk([L('ROSA', 'Kai, police at the safehouse. Dozens of them. Someone gave them the address.'), L('DIMA', 'Only four people knew it.')], { threat: 3 }),
          survive('SURVIVE THE RAID', 45, { threat: 3, say: [L('RADIO', 'Suspect is mobile. Do not let him leave the district.')] }),
          go('BREAK OUT OF THE DISTRICT', P.near(420, 600), { threat: 3 }),
          evade('LOSE THE POLICE', 9, { threat: 3 }),
          talk([L('SILAS', 'Kai… I am sorry. They offered me a clean record and a fortune.'), L('SILAS', 'Give them the drive and you live. That is the deal.'), L('KAI', 'You sold us out, Silas.')]),
        ],
      },
      {
        title: 'OUT OF THE FIRE',
        brief: 'Get out of the city centre by any road — or the river.',
        unlock: 'stallion',
        steps: [
          talk([L('DIMA', 'You cannot stay downtown. Get to the river. Boats do not have plates.')], { threat: 3 }),
          wreck('STOP THE PURSUIT', 3, { threat: 3, say: [L('ROSA', 'They will not stop. Take some of them off the road.')] }),
          boat('ESCAPE BY BOAT', P.river(300, 500), { threat: 2 }),
          evade('LOSE THE POLICE BOATS', 8, { threat: 2 }),
          go('REACH THE NEW HIDEOUT', P.near(300, 480)),
          talk([L('DIMA', 'A friend left you a present in the garage. An old Stallion. It will be yours.'), L('ROSA', 'And now we know the name of our enemy. The Consortium.'), L('KAI', 'Then Silas is first.')]),
        ],
      },
    ],
  },
  // =====================================================================================
  {
    title: 'NEON BLOOD', map: 'night',
    tagline: 'Every light in the city hides someone who sold you.',
    desc: 'Silas has gone underground in the neon districts with his new friends. To reach him, Kai has to work through the club owners, dealers and street racers who protect him.',
    missions: [
      {
        title: 'AFTER DARK',
        brief: 'Silas lives at night now. Learn the neon districts before they learn you.',
        steps: [
          meet('MEET ROSA IN THE OLD TOWN', [L('ROSA', 'Welcome to Neon Nights. Silas is somewhere out here.'), L('ROSA', 'I need my cameras on the main streets first.')], { at: P.oldtown, rig: 'woman2' }),
          scout('SYNCHRONIZE THE VIEWPOINTS', 3),
          talk([L('ROSA', 'I see him. Or his car. A club owner called Velvet is protecting him.')]),
          go('DRIVE PAST VELVET\'S CLUB', P.near(300, 450)),
          evade('SLIP AWAY BEFORE THE BOUNCERS CALL IT IN', 6, { threat: 1 }),
        ],
      },
      {
        title: 'THE CLUB KING',
        brief: 'Follow Velvet to his private meeting and plant a listening device.',
        steps: [
          talk([L('ROSA', 'Velvet is leaving the club. Follow him, quietly.')]),
          tail('TAIL VELVET', { vehicle: V.super('#7b2ff7'), to: P.far, min: 18, max: 100 }),
          plant('PLANT THE BUG NEAR THE MEETING', 1, { at: P.last, boom: false, verb: 'BUG PLANTED', guards: 3, guardRig: 'punk' }),
          talk([L('VOSS', '…the driver still has the drive. Silas will bring him to us.'), L('ROSA', 'That voice. Kai, that is the Police Commissioner. Voss.')]),
          evade('LEAVE BEFORE THEY FIND THE BUG', 7, { threat: 2 }),
        ],
      },
      {
        title: 'NEON RUNNER',
        brief: 'The street racers know where Silas sleeps. They only talk to people who beat them.',
        steps: [
          meet('FIND THE RACE ORGANISER', [L('BROKER', 'You want a name? Win my race. Lose and you buy everyone a new car.')], { at: P.parking, rig: 'punk' }),
          race('WIN THE STREET RACE', 6, { each: 20 }),
          talk([L('BROKER', 'Fine. Silas has a garage near the docks and a crew guarding it.')]),
          evade('LOSE THE POLICE THAT HEARD THE RACE', 6, { threat: 2 }),
        ],
      },
      {
        title: 'PAPER TRAIL',
        brief: 'Silas has been paying his crew with money from the Consortium. Find their payment drops.',
        steps: [
          talk([L('ROSA', 'Silas pays his crew through dead drops. Five of them tonight.')]),
          collect('STEAL THE PAYMENT DROPS', 5, { item: 'PAYMENT', spread: [120, 320] }),
          talk([L('RADIO', 'Report of a man stealing envelopes from trash bins. Units nearby, check it out.')], { threat: 2 }),
          evade('LOSE THE POLICE', 8, { threat: 2 }),
          go('BRING THEM TO ROSA', P.near(250, 400), { end: [L('ROSA', 'Bank transfers. All signed by the same account: CONSORTIUM HOLDINGS.')] }),
        ],
      },
      {
        title: 'SILAS\'S CREW',
        brief: 'Silas\'s crew is guarding his garages. Take them apart, one garage at a time.',
        steps: [
          go('DRIVE TO THE FIRST GARAGE', P.parking),
          clear('TAKE OUT THE CREW', 6, { at: P.last }),
          go('DRIVE TO THE SECOND GARAGE', P.industrial),
          clear('TAKE OUT THE REST', 7, { at: P.last }),
          talk([L('SILAS', 'Kai! You are killing my people! I tried to save you!'), L('KAI', 'You tried to sell me.')], { threat: 2 }),
          evade('DISAPPEAR', 7, { threat: 2 }),
        ],
      },
      {
        title: 'WIRETAP',
        brief: 'Plant relays on three phone exchanges so Rosa can hear every call Silas makes.',
        steps: [
          talk([L('ROSA', 'Three phone exchanges cover the night district. Each one is guarded.'), L('ROSA', 'Take your time. Walk, do not run near the guards.')]),
          plant('WIRE THE PHONE EXCHANGES', 3, { boom: false, verb: 'EXCHANGE TAPPED', guards: 2, guardRig: 'worker' }),
          talk([L('ROSA', 'Got him. Silas meets a dealer named Kross every night in the park.')]),
          evade('GET CLEAR', 6, { threat: 1 }),
        ],
      },
      {
        title: 'THE DEALER',
        brief: 'Kross sells guns to Silas. Take him out without starting a war in the park.',
        loadout: { smg: 60 },
        steps: [
          talk([L('ROSA', 'Kross is in the park with bodyguards. Get close and do it quietly.'), L('ROSA', 'If he sees you, he will run for his car.')]),
          kill('ELIMINATE KROSS', { at: P.park, rig: 'punk', guards: 4, guardRig: 'punk2', flee: true, hp: 80, alertThreat: 1 }),
          evade('GET AWAY FROM THE PARK', 7, { threat: 2 }),
          talk([L('KAI', 'Kross had a key card. Police depot.'), L('ROSA', 'Silas is getting his cars from the police. Of course he is.')]),
        ],
      },
      {
        title: 'RAIN CHECK',
        brief: 'Steal a police interceptor from the depot. With police plates, you can drive right up to Silas.',
        steps: [
          steal('STEAL A POLICE INTERCEPTOR', V.cop('interceptor'), { at: P.near(220, 380), guards: 3, guardRig: 'swat' }),
          deliver('DRIVE IT TO DIMA', P.near(400, 600), { intact: 0.4, threat: 2, say: [L('DIMA', 'Bring it in one piece. I need to swap the tracker.')] }),
          wreck('DEAL WITH THE CARS THAT FOLLOWED YOU', 2, { threat: 2 }),
          evade('LOSE THE REST', 7, { threat: 2 }),
          talk([L('DIMA', 'Tracker gone. Now you are a police officer. Smile.')]),
        ],
      },
      {
        title: 'CORNERED',
        brief: 'Silas has set a trap and the police are in on it. Hold out until Rosa finds a way out.',
        steps: [
          talk([L('ROSA', 'Kai, it is an ambush! Silas told them you would be here!')], { threat: 3 }),
          hold('HOLD THE PLAZA', 50, { at: P.plaza, radius: 18, wave: 4, threat: 3 }),
          survive('SURVIVE UNTIL ROSA OPENS A ROUTE', 40, { threat: 4 }),
          evade('ESCAPE', 9, { threat: 4 }),
        ],
      },
      {
        title: 'SILAS',
        brief: 'Rosa has found Silas. Follow him to his hideout and end this.',
        unlock: 'rosso',
        steps: [
          talk([L('ROSA', 'Silas is driving to meet Voss. Follow him.'), L('KAI', 'If he sees me, I chase. Either way, this ends tonight.')]),
          tail('TAIL SILAS', { vehicle: V.sports('#e63946', { hp: 260 }), to: P.far, min: 20, max: 110, onSpot: 'chase' }),
          takedown('STOP SILAS FOR GOOD', { vehicle: V.sports('#e63946', { hp: 300, speed: 46 }), at: P.near(50, 90), escorts: 2, escortType: 'interceptor', threat: 2 }),
          talk([L('SILAS', 'Kai… it was never about money. Voss works for them. The Consortium.'), L('SILAS', 'They own the police, the army… They will never stop.'), L('KAI', 'Neither will I.')]),
          evade('LEAVE BEFORE VOSS ARRIVES', 8, { threat: 3 }),
        ],
      },
    ],
  },
  // =====================================================================================
  {
    title: 'THE COMMISSIONER\'S DOGS', map: 'city',
    tagline: 'They wear badges. They answer to no one.',
    desc: 'Commissioner Voss sends his private task force after the crew. When they take Rosa, Kai goes to war with the police department itself — and its hunting dog, SWAT Captain Reyes.',
    missions: [
      {
        title: 'BADGES',
        brief: 'Voss has a private task force. Learn how it works by borrowing one of its cars.',
        steps: [
          talk([L('ROSA', 'Voss runs a unit that does not exist on paper. Their cars use special radios.'), L('KAI', 'Then I borrow one.')]),
          steal('STEAL A TASK FORCE CRUISER', V.cop('patrol'), { at: P.near(200, 350), guards: 2 }),
          deliver('BRING IT TO ROSA', P.near(380, 560), { threat: 1 }),
          talk([L('ROSA', 'Their radio codes. They have a list of targets. We are numbers one to four.')]),
        ],
      },
      {
        title: 'INSIDE MAN',
        brief: 'An honest detective wants to help. Meet him and follow the corrupt officer he points out.',
        steps: [
          meet('MEET THE DETECTIVE', [L('KAI', 'Why help me?'), L('BROKER', 'Because I took an oath. Voss took a salary.'), L('BROKER', 'Officer Mills carries the task force orders. He drives home at six.')], { at: P.oldtown, rig: 'business' }),
          tail('FOLLOW OFFICER MILLS', { vehicle: V.cop('patrol'), to: P.far, min: 20, max: 110 }),
          collect('STEAL THE ORDERS FROM HIS CAR AND HOUSE', 3, { spread: [30, 120], item: 'DOCUMENT' }),
          evade('GET AWAY', 7, { threat: 2 }),
        ],
      },
      {
        title: 'EVIDENCE ROOM',
        brief: 'The evidence that could clear the crew is in a precinct annex. Black out the building and fight your way in.',
        loadout: { smg: 90 },
        steps: [
          talk([L('ROSA', 'Two generators power the annex. Cut them and the doors open.')]),
          plant('SABOTAGE THE GENERATORS', 2, { guards: 2, fuse: 10 }),
          go('GET TO THE ANNEX', P.parking, { threat: 2 }),
          clear('FIGHT THROUGH THE TASK FORCE', 7, { at: P.last, rig: 'swat', threat: 2 }),
          collect('GRAB THE EVIDENCE BOXES', 3, { spread: [30, 90], item: 'EVIDENCE' }),
          evade('ESCAPE', 9, { threat: 3 }),
        ],
      },
      {
        title: 'TAKEN',
        brief: 'While you were at the annex, the task force hit the hideout. Rosa is gone.',
        steps: [
          talk([L('DIMA', 'Kai! They came in with masks. They took Rosa!'), L('KAI', 'Where?'), L('DIMA', 'A grey van. Hurry!')], { threat: 2 }),
          hold('DEFEND THE HIDEOUT', 35, { at: P.near(30, 80), radius: 18, wave: 3, rig: 'swat', threat: 2 }),
          tail('FOLLOW THE VAN TO WHERE THEY KEEP HER', { vehicle: V.van('#6c757d', { hp: 600 }), to: P.far, min: 22, max: 120, at: P.near(60, 100) }),
          talk([L('KAI', 'An old warehouse. Lots of guards.'), L('DIMA', 'Wait for dark? No. Go now.')]),
        ],
      },
      {
        title: 'PRISON BREAK',
        brief: 'Rosa is held in a warehouse. Get her out and drive her home in one piece.',
        steps: [
          go('REACH THE WAREHOUSE', P.industrial),
          clear('TAKE OUT THE GUARDS', 8, { at: P.last, rig: 'swat' }),
          meet('FREE ROSA', [L('ROSA', 'Took you long enough.'), L('KAI', 'Traffic.'), L('ROSA', 'They wanted the decryption key. I gave them a fake one. They will notice soon.')], { at: P.last, rig: 'woman2' }),
          deliver('DRIVE ROSA TO SAFETY', P.far, { vehicle: V.van('#2b2d42'), intact: 0.35, threat: 3 }),
          evade('LOSE THE TASK FORCE', 8, { threat: 3 }),
        ],
      },
      {
        title: 'SWAT SEASON',
        brief: 'Captain Reyes has unleashed his SWAT trucks. Show him what they are worth.',
        loadout: { rpg: 4 },
        steps: [
          talk([L('REYES', 'Mercer. This is Captain Reyes. Give yourself up and the woman lives.'), L('KAI', 'She is already with me, Captain.')], { threat: 4 }),
          wreck('DESTROY SWAT TRUCKS', 4, { of: 'swat', threat: 4 }),
          evade('LOSE THEM', 9, { threat: 4 }),
        ],
      },
      {
        title: 'THE ARMORY',
        brief: 'Reyes keeps his heavy gear in a guarded armory truck. Steal it.',
        steps: [
          steal('STEAL THE ARMORY TRUCK', V.armored(), { at: P.near(200, 380), guards: 4 }),
          deliver('DELIVER IT TO DIMA', P.far, { threat: 3, intact: 0.3 }),
          talk([L('DIMA', 'Rifles, rockets, armour. Reyes will be naked without this.')]),
        ],
      },
      {
        title: 'REYES\'S ROUTE',
        brief: 'Reyes drives the same route every morning. Scout it and plant charges.',
        steps: [
          scout('SCOUT THE ROUTE', 3),
          plant('PLANT CHARGES ON THE ROUTE', 3, { fuse: 12 }),
          evade('GET OUT BEFORE THEY BLOW', 6, { threat: 2 }),
          talk([L('ROSA', 'Reyes survived. Armoured car. But now he is angry — and careless.')]),
        ],
      },
      {
        title: 'AMBUSH',
        brief: 'Reyes is leading the hunt himself. Turn the ambush around.',
        loadout: { smg: 120, rpg: 4 },
        steps: [
          talk([L('ROSA', 'Reyes set up a command post in a car park. That is where he is.')], { threat: 3 }),
          go('REACH THE COMMAND POST', P.parking, { threat: 3 }),
          kill('ELIMINATE CAPTAIN REYES', { at: P.last, armed: true, rig: 'swat', hp: 220, guards: 6, alertThreat: 4, threat: 3 }),
          evade('ESCAPE THE SWAT RESPONSE', 9, { threat: 4 }),
        ],
      },
      {
        title: 'BADGE OF DISHONOR',
        brief: 'With Reyes gone, Voss sends everything he has. Survive and disappear.',
        unlock: 'gelande',
        steps: [
          talk([L('VOSS', 'Mercer. You killed a decorated officer. There is nowhere in this city you can hide.')], { threat: 4 }),
          survive('SURVIVE THE MANHUNT', 50, { threat: 4 }),
          heli('SHOOT DOWN THE HELICOPTER', 1, { threat: 3, say: [L('ROSA', 'They have a gunship on you! Use the rockets!')] }),
          evade('VANISH', 10, { threat: 3 }),
          talk([L('ROSA', 'The Ledger says Voss gets his weapons from the desert. A smuggler called Marlo Kade.'), L('KAI', 'Then we go to the desert.')]),
        ],
      },
    ],
  },
  // =====================================================================================
  {
    title: 'DUST AND IRON', map: 'desert',
    tagline: 'In Dust Valley, the king owns the roads.',
    desc: 'Marlo Kade runs every smuggling route through Dust Valley and supplies the Consortium with weapons and dirty money. Kai and Rosa take his empire apart, one truck at a time.',
    missions: [
      {
        title: 'DESERT WELCOME',
        brief: 'You are new in Dust Valley. Find Kade\'s rival and prove you can drive.',
        steps: [
          meet('MEET THE BROKER', [L('BROKER', 'So you are the one who robbed First National. Kade will want your head.'), L('BROKER', 'I want his. Prove you can drive.')], { at: P.oldtown, rig: 'adventurer' }),
          race('RUN THE DESERT ROUTE', 7, { each: 22 }),
          talk([L('BROKER', 'Fast. Good. Kade moves money in trucks at dawn. You are going to rob them.')]),
        ],
      },
      {
        title: 'SAND RUNNER',
        brief: 'Kade hides cash crates around the valley. Grab them and bring them in with a truck.',
        steps: [
          steal('STEAL A PICKUP TRUCK', V.truck('#a0522d'), { at: P.near(120, 260) }),
          collect('COLLECT KADE\'S CRATES', 5, { item: 'CRATE', spread: [120, 300] }),
          deliver('DRIVE THE CRATES TO THE BROKER', P.far, { threat: 1 }),
        ],
      },
      {
        title: 'CONVOY',
        brief: 'An armoured truck full of Kade\'s money is crossing town with police escorts.',
        loadout: { rpg: 3 },
        steps: [
          talk([L('BROKER', 'Kade pays the police to escort his money. Two cars, one truck.')]),
          takedown('DESTROY THE MONEY TRUCK', { vehicle: V.armored({ hp: 700 }), escorts: 2, escortType: 'patrol', at: P.near(80, 150), threat: 2 }),
          collect('GRAB THE SPILLED CASH', 3, { spread: [10, 60], item: 'CASH', threat: 2 }),
          evade('LOSE THE ESCORTS', 8, { threat: 3 }),
        ],
      },
      {
        title: 'DRY WELLS',
        brief: 'Kade\'s men are coming to take back the money. Defend the Broker\'s yard.',
        steps: [
          go('GET TO THE YARD', P.industrial),
          hold('DEFEND THE YARD', 60, { at: P.last, radius: 20, wave: 4 }),
          clear('FINISH THE LAST OF THEM', 5, { at: P.last }),
          talk([L('KADE', 'Driver. You are stealing from me in my own valley. That is brave. And stupid.')]),
        ],
      },
      {
        title: 'TAILING THE KING',
        brief: 'Kade\'s lieutenant knows where the king sleeps. Follow him without being seen — he will kill the trail if he notices.',
        steps: [
          tail('FOLLOW THE LIEUTENANT', { vehicle: V.truck('#4f5a36'), to: P.far, min: 24, max: 120 }),
          kill('TAKE OUT THE LIEUTENANT QUIETLY', { at: P.last, rig: 'adventurer', guards: 4, guardRig: 'punk', strict: true }),
          talk([L('ROSA', 'He had the map of Kade\'s fuel depots. Burn them and the valley stops.')]),
        ],
      },
      {
        title: 'BURNING ROADS',
        brief: 'Blow up Kade\'s fuel depots. Then survive his fury.',
        steps: [
          plant('MINE THE FUEL DEPOTS', 3, { blocks: ['industrial', 'parking'], guards: 2, guardRig: 'punk', fuse: 14 }),
          survive('SURVIVE KADE\'S MEN AND THE POLICE', 45, { threat: 3 }),
          evade('ESCAPE', 9, { threat: 3 }),
        ],
      },
      {
        title: 'THE MIRAGE',
        brief: 'Kade\'s pride and joy is his desert racing truck. Take it from his garage.',
        steps: [
          steal('STEAL KADE\'S RAPTOR', V.car('raptor'), { at: P.near(200, 380), guards: 4, guardRig: 'punk' }),
          deliver('DRIVE IT ACROSS THE VALLEY', P.far, { intact: 0.5, threat: 3 }),
          talk([L('KADE', 'That truck was my father\'s. I will bury you in the sand, driver.')]),
        ],
      },
      {
        title: 'BLOOD MONEY',
        brief: 'Kade is paying the police to hunt you. Steal his bribes before they arrive.',
        steps: [
          collect('INTERCEPT THE BRIBES', 6, { item: 'BRIBE', spread: [100, 320], threat: 2 }),
          wreck('STOP THE BOUGHT POLICE', 3, { threat: 3 }),
          evade('LOSE THEM', 9, { threat: 3 }),
        ],
      },
      {
        title: 'KADE\'S FORTRESS',
        brief: 'Kade is hiding behind his army of smugglers. Break the fortress open.',
        loadout: { smg: 150, rpg: 5 },
        steps: [
          go('REACH THE FORTRESS', P.industrial),
          clear('BREAK THROUGH THE SMUGGLERS', 10, { at: P.last }),
          plant('BLOW THE FORTRESS GATES', 2, { at: P.last, fuse: 8 }),
          hold('HOLD THE COURTYARD', 40, { at: P.last, wave: 4, threat: 2 }),
        ],
      },
      {
        title: 'THE KING FALLS',
        brief: 'Kade is cornered. End his reign over Dust Valley.',
        unlock: 'raptor',
        steps: [
          talk([L('KADE', 'Come then, driver. Let us see who the desert loves more.')]),
          kill('ELIMINATE MARLO KADE', { at: P.block(['parking', 'plaza'], 150, 350), rig: 'adventurer', guards: 7, guardRig: 'punk', flee: true, carModel: 'truck', hp: 120, alertThreat: 3 }),
          evade('ESCAPE THE VALLEY POLICE', 9, { threat: 3 }),
          talk([L('ROSA', 'Kade\'s phone. Last call: a weapons buyer in Frostbite. A woman named Nadia.'), L('ROSA', 'And an army colonel. Drago. The Consortium is arming itself.')]),
        ],
      },
    ],
  },
];
