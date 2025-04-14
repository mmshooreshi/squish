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
  const MAX_POOL_SIZE = 4; // up to 4 workers
  const workerPoolRef = useRef<Worker[]>([]);
  const roundRobinIndex = useRef(0);

  const [queue, setQueue] = useState<string[]>([]);

  // Single event handler for all worker messages.
  const messageHandler = useCallback(
    (event: MessageEvent<WorkerResponse>) => {
      const { id, success, compressedBuffer, error, outputType, progress } = event.data;

      if (progress !== undefined) {
        setImages((prev) =>
          prev.map((img) => (img.id === id ? { ...img, progress } : img))
        );
      }

      if (success && compressedBuffer && outputType) {
        try {
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
        } catch (blobError) {
          alert(`Error creating blob or preview: ${String(blobError)}`);
        }
      } else if (success === false && error) {
        // Worker indicated an error
        alert(`Worker error: ${error}`);
        setImages((prev) =>
          prev.map((img) => (img.id === id ? { ...img, status: 'error', error } : img))
        );
      }
    },
    [setImages]
  );

  // Create/refresh a worker pool whenever processLevel changes
  useEffect(() => {
    // Terminate existing workers
    workerPoolRef.current.forEach((w) => w.terminate());
    workerPoolRef.current = [];
    roundRobinIndex.current = 0;

    let numWorkers = processLevel < 3
      ? 1
      : Math.min(MAX_POOL_SIZE, navigator.hardwareConcurrency || MAX_POOL_SIZE);

    for (let i = 0; i < numWorkers; i++) {
      try {
        const worker = new Worker(new URL('../workers/imageProcessor.worker.ts', import.meta.url), { type: 'module' });
        worker.addEventListener('message', messageHandler);
        worker.addEventListener('error', (evt) => {
          alert(`Worker runtime error: ${evt.message || 'Unknown error'}`);
        });
        worker.addEventListener('messageerror', (evt) => {
          alert(`Worker message parsing error: ${String(evt.data)}`);
        });
        workerPoolRef.current.push(worker);
      } catch (createWorkerErr) {
        alert(`Failed to create worker: ${String(createWorkerErr)}`);
      }
    }

    // Cleanup on unmount or processLevel change
    return () => {
      workerPoolRef.current.forEach((w) => w.terminate());
      workerPoolRef.current = [];
    };
  }, [processLevel, messageHandler]);

  // Send an image to the next worker in the pool
  const processImage = useCallback(
    async (image: ImageFile) => {
      const pool = workerPoolRef.current;
      if (!pool.length) {
        alert(`No worker available to process image: ${image.file.name}`);
        return;
      }

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
        const worker = pool[roundRobinIndex.current % pool.length];
        roundRobinIndex.current++;

        worker.postMessage(
          {
            id: image.id,
            fileBuffer,
            sourceType,
            outputType,
            compressionOptions,
            resizeOptions
          },
          [fileBuffer]
        );
      } catch (e) {
        alert(`Error reading file buffer: ${String(e)}`);
      }
    },
    [compressionOptions, outputType, resizeOptions, setImages]
  );

  // Whenever items get added to queue, process them
  useEffect(() => {
    if (queue.length === 0) return;
    queue.forEach((imageId) => {
      setImages((prev) => {
        const found = prev.find((img) => img.id === imageId);
        if (found) processImage(found);
        return prev;
      });
    });
    setQueue([]);
  }, [queue, processImage, setImages]);

  // Expose a function to add IDs to the queue
  const addToQueue = useCallback((imageId: string) => {
    setQueue((prev) => [...prev, imageId]);
  }, []);

  return { addToQueue };
}
