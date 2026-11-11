import assert from "node:assert/strict";
import test from "node:test";
import { defaultSocketPath, resolveTarget } from "../src/socketPath.js";

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

test("on Windows the default target is the pipe name file in the app's roaming profile, and never launches", () => {
  const env = { APPDATA: "C:\\Users\\someone\\AppData\\Roaming" };
  assert.deepEqual(resolveTarget({ homedir: "C:\\Users\\someone", platform: "win32", env }), {
    pipeNameFile: "C:\\Users\\someone\\AppData\\Roaming\\Shotomatic\\mcp\\pipe",
    appName: "Shotomatic",
    canLaunch: false,
  });
});

test("on Windows a named profile falls back to the home folder when APPDATA is unset", () => {
  const target = resolveTarget({ homedir: "C:\\Users\\someone", appName: "Shotomatic (Dev)", platform: "win32", env: {} });
  assert.equal(target.pipeNameFile, "C:\\Users\\someone\\AppData\\Roaming\\Shotomatic (Dev)\\mcp\\pipe");
});

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
