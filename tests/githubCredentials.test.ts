import { describe, expect, test } from "vitest";
import { resolveGitHubCredential } from "../src/github/credentials";

describe("GitHub credential resolution", () => {
  test("prefers an explicit token and never invokes the host credential adapter", () => {
    let calls = 0;
    const result = resolveGitHubCredential({
      explicitToken: " explicit-secret ",
      env: {},
      readGhToken: () => {
        calls += 1;
        return "host-secret";
      }
    });

    expect(result).toEqual({ token: "explicit-secret", source: "explicit" });
    expect(calls).toBe(0);
  });

  test("uses the process environment before the host credential adapter", () => {
    const result = resolveGitHubCredential({
      env: { GITHUB_TOKEN: "env-secret" },
      readGhToken: () => "host-secret"
    });

    expect(result).toEqual({ token: "env-secret", source: "environment" });
  });

  test("falls back to the authenticated gh keychain in an isolated worktree", () => {
    const result = resolveGitHubCredential({
      env: {},
      readGhToken: () => "host-secret\n"
    });

    expect(result).toEqual({ token: "host-secret", source: "gh_keychain" });
  });

  test("reports unavailable without exposing command output", () => {
    const result = resolveGitHubCredential({
      env: {},
      readGhToken: () => {
        throw new Error("secret-bearing failure");
      }
    });

    expect(result).toEqual({ token: undefined, source: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("secret-bearing failure");
  });
});
