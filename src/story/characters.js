// The cast of the story: name, subtitle colour, and a voice for browser speech.
export const CAST = {
  KAI: { name: 'KAI', color: '#ffd23c', voice: { pitch: 0.85, rate: 1.05 } },
  ROSA: { name: 'ROSA', color: '#ff5fa8', voice: { pitch: 1.35, rate: 1.1, female: true } },
  DIMA: { name: 'DIMA', color: '#ff9f1c', voice: { pitch: 0.6, rate: 0.95 } },
  SILAS: { name: 'SILAS', color: '#e63946', voice: { pitch: 0.75, rate: 1.0 } },
  VOSS: { name: 'COMMISSIONER VOSS', color: '#4da3ff', voice: { pitch: 0.55, rate: 0.9 } },
  REYES: { name: 'CAPTAIN REYES', color: '#7aa2c8', voice: { pitch: 0.7, rate: 1.1 } },
  KADE: { name: 'MARLO KADE', color: '#d4a373', voice: { pitch: 0.65, rate: 0.95 } },
  NADIA: { name: 'NADIA', color: '#9fe7ff', voice: { pitch: 1.2, rate: 1.0, female: true } },
  DRAGO: { name: 'COLONEL DRAGO', color: '#8fbc5a', voice: { pitch: 0.5, rate: 0.9 } },
  TARIQ: { name: 'TARIQ', color: '#ffb703', voice: { pitch: 0.9, rate: 1.05 } },
  CURATOR: { name: 'THE CURATOR', color: '#c9a7ff', voice: { pitch: 1.0, rate: 0.85 } },
  QUILL: { name: 'HARBOR MASTER QUILL', color: '#2ec4b6', voice: { pitch: 0.7, rate: 1.0 } },
  WHISPER: { name: 'THE WHISPER', color: '#b0b0b0', voice: { pitch: 1.1, rate: 0.8, female: true } },
  KANE: { name: 'GENERAL KANE', color: '#6b8f3a', voice: { pitch: 0.45, rate: 0.85 } },
  ARCHITECT: { name: 'THE ARCHITECT', color: '#ffffff', voice: { pitch: 0.4, rate: 0.75 } },
  RADIO: { name: 'POLICE RADIO', color: '#9aa4b1', voice: { pitch: 0.8, rate: 1.25 } },
  CONTACT: { name: 'CONTACT', color: '#9ad1ff', voice: { pitch: 1.05, rate: 1.1 } },
  BROKER: { name: 'THE BROKER', color: '#06d6a0', voice: { pitch: 0.95, rate: 1.05 } },
};

export const speaker = (id) => CAST[id] || { name: id, color: '#ffffff', voice: { pitch: 1, rate: 1 } };
