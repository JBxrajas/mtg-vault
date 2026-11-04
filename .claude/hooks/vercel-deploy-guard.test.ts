import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const SCRIPT = join(__dirname, "vercel-deploy-guard.sh");
const HOUR = 3600 * 1000;
const ORG = "VERCEL_ORG_ID=team_test";

let dir: string;
let calls: string;

/** A fake `vercel` on the PATH that answers `vercel api` with deployments created this many hours ago. */
function fakeVercel(agesInHours: number[] | "fail") {
  const bin = join(dir, "bin");
  mkdirSync(bin, { recursive: true });
  const now = Date.now();
  const deployments = agesInHours === "fail" ? [] : agesInHours.map((h, i) => ({ uid: `d${i}`, created: Math.round(now - h * HOUR) }));
  writeFileSync(join(dir, "answer.json"), JSON.stringify({ deployments }));
  writeFileSync(
    join(bin, "vercel"),
    `#!/usr/bin/env bash\necho "$@" >> "${calls}"\n${agesInHours === "fail" ? "exit 1" : `cat "${join(dir, "answer.json")}"`}\n`,
  );
  chmodSync(join(bin, "vercel"), 0o755);
}

function run(command: string, env: Record<string, string> = {}) {
  const res = spawnSync("bash", [SCRIPT], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
    env: {
      PATH: `${join(dir, "bin")}:${process.env.PATH}`,
      HOME: dir,
      CLAUDE_PROJECT_DIR: dir, // no linked project in there
      ...env,
    },
  });
  const out = res.stdout.trim() ? JSON.parse(res.stdout) : null;
  const vercelCalls = (() => {
    try {
      return readFileSync(calls, "utf8").trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  })();
  return { status: res.status, out, decision: out?.hookSpecificOutput?.permissionDecision as string | undefined, text: (out?.hookSpecificOutput?.permissionDecisionReason ?? out?.hookSpecificOutput?.additionalContext ?? "") as string, vercelCalls };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "guard-"));
  calls = join(dir, "calls.txt");
});

const fresh = (n: number, hours = 1) => Array.from({ length: n }, () => hours);

describe("vercel-deploy-guard: which commands it looks at", () => {
  it.each([
    `${ORG} vercel deploy --prod --yes`,
    `cd apps/web && ${ORG} VERCEL_PROJECT_ID=prj_x vercel deploy --prod`,
    `${ORG} npx vercel redeploy https://x.vercel.app`,
    `${ORG} pnpm exec vercel --prod`,
    `echo go; ${ORG} vercel@latest deploy`,
    `echo hi\n${ORG} vercel deploy --prod`,
    `${ORG} vercel deploy;`,
    `(${ORG} vercel deploy)`,
    `${ORG} vercel deploy --prod | tee out.txt`,
    `(cd apps/api && ${ORG} vercel deploy)`,
  ])("checks %j", (command) => {
    fakeVercel(fresh(5));
    const r = run(command);
    expect(r.vercelCalls.length).toBeGreaterThan(0);
    expect(r.text).toContain("5 of 100");
  });

  it.each([
    "vercel ls",
    "vercel api /v6/deployments",
    "vercel env add X production",
    "vercel inspect https://x.vercel.app",
    "vercel link --yes",
    "git commit -m \"docs: run vercel deploy later\"",
    "echo vercel deploy",
    "grep 'vercel --prod' docs/vercel.md",
    "pnpm test",
  ])("leaves %j alone and does not call the API", (command) => {
    fakeVercel(fresh(500));
    const r = run(command);
    expect(r.status).toBe(0);
    expect(r.out).toBeNull();
    expect(r.vercelCalls).toEqual([]);
  });
});

