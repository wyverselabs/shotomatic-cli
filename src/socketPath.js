import path from "node:path";

export const DEFAULT_APP_NAME = "Shotomatic";
export const DEFAULT_BUNDLE_ID = "com.shotomatic.app";
const SOCKET_DIRECTORY_NAME = "mcp";
const SOCKET_FILE_NAME = "mcp.sock";

export const userDataDirectory = ({ homedir, appName }) =>
  path.join(homedir, "Library", "Application Support", appName);

export const defaultSocketPath = ({ homedir, appName = DEFAULT_APP_NAME }) =>
  path.join(userDataDirectory({ homedir, appName }), SOCKET_DIRECTORY_NAME, SOCKET_FILE_NAME);

export const resolveTarget = ({ socket, appName, homedir }) => {
  const targetName = appName ?? DEFAULT_APP_NAME;
  if (socket) {
    return { socketPath: path.resolve(socket), appName: targetName, canLaunch: appName !== undefined };
  }
  return { socketPath: defaultSocketPath({ homedir, appName: targetName }), appName: targetName, canLaunch: true };
};
