import { execFileSync } from "node:child_process";

export type GitHubCredentialSource = "explicit" | "environment" | "gh_keychain" | "unavailable";

export type GitHubCredential = {
  token: string | undefined;
  source: GitHubCredentialSource;
};

export type ResolveGitHubCredentialOptions = {
  explicitToken?: string;
  env?: NodeJS.ProcessEnv;
  readGhToken?: () => string;
};

function normalizedToken(value: string | undefined): string | undefined {
  const token = value?.trim();
  return token ? token : undefined;
}

function defaultReadGhToken(): string {
  return execFileSync("gh", ["auth", "token"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5_000
  });
}

/** Resolve a credential without copying secrets into worktrees or diagnostic output. */
export function resolveGitHubCredential(options: ResolveGitHubCredentialOptions = {}): GitHubCredential {
  const explicit = normalizedToken(options.explicitToken);
  if (explicit) return { token: explicit, source: "explicit" };

  const environment = normalizedToken((options.env ?? process.env).GITHUB_TOKEN);
  if (environment) return { token: environment, source: "environment" };

  try {
    const keychain = normalizedToken((options.readGhToken ?? defaultReadGhToken)());
    if (keychain) return { token: keychain, source: "gh_keychain" };
  } catch {
    // Credential diagnostics intentionally collapse all command details so a secret
    // can never be reflected into logs or an automation report.
  }
  return { token: undefined, source: "unavailable" };
}
