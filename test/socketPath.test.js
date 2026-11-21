import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { defaultSocketPath, latestPipeNameFile, resolveTarget } from "../src/socketPath.js";
import { makeTempDir, removeDir } from "./helpers.js";

const homedir = "/Users/someone";

test("default socket path for the stable app", () => {
  assert.equal(
    defaultSocketPath({ homedir }),
    "/Users/someone/Library/Application Support/Shotomatic/mcp/mcp.sock",
  );
});

test("socket path for a named profile", () => {
  assert.equal(
    defaultSocketPath({ homedir, appName: "Shotomatic (Dev)" }),
    "/Users/someone/Library/Application Support/Shotomatic (Dev)/mcp/mcp.sock",
  );
});

test("explicit socket wins over app name and disables launching unless an app name is given", () => {
  const explicit = resolveTarget({ socket: "/tmp/a.sock", homedir });
  assert.deepEqual(explicit, { socketPath: "/tmp/a.sock", appName: "Shotomatic", canLaunch: false });
  const both = resolveTarget({ socket: "/tmp/a.sock", appName: "Shotomatic (QA)", homedir });
  assert.equal(both.socketPath, "/tmp/a.sock");
  assert.equal(both.canLaunch, true);
});

test("default target can launch", () => {
  assert.equal(resolveTarget({ homedir }).canLaunch, true);
});

test("on Windows the default target looks for the Store app's and the website app's pipe name files, and never launches", () => {
  const env = { APPDATA: "D:\\Roaming" };
  assert.deepEqual(resolveTarget({ homedir: "C:\\Users\\someone", platform: "win32", env }), {
    pipeNameFiles: ["C:\\Users\\someone\\.shotomatic\\mcp\\pipe", "D:\\Roaming\\Shotomatic\\mcp\\pipe"],
    appName: "Shotomatic",
    canLaunch: false,
  });
});

test("on Windows a named profile only uses its roaming profile, falling back to the home folder when APPDATA is unset", () => {
  const target = resolveTarget({ homedir: "C:\\Users\\someone", appName: "Shotomatic (Dev)", platform: "win32", env: {} });
  assert.deepEqual(target.pipeNameFiles, ["C:\\Users\\someone\\AppData\\Roaming\\Shotomatic (Dev)\\mcp\\pipe"]);
});

const withFiles = (body) => {
  const dir = makeTempDir();
  const write = (name, secondsAgo) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, name);
    const time = new Date(Date.now() - secondsAgo * 1000);
    fs.utimesSync(file, time, time);
    return file;
  };
  try {
    body({ write, missing: (name) => path.join(dir, name) });
  } finally {
    removeDir(dir);
  }
};

test("the pipe name file that exists is read, whichever location it is in", () =>
  withFiles(({ write, missing }) => {
    assert.equal(latestPipeNameFile([missing("store"), missing("website")]), undefined);
    const website = write("website", 60);
    assert.equal(latestPipeNameFile([missing("store"), website]), website);
    fs.rmSync(website);
    const store = write("store", 60);
    assert.equal(latestPipeNameFile([store, website]), store);
  }));

test("when both locations hold a pipe name file, the one written last is read", () =>
  withFiles(({ write }) => {
    const older = write("older", 3600);
    const newer = write("newer", 5);
    assert.equal(latestPipeNameFile([older, newer]), newer);
    assert.equal(latestPipeNameFile([newer, older]), newer);
  }));

test("on Windows an explicit pipe is used as given and never launches", () => {
  const target = resolveTarget({
    socket: "\\\\.\\pipe\\shotomatic-mcp-test",
    appName: "Shotomatic (QA)",
    homedir: "C:\\Users\\someone",
    platform: "win32",
    env: {},
  });
  assert.deepEqual(target, { socketPath: "\\\\.\\pipe\\shotomatic-mcp-test", appName: "Shotomatic (QA)", canLaunch: false });
});
