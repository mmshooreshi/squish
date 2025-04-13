import { createCanvas, imageDataToCanvas } from './canvas';

interface ExtendedResizeOptions {
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
  method?: 'default'; 
  premultiplyAlpha?: boolean;
  linearRGB?: boolean;
}

export function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  options: ExtendedResizeOptions
): { width: number; height: number } {
  const { width: targetW = 0, height: targetH = 0, maintainAspectRatio = true } = options;

  if (targetW <= 0 && targetH <= 0) {
    return { width: originalWidth, height: originalHeight };
  }

  if (maintainAspectRatio) {
    const origRatio = originalWidth / originalHeight;
    if (targetW > 0 && targetH <= 0) {
      return { width: targetW, height: Math.round(targetW / origRatio) };
    } else if (targetH > 0 && targetW <= 0) {
      return { width: Math.round(targetH * origRatio), height: targetH };
    } else {
      // Both are set
      return { width: targetW, height: targetH };
    }
  }
  return { width: targetW || originalWidth, height: targetH || originalHeight };
}

export function resizeImage(imageData: ImageData, options: ExtendedResizeOptions): ImageData {
  const sourceCanvas = imageDataToCanvas(imageData);
  const { width, height } = calculateDimensions(
    imageData.width,
    imageData.height,
    options
  );

  const destCanvas = createCanvas(width, height);
  const ctx = destCanvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, width, height);

  return ctx.getImageData(0, 0, width, height);
}
