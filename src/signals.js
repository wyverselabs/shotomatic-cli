const SIGNAL_NUMBERS = { SIGINT: 2, SIGTERM: 15 };

export const watchSignals = (emitter) => {
  const controller = new AbortController();
  const handlers = Object.entries(SIGNAL_NUMBERS).map(([name, number]) => {
    const handler = () => controller.abort(128 + number);
    emitter.on(name, handler);
    return [name, handler];
  });
  return {
    signal: controller.signal,
    exitCode: () => controller.signal.reason,
    dispose: () => {
      for (const [name, handler] of handlers) emitter.removeListener(name, handler);
    },
  };
};
