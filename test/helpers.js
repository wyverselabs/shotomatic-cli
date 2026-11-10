import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

export const BIN = fileURLToPath(new URL("../bin/shotomatic.js", import.meta.url));

export const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "shm-"));
export const removeDir = (dir) => fs.rmSync(dir, { recursive: true, force: true });

export const startServer = async (socketPath, onConnection) => {
  const connections = new Set();
  const server = net.createServer({ allowHalfOpen: true }, (socket) => {
    connections.add(socket);
    socket.on("close", () => connections.delete(socket));
    socket.on("error", () => {});
    onConnection(socket);
  });
  server.listen(socketPath);
  await once(server, "listening");
  return {
    close: () => {
      for (const socket of connections) socket.destroy();
      server.close();
    },
  };
};

export const echoOnConnection = (socket) => {
  socket.pipe(socket);
};

export const runBin = (args, { env = {}, input } = {}) => {
  const child = spawn(process.execPath, [BIN, ...args], {
    env: { ...process.env, SHOTOMATIC_MCP_SOCKET: "", SHOTOMATIC_APP_NAME: "", ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const out = [];
  const err = [];
  child.stdout.on("data", (chunk) => out.push(chunk));
  child.stderr.on("data", (chunk) => err.push(chunk));
  child.stdin.on("error", () => {});
  if (input !== undefined) child.stdin.end(input);
  const exited = new Promise((resolve) =>
    child.on("close", (code, signal) =>
      resolve({ code, signal, stdout: Buffer.concat(out), stderr: Buffer.concat(err).toString("utf8") }),
    ),
  );
  return { child, exited };
};

export const darwinOnly = { skip: process.platform !== "darwin" && "bridge is macOS only" };
