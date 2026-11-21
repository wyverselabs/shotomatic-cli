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
  stalePipeName,
  staleSocket,
  timedOut,
} from "./errors.js";
import { latestPipeNameFile } from "./socketPath.js";

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

const publishedPipeNameFile = (target) => {
  if (target.pipeNameFiles === undefined) return undefined;
  return latestPipeNameFile(target.pipeNameFiles);
};

const endpointPathsOf = (target) => target.pipeNameFiles ?? [target.socketPath];

const endpointPathOf = (target) => target.socketPath ?? publishedPipeNameFile(target) ?? target.pipeNameFiles.join(" or ");

const noPublishedPipeName = () => Object.assign(new Error("No pipe name file found"), { code: "ENOENT" });

const resolveAddress = async (target) => {
  if (target.pipeNameFiles === undefined) return target.socketPath;
  const pipeNameFile = latestPipeNameFile(target.pipeNameFiles);
  if (pipeNameFile === undefined) throw noPublishedPipeName();
  return (await fs.promises.readFile(pipeNameFile, "utf8")).trim();
};

const connectToTarget = async (target) => connectOnce(await resolveAddress(target));

const failureFor = ({ error, target, platform, launched, waitSeconds }) => {
  const { appName } = target;
  const socketPath = endpointPathOf(target);
  const paths = platform === "win32" ? path.win32 : path;
  if (error.code === "EINVAL" && Buffer.byteLength(socketPath) > MAX_SOCKET_PATH_BYTES) return socketPathTooLong(socketPath);
  if (error.code === "EACCES" || error.code === "EPERM") return permissionDenied(socketPath, platform);
  if (error.code === "ECONNREFUSED") return staleSocket(socketPath);
  if (error.code !== "ENOENT" && error.code !== "ENOTDIR") return connectionFailed(socketPath, error);
  const pipeNameFile = publishedPipeNameFile(target);
  if (pipeNameFile !== undefined) return stalePipeName(pipeNameFile);

  const endpointPaths = endpointPathsOf(target);
  const socketDirectories = endpointPaths.map((endpointPath) => paths.dirname(endpointPath));
  if (!socketDirectories.some(exists)) {
    const profileDirectories = socketDirectories.map((directory) => paths.dirname(directory));
    if (!launched && !profileDirectories.some(exists)) return appNotInstalled(appName, platform);
    return mcpAccessOff(appName, socketDirectories);
  }
  if (launched) return timedOut(appName, socketPath, waitSeconds);
  return appNotRunning(appName, endpointPaths, platform);
};

const isFatalImmediately = (error) => error.code === "EACCES" || error.code === "EPERM" || error.code === "EINVAL";

export const connectWithLaunch = async ({ target, platform, launch, waitSeconds, launcher, log, interrupt }) => {
  log(`connecting to ${endpointPathOf(target)}`);
  let lastError;
  try {
    return await connectToTarget(target);
  } catch (error) {
    lastError = error;
  }
  const canLaunch = launch && target.canLaunch;
  if (isFatalImmediately(lastError) || !canLaunch) {
    throw failureFor({ error: lastError, target, platform, launched: false, waitSeconds });
  }

  log(`socket unavailable (${lastError.code}); launching "${target.appName}" in the background`);
  if (!(await launcher(target.appName))) throw appNotInstalled(target.appName);
  if (interrupt.aborted) return undefined;

  const deadline = Date.now() + waitSeconds * 1000;
  while (Date.now() < deadline) {
    await sleep(Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())), interrupt);
    if (interrupt.aborted) return undefined;
    try {
      return await connectToTarget(target);
    } catch (error) {
      lastError = error;
      if (isFatalImmediately(error)) throw failureFor({ error, target, platform, launched: true, waitSeconds });
    }
  }
  throw failureFor({ error: lastError, target, platform, launched: true, waitSeconds });
};
