/**
 * Resizes and crops an image in the browser and returns a JPEG data URL, so uploads need no storage service.
 * Avatars: 320×320. Banners: 1500×375 (LinkedIn's 4:1 ratio).
 */
export async function resizeImage(file: File, width: number, height: number, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  // Cover-crop: scale to fill, then centre.
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  context.drawImage(bitmap, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  return canvas.toDataURL("image/jpeg", quality);
}

export const AVATAR_SIZE = { width: 320, height: 320 };
export const BANNER_SIZE = { width: 1500, height: 375 };
export const POST_IMAGE_SIZE = { width: 1200, height: 675 };
