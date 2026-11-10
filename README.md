# shotomatic

Stdio bridge that lets MCP clients (Claude Code, Claude Desktop, Codex) talk to the MCP server built into Shotomatic for Mac, the app for automated, repeatable screenshot capture.

> **Status:** the in-app MCP server is not part of a released Shotomatic version yet. This bridge is ready for it, but it has nothing to connect to until a Shotomatic release ships with MCP access.

## Requirements

Shotomatic for Mac with Settings > AI agents turned on, and Node 18 or later. macOS only.

## Setup

The bridge is started by your MCP client as `npx -y shotomatic mcp`. The tool list comes from the app, so it always matches the Shotomatic version you have installed.

### Claude Code

```sh
claude mcp add shotomatic -- npx -y shotomatic mcp
```

### Claude Desktop

Add this to `claude_desktop_config.json` (Settings > Developer > Edit Config), then restart Claude Desktop:

```json
{
  "mcpServers": {
    "shotomatic": {
      "command": "npx",
      "args": ["-y", "shotomatic", "mcp"]
    }
  }
}
```

### Codex

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.shotomatic]
command = "npx"
args = ["-y", "shotomatic", "mcp"]
```

## Agent skill

`skills/shotomatic/SKILL.md` describes the tools and three common workflows (book pages to PDF, web pages, step-by-step guides). Copy it into your agent's skills folder if your client supports skills.

## How it works

The app listens on a Unix socket at `~/Library/Application Support/Shotomatic/mcp/mcp.sock` and speaks MCP over newline-delimited JSON-RPC. `shotomatic mcp` copies stdin to that socket and the socket to stdout, and exits when either side closes. If the app is not running, the bridge starts it once in the background (without bringing it to the front) and waits for the socket.

## Options

```
shotomatic mcp [options]

--socket <path>      Connect to this socket (env: SHOTOMATIC_MCP_SOCKET)
--app-name <name>    Target another profile, e.g. "Shotomatic (Dev)"
                     (env: SHOTOMATIC_APP_NAME)
--wait <seconds>     Seconds to wait for the app after launching it (default 15)
--no-launch          Never start the app; fail if the socket is unavailable
--verbose            Print connection diagnostics to stderr
-h, --help           Show help
```

Flags take precedence over environment variables. With `--socket` and no `--app-name`, the bridge never launches an app, because it cannot know which one owns that socket. `shotomatic --help` and `shotomatic --version` work too.

## Troubleshooting

Messages go to stderr, which MCP clients show in their server log. Each failure has its own exit code.

| Exit | Message starts with | What to do |
| ---- | ------------------- | ---------- |
| 10 | Could not find "Shotomatic" on this Mac | Install Shotomatic for Mac and open it once. |
| 11 | ... installed but MCP access is turned off | Open Shotomatic, go to Settings > AI agents, turn on "Let AI agents use Shotomatic", restart your MCP client. |
| 12 | The socket ... exists but refuses connections | A crashed or force-quit app left a stale socket. Quit Shotomatic fully and reopen it; if it persists, delete the socket file. |
| 13 | Permission denied while connecting | Run the MCP client as the same macOS user that runs Shotomatic. |
| 14 | Timed out ... waiting for "Shotomatic" / ... is not running | Open Shotomatic yourself and check MCP access is on; use `--wait <seconds>` for slow starts. |
| 15 | Shotomatic only runs on macOS | Run the bridge on the Mac that has Shotomatic. |
| 2 | usage text | Check the command and options. |
| 1 | Connection ... was lost / Could not connect | Restart Shotomatic and your MCP client; run with `--verbose` for details. |

## Privacy

Everything stays on your Mac. The bridge only relays bytes between your MCP client and the local Shotomatic app over a Unix socket. It does not inspect, store, or log messages, and it makes no network connections and has no dependencies.

## License

Unlicensed for now; the owner has not chosen a license yet.
