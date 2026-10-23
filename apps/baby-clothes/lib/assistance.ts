import {
  BABY_CLOTHING_SIZE_PRESETS,
  normalizeBabyClothingText,
  type BabyClothingSizeRange,
} from './clothing';

export const BABY_CLOTHING_SUGGESTED_COLORS = [
  'black',
  'white',
  'gray',
  'beige',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
] as const;

export type BabyClothingSuggestedColor = (typeof BABY_CLOTHING_SUGGESTED_COLORS)[number];

export type BabyClothingColorSuggestion = {
  color: BabyClothingSuggestedColor;
  strength: 'strong' | 'moderate';
};

export type BabyClothingSizeSuggestion = {
  range: BabyClothingSizeRange;
  basis: 'printed-range' | 'single-height' | 'month-range' | 'single-month';
};

const MONTH_HEIGHTS = new Map<number, number>([
  [0, 50],
  [1, 56],
  [3, 62],
  [6, 68],
  [9, 74],
  [12, 80],
  [18, 86],
  [24, 92],
  [36, 98],
]);

function normalizedSizeLabel(value: string) {
  return normalizeBabyClothingText(value)
    .toLocaleLowerCase()
    .replace(/[–—−]/gu, '-')
    .replace(/\s+/gu, ' ');
}

function validHeightRange(minCm: number, maxCm: number): BabyClothingSizeRange | null {
  if (
    !Number.isSafeInteger(minCm) ||
    !Number.isSafeInteger(maxCm) ||
    minCm < 30 ||
    maxCm > 160 ||
    minCm > maxCm
  ) {
    return null;
  }
  return { minCm, maxCm };
}

function previousMonthHeight(month: number) {
  const entries = [...MONTH_HEIGHTS.entries()].filter(([candidate]) => candidate < month);
  if (entries.length === 0) {
    return null;
  }
  return entries[entries.length - 1]?.[1] ?? null;
}

export function suggestNormalizedBabyClothingSize(
  printedLabel: string,
): BabyClothingSizeSuggestion | null {
  const label = normalizedSizeLabel(printedLabel);
  if (!label) {
    return null;
  }

  const heightRange = label.match(/^(?:eu\s*)?(\d{2,3})\s*[-/]\s*(\d{2,3})(?:\s*cm)?$/u);
  if (heightRange) {
    const range = validHeightRange(Number(heightRange[1]), Number(heightRange[2]));
    return range ? { range, basis: 'printed-range' } : null;
  }

  const monthRange = label.match(
    /^(\d{1,2})\s*[-/]\s*(\d{1,2})\s*(?:m|mo|mos|month|months)$/u,
  );
  if (monthRange) {
    const minCm = MONTH_HEIGHTS.get(Number(monthRange[1]));
    const maxCm = MONTH_HEIGHTS.get(Number(monthRange[2]));
    if (minCm !== undefined && maxCm !== undefined && minCm <= maxCm) {
      return { range: { minCm, maxCm }, basis: 'month-range' };
    }
    return null;
  }

  const singleHeight = label.match(/^(?:eu\s*)?(\d{2,3})(?:\s*cm)?$/u);
  if (singleHeight) {
    const height = Number(singleHeight[1]);
    const preset =
      BABY_CLOTHING_SIZE_PRESETS.find((candidate) => candidate.maxCm === height) ??
      BABY_CLOTHING_SIZE_PRESETS.find((candidate) => candidate.minCm === height);
    if (!preset) {
      return null;
    }
    return {
      range: { minCm: preset.minCm, maxCm: preset.maxCm },
      basis: 'single-height',
    };
  }

  const singleMonth = label.match(/^(\d{1,2})\s*(?:m|mo|mos|month|months)$/u);
  if (singleMonth) {
    const month = Number(singleMonth[1]);
    const maxCm = MONTH_HEIGHTS.get(month);
    const minCm = previousMonthHeight(month);
    if (maxCm !== undefined && minCm !== null && minCm <= maxCm) {
      return { range: { minCm, maxCm }, basis: 'single-month' };
    }
  }

  return null;
}

