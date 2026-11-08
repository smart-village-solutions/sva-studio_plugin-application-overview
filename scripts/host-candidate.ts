/** Install only the attested candidate through Studio's normal package/catalog path. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
const [command, studioArgument, artifactArgument] = process.argv.slice(2);
if (!studioArgument) throw Error("studio_checkout_required");
const studio = path.resolve(studioArgument);
const backup = path.resolve(".artifacts/host-source");
const files = [
  "apps/sva-studio-react/package.json",
  "apps/sva-studio-react/plugin-catalog.json",
  "pnpm-lock.yaml",
];
if (command === "install" && artifactArgument) {
  const directory = path.resolve(artifactArgument);
  const evidence = JSON.parse(
    readFileSync(path.join(directory, "evidence/candidate.json"), "utf8"),
  ) as {
    pluginCommit: string;
    studioCommit: string;
    file: string;
    sha256: string;
  };
  const sha = (cwd: string) =>
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd,
      encoding: "utf8",
    }).trim();
  if (
    evidence.pluginCommit !== sha(process.cwd()) ||
    evidence.studioCommit !== sha(studio) ||
    !/^[a-z0-9.-]+\.tgz$/.test(evidence.file)
  )
    throw Error("candidate_commit_mismatch");
  const candidate = path.join(directory, "candidate", evidence.file);
  if (
    createHash("sha256").update(readFileSync(candidate)).digest("hex") !==
    evidence.sha256
  )
    throw Error("candidate_digest_mismatch");
  if (
    execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: studio,
      encoding: "utf8",
    }).trim()
  )
    throw Error("clean_committed_host_required");
  const catalogPath = path.join(studio, files[1]!);
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as {
    pluginId: string;
  }[];
  if (catalog.some((entry) => entry.pluginId === "application-workspace"))
    throw Error("optional_plugin_must_not_be_preinstalled");
  mkdirSync(backup, { recursive: true });
  writeFileSync(
    path.join(backup, "identity.json"),
    JSON.stringify({ root: studio, commit: evidence.studioCommit }),
  );
  files.forEach((file, index) =>
    writeFileSync(
      path.join(backup, String(index)),
      readFileSync(path.join(studio, file)),
    ),
  );
  execFileSync("pnpm", ["--filter", "sva-studio-react", "add", candidate], {
    cwd: studio,
    stdio: "inherit",
    env: { ...process.env, pnpm_config_verify_deps_before_run: "never" },
  });
  catalog.push({
    pluginId: "application-workspace",
    sourceType: "installed-distribution",
    sourceRef: "@sva/plugin-application-workspace",
    enabled: true,
    distribution: "studio",
  } as (typeof catalog)[number]);
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
} else if (command === "remove") {
  const identityFile = path.join(backup, "identity.json");
  const identity = JSON.parse(readFileSync(identityFile, "utf8")) as {
    root: string;
    commit: string;
  };
  if (
    identity.root !== studio ||
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: studio,
      encoding: "utf8",
    }).trim() !== identity.commit
  )
    throw Error("host_restore_identity_changed");
  files.forEach((file, index) =>
    writeFileSync(
      path.join(studio, file),
      readFileSync(path.join(backup, String(index))),
    ),
  );
  rmSync(identityFile);
  rmSync(
    path.join(
      studio,
      "apps/sva-studio-react/node_modules/@sva/plugin-application-workspace",
    ),
    { force: true, recursive: true },
  );
} else
  throw Error(
    "usage: host-candidate.ts install STUDIO ARTIFACT_DIRECTORY | remove STUDIO",
  );
