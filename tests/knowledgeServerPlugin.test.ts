import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { knowledgeServerPlugin } from "../src/web/knowledgeServerPlugin";

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>;

const originalKnowledgeRoot = process.env.KNOWLEDGE_ROOT;

afterEach(() => {
  if (originalKnowledgeRoot === undefined) {
    delete process.env.KNOWLEDGE_ROOT;
  } else {
    process.env.KNOWLEDGE_ROOT = originalKnowledgeRoot;
  }
});

async function requestKnowledgeApi<T>(knowledgeRoot: string, url: string): Promise<T> {
  process.env.KNOWLEDGE_ROOT = knowledgeRoot;
  let middleware: Middleware | undefined;
  const configureServer = knowledgeServerPlugin().configureServer;
  if (typeof configureServer !== "function") {
    throw new Error("knowledge server plugin has no configureServer hook");
  }
  configureServer.call(
    {} as never,
    {
      middlewares: {
        use(handler: Middleware) {
          middleware = handler;
        }
      }
    } as never
  );
  if (!middleware) {
    throw new Error("knowledge server middleware was not registered");
  }

  let body = "";
  let nextCalled = false;
  const response = {
    statusCode: 200,
    setHeader() {},
    end(chunk: string) {
      body = chunk;
    }
  } as unknown as ServerResponse;

  await middleware({ url } as IncomingMessage, response, () => {
    nextCalled = true;
  });

  expect(nextCalled).toBe(false);
  expect(response.statusCode).toBe(200);
  return JSON.parse(body) as T;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

describe("knowledge server run ledger", () => {
  test("collapses records with the same run_id and prefers the successful terminal record", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "knowledge-runs-"));
    const runsDir = path.join(root, "runs");
    await writeJson(path.join(runsDir, "failed", "run-shared.json"), {
      run_id: "run-shared",
      status: "failed",
      started_at: "2026-07-25T10:00:00.000Z",
      finished_at: "2026-07-25T10:01:00.000Z"
    });
    await writeJson(path.join(runsDir, "run-shared-deep-finalization.json"), {
      run_id: "run-shared",
      qualified: true,
      finished_at: "2026-07-25T10:03:00.000Z"
    });
    await writeJson(path.join(runsDir, "run-shared.json"), {
      run_id: "run-shared",
      status: "success",
      started_at: "2026-07-25T10:00:00.000Z",
      finished_at: "2026-07-25T10:03:00.000Z"
    });

    const runs = await requestKnowledgeApi<Array<{ file: string; data: Record<string, unknown> }>>(root, "/api/knowledge/runs");

    expect(runs).toHaveLength(1);
    expect(runs[0]?.data).toMatchObject({ run_id: "run-shared", status: "success" });
    expect(runs[0]?.file).toMatch(/runs\/run-shared\.json$/);
  });

  test("orders logical runs by their latest finished_at", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "knowledge-runs-order-"));
    const runsDir = path.join(root, "runs");
    await writeJson(path.join(runsDir, "run-started-later.json"), {
      run_id: "run-started-later",
      status: "success",
      started_at: "2026-07-25T11:00:00.000Z",
      finished_at: "2026-07-25T11:01:00.000Z"
    });
    await writeJson(path.join(runsDir, "run-finished-later.json"), {
      run_id: "run-finished-later",
      status: "success",
      started_at: "2026-07-25T10:00:00.000Z",
      finished_at: "2026-07-25T12:00:00.000Z"
    });

    const runs = await requestKnowledgeApi<Array<{ data: Record<string, unknown> }>>(root, "/api/knowledge/runs");

    expect(runs.map((run) => run.data.run_id)).toEqual(["run-finished-later", "run-started-later"]);
  });

  test("keeps a failed terminal status when only a newer finalization receipt exists", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "knowledge-runs-partial-finalize-"));
    const runsDir = path.join(root, "runs");
    await writeJson(path.join(runsDir, "failed", "run-partial.json"), {
      run_id: "run-partial",
      status: "failed",
      started_at: "2026-07-25T10:00:00.000Z",
      finished_at: "2026-07-25T10:01:00.000Z"
    });
    await writeJson(path.join(runsDir, "run-partial-deep-finalization.json"), {
      run_id: "run-partial",
      qualified: true,
      finished_at: "2026-07-25T10:03:00.000Z"
    });

    const runs = await requestKnowledgeApi<Array<{ file: string; data: Record<string, unknown> }>>(root, "/api/knowledge/runs");

    expect(runs).toHaveLength(1);
    expect(runs[0]?.data).toMatchObject({ run_id: "run-partial", status: "failed" });
    expect(runs[0]?.file).toMatch(/runs\/failed\/run-partial\.json$/);
  });
});

describe("knowledge server latest card", () => {
  test("uses created_at to choose between cards from the same date", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "knowledge-cards-"));
    const cardsDir = path.join(root, "cards");
    await mkdir(cardsDir, { recursive: true });
    await writeFile(
      path.join(cardsDir, "2026-07-25-a-older.md"),
      "---\ndate: 2026-07-25\ncreated_at: 2026-07-25T09:00:00.000Z\nrun_id: run-older\n---\n\nOlder card\n",
      "utf8"
    );
    await writeFile(
      path.join(cardsDir, "2026-07-25-z-newer.md"),
      "---\ndate: 2026-07-25\ncreated_at: 2026-07-25T12:00:00.000Z\nrun_id: run-newer\n---\n\nNewer card\n",
      "utf8"
    );

    const summary = await requestKnowledgeApi<{
      latest_card: { frontmatter: Record<string, unknown>; body: string } | null;
      cards: Array<{ frontmatter: Record<string, unknown> }>;
    }>(root, "/api/knowledge/summary");

    expect(summary.latest_card?.frontmatter.run_id).toBe("run-newer");
    expect(summary.latest_card?.body).toContain("Newer card");
    expect(summary.cards.map((card) => card.frontmatter.run_id)).toEqual(["run-newer", "run-older"]);
  });
});
