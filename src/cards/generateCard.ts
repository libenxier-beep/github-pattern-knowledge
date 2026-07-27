import path from "node:path";
import { writeFile } from "node:fs/promises";
import type { PatternDraft, RepoContext } from "../types";
import { stringifyMarkdown } from "../knowledge/frontmatter";
import { validateCardMarkdown } from "../harness/patternHarness";
import { ensureDir, writeJson } from "../utils/fs";
import { getKnowledgePaths, safeKebab, toKnowledgeRelative } from "../utils/paths";
import { localDateString } from "../utils/date";

export async function generateDailyCard(
  projectRoot: string,
  context: RepoContext,
  acceptedPatternIds: string[],
  drafts: PatternDraft[],
  runDate = new Date()
): Promise<string | null> {
  if (acceptedPatternIds.length === 0) {
    return null;
  }
  const paths = getKnowledgePaths(projectRoot);
  await ensureDir(paths.cardsDir);
  await ensureDir(paths.rejectedCardsDir);
  const date = localDateString(runDate);
  const repoSlug = safeKebab(context.repo.replace("/", "-"));
  const frontmatter = {
    date,
    source_repo: context.repo,
    source_url: context.url,
    patterns: acceptedPatternIds,
    card_type: "daily_design_card",
    run_id: context.run_id,
    created_at: runDate.toISOString()
  };
  const patternNames = drafts
    .filter((draft) => acceptedPatternIds.some((id) => id === draft.frontmatter.id || id.startsWith(`${draft.frontmatter.id}-`)))
    .map((draft) => `- ${draft.frontmatter.name}: ${draft.frontmatter.summary}`)
    .join("\n");
  const mainPattern = drafts[0]?.frontmatter.name ?? "source-backed engineering boundary";
  const body = `# 今日设计卡片：${context.repo}

## 一句话
今天最值得学的是：${mainPattern} 把可扩展性放进可测试的边界，而不是放进口号。

## 今天抽取的模式
${patternNames || acceptedPatternIds.map((id) => `- ${id}`).join("\n")}

## 为什么值得学
它把工程质量落在可追溯文件、边界契约和失败模式上。Agent 后续复用时不必相信项目名气，而是能回到 source evidence 检查判断。

## 宏观架构启发
长期可维护的本地工具应该先稳定知识资产和执行边界，再追加展示层。目录、schema、run metadata 和 harness 共同形成可回滚的系统骨架。

## 微决策启发
接口要小，状态要有归属，测试要锁住边界行为。新增能力时先问它是否独立变化，再决定用直接调用、路由表还是 registry。

## 可迁移场景
适合 Codex Skill 系统、本地自动化工具、CLI assistant、workflow engine、repo auditor 和其他需要 Agent 重复审计的工程工具。

## 不要照搬的场景
单脚本、小 demo、需求还没稳定的产品原型，不要直接套 registry、provider 或复杂目录分层。先保留可删除的简单方案。

## 和本地 Agent 工具的关联
这张卡片只是入口；真正的复用对象已按路由写入最合适的 Work Context。Codex 应先按工程问题检索对应 Context，再读 note 的 Boundary Decisions 和 Transfer Guidance。`;

  const markdown = stringifyMarkdown(frontmatter, body);
  const filePath = path.join(paths.cardsDir, `${date}-${repoSlug}.md`);
  const result = validateCardMarkdown(path.basename(filePath), markdown);
  if (result.valid) {
    await writeFile(filePath, markdown, "utf8");
    return toKnowledgeRelative(projectRoot, filePath, paths.knowledgeRoot);
  }
  const rejectedPath = path.join(paths.rejectedCardsDir, `${context.run_id}-${date}-${repoSlug}.md`);
  await writeFile(rejectedPath, markdown, "utf8");
  await writeJson(path.join(paths.rejectedCardsDir, `${context.run_id}-${date}-${repoSlug}.json`), {
    run_id: context.run_id,
    source_repo: context.repo,
    errors: result.errors,
    markdown_file: toKnowledgeRelative(projectRoot, rejectedPath, paths.knowledgeRoot)
  });
  return null;
}
