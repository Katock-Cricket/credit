/**
 * 计算器注册表。
 *
 * **键必须与 `@credit/rules` 的 `calculatorFile(id)` 一致**（AGENTS §9），
 * 由 `packages/rules/src/rules.test.ts` 的"遍历叶子断言文件存在"用例守护；
 * 而"文件存在但没注册"则由本文件的 `CALCULATORS` 与引擎共同保证
 * —— 引擎查不到计算器会把该指标标 `error`，不会静默漏算。
 */
import type { Calculator } from "../credit/engine.js";
import { specAiDecisionRatio } from "./spec-ai-decision-ratio.js";
import { specReview } from "./spec-review.js";
import { specBoundary } from "./spec-boundary.js";
import { specConstraint } from "./spec-constraint.js";
import { specQualityCompleteness } from "./spec-quality-completeness.js";
import { specQualityConsistency } from "./spec-quality-consistency.js";
import { specQualityUnambiguity } from "./spec-quality-unambiguity.js";
import { specQualityVerifiability } from "./spec-quality-verifiability.js";
import { specQualityTraceability } from "./spec-quality-traceability.js";
import { testPlanSpecCoverage } from "./test-plan-spec-coverage.js";
import { testPlanReview } from "./test-plan-review.js";
import { testPlanAskImprove } from "./test-plan-ask-improve.js";
import { testPlanTcL1 } from "./test-plan-tc-l1.js";
import { testPlanTcL5 } from "./test-plan-tc-l5.js";
import { genStaged } from "./gen-staged.js";
import { genPlanFirst } from "./gen-plan-first.js";
import { genAcceptLines } from "./gen-accept-lines.js";
import { genAlignment } from "./gen-alignment.js";
import { genVerifyReadPr } from "./gen-verify-read-pr.js";
import { genVerifyEditPe } from "./gen-verify-edit-pe.js";
import { genVerifyCursorNc } from "./gen-verify-cursor-nc.js";
import { testDevTrigger } from "./test-dev-trigger.js";
import { testPassRate } from "./test-pass-rate.js";
import { testReviewFailure } from "./test-review-failure.js";
import { fixIssueQuality } from "./fix-issue-quality.js";
import { fixReproCase } from "./fix-repro-case.js";
import { fixRootCause } from "./fix-root-cause.js";
import { manualPassRate } from "./manual-pass-rate.js";
import { manualBoundary } from "./manual-boundary.js";
import { reviewDecision } from "./review-decision.js";
import { reviewRounds } from "./review-rounds.js";
import { reviewDisposition } from "./review-disposition.js";
import { toolProxy } from "./tool-proxy.js";

export const CALCULATORS: Record<string, Calculator> = {
  "spec-ai-decision-ratio": specAiDecisionRatio,
  "spec-review": specReview,
  "spec-boundary": specBoundary,
  "spec-constraint": specConstraint,
  "spec-quality-completeness": specQualityCompleteness,
  "spec-quality-consistency": specQualityConsistency,
  "spec-quality-unambiguity": specQualityUnambiguity,
  "spec-quality-verifiability": specQualityVerifiability,
  "spec-quality-traceability": specQualityTraceability,
  "test-plan-spec-coverage": testPlanSpecCoverage,
  "test-plan-review": testPlanReview,
  "test-plan-ask-improve": testPlanAskImprove,
  "test-plan-tc-l1": testPlanTcL1,
  "test-plan-tc-l5": testPlanTcL5,
  "gen-staged": genStaged,
  "gen-plan-first": genPlanFirst,
  // 仍保留映射：该指标已退出分数框架（规则树不注册），但实现保留供离线分析/未来复用
  "gen-accept-lines": genAcceptLines,
  "gen-alignment": genAlignment,
  "gen-verify-read-pr": genVerifyReadPr,
  "gen-verify-edit-pe": genVerifyEditPe,
  "gen-verify-cursor-nc": genVerifyCursorNc,
  "test-dev-trigger": testDevTrigger,
  "test-pass-rate": testPassRate,
  "test-review-failure": testReviewFailure,
  "fix-issue-quality": fixIssueQuality,
  "fix-repro-case": fixReproCase,
  "fix-root-cause": fixRootCause,
  "manual-pass-rate": manualPassRate,
  "manual-boundary": manualBoundary,
  "review-decision": reviewDecision,
  "review-rounds": reviewRounds,
  "review-disposition": reviewDisposition,
  "tool-proxy": toolProxy,
};