export function babyClothingSizeSuggestionExplanation(suggestion: BabyClothingSizeSuggestion) {
  switch (suggestion.basis) {
    case 'printed-range':
      return 'Matches the centimetre range printed on the label.';
    case 'single-height':
      return 'Interprets the printed height as a standard baby-clothes fit range.';
    case 'month-range':
    case 'single-month':
      return 'Age labels vary by brand; this is only a rough age-to-height suggestion.';
  }
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  let hue = 0;
  if (delta !== 0) {
    if (max === r) {
      hue = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      hue = 60 * ((b - r) / delta + 2);
    } else {
      hue = 60 * ((r - g) / delta + 4);
    }
  }
  if (hue < 0) {
    hue += 360;
  }

  return { hue, saturation, lightness };
}

export function classifyBabyClothingRgb(
  red: number,
  green: number,
  blue: number,
): BabyClothingSuggestedColor {
  const { hue, saturation, lightness } = rgbToHsl(red, green, blue);

  if (lightness <= 0.18) {
    return 'black';
  }
  if (lightness >= 0.9 && saturation <= 0.16) {
    return 'white';
  }
  if (saturation <= 0.12) {
    return 'gray';
  }
  if (hue >= 24 && hue < 58 && lightness >= 0.56 && saturation <= 0.68) {
    return 'beige';
  }
  if (hue >= 15 && hue < 48 && lightness < 0.48) {
    return 'brown';
  }
  if ((hue >= 335 || hue < 15) && lightness >= 0.64) {
    return 'pink';
  }
  if (hue >= 300 && hue < 335 && lightness >= 0.56) {
    return 'pink';
  }
  if (hue >= 345 || hue < 15) {
    return 'red';
  }
  if (hue < 45) {
    return 'orange';
  }
  if (hue < 70) {
    return 'yellow';
  }
  if (hue < 170) {
    return 'green';
  }
  if (hue < 260) {
    return 'blue';
  }
  return 'purple';
}

const NEUTRAL_COLORS = new Set<BabyClothingSuggestedColor>(['black', 'white', 'gray']);

export function suggestBabyClothingColorFromPixels(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
): BabyClothingColorSuggestion | null {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    return null;
  }
  if (rgba.length < width * height * 4) {
    return null;
  }

  const counts = new Map<BabyClothingSuggestedColor, number>();
  let samples = 0;
  const xStart = Math.floor(width * 0.1);
  const xEnd = Math.max(xStart + 1, Math.ceil(width * 0.9));
  const yStart = Math.floor(height * 0.1);
  const yEnd = Math.max(yStart + 1, Math.ceil(height * 0.9));

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = Number(rgba[index + 3]);
      if (!Number.isFinite(alpha) || alpha < 128) {
        continue;
      }
      const color = classifyBabyClothingRgb(
        Number(rgba[index]),
        Number(rgba[index + 1]),
        Number(rgba[index + 2]),
      );
      counts.set(color, (counts.get(color) ?? 0) + 1);
      samples += 1;
    }
  }

  if (samples === 0) {
    return null;
  }

  const chromatic = [...counts.entries()].filter(([color]) => !NEUTRAL_COLORS.has(color));
  const chromaticSamples = chromatic.reduce((sum, [, count]) => sum + count, 0);
  const candidates = chromaticSamples >= Math.max(16, samples * 0.08) ? chromatic : [...counts.entries()];
  candidates.sort(([leftColor, leftCount], [rightColor, rightCount]) =>
    rightCount - leftCount || leftColor.localeCompare(rightColor),
  );
  const winner = candidates[0];
  if (!winner) {
    return null;
  }

  const relevantSamples = candidates.reduce((sum, [, count]) => sum + count, 0);
  return {
    color: winner[0],
    strength: winner[1] / relevantSamples >= 0.55 ? 'strong' : 'moderate',
  };
}
