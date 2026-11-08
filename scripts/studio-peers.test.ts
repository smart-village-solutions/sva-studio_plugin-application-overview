import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, it, expect, vi } from "vitest";
import { verifyPeers, installPeers, restoreSource } from "./studio-peers.ts";
vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { force: true, recursive: true });
});
const fixture = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "studio-peer-test-"));
  dirs.push(dir);
  const packages = ["plugin-sdk", "studio-ui-react"].map((name) => {
    writeFileSync(path.join(dir, `${name}.tgz`), name);
    return {
      name: `@sva/${name}`,
      file: `${name}.tgz`,
      version: "0.0.1",
      sha256: createHash("sha256").update(name).digest("hex"),
    };
  });
  const manifest = { studioCommit: "a".repeat(40), packages };
  writeFileSync(path.join(dir, "peers.json"), JSON.stringify(manifest));
  return { dir, manifest };
};
it("accepts identified public peers and detects replaced bytes", () => {
  const { dir } = fixture();
  expect(verifyPeers(dir).packages).toHaveLength(2);
  writeFileSync(path.join(dir, "plugin-sdk.tgz"), "replaced");
  expect(() => verifyPeers(dir)).toThrow("invalid_peer_artifact");
});
it("rejects path escapes, duplicate packages and mutable commit identifiers", () => {
  for (const mode of ["escape", "duplicate", "branch"]) {
    const { dir, manifest } = fixture();
    if (mode === "escape") manifest.packages[0]!.file = "../outside.tgz";
    if (mode === "duplicate") manifest.packages.push(manifest.packages[0]!);
    if (mode === "branch") manifest.studioCommit = "main";
    writeFileSync(path.join(dir, "peers.json"), JSON.stringify(manifest));
    expect(() => verifyPeers(dir)).toThrow();
  }
});
it("requires both public peer contracts", () => {
  const { dir, manifest } = fixture();
  manifest.packages.pop();
  writeFileSync(path.join(dir, "peers.json"), JSON.stringify(manifest));
  expect(() => verifyPeers(dir)).toThrow("public_peers_required");
});

it("preserves source bytes across explicit peer installation and refuses a second active installation", () => {
  const { dir } = fixture();
  const root = path.join(dir, "plugin");
  mkdirSync(root);
  const files = {
    "package.json": '{"name":"test"}\n',
    "pnpm-lock.yaml": "lockfileVersion: 9\n",
    "pnpm-workspace.yaml":
      '{"autoInstallPeers":false,"overrides":{"minimatch":"11.0.1"}}\n',
  };
  for (const [name, data] of Object.entries(files))
    writeFileSync(path.join(root, name), data);
  installPeers(root, dir);
  expect(
    JSON.parse(readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8"))
      .overrides["@sva/plugin-sdk"],
  ).toContain("file:");
  expect(() => installPeers(root, dir)).toThrow(
    "peer_install_already_active_restore_first",
  );
  restoreSource(root);
  for (const [name, data] of Object.entries(files))
    expect(readFileSync(path.join(root, name), "utf8")).toBe(data);
  expect(() => restoreSource(root)).toThrow("peer_install_not_active");
});
