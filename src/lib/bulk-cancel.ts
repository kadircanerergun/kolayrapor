let abortController: AbortController | null = null;
let cancelled = false;

export const bulkCancel = {
  start(): AbortSignal {
    cancelled = false;
    abortController = new AbortController();
    return abortController.signal;
  },
  cancel() {
    cancelled = true;
  },
  forceStop() {
    cancelled = true;
    abortController?.abort();
    abortController = null;
  },
  isCancelled() {
    return cancelled;
  },
  reset() {
    abortController = null;
    cancelled = false;
  },
};