describe("vercel-deploy-guard: the count", () => {
  it("allows a deploy with room and reports how many are used", () => {
    fakeVercel(fresh(40));
    const r = run(`${ORG} vercel deploy --prod`);
    expect(r.decision).toBeUndefined();
    expect(r.text).toBe("Vercel deployment guard: 40 of 100 deployments used in the last 24 hours; each project this command deploys uses one.");
  });

  it("warns near the limit but still allows", () => {
    fakeVercel(fresh(95));
    const r = run(`${ORG} vercel deploy --prod`);
    expect(r.decision).toBeUndefined();
    expect(r.text).toContain("95 of 100");
    expect(r.text).toContain("Close to the limit");
  });

  it("does not count deployments older than 24 hours", () => {
    fakeVercel([...fresh(30), ...fresh(200, 30)]);
    expect(run(`${ORG} vercel deploy --prod`).text).toContain("30 of 100");
  });

  it("blocks at 99 and above, saying how many hours until a slot opens", () => {
    // 99 in the window; the oldest ages out in 2 hours. One slot more is needed, so the wait is that of the oldest.
    fakeVercel([22, ...fresh(98)]);
    const r = run(`${ORG} vercel deploy --prod`);
    expect(r.decision).toBe("deny");
    expect(r.text).toContain("99 deployments in the last 24 hours");
    expect(r.text).toMatch(/in about 2\.0 hours, around \d\d:\d\d UTC/);
  });

  it("waits for as many of the oldest as needed to get back under the limit", () => {
    // 102 in the window: four must age out (to 98). Oldest ages are 23, 21, 19, 17: the wait is for the fourth, 17 h old -> 7 h.
    fakeVercel([23, 21, 19, 17, ...fresh(98)]);
    const r = run(`${ORG} vercel deploy --prod`);
    expect(r.decision).toBe("deny");
    expect(r.text).toContain("102 deployments");
    expect(r.text).toMatch(/in about 7\.0 hours/);
  });

  it("allows exactly 98", () => {
    fakeVercel(fresh(98));
    expect(run(`${ORG} vercel deploy --prod`).decision).toBeUndefined();
  });

  it("uses a point (not a comma) for the hours whatever the language of the machine", () => {
    fakeVercel([22.5, ...fresh(98)]);
    expect(run(`${ORG} vercel deploy --prod`, { LANG: "es_ES.UTF-8", LC_ALL: "es_ES.UTF-8" }).text).toMatch(/in about 1\.5 hours/);
  });
});

describe("vercel-deploy-guard: turning it off and failing open", () => {
  it("is turned off only from the environment, never by something in the command", () => {
    fakeVercel(fresh(150));
    expect(run(`${ORG} vercel deploy --prod`, { VERCEL_DEPLOY_GUARD: "off" }).out).toBeNull();
    expect(run(`VERCEL_DEPLOY_GUARD=off ${ORG} vercel deploy --prod`).decision).toBe("deny");
    expect(run(`${ORG} vercel deploy --prod # VERCEL_DEPLOY_GUARD=off`).decision).toBe("deny");
  });

  it("lets the deploy through, with a note, when the API cannot be read", () => {
    fakeVercel("fail");
    const r = run(`${ORG} vercel deploy --prod`);
    expect(r.decision).toBeUndefined();
    expect(r.text).toContain("could not read the deployments");
  });

  it("lets the deploy through, with a note, when no team id can be found", () => {
    fakeVercel(fresh(150));
    const r = run("vercel deploy --prod");
    expect(r.decision).toBeUndefined();
    expect(r.text).toContain("no team id found");
    expect(r.vercelCalls).toEqual([]);
  });

  it("finds the team id in a linked project of the repository", () => {
    fakeVercel(fresh(150));
    mkdirSync(join(dir, "apps/api/.vercel"), { recursive: true });
    writeFileSync(join(dir, "apps/api/.vercel/project.json"), JSON.stringify({ orgId: "team_linked", projectId: "prj_1" }));
    const r = run("vercel deploy --prod");
    expect(r.decision).toBe("deny");
    expect(r.vercelCalls[0]).toContain("teamId=team_linked");
  });

  it("lets the deploy through, with a note, when the vercel CLI is missing", () => {
    const res = spawnSync("bash", [SCRIPT], {
      input: JSON.stringify({ tool_input: { command: `${ORG} vercel deploy --prod` } }),
      encoding: "utf8",
      // A PATH with the basics only: no vercel, no fnm.
      env: { PATH: "/usr/bin:/bin", HOME: dir, CLAUDE_PROJECT_DIR: dir },
    });
    const out = JSON.parse(res.stdout);
    expect(out.hookSpecificOutput.permissionDecision).toBeUndefined();
    expect(out.hookSpecificOutput.additionalContext).toContain("vercel CLI was not found");
  });
});
