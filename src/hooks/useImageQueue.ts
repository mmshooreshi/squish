import { useCallback } from 'react';
import type { ImageFile, OutputType, CompressionOptions, ResizeOptions } from '../types';
import { getFileType, decode, encode } from '../utils/imageProcessing';
import { resizeImage } from '../utils/resize';

export function useImageQueue(
  compressionOptions: CompressionOptions,
  outputType: OutputType,
  setImages: React.Dispatch<React.SetStateAction<ImageFile[]>>,
  resizeOptions: ResizeOptions
) {
  // Directly process an image on the main thread.
  const processImage = useCallback(async (image: ImageFile) => {
    if (image.status !== 'pending') return;
    setImages((prev) =>
      prev.map((img) =>
        img.id === image.id
          ? { ...img, status: 'processing', progress: 0, startTime: Date.now() }
          : img
      )
    );
    try {
      const fileBuffer = await image.file.arrayBuffer();
      const sourceType = getFileType(image.file);
      // Decode image
      const imageData = await decode(sourceType, fileBuffer);
      setImages((prev) =>
        prev.map((img) =>
          img.id === image.id ? { ...img, progress: 50 } : img
        )
      );
      
      // Resize if enabled
      const finalData = resizeOptions && resizeOptions.enabled
        ? resizeImage(imageData, resizeOptions)
        : imageData;

      // Encode image
      const compressedBuffer = await encode(outputType, finalData, compressionOptions);
      const blob = new Blob([compressedBuffer], { type: `image/${outputType}` });
      const preview = URL.createObjectURL(blob);

      setImages((prev) =>
        prev.map((img) =>
          img.id === image.id
            ? {
                ...img,
                status: 'complete',
                progress: 100,
                blob,
                preview,
                compressedSize: compressedBuffer.byteLength,
                outputType,
              }
            : img
        )
      );
    } catch (e) {
      alert(`Processing error for ${image.file.name}: ${e instanceof Error ? e.message : String(e)}`);
      setImages((prev) =>
        prev.map((img) =>
          img.id === image.id
            ? { ...img, status: 'error', error: e instanceof Error ? e.message : String(e) }
            : img
        )
      );
    }
  }, [compressionOptions, outputType, resizeOptions, setImages]);

  // Instead of using a queue, immediately process the image
  const addToQueue = useCallback((imageId: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === imageId);
      if (image) {
        processImage(image);
      }
      return prev;
    });
  }, [processImage, setImages]);

  return { addToQueue };
}
