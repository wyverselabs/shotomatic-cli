import { parseArgs } from "node:util";
import { usageError } from "./errors.js";

export const DEFAULT_WAIT_SECONDS = 15;

const OPTIONS = {
  socket: { type: "string" },
  "app-name": { type: "string" },
  wait: { type: "string" },
  "no-launch": { type: "boolean" },
  verbose: { type: "boolean" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
};

const parseWait = (raw) => {
  if (raw === undefined) return DEFAULT_WAIT_SECONDS;
  const seconds = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(seconds) || seconds < 0) {
    throw usageError(`Invalid --wait value "${raw}": expected a number of seconds, 0 or more.`);
  }
  return seconds;
};

export const parseCommandLine = (argv, env) => {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  } catch (error) {
    throw usageError(error.message);
  }
  const { values, positionals } = parsed;
  return {
    command: positionals[0],
    extraArguments: positionals.slice(1),
    help: values.help === true,
    version: values.version === true,
    socket: values.socket ?? (env.SHOTOMATIC_MCP_SOCKET || undefined),
    appName: values["app-name"] ?? (env.SHOTOMATIC_APP_NAME || undefined),
    waitSeconds: parseWait(values.wait),
    launch: values["no-launch"] !== true,
    verbose: values.verbose === true,
  };
};
