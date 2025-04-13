// /src/hooks/useImageQueue.ts

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
  const [queue, setQueue] = useState<string[]>([]);

  // We'll create either 1 worker or up to 4, not unbounded by hardwareConcurrency.
  const MAX_POOL_SIZE = 4;
  const workerPoolRef = useRef<Worker[]>([]);
  const roundRobinIndex = useRef(0);

  // Single message handler for all workers in the pool
  const messageHandler = (event: MessageEvent<WorkerResponse>) => {
    const { id, success, compressedBuffer, error, outputType, progress } = event.data;

    if (progress !== undefined) {
      // If we want to track progress in the UI, store it
      setImages(prev =>
        prev.map(img => (img.id === id ? { ...img, progress } : img))
      );
    }

    if (success) {
      if (compressedBuffer) {
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
                  outputType,
                  progress: 100,
                }
              : img
          )
        );
      }
    } else if (error) {
      setImages(prev =>
        prev.map(img => (img.id === id ? { ...img, status: 'error', error } : img))
      );
    }
  };

  // Initialize a worker pool
  useEffect(() => {
    // Cleanup any existing workers
    workerPoolRef.current.forEach(w => w.terminate());
    workerPoolRef.current = [];

    // Decide how many workers to spawn
    let numWorkers = 1;
    // If processLevel >= 3 or 4, let's spawn up to 4
    if (processLevel >= 3) {
      numWorkers = Math.min(MAX_POOL_SIZE, navigator.hardwareConcurrency || MAX_POOL_SIZE);
    }

    // Create that many
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(
        new URL('../workers/imageProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      );
      worker.addEventListener('message', messageHandler);
      workerPoolRef.current.push(worker);
    }

    // Cleanup on unmount
    return () => {
      workerPoolRef.current.forEach(w => w.terminate());
    };
  }, [processLevel, setImages]);

  const processImage = useCallback(
    async (image: ImageFile) => {
      // Round-robin pick
      const pool = workerPoolRef.current;
      if (!pool.length) return;

      // Mark image as processing
      setImages(prev =>
        prev.map(img => (img.id === image.id ? { ...img, status: 'processing', progress: 0 } : img))
      );

      // Transfer buffer
      const fileBuffer = await image.file.arrayBuffer();
      const sourceType = getFileType(image.file);

      // Dispatch to a worker
      const worker = pool[roundRobinIndex.current % pool.length];
      roundRobinIndex.current += 1;

      worker.postMessage(
        {
          id: image.id,
          fileBuffer,
          sourceType,
          outputType,
          compressionOptions,
          resizeOptions,
          startTime: Date.now(),
        },
        [fileBuffer] // Transferable
      );
    },
    [compressionOptions, outputType, setImages, resizeOptions]
  );

  useEffect(() => {
    if (queue.length === 0) return;
    // Process each item in queue
    queue.forEach(id => {
      setImages(prev => {
        const image = prev.find(img => img.id === id);
        if (image) processImage(image);
        return prev;
      });
    });
    // Clear queue
    setQueue([]);
  }, [queue, processImage, setImages]);

  const addToQueue = useCallback((imageId: string) => {
    setQueue(prev => [...prev, imageId]);
  }, []);

  return { addToQueue };
}
