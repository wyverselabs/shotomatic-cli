import path from "node:path";

export const DEFAULT_APP_NAME = "Shotomatic";
export const DEFAULT_BUNDLE_ID = "com.shotomatic.app";
const SOCKET_DIRECTORY_NAME = "mcp";
const SOCKET_FILE_NAME = "mcp.sock";
const PIPE_NAME_FILE_NAME = "pipe";

export const userDataDirectory = ({ homedir, appName }) =>
  path.posix.join(homedir, "Library", "Application Support", appName);

export const defaultSocketPath = ({ homedir, appName = DEFAULT_APP_NAME }) =>
  path.posix.join(userDataDirectory({ homedir, appName }), SOCKET_DIRECTORY_NAME, SOCKET_FILE_NAME);

/**
 * On Windows the app listens on a named pipe under a random name it picks each time it starts listening, and
 * writes that name to this file in the user's profile. The bridge reads the name instead of deriving it.
 */
export const defaultPipeNameFile = ({ homedir, env, appName = DEFAULT_APP_NAME }) => {
  const roaming = env.APPDATA || path.win32.join(homedir, "AppData", "Roaming");
  return path.win32.join(roaming, appName, SOCKET_DIRECTORY_NAME, PIPE_NAME_FILE_NAME);
};

const resolveWindowsTarget = ({ socket, appName, homedir, env }) => {
  if (socket) return { socketPath: socket, appName, canLaunch: false };
  return { pipeNameFile: defaultPipeNameFile({ homedir, env, appName }), appName, canLaunch: false };
};

export const resolveTarget = ({ socket, appName, homedir, platform, env }) => {
  const targetName = appName ?? DEFAULT_APP_NAME;
  if (platform === "win32") return resolveWindowsTarget({ socket, appName: targetName, homedir, env });
  if (socket) {
    return { socketPath: path.posix.resolve(socket), appName: targetName, canLaunch: appName !== undefined };
  }
  return { socketPath: defaultSocketPath({ homedir, appName: targetName }), appName: targetName, canLaunch: true };
};
