export type Vector3 = readonly [number, number, number];

export type ReconstructionEvidence = {
  kind: 'technical-demo' | 'sourced';
  note: string;
};

export type ReconstructionSite = {
  id: string;
  name: string;
  periodLabel: string;
  viewingPoint: {
    title: string;
    instructions: string;
  };
  calibration: {
    position: Vector3;
    rotation: Vector3;
    scale: Vector3;
  };
  evidence: ReconstructionEvidence;
};

export const HORIZON_ONE_SITE: ReconstructionSite = {
  id: 'horizon-one-calibration-facade',
  name: 'Field calibration demo',
  periodLabel: 'Technical reconstruction fixture',
  viewingPoint: {
    title: 'Marked viewing point',
    instructions:
      'Stand on the configured viewing point, hold the phone upright, face the façade squarely, then start the aligned view.',
  },
  calibration: {
    position: [0, -1.25, -6],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  },
  evidence: {
    kind: 'technical-demo',
    note: 'This procedural façade validates registration and blending only. It is not a historical claim about a real building.',
  },
};

export function calibrationSummary(site: ReconstructionSite) {
  const format = (value: Vector3) => value.map((part) => part.toFixed(2)).join(', ');

  return `P ${format(site.calibration.position)} · R ${format(site.calibration.rotation)} · S ${format(site.calibration.scale)}`;
}
