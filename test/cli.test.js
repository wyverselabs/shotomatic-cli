import assert from "node:assert/strict";
import path from "node:path";
import { PassThrough } from "node:stream";
import { EventEmitter, once } from "node:events";
import test from "node:test";
import { main } from "../src/cli.js";
import { readVersion } from "../src/version.js";
import { makeTempDir, removeDir, runBin, startServer, echoOnConnection, tempServerAddress, darwinOnly, windowsOnly } from "./helpers.js";
import fs from "node:fs";
import { spawn } from "node:child_process";

const capture = () => {
  const chunks = [];
  const stream = new PassThrough();
  stream.on("data", (chunk) => chunks.push(chunk));
  return { stream, text: () => Buffer.concat(chunks).toString("utf8") };
};

const run = async (argv, overrides = {}) => {
  const stdout = capture();
  const stderr = capture();
  const code = await main(argv, {
    env: {},
    platform: "darwin",
    homedir: "/nonexistent-home",
    stdin: new PassThrough(),
    stdout: stdout.stream,
    stderr: stderr.stream,
    signals: new EventEmitter(),
    launcher: async () => {
      throw new Error("launcher must not run");
    },
    ...overrides,
  });
  return { code, stdout: stdout.text(), stderr: stderr.text() };
};

test("--help and mcp --help print usage to stdout and exit 0", async () => {
  const top = await run(["--help"]);
  assert.equal(top.code, 0);
  assert.match(top.stdout, /Usage: shotomatic <command>/);
  const mcp = await run(["mcp", "--help"]);
  assert.equal(mcp.code, 0);
  assert.match(mcp.stdout, /--no-launch/);
  assert.equal(mcp.stderr, "");
});

test("--version prints the package version", async () => {
  const result = await run(["--version"]);
  assert.equal(result.code, 0);
  assert.equal(result.stdout.trim(), readVersion());
  assert.equal(readVersion(), "0.2.0");
});

test("unknown command prints usage to stderr and exits 2", async () => {
  const result = await run(["bogus"]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /Unknown command "bogus"/);
  assert.match(result.stderr, /Usage: shotomatic/);
  assert.equal(result.stdout, "");
});

test("no command and invalid options exit 2", async () => {
  assert.equal((await run([])).code, 2);
  assert.equal((await run(["mcp", "--wait", "soon"])).code, 2);
  assert.equal((await run(["mcp", "--nope"])).code, 2);
});

test("platforms other than macOS and Windows get a clear message and a non-zero exit", async () => {
  const result = await run(["mcp"], { platform: "linux" });
  assert.equal(result.code, 15);
  assert.match(result.stderr, /only runs on macOS and Windows/);
});

test("on Windows the bridge relays through the pipe named in the profile", windowsOnly, async () => {
  const dir = makeTempDir();
  const pipe = tempServerAddress(dir);
  const server = await startServer(pipe, echoOnConnection);
  try {
    fs.mkdirSync(path.join(dir, "Shotomatic", "mcp"), { recursive: true });
    fs.writeFileSync(path.join(dir, "Shotomatic", "mcp", "pipe"), pipe);
    const input = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n';
    const { exited } = runBin(["mcp"], { env: { APPDATA: dir, USERPROFILE: dir }, input });
    const result = await exited;
    assert.equal(result.code, 0);
    assert.equal(result.stdout.toString("utf8"), input);
  } finally {
    server.close();
    removeDir(dir);
  }
});

test("on Windows the bridge relays through the pipe the Microsoft Store app names in the user's profile", windowsOnly, async () => {
  const dir = makeTempDir();
  const pipe = tempServerAddress(dir);
  const server = await startServer(pipe, echoOnConnection);
  try {
    fs.mkdirSync(path.join(dir, ".shotomatic", "mcp"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".shotomatic", "mcp", "pipe"), pipe);
    const input = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n';
    const { exited } = runBin(["mcp"], { env: { APPDATA: path.join(dir, "Roaming"), USERPROFILE: dir }, input });
    const result = await exited;
    assert.equal(result.code, 0);
    assert.equal(result.stdout.toString("utf8"), input);
  } finally {
    server.close();
    removeDir(dir);
  }
});

test("on Windows a pipe name left behind by a crashed app is reported as stale", windowsOnly, async () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, "Shotomatic", "mcp"), { recursive: true });
    fs.writeFileSync(path.join(dir, "Shotomatic", "mcp", "pipe"), tempServerAddress(dir));
    const result = await run(["mcp"], { platform: "win32", env: { APPDATA: dir } });
    assert.equal(result.code, 12);
    assert.match(result.stderr, /no longer exists/);
  } finally {
    removeDir(dir);
  }
});

test("on Windows a profile without a published pipe name means the app is not running", windowsOnly, async () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, "Shotomatic", "mcp"), { recursive: true });
    const result = await run(["mcp"], { platform: "win32", env: { APPDATA: dir } });
    assert.equal(result.code, 14);
    assert.match(result.stderr, /cannot start it on Windows/);
  } finally {
    removeDir(dir);
  }
});

test("app not installed: profile directory absent with --no-launch", darwinOnly, async () => {
  const dir = makeTempDir();
  try {
    const socket = path.join(dir, "Missing App", "mcp", "mcp.sock");
    const result = await run(["mcp", "--no-launch", "--socket", socket]);
    assert.equal(result.code, 10);
    assert.match(result.stderr, /Install Shotomatic for Mac/);
    assert.equal(result.stdout, "");
  } finally {
    removeDir(dir);
  }
});

