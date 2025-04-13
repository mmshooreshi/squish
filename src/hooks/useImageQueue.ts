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
  // We’ll create a small worker pool (up to 4 workers).
  const MAX_POOL_SIZE = 4;
  const workerPoolRef = useRef<Worker[]>([]);
  const roundRobinIndex = useRef(0);
  const [queue, setQueue] = useState<string[]>([]);

  // Single handler for all worker messages
  const messageHandler = useCallback((event: MessageEvent<WorkerResponse>) => {
    const { id, success, compressedBuffer, error, outputType, progress } = event.data;

    if (progress !== undefined) {
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, progress } : img))
      );
    }

    if (success) {
      if (compressedBuffer) {
        const blob = new Blob([compressedBuffer], { type: `image/${outputType}` });
        const preview = URL.createObjectURL(blob);
        setImages((prev) =>
          prev.map((img) =>
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
      }
    } else if (error) {
      setImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, status: 'error', error } : img
        )
      );
    }
  }, [setImages]);

  // Create or recreate the worker pool whenever processLevel changes
  useEffect(() => {
    workerPoolRef.current.forEach((w) => w.terminate());
    workerPoolRef.current = [];

    let numWorkers = 1;
    if (processLevel >= 3) {
      // spawn up to 4
      numWorkers = Math.min(MAX_POOL_SIZE, navigator.hardwareConcurrency || MAX_POOL_SIZE);
    }

    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(
        new URL('../workers/imageProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      );
      worker.addEventListener('message', messageHandler);
      workerPoolRef.current.push(worker);
    }

    return () => {
      workerPoolRef.current.forEach((w) => w.terminate());
    };
  }, [processLevel, messageHandler]);

  const processImage = useCallback(async (image: ImageFile) => {
    const pool = workerPoolRef.current;
    if (!pool.length) return;

    setImages((prev) =>
      prev.map((img) =>
        img.id === image.id
          ? { ...img, status: 'processing', progress: 0 }
          : img
      )
    );

    const fileBuffer = await image.file.arrayBuffer();
    const sourceType = getFileType(image.file);

    const worker = pool[roundRobinIndex.current % pool.length];
    roundRobinIndex.current += 1;

    worker.postMessage(
      {
        id: image.id,
        fileBuffer,
        sourceType,
        outputType,
        compressionOptions,
        resizeOptions
      },
      [fileBuffer] // Transfer
    );
  }, [compressionOptions, outputType, setImages, resizeOptions]);

  // Whenever queue changes, process items
  useEffect(() => {
    if (queue.length === 0) return;
    queue.forEach((id) => {
      setImages((prev) => {
        const image = prev.find((x) => x.id === id);
        if (image) processImage(image);
        return prev;
      });
    });
    setQueue([]);
  }, [queue, processImage, setImages]);

  const addToQueue = useCallback((imageId: string) => {
    setQueue((prev) => [...prev, imageId]);
  }, []);

  return { addToQueue };
}
