/** Build public peer packages from one exact Studio commit and verify their bytes. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type PeerArtifact = {
  name: string;
  version: string;
  file: string;
  sha256: string;
};
export type PeerManifest = {
  studioCommit: string;
  packages: PeerArtifact[];
  overrides?: Record<string, string>;
};
const run = (cwd: string, args: string[]) =>
  execFileSync("pnpm", args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, pnpm_config_verify_deps_before_run: "never" },
  });
const hash = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
export const verifyPeers = (directory: string): PeerManifest => {
  const manifest = JSON.parse(
    readFileSync(path.join(directory, "peers.json"), "utf8"),
  ) as PeerManifest;
  if (
    !/^[a-f0-9]{40}$/.test(manifest.studioCommit) ||
    !Array.isArray(manifest.packages)
  )
    throw Error("invalid_peer_manifest");
  const names = new Set<string>();
  for (const peer of manifest.packages) {
    if (
      !/^@sva\/[a-z0-9-]+$/.test(peer.name) ||
      names.has(peer.name) ||
      !/^[a-z0-9.-]+\.tgz$/.test(peer.file) ||
      hash(path.join(directory, peer.file)) !== peer.sha256
    )
      throw Error("invalid_peer_artifact");
    names.add(peer.name);
  }
  if (!names.has("@sva/plugin-sdk") || !names.has("@sva/studio-ui-react"))
    throw Error("public_peers_required");
  return manifest;
};
export const preparePeers = (
  studioRoot: string,
  directory: string,
): PeerManifest => {
  const studioCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: studioRoot,
    encoding: "utf8",
  }).trim();
  if (
    execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: studioRoot,
      encoding: "utf8",
    }).trim()
  )
    throw Error("clean_committed_studio_required");
  mkdirSync(directory, { recursive: true });
  run(studioRoot, [
    "nx",
    "run-many",
    "-t",
    "build",
    "-p",
    "plugin-sdk,studio-ui-react",
    "--parallel=1",
  ]);
  const packages: PeerArtifact[] = [];
  const visited = new Set<string>();
  const pack = (name: string) => {
    if (visited.has(name)) return;
    visited.add(name);
    const packageRoot = path.join(
      studioRoot,
      "packages",
      name.slice("@sva/".length),
    );
    const pkg = JSON.parse(
      readFileSync(path.join(packageRoot, "package.json"), "utf8"),
    ) as {
      name: string;
      version: string;
      dependencies?: Record<string, string>;
    };
    for (const [dependency, version] of Object.entries(
      pkg.dependencies ?? {},
    )) {
      if (dependency.startsWith("@sva/") && version.startsWith("workspace:"))
        pack(dependency);
    }
    execFileSync("pnpm", ["pack", "--pack-destination", directory, "--json"], {
      cwd: packageRoot,
      stdio: ["ignore", "pipe", "inherit"],
    });
    const file = `${name.replace("@", "").replace("/", "-")}-${pkg.version}.tgz`;
    packages.push({
      name,
      version: pkg.version,
      file,
      sha256: hash(path.join(directory, file)),
    });
  };
  pack("@sva/plugin-sdk");
  pack("@sva/studio-ui-react");
  const studioOverrides = JSON.parse(
    execFileSync("pnpm", ["config", "get", "overrides", "--json"], {
      cwd: studioRoot,
      encoding: "utf8",
    }),
  ) as Record<string, string>;
  const overrides = Object.fromEntries(
    Object.entries(studioOverrides).filter(([name]) =>
      name.startsWith("@tiptap/") || name === "postcss",
    ),
  );
  const manifest = { studioCommit, packages, overrides };
  writeFileSync(
    path.join(directory, "peers.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return verifyPeers(directory);
};
export const peerOverrides = (
  directory: string,
  manifest = verifyPeers(directory),
) => ({
  ...manifest.overrides,
  ...Object.fromEntries(
    manifest.packages.map((peer) => [
      peer.name,
      `file:${path.join(directory, peer.file)}`,
    ]),
  ),
});
const sourceFiles = ["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml"];
export const installPeers = (root: string, directory: string) => {
  const manifest = verifyPeers(directory);
  const backup = path.join(root, ".artifacts/source");
  mkdirSync(backup, { recursive: true });
  const marker = path.join(backup, "active");
  if (existsSync(marker))
    throw Error("peer_install_already_active_restore_first");
  writeFileSync(marker, "", { flag: "wx" });
  for (const file of sourceFiles) {
    const target = path.join(backup, file);
    writeFileSync(target, readFileSync(path.join(root, file)));
  }
  writeFileSync(
    path.join(root, "pnpm-workspace.yaml"),
    JSON.stringify(
      {
        ...JSON.parse(
          readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8"),
        ),
        autoInstallPeers: true,
        strictPeerDependencies: true,
        overrides: {
          ...JSON.parse(
            readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8"),
          ).overrides,
          ...peerOverrides(directory, manifest),
        },
      },
      null,
      2,
    ),
  );
  run(root, [
    "add",
    "--save-dev",
    ...manifest.packages
      .filter((peer) =>
        ["@sva/plugin-sdk", "@sva/studio-ui-react"].includes(peer.name),
      )
      .map((peer) => `${peer.name}@file:${path.join(directory, peer.file)}`),
  ]);
};
export const restoreSource = (root: string) => {
  const marker = path.join(root, ".artifacts/source/active");
  if (!existsSync(marker)) throw Error("peer_install_not_active");
  for (const file of sourceFiles)
    writeFileSync(
      path.join(root, file),
      readFileSync(path.join(root, ".artifacts/source", file)),
    );
  rmSync(marker);
};
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [command, first, second] = process.argv.slice(2);
  if (command === "prepare" && first && second)
    preparePeers(path.resolve(first), path.resolve(second));
  else if (command === "install" && first)
    installPeers(process.cwd(), path.resolve(first));
  else if (command === "verify" && first) verifyPeers(path.resolve(first));
  else if (command === "restore") restoreSource(process.cwd());
  else
    throw Error(
      "usage: studio-peers.ts prepare STUDIO OUTPUT | install PEERS | verify PEERS | restore",
    );
}
