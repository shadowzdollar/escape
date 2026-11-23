// CrazyGames HTML5 SDK v3 integration: initialization, lifecycle events,
// midgame & rewarded ads, platform mute listener, and cloud data storage.

const MIDGAME_COOLDOWN_MS = 90_000; // minimum 90s between midgame ads
const HAPPYTIME_COOLDOWN_MS = 3_000;

export class CrazyGamesSDK {
  constructor(game) {
    this.game = game;
    this.ready = false;
    this.initPromise = null;
    this.isLoading = false;
    this.isGameplay = false;
    this.adActive = false;
    this.lastAdTime = performance.now() - MIDGAME_COOLDOWN_MS * 0.5;
    this.lastHappyTime = 0;
  }

  get sdk() {
    return typeof window !== 'undefined' ? window.CrazyGames?.SDK : null;
  }

  async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      const sdk = this.sdk;
      if (!sdk || typeof sdk.init !== 'function') return false;
      try {
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 4000));
        const res = await Promise.race([sdk.init(), timeoutPromise]);
        if (res === 'timeout') {
          console.warn('CrazyGames SDK init timed out; proceeding in offline mode');
          return false;
        }
        this.ready = true;
        // Apply initial platform settings (e.g. CrazyGames mute toggle)
        const settings = sdk.game?.settings;
        if (settings && typeof settings.muteAudio === 'boolean') {
          this.game.setPlatformMute(settings.muteAudio);
        }
        sdk.game?.addSettingsChangeListener?.((newSettings) => {
          if (newSettings && typeof newSettings.muteAudio === 'boolean') {
            this.game.setPlatformMute(newSettings.muteAudio);
          }
        });
        // Merge any cloud save stored in CrazyGames Data module
        this.game.syncCloudSave?.();
        return true;
      } catch (err) {
        console.warn('CrazyGames SDK init skipped or unavailable:', err);
        this.ready = false;
        return false;
      }
    })();
    return this.initPromise;
  }

  // ------------------------------------------------------------------ lifecycle
  loadingStart() {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      if (this.ready) this.sdk?.game?.loadingStart?.();
    } catch { /* ignore */ }
  }

  loadingStop() {
    if (!this.isLoading) return;
    this.isLoading = false;
    try {
      if (this.ready) this.sdk?.game?.loadingStop?.();
    } catch { /* ignore */ }
  }

  gameplayStart() {
    if (this.isGameplay || this.adActive) return;
    this.isGameplay = true;
    try {
      if (this.ready) this.sdk?.game?.gameplayStart?.();
    } catch { /* ignore */ }
  }

  gameplayStop() {
    if (!this.isGameplay) return;
    this.isGameplay = false;
    try {
      if (this.ready) this.sdk?.game?.gameplayStop?.();
    } catch { /* ignore */ }
  }

  happytime() {
    const now = performance.now();
    if (now - this.lastHappyTime < HAPPYTIME_COOLDOWN_MS) return;
    this.lastHappyTime = now;
    try {
      if (this.ready) this.sdk?.game?.happytime?.();
    } catch { /* ignore */ }
  }

  // ------------------------------------------------------------------ ads
  requestMidgameAd(onDone) {
    const done = () => { try { onDone?.(); } catch { /* ignore */ } };
    const now = performance.now();
    if (!this.ready || this.adActive || !this.sdk?.ad || now - this.lastAdTime < MIDGAME_COOLDOWN_MS) {
      done();
      return;
    }
    const wasGameplay = this.isGameplay;
    if (wasGameplay) this.gameplayStop();
    this.adActive = true;
    this.game.setAdActive(true);
    let finished = false;
    const safetyTimer = setTimeout(() => finish(), 45000);
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(safetyTimer);
      this.adActive = false;
      this.lastAdTime = performance.now();
      this.game.setAdActive(false);
      done();
    };
    try {
      this.sdk.ad.requestAd('midgame', {
        adStarted: () => {
          this.game.setAdActive(true);
        },
        adFinished: () => finish(),
        adError: () => finish(),
      });
    } catch {
      finish();
    }
  }

  requestRewardedAd(onReward, onError) {
    if (this.adActive) return;
    // When testing locally without CrazyGames SDK host, allow testing or fail gracefully
    if (!this.ready || !this.sdk?.ad) {
      onError?.('Ads unavailable in offline mode');
      return;
    }
    const wasGameplay = this.isGameplay;
    if (wasGameplay) this.gameplayStop();
    this.adActive = true;
    this.game.setAdActive(true);
    let settled = false;
    const safetyTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        restore();
        onError?.('Ad timeout');
      }
    }, 45000);
    const restore = () => {
      clearTimeout(safetyTimer);
      this.adActive = false;
      this.lastAdTime = performance.now();
      this.game.setAdActive(false);
      if (wasGameplay && this.game.state === 'playing') this.gameplayStart();
    };
    try {
      this.sdk.ad.requestAd('rewarded', {
        adStarted: () => {
          this.game.setAdActive(true);
        },
        adFinished: () => {
          if (settled) return;
          settled = true;
          restore();
          onReward?.();
        },
        adError: (err) => {
          if (settled) return;
          settled = true;
          restore();
          onError?.(err);
        },
      });
    } catch (err) {
      if (!settled) {
        settled = true;
        restore();
        onError?.(err);
      }
    }
  }

  // ------------------------------------------------------------------ data
  getItem(key) {
    try {
      if (this.ready && this.sdk?.data) {
        const val = this.sdk.data.getItem(key);
        if (val !== null && val !== undefined) return val;
      }
    } catch { /* fallback to localStorage */ }
    try { return localStorage.getItem(key); } catch { return null; }
  }

  setItem(key, val) {
    try { localStorage.setItem(key, val); } catch { /* ignore */ }
    try {
      if (this.ready && this.sdk?.data) this.sdk.data.setItem(key, val);
    } catch { /* ignore */ }
  }
}
