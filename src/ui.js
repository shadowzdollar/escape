// DOM UI: screens, garage, map select, settings, HUD and notifications.
import { CARS, MAPS, PAINTS, POWERUPS, COIN_VALUE, WANTED } from './config.js';
import { BOATS, VEHICLE_WEAPONS } from './warVehicles.js';
import { BOAT_STATS } from './boats.js';
import { TROPHIES } from './campaign.js';
import { SEQUENCES, STORY, contractsFor, rankOf, xpForRank, storyUnlocked, sequenceUnlocked, nextStoryMission, progress, getMission, TOTAL_MISSIONS } from './story/index.js';
import { speaker } from './story/characters.js';
import { formatTime } from './utils.js';
import { Vector3 as THREE_VEC } from 'three';
const WEAPON_NAMES = { pistol: 'PISTOL', smg: 'SMG', rpg: 'ROCKETS' };

const $ = (s) => document.querySelector(s);

export class UI {
  constructor(game) {
    this.game = game;
    this.screens = ['loading', 'menu', 'modes', 'story', 'trophies', 'garage', 'maps', 'settings', 'controls', 'hud', 'pause', 'gameover', 'win', 'brief', 'sresult'];
    this.garageIndex = 0;
    this.comboTimer = 0;
    this.h = {
      time: $('#h-time'), score: $('#h-score'), coins: $('#h-coins'), stars: $('#h-stars'), hp: $('#h-hp'),
      nitro: $('#h-nitro'), speed: $('#h-speed'), bust: $('#h-bust'), bustBar: $('#h-bust-bar'), combo: $('#h-combo'),
      powers: $('#h-powers'), toasts: $('#toasts'), fps: $('#fps'), hpBar: document.querySelector('.bar.hp'),
      speedo: document.querySelector('.speedo'),
    };
    this.h.stars.innerHTML = '<i>★</i>'.repeat(WANTED.length);
    this.starEls = [...this.h.stars.children];
    this.lastLevel = -1;

    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      this.game.audio.init();
      this.game.audio.click();
      this.action(el.dataset.action);
    });
    for (const seg of document.querySelectorAll('.seg')) {
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || !seg.dataset.setting) return;
        this.game.audio.init();
        const key = seg.dataset.setting;
        let v = b.dataset.v;
        if (v === 'true') v = true; else if (v === 'false') v = false;
        this.game.setSetting(key, v);
        this.refreshSettings();
      });
    }
    if ('ontouchstart' in window || matchMedia('(pointer: coarse)').matches) document.body.classList.add('is-touch');
  }

  show(...names) {
    for (const s of this.screens) document.getElementById(s).classList.toggle('show', names.includes(s));
    this.current = names;
    this.focusIndex = 0;
    this.refreshFocus();
  }

  // ---------------------------------------------------------------- controller menu navigation
  focusables() {
    const top = [...this.current].reverse().find((n) => n !== 'hud' && n !== 'loading');
    if (!top) return [];
    const root = document.getElementById(top);
    return [...root.querySelectorAll('.btn, .map-card, .mode-card, .seq:not(.locked), .mission:not(.locked), .seg button, .paints button')]
      .filter((el) => el.offsetParent !== null && !el.classList.contains('disabled') && !el.classList.contains('pause-btn'));
  }

  refreshFocus() {
    document.querySelectorAll('.focus').forEach((el) => el.classList.remove('focus'));
    if (!this.game.joy?.active) return;
    const items = this.focusables();
    if (!items.length) return;
    this.focusIndex = (this.focusIndex + items.length) % items.length;
    items[this.focusIndex].classList.add('focus');
  }

  navInput(e) {
    const items = this.focusables();
    if (!items.length) return;
    const cur = items[this.focusIndex % items.length];
    const inGarage = this.current.includes('garage');
    if (e === 'up') this.focusIndex--;
    else if (e === 'down') this.focusIndex++;
    else if (e === 'left' || e === 'right') {
      if (inGarage && !cur.closest('.paints')) { this.action(e === 'left' ? 'prev-car' : 'next-car'); this.game.audio.click(); return this.refreshFocus(); }
      this.focusIndex += e === 'left' ? -1 : 1;
    } else if (e === 'R') {
      this.game.audio.click();
      cur.click();
      // clicking may rebuild the screen; keep focus on the same slot when possible
      requestAnimationFrame(() => this.refreshFocus());
      return;
    } else if (e === 'L') {
      const back = document.querySelector('#controls.show [data-action="controls-back"]') || document.querySelector('#brief.show [data-action="brief-back"]') || document.querySelector('#story.show [data-action="modes"]') || document.querySelector('.screen.show [data-action="back"], .screen.show [data-action="resume"]');
      if (back) { this.game.audio.click(); back.click(); }
      return;
    }
    this.game.audio.click();
    this.refreshFocus();
  }

  joyStatus(text, ok) {
    const b = $('#joy-badge');
    if (b) {
      b.classList.toggle('on', !!(ok && this.game.joy.center));
      b.textContent = this.game.joy.active || (ok && this.game.joy.center) ? '🎮 CONTROLLER READY' : ok ? '🎮 CALIBRATING…' : '🎮 NO CONTROLLER';
    }
    const st = $('#joy-status');
    if (st) st.textContent = text;
    if (ok && this.game.joy.center && this.game.state === 'playing') this.toast('CONTROLLER CONNECTED', 'good');
    else if (!ok && this.game.state === 'playing') this.toast('CONTROLLER DISCONNECTED', 'bad');
    this.refreshFocus();
  }

  setLoading(text) { $('.load-text').textContent = text; }

  action(a) {
    const g = this.game;
    switch (a) {
      case 'play': this.openModes(); break;
      case 'modes': this.openModes(); break;
      case 'endless': g.startRun({ intro: g.save.settings.intro !== false }); break;
      case 'story': if (g.state !== 'menu') g.toMenu(); this.openStory(); break;
      case 'trophies': this.openTrophies(); break;
      case 'next-mission': { const n = this.nextMission; if (n) g.startMission(n.id); break; }
      case 'story-continue': { const n = nextStoryMission(g.save); if (n) this.openBrief(n); break; }
      case 'brief-start': if (this.briefDef) { g.audio.init(); g.startMission(this.briefDef.id, 0); } break;
      case 'brief-checkpoint': { const cp = g.save.story?.checkpoint; if (this.briefDef && cp?.id === this.briefDef.id) { g.audio.init(); g.startMission(cp.id, cp.step); } break; }
      case 'brief-back': this.openStory(this.storySeq); break;
      case 'sr-next': if (this.nextMission) { g.toMenu(); this.openBrief(this.nextMission); } break;
      case 'sr-retry': if (this.srDef) g.startMission(this.srDef.id, this.srStep || 0); break;
      case 'sr-restart': if (this.srDef) g.startMission(this.srDef.id, 0); break;
      case 'sr-story': g.toMenu(); this.openStory(this.srDef?.seq); break;
      case 'garage': this.openGarage(); break;
      case 'garage-from-over': g.toMenu(); this.openGarage(); break;
      case 'maps': this.openMaps(); break;
      case 'settings': this.refreshSettings(); this.show('settings'); break;
      case 'back': g.showroomCar(g.save.selected); this.showMenu(); break;
      case 'prev-car': { const n = this.garageList().length; this.garageIndex = (this.garageIndex + n - 1) % n; this.renderGarage(); break; }
      case 'next-car': this.garageIndex = (this.garageIndex + 1) % this.garageList().length; this.renderGarage(); break;
      case 'controls': this.openControls(); break;
      case 'controls-back': this.closeControls(); break;
      case 'pause': g.pause(); break;
      case 'resume': g.resume(); break;
      case 'restart': if (g.lastMission) g.startMission(g.lastMission.id); else g.startRun(); break;
      case 'quit': g.toMenu(); break;
      case 'joy-connect': g.joy.requestConnect(); break;
    }
  }

  openModes() {
    const pr = progress(this.game.save);
    $('#story-progress').textContent = `${pr.pct}% OF THE STORY · ${pr.total}/${TOTAL_MISSIONS} MISSIONS · RANK ${rankOf(this.game.save.story?.xp || 0)}`;
    this.show('modes');
  }

  // ---------------------------------------------------------------- story menu
  openStory(seqN = null) {
    const g = this.game, sv = g.save;
    const st = sv.story || {};
    const next = nextStoryMission(sv);
    this.storySeq = seqN || this.storySeq || next?.seq || 1;
    this.storyTab ||= 'story';
    const pr = progress(sv);
    const xp = st.xp || 0, rank = rankOf(xp);
    const into = xp - xpForRank(rank), need = xpForRank(rank + 1) - xpForRank(rank);
    $('#story-rank').innerHTML = `RANK <b>${rank}</b> · ${rank >= 50 ? 'MAX' : `${into}/${need} XP`}`;
    $('#story-bar').style.width = `${pr.pct}%`;
    $('#story-pct').textContent = `${pr.pct}% STORY · ${pr.story}/${STORY.length} MISSIONS · ${pr.contracts} CONTRACTS`;
    const cont = $('#story-continue');
    const cp = st.checkpoint && getMission(st.checkpoint.id);
    cont.textContent = next ? `CONTINUE: ${next.title}` : 'STORY COMPLETE';
    cont.classList.toggle('disabled', !next);
    void cp;
    // sequences
    $('#seq-list').innerHTML = SEQUENCES.map((q) => {
      const open = sequenceUnlocked(sv, q);
      const n = q.missions.filter((m) => st.done?.[m.id]).length;
      return `<div class="seq ${open ? '' : 'locked'} ${q.n === this.storySeq ? 'sel' : ''}" data-seq="${q.n}">
        <span class="seq-n">${open ? q.n : '🔒'}</span><div><b>${q.title}</b><small>${open ? `${n}/${q.missions.length}` : 'LOCKED'}</small></div>
        <i style="width:${(n / q.missions.length) * 100}%"></i></div>`;
    }).join('');
    $('#seq-list').onclick = (e) => {
      const el = e.target.closest('[data-seq]');
      if (!el || el.classList.contains('locked')) return;
      g.audio.click();
      this.openStory(+el.dataset.seq);
    };
    const tabs = $('#story-tabs');
    for (const b of tabs.querySelectorAll('[data-tab]')) b.classList.toggle('sel', b.dataset.tab === this.storyTab);
    tabs.onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) { g.audio.click(); this.storyTab = b.dataset.tab; this.openStory(this.storySeq); } };
    this.renderSequence();
    if (!this.current.includes('story')) this.show('story');
  }

  renderSequence() {
    const g = this.game, sv = g.save, st = sv.story || {};
    const q = SEQUENCES[this.storySeq - 1];
    const map = MAPS.find((m) => m.id === q.map);
    $('#seq-head').innerHTML = `<small>SEQUENCE ${q.n} · ${map ? map.name : q.map}</small><h3>${q.title}</h3><em>${q.tagline}</em><p>${q.desc}</p>`;
    const open = sequenceUnlocked(sv, q);
    let list;
    if (this.storyTab === 'contracts') {
      const rank = rankOf(st.xp || 0);
      list = contractsFor(q.n, rank).map((m) => {
        const d = st.done?.[m.id];
        return `<div class="mission ${open ? '' : 'locked'} ${d ? 'done' : ''}" data-mission="${m.id}">
          <div class="num">${d ? '✓' : m.n}</div>
          <div><h4>${m.title}</h4><p>${open ? m.brief : 'Reach this sequence in the story to unlock its contracts.'}</p></div>
          <div class="meta"><b>${m.type}</b>TIER ${m.tier + 1} · ${m.steps.length} STEPS<br><span class="coin-ico"></span> ${m.reward.toLocaleString()} · ${m.xp} XP</div></div>`;
      });
    } else {
      list = q.missions.map((m) => {
        const d = st.done?.[m.id], ok = !!d || storyUnlocked(sv, m);
        const cp = st.checkpoint?.id === m.id ? ` · CHECKPOINT ${st.checkpoint.step + 1}` : '';
        return `<div class="mission ${ok ? '' : 'locked'} ${d ? 'done' : ''}" data-mission="${m.id}">
          <div class="num">${d ? '✓' : ok ? m.n : '🔒'}</div>
          <div><h4>${m.title}</h4><p>${ok ? m.brief : 'Complete the previous mission to unlock.'}</p></div>
          <div class="meta"><b>${d ? 'DONE' : ok ? 'PLAY' : ''}</b>${m.steps.length} STEPS${cp}<br><span class="coin-ico"></span> ${m.reward.toLocaleString()} · ${m.xp} XP</div></div>`;
      });
    }
    $('#mission-list').innerHTML = list.join('');
    $('#mission-list').onclick = (e) => {
      const el = e.target.closest('[data-mission]');
      if (!el || el.classList.contains('locked')) return;
      g.audio.init(); g.audio.click();
      this.openBrief(getMission(el.dataset.mission));
    };
  }

  // ---------------------------------------------------------------- briefing
  openBrief(def) {
    if (!def) return;
    const g = this.game, st = g.save.story || {};
    this.briefDef = def;
    this.storySeq = def.seq;
    const map = MAPS.find((m) => m.id === def.map);
    $('#brief-seq').textContent = def.kind === 'story' ? `SEQUENCE ${def.seq} · ${def.seqTitle} · MISSION ${def.n}` : `CONTRACT · ${def.type} · SEQUENCE ${def.seq}`;
    $('#brief-title').textContent = def.title;
    const diff = Math.round(def.diff * 10) + 1;
    $('#brief-meta').innerHTML = `${map ? map.name : def.map} · DIFFICULTY <b>${'▮'.repeat(Math.min(10, diff))}${'▯'.repeat(Math.max(0, 10 - diff))}</b> · <span class="coin-ico"></span> ${def.reward.toLocaleString()} · ${def.xp} XP${def.unlock ? ' · UNLOCKS A VEHICLE' : ''}`;
    $('#brief-text').textContent = def.brief;
    const labels = def.steps.map((s) => s.label).filter(Boolean);
    $('#brief-obj').innerHTML = `<b>${def.steps.length} OBJECTIVES</b> — every objective is a checkpoint` + (labels.length ? `<ol>${labels.slice(0, 3).map((l) => `<li>${l}</li>`).join('')}${labels.length > 3 ? '<li>…</li>' : ''}</ol>` : '');
    $('#brief-cp').style.display = st.checkpoint?.id === def.id && st.checkpoint.step > 0 ? '' : 'none';
    this.show('brief');
  }

  // ---------------------------------------------------------------- results
  showStoryWin(r) {
    const d = r.def;
    this.srDef = d; this.srStep = 0;
    this.nextMission = r.next;
    $('#sr-seq').textContent = d.kind === 'story' ? `SEQUENCE ${d.seq} · MISSION ${d.n}` : `CONTRACT · ${d.type}`;
    const t = $('#sr-title');
    t.textContent = d.final ? 'THE END' : d.kind === 'story' && d.n === 10 ? 'SEQUENCE COMPLETE' : 'MISSION COMPLETE';
    t.className = 'win-title';
    $('#sr-name').textContent = d.title;
    $('#sr-reason').textContent = d.final ? 'The Consortium has fallen. Thank you for playing The Long Road.' : '';
    $('#sr-stats').innerHTML = `<span>Time</span><b>${formatTime(r.time)}</b><span>Reward</span><b><span class="coin-ico"></span> ${r.reward.toLocaleString()}${r.first ? '' : ' (replay)'}</b>
      <span>Experience</span><b>+${r.xp} XP</b><span>Rank</span><b>${r.rank1 > r.rank0 ? `${r.rank0} → ${r.rank1} RANK UP!` : r.rank1}</b>`;
    $('#sr-unlock').textContent = r.unlocked ? `NEW VEHICLE UNLOCKED: ${r.unlocked}` : r.next && d.kind === 'story' ? `NEXT: ${r.next.title}` : '';
    $('#sr-unlock').classList.toggle('show', !!$('#sr-unlock').textContent);
    $('#sr-btns').innerHTML = (r.next ? '<button class="btn big primary" data-action="sr-next">NEXT MISSION</button>' : '')
      + '<button class="btn" data-action="sr-restart">REPLAY</button><button class="btn" data-action="sr-story">STORY MENU</button>';
    this.show('sresult');
  }

  showStoryFail(r) {
    const d = r.def;
    this.srDef = d; this.srStep = r.step || 0;
    $('#sr-seq').textContent = d.kind === 'story' ? `SEQUENCE ${d.seq} · MISSION ${d.n}` : `CONTRACT · ${d.type}`;
    const t = $('#sr-title');
    t.textContent = 'MISSION FAILED';
    t.className = 'fail-title';
    $('#sr-name').textContent = d.title;
    $('#sr-reason').textContent = r.reason;
    $('#sr-stats').innerHTML = `<span>Checkpoint</span><b>${(r.step || 0) + 1} / ${d.steps.length}</b><span>Objective</span><b>${d.steps[r.step || 0]?.label || '—'}</b>`;
    $('#sr-unlock').textContent = '';
    $('#sr-unlock').classList.remove('show');
    $('#sr-btns').innerHTML = `<button class="btn big primary" data-action="sr-retry">RETRY FROM CHECKPOINT</button><button class="btn" data-action="sr-restart">RESTART MISSION</button><button class="btn" data-action="sr-story">STORY MENU</button>`;
    this.show('sresult');
  }

  // Mission title card at the start (or checkpoint) of a mission.
  storyTitle(def, step) {
    $('#h-title-seq').textContent = def.kind === 'story' ? `SEQUENCE ${def.seq} · ${def.seqTitle}` : `CONTRACT · ${def.type}`;
    $('#h-title-name').textContent = step > 0 ? `${def.title} · CHECKPOINT ${step + 1}` : def.title;
    const el = $('#h-title');
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.titleT);
    this.titleT = setTimeout(() => el.classList.remove('show'), 4200);
  }

  openTrophies() {
    const got = this.game.save.trophies || {};
    $('#trophy-grid').innerHTML = TROPHIES.map((t) => `<div class="trophy ${got[t.id] ? 'got' : ''}"><div class="ico">🏆</div><div><b>${t.name}</b><span>${t.desc}</span></div></div>`).join('');
    $('#trophy-count').textContent = `${Object.keys(got).length}/${TROPHIES.length}`;
    this.show('trophies');
  }

  showMissionWin(r) {
    $('#win-name').textContent = r.def.name;
    $('#win-stars').innerHTML = [1, 2, 3].map((i) => `<i class="${i <= r.stars ? 'on' : ''}">★</i>`).join('');
    $('#win-stats').innerHTML = `<span>Time</span><b>${formatTime(r.time)}</b><span>Par</span><b>${formatTime(r.def.par)}</b><span>Score</span><b>${Math.floor(this.game.score).toLocaleString()}</b>`;
    $('#win-coins').textContent = r.reward.toLocaleString();
    const u = $('#win-unlock');
    u.textContent = r.unlocked ? `NEW CAR UNLOCKED: ${r.unlocked}` : r.next ? `UNLOCKED: ${r.next.name}` : 'STORY COMPLETE!';
    this.nextMission = r.next;
    $('#win-next').style.display = r.next ? '' : 'none';
    this.show('win');
  }

  // objective panel + off-screen arrow toward the mission marker
  updateMissionHUD() {
    const g = this.game, m = g.mission;
    const panel = this._obj || (this._obj = $('#h-obj'));
    const arrow = this._arr || (this._arr = $('#h-arrow'));
    // dialogue subtitles
    const sub = this._sub || (this._sub = $('#h-sub'));
    const line = m?.subtitle?.();
    if (line) {
      if (this._subKey !== line.text) {
        this._subKey = line.text;
        $('#h-sub-name').textContent = line.name;
        $('#h-sub-name').style.color = line.color;
        $('#h-sub-text').textContent = line.text;
      }
      sub.classList.add('show');
    } else { sub.classList.remove('show'); this._subKey = null; }
    this.h.stars.style.display = m ? 'none' : '';
    if (!m || m.done) { panel.classList.remove('show'); arrow.classList.remove('show'); return; }
    const st = m.status();
    panel.classList.add('show');
    $('#h-obj-step').textContent = `OBJECTIVE ${st.step}`;
    $('#h-obj-clock').textContent = st.clock;
    $('#h-obj-label').textContent = st.label;
    $('#h-obj-prog').textContent = st.prog;
    const th = this._th || (this._th = $('#h-obj-threat'));
    const thText = st.threat ? `POLICE: ${st.threat}` : '';
    if (th.textContent !== thText) th.textContent = thText;
    const t = m.target();
    if (!t) { arrow.classList.remove('show'); return; }
    const v = (this._v2 ||= new THREE_VEC()).set(t.x, 2, t.z).project(g.camera);
    const on = v.z < 1 && Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.85;
    if (on) { arrow.classList.remove('show'); return; }
    let ax = v.x, ay = v.y;
    if (v.z >= 1) { ax = -ax; ay = -ay; }
    const k = 0.86 / Math.max(Math.abs(ax), Math.abs(ay), 0.001);
    ax *= k; ay *= k;
    arrow.style.left = `${(ax * 0.5 + 0.5) * innerWidth}px`;
    arrow.style.top = `${(-ay * 0.5 + 0.5) * innerHeight}px`;
    arrow.style.transform = `rotate(${Math.atan2(-ay, ax)}rad)`;
    arrow.classList.add('show');
  }

  showMenu() {
    const g = this.game, s = g.save;
    const map = MAPS.find((m) => m.id === s.map);
    $('#menu-map').textContent = map.name;
    const best = s.best[s.map];
    $('#menu-best').textContent = best ? `${best.score.toLocaleString()} pts · ${formatTime(best.time)}` : '—';
    this.updateWallet();
    this.show('menu');
  }

  updateWallet() {
    const c = this.game.save.coins.toLocaleString();
    $('#wallet').textContent = c;
    for (const el of document.querySelectorAll('.wallet-val')) el.textContent = c;
  }

  // ---------------------------------------------------------------- garage
  // ---------------------------------------------------------------- controls reference
  openControls() {
    const paused = this.game.state === 'paused';
    this.show(...(paused ? ['hud', 'controls'] : ['controls']));
  }

  closeControls() {
    if (this.game.state === 'paused') this.show('hud', 'pause'); else this.showMenu();
  }

  // Garage tabs: CARS / WAR VEHICLES / BOATS
  garageList(tab = this.garageTab) {
    return tab === 'boats' ? BOATS : CARS.filter((c) => !!c.war === (tab === 'war'));
  }

  openGarage() {
    const sel = CARS.find((c) => c.id === this.game.save.selected);
    this.setGarageTab(sel?.war ? 'war' : 'cars');
    this.show('garage');
  }

  setGarageTab(tab) {
    this.garageTab = tab;
    const s = this.game.save;
    const selId = tab === 'boats' ? (s.selectedBoat || 'speedboat') : s.selected;
    this.garageIndex = Math.max(0, this.garageList().findIndex((c) => c.id === selId));
    const tabs = $('#garage-tabs');
    for (const b of tabs.querySelectorAll('[data-tab]')) b.classList.toggle('sel', b.dataset.tab === tab);
    tabs.onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) { this.game.audio.click(); this.setGarageTab(b.dataset.tab); } };
    this.renderGarage();
  }

  renderGarage() {
    const g = this.game, s = g.save;
    const car = this.garageList()[this.garageIndex] || this.garageList()[0];
    const isBoat = !!car.boat;
    const owned = car.price === 0 || s.owned.includes(car.id);
    const selected = isBoat ? (s.selectedBoat || 'speedboat') === car.id : s.selected === car.id;
    $('#car-name').textContent = car.name;
    $('#car-tag').textContent = car.tagline;
    const st = isBoat ? BOAT_STATS[car.kind] : car.stats;
    const rows = [
      ['SPEED', st.speed / 66, Math.round(st.speed * 3.6)],
      ['ACCEL', st.accel / 43, st.accel],
      ['HANDLING', (st.handling - (isBoat ? 1 : 2)) / 1.7, st.handling.toFixed(1)],
      ['ARMOR', st.hp / (car.war || isBoat ? 1200 : 250), st.hp],
    ];
    const w = car.weapons || [];
    $('#car-weapons').innerHTML = w.length ? 'WEAPONS: ' + w.map((id) => `<b>${VEHICLE_WEAPONS[id].name}</b>`).join('') : (isBoat || car.war ? 'UNARMED' : '');
    $('#car-stats').innerHTML = rows.map(([n, v, t]) => `<div class="stat"><span>${n}</span><div class="track"><i style="width:${Math.round(Math.min(1, Math.max(0.06, v)) * 100)}%"></i></div><b>${t}</b></div>`).join('');
    const color = s.colors[car.id] || car.color;
    const paints = $('#paints');
    paints.innerHTML = PAINTS.map((p) => `<button style="background:${p}" data-paint="${p}" class="${p === color ? 'sel' : ''}"></button>`).join('');
    paints.onclick = (e) => {
      const b = e.target.closest('[data-paint]');
      if (!b) return;
      s.colors[car.id] = b.dataset.paint;
      g.persist();
      g.showroomCar(car.id);
      this.renderGarage();
    };
    const paintable = !isBoat && car.model !== 'tank';
    paints.style.display = paintable ? '' : 'none';
    paints.style.opacity = owned ? 1 : 0.4;
    paints.style.pointerEvents = owned ? 'auto' : 'none';
    const btn = $('#car-action');
    btn.classList.remove('disabled');
    const pick = () => { if (isBoat) s.selectedBoat = car.id; else s.selected = car.id; };
    if (selected) { btn.textContent = isBoat ? '✓ YOUR BOAT' : '✓ SELECTED'; btn.onclick = null; } else if (owned) {
      btn.textContent = 'SELECT';
      btn.onclick = () => { pick(); g.persist(); this.renderGarage(); };
    } else {
      const can = s.coins >= car.price;
      btn.innerHTML = `BUY · <span class="coin-ico"></span> ${car.price.toLocaleString()}`;
      if (!can) btn.classList.add('disabled');
      btn.onclick = () => {
        if (s.coins < car.price) return;
        s.coins -= car.price;
        s.owned.push(car.id);
        pick();
        g.persist();
        g.audio.powerup();
        this.updateWallet();
        this.renderGarage();
      };
    }
    this.updateWallet();
    g.showroomCar(car.id);
  }

  // ---------------------------------------------------------------- maps
  openMaps() {
    const g = this.game, s = g.save;
    $('#map-grid').innerHTML = MAPS.map((m) => {
      const b = s.best[m.id];
      return `<div class="map-card map-${m.id} ${s.map === m.id ? 'sel' : ''}" data-map="${m.id}">
        <h3>${m.name}</h3><p>${m.desc}</p><small>${b ? 'BEST ' + b.score.toLocaleString() : 'NOT PLAYED'}</small></div>`;
    }).join('');
    $('#map-grid').onclick = (e) => {
      const c = e.target.closest('[data-map]');
      if (!c) return;
      g.audio.click();
      g.selectMap(c.dataset.map);
    };
    this.show('maps');
  }

  // ---------------------------------------------------------------- settings
  refreshSettings() {
    const st = this.game.save.settings;
    for (const seg of document.querySelectorAll('.seg')) {
      const v = String(st[seg.dataset.setting]);
      for (const b of seg.children) b.classList.toggle('sel', b.dataset.v === v);
    }
    const t = this.game.save.totals;
    $('#lifetime').innerHTML = `Runs: <b>${t.runs}</b> · Cops wrecked: <b>${t.copsWrecked}</b> · Coins earned: <b>${t.coins.toLocaleString()}</b> · Time on the run: <b>${formatTime(t.time)}</b>`;
  }

  // ---------------------------------------------------------------- HUD
  toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    this.h.toasts.appendChild(el);
    while (this.h.toasts.children.length > 3) this.h.toasts.firstChild.remove();
    setTimeout(() => el.remove(), 2700);
  }

  combo(text) {
    this.h.combo.textContent = text;
    this.h.combo.classList.add('show');
    this.comboTimer = 1.4;
  }

  flash(kind = 'white') {
    const f = $('#flash');
    f.className = kind === 'hit' ? 'hit' : '';
    f.style.transition = 'none';
    f.style.opacity = kind === 'hit' ? 1 : 0.8;
    requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; });
  }

  updateHUD(dt) {
    const g = this.game, p = g.player, h = this.h;
    h.time.textContent = formatTime(g.runTime);
    h.score.textContent = Math.floor(g.score).toLocaleString();
    h.coins.textContent = (g.runCoins * COIN_VALUE).toLocaleString();
    const hp = Math.max(0, p.hp / p.maxHp);
    h.hp.style.width = `${hp * 100}%`;
    h.hp.style.backgroundPosition = `${-(1 - hp) * 0}px 0`;
    h.hpBar.classList.toggle('low', hp < 0.3);
    h.nitro.style.width = `${g.nitro * 100}%`;
    h.speed.textContent = Math.round(p.speed * 3.6);
    h.speedo.classList.toggle('nitro', p.nitroActive);
    const lvl = g.wantedLevel;
    this.starEls.forEach((s, i) => s.classList.toggle('on', i <= lvl));
    h.stars.classList.toggle('flash', g.copsNear > 0);
    if (g.bustTimer > 0.05) {
      h.bust.classList.add('show');
      h.bustBar.style.width = `${Math.min(1, g.bustTimer / g.bustLimit) * 100}%`;
    } else h.bust.classList.remove('show');
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) h.combo.classList.remove('show');
    }
    const act = Object.entries(g.powerTimers).filter(([k, t]) => t > 0 && (POWERUPS[k] || k === 'spikes'));
    const key = act.map(([k, t]) => k + Math.ceil(t)).join();
    if (key !== this.powKey) {
      this.powKey = key;
      h.powers.innerHTML = act.map(([k, t]) => {
        const d = POWERUPS[k] || { color: '#ff6b6b', label: 'FLAT TIRES' };
        return `<div class="power" style="border-color:${d.color};color:${d.color}">${d.label} ${Math.ceil(t)}s</div>`;
      }).join('');
    }
  }

  // on-foot / combat HUD: labels, weapon, target reticle, context hints
  updateCombatHUD() {
    const g = this.game, c = g.combat, foot = !g.car;
    const el = (id) => this._c?.[id] || ((this._c ||= {})[id] = document.getElementById(id));
    el('h-hp-label').textContent = foot ? 'HEALTH' : 'HULL';
    el('h-nitro-label').textContent = foot ? 'STAMINA' : 'NITRO';
    let w = '';
    if (foot) {
      const a = c.ammo[c.weapon];
      w = `${WEAPON_NAMES[c.weapon]} <b>${a === Infinity ? '∞' : a}</b><small>${c.ammo.smg > 0 || c.ammo.rpg > 0 ? 'Q: SWITCH' : 'CLICK / J / RIGHT STICK: SHOOT'}</small>`;
    } else {
      const v = g.car;
      if (v.weapons) w += `${VEHICLE_WEAPONS[v.weapons[v.wIdx || 0]].name} <b>∞</b><small>CLICK / J: FIRE${v.weapons.length > 1 ? ' · Q: SWITCH' : ''}</small><br>`;
      if (c.carGuns > 0) w += `MACHINE GUNS <b>${Math.ceil(c.carGuns)}s</b><br>`;
      if (c.carRockets > 0) w += `ROCKETS <b>${c.carRockets}</b>`;
    }
    if (w !== this._w) { el('h-weapon').innerHTML = w; this._w = w; }
    // reticle over the current target
    const r = el('reticle');
    const t = c.target;
    if (t && (foot || c.carGuns > 0 || c.carRockets > 0 || g.car?.weapons) && (t.kind === 'heli' ? !t.ref.falling : t.ref.alive !== false && !t.ref.dead)) {
      const v = (this._v ||= new THREE_VEC()).set(t.ref.x, t.kind === 'heli' ? t.ref.y : (t.kind === 'cop' ? t.ref.y + 1 : 1), t.ref.z).project(g.camera);
      if (v.z < 1) {
        r.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`; r.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
        r.classList.add('show');
      } else r.classList.remove('show');
    } else r.classList.remove('show');
    // hints
    let hint = '';
    if (foot && g.avatar.state === 'foot') {
      for (const v of g.vehicles) {
        if (v.alive && !v.destroyed && v.speed < 4 && (!g.avatar.swimming || v.boat) && Math.hypot(v.x - g.avatar.x, v.z - g.avatar.z) - v.L / 2 < (v.boat ? 3.6 : 2.4)) { hint = v.boat ? 'F / RIGHT-STICK CLICK: TAKE THE BOAT' : 'F / RIGHT-STICK CLICK: GET IN'; break; }
      }
      if (g.avatar.swimming && !hint) hint = 'SWIMMING: HEAD FOR THE BANK';
    }
    if (hint !== this._hint) { el('h-hint').textContent = hint; el('h-hint').classList.toggle('show', !!hint); this._hint = hint; }
  }

  setFps(v) { this.h.fps.textContent = v; }

  showGameOver(r) {
    const t = $('#go-title');
    t.textContent = r.mission ? 'MISSION FAILED' : r.reason === 'wrecked' ? 'WRECKED' : r.reason === 'down' ? 'WASTED' : r.reason === 'timeout' ? "TIME'S UP" : 'BUSTED';
    t.className = r.reason === 'busted' ? '' : 'wrecked';
    $('#go-sub').textContent = (r.mission ? r.mission.name + ': ' : '') + (r.reason === 'wrecked' ? 'Your ride is scrap metal.' : r.reason === 'down' ? 'Taken down on foot.' : r.reason === 'timeout' ? 'You ran out of time.' : 'The cops boxed you in.');
    $('#go-stats').innerHTML = `
      <span>Survived</span><b>${formatTime(r.time)}</b>
      <span>Score</span><b>${Math.floor(r.score).toLocaleString()}</b>
      <span>Max wanted level</span><b>${'★'.repeat(r.maxLevel + 1)}</b>
      <span>Cops wrecked</span><b>${r.wrecks}</b>
      <span>Near misses</span><b>${r.nearMisses}</b>
      <span>Best drift</span><b>${Math.floor(r.bestDrift).toLocaleString()}</b>`;
    $('#go-coins').textContent = r.earned.toLocaleString();
    $('#go-best').classList.toggle('show', r.newBest);
    this.show('gameover');
  }
}
