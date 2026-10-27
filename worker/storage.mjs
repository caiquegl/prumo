import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFile, mkdtemp, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";

const exec = promisify(execFile);
const git = async (cwd, ...args) => (await exec("git", args, { cwd, maxBuffer: 1 << 26 })).stdout.trim();

const BRANCH = "media";
const EMPTY_STATE = { published: [] };

/**
 * Media and publication history live on an orphan `media` branch that is force-pushed with a single
 * commit each run, so the repository never accumulates old videos. Files are served by jsDelivr,
 * which returns the correct content type for Instagram to fetch.
 */
export function mediaStore({ repoDir, remote, repo }) {
  let workDir = null;

  async function readState() {
    try {
      await git(repoDir, "fetch", "--depth=1", remote, BRANCH);
      return JSON.parse(await git(repoDir, "show", "FETCH_HEAD:state.json"));
    } catch {
      return structuredClone(EMPTY_STATE);
    }
  }

  async function commit(state, files, message) {
    if (!workDir) {
      workDir = await mkdtemp(join(tmpdir(), "prumo-media-"));
      await git(workDir, "init", "-q", "-b", BRANCH);
      await writeFile(join(workDir, "vercel.json"), JSON.stringify({ git: { deploymentEnabled: false } }, null, 2) + "\n");
      await writeFile(join(workDir, "README.md"), "Mídia gerada pelo worker de publicação automática (`worker/`). Branch reescrita a cada execução.\n");
    }
    for (const f of files) await copyFile(f, join(workDir, basename(f)));
    await writeFile(join(workDir, "state.json"), JSON.stringify(state, null, 2) + "\n");
    await git(workDir, "add", "-A");
    await git(workDir, "-c", "user.name=Prumo Worker", "-c", "user.email=worker@prumo.web", "commit", "-q", "--allow-empty", "-m", message);
    await git(workDir, "push", "-q", "--force", remote, `HEAD:${BRANCH}`);
    const sha = await git(workDir, "rev-parse", "HEAD");
    return { sha, url: file => `https://cdn.jsdelivr.net/gh/${repo}@${sha}/${basename(file)}` };
  }

  return { readState, commit };
}

export async function originUrl(repoDir) {
  return git(repoDir, "remote", "get-url", "origin");
}
