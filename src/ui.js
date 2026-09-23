// DOM UI: screens, garage, map select, settings, HUD and notifications.
import { CARS, MAPS, PAINTS, POWERUPS, COIN_VALUE } from './config.js';
import { formatTime } from './utils.js';

const $ = (s) => document.querySelector(s);

export class UI {
  constructor(game) {
    this.game = game;
    this.screens = ['loading', 'menu', 'garage', 'maps', 'settings', 'hud', 'pause', 'gameover'];
    this.garageIndex = 0;
    this.comboTimer = 0;
    this.h = {
      time: $('#h-time'), score: $('#h-score'), coins: $('#h-coins'), stars: $('#h-stars'), hp: $('#h-hp'),
      nitro: $('#h-nitro'), speed: $('#h-speed'), bust: $('#h-bust'), bustBar: $('#h-bust-bar'), combo: $('#h-combo'),
      powers: $('#h-powers'), toasts: $('#toasts'), fps: $('#fps'), hpBar: document.querySelector('.bar.hp'),
      speedo: document.querySelector('.speedo'),
    };
    this.h.stars.innerHTML = '<i>★</i>'.repeat(5);
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
    return [...root.querySelectorAll('.btn, .map-card, .seg button, .paints button')]
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
      case 'play': g.startRun(); break;
      case 'garage': this.openGarage(); break;
      case 'garage-from-over': g.toMenu(); this.openGarage(); break;
      case 'maps': this.openMaps(); break;
      case 'settings': this.refreshSettings(); this.show('settings'); break;
      case 'back': g.showroomCar(g.save.selected); this.showMenu(); break;
      case 'prev-car': this.garageIndex = (this.garageIndex + CARS.length - 1) % CARS.length; this.renderGarage(); break;
      case 'next-car': this.garageIndex = (this.garageIndex + 1) % CARS.length; this.renderGarage(); break;
      case 'pause': g.pause(); break;
      case 'resume': g.resume(); break;
      case 'restart': g.startRun(); break;
      case 'quit': g.toMenu(); break;
      case 'joy-connect': g.joy.requestConnect(); break;
    }
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
      ['SPEED', st.speed / 62, Math.round(st.speed * 3.6)],
      ['ACCEL', st.accel / 42, st.accel],
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

  setFps(v) { this.h.fps.textContent = v; }

  showGameOver(r) {
    const t = $('#go-title');
    t.textContent = r.reason === 'wrecked' ? 'WRECKED' : 'BUSTED';
    t.className = r.reason === 'wrecked' ? 'wrecked' : '';
    $('#go-sub').textContent = r.reason === 'wrecked' ? 'Your ride is scrap metal.' : 'The cops boxed you in.';
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
