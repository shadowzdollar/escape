// DOM UI: screens, garage, map select, settings, HUD and notifications.
import { CARS, MAPS, PAINTS, POWERUPS, COIN_VALUE, WANTED } from './config.js';
import { MISSIONS, TROPHIES } from './campaign.js';
import { formatTime } from './utils.js';
import { Vector3 as THREE_VEC } from 'three';
const WEAPON_NAMES = { pistol: 'PISTOL', smg: 'SMG', rpg: 'ROCKETS' };

const $ = (s) => document.querySelector(s);

export class UI {
  constructor(game) {
    this.game = game;
    this.screens = ['loading', 'menu', 'modes', 'story', 'trophies', 'garage', 'maps', 'settings', 'hud', 'pause', 'gameover', 'win'];
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
        if (!b) return;
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
    return [...root.querySelectorAll('.btn, .map-card, .mode-card, .mission:not(.locked), .seg button, .paints button')]
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
      const back = document.querySelector('.screen.show [data-action="back"], .screen.show [data-action="resume"]');
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
      case 'garage': this.openGarage(); break;
      case 'garage-from-over': g.toMenu(); this.openGarage(); break;
      case 'maps': this.openMaps(); break;
      case 'settings': this.refreshSettings(); this.show('settings'); break;
      case 'back': g.showroomCar(g.save.selected); this.showMenu(); break;
      case 'prev-car': this.garageIndex = (this.garageIndex + CARS.length - 1) % CARS.length; this.renderGarage(); break;
      case 'next-car': this.garageIndex = (this.garageIndex + 1) % CARS.length; this.renderGarage(); break;
      case 'pause': g.pause(); break;
      case 'resume': g.resume(); break;
      case 'restart': if (g.lastMission) g.startMission(g.lastMission.id); else g.startRun(); break;
      case 'quit': g.toMenu(); break;
      case 'joy-connect': g.joy.requestConnect(); break;
    }
  }

  openModes() {
    const camp = this.game.save.campaign || { unlocked: 1, stars: {} };
    const done = Object.keys(camp.stars).length;
    $('#story-progress').textContent = `${done}/${MISSIONS.length} COMPLETE · ${Object.values(camp.stars).reduce((a, b) => a + b, 0)}/${MISSIONS.length * 3} ★`;
    this.show('modes');
  }

  openStory() {
    const g = this.game, camp = g.save.campaign || { unlocked: 1, stars: {} };
    $('#mission-list').innerHTML = MISSIONS.map((m, i) => {
      const locked = i + 1 > camp.unlocked;
      const st = camp.stars[m.id] || 0;
      const map = MAPS.find((x) => x.id === m.map);
      return `<div class="mission ${locked ? 'locked' : ''}" data-mission="${m.id}">
        <div class="num">${locked ? '🔒' : i + 1}</div>
        <div><h4>${m.name}</h4><p>${locked ? 'Beat the previous mission to unlock.' : m.brief}</p></div>
        <div class="meta"><b>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</b>${map ? map.name : m.map} · <span class="diff">${'●'.repeat(m.difficulty)}</span><br><span class="coin-ico"></span> ${m.reward.toLocaleString()}</div>
      </div>`;
    }).join('');
    $('#mission-list').onclick = (e) => {
      const el = e.target.closest('[data-mission]');
      if (!el || el.classList.contains('locked')) return;
      g.audio.init(); g.audio.click();
      g.startMission(el.dataset.mission);
    };
    this.show('story');
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
    if (!m || m.done) { panel.classList.remove('show'); arrow.classList.remove('show'); return; }
    const st = m.status();
    panel.classList.add('show');
    $('#h-obj-step').textContent = `OBJECTIVE ${st.step}`;
    $('#h-obj-clock').textContent = st.clock;
    $('#h-obj-label').textContent = st.label;
    $('#h-obj-prog').textContent = st.prog;
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
  openGarage() {
    this.garageIndex = Math.max(0, CARS.findIndex((c) => c.id === this.game.save.selected));
    this.renderGarage();
    this.show('garage');
  }

  renderGarage() {
    const g = this.game, s = g.save;
    const car = CARS[this.garageIndex];
    const owned = s.owned.includes(car.id);
    $('#car-name').textContent = car.name;
    $('#car-tag').textContent = car.tagline;
    const st = car.stats;
    const rows = [
      ['SPEED', st.speed / 66, Math.round(st.speed * 3.6)],
      ['ACCEL', st.accel / 43, st.accel],
      ['HANDLING', (st.handling - 2) / 1.7, st.handling.toFixed(1)],
      ['ARMOR', st.hp / 250, st.hp],
    ];
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
    paints.style.opacity = owned ? 1 : 0.4;
    paints.style.pointerEvents = owned ? 'auto' : 'none';
    const btn = $('#car-action');
    btn.classList.remove('disabled');
    if (s.selected === car.id) { btn.textContent = '✓ SELECTED'; btn.onclick = null; } else if (owned) {
      btn.textContent = 'SELECT';
      btn.onclick = () => { s.selected = car.id; g.persist(); this.renderGarage(); };
    } else {
      const can = s.coins >= car.price;
      btn.innerHTML = `BUY · <span class="coin-ico"></span> ${car.price.toLocaleString()}`;
      if (!can) btn.classList.add('disabled');
      btn.onclick = () => {
        if (s.coins < car.price) return;
        s.coins -= car.price;
        s.owned.push(car.id);
        s.selected = car.id;
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
      if (c.carGuns > 0) w += `MACHINE GUNS <b>${Math.ceil(c.carGuns)}s</b><br>`;
      if (c.carRockets > 0) w += `ROCKETS <b>${c.carRockets}</b>`;
    }
    if (w !== this._w) { el('h-weapon').innerHTML = w; this._w = w; }
    // reticle over the current target
    const r = el('reticle');
    const t = c.target;
    if (t && (foot || c.carGuns > 0 || c.carRockets > 0) && (t.kind === 'heli' ? !t.ref.falling : t.ref.alive !== false && !t.ref.dead)) {
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
