import { useState, useEffect, useRef, useCallback } from 'react';
import type { ImageFile, OutputType, CompressionOptions, ResizeOptions } from '../types';
import { getFileType } from '../utils/imageProcessing';

interface WorkerResponse {
  id: string;
  success: boolean;
  compressedBuffer?: ArrayBuffer;
  error?: string;
  outputType?: string;
  progress?: number;
}

export function useImageQueue(
  compressionOptions: CompressionOptions,
  outputType: OutputType,
  setImages: React.Dispatch<React.SetStateAction<ImageFile[]>>,
  resizeOptions: ResizeOptions,
  processLevel: number
) {
  const MAX_POOL_SIZE = 4;
  const workerPoolRef = useRef<Worker[]>([]);
  const roundRobinIndex = useRef(0);
  const [queue, setQueue] = useState<string[]>([]);

  const messageHandler = useCallback(
    (event: MessageEvent<WorkerResponse>) => {
      const { id, success, compressedBuffer, error, outputType, progress } = event.data;
      if (progress !== undefined) {
        setImages(prev =>
          prev.map(img => (img.id === id ? { ...img, progress } : img))
        );
      }
      if (success && compressedBuffer && outputType) {
        try {
          const blob = new Blob([compressedBuffer], { type: `image/${outputType}` });
          const preview = URL.createObjectURL(blob);
          setImages(prev =>
            prev.map(img =>
              img.id === id
                ? {
                    ...img,
                    status: 'complete',
                    preview,
                    blob,
                    compressedSize: compressedBuffer.byteLength,
                    outputType: outputType as OutputType,
                    progress: 100
                  }
                : img
            )
          );
        } catch (blobError) {
          alert(`Error creating blob for ${id}: ${String(blobError)}`);
        }
      } else if (success === false && error) {
        alert(`Worker error for ${id}: ${error}`);
        setImages(prev =>
          prev.map(img =>
            img.id === id ? { ...img, status: 'error', error } : img
          )
        );
      }
    },
    [setImages]
  );

  useEffect(() => {
    workerPoolRef.current.forEach(w => w.terminate());
    workerPoolRef.current = [];
    roundRobinIndex.current = 0;
    const numWorkers = processLevel < 3
      ? 1
      : Math.min(MAX_POOL_SIZE, navigator.hardwareConcurrency || MAX_POOL_SIZE);
    for (let i = 0; i < numWorkers; i++) {
      try {
        const worker = new Worker(new URL('../workers/imageProcessor.worker.ts', import.meta.url), { type: 'module' });
        worker.addEventListener('message', messageHandler);
        worker.addEventListener('error', evt =>
          alert(`Worker runtime error: ${evt.message || 'Unknown error'}`)
        );
        worker.addEventListener('messageerror', evt =>
          alert(`Worker message error: ${String(evt.data)}`)
        );
        workerPoolRef.current.push(worker);
      } catch (createErr) {
        alert(`Failed to create worker: ${String(createErr)}`);
      }
    }
    return () => {
      workerPoolRef.current.forEach(w => w.terminate());
      workerPoolRef.current = [];
    };
  }, [processLevel, messageHandler]);

  const processImage = useCallback(async (image: ImageFile) => {
    // Only process if image is still pending
    if (image.status !== 'pending') return;
    setImages(prev =>
      prev.map(img =>
        img.id === image.id
          ? { ...img, status: 'processing', progress: 0, startTime: Date.now() }
          : img
      )
    );
    try {
      const fileBuffer = await image.file.arrayBuffer();
      // Clone the buffer so the original remains valid if needed
      const bufferClone = fileBuffer.slice(0);
      const sourceType = getFileType(image.file);
      const pool = workerPoolRef.current;
      if (!pool.length) {
        alert(`No worker available for ${image.file.name}`);
        return;
      }
      const worker = pool[roundRobinIndex.current % pool.length];
      roundRobinIndex.current++;
      worker.postMessage(
        {
          id: image.id,
          fileBuffer: bufferClone,
          sourceType,
          outputType,
          compressionOptions,
          resizeOptions
        },
        [bufferClone]
      );
    } catch (e) {
      alert(`Error processing ${image.file.name}: ${String(e)}`);
      setImages(prev =>
        prev.map(img =>
          img.id === image.id ? { ...img, status: 'error', error: String(e) } : img
        )
      );
    }
  }, [compressionOptions, outputType, resizeOptions, setImages]);

  useEffect(() => {
    if (queue.length === 0) return;
    queue.forEach(imageId => {
      setImages(prev => {
        const image = prev.find(x => x.id === imageId && x.status === 'pending');
        if (image) processImage(image);
        return prev;
      });
    });
    setQueue([]);
  }, [queue, processImage, setImages]);

  const addToQueue = useCallback((imageId: string) => {
    setQueue(prev => [...prev, imageId]);
  }, []);

  return { addToQueue };
}
