// Verified residential housing recipes, shared by the game, collision and native exporters.
// Kept isolated until the layout explicitly opts in. No random stream or asset dependency.
const VERSION=1;
const OLD_BAY_IDS=new Set(['COURT-15-B102-BAYS','COURT-15-B103-BAYS']);
const EXPECTED_HOSTS=[{"id":"B102","label":"B102 / block-15","sourceId":"block-15-101","chunk":"block-15","x":-183.3,"y":17.88794787232764,"z":-272.8,"sx":21,"sy":35.37589574465528,"sz":22,"sections":[{"x":-183.3,"y":17.88794787232764,"z":-272.8,"sx":21,"sy":35.37589574465528,"sz":22}]},{"id":"B103","label":"B103 / block-15","sourceId":"block-15-102","chunk":"block-15","x":-183.3,"y":11.013727399567141,"z":-207.2,"sx":21,"sy":21.627454799134284,"sz":22,"sections":[{"x":-183.3,"y":11.013727399567141,"z":-207.2,"sx":21,"sy":21.627454799134284,"sz":22}]}];
// Exact original source records make upstream drift fail before any layout mutation.
const EXPECTED_REPLACEMENTS=[
  {
    "sourceIndex": 111217,
    "original": {
      "x": -188.40000000000003,
      "y": 5,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111245,
    "original": {
      "x": -190.60000000000002,
      "y": 7.8,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111247,
    "original": {
      "x": -188.40000000000003,
      "y": 7.8,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#ddbb89",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111248,
    "original": {
      "x": -188.40000000000003,
      "y": 7.1499999999999995,
      "z": -261.40000000000003,
      "sx": 1.6,
      "sy": 0.12,
      "sz": 0.8,
      "c": "#3c4f61",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111252,
    "original": {
      "x": -181.80000000000007,
      "y": 7.8,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#65949b",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111254,
    "original": {
      "x": -179.60000000000008,
      "y": 7.8,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111255,
    "original": {
      "x": -179.60000000000008,
      "y": 7.1499999999999995,
      "z": -261.40000000000003,
      "sx": 1.6,
      "sy": 0.12,
      "sz": 0.8,
      "c": "#3c4f61",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111257,
    "original": {
      "x": -177.4000000000001,
      "y": 7.8,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#65949b",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111258,
    "original": {
      "x": -177.4000000000001,
      "y": 7.1499999999999995,
      "z": -261.40000000000003,
      "sx": 1.6,
      "sy": 0.12,
      "sz": 0.8,
      "c": "#3c4f61",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111278,
    "original": {
      "x": -190.60000000000002,
      "y": 10.6,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#65949b",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111280,
    "original": {
      "x": -188.40000000000003,
      "y": 10.6,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#65949b",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111282,
    "original": {
      "x": -186.20000000000005,
      "y": 10.6,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111313,
    "original": {
      "x": -190.60000000000002,
      "y": 13.399999999999999,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111315,
    "original": {
      "x": -188.40000000000003,
      "y": 13.399999999999999,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#ddbb89",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111317,
    "original": {
      "x": -186.20000000000005,
      "y": 13.399999999999999,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111322,
    "original": {
      "x": -179.60000000000008,
      "y": 13.399999999999999,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111324,
    "original": {
      "x": -177.4000000000001,
      "y": 13.399999999999999,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#65949b",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111344,
    "original": {
      "x": -188.40000000000003,
      "y": 16.2,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#65949b",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111345,
    "original": {
      "x": -186.20000000000005,
      "y": 16.2,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111349,
    "original": {
      "x": -181.80000000000007,
      "y": 16.2,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111350,
    "original": {
      "x": -181.80000000000007,
      "y": 15.549999999999999,
      "z": -261.40000000000003,
      "sx": 1.6,
      "sy": 0.12,
      "sz": 0.8,
      "c": "#3c4f61",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111352,
    "original": {
      "x": -179.60000000000008,
      "y": 16.2,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#65949b",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111353,
    "original": {
      "x": -177.4000000000001,
      "y": 16.2,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111354,
    "original": {
      "x": -177.4000000000001,
      "y": 15.549999999999999,
      "z": -261.40000000000003,
      "sx": 1.6,
      "sy": 0.12,
      "sz": 0.8,
      "c": "#3c4f61",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111368,
    "original": {
      "x": -190.60000000000002,
      "y": 19,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111370,
    "original": {
      "x": -188.40000000000003,
      "y": 19,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111371,
    "original": {
      "x": -186.20000000000005,
      "y": 19,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111397,
    "original": {
      "x": -190.60000000000002,
      "y": 21.8,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111398,
    "original": {
      "x": -190.60000000000002,
      "y": 21.150000000000002,
      "z": -261.40000000000003,
      "sx": 1.6,
      "sy": 0.12,
      "sz": 0.8,
      "c": "#3c4f61",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111399,
    "original": {
      "x": -188.40000000000003,
      "y": 21.8,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#65949b",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111405,
    "original": {
      "x": -181.80000000000007,
      "y": 21.8,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#ddbb89",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111407,
    "original": {
      "x": -179.60000000000008,
      "y": 21.8,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#65949b",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111410,
    "original": {
      "x": -177.4000000000001,
      "y": 21.8,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111428,
    "original": {
      "x": -186.20000000000005,
      "y": 24.6,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111429,
    "original": {
      "x": -186.20000000000005,
      "y": 23.950000000000003,
      "z": -261.40000000000003,
      "sx": 1.6,
      "sy": 0.12,
      "sz": 0.8,
      "c": "#3c4f61",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111433,
    "original": {
      "x": -181.80000000000007,
      "y": 24.6,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111435,
    "original": {
      "x": -179.60000000000008,
      "y": 24.6,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#65949b",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111436,
    "original": {
      "x": -177.4000000000001,
      "y": 24.6,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#ddbb89",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111453,
    "original": {
      "x": -190.60000000000002,
      "y": 27.400000000000002,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111455,
    "original": {
      "x": -188.40000000000003,
      "y": 27.400000000000002,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#ddbb89",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111457,
    "original": {
      "x": -186.20000000000005,
      "y": 27.400000000000002,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111459,
    "original": {
      "x": -181.80000000000007,
      "y": 27.400000000000002,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111461,
    "original": {
      "x": -177.4000000000001,
      "y": 27.400000000000002,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111481,
    "original": {
      "x": -188.40000000000003,
      "y": 30.200000000000003,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#ddbb89",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111483,
    "original": {
      "x": -186.20000000000005,
      "y": 30.200000000000003,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111486,
    "original": {
      "x": -181.80000000000007,
      "y": 30.200000000000003,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111488,
    "original": {
      "x": -179.60000000000008,
      "y": 30.200000000000003,
      "z": -261.74,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#ddbb89",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111489,
    "original": {
      "x": -179.60000000000008,
      "y": 29.550000000000004,
      "z": -261.40000000000003,
      "sx": 1.6,
      "sy": 0.12,
      "sz": 0.8,
      "c": "#3c4f61",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111538,
    "original": {
      "x": -190.43639293774032,
      "y": 15.114119362791984,
      "z": -261.66,
      "sx": 1.0784606516361237,
      "sy": 0.5287642477545886,
      "sz": 0.3,
      "c": "#354450",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111541,
    "original": {
      "x": -190.4354916903656,
      "y": 12.870696244388201,
      "z": -261.66,
      "sx": 1.1266206160187722,
      "sy": 0.7272997687105089,
      "sz": 0.3,
      "c": "#354450",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111542,
    "original": {
      "x": -177.15250658285805,
      "y": 13.345665603878922,
      "z": -261.66,
      "sx": 0.6076918832957744,
      "sy": 0.5406729579437524,
      "sz": 0.3,
      "c": "#354450",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111544,
    "original": {
      "x": -189.89873148403132,
      "y": 12.509495126140383,
      "z": -261.66,
      "sx": 0.9312314718961716,
      "sy": 0.3409592649433762,
      "sz": 0.3,
      "c": "#354450",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111545,
    "original": {
      "x": -178.03107864917257,
      "y": 8.914846330268453,
      "z": -261.66,
      "sx": 1.0919836826622487,
      "sy": 0.3961783182341605,
      "sz": 0.3,
      "c": "#354450",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111548,
    "original": {
      "x": -187.35971123208293,
      "y": 26.098861273141132,
      "z": -261.66,
      "sx": 0.9123825930058956,
      "sy": 0.318358137505129,
      "sz": 0.3,
      "c": "#354450",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111692,
    "original": {
      "x": -190.60000000000002,
      "y": 7.8,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111693,
    "original": {
      "x": -190.60000000000002,
      "y": 7.1499999999999995,
      "z": -218.6,
      "sx": 1.6,
      "sy": 0.12,
      "sz": 0.8,
      "c": "#3c4f61",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111695,
    "original": {
      "x": -188.40000000000003,
      "y": 7.8,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111696,
    "original": {
      "x": -186.20000000000005,
      "y": 7.8,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111698,
    "original": {
      "x": -184.00000000000006,
      "y": 7.8,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#ddbb89",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111700,
    "original": {
      "x": -181.80000000000007,
      "y": 7.8,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111702,
    "original": {
      "x": -179.60000000000008,
      "y": 7.8,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111703,
    "original": {
      "x": -177.4000000000001,
      "y": 7.8,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#ddbb89",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111705,
    "original": {
      "x": -175.2000000000001,
      "y": 7.8,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111706,
    "original": {
      "x": -175.2000000000001,
      "y": 7.1499999999999995,
      "z": -218.6,
      "sx": 1.6,
      "sy": 0.12,
      "sz": 0.8,
      "c": "#3c4f61",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111725,
    "original": {
      "x": -190.60000000000002,
      "y": 10.6,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111728,
    "original": {
      "x": -188.40000000000003,
      "y": 10.6,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111732,
    "original": {
      "x": -184.00000000000006,
      "y": 10.6,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#ddbb89",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111734,
    "original": {
      "x": -181.80000000000007,
      "y": 10.6,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#65949b",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111736,
    "original": {
      "x": -179.60000000000008,
      "y": 10.6,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#ddbb89",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111738,
    "original": {
      "x": -177.4000000000001,
      "y": 10.6,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111740,
    "original": {
      "x": -175.2000000000001,
      "y": 10.6,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111758,
    "original": {
      "x": -190.60000000000002,
      "y": 13.399999999999999,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111760,
    "original": {
      "x": -186.20000000000005,
      "y": 13.399999999999999,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#bb9a72",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111762,
    "original": {
      "x": -184.00000000000006,
      "y": 13.399999999999999,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111764,
    "original": {
      "x": -181.80000000000007,
      "y": 13.399999999999999,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111765,
    "original": {
      "x": -179.60000000000008,
      "y": 13.399999999999999,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#65949b",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111768,
    "original": {
      "x": -175.2000000000001,
      "y": 13.399999999999999,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#ddbb89",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111792,
    "original": {
      "x": -188.40000000000003,
      "y": 16.2,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111794,
    "original": {
      "x": -186.20000000000005,
      "y": 16.2,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#ddbb89",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111796,
    "original": {
      "x": -184.00000000000006,
      "y": 16.2,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#ddbb89",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111797,
    "original": {
      "x": -181.80000000000007,
      "y": 16.2,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#ddbb89",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111798,
    "original": {
      "x": -181.80000000000007,
      "y": 15.549999999999999,
      "z": -218.6,
      "sx": 1.6,
      "sy": 0.12,
      "sz": 0.8,
      "c": "#3c4f61",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111800,
    "original": {
      "x": -179.60000000000008,
      "y": 16.2,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#65949b",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111802,
    "original": {
      "x": -177.4000000000001,
      "y": 16.2,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 111804,
    "original": {
      "x": -175.2000000000001,
      "y": 16.2,
      "z": -218.26,
      "sx": 0.78,
      "sy": 0.81,
      "sz": 0.07,
      "c": "#486d85",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near"
    },
    "reason": "Remove old flat windows or ledges inside the explicit new facade aperture"
  },
  {
    "sourceIndex": 160404,
    "original": {
      "id": "COURT-15-B102-BAYS-001",
      "x": -187.4,
      "y": 6.784999999999999,
      "z": -261.40000000000003,
      "sx": 6,
      "sy": 3.2,
      "sz": 0.84,
      "c": "#586372",
      "kind": "solid",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "projecting inhabited bay",
      "supportId": "SUP-COURT-15-B102-BAYS-001"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160405,
    "original": {
      "id": "COURT-15-B102-BAYS-002",
      "x": -187.4,
      "y": 7.034999999999999,
      "z": -260.96000000000004,
      "sx": 5.45,
      "sy": 1.84,
      "sz": 0.08,
      "c": "#7b999d",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "long bay glazing"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160406,
    "original": {
      "id": "COURT-15-B102-BAYS-003",
      "x": -190.12,
      "y": 7.015,
      "z": -260.89,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160407,
    "original": {
      "id": "COURT-15-B102-BAYS-004",
      "x": -188.30333333333334,
      "y": 7.015,
      "z": -260.89,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160408,
    "original": {
      "id": "COURT-15-B102-BAYS-005",
      "x": -186.48666666666668,
      "y": 7.015,
      "z": -260.89,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160409,
    "original": {
      "id": "COURT-15-B102-BAYS-006",
      "x": -184.67000000000002,
      "y": 7.015,
      "z": -260.89,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160410,
    "original": {
      "id": "COURT-15-B102-BAYS-007",
      "x": -187.4,
      "y": 5.154999999999999,
      "z": -261.1,
      "sx": 6.42,
      "sy": 0.2,
      "sz": 1.47,
      "c": "#a78e9c",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "supported landing ledge",
      "supportId": "SUP-COURT-15-B102-BAYS-007"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160411,
    "original": {
      "id": "COURT-15-B102-BAYS-008",
      "x": -187.4,
      "y": 8.405000000000001,
      "z": -261.22,
      "sx": 6.42,
      "sy": 0.19,
      "sz": 1.25,
      "c": "#846d82",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "bay upper cap"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160412,
    "original": {
      "id": "COURT-15-B102-BAYS-009",
      "x": -179.9,
      "y": 9.785,
      "z": -261.40000000000003,
      "sx": 6,
      "sy": 3.2,
      "sz": 0.84,
      "c": "#586372",
      "kind": "solid",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "projecting inhabited bay",
      "supportId": "SUP-COURT-15-B102-BAYS-009"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160413,
    "original": {
      "id": "COURT-15-B102-BAYS-010",
      "x": -179.9,
      "y": 10.035,
      "z": -260.96000000000004,
      "sx": 5.45,
      "sy": 1.84,
      "sz": 0.08,
      "c": "#7b999d",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "long bay glazing"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160414,
    "original": {
      "id": "COURT-15-B102-BAYS-011",
      "x": -182.62,
      "y": 10.015,
      "z": -260.89,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160415,
    "original": {
      "id": "COURT-15-B102-BAYS-012",
      "x": -180.80333333333334,
      "y": 10.015,
      "z": -260.89,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160416,
    "original": {
      "id": "COURT-15-B102-BAYS-013",
      "x": -178.98666666666668,
      "y": 10.015,
      "z": -260.89,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160417,
    "original": {
      "id": "COURT-15-B102-BAYS-014",
      "x": -177.17000000000002,
      "y": 10.015,
      "z": -260.89,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160418,
    "original": {
      "id": "COURT-15-B102-BAYS-015",
      "x": -179.9,
      "y": 8.155,
      "z": -261.1,
      "sx": 6.42,
      "sy": 0.2,
      "sz": 1.47,
      "c": "#a78e9c",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "supported landing ledge",
      "supportId": "SUP-COURT-15-B102-BAYS-015"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160419,
    "original": {
      "id": "COURT-15-B102-BAYS-016",
      "x": -179.9,
      "y": 11.405000000000001,
      "z": -261.22,
      "sx": 6.42,
      "sy": 0.19,
      "sz": 1.25,
      "c": "#846d82",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B102-BAYS",
      "attachedTo": "B102",
      "role": "bay upper cap"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160420,
    "original": {
      "id": "COURT-15-B103-BAYS-001",
      "x": -187.4,
      "y": 6.784999999999999,
      "z": -218.6,
      "sx": 6,
      "sy": 3.2,
      "sz": 0.84,
      "c": "#586372",
      "kind": "solid",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "projecting inhabited bay",
      "supportId": "SUP-COURT-15-B103-BAYS-001"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160421,
    "original": {
      "id": "COURT-15-B103-BAYS-002",
      "x": -187.4,
      "y": 7.034999999999999,
      "z": -219.04,
      "sx": 5.45,
      "sy": 1.84,
      "sz": 0.08,
      "c": "#7b999d",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "long bay glazing"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160422,
    "original": {
      "id": "COURT-15-B103-BAYS-003",
      "x": -190.12,
      "y": 7.015,
      "z": -219.10999999999999,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160423,
    "original": {
      "id": "COURT-15-B103-BAYS-004",
      "x": -188.30333333333334,
      "y": 7.015,
      "z": -219.10999999999999,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160424,
    "original": {
      "id": "COURT-15-B103-BAYS-005",
      "x": -186.48666666666668,
      "y": 7.015,
      "z": -219.10999999999999,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160425,
    "original": {
      "id": "COURT-15-B103-BAYS-006",
      "x": -184.67000000000002,
      "y": 7.015,
      "z": -219.10999999999999,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160426,
    "original": {
      "id": "COURT-15-B103-BAYS-007",
      "x": -187.4,
      "y": 5.154999999999999,
      "z": -218.89999999999998,
      "sx": 6.42,
      "sy": 0.2,
      "sz": 1.47,
      "c": "#a78e9c",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "supported landing ledge",
      "supportId": "SUP-COURT-15-B103-BAYS-007"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160427,
    "original": {
      "id": "COURT-15-B103-BAYS-008",
      "x": -187.4,
      "y": 8.405000000000001,
      "z": -218.78,
      "sx": 6.42,
      "sy": 0.19,
      "sz": 1.25,
      "c": "#846d82",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "bay upper cap"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160428,
    "original": {
      "id": "COURT-15-B103-BAYS-009",
      "x": -179.9,
      "y": 9.785,
      "z": -218.6,
      "sx": 6,
      "sy": 3.2,
      "sz": 0.84,
      "c": "#586372",
      "kind": "solid",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "projecting inhabited bay",
      "supportId": "SUP-COURT-15-B103-BAYS-009"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160429,
    "original": {
      "id": "COURT-15-B103-BAYS-010",
      "x": -179.9,
      "y": 10.035,
      "z": -219.04,
      "sx": 5.45,
      "sy": 1.84,
      "sz": 0.08,
      "c": "#7b999d",
      "kind": "window",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "long bay glazing"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160430,
    "original": {
      "id": "COURT-15-B103-BAYS-011",
      "x": -182.62,
      "y": 10.015,
      "z": -219.10999999999999,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160431,
    "original": {
      "id": "COURT-15-B103-BAYS-012",
      "x": -180.80333333333334,
      "y": 10.015,
      "z": -219.10999999999999,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160432,
    "original": {
      "id": "COURT-15-B103-BAYS-013",
      "x": -178.98666666666668,
      "y": 10.015,
      "z": -219.10999999999999,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160433,
    "original": {
      "id": "COURT-15-B103-BAYS-014",
      "x": -177.17000000000002,
      "y": 10.015,
      "z": -219.10999999999999,
      "sx": 0.12,
      "sy": 2.07,
      "sz": 0.16,
      "c": "#b3a2a1",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "bay mullion"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160434,
    "original": {
      "id": "COURT-15-B103-BAYS-015",
      "x": -179.9,
      "y": 8.155,
      "z": -218.89999999999998,
      "sx": 6.42,
      "sy": 0.2,
      "sz": 1.47,
      "c": "#a78e9c",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "supported landing ledge",
      "supportId": "SUP-COURT-15-B103-BAYS-015"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  },
  {
    "sourceIndex": 160435,
    "original": {
      "id": "COURT-15-B103-BAYS-016",
      "x": -179.9,
      "y": 11.405000000000001,
      "z": -218.78,
      "sx": 6.42,
      "sy": 0.19,
      "sz": 1.25,
      "c": "#846d82",
      "kind": "metal",
      "ry": 0,
      "chunk": "block-15",
      "lod": "near",
      "detail": "block-craft",
      "assemblyId": "COURT-15-B103-BAYS",
      "attachedTo": "B103",
      "role": "bay upper cap"
    },
    "reason": "Replace the previous two isolated bays with the new grouped facade recipe"
  }
];
const equal=(a,b)=>a===b||Boolean(a&&b&&typeof a==='object'&&typeof b==='object'&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k])));
const copy=v=>JSON.parse(JSON.stringify(v));
const extent=b=>{const c=Math.abs(Math.cos(b.ry||0)),s=Math.abs(Math.sin(b.ry||0));return{minX:b.x-(c*b.sx+s*b.sz)/2,maxX:b.x+(c*b.sx+s*b.sz)/2,minY:b.y-b.sy/2,maxY:b.y+b.sy/2,minZ:b.z-(s*b.sx+c*b.sz)/2,maxZ:b.z+(s*b.sx+c*b.sz)/2};};
const contact=(a,b)=>a.minX<=b.maxX+.0005&&a.maxX>=b.minX-.0005&&a.minY<=b.maxY+.0005&&a.maxY>=b.minY-.0005&&a.minZ<=b.maxZ+.0005&&a.maxZ>=b.minZ-.0005;

function validateSource(layout){
 if(layout?.housingCompositions)throw new Error('Housing composition is already applied');
 for(const key of['boxes','buildings','colliders','supports'])if(!Array.isArray(layout?.[key]))throw new TypeError('Housing composition requires layout.'+key);
 if(!layout.blueprint||!Array.isArray(layout.blueprint.supports)||!Array.isArray(layout.blockCompositions?.assemblies))throw new TypeError('Housing composition requires the existing authored block blueprint');
 for(const expected of EXPECTED_HOSTS)if(!equal(layout.buildings.find(b=>b.id===expected.id),expected))throw new Error('Housing host changed: '+expected.id);
 for(const r of EXPECTED_REPLACEMENTS)if(!equal(layout.boxes[r.sourceIndex],r.original))throw new Error('Housing source slot changed: '+r.sourceIndex);
 const oldGroups=layout.blockCompositions.assemblies.filter(a=>OLD_BAY_IDS.has(a.id));
 if(oldGroups.length!==2||oldGroups.some(a=>a.boxIds.length!==16))throw new Error('Housing source bay assemblies changed');
 for(const a of oldGroups){const ids=EXPECTED_REPLACEMENTS.filter(r=>r.original.assemblyId===a.id).map(r=>r.original.id).sort();if(!equal([...a.boxIds].sort(),ids))throw new Error('Housing source bay members changed: '+a.id);}
 const ground=layout.boxes.filter(b=>b.kind==='pavement'&&b.sx>=1&&b.sz>=1&&b.y+b.sy/2>=.08&&b.y+b.sy/2<=.4);
 const groundAt=(x,z)=>ground.reduce((height,b)=>{const c=Math.cos(b.ry||0),s=Math.sin(b.ry||0),dx=x-b.x,dz=z-b.z;return Math.abs(dx*c-dz*s)<=b.sx/2&&Math.abs(dx*s+dz*c)<=b.sz/2?Math.max(height,b.y+b.sy/2):height;},.057);
 for(const [x,z]of[[-189,-251.74],[-192.26,-260.95],[-185.34,-257.75],[-159.5,-253.55]])if(Math.abs(groundAt(x,z)-.185)>1e-8)throw new Error('Housing base pavement changed');
}

/** Creates a fresh, deterministic recipe without modifying the supplied layout. */
export function createHousingComposition(layout){
 validateSource(layout);
const G=.185,boxes=[],assemblies=[],paths=[],apertures=[];let current;
function begin(id,label,host){current={id,label,hostBuilding:host,mountType:host?'wall and ground supported':'ground supported',boxIds:[]};assemblies.push(current);}
function box(x,y,z,sx,sy,sz,c,kind='metal',role='structural member',walkable=true){
 const id=current.id+'-'+String(current.boxIds.length+1).padStart(3,'0');
 const b={id,x,y,z,sx,sy,sz,c,kind,ry:0,chunk:'block-15',lod:'near',detail:'block-craft',assemblyId:current.id,attachedTo:current.hostBuilding||current.id,role,walkable};
 boxes.push(b);current.boxIds.push(id);return b;
}
function path(id,points,width=1.2){paths.push({id,width,points:points.map(([x,y,z])=>({x,y,z}))});}
function post(x,z,top,width=.16){box(x,G+.10,z,width+.18,.20,width+.18,'#59636a','metal','ground foundation');box(x,(G+top)/2,z,width,top-G,width,'#827986','metal','grounded support column');}

begin('HOUSING-B102-STAIR','Sixteen-riser exterior residential stair','B102');
const stair={centerX:-189,footZ:-251.74,topZ:-257.5,steps:16,rise:.18,going:.36,width:2.10,baseY:G,landingY:G+16*.18};
for(let i=0;i<stair.steps;i++){
 const top=G+(i+1)*stair.rise,z=stair.footZ-(i+.5)*stair.going;
 box(-189,top-.065,z,2.10,.13,.36,'#a69999','metal','walkable tread');
 box(-189,top-.014,z+.147,2.04,.028,.065,'#b9b8a9','solid','flush tread nosing');
 for(const x of[-190.04,-187.96]){
  // Stair stringers are continuous stepped members touching both neighboring
  // levels. They carry every thin tread to the landing and ground foot.
  box(x,top-.22,z,.16,.42,.37,'#746679','metal','stepped stringer');
  box(x,top+.50,z,.095,1.02,.10,'#a7a4a0','metal','guard baluster');
  box(x,top+1.02,z,.13,.10,.37,'#b3aaa2','metal','handrail horizontal step');
  if(i<15)box(x,top+1.105,z-.175,.13,.20,.04,'#b3aaa2','metal','handrail vertical join');
 }
 for(let j=0;j<3;j++)box(-189-.58+j*.58,top-.022,z-.06,.40,.016,.055,'#5a6269','solid','tread drainage inset');
}
for(const x of[-190.04,-187.96])post(x,stair.footZ-.18,G+.25,.18);

begin('HOUSING-B102-LANDING','Supported shared landing and upper closed entrance','B102');
const landing={x:-188.8,y:stair.landingY-.10,z:-259.65,sx:7.4,sy:.20,sz:4.3};
box(landing.x,landing.y,landing.z,landing.sx,landing.sy,landing.sz,'#8a7887','metal','walkable landing slab');
box(-188.8,stair.landingY-.28,-261.77,7.4,.38,.25,'#686575','metal','host-wall ledger');
for(const x of[-192.26,-185.34])for(const z of[-260.95,-257.75])post(x,z,stair.landingY-.11,.21);
for(const x of[-192.28,-185.32]){
 box(x,stair.landingY-.30,-259.65,.23,.4,4.3,'#665a6b','metal','landing edge beam');
 for(let i=0;i<8;i++)box(x,stair.landingY+.52,-257.65-i*.55,.11,1.07,.11,'#a7a4a0','metal','landing guard post');
 box(x,stair.landingY+1.08,-259.65,.14,.12,4.3,'#b8ada4','metal','landing handrail');
}
// The front rail ends at the stair opening. No rail crosses its walking line.
for(const[x,w]of[[-191.24,2.08],[-186.67,2.66]]){
 box(x,stair.landingY+1.08,-257.58,w,.12,.14,'#b8ada4','metal','front handrail beside stair');
 for(let i=0;i<5;i++)box(x-w/2+.07+i*(w-.14)/4,stair.landingY+.52,-257.58,.11,1.07,.11,'#a7a4a0','metal','front baluster');
}
// An exterior door is visibly closed: there is no invented walk-through room.
box(-190.0,stair.landingY+1.25,-261.70,2.45,2.5,.26,'#666073','solid','upper entrance masonry surround');
box(-190.0,stair.landingY+1.13,-261.50,1.82,2.23,.14,'#283a49','metal','closed upper residential door');
for(const x of[-191.0,-189.0])box(x,stair.landingY+1.15,-261.45,.16,2.3,.21,'#b09eaa','metal','upper door jamb');
box(-190.0,stair.landingY+2.37,-261.44,2.18,.16,.25,'#b09eaa','metal','upper door lintel');
box(-190.0,stair.landingY+1.51,-261.412,1.51,.71,.044,'#4f737b','window','upper door glass');
box(-189.30,stair.landingY+1.05,-261.32,.055,.4,.18,'#b4b6a3','metal','upper door handle');
box(-190.0,stair.landingY+.065,-261.41,2.10,.13,.42,'#aa9e94','metal','upper door threshold');
apertures.push({hostBuilding:'B102',reason:'Clear the new closed upper entrance of old window ledges',x:-190,y:stair.landingY+1.25,z:-261.4,sx:2.8,sy:2.55,sz:.85});

// Housing B102 reads as two staggered vertical apartment stacks. B103 uses
// three wider, lower ribbons with recessed glazing and side service cupboards.
for(const hostId of['B102','B103']){
 const host=layout.buildings.find(b=>b.id===hostId),side=hostId==='B102'?1:-1,face=host.z+side*host.sz/2;
 begin('HOUSING-'+hostId+'-BAYS',hostId==='B102'?'Staggered apartment window stacks':'Low shared-gallery window ribbons',hostId);
 const rows=hostId==='B102'?[6.3,10.7,15.1,19.5,23.9,28.3]:[5.8,10.3,14.8];
 const centers=hostId==='B102'?[-187.8,-179.8]:[-189,-183.3,-177.6];
 for(let row=0;row<rows.length;row++)for(let column=0;column<centers.length;column++){
  const x=centers[column],base=rows[row]+(hostId==='B102'&&column===1?(row%2)*.65:0),w=hostId==='B102'?(column?4.6:5.6):4.7,h=hostId==='B102'?3.35:2.75,depth=hostId==='B102'?(column?.82:1.12):.80;
  const b=(u,y,v,sx,sy,sz,c,kind,role)=>box(x+u,base+y,face+side*v,sx,sy,sz,c,kind,role);
  b(0,h/2,.07,w,h,.22,'#46505f','solid','bay backplate attached to host');
  for(const s of[-1,1]){
   b(s*(w/2-.10),h/2,depth/2,.20,h,depth,'#8b7d8e','metal','deep bay jamb');
   b(s*(w/4),h/2+.12,.1975,w/2-.43,h-1.0,.055,hostId==='B102'?'#496978':'#638079','window','recessed apartment glazing');
  }
  b(0,.09,depth/2,w+.12,.18,depth+.10,'#b49b9f','metal','bay sill');
  b(0,h-.06,depth/2,w+.16,.18,depth+.12,'#9b8499','metal','bay canopy');
  for(const u of[-w*.17,0,w*.17])b(u,h/2+.12,.30,.085,h-.72,.26,'#afa59f','metal','glazing mullion');
  for(const y of[h*.32,h*.68])b(0,y,depth-.015,w-.36,.075,.10,'#627082','metal','attached sun shade');
  b(w*.30,-.34,.30,w*.30,.65,.61,'#536575','metal','supported service cupboard');
  for(let j=0;j<5;j++)b(w*.30,-.55+j*.10,.624,w*.25,.045,.046,'#89949b','metal','service cupboard louvre');
  b(-w*.33,.3,.34,.20,.33,.44,'#7e6d74','solid','household sill item');
  b(-w*.18,.245,.34,.19,.22,.40,'#727e78','solid','household sill item');
  apertures.push({hostBuilding:hostId,reason:'Recessed grouped bay replaces sparse flat window modules',x,y:base+h/2,z:face+side*.35,sx:w+.2,sy:h+.2,sz:.85});
 }
}

begin('HOUSING-COURT-SEAT-EDGE','Planting edge behind the existing usable resident bench');
box(-159.5,G+.20,-253.55,4.8,.40,.94,'#65726e','solid','grounded seating planter');
box(-159.5,G+.44,-253.55,4.48,.11,.66,'#485846','solid','planter soil');
for(const z of[-253.99,-253.11])box(-159.5,G+.49,z,4.94,.20,.14,'#8b9482','solid','planter coping');
for(const x of[-160.47,-158.53])box(x,.675,-252.93,.12,.12,.58,'#7f8c88','metal','planter tie to existing bench back support');
for(let i=0;i<14;i++){
 const x=-161.56+i*.315,h=.24+(i%4)*.08;
 box(x,G+.56+h/2,-253.55,.07,h+.18,.07,'#697254','solid','grounded shrub stem');
 box(x,G+.55+h,-253.55,.33,.22,.45,i%2?'#657e61':'#4b715f','solid','stepped shrub crown');
}
for(let i=0;i<12;i++)box(-162.26+i*.5,G+.011,-250.35,.38,.022,.08,'#798288','pavement','flush approach marker');

path('HOUSING-ROAD-TO-STAIR',[[-190,G,-244],[-189,G,-247],[-189,G,-250.8]],1.3);
path('HOUSING-STAIR-TO-LANDING',[[-189,G,-250.8],...Array.from({length:16},(_,i)=>[-189,G+(i+1)*.18,-251.74-(i+.5)*.36]),[-189,stair.landingY,-258.3],[-190,stair.landingY,-259.8],[-190,stair.landingY,-260.68]],1.2);
path('HOUSING-LANDING-SHARED-WALK',[[-190,stair.landingY,-260.0],[-186.4,stair.landingY,-260.0],[-186.4,stair.landingY,-258.5],[-189,stair.landingY,-258.5]],1.0);
path('HOUSING-STAIR-TO-EXISTING-SEAT',[[-189,G,-250.8],[-182,G,-250.8],[-182,G,-249],[-173,G,-249],[-173,G,-251.15],[-159.5,G,-251.15]],1.1);

const byId=new Map(boxes.map(b=>[b.id,b])),supports=[],supportGraphs=[];
const structuralRoles=/tread|foundation|support column|stringer|baluster|handrail|slab|ledger|beam|guard post|backplate|jamb|sill$|canopy$|grounded seating planter|planter coping|planter tie/;
for(const assembly of assemblies){
 const members=assembly.boxIds.map(id=>byId.get(id)),bounds=members.map(extent),connected=new Set(),roots=[],edges=[];
 assembly.chunk='block-15';assembly.hostBuildings=assembly.hostBuilding?[assembly.hostBuilding]:[];assembly.supportIds=[];
 assembly.bounds={minX:Math.min(...bounds.map(b=>b.minX)),maxX:Math.max(...bounds.map(b=>b.maxX)),minY:Math.min(...bounds.map(b=>b.minY)),maxY:Math.max(...bounds.map(b=>b.maxY)),minZ:Math.min(...bounds.map(b=>b.minZ)),maxZ:Math.max(...bounds.map(b=>b.maxZ))};
 const host=layout.buildings.find(b=>b.id===assembly.hostBuilding),sections=host?.sections||[];
 for(const b of members){
  const q=extent(b);
  if(q.minY<=G+.0005){connected.add(b.id);roots.push({id:b.id,attachedTo:'GROUND',anchor:{x:b.x,y:G,z:b.z}});}
  else if(sections.some(s=>contact(q,extent(s)))){connected.add(b.id);roots.push({id:b.id,attachedTo:host.id,anchor:{x:b.x,y:b.y,z:host.id==='B102'?-261.8:-218.2}});}
  if(structuralRoles.test(b.role)){
   const id='SUP-'+b.id;assembly.supportIds.push(id);
   supports.push({id,sourceBoxId:b.id,x:b.x,y:b.y,z:b.z,sx:b.sx,sy:b.sy,sz:b.sz,ry:b.ry,baseY:q.minY,role:b.role,attachedTo:b.attachedTo,chunk:b.chunk});
  }
 }
 let change=true;while(change){change=false;for(const b of members)if(!connected.has(b.id)){const parent=members.find(o=>connected.has(o.id)&&contact(extent(b),extent(o)));if(parent){connected.add(b.id);edges.push({from:b.id,to:parent.id,connection:'physical voxel contact'});change=true;}}}
 if(connected.size!==members.length)throw new Error('Detached housing member in '+assembly.id);
 const externalContacts=[];
 if(assembly.id==='HOUSING-COURT-SEAT-EDGE')for(const b of members)for(const bench of layout.boxes.filter(b=>b.assemblyId==='COURT-15-SEAT-SOUTH'))if(contact(extent(b),extent(bench)))externalContacts.push({from:b.id,to:bench.id,connection:'physical bench/planter contact'});
 if(assembly.id==='HOUSING-COURT-SEAT-EDGE'&&externalContacts.length<2)throw new Error('Housing planter lost its retained bench connection');
 supportGraphs.push({id:assembly.id,hostBuilding:assembly.hostBuilding||null,members:members.length,roots,edges,externalContacts,connected:connected.size});
}
const upperColliders=boxes.filter(b=>['solid','metal'].includes(b.kind)&&b.y-b.sy/2>=5.5).map(b=>({...b,id:'COLLIDER-'+b.id,sourceBoxId:b.id}));
const replacements=EXPECTED_REPLACEMENTS.map((r,i)=>({sourceIndex:r.sourceIndex,original:copy(r.original),boxId:boxes[i].id,reason:r.reason}));
const removedSupportIds=new Set(replacements.map(r=>r.original.supportId).filter(Boolean));
return{version:VERSION,coordinates:'Three.js metres, Y up',groundY:G,stairs:stair,landing,boxes,assemblies,supports,supportGraphs,paths:paths.map(p=>({...p,label:p.id.replaceAll('-',' '),clearHeight:2.3})),apertures,replacements,upperColliders,
 sourceBoxCount:layout.boxes.length,addedVoxelModules:boxes.length,replacedSourceRecords:replacements.length,removedAssemblyIds:[...OLD_BAY_IDS],
 replacedAssemblies:copy(layout.blockCompositions.assemblies.filter(a=>OLD_BAY_IDS.has(a.id))),replacedSupports:copy(layout.supports.filter(s=>removedSupportIds.has(s.id))),
 entrances:[{id:'HOUSING-B102-UPPER-ENTRY',hostBuilding:'B102',assemblyId:'HOUSING-B102-LANDING',closed:true,levelY:stair.landingY,target:{x:-190,y:stair.landingY+1.55,z:-261.19},inspectionVantage:{x:-190,y:stair.landingY+1.75,z:-259.8},approach:{x:-190,y:stair.landingY,z:-260.15,sx:2.1,sz:1.2},normal:{x:0,y:0,z:1}}],
 movementContract:{radius:.4,eyeHeight:1.75,bodyHeight:1.9,stepHeight:.30,stairRise:.18,baseGroundUnchanged:true,civilianLevels:'Existing ground-level routes only; this recipe does not route civilians upstairs.'}};
}

/** Opt-in, source-validated application. All recipe validation precedes mutation. */
export function applyHousingCompositions(layout){
 const housing=createHousingComposition(layout),boxes=layout.boxes.slice();
 for(const r of housing.replacements)boxes[r.sourceIndex]=housing.boxes.find(b=>b.id===r.boxId);
 boxes.push(...housing.boxes.slice(housing.replacements.length));
 const oldSupportIds=new Set(housing.replacements.map(r=>r.original.supportId).filter(Boolean));
 const retained=layout.blockCompositions.assemblies.filter(a=>!OLD_BAY_IDS.has(a.id));
 const blockCompositions={...layout.blockCompositions,
  assemblies:[...retained,...housing.assemblies],
  paths:[...layout.blockCompositions.paths,...housing.paths],
  entrances:[...layout.blockCompositions.entrances,...housing.entrances],
  // Preserve the first-pass tree/stall replacement history verbatim.
  housingReplacements:housing.replacements,
  addedVoxelModules:layout.blockCompositions.addedVoxelModules-32+housing.addedVoxelModules,
  replacedSourceRecords:layout.blockCompositions.replacedSourceRecords+housing.replacedSourceRecords};
 layout.boxes=boxes;
 layout.colliders=[...layout.colliders,...housing.upperColliders];
 layout.supports=[...layout.supports.filter(s=>!oldSupportIds.has(s.id)),...housing.supports];
 layout.blueprint.supports=[...layout.blueprint.supports.filter(s=>!oldSupportIds.has(s.id)),...housing.supports];
 layout.blockCompositions=blockCompositions;
 layout.housingCompositions=housing;
 layout.blueprint.blockCompositions=blockCompositions;
 layout.blueprint.housingCompositions=housing;
 return layout;
}
