import { spawn } from "node:child_process";
import { DEFAULT_APP_NAME, DEFAULT_BUNDLE_ID } from "./socketPath.js";

const openArguments = (appName) => {
  if (appName === DEFAULT_APP_NAME) return ["-g", "-b", DEFAULT_BUNDLE_ID];
  return ["-g", "-a", appName];
};

export const launchApp = (appName) =>
  new Promise((resolve) => {
    const child = spawn("open", openArguments(appName), { stdio: "ignore" });
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
