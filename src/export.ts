import ExportWorker from './export.worker?worker';
import type { OutputDocument, Progress } from './types';

interface ProgressMessage {
  type: 'progress';
  progress: Progress;
}

interface DoneMessage {
  type: 'done';
  blob: Blob;
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

type ExportMessage = ProgressMessage | DoneMessage | ErrorMessage;

function abortError(): DOMException {
  return new DOMException('The export was cancelled.', 'AbortError');
}

export function exportZip(
  bytes: Uint8Array,
  documents: OutputDocument[],
  onProgress: (progress: Progress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  if (signal?.aborted) return Promise.reject(abortError());
  if (bytes.byteLength === 0) return Promise.reject(new Error('The source PDF is empty.'));
  if (documents.length === 0) return Promise.reject(new Error('There are no documents to export.'));

  return new Promise((resolve, reject) => {
    const worker = new ExportWorker();
    let settled = false;

    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
      action();
    };
    const onAbort = () => finish(() => reject(abortError()));

    signal?.addEventListener('abort', onAbort, { once: true });
    worker.onerror = (event) => {
      finish(() => reject(new Error(event.message || 'The export worker stopped unexpectedly.')));
    };
    worker.onmessage = ({ data }: MessageEvent<ExportMessage>) => {
      if (data.type === 'progress') {
        try {
          onProgress(data.progress);
        } catch (error) {
          finish(() => reject(error));
        }
      } else if (data.type === 'done') {
        finish(() => resolve(data.blob));
      } else {
        finish(() => reject(new Error(data.message)));
      }
    };

    // Transfer an export-only clone. The caller's source bytes remain usable.
    const transferable = bytes.slice().buffer;
    try {
      worker.postMessage({ bytes: transferable, documents }, [transferable]);
    } catch (error) {
      finish(() => reject(error));
    }
  });
}
