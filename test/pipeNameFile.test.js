import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { connectWithLaunch } from "../src/connectWithLaunch.js";
import { makeTempDir, removeDir, startServer, tempServerAddress } from "./helpers.js";

const connect = (pipeNameFiles) =>
  connectWithLaunch({
    target: { pipeNameFiles, appName: "Shotomatic", canLaunch: false },
    platform: "win32",
    launch: true,
    waitSeconds: 0,
    launcher: async () => {
      throw new Error("launcher must not run");
    },
    log: () => {},
    interrupt: new AbortController().signal,
  });

const withInstalls = async (body) => {
  const dir = makeTempDir();
  const store = path.join(dir, "home", ".shotomatic", "mcp", "pipe");
  const website = path.join(dir, "roaming", "Shotomatic", "mcp", "pipe");
  const publish = (file, pipeName, secondsAgo) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, pipeName);
    const time = new Date(Date.now() - secondsAgo * 1000);
    fs.utimesSync(file, time, time);
  };
  const deadPipe = tempServerAddress(path.join(dir, "gone"));
  const livePipe = tempServerAddress(dir);
  const server = await startServer(livePipe, () => {});
  try {
    await body({ store, website, publish, livePipe, deadPipe });
  } finally {
    server.close();
    removeDir(dir);
  }
};

const rejectsWith = (promise, exitCode, ...mentioned) =>
  assert.rejects(promise, (error) => {
    assert.equal(error.exitCode, exitCode);
    for (const text of mentioned) assert.ok(error.message.includes(text), `${error.message} should mention ${text}`);
    return true;
  });

test("on Windows the bridge reads the Microsoft Store app's pipe name file when the website profile has none", () =>
  withInstalls(async ({ store, website, publish, livePipe }) => {
    publish(store, livePipe, 0);
    const socket = await connect([store, website]);
    socket.destroy();
  }));

test("on Windows, when both installs left a pipe name file, the bridge reads the one written last", () =>
  withInstalls(async ({ store, website, publish, livePipe, deadPipe }) => {
    publish(store, deadPipe, 3600);
    publish(website, livePipe, 5);
    (await connect([store, website])).destroy();

    publish(store, livePipe, 5);
    publish(website, deadPipe, 3600);
    (await connect([store, website])).destroy();
  }));

test("on Windows a stale pipe name is reported with the file it was read from", () =>
  withInstalls(async ({ store, website, publish, deadPipe }) => {
    publish(website, deadPipe, 0);
    await rejectsWith(connect([store, website]), 12, website, "no longer exists");
  }));

test("on Windows, with no pipe name file in either location, the app is not running and both files are named", () =>
  withInstalls(async ({ store, website }) => {
    fs.mkdirSync(path.dirname(store), { recursive: true });
    await rejectsWith(connect([store, website]), 14, store, website);
  }));

test("on Windows either install's profile means installed, and both MCP folders are named when neither exists", () =>
  withInstalls(async ({ store, website }) => {
    await rejectsWith(connect([store, website]), 10, "Install Shotomatic for Windows");
    fs.mkdirSync(path.dirname(path.dirname(store)), { recursive: true });
    await rejectsWith(connect([store, website]), 11, path.dirname(store), path.dirname(website));
  }));
