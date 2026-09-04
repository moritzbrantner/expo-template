import type { PhotoAsset, RuntimeCapabilities } from './types';

function demoUri(label: string, background: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700">
    <rect width="900" height="700" fill="${background}"/>
    <circle cx="450" cy="270" r="120" fill="rgba(255,255,255,.72)"/>
    <rect x="260" y="420" width="380" height="180" rx="90" fill="rgba(255,255,255,.62)"/>
    <text x="450" y="650" text-anchor="middle" font-family="sans-serif" font-size="42" fill="rgba(0,0,0,.58)">${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 4);

const DEMO = [
  ['anna-1', 'Anna · garden', '#b7c8a6', 0],
  ['ben-1', 'Ben · station', '#adc7d8', 1],
  ['anna-2', 'Anna · afternoon', '#d7c2ae', 2],
  ['cara-1', 'Cara · lake', '#9ebdc1', 3],
  ['ben-2', 'Ben · coffee', '#c6b29e', 7],
  ['anna-3', 'Anna · museum', '#c6c0d8', 9],
  ['cara-2', 'Cara · walk', '#b9cdb0', 11],
  ['ben-3', 'Ben · evening', '#c1b7a5', 34],
  ['anna-4', 'Anna · old town', '#d4b8b8', 38],
] as const;

export async function requestPhotoAccess() {
  return { granted: true, limited: false };
}

export async function loadPhotoAssets(limit = 200): Promise<PhotoAsset[]> {
  return DEMO.slice(0, limit).map(([id, label, background, age]) => ({
    id: `demo-${id}`,
    uri: demoUri(label, background),
    filename: `${id}.jpg`,
    width: 900,
    height: 700,
    createdAt: NOW - age * DAY,
  }));
}

export function runtimeCapabilities(): RuntimeCapabilities {
  return {
    nativePeopleDetection: false,
    label: 'Portfolio preview',
    detail: 'This web build uses labelled example photos. Native builds run the real on-device models.',
  };
}
