import fs from "node:fs";
import path from "node:path";

export const DEFAULT_APP_NAME = "Shotomatic";
export const DEFAULT_BUNDLE_ID = "com.shotomatic.app";
const SOCKET_DIRECTORY_NAME = "mcp";
const SOCKET_FILE_NAME = "mcp.sock";
const PIPE_NAME_FILE_NAME = "pipe";
const STORE_DIRECTORY_NAME = ".shotomatic";

export const userDataDirectory = ({ homedir, appName }) =>
  path.posix.join(homedir, "Library", "Application Support", appName);

export const defaultSocketPath = ({ homedir, appName = DEFAULT_APP_NAME }) =>
  path.posix.join(userDataDirectory({ homedir, appName }), SOCKET_DIRECTORY_NAME, SOCKET_FILE_NAME);

/**
 * On Windows the app listens on a named pipe under a random name it picks each time it starts listening, and
 * writes that name to a file the bridge reads instead of deriving it. A website install writes it in its roaming
 * profile. A Microsoft Store install keeps files it creates under AppData private to its package, so it writes
 * the file in %USERPROFILE%\.shotomatic instead. Only the stable app ships in the Store, so another profile never
 * looks there and cannot reach the Store app by mistake.
 */
export const defaultPipeNameFiles = ({ homedir, env, appName = DEFAULT_APP_NAME }) => {
  const roaming = env.APPDATA || path.win32.join(homedir, "AppData", "Roaming");
  const website = path.win32.join(roaming, appName, SOCKET_DIRECTORY_NAME, PIPE_NAME_FILE_NAME);
  if (appName !== DEFAULT_APP_NAME) return [website];
  const store = path.win32.join(homedir, STORE_DIRECTORY_NAME, SOCKET_DIRECTORY_NAME, PIPE_NAME_FILE_NAME);
  return [store, website];
};

const modifiedAt = (file) => {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return undefined;
  }
};

/** The app deletes its pipe name file when it stops listening, so of two left behind the newer one is live. */
export const latestPipeNameFile = (pipeNameFiles) => {
  let latest;
  let latestModifiedAt = -Infinity;
  for (const file of pipeNameFiles) {
    const fileModifiedAt = modifiedAt(file);
    if (fileModifiedAt === undefined || fileModifiedAt <= latestModifiedAt) continue;
    latest = file;
    latestModifiedAt = fileModifiedAt;
  }
  return latest;
};

const resolveWindowsTarget = ({ socket, appName, homedir, env }) => {
  if (socket) return { socketPath: socket, appName, canLaunch: false };
  return { pipeNameFiles: defaultPipeNameFiles({ homedir, env, appName }), appName, canLaunch: false };
};

export const resolveTarget = ({ socket, appName, homedir, platform, env }) => {
  const targetName = appName ?? DEFAULT_APP_NAME;
  if (platform === "win32") return resolveWindowsTarget({ socket, appName: targetName, homedir, env });
  if (socket) {
    return { socketPath: path.posix.resolve(socket), appName: targetName, canLaunch: appName !== undefined };
  }
  return { socketPath: defaultSocketPath({ homedir, appName: targetName }), appName: targetName, canLaunch: true };
};
