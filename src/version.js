import { readFileSync } from "node:fs";

export const readVersion = () => {
  const manifest = new URL("../package.json", import.meta.url);
  return JSON.parse(readFileSync(manifest, "utf8")).version;
};
