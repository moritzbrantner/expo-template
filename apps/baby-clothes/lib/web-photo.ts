const WEB_PHOTO_MAX_EDGE = 1024;
const WEB_PHOTO_QUALITY = 0.75;
export const WEB_PHOTO_MAX_DATA_URI_LENGTH = 600_000;

/**
 * Browser storage (AsyncStorage on web is localStorage) has a small quota, so
 * web photos are downscaled and re-encoded before they are kept inline.
 */
export async function downscaleWebPhotoDataUri(
  dataUri: string,
  maxEdge = WEB_PHOTO_MAX_EDGE,
): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('The selected web image could not be read.'));
    element.src = dataUri;
  });

  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight, 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('The selected web image could not be resized.');
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const resized = canvas.toDataURL('image/jpeg', WEB_PHOTO_QUALITY);

  if (resized.length > WEB_PHOTO_MAX_DATA_URI_LENGTH) {
    throw new Error('The selected web image is too large to keep in browser storage.');
  }
  return resized;
}
