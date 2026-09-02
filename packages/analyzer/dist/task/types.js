export const ALL_STAGES = [
    "spec-engineering",
    "test-planning",
    "ai-code-generation",
    "ai-testing",
    "ai-fix",
    "manual-verification",
    "ai-review",
];
export const STAGE_LABELS = {
    "spec-engineering": { "zh-CN": "SPEC工程", "en-US": "SPEC Engineering" },
    "test-planning": { "zh-CN": "测试方案准备", "en-US": "Test Planning" },
    "ai-code-generation": { "zh-CN": "AI代码生成", "en-US": "AI Code Generation" },
    "ai-testing": { "zh-CN": "AI软件测试", "en-US": "AI Testing" },
    "ai-fix": { "zh-CN": "AI代码修复", "en-US": "AI Fix" },
    "manual-verification": { "zh-CN": "人工补测验证", "en-US": "Manual Verification" },
    "ai-review": { "zh-CN": "AI Review", "en-US": "AI Review" },
    unknown: { "zh-CN": "未归类", "en-US": "Unclassified" },
};
export const TASK_GRAPH_VERSION = "1.0";
