export function clampBlend(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

export function blendLabel(value: number) {
  return `${Math.round(clampBlend(value) * 100)}% past`;
}
