/** Verify the exact candidate tarball with public peers outside both source trees. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { peerOverrides, verifyPeers } from "./studio-peers.ts";
const [packageFile, peerDirectory, evidenceDirectory] = process.argv.slice(2);
if (!packageFile || !peerDirectory || !evidenceDirectory)
  throw Error("usage: package-consumer.ts PACKAGE PEERS EVIDENCE");
if (
  execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
    encoding: "utf8",
  }).trim()
)
  throw Error("clean_committed_plugin_required");
const artifact = path.resolve(packageFile),
  peers = path.resolve(peerDirectory),
  evidence = path.resolve(evidenceDirectory);
const manifest = verifyPeers(peers);
const consumer = mkdtempSync(path.join(tmpdir(), "sva-plugin-consumer-"));
const run = (command: string, args: string[]) =>
  execFileSync(command, args, {
    cwd: consumer,
    stdio: "inherit",
    env: { ...process.env, pnpm_config_verify_deps_before_run: "never" },
  });
const digest = () =>
  createHash("sha256").update(readFileSync(artifact)).digest("hex");
const expected = digest();
const files = execFileSync("tar", ["-tzf", artifact], { encoding: "utf8" })
  .trim()
  .split("\n");
if (
  files.some((file) =>
    /(?:^|\/)(?:node_modules|src|\.env)(?:\/|$)|\.test\.[jt]sx?$/.test(file),
  )
)
  throw Error("unexpected_package_source_or_secret");
for (const required of [
  "dist/index.js",
  "dist/descriptor.js",
  "dist/server.js",
  "dist/contract.d.ts",
  "plugin.manifest.json",
  "LICENSE",
  "publiccode.yml",
]) {
  if (!files.includes(`package/${required}`))
    throw Error(`missing_package_file:${required}`);
}
writeFileSync(
  path.join(consumer, "package.json"),
  JSON.stringify(
    {
      private: true,
      type: "module",
      packageManager: "pnpm@11.3.0",
      dependencies: {
        "@sva/plugin-application-workspace": `file:${artifact}`,
        "@sva/plugin-sdk": peerOverrides(peers)["@sva/plugin-sdk"],
        "@sva/studio-ui-react": peerOverrides(peers)["@sva/studio-ui-react"],
        react: "19.3.0",
        "react-dom": "19.3.0",
        "react-hook-form": "7.80.0",
      },
      devDependencies: {
        typescript: "6.0.3",
        "@types/react": "19.3.0",
        "@types/react-dom": "19.3.0",
      },
    },
    null,
    2,
  ),
);
writeFileSync(
  path.join(consumer, "pnpm-workspace.yaml"),
  JSON.stringify({
    autoInstallPeers: true,
    strictPeerDependencies: true,
    overrides: peerOverrides(peers),
  }),
);
run("pnpm", ["install", "--ignore-scripts"]);
writeFileSync(
  path.join(consumer, "consumer.ts"),
  `import { readWorkspaceConfiguration } from '@sva/plugin-application-workspace/contract';
import { createPluginServerHandlers, type ApplicationWorkspaceHost } from '@sva/plugin-application-workspace/server';
const host: ApplicationWorkspaceHost = { read: async () => ({version:0,tiles:[]}), save: async (_context, configuration) => configuration, isIconName: () => true };
const handlers = createPluginServerHandlers(host);
if (Object.keys(handlers).length !== 3) throw Error('missing_public_handlers');
if (readWorkspaceConfiguration({version:0,tiles:[]}).version !== 0) throw Error('invalid_public_contract');
if ('document' in globalThis || 'window' in globalThis) throw Error('browser_global_in_server');
`,
);
run("pnpm", [
  "exec",
  "tsc",
  "consumer.ts",
  "--module",
  "NodeNext",
  "--moduleResolution",
  "NodeNext",
  "--target",
  "ES2022",
  "--strict",
  "--skipLibCheck",
  "--outDir",
  "out",
]);
run("node", ["out/consumer.js"]);
if (expected !== digest()) throw Error("candidate_changed_during_verification");
mkdirSync(evidence, { recursive: true });
copyFileSync(
  path.join(consumer, "pnpm-lock.yaml"),
  path.join(evidence, "consumer-lock.yaml"),
);
writeFileSync(
  path.join(evidence, "candidate.json"),
  JSON.stringify(
    {
      pluginCommit: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      studioCommit: manifest.studioCommit,
      file: path.basename(artifact),
      sha256: expected,
      peerArtifacts: manifest.packages,
      consumer: "clean-install/types/node-server",
      node: process.version,
    },
    null,
    2,
  ) + "\n",
);

rmSync(consumer, { recursive: true, force: true });
