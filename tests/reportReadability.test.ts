import { describe, expect, test } from "vitest";
import { assessHumanReportReadability } from "../src/deepDive/reportReadability";

const paradigmLedReport = `# 日报

## 它为什么值得研究

这个项目解决的关键问题是：广泛搜索可以找到看起来相关的代码，却不能可靠说明一个已确认对象会影响哪些调用者、依赖项和测试，因此审查仍然需要人工重新拼接关系。

## 核心范式：先编译关系地图，再沿地图缩小任务范围

它没有把每次查询都交给相似度或语言模型临时猜测，而是预先把源码对象以及可以从语法和框架规则中观察到的关系编译成一张地图。查询时先确认入口对象，再沿允许的关系展开连接路径，最后得到一个可以解释的审查范围。

这个选择非常重要：拿掉关系地图，系统仍可能找到关键词相近的文件，却失去跨文件追踪调用、依赖和测试影响的主要能力。巧妙之处在于把“广泛找到入口”和“依据明确关系扩展影响”拆成两个责任，既可以与语义搜索组合，也不会让语义相似冒充代码依赖。

例如支付函数改变后，系统先把它解析成唯一对象，再沿调用关系找到订单服务，沿测试关系找到覆盖用例，于是审查者得到一条有来源的阅读和验证路径。它的好处是结果可解释、上下文有界；代价是反射和动态配置可能形成缺失关系，所以源码和测试仍是最终事实。

## 能迁移的思维

【源码观察】项目把对象及其明确关系编译成可遍历地图，并按任务截取局部路径。【迁移推论】文档和知识库也可以把文档、概念、事实作为对象，把引用、来源和冲突作为关系；只有关系可维护且仍能回到原文验证时，这个范式才成立。

## 证据附录

这里记录固定版本的生产实现和失败路径测试。
`;

describe("human report presentation gate", () => {
  test("accepts a clear paradigm-led report without prescribed headings or field labels", () => {
    const result = assessHumanReportReadability(paradigmLedReport);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("still accepts the earlier structured shape when it communicates clearly", () => {
    const result = assessHumanReportReadability(`# 日报

## 项目本身做什么

这个项目把后台任务的执行资格和最终发布资格分开，使并发尝试和乱序完成不会让旧结果覆盖新状态。

## 核心机制如何工作

一个任务版本启动后可以产生候选结果，但发布前必须重新验证当前所有者和版本。两个版本先后启动、旧版本较晚完成时，旧结果会因为失去发布资格而被拒绝。这样既允许并发执行，又保证最终可见状态由当前所有者决定。这个机制只保证发布顺序，结果内容仍需业务校验。

## 为什么这个选择重要

普通重试解决再次执行，队列解决任务分发，版本围栏解决谁可以发布。巧妙之处在于不把完成顺序误当成所有权顺序；好处是旧任务不会覆盖新状态，代价是系统必须保存并核验版本信息。

## 最重要的迁移

【源码观察】系统在提交前重新判断发布资格。【迁移推论】文档生成和媒体处理也可以用修订版本阻止过期候选覆盖当前结果，但不可逆副作用仍需要事务或补偿机制。

## 证据附录

这里记录固定版本的生产实现与失败测试。
`);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("rejects a report without a separated evidence appendix", () => {
    const result = assessHumanReportReadability(paradigmLedReport.replace("## 证据附录", "## 参考资料"));

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("report_evidence_appendix_required");
  });

  test("rejects a token-complete but substantively empty main narrative", () => {
    const result = assessHumanReportReadability(`# 日报

## 项目

很好。

## 范式

很巧妙。

## 证据附录

证据。
`);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("report_main_narrative_too_short");
  });

  test("rejects internal source identifiers in the reader-facing narrative", () => {
    const result = assessHumanReportReadability(paradigmLedReport.replace(
      "它没有把每次查询都交给相似度或语言模型临时猜测",
      "它通过 `src/runtime.ts` 和 `build_relation_graph()` 实现关系编译"
    ));

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("report_main_narrative_contains_internal_identifiers");
  });

  test("does not infer semantic quality from headings because the independent reader owns that judgment", () => {
    const result = assessHumanReportReadability(`# 日报

## 自由结构

这段正文足够长，并且完全不依赖预设章节名称。机械层只负责把证据附录与读者叙事分开、阻止内部标识泄漏，并排除明显空白输出。项目是否真的讲清了重要且非显然的核心功能范式，由结构化清单、来源证据以及独立读者共同判断，而不是由标题关键词替代。为了避免固定模板再次塑造所有报告，这里还特意使用自然语言继续说明责任边界，确保长度超过最低防空白阈值。这样的分工允许不同项目按照自身逻辑组织文字：图系统可以先讲地图和关系，调度系统可以先讲所有权和时间顺序，创作工具也可以先讲约束表达和生成过程，而不必假装它们拥有同一种章节结构。只要最终审查能够回答项目解决的问题、关键设计选择、实际机制、主要收益、非显然之处以及代价，报告结构就应该服务理解，而不是服务模板。

## 证据附录

证据。
`);

    expect(result.valid).toBe(true);
  });
});
