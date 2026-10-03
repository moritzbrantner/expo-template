import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  babyClothingSizeSuggestionExplanation,
  classifyBabyClothingRgb,
  suggestBabyClothingColorFromPixels,
  suggestNormalizedBabyClothingSize,
} from './assistance';

function solidPixels(width: number, height: number, color: readonly [number, number, number]) {
  const pixels = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 4] = color[0];
    pixels[index * 4 + 1] = color[1];
    pixels[index * 4 + 2] = color[2];
    pixels[index * 4 + 3] = 255;
  }
  return pixels;
}

describe('baby clothing metadata assistance', () => {
  test('suggests normalized centimetre evidence without changing the printed label', () => {
    assert.deepEqual(suggestNormalizedBabyClothingSize('50/56'), {
      range: { minCm: 50, maxCm: 56 },
      basis: 'printed-range',
    });
    assert.deepEqual(suggestNormalizedBabyClothingSize('62'), {
      range: { minCm: 56, maxCm: 62 },
      basis: 'single-height',
    });
    assert.deepEqual(suggestNormalizedBabyClothingSize('0–3M'), {
      range: { minCm: 50, maxCm: 62 },
      basis: 'month-range',
    });
    assert.deepEqual(suggestNormalizedBabyClothingSize('6-9 months'), {
      range: { minCm: 68, maxCm: 74 },
      basis: 'month-range',
    });
  });

  test('refuses labels that do not map conservatively', () => {
    assert.equal(suggestNormalizedBabyClothingSize('tiny-ish'), null);
    assert.equal(suggestNormalizedBabyClothingSize('2T'), null);
    assert.equal(suggestNormalizedBabyClothingSize('5-7 months'), null);
  });

  test('marks month-based suggestions as a brand-dependent heuristic', () => {
    const suggestion = suggestNormalizedBabyClothingSize('3-6M');
    assert.ok(suggestion);
    assert.match(babyClothingSizeSuggestionExplanation(suggestion), /vary by brand/u);
  });

  test('maps representative RGB values to stable coarse clothing colors', () => {
    assert.equal(classifyBabyClothingRgb(20, 35, 180), 'blue');
    assert.equal(classifyBabyClothingRgb(238, 218, 178), 'beige');
    assert.equal(classifyBabyClothingRgb(245, 175, 195), 'pink');
    assert.equal(classifyBabyClothingRgb(25, 25, 25), 'black');
  });

  test('derives a deterministic color suggestion from local pixels', () => {
    assert.deepEqual(suggestBabyClothingColorFromPixels(solidPixels(20, 20, [25, 80, 210]), 20, 20), {
      color: 'blue',
      strength: 'strong',
    });
  });

  test('prefers meaningful garment color over a mostly neutral photo background', () => {
    const width = 20;
    const height = 20;
    const pixels = solidPixels(width, height, [245, 245, 245]);

    for (let y = 6; y < 14; y += 1) {
      for (let x = 6; x < 14; x += 1) {
        const index = (y * width + x) * 4;
        pixels[index] = 40;
        pixels[index + 1] = 110;
        pixels[index + 2] = 220;
      }
    }

    assert.equal(suggestBabyClothingColorFromPixels(pixels, width, height)?.color, 'blue');
  });
});
