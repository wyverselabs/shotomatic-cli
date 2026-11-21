# MCP registry listing

Materials for listing `shotomatic` in the official MCP registry (https://github.com/modelcontextprotocol/registry). The listing itself is `server.json` in the repository root; `.github/workflows/publish-mcp-registry.yml` publishes it. This folder is not shipped in the npm package (`files` allowlist).

## How the registry works (read from its docs, schema 2025-12-11)

- The registry stores metadata only. The npm package must be published first; `server.json` points at it.
- Ownership of an npm package is checked through the `mcpName` field in the **published** `package.json`. It must equal the `name` in `server.json`.
- The namespace in `name` follows the login method. `io.github.wyverselabs/*` is a GitHub organization namespace: it needs an org Owner, and `mcp-publisher login github` (device flow) cannot grant it today, so this repository publishes through GitHub Actions OIDC instead.
- `description` is limited to 100 characters. `version` must be a concrete version (no ranges, not `latest`), and the package `version` must match what is on npm. A published registry version cannot be changed; fixes need a new version.

## Releasing a version

1. Set the same version in `package.json` and in both places in `server.json`.
2. Merge, then `npm publish` from `main` (npm asks for 2FA in the browser).
3. Push the tag `v<version>`. The workflow checks that the versions match and that npm has the version, then lists it in the registry. It can also be run by hand from the Actions tab (`workflow_dispatch`) on `main`.

Check locally with `mcp-publisher validate` before merging.

## Values

| Item | Value |
| ---- | ----- |
| Namespace / server name | `io.github.wyverselabs/shotomatic` (GitHub organization namespace). `package.json` carries the same string as `"mcpName"`. Published by GitHub Actions OIDC from this repository. |
| GitHub repository URL | `https://github.com/wyverselabs/shotomatic-cli` (public, so the listing's source link works). |
| License | MIT (`LICENSE`, copyright Wyverse Labs). |
| First version | `0.2.0`, the first release that also runs on Windows. The version in `server.json` (both places) must equal the published npm version. |

## server.json

See `server.json` in the repository root. Its description is 94 characters (the limit is 100). No environment variables are needed.

## Listing text

One line:

> Let AI agents capture screenshots, websites and click-by-click guides in the Shotomatic app on Mac or Windows and export them as PDF, images or video.

Paragraph:

> Shotomatic is a Mac and Windows app for automated, repeatable screenshot capture. This package is a small stdio bridge that lets MCP clients such as Claude Code and Codex (and others that run a local stdio server) talk to the MCP server built into the app, over a local Unix socket on macOS or a named pipe on Windows. Agents can capture many pages of a window in a row (ebooks, slides), capture websites and run saved Website Capture Workflows, record step-by-step guides, edit the resulting Documents and export them as PDF, PNG, JPG, WebP, ZIP or MP4. Everything stays on your computer: the bridge has no dependencies and makes no network connections. You turn access on in Settings > AI agents and approve each agent once; deleting items, purging history and scheduling Workflows ask for confirmation in the app. Requires macOS or Windows and Shotomatic with AI agents support.

## Install snippets

Claude Code:

```sh
claude mcp add shotomatic -- npx -y shotomatic mcp
```

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.shotomatic]
command = "npx"
args = ["-y", "shotomatic", "mcp"]
```

Generic JSON config (Claude Desktop and other clients that use `mcpServers`):

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

Other clients (not tested with Shotomatic; formats follow each client's docs, checked 2026-11-11). Same command everywhere: `npx -y shotomatic mcp`.

```sh
amp mcp add shotomatic -- npx -y shotomatic mcp
copilot mcp add shotomatic -- npx -y shotomatic mcp
devin mcp add -s user shotomatic -- npx -y shotomatic mcp
opencode mcp add shotomatic -- npx -y shotomatic mcp
code --add-mcp '{"name":"shotomatic","type":"stdio","command":"npx","args":["-y","shotomatic","mcp"]}'
```

The generic `mcpServers` JSON above also fits Cline, Cursor (add `"type": "stdio"`), Gemini CLI (`~/.gemini/settings.json`), JetBrains AI Assistant and Junie (`~/.junie/mcp/mcp.json`), Kiro (`~/.kiro/settings/mcp.json`), LM Studio, Qwen Code (`~/.qwen/settings.json`), Roo Code and Warp. VS Code uses `servers` with `"type": "stdio"` in `.vscode/mcp.json`, Zed uses `context_servers`, Continue uses a YAML file in `.continue/mcpServers/`, and Goose takes the command `npx -y shotomatic mcp` as a Standard IO extension. See the README's "Other MCP clients" section for locations.

Before the first use: open Shotomatic, go to Settings > AI agents, turn on "Let AI agents use Shotomatic", and click Allow on the approval card when the agent first connects.
