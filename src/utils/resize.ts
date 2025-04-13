import { createCanvas, imageDataToCanvas } from './canvas';

interface ExtendedResizeOptions {
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
  method?: 'lanczos3'; // currently fixed
  premultiplyAlpha?: boolean;
  linearRGB?: boolean;
}

export function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  options: ExtendedResizeOptions
): { width: number; height: number } {
  const { width: targetWidth = 0, height: targetHeight = 0, maintainAspectRatio = true } = options;

  if (!targetWidth && !targetHeight) {
    return { width: originalWidth, height: originalHeight };
  }

  let finalWidth = targetWidth || originalWidth;
  let finalHeight = targetHeight || originalHeight;

  if (maintainAspectRatio) {
    const aspectRatio = originalWidth / originalHeight;

    if (targetWidth && !targetHeight) {
      finalWidth = targetWidth;
      finalHeight = Math.round(targetWidth / aspectRatio);
    } else if (!targetWidth && targetHeight) {
      finalHeight = targetHeight;
      finalWidth = Math.round(targetHeight * aspectRatio);
    } else {
      const widthRatio = targetWidth / originalWidth;
      const heightRatio = targetHeight / originalHeight;
      const ratio = Math.min(widthRatio, heightRatio);

      finalWidth = Math.round(originalWidth * ratio);
      finalHeight = Math.round(originalHeight * ratio);
    }
  }

  return {
    width: Math.max(1, finalWidth),
    height: Math.max(1, finalHeight),
  };
}

export function resizeImage(imageData: ImageData, options: ExtendedResizeOptions): ImageData {
  const sourceCanvas = imageDataToCanvas(imageData);
  const { width, height } = calculateDimensions(imageData.width, imageData.height, options);

  const destCanvas = createCanvas(width, height);
  const ctx = destCanvas.getContext('2d')!;

  // Use high-quality scaling.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Note: The Canvas API does not expose the Lanczos3 algorithm or premultiply/linearRGB controls.
  // These options are kept for documentation/future implementation.
  ctx.drawImage(sourceCanvas, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}
