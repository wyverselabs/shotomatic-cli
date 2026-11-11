import { ExitCode } from "./exitCodes.js";

export class BridgeError extends Error {
  constructor(exitCode, message) {
    super(message);
    this.name = "BridgeError";
    this.exitCode = exitCode;
  }
}

export const unsupportedPlatform = (platform) =>
  new BridgeError(
    ExitCode.unsupportedPlatform,
    `Shotomatic only runs on macOS, and this bridge cannot work on "${platform}". Run it on the Mac that has Shotomatic installed.`,
  );

export const appNotInstalled = (appName) =>
  new BridgeError(
    ExitCode.appNotInstalled,
    `Could not find "${appName}" on this Mac. Install Shotomatic for Mac and open it once, then restart your MCP client.`,
  );

export const mcpAccessOff = (appName, directory) =>
  new BridgeError(
    ExitCode.mcpAccessOff,
    `"${appName}" is installed but MCP access is turned off (no socket directory at ${directory}). ` +
      `Open Shotomatic, go to Settings > AI agents, turn on \"Let AI agents use Shotomatic\", then restart your MCP client. ` +
      `If you just started the app, wait a few seconds and try again.`,
  );

export const staleSocket = (socketPath) =>
  new BridgeError(
    ExitCode.staleSocket,
    `The socket at ${socketPath} exists but refuses connections. It is probably left over from a crashed or force-quit app. ` +
      `Quit Shotomatic completely and open it again; if the problem persists, delete that file and open Shotomatic.`,
  );

export const permissionDenied = (socketPath) =>
  new BridgeError(
    ExitCode.permissionDenied,
    `Permission denied while connecting to ${socketPath}. The socket belongs to another macOS user or has wrong permissions. ` +
      `Run your MCP client as the same user that runs Shotomatic.`,
  );

export const timedOut = (appName, socketPath, seconds) =>
  new BridgeError(
    ExitCode.timeout,
    `Timed out after ${seconds}s waiting for "${appName}" to create ${socketPath}. ` +
      `Open Shotomatic yourself and make sure Settings > AI agents is turned on, then restart your MCP client. ` +
      `Use --wait <seconds> to wait longer.`,
  );

export const appNotRunning = (appName, socketPath) =>
  new BridgeError(
    ExitCode.timeout,
    `"${appName}" is not running (no socket at ${socketPath}) and launching was disabled. ` +
      `Open Shotomatic, make sure Settings > AI agents is turned on, then restart your MCP client.`,
  );

export const socketPathTooLong = (socketPath) =>
  new BridgeError(
    ExitCode.usage,
    `The socket path is too long for a macOS Unix socket (limit 103 bytes): ${socketPath}. Use a shorter --socket path.`,
  );

export const connectionFailed = (socketPath, cause) =>
  new BridgeError(ExitCode.failure, `Could not connect to ${socketPath}: ${cause.code ?? cause.message}.`);

export const connectionLost = (cause) =>
  new BridgeError(ExitCode.failure, `Connection to Shotomatic was lost: ${cause.code ?? cause.message}.`);

export const usageError = (message) => new BridgeError(ExitCode.usage, message);
