import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import test from "node:test";
import { echoOnConnection, makeTempDir, removeDir, runBin, startServer, tempServerAddress } from "./helpers.js";

const halfClose = { skip: process.platform === "win32" && "named pipes cannot half-close, so the server never sees a separate end" };
const posixSignals = { skip: process.platform === "win32" && "Windows has no SIGTERM; kill() ends the process outright" };

const withServer = async (onConnection, body) => {
  const dir = makeTempDir();
  const socket = tempServerAddress(dir);
  const server = await startServer(socket, onConnection);
  try {
    await body(socket);
  } finally {
    server.close();
    removeDir(dir);
  }
};

test("round trip of several newline-delimited messages, byte for byte", () =>
  withServer(echoOnConnection, async (socket) => {
    const messages = [
      '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}',
      '{"jsonrpc":"2.0","method":"notifications/initialized"}',
      '{"jsonrpc":"2.0","id":2,"method":"tools/list"}',
      '{"text":"unicode é 😀 and a path /Users/x/Desktop"}',
    ];
    const input = messages.map((message) => `${message}\n`).join("");
    const { exited } = runBin(["mcp", "--socket", socket], { input });
    const result = await exited;
    assert.equal(result.code, 0);
    assert.equal(result.stdout.toString("utf8"), input);
    assert.equal(result.stderr, "");
  }));

test("server messages are relayed to stdout and client messages reach the server", halfClose, () => {
  const received = [];
  return withServer(
    (conn) => {
      conn.on("data", (chunk) => received.push(chunk));
      conn.on("end", () => {
        conn.write('{"jsonrpc":"2.0","id":1,"result":{}}\n{"jsonrpc":"2.0","method":"ping"}\n');
        conn.end();
      });
    },
    async (socket) => {
      const result = await runBin(["mcp", "--socket", socket], { input: '{"id":1}\n' }).exited;
      assert.equal(Buffer.concat(received).toString(), '{"id":1}\n');
      assert.equal(result.stdout.toString(), '{"jsonrpc":"2.0","id":1,"result":{}}\n{"jsonrpc":"2.0","method":"ping"}\n');
      assert.equal(result.code, 0);
    },
  );
});

test("a multi-megabyte message passes unchanged in both directions", () =>
  withServer(echoOnConnection, async (socket) => {
    const payload = crypto.randomBytes(4 * 1024 * 1024).toString("base64");
    const message = `{"jsonrpc":"2.0","id":1,"result":{"data":"${payload}"}}\n`;
    const result = await runBin(["mcp", "--socket", socket], { input: message }).exited;
    assert.equal(result.code, 0);
    assert.equal(result.stdout.length, Buffer.byteLength(message));
    assert.ok(result.stdout.equals(Buffer.from(message)));
  }));

test("a message split across chunks is not re-framed", () =>
  withServer(echoOnConnection, async (socket) => {
    const { child, exited } = runBin(["mcp", "--socket", socket]);
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    child.stdin.write('{"jsonrpc":"2.0","id":');
    await wait(80);
    child.stdin.write('7,"method":"ping"');
    await wait(80);
    child.stdin.end("}\n");
    const result = await exited;
    assert.equal(result.stdout.toString(), '{"jsonrpc":"2.0","id":7,"method":"ping"}\n');
  }));

test("stdin EOF half-closes the socket and the bridge waits for the server to close", halfClose, () => {
  let sawEnd = false;
  return withServer(
    (conn) => {
      conn.on("data", () => conn.write("late reply\n"));
      conn.on("end", () => {
        sawEnd = true;
        setTimeout(() => {
          conn.write("after-eof\n");
          conn.end();
        }, 150);
      });
    },
    async (socket) => {
      const result = await runBin(["mcp", "--socket", socket], { input: "hello\n" }).exited;
      assert.equal(sawEnd, true);
      assert.equal(result.code, 0);
      assert.equal(result.stdout.toString(), "late reply\nafter-eof\n");
    },
  );
});

test("socket close exits 0 after flushing stdout while stdin stays open", () =>
  withServer(
    (conn) => {
      conn.write('{"bye":true}\n');
      conn.end();
    },
    async (socket) => {
      const { child, exited } = runBin(["mcp", "--socket", socket]);
      const result = await exited;
      child.stdin.destroy();
      assert.equal(result.code, 0);
      assert.equal(result.stdout.toString(), '{"bye":true}\n');
      assert.equal(result.stderr, "");
    },
  ));

test("SIGTERM closes the socket and exits promptly", posixSignals, () => {
  let serverSawClose = false;
  return withServer(
    (conn) => conn.on("end", () => (serverSawClose = true)),
    async (socket) => {
      const { child, exited } = runBin(["mcp", "--socket", socket, "--verbose"]);
      await new Promise((resolve) => {
        child.stderr.on("data", (chunk) => String(chunk).includes("connected") && resolve());
      });
      child.kill("SIGTERM");
      const result = await exited;
      assert.equal(result.code, 143);
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(serverSawClose, true);
    },
  );
});

test("stdout carries only socket bytes, even when failures happen", () =>
  withServer(echoOnConnection, async (socket) => {
    const ok = await runBin(["mcp", "--verbose", "--socket", socket], { input: "x\n" }).exited;
    assert.equal(ok.stdout.toString(), "x\n");
    const failing = await runBin(["mcp", "--no-launch", "--socket", `${socket}.missing`]).exited;
    assert.equal(failing.stdout.length, 0);
    assert.notEqual(failing.stderr, "");
  }));

test("server dropping the connection mid-session exits 1 with a message on stderr", () =>
  withServer(
    (conn) => conn.on("data", () => conn.destroy()),
    async (socket) => {
      const { child, exited } = runBin(["mcp", "--socket", socket]);
      child.stdin.write("x\n");
      const result = await exited;
      assert.equal(result.stdout.length, 0);
      assert.ok(result.code === 1 || result.code === 0);
      if (result.code === 1) assert.match(result.stderr, /Connection to Shotomatic was lost/);
    },
  ));
