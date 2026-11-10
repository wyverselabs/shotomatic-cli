import { connectionLost } from "./errors.js";
import { ExitCode } from "./exitCodes.js";

const flush = (stream) =>
  new Promise((resolve) => {
    if (stream.destroyed) return resolve();
    stream.write("", () => resolve());
  });

export const relay = ({ socket, stdin, stdout, stderr, interrupt }) =>
  new Promise((resolve) => {
    let failed = false;

    const onInterrupt = () => socket.destroy();
    interrupt.addEventListener("abort", onInterrupt, { once: true });
    if (interrupt.aborted) socket.destroy();

    socket.on("error", (error) => {
      if (interrupt.aborted) return;
      failed = true;
      stderr.write(`shotomatic: ${connectionLost(error).message}\n`);
    });
    stdout.on("error", () => socket.destroy());
    stdin.on("error", () => socket.end());

    socket.on("close", async () => {
      interrupt.removeEventListener("abort", onInterrupt);
      stdin.unpipe(socket);
      stdin.destroy();
      await flush(stdout);
      if (interrupt.aborted) return resolve(interrupt.reason);
      resolve(failed ? ExitCode.failure : ExitCode.ok);
    });

    stdin.pipe(socket);
    socket.pipe(stdout, { end: false });
  });
