import './service-interface.css';

const SERVICE_TYPES = Object.freeze({
  food: { label: 'Food hatch', icon: 'M5 11h14v2a7 7 0 0 1-14 0v-2Zm-1 9h16M8 7V4m4 3V3m4 4V4' },
  clinic: { label: 'Street clinic', icon: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z' },
  garage: { label: 'Service garage', icon: 'm5 8 2-4h10l2 4 2 3v7H3v-7l2-3Zm0 0h14M6 12h2m8 0h2M6 18v3m12-3v3' },
  recharge: { label: 'Utility terminal', icon: 'm13 2-8 12h6l-1 8 9-13h-6l1-7Z' },
  wayfinding: { label: 'District guide', icon: 'M12 22V2M4 4h13l4 3-4 3H4V4Zm16 9H7l-4 3 4 3h13v-6Z' },
});
const FALLBACK_TYPE = { label: 'City service', icon: 'M4 5h16v14H4V5Zm4 5h8m-8 4h5' };
const RESULT_SECONDS = 5.5;

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, finite(value)));
const text = value => value === null || value === undefined ? '' : String(value);
const distanceText = value => value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.max(0, Math.round(value))} m`;
const secondsText = value => `${Math.max(1, Math.ceil(value))}s`;

/**
 * Passive HUD view. Interaction keys, focus, simulation clocks and outcomes belong
 * to the caller. update() accepts the city-services state plus the actual player
 * position and {remaining, regenMultiplier} for an active neuralBoost.
 */
export function createServiceInterface({ parent = document.getElementById('hud') } = {}) {
  if (!parent?.appendChild) throw new TypeError('Service interface requires a HUD parent element.');
  const document = parent.ownerDocument;
  const create = (tag, className, content, container) => {
    const element = document.createElement(tag);
    element.className = className;
    if (content !== undefined) element.textContent = content;
    if (container) container.appendChild(element);
    return element;
  };
  const write = (element, value) => {
    const next = text(value);
    if (element.textContent !== next) element.textContent = next;
  };
  const root = create('div', 'service-interface', undefined, parent);
  root.hidden = true;
  const card = create('section', 'service-interface__card', undefined, root);
  card.setAttribute('aria-label', 'Nearby city service');
  const meta = create('div', 'service-interface__meta', undefined, card);
  const typeLabel = create('span', 'service-interface__type', undefined, meta);
  const availability = create('span', 'service-interface__availability', undefined, meta);
  const heading = create('div', 'service-interface__heading', undefined, card);
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.classList.add('service-interface__icon');
  const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  icon.appendChild(iconPath);
  heading.appendChild(icon);
  const title = create('h3', 'service-interface__title', undefined, heading);
  const description = create('p', 'service-interface__description', undefined, card);
  const progress = create('div', 'service-interface__progress', undefined, card);
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', '100');
  const progressFill = create('i', 'service-interface__progress-fill', undefined, progress);
  const footer = create('div', 'service-interface__footer', undefined, card);
  const action = create('span', 'service-interface__action', undefined, footer);
  const key = create('kbd', 'service-interface__key', 'E', action);
  key.setAttribute('aria-hidden', 'true');
  const actionLabel = create('span', 'service-interface__action-label', undefined, action);
  const measure = create('span', 'service-interface__measure', undefined, footer);
  const status = create('aside', 'service-interface__status', undefined, root);
  status.setAttribute('aria-label', 'City service status');
  const waypointRow = create('div', 'service-interface__waypoint', undefined, status);
  const waypointIcon = create('span', 'service-interface__waypoint-icon', '◇', waypointRow);
  waypointIcon.setAttribute('aria-hidden', 'true');
  const waypointCopy = create('span', 'service-interface__waypoint-copy', undefined, waypointRow);
  const waypointLabel = create('span', 'service-interface__waypoint-label', undefined, waypointCopy);
  const waypointDistance = create('span', 'service-interface__waypoint-distance', undefined, waypointCopy);
  const boostRow = create('div', 'service-interface__boost', undefined, status);
  create('span', 'service-interface__boost-icon', '+', boostRow).setAttribute('aria-hidden', 'true');
  const boostLabel = create('span', 'service-interface__boost-label', undefined, boostRow);
  const boostTime = create('span', 'service-interface__boost-time', undefined, boostRow);
  const parking = create('div', 'service-interface__parking', undefined, root);
  parking.setAttribute('aria-label', 'Garage parking guidance');
  const parkingSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  parkingSVG.setAttribute('aria-hidden', 'true');
  parkingSVG.setAttribute('preserveAspectRatio', 'none');
  const parkingBrackets = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  parkingBrackets.classList.add('service-interface__parking-brackets');
  parkingBrackets.setAttribute('vector-effect', 'non-scaling-stroke');
  parkingSVG.appendChild(parkingBrackets);
  const parkingLeader = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  parkingLeader.classList.add('service-interface__parking-leader');
  parkingLeader.setAttribute('vector-effect', 'non-scaling-stroke');
  parkingSVG.appendChild(parkingLeader);
  parking.appendChild(parkingSVG);
  const parkingLabel = create('div', 'service-interface__parking-label', undefined, parking);
  const parkingTitle = create('span', 'service-interface__parking-title', undefined, parkingLabel);
  const parkingInstruction = create('span', 'service-interface__parking-instruction', 'Stop here, then exit with E', parkingLabel);
  const parkingDistance = create('span', 'service-interface__parking-distance', undefined, parkingLabel);
  const live = create('span', 'service-interface__sr-only', '', root);
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');

  let disposed = false;
  let lastResultKey = '';
  let resultDeadline = 0;
  let previousActive = null;
  let lastAnnouncement = '';
  let lastIcon = '';
  let lastParkingPlacement = null;
  const emptyState = () => ({ visible: false, cardVisible: false, mode: 'hidden', candidateId: null, activeId: null, waypointVisible: false, boostVisible: false, parkingVisible: false });
  let state = emptyState();

  function reset() {
    if (disposed) return;
    root.hidden = true;
    card.hidden = true;
    status.hidden = true;
    waypointRow.hidden = true;
    boostRow.hidden = true;
    progress.hidden = true;
    parking.hidden = true;
    lastResultKey = '';
    resultDeadline = 0;
    previousActive = null;
    lastAnnouncement = '';
    lastParkingPlacement = null;
    write(live, '');
    state = emptyState();
  }

  function update({ candidate = null, active = null, result = null, waypoint = null, position = null, neuralBoost = null, parkingGuide = null, inVehicle = false, visible = true, now = performance.now() / 1000 } = {}) {
    if (disposed) return { ...state };
    const clock = finite(now);
    const resultKey = result ? JSON.stringify([result.id, result.type, result.title, result.message, result.success]) : '';
    if (resultKey && (resultKey !== lastResultKey || (previousActive && !active))) resultDeadline = clock + RESULT_SECONDS;
    if (!resultKey) resultDeadline = 0;
    lastResultKey = resultKey;
    previousActive = active?.id ?? null;

    const hasResult = Boolean(result && !active && clock < resultDeadline && (!candidate || candidate.id === result.id));
    const mode = active ? 'active' : hasResult ? (result.success === false ? 'unavailable' : 'complete') : candidate ? (candidate.available === false ? 'unavailable' : 'ready') : 'hidden';
    const source = active || (hasResult ? result : candidate);
    const type = SERVICE_TYPES[source?.type] || FALLBACK_TYPE;
    const cooldown = Math.max(0, finite(candidate?.cooldownRemaining));
    const boostRemaining = Math.max(0, finite(neuralBoost?.remaining));
    const boostPercent = Math.round((finite(neuralBoost?.regenMultiplier, 1) - 1) * 100);
    const waypointVisible = Boolean(waypoint?.label);
    const boostVisible = boostRemaining > 0 && boostPercent > 0;
    const corners = parkingGuide?.screenCorners;
    const parkingVisible = Boolean(inVehicle && parkingGuide && Number.isFinite(parkingGuide.distance) && parkingGuide.distance <= 25 && parkingGuide.distance >= 0 && Number.isFinite(parkingGuide.width) && Number.isFinite(parkingGuide.height) && parkingGuide.width > 0 && parkingGuide.height > 0 && Array.isArray(corners) && corners.length === 4 && corners.every(p => Number.isFinite(p?.x) && Number.isFinite(p?.y)));
    const cardVisible = mode !== 'hidden';
    const shown = Boolean(visible && (cardVisible || waypointVisible || boostVisible || parkingVisible));
    root.hidden = !shown;
    root.dataset.inVehicle = String(Boolean(inVehicle));
    card.hidden = !cardVisible;
    card.dataset.mode = mode;
    card.dataset.type = source?.type || 'unknown';
    status.hidden = !waypointVisible && !boostVisible;
    waypointRow.hidden = !waypointVisible;
    boostRow.hidden = !boostVisible;
    parking.hidden = !parkingVisible;
    state = { visible: shown, cardVisible: Boolean(visible && cardVisible), mode, candidateId: candidate?.id ?? null, activeId: active?.id ?? null, waypointVisible: Boolean(visible && waypointVisible), boostVisible: Boolean(visible && boostVisible), parkingVisible: Boolean(visible && parkingVisible) };

    if (cardVisible) {
      if (lastIcon !== type.icon) { iconPath.setAttribute('d', type.icon); lastIcon = type.icon; }
      write(typeLabel, type.label);
      write(title, active?.label || (hasResult ? result.title : candidate?.label) || type.label);
      write(description, active ? 'Stay nearby while the service completes.' : hasResult ? result.message : candidate?.description);
      description.hidden = !description.textContent;
      key.hidden = mode !== 'ready';
      progress.hidden = !active;
      write(availability, active ? 'IN PROGRESS' : hasResult ? (result.success === false ? 'UNAVAILABLE' : 'COMPLETE') : cooldown > 0 ? 'COOLDOWN' : candidate.available === false ? 'UNAVAILABLE' : 'AVAILABLE');
      write(actionLabel, active ? 'Move away to cancel' : hasResult ? (result.success === false ? 'Service unavailable' : 'Service complete') : candidate.available === false ? (candidate.reason || (cooldown > 0 ? 'Service recovering' : 'Unavailable right now')) : (candidate.actionLabel || 'Use service'));
      write(measure, active ? secondsText(Math.max(0, finite(active.remaining))) : hasResult ? '' : cooldown > 0 ? secondsText(cooldown) : Number.isFinite(candidate?.distance) ? distanceText(candidate.distance) : '');
      if (active) {
        const percent = Math.round(clamp(active.progress, 0, 1) * 100);
        const value = String(percent);
        if (progress.getAttribute('aria-valuenow') !== value) {
          progress.setAttribute('aria-valuenow', value);
          progressFill.style.transform = `scaleX(${percent / 100})`;
        }
        progress.setAttribute('aria-label', `${active.label || type.label} progress`);
      }
    }
    if (waypointVisible) {
      let distance = waypoint.distance;
      if (!Number.isFinite(distance) && [position?.x, position?.z, waypoint.x, waypoint.z].every(Number.isFinite)) distance = Math.hypot(waypoint.x - position.x, waypoint.z - position.z);
      write(waypointLabel, waypoint.label);
      write(waypointDistance, Number.isFinite(distance) ? `${distanceText(distance)}${waypoint.district ? ` · ${waypoint.district}` : ''}` : waypoint.district || 'Waypoint set');
    }
    if (boostVisible) {
      write(boostLabel, `Neural recovery +${boostPercent}%`);
      write(boostTime, secondsText(boostRemaining));
    }
    if (parkingVisible) {
      parking.dataset.aligned = String(Boolean(parkingGuide.aligned));
      const { width, height } = parkingGuide;
      parkingSVG.setAttribute('viewBox', `0 0 ${width} ${height}`);
      // These are projected screen-space brackets, never new physical geometry.
      const toward = (a, b) => ({ x: a.x + (b.x - a.x) * .18, y: a.y + (b.y - a.y) * .18 });
      const coordinate = point => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      parkingBrackets.setAttribute('d', corners.map((corner, index) => `M${coordinate(toward(corner, corners[(index + 3) % 4]))} L${coordinate(corner)} L${coordinate(toward(corner, corners[(index + 1) % 4]))}`).join(' '));
      const projected = parkingGuide.screenLabel;
      const labelX = Number.isFinite(projected?.x) ? projected.x : corners.reduce((sum, p) => sum + p.x, 0) / 4;
      const labelY = Number.isFinite(projected?.y) ? projected.y : corners.reduce((sum, p) => sum + p.y, 0) / 4;
      write(parkingTitle, parkingGuide.label || 'Service apron');
      write(parkingInstruction, 'Stop here, then exit with E');
      write(parkingDistance, `${distanceText(parkingGuide.distance)}${parkingGuide.aligned ? ' · ALIGNED' : ''}`);
      positionParkingLabel({ width, height, labelX, labelY, corners });
    } else {
      lastParkingPlacement = null;
    }

    // Announce transitions, never per-frame distance, countdown or progress changes.
    const announcementKey = shown ? JSON.stringify([mode, source?.id, candidate?.available, candidate?.reason, hasResult ? resultKey : '', waypoint?.id, waypoint?.label, boostVisible, parkingVisible ? parkingGuide.label : '', parkingVisible && parkingGuide.aligned]) : '';
    if (announcementKey !== lastAnnouncement) {
      lastAnnouncement = announcementKey;
      const parts = [];
      if (shown && cardVisible) {
        parts.push(title.textContent);
        if (active) parts.push('Service started. Stay nearby. Move away to cancel.');
        else if (hasResult) parts.push(result.message || actionLabel.textContent);
        else parts.push(mode === 'ready' ? `Press E to ${actionLabel.textContent}.` : actionLabel.textContent);
      }
      if (shown && waypointVisible) parts.push(`Waypoint: ${waypoint.label}. ${waypointDistance.textContent}.`);
      if (shown && boostVisible) parts.push(boostLabel.textContent);
      if (shown && parkingVisible) parts.push(`${parkingTitle.textContent}. ${parkingInstruction.textContent}.${parkingGuide.aligned ? ' Vehicle aligned.' : ''}`);
      write(live, parts.join(' '));
    }
    return { ...state };
  }

  function positionParkingLabel({ width, height, labelX, labelY, corners }) {
    // Read the actual visible HUD rectangles once, then score placements without
    // writing/reflowing a trial position for every candidate.
    parkingLabel.hidden = false;
    const labelRect = parkingLabel.getBoundingClientRect();
    const w = labelRect.width, h = labelRect.height, margin = 12, gap = width <= 720 && height <= 680 ? 4 : 10;
    if (!w || !h) return;
    const occupied = [
      document.getElementById('vehicle-hud'), document.getElementById('interaction'),
      card, status, document.querySelector('.bottom-hud'), document.getElementById('crosshair'),
      document.querySelector('.left-hud'), document.querySelector('.minimap'), document.querySelector('.topbar'), document.querySelector('.hud-hint'),
    ].filter(Boolean).flatMap(element => {
      if (element.hidden || !element.getClientRects().length) return [];
      const style = document.defaultView.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return [];
      const rect = element.getBoundingClientRect();
      return rect.width && rect.height ? [{ left: rect.left - gap, top: rect.top - gap, right: rect.right + gap, bottom: rect.bottom + gap }] : [];
    });
    const within = (value, maximum) => Math.max(margin, Math.min(Math.max(margin, maximum - margin), value));
    const desired = { x: within(labelX - w / 2, width - w), y: within(labelY + 10, height - h) };
    const xs = new Set([desired.x, within(labelX - w - 18, width - w), within(labelX + 18, width - w)]);
    const ys = new Set([desired.y, within(labelY - h - 18, height - h)]);
    for (const rect of occupied) {
      xs.add(within(rect.left - w, width - w)); xs.add(within(rect.right, width - w));
      ys.add(within(rect.top - h, height - h)); ys.add(within(rect.bottom, height - h));
    }
    if (lastParkingPlacement) { xs.add(within(lastParkingPlacement.x, width - w)); ys.add(within(lastParkingPlacement.y, height - h)); }
    let best = null;
    for (const x of xs) for (const y of ys) {
      if (occupied.some(rect => x < rect.right && x + w > rect.left && y < rect.bottom && y + h > rect.top)) continue;
      const score = (x - desired.x) ** 2 + (y - desired.y) ** 2 + (lastParkingPlacement ? .12 * ((x - lastParkingPlacement.x) ** 2 + (y - lastParkingPlacement.y) ** 2) : 0);
      if (!best || score < best.score) best = { x, y, score };
    }
    // Extremely constrained viewports keep the grounded brackets; they never
    // cover essential controls with an unreadable overlapping label.
    parkingLabel.hidden = !best;
    parkingLeader.setAttribute('d', '');
    if (!best) { lastParkingPlacement = null; return; }
    parkingLabel.style.left = `${best.x / width * 100}%`;
    parkingLabel.style.top = `${best.y / height * 100}%`;
    lastParkingPlacement = { x: best.x, y: best.y };
    state.parkingLabelBounds = { x: best.x, y: best.y, width: w, height: h };
    const center = { x: best.x + w / 2, y: best.y + h / 2 };
    if (Math.hypot(best.x - desired.x, best.y - desired.y) < 18) return;
    const crosses = (start, end, rect) => {
      let low = 0, high = 1;
      for (const [axis, min, max] of [['x', rect.left, rect.right], ['y', rect.top, rect.bottom]]) {
        const delta = end[axis] - start[axis];
        if (Math.abs(delta) < 1e-8) { if (start[axis] < min || start[axis] > max) return false; continue; }
        let a = (min - start[axis]) / delta, b = (max - start[axis]) / delta;
        if (a > b) [a, b] = [b, a]; low = Math.max(low, a); high = Math.min(high, b);
        if (low > high) return false;
      }
      return true;
    };
    let connector = null;
    for (let index = 0; index < 4; index++) {
      const a = corners[index], b = corners[(index + 1) % 4];
      const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
      const t = length ? Math.max(0, Math.min(1, ((center.x - a.x) * dx + (center.y - a.y) * dy) / length)) : 0;
      const end = { x: a.x + dx * t, y: a.y + dy * t };
      const start = { x: Math.max(best.x, Math.min(best.x + w, end.x)), y: Math.max(best.y, Math.min(best.y + h, end.y)) };
      const distance = Math.hypot(end.x - start.x, end.y - start.y);
      if (distance < 8 || distance > 190 || occupied.some(rect => crosses(start, end, rect))) continue;
      if (!connector || distance < connector.distance) connector = { start, end, distance };
    }
    if (connector) parkingLeader.setAttribute('d', `M${connector.start.x.toFixed(2)} ${connector.start.y.toFixed(2)} L${connector.end.x.toFixed(2)} ${connector.end.y.toFixed(2)}`);
  }

  reset();
  return {
    update, reset,
    getState: () => ({ ...state }),
    dispose() { if (!disposed) { reset(); root.remove(); disposed = true; } },
  };
}
