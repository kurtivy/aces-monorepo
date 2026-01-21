type ReadySignal = () => Promise<unknown>;

let readyState: 'idle' | 'pending' | 'done' = 'idle';
let readyPromise: Promise<void> | null = null;

export async function signalMiniAppReadyOnce(
  signalReady: ReadySignal,
  sourceLabel: string,
): Promise<void> {
  if (readyState === 'done') {
    return;
  }

  if (!readyPromise) {
    readyState = 'pending';
    readyPromise = signalReady()
      .then(() => {
        readyState = 'done';
      })
      .catch((error) => {
        readyState = 'idle';
        throw error;
      })
      .finally(() => {
        readyPromise = null;
      });
  }

  try {
    await readyPromise;
  } catch (error) {
    console.error(`[MiniApp] Ready signal failed (${sourceLabel})`, error);
  }
}
