import { useCallback } from 'react';
import type { ImageFile, OutputType, CompressionOptions, ResizeOptions } from '../types';
import { getFileType, decode, encode } from '../utils/imageProcessing';
import { resizeImage } from '../utils/resize';

function yieldControl(delay = 10): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delay));
}

export function useImageQueue(
  compressionOptions: CompressionOptions,
  outputType: OutputType,
  setImages: React.Dispatch<React.SetStateAction<ImageFile[]>>,
  resizeOptions: ResizeOptions
) {
  // Process a single image
  const processImage = useCallback(async (image: ImageFile) => {
    if (image.status !== 'pending') return; // Avoid re-processing
    setImages(prev =>
      prev.map(img =>
        img.id === image.id
          ? { ...img, status: 'processing', progress: 0, startTime: Date.now() }
          : img
      )
    );
    try {
      // 1. Get file buffer
      const fileBuffer = await image.file.arrayBuffer();
      await yieldControl(10);
      
      // 2. Determine source type
      const sourceType = getFileType(image.file);
      await yieldControl(10);
      
      // 3. Decode image
      const imageData = await decode(sourceType, fileBuffer);
      setImages(prev =>
        prev.map(img =>
          img.id === image.id ? { ...img, progress: 33 } : img
        )
      );
      await yieldControl(10);
      
      // 4. If resize is enabled, perform resize
      let finalData = imageData;
      if (resizeOptions && resizeOptions.enabled) {
        finalData = await resizeImage(imageData, resizeOptions);
        setImages(prev =>
          prev.map(img =>
            img.id === image.id ? { ...img, progress: 66 } : img
          )
        );
        await yieldControl(10);
      }
      
      // 5. Encode image
      const compressedBuffer = await encode(outputType, finalData, compressionOptions);
      setImages(prev =>
        prev.map(img =>
          img.id === image.id ? { ...img, progress: 90 } : img
        )
      );
      await yieldControl(10);
      
      // 6. Create blob & update image info
      const blob = new Blob([compressedBuffer], { type: `image/${outputType}` });
      const preview = URL.createObjectURL(blob);
      setImages(prev =>
        prev.map(img =>
          img.id === image.id
            ? {
                ...img,
                status: 'complete',
                progress: 100,
                blob,
                preview,
                compressedSize: compressedBuffer.byteLength,
                outputType
              }
            : img
        )
      );
    } catch (e) {
      alert(`Error processing ${image.file.name}: ${e instanceof Error ? e.message : String(e)}`);
      setImages(prev =>
        prev.map(img =>
          img.id === image.id
            ? { ...img, status: 'error', error: e instanceof Error ? e.message : String(e) }
            : img
        )
      );
    }
  }, [compressionOptions, outputType, resizeOptions, setImages]);

  // Directly add the image to processing (no queue delays)
  const addToQueue = useCallback((imageId: string) => {
    setImages(prev => {
      const image = prev.find(img => img.id === imageId);
      if (image && image.status === 'pending') {
        processImage(image);
      }
      return prev;
    });
  }, [processImage, setImages]);

  return { addToQueue };
}
