import fs from "node:fs";
import path from "node:path";
import { connectOnce } from "./connect.js";
import {
  appNotInstalled,
  appNotRunning,
  connectionFailed,
  mcpAccessOff,
  permissionDenied,
  socketPathTooLong,
  staleSocket,
  timedOut,
} from "./errors.js";

const POLL_INTERVAL_MS = 250;
const MAX_SOCKET_PATH_BYTES = 103;

const sleep = (ms, interrupt) =>
  new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      interrupt.removeEventListener("abort", done);
      resolve();
    }
    interrupt.addEventListener("abort", done, { once: true });
  });
const exists = (target) => fs.existsSync(target);

const failureFor = ({ error, target, launched, waitSeconds }) => {
  const { socketPath, appName } = target;
  if (error.code === "EINVAL" && Buffer.byteLength(socketPath) > MAX_SOCKET_PATH_BYTES) return socketPathTooLong(socketPath);
  if (error.code === "EACCES" || error.code === "EPERM") return permissionDenied(socketPath);
  if (error.code === "ECONNREFUSED") return staleSocket(socketPath);
  if (error.code !== "ENOENT" && error.code !== "ENOTDIR") return connectionFailed(socketPath, error);

  const socketDirectory = path.dirname(socketPath);
  if (!exists(socketDirectory)) {
    const profileDirectory = path.dirname(socketDirectory);
    if (!launched && !exists(profileDirectory)) return appNotInstalled(appName);
    return mcpAccessOff(appName, socketDirectory);
  }
  if (launched) return timedOut(appName, socketPath, waitSeconds);
  return appNotRunning(appName, socketPath);
};

const isFatalImmediately = (error) => error.code === "EACCES" || error.code === "EPERM" || error.code === "EINVAL";

export const connectWithLaunch = async ({ target, launch, waitSeconds, launcher, log, interrupt }) => {
  log(`connecting to ${target.socketPath}`);
  let lastError;
  try {
    return await connectOnce(target.socketPath);
  } catch (error) {
    lastError = error;
  }
  const canLaunch = launch && target.canLaunch;
  if (isFatalImmediately(lastError) || !canLaunch) {
    throw failureFor({ error: lastError, target, launched: false, waitSeconds });
  }

  log(`socket unavailable (${lastError.code}); launching "${target.appName}" in the background`);
  if (!(await launcher(target.appName))) throw appNotInstalled(target.appName);
  if (interrupt.aborted) return undefined;

  const deadline = Date.now() + waitSeconds * 1000;
  while (Date.now() < deadline) {
    await sleep(Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())), interrupt);
    if (interrupt.aborted) return undefined;
    try {
      return await connectOnce(target.socketPath);
    } catch (error) {
      lastError = error;
      if (isFatalImmediately(error)) throw failureFor({ error, target, launched: true, waitSeconds });
    }
  }
  throw failureFor({ error: lastError, target, launched: true, waitSeconds });
};
