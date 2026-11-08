// @vitest-environment node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
const originalArgv = process.argv;
const studioCommit = "a".repeat(40);
const pluginCommit = "b".repeat(40);
let root: string;
let studio: string;
let candidate: string;
let currentCommit: string;
const files = ["apps/sva-studio-react/package.json", "apps/sva-studio-react/plugin-catalog.json", "pnpm-lock.yaml"];
let originals: string[];

const run = async (command: string) => {
  vi.resetModules();
  process.argv = ["node", "host-candidate.ts", command, studio, candidate];
  await import("./host-candidate.ts");
};
const catalog = () => JSON.parse(readFileSync(path.join(studio, files[1]!), "utf8")) as {pluginId: string; sourceRef: string}[];

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "plugin-host-candidate-"));
  studio = path.join(root, "studio");
  candidate = path.join(root, "candidate");
  currentCommit = studioCommit;
  vi.spyOn(process, "cwd").mockReturnValue(root);
  mkdirSync(path.join(studio, "apps/sva-studio-react"), { recursive: true });
  originals = [JSON.stringify({ dependencies: { "@sva/plugin-application-workspace": "https://release.test/plugin.tgz" } }), JSON.stringify([{pluginId: "news", sourceRef: "packages/plugin-news"}, {pluginId: "application-workspace", sourceRef: "@sva/plugin-application-workspace"}]), "original-lock\n"];
  files.forEach((file, i) => writeFileSync(path.join(studio, file), originals[i]!));
  mkdirSync(path.join(candidate, "candidate"), { recursive: true });
  mkdirSync(path.join(candidate, "evidence"), { recursive: true });
  writeFileSync(path.join(candidate, "candidate/plugin.tgz"), "attested-package");
  writeFileSync(path.join(candidate, "evidence/candidate.json"), JSON.stringify({pluginCommit, studioCommit, file: "plugin.tgz", sha256: createHash("sha256").update("attested-package").digest("hex")}));
  vi.mocked(execFileSync).mockImplementation((file, args, options) => {
    if (file === "git") return args?.[0] === "status" ? "" : options && "cwd" in options && options.cwd === studio ? currentCommit : pluginCommit;
    if (file === "pnpm") {
      const pkgFile = path.join(studio, files[0]!);
      const pkg = JSON.parse(readFileSync(pkgFile, "utf8")) as {dependencies: Record<string, string>};
      if (args?.includes("remove")) delete pkg.dependencies["@sva/plugin-application-workspace"];
      else pkg.dependencies["@sva/plugin-application-workspace"] = path.join(candidate, "candidate/plugin.tgz");
      writeFileSync(pkgFile, JSON.stringify(pkg));
      writeFileSync(path.join(studio, files[2]!), "changed-lock\n");
    }
    return "";
  });
});
afterEach(() => {
  process.argv = originalArgv;
  vi.restoreAllMocks();
  vi.clearAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe("host candidate lifecycle", () => {
  it("replaces a preinstalled release once and restores exact metadata after the negative build", async () => {
    await run("install");
    expect(catalog().map(entry => entry.pluginId)).toEqual(["news", "application-workspace"]);
    expect(readFileSync(path.join(studio, files[0]!), "utf8")).toContain("candidate/plugin.tgz");
    await run("uninstall");
    expect(catalog().map(entry => entry.pluginId)).toEqual(["news"]);
    expect(readFileSync(path.join(studio, files[0]!), "utf8")).not.toContain("@sva/plugin-application-workspace");
    await run("restore");
    files.forEach((file, i) => expect(readFileSync(path.join(studio, file), "utf8")).toBe(originals[i]));
  });

  it("also installs and removes a candidate on a host without the optional plugin", async () => {
    writeFileSync(path.join(studio, files[0]!), '{"dependencies":{}}');
    writeFileSync(path.join(studio, files[1]!), '[]');
    await run("install");
    expect(catalog()).toHaveLength(1);
    await run("uninstall");
    expect(catalog()).toEqual([]);
    await run("restore");
    expect(readFileSync(path.join(studio, files[0]!), "utf8")).toBe('{"dependencies":{}}');
  });

  it("rejects changed host identity before uninstalling or restoring", async () => {
    await run("install");
    currentCommit = "c".repeat(40);
    await expect(run("uninstall")).rejects.toThrow("host_restore_identity_changed");
    await expect(run("restore")).rejects.toThrow("host_restore_identity_changed");
    expect(catalog()).toHaveLength(2);
  });

  it("rejects changed package bytes before touching host metadata", async () => {
    writeFileSync(path.join(candidate, "candidate/plugin.tgz"), "changed-package");
    await expect(run("install")).rejects.toThrow("candidate_digest_mismatch");
    files.forEach((file, i) => expect(readFileSync(path.join(studio, file), "utf8")).toBe(originals[i]));
  });
});