test("MCP access off: profile exists but socket directory is absent", darwinOnly, async () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, "Shotomatic"));
    const socket = path.join(dir, "Shotomatic", "mcp", "mcp.sock");
    const result = await run(["mcp", "--no-launch", "--socket", socket]);
    assert.equal(result.code, 11);
    assert.match(result.stderr, /Settings/);
    assert.match(result.stderr, /MCP access/);
  } finally {
    removeDir(dir);
  }
});

test("stale socket: file exists but refuses connections", darwinOnly, async () => {
  const dir = makeTempDir();
  try {
    const socket = path.join(dir, "s.sock");
    const owner = spawn(process.execPath, [
      "-e",
      `require("net").createServer().listen(process.argv[1], () => console.log("ready"))`,
      socket,
    ]);
    await once(owner.stdout, "data");
    owner.kill("SIGKILL");
    await once(owner, "exit");
    assert.ok(fs.existsSync(socket));
    const result = await run(["mcp", "--no-launch", "--socket", socket]);
    assert.equal(result.code, 12);
    assert.match(result.stderr, /refuses connections/);
  } finally {
    removeDir(dir);
  }
});

test("permission denied on the socket", darwinOnly, async (t) => {
  if (process.getuid?.() === 0) return t.skip("root bypasses socket permissions");
  const dir = makeTempDir();
  try {
    const socket = path.join(dir, "s.sock");
    const server = await startServer(socket, echoOnConnection);
    fs.chmodSync(socket, 0o000);
    const result = await run(["mcp", "--no-launch", "--socket", socket]);
    server.close();
    assert.equal(result.code, 13);
    assert.match(result.stderr, /Permission denied/);
  } finally {
    removeDir(dir);
  }
});

test("app not running with --no-launch and an existing directory", darwinOnly, async () => {
  const dir = makeTempDir();
  try {
    const result = await run(["mcp", "--no-launch", "--socket", path.join(dir, "s.sock")]);
    assert.equal(result.code, 14);
    assert.match(result.stderr, /not running/);
  } finally {
    removeDir(dir);
  }
});

test("timeout after launching the app once", darwinOnly, async () => {
  const dir = makeTempDir();
  try {
    let launches = 0;
    const started = Date.now();
    const result = await run(["mcp", "--wait", "0.6", "--app-name", "Shotomatic (QA)", "--socket", path.join(dir, "s.sock")], {
      launcher: async (name) => {
        launches += 1;
        assert.equal(name, "Shotomatic (QA)");
        return true;
      },
    });
    assert.equal(launches, 1);
    assert.equal(result.code, 14);
    assert.match(result.stderr, /Timed out after 0.6s/);
    assert.ok(Date.now() - started < 3000);
  } finally {
    removeDir(dir);
  }
});

test("launch failure maps to app not installed", darwinOnly, async () => {
  const dir = makeTempDir();
  try {
    const result = await run(["mcp", "--app-name", "Nope", "--socket", path.join(dir, "s.sock")], {
      launcher: async () => false,
    });
    assert.equal(result.code, 10);
  } finally {
    removeDir(dir);
  }
});

test("connects after the launched app creates its socket, and never launches twice", darwinOnly, async () => {
  const dir = makeTempDir();
  let server;
  try {
    const socket = path.join(dir, "s.sock");
    let launches = 0;
    const stdin = new PassThrough();
    const stdout = capture();
    const pending = main(["mcp", "--app-name", "Shotomatic (QA)", "--socket", socket], {
      env: {},
      platform: "darwin",
      stdin,
      stdout: stdout.stream,
      stderr: capture().stream,
      signals: new EventEmitter(),
      launcher: async () => {
        launches += 1;
        setTimeout(async () => {
          server = await startServer(socket, echoOnConnection);
        }, 300);
        return true;
      },
    });
    stdin.end("{\"a\":1}\n");
    assert.equal(await pending, 0);
    assert.equal(launches, 1);
    assert.equal(stdout.text(), "{\"a\":1}\n");
  } finally {
    server?.close();
    removeDir(dir);
  }
});

test("explicit socket without an app name never launches", darwinOnly, async () => {
  const dir = makeTempDir();
  try {
    const result = await run(["mcp", "--socket", path.join(dir, "s.sock")]);
    assert.equal(result.code, 14);
  } finally {
    removeDir(dir);
  }
});

test("a normal failure-free session writes nothing to stderr, --verbose writes diagnostics", darwinOnly, async () => {
  const dir = makeTempDir();
  let server;
  try {
    const socket = path.join(dir, "s.sock");
    server = await startServer(socket, echoOnConnection);
    const quiet = runBin(["mcp", "--socket", socket], { input: "{}\n" });
    const quietResult = await quiet.exited;
    assert.equal(quietResult.stderr, "");
    const loud = runBin(["mcp", "--verbose", "--socket", socket], { input: "{}\n" });
    const loudResult = await loud.exited;
    assert.match(loudResult.stderr, /connected/);
    assert.equal(loudResult.stdout.toString(), "{}\n");
  } finally {
    server?.close();
    removeDir(dir);
  }
});

test("--app-name rejects paths so the launcher can only open a profile by name", async () => {
  for (const name of ["/Applications/Other.app", "../x", "Other.app", ""]) {
    const result = await run(["mcp", "--app-name", name]);
    assert.equal(result.code, 2, name);
    assert.match(result.stderr, /Invalid app name/);
    assert.equal(result.stdout, "");
  }
});

test("a socket path longer than a Unix socket allows gets a clear error, not EINVAL", darwinOnly, async () => {
  const long = path.join("/tmp", "x".repeat(120), "s.sock");
  const result = await run(["mcp", "--no-launch", "--socket", long]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /too long/);
  assert.equal(result.stdout, "");
});
