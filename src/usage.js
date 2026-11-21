export const MAIN_USAGE = `Usage: shotomatic <command> [options]

Commands:
  mcp    Bridge an MCP client (stdio) to the Shotomatic app's local MCP server

Options:
  -h, --help       Show help
  -v, --version    Show the version

Run "shotomatic mcp --help" for the bridge options.
`;

export const MCP_USAGE = `Usage: shotomatic mcp [options]

Relays MCP messages between stdin/stdout and the Shotomatic app over a local
Unix socket (macOS) or named pipe (Windows). Add it to an MCP client as:
npx -y shotomatic mcp

Options:
  --socket <path>      Connect to this socket or pipe (env: SHOTOMATIC_MCP_SOCKET)
  --app-name <name>    Target another profile, e.g. "Shotomatic (Dev)"
                       (env: SHOTOMATIC_APP_NAME)
  --wait <seconds>     Seconds to wait for the app after launching it (default 15)
  --no-launch          Never start the app; fail if the socket is unavailable
                       (the bridge starts the app on macOS only)
  --verbose            Print connection diagnostics to stderr
  -h, --help           Show help

Default socket (macOS): ~/Library/Application Support/Shotomatic/mcp/mcp.sock
Default pipe (Windows): the name in %USERPROFILE%\\.shotomatic\\mcp\\pipe
                        (Microsoft Store app) or %APPDATA%\\Shotomatic\\mcp\\pipe
                        (website download), whichever the app wrote last

Exit codes:
  0   session ended normally
  1   unexpected connection failure
  2   usage error
  10  Shotomatic is not installed
  11  MCP access is turned off in Shotomatic
  12  stale socket (connection refused)
  13  permission denied on the socket
  14  timed out waiting for the app
  15  unsupported platform (macOS and Windows only)
`;
