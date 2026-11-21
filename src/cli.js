import os from "node:os";
import { connectWithLaunch } from "./connectWithLaunch.js";
import { BridgeError, unsupportedPlatform, usageError } from "./errors.js";
import { ExitCode } from "./exitCodes.js";
import { launchApp } from "./launch.js";
import { parseCommandLine } from "./options.js";
import { relay } from "./relay.js";
import { watchSignals } from "./signals.js";
import { resolveTarget } from "./socketPath.js";
import { MAIN_USAGE, MCP_USAGE } from "./usage.js";
import { readVersion } from "./version.js";

const SUPPORTED_PLATFORMS = new Set(["darwin", "win32"]);

const defaultContext = () => ({
  env: process.env,
  platform: process.platform,
  homedir: os.homedir(),
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
  signals: process,
  launcher: launchApp,
});

const runMcp = async (options, context) => {
  if (!SUPPORTED_PLATFORMS.has(context.platform)) throw unsupportedPlatform(context.platform);
  const target = resolveTarget({
    socket: options.socket,
    appName: options.appName,
    homedir: context.homedir,
    platform: context.platform,
    env: context.env,
  });
  const log = options.verbose ? (line) => context.stderr.write(`shotomatic: ${line}\n`) : () => {};
  const signals = watchSignals(context.signals);
  try {
    const socket = await connectWithLaunch({
      target,
      platform: context.platform,
      launch: options.launch,
      waitSeconds: options.waitSeconds,
      launcher: context.launcher,
      log,
      interrupt: signals.signal,
    });
    if (socket === undefined) return signals.exitCode();
    log("connected");
    const code = await relay({ ...context, socket, interrupt: signals.signal });
    log(`session ended with exit code ${code}`);
    return code;
  } finally {
    signals.dispose();
  }
};

const COMMANDS = { mcp: { run: runMcp, usage: MCP_USAGE } };

const dispatch = async (argv, context) => {
  const options = parseCommandLine(argv, context.env);
  const command = COMMANDS[options.command];

  if (options.command !== undefined && command === undefined) {
    throw usageError(`Unknown command "${options.command}".\n\n${MAIN_USAGE}`);
  }
  if (options.help) {
    context.stdout.write(command ? command.usage : MAIN_USAGE);
    return ExitCode.ok;
  }
  if (options.version) {
    context.stdout.write(`${readVersion()}\n`);
    return ExitCode.ok;
  }
  if (command === undefined) throw usageError(`Missing command.\n\n${MAIN_USAGE}`);
  if (options.extraArguments.length > 0) {
    throw usageError(`Unexpected argument "${options.extraArguments[0]}".\n\n${command.usage}`);
  }
  return command.run(options, context);
};

export const main = async (argv, overrides = {}) => {
  const context = { ...defaultContext(), ...overrides };
  try {
    return await dispatch(argv, context);
  } catch (error) {
    if (!(error instanceof BridgeError)) throw error;
    context.stderr.write(`shotomatic: ${error.message}\n`);
    return error.exitCode;
  }
};
