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
