import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveX, BookOpen, CalendarDays, Gauge, GitBranch, Library, ListFilter, RefreshCcw } from "lucide-react";

type PatternEntry = {
  id: string;
  name: string;
  summary: string;
  file: string;
  engineering_problems: string[];
  project_types: string[];
  pattern_types: string[];
  complexity: string;
  quality_score: number;
  source_repos: string[];
  transfer_targets: string[];
  created_at: string;
  updated_at: string;
};

type MarkdownItem = {
  file: string;
  frontmatter: Record<string, unknown>;
  body: string;
};

type ArchiveRepoRow = {
  repo: string;
  url: string;
  status: "learned" | "pending";
  rank: number | null;
  priority: "p1" | "p2" | "p3" | null;
  focus: string[];
  learned_at: string | null;
  run_id: string | null;
  pattern_count: number;
  pattern_files: string[];
};

type ArchiveSummary = {
  generated_at: string;
  seed_registry_generated_at: string | null;
  learned_registry_generated_at: string | null;
  seed_count: number;
  learned_count: number;
  pending_count: number;
  repos: ArchiveRepoRow[];
  skip_rule: string;
};

type Summary = {
  index: { pattern_count: number; patterns: PatternEntry[] };
  latest_card: MarkdownItem | null;
  cards: MarkdownItem[];
  runs: Array<{ file: string; data: Record<string, unknown> }>;
  rejected: Array<{ file: string; data: Record<string, unknown> }>;
  archive: ArchiveSummary;
};

type Tab = "today" | "patterns" | "index" | "archive" | "runs" | "rejected";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
}

function useSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    try {
      setError(null);
      setSummary(await fetchJson<Summary>("/api/knowledge/summary"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load knowledge data");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return { summary, error, reload: load };
}

function MarkdownBlock({ body }: { body: string }) {
  const nodes = body.split(/\r?\n/).map((line, index) => {
    if (line.startsWith("# ")) return <h1 key={index}>{line.slice(2)}</h1>;
    if (line.startsWith("## ")) return <h2 key={index}>{line.slice(3)}</h2>;
    if (line.startsWith("- ")) return <li key={index}>{line.slice(2)}</li>;
    if (!line.trim()) return <span key={index} className="lineBreak" />;
    return <p key={index}>{line}</p>;
  });
  return <div className="markdown">{nodes}</div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PatternList({ patterns, onSelect }: { patterns: PatternEntry[]; onSelect: (id: string) => void }) {
  return (
    <div className="listGrid">
      {patterns.map((pattern) => (
        <button className="patternRow" key={pattern.id} onClick={() => onSelect(pattern.id)}>
          <span>
            <strong>{pattern.name}</strong>
            <small>{pattern.summary}</small>
          </span>
          <span className="score">{pattern.quality_score}</span>
          <span className={`pill ${pattern.complexity}`}>{pattern.complexity}</span>
        </button>
      ))}
    </div>
  );
}

function AxisView({ patterns }: { patterns: PatternEntry[] }) {
  const axes = useMemo(() => {
    const result: Record<string, Record<string, number>> = {
      engineering_problem: {},
      project_type: {},
      pattern_type: {},
      complexity: {},
      transfer_target: {},
      source_repo: {}
    };
    for (const pattern of patterns) {
      pattern.engineering_problems.forEach((item) => (result.engineering_problem[item] = (result.engineering_problem[item] ?? 0) + 1));
      pattern.project_types.forEach((item) => (result.project_type[item] = (result.project_type[item] ?? 0) + 1));
      pattern.pattern_types.forEach((item) => (result.pattern_type[item] = (result.pattern_type[item] ?? 0) + 1));
      pattern.transfer_targets.forEach((item) => (result.transfer_target[item] = (result.transfer_target[item] ?? 0) + 1));
      pattern.source_repos.forEach((item) => (result.source_repo[item] = (result.source_repo[item] ?? 0) + 1));
      result.complexity[pattern.complexity] = (result.complexity[pattern.complexity] ?? 0) + 1;
    }
    return result;
  }, [patterns]);

  return (
    <div className="axisGrid">
      {Object.entries(axes).map(([axis, values]) => (
        <section className="axisBlock" key={axis}>
          <h2>{axis}</h2>
          {Object.entries(values)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => (
              <div className="axisLine" key={name}>
                <span>{name}</span>
                <strong>{count}</strong>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}

function RunsView({ runs }: { runs: Summary["runs"] }) {
  return (
    <div className="table">
      <div className="tableHead">
        <span>run</span>
        <span>repo</span>
        <span>patterns</span>
        <span>status</span>
      </div>
      {runs.map((run) => (
        <div className="tableRow" key={run.file}>
          <span>{String(run.data.run_id ?? "")}</span>
          <span>{String((run.data.selected_repo as { repo?: string } | undefined)?.repo ?? "")}</span>
          <span>{Array.isArray(run.data.added_patterns) ? run.data.added_patterns.length : 0}</span>
          <span className={`status ${run.data.status === "success" ? "ok" : "bad"}`}>{String(run.data.status ?? "unknown")}</span>
        </div>
      ))}
    </div>
  );
}

function RejectedView({ rejected }: { rejected: Summary["rejected"] }) {
  if (rejected.length === 0) {
    return <p className="empty">No rejected items yet.</p>;
  }
  return (
    <div className="listGrid">
      {rejected.map((item) => (
        <article className="rejected" key={item.file}>
          <strong>{item.file}</strong>
          <small>{String(item.data.source_repo ?? item.data.run_id ?? "")}</small>
          <ul>
            {Array.isArray(item.data.errors) ? item.data.errors.map((error) => <li key={String(error)}>{String(error)}</li>) : null}
          </ul>
        </article>
      ))}
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function ArchiveView({ archive }: { archive: ArchiveSummary | undefined }) {
  if (!archive) {
    return <p className="empty">No archive registry loaded yet.</p>;
  }
  return (
    <section className="archiveLayout">
      <aside className="archiveSummary">
        <div className="panelHeader">
          <Archive size={18} />
          <h2>Absorption Archive</h2>
        </div>
        <div className="archiveStats">
          <Metric label="Seed Pool" value={archive.seed_count} />
          <Metric label="Learned" value={archive.learned_count} />
          <Metric label="Pending" value={archive.pending_count} />
        </div>
        <p>{archive.skip_rule}</p>
        <dl>
          <dt>Learned registry</dt>
          <dd>{archive.learned_registry_generated_at ? formatDateTime(archive.learned_registry_generated_at) : "not generated"}</dd>
          <dt>Seed registry</dt>
          <dd>{archive.seed_registry_generated_at ? formatDateTime(archive.seed_registry_generated_at) : "not generated"}</dd>
        </dl>
      </aside>
      <div className="archiveTable">
        <div className="archiveHead">
          <span>rank</span>
          <span>repo</span>
          <span>status</span>
          <span>patterns</span>
          <span>learned</span>
        </div>
        {archive.repos.map((repo) => (
          <div className="archiveRow" key={repo.repo}>
            <span>{repo.rank ?? "-"}</span>
            <span>
              <a href={repo.url} target="_blank" rel="noreferrer">
                {repo.repo}
              </a>
              {repo.focus.length > 0 ? <small>{repo.focus.slice(0, 4).join(" / ")}</small> : null}
            </span>
            <span className={`status ${repo.status === "learned" ? "ok" : "pending"}`}>{repo.status}</span>
            <span>{repo.pattern_count}</span>
            <span>{formatDateTime(repo.learned_at)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function App() {
  const { summary, error, reload } = useSummary();
  const [tab, setTab] = useState<Tab>("today");
  const [selectedPattern, setSelectedPattern] = useState<MarkdownItem | null>(null);

  async function openPattern(id: string) {
    setSelectedPattern(await fetchJson<MarkdownItem>(`/api/knowledge/pattern/${encodeURIComponent(id)}`));
  }

  const patterns = summary?.index.patterns ?? [];
  const tabs: Array<[Tab, string, React.ElementType]> = [
    ["today", "Today", CalendarDays],
    ["patterns", "Patterns", BookOpen],
    ["index", "Index", ListFilter],
    ["archive", "Archive", Archive],
    ["runs", "Runs", GitBranch],
    ["rejected", "Rejected", ArchiveX]
  ];

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">Agent Knowledge Base</p>
          <h1>GitHub Engineering Patterns</h1>
        </div>
        <button className="iconButton" onClick={() => void reload()} title="Refresh knowledge data">
          <RefreshCcw size={18} />
        </button>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <section className="metricsBand">
        <Metric label="Patterns" value={summary?.index.pattern_count ?? 0} />
        <Metric label="Cards" value={summary?.cards.length ?? 0} />
        <Metric label="Learned Repos" value={summary?.archive.learned_count ?? 0} />
        <Metric label="Seed Pending" value={summary?.archive.pending_count ?? 0} />
        <Metric label="Runs" value={summary?.runs.length ?? 0} />
        <Metric label="Rejected" value={summary?.rejected.length ?? 0} />
      </section>

      <nav className="tabs">
        {tabs.map(([id, label, Icon]) => (
          <button className={tab === id ? "active" : ""} key={id} onClick={() => setTab(id)}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {tab === "today" ? (
        <section className="twoColumn">
          <div className="contentPanel">{summary?.latest_card ? <MarkdownBlock body={summary.latest_card.body} /> : <p className="empty">No card generated yet.</p>}</div>
          <aside className="sidePanel">
            <div className="panelHeader">
              <Library size={18} />
              <h2>Top Patterns</h2>
            </div>
            <PatternList patterns={patterns.slice(0, 6)} onSelect={openPattern} />
          </aside>
        </section>
      ) : null}

      {tab === "patterns" ? (
        <section className="twoColumn">
          <div className="contentPanel">
            <PatternList patterns={patterns} onSelect={openPattern} />
          </div>
          <aside className="sidePanel detailPanel">
            <div className="panelHeader">
              <Gauge size={18} />
              <h2>Pattern Note</h2>
            </div>
            {selectedPattern ? <MarkdownBlock body={selectedPattern.body} /> : <p className="empty">Select a pattern.</p>}
          </aside>
        </section>
      ) : null}

      {tab === "index" ? <AxisView patterns={patterns} /> : null}
      {tab === "archive" ? <ArchiveView archive={summary?.archive} /> : null}
      {tab === "runs" ? <RunsView runs={summary?.runs ?? []} /> : null}
      {tab === "rejected" ? <RejectedView rejected={summary?.rejected ?? []} /> : null}
    </main>
  );
}
