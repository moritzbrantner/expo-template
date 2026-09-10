import type { BabyClothingEntry } from './clothing';

type PreviewGarmentKind = 'bodysuit' | 'sleeper' | 'cardigan' | 'leggings';

const PREVIEW_TIME = '2026-09-10T00:00:00.000Z';

function garmentArtwork(kind: PreviewGarmentKind, primary: string, accent: string) {
  switch (kind) {
    case 'bodysuit':
      return `
        <path d="M250 205 185 260l38 72 45-29v250l92 76 92-76V303l45 29 38-72-65-55-63 37H313z" fill="${primary}"/>
        <path d="M313 242c8 40 86 40 94 0" fill="none" stroke="${accent}" stroke-width="15" stroke-linecap="round"/>
        <path d="M300 535h120l-60 55z" fill="${accent}" opacity=".55"/>
      `;
    case 'sleeper':
      return `
        <path d="M265 188 195 248l45 74 42-28v238l-42 138h73l47-100 47 100h73l-42-138V294l42 28 45-74-70-60-51 34h-48z" fill="${primary}"/>
        <path d="M360 222v348" stroke="${accent}" stroke-width="12" stroke-linecap="round" opacity=".8"/>
        <circle cx="360" cy="312" r="8" fill="${accent}"/>
        <circle cx="360" cy="360" r="8" fill="${accent}"/>
        <circle cx="360" cy="408" r="8" fill="${accent}"/>
      `;
    case 'cardigan':
      return `
        <path d="M275 205 175 275l45 87 64-35v284h152V327l64 35 45-87-100-70-51 34h-68z" fill="${primary}"/>
        <path d="M360 239v372" stroke="${accent}" stroke-width="10" opacity=".75"/>
        <circle cx="360" cy="326" r="9" fill="${accent}"/>
        <circle cx="360" cy="380" r="9" fill="${accent}"/>
        <circle cx="360" cy="434" r="9" fill="${accent}"/>
        <circle cx="360" cy="488" r="9" fill="${accent}"/>
      `;
    case 'leggings':
      return `
        <path d="M270 205h180l-18 185-40 258h-76l18-258-40 258h-76l40-258z" fill="${primary}"/>
        <rect x="270" y="205" width="180" height="38" rx="18" fill="${accent}" opacity=".75"/>
        <path d="M334 390h52" stroke="${accent}" stroke-width="8" stroke-linecap="round" opacity=".45"/>
      `;
  }
}

function previewPhotoUri(
  kind: PreviewGarmentKind,
  background: string,
  primary: string,
  accent: string,
) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="840" viewBox="0 0 720 840">
    <rect width="720" height="840" rx="42" fill="${background}"/>
    <ellipse cx="360" cy="688" rx="196" ry="34" fill="rgba(50,45,38,.10)"/>
    <g>${garmentArtwork(kind, primary, accent)}</g>
    <text x="360" y="780" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" font-weight="700" letter-spacing="2" fill="rgba(44,40,35,.48)">SYNTHETIC PREVIEW</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function previewPhoto(
  id: string,
  kind: PreviewGarmentKind,
  background: string,
  primary: string,
  accent: string,
) {
  return {
    id: `preview-photo-${id}`,
    uri: previewPhotoUri(kind, background, primary, accent),
    kind: 'inline-data' as const,
    createdAt: PREVIEW_TIME,
  };
}

export const BABY_CLOTHING_PREVIEW_ENTRIES: readonly BabyClothingEntry[] = [
  {
    id: 'preview-blue-bodysuit',
    name: 'Blue wrap bodysuit',
    category: 'bodysuit',
    brand: 'Preview',
    color: 'blue',
    originalSizeLabel: '56',
    normalizedSize: { minCm: 50, maxCm: 56 },
    entryType: 'single',
    quantity: 1,
    status: 'in-use',
    photos: [previewPhoto('blue-bodysuit', 'bodysuit', '#e6edf0', '#718da3', '#f6f2e9')],
    notes: 'Example garment shown only in the browser preview.',
    createdAt: PREVIEW_TIME,
    updatedAt: PREVIEW_TIME,
  },
  {
    id: 'preview-cream-sleeper',
    name: 'Cream footed sleeper',
    category: 'sleeper',
    brand: 'Preview',
    color: 'cream',
    originalSizeLabel: '62',
    normalizedSize: { minCm: 56, maxCm: 62 },
    entryType: 'single',
    quantity: 1,
    status: 'stored',
    photos: [previewPhoto('cream-sleeper', 'sleeper', '#eee9df', '#d8cbb6', '#98836a')],
    notes: 'A second synthetic image makes fit and color comparisons visible at a glance.',
    createdAt: PREVIEW_TIME,
    updatedAt: PREVIEW_TIME,
  },
  {
    id: 'preview-sage-cardigans',
    name: 'Sage knit cardigans',
    category: 'outerwear',
    brand: 'Preview',
    color: 'sage',
    originalSizeLabel: '62/68',
    normalizedSize: { minCm: 62, maxCm: 68 },
    entryType: 'group',
    quantity: 2,
    status: 'too-large',
    photos: [previewPhoto('sage-cardigan', 'cardigan', '#e5ebe4', '#8ca08b', '#e9dfca')],
    notes: 'Grouped pieces demonstrate how identical clothes compare with individual garments.',
    createdAt: PREVIEW_TIME,
    updatedAt: PREVIEW_TIME,
  },
  {
    id: 'preview-rust-leggings',
    name: 'Rust leggings',
    category: 'bottom',
    brand: 'Preview',
    color: 'rust',
    originalSizeLabel: '68',
    normalizedSize: { minCm: 62, maxCm: 68 },
    entryType: 'single',
    quantity: 1,
    status: 'dirty',
    photos: [previewPhoto('rust-leggings', 'leggings', '#f0e6df', '#b87559', '#6f5145')],
    notes: 'Synthetic preview data never enters the saved local inventory.',
    createdAt: PREVIEW_TIME,
    updatedAt: PREVIEW_TIME,
  },
];
