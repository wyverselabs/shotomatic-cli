# MCP registry listing

Materials for listing `shotomatic` in the official MCP registry (https://github.com/modelcontextprotocol/registry). Nothing here has been submitted. This folder is not shipped in the npm package (`files` allowlist).

Every value marked **OWNER** can only be supplied by the owner.

## How the registry works (read from its docs, schema 2025-12-11)

- The registry stores metadata only. The npm package must be published first; `server.json` points at it.
- Ownership of an npm package is checked through an `mcpName` field in the **published** `package.json`. It must equal the `name` in `server.json`. It is not in `package.json` yet because the namespace is an owner decision. Add it before `npm publish`, otherwise the first version cannot be listed and a new version is needed.
- The namespace in `name` follows the login method:
  - GitHub login (`mcp-publisher login github`): `io.github.<user-or-org>/shotomatic`. A personal namespace works with the device login. An organization namespace needs an org Owner and, today, a token or GitHub Actions (`mcp-publisher login github --token ...`), not the device flow.
  - Domain login (DNS TXT record on the apex of the domain, or an HTTP file): `com.shotomatic/shotomatic` for the domain `shotomatic.com`. The owner must control that domain's DNS.
- `description` is limited to 100 characters. `version` must be a concrete version (no ranges, not `latest`), and the package `version` must match what is on npm.
- Submission, run by the owner after `npm publish`:

```sh
mcp-publisher login github      # or: mcp-publisher login dns ...
mcp-publisher validate
mcp-publisher publish
```

## Decisions and values for the owner

| Item | Value |
| ---- | ----- |
| Namespace / server name (**OWNER**) | `io.github.<OWNER-GITHUB-USER-OR-ORG>/shotomatic` or `com.shotomatic/shotomatic`. Put the same string in `package.json` as `"mcpName"` before publishing. |
| GitHub repository URL (**OWNER**) | Not created yet. `repository` is left out of `server.json` until it exists; add `{"url": "https://github.com/<OWNER>/<REPO>", "source": "github"}` here and `repository` in `package.json`. |
| License (**OWNER**) | `package.json` says `UNLICENSED` and there is no LICENSE file. Choose one before publishing publicly. |
| First version | `0.1.0` today. The version in `server.json` (both places) must equal the published npm version. |

## server.json

Replace `NAMESPACE-OWNER` and save as `server.json` in the package root only when publishing.

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "NAMESPACE-OWNER/shotomatic",
  "title": "Shotomatic",
  "description": "Capture screenshots, websites and click-by-click guides in the Shotomatic Mac app and export them.",
  "version": "0.1.0",
  "websiteUrl": "https://shotomatic.com",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "shotomatic",
      "version": "0.1.0",
      "runtimeHint": "npx",
      "transport": {
        "type": "stdio"
      },
      "packageArguments": [
        {
          "type": "positional",
          "value": "mcp"
        }
      ]
    }
  ]
}
```

The description above is 98 characters (the limit is 100). No environment variables are needed.

## Listing text

One line:

> Let AI agents capture screenshots, websites and click-by-click guides in the Shotomatic Mac app and export them as PDF, images or video.

Paragraph:

> Shotomatic is a Mac app for automated, repeatable screenshot capture. This package is a small stdio bridge that lets MCP clients such as Claude Code and Codex talk to the MCP server built into the app, over a local Unix socket. Agents can capture many pages of a window in a row (ebooks, slides), capture websites and run saved Website Capture Workflows, record step-by-step guides, edit the resulting Documents and export them as PDF, PNG, JPG, WebP, ZIP or MP4. Everything stays on your Mac: the bridge has no dependencies and makes no network connections. You turn access on in Settings > AI agents and approve each agent once; deleting items, purging history and scheduling Workflows ask for confirmation in the app. Requires macOS and Shotomatic with AI agents support.

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

Before the first use: open Shotomatic, go to Settings > AI agents, turn on "Let AI agents use Shotomatic", and click Allow on the approval card when the agent first connects.
