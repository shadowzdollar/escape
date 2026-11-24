// The cast of the story: name, subtitle colour, and distinct natural human voice profiles.
// Pitch values stay within natural human vocal range (0.84..1.16) to avoid robotic distortion.
export const CAST = {
  KAI:       { id: 'KAI',       name: 'KAI',               color: '#ffd23c', voice: { pitch: 0.96, rate: 1.03, tone: 'calm',    slot: 0 } },
  ROSA:      { id: 'ROSA',      name: 'ROSA',              color: '#ff5fa8', voice: { pitch: 1.08, rate: 1.05, female: true, radio: true, tone: 'urgent', slot: 0 } },
  DIMA:      { id: 'DIMA',      name: 'DIMA',              color: '#ff9f1c', voice: { pitch: 0.88, rate: 0.96, tone: 'gruff',   slot: 1 } },
  SILAS:     { id: 'SILAS',     name: 'SILAS',             color: '#e63946', voice: { pitch: 0.92, rate: 1.0,  tone: 'tense',   slot: 2 } },
  VOSS:      { id: 'VOSS',      name: 'COMMISSIONER VOSS', color: '#4da3ff', voice: { pitch: 0.85, rate: 0.94, radio: true, tone: 'stern', slot: 3 } },
  REYES:     { id: 'REYES',     name: 'CAPTAIN REYES',     color: '#7aa2c8', voice: { pitch: 0.93, rate: 1.06, radio: true, tone: 'urgent', slot: 4 } },
  KADE:      { id: 'KADE',      name: 'MARLO KADE',        color: '#d4a373', voice: { pitch: 0.87, rate: 0.95, tone: 'gruff',   slot: 5 } },
  NADIA:     { id: 'NADIA',     name: 'NADIA',             color: '#9fe7ff', voice: { pitch: 1.05, rate: 1.0,  female: true, tone: 'calm', slot: 1 } },
  DRAGO:     { id: 'DRAGO',     name: 'COLONEL DRAGO',     color: '#8fbc5a', voice: { pitch: 0.84, rate: 0.93, radio: true, tone: 'stern', slot: 6 } },
  TARIQ:     { id: 'TARIQ',     name: 'TARIQ',             color: '#ffb703', voice: { pitch: 0.98, rate: 1.04, tone: 'calm',    slot: 7 } },
  CURATOR:   { id: 'CURATOR',   name: 'THE CURATOR',       color: '#c9a7ff', voice: { pitch: 1.0,  rate: 0.92, tone: 'refined', slot: 8 } },
  QUILL:     { id: 'QUILL',     name: 'HARBOR MASTER QUILL', color: '#2ec4b6', voice: { pitch: 0.9, rate: 0.98, tone: 'gruff', slot: 9 } },
  WHISPER:   { id: 'WHISPER',   name: 'THE WHISPER',       color: '#b0b0b0', voice: { pitch: 1.04, rate: 0.92, female: true, tone: 'calm', slot: 2 } },
  KANE:      { id: 'KANE',      name: 'GENERAL KANE',      color: '#6b8f3a', voice: { pitch: 0.84, rate: 0.91, radio: true, tone: 'stern', slot: 10 } },
  ARCHITECT: { id: 'ARCHITECT', name: 'THE ARCHITECT',     color: '#ffffff', voice: { pitch: 0.86, rate: 0.90, tone: 'calm',    slot: 11 } },
  RADIO:     { id: 'RADIO',     name: 'POLICE RADIO',      color: '#9aa4b1', voice: { pitch: 0.96, rate: 1.12, radio: true, tone: 'urgent', slot: 12 } },
  CONTACT:   { id: 'CONTACT',   name: 'CONTACT',           color: '#9ad1ff', voice: { pitch: 1.02, rate: 1.04, tone: 'tense',   slot: 13 } },
  BROKER:    { id: 'BROKER',    name: 'THE BROKER',        color: '#06d6a0', voice: { pitch: 0.99, rate: 1.02, tone: 'refined', slot: 14 } },
};

export const speaker = (id) => CAST[id] || { id, name: id, color: '#ffffff', voice: { pitch: 1, rate: 1, slot: 0 } };
