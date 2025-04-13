// /src/workers/imageProcessor.worker.ts

// 1) **Remove** dynamic import calls.
// 2) **Statically** import everything needed upfront:
import { decode, encode, getFileType } from '../utils/imageProcessing';
import { resizeImage } from '../utils/resize';

// We'll reduce the frequency of messages to reduce overhead.

interface WorkerMessageData {
  id: string;
  fileBuffer: ArrayBuffer;
  // We'll derive sourceType from the file itself, so it might be optional now:
  sourceType?: string;
  outputType: string;
  compressionOptions: { quality: number };
  resizeOptions?: {
    enabled: boolean;
    width: number;
    height: number;
    maintainAspectRatio: boolean;
    method: 'lanczos3';
    premultiplyAlpha: boolean;
    linearRGB: boolean;
  };
  startTime?: number;
}

self.onmessage = async (event: MessageEvent<WorkerMessageData>) => {
  const {
    id,
    fileBuffer,
    sourceType,
    outputType,
    compressionOptions,
    resizeOptions,
    startTime,
  } = event.data;

  try {
    // 1) Decode
    const actualSourceType = sourceType || 'image/jpeg';
    const decoded = await decode(actualSourceType, fileBuffer);

    // (Optional) Post a single partial progress if you want (e.g. 50%):
    self.postMessage({ id, progress: 50 });

    // 2) Resize if needed
    let finalImage = decoded;
    if (resizeOptions?.enabled) {
      finalImage = resizeImage(decoded, resizeOptions);
    }

    // 3) Encode
    const compressedBuffer = await encode(outputType as any, finalImage, compressionOptions);

    // Just before final output, 100% progress:
    self.postMessage({ id, progress: 100 });

    // Return result
    self.postMessage(
      {
        id,
        success: true,
        compressedBuffer,
        outputType,
      },
      [compressedBuffer] // Transfer ownership
    );
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
