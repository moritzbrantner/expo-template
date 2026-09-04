// TypeScript fallback for repository-wide checks. Metro selects device.native.ts or device.web.ts.
export { loadPhotoAssets, requestPhotoAccess, runtimeCapabilities } from './device.web';
