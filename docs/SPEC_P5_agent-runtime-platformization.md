# OpenCowork P5 Agent Runtime 平台化规格说明书

| 项目 | 内容 |
| --- | --- |
| 版本 | P5-agent-runtime-platformization |
| 更新日期 | 2026-05-02 |
| 状态 | 规划中 |
| 基于 PRD | `docs/PRD.md` 第 21 节 |
| 前置版本 | `docs/SPEC_P4_desktop-computer-use-productization.md` |
| 参考项目 | `openai/codex` 本地 Agent 工程体系 |

---

## 1. 版本目标

在 PRD 6.0 完成 browser / desktop / hybrid computer use 产品化之后，把 OpenCowork 的核心能力从 Electron 应用内能力升级为可协议化、可审批、可观测、可多客户端复用的本地 Agent Runtime。

本版不追求复制 Codex 的 Rust CLI/TUI 实现，而是借鉴其协议层、审批/权限、执行策略、配置、App Server、多客户端复用、trace/diff 和模块拆分纪律，让 OpenCowork 的 browser-first + desktop automation 能力具备更清晰的工程边界。

## 2. 本版范围

### 2.1 本版要做的事情

1. 建立 shared protocol 层，统一 main / renderer / core / IM / MCP 的任务与事件契约
2. 建立统一 approval policy，覆盖 browser、desktop、visual、CLI、MCP、skill 等动作
3. 把命令执行和工具输出结构化，支持长输出截断、附件化和可解释审计
4. 建立本地 Agent Runtime API，为 Electron、CLI、IM、MCP、未来 Web UI 复用同一核心能力打基础
5. 产品化 Plan Mode，区分只读规划与可执行模式
6. 产品化 AGENTS.md / workspace rules 的加载、展示和执行约束
7. 强化 task trace、diff、文件变更、截图、结果之间的关联展示
8. 为配置、协议、审批、恢复和 trace 增加回归测试与 schema 验证
9. 逐步瘦身 `TaskEngine`，把高频变更职责拆到独立 coordinator / service

### 2.2 本版不做的事情

1. 不把 OpenCowork 重写为 Rust 或替换 Electron 架构
2. 不照搬 Codex 的终端 TUI 作为主产品形态
3. 不在本版实现完整企业权限治理平台
4. 不强制开启重沙箱模型，AI 专用设备场景下继续优先稳定性和可解释性
5. 不一次性重构全部 IPC 和 store，只对核心任务链路做协议收口

## 3. 核心设计

### 3.1 Shared Protocol Layer

新增 `src/shared/protocol/` 或 `src/core/protocol/`，作为 main、renderer、core、IM、MCP、scheduler 的共同契约层。

建议目录：

```text
src/shared/protocol/
├── task.ts
├── event.ts
├── command.ts
├── approval.ts
├── action.ts
├── output.ts
├── error.ts
├── config.ts
└── index.ts
```

核心对象：

```typescript
export type RuntimeClient = 'electron' | 'cli' | 'im' | 'mcp' | 'scheduler' | 'test';

export type RuntimeMode = 'plan' | 'execute';

export type ExecutionTargetKind = 'browser' | 'desktop' | 'hybrid' | 'cli' | 'mcp' | 'skill';

export interface RuntimeCommand {
  id: string;
  type: 'task/start' | 'task/interrupt' | 'task/resume' | 'task/cancel' | 'approval/respond';
  client: RuntimeClient;
  params: Record<string, unknown>;
  createdAt: number;
}

export interface RuntimeEvent {
  id: string;
  runId: string;
  type:
    | 'task/planned'
    | 'task/started'
    | 'task/progress'
    | 'tool/call_started'
    | 'tool/call_finished'
    | 'approval/requested'
    | 'approval/resolved'
    | 'artifact/created'
    | 'task/completed'
    | 'task/failed'
    | 'task/cancelled';
  payload: Record<string, unknown>;
  timestamp: number;
}
```

设计要求：

1. 所有跨进程、跨入口事件必须使用 shared protocol 类型
2. Renderer store 不直接定义后端事件 shape，只消费协议对象
3. IPC handler 只做传输适配，不再隐式改写业务 payload
4. 协议对象必须支持版本字段或迁移函数，避免历史任务无法读取

### 3.2 Runtime API / App Server Foundation

在 Electron 主进程内部先抽象本地 Runtime API，不要求本版直接暴露网络端口。

建议接口：

```typescript
export interface AgentRuntimeApi {
  startTask(params: StartTaskParams): Promise<StartTaskResponse>;
  interruptTask(params: InterruptTaskParams): Promise<InterruptTaskResponse>;
  resumeTask(params: ResumeTaskParams): Promise<ResumeTaskResponse>;
  cancelTask(params: CancelTaskParams): Promise<CancelTaskResponse>;
  respondApproval(params: ApprovalResponseParams): Promise<ApprovalResponse>;
  readRun(params: ReadRunParams): Promise<ReadRunResponse>;
  listRuns(params: ListRunsParams): Promise<ListRunsResponse>;
}
```

分层目标：

1. Electron UI 调用 `AgentRuntimeApi`
2. Scheduler 调用 `AgentRuntimeApi`
3. IM / Feishu 调用 `AgentRuntimeApi`
4. MCP server mode 后续也通过 `AgentRuntimeApi` 触发任务
5. 未来 CLI / local HTTP / websocket 只新增 transport，不改核心任务逻辑

推荐实现阶段：

1. Phase A: `AgentRuntimeApi` in-process facade
2. Phase B: IPC handler 迁移为 Runtime API adapter
3. Phase C: 可选 local app server / websocket transport

### 3.3 Unified Approval Policy

将现有视觉审批、AskUser、CLI 白名单、高风险桌面动作、MCP 工具审批收敛为统一策略层。

```typescript
export type ApprovalMode = 'auto' | 'prompt' | 'deny';
export type ApprovalSubject = 'browser' | 'desktop' | 'visual' | 'cli' | 'mcp' | 'skill';
export type ApprovalRiskLevel = 'low' | 'medium' | 'high';

export interface ApprovalPolicyRule {
  id: string;
  subject: ApprovalSubject;
  mode: ApprovalMode;
  riskLevel?: ApprovalRiskLevel;
  actionTypes?: string[];
  toolNames?: string[];
  intentKeywords?: string[];
  description: string;
}

export interface ApprovalRequest {
  id: string;
  runId: string;
  subject: ApprovalSubject;
  actionSummary: string;
  actions: unknown[];
  riskLevel: ApprovalRiskLevel;
  riskReasons: string[];
  matchedRules: string[];
  taskContext: Record<string, unknown>;
  createdAt: number;
}
```

策略要求：

1. 所有执行器执行前都可调用 `ApprovalPolicyService.evaluate()`
2. 审批请求必须写入 trace 和 task history
3. 用户拒绝后必须返回结构化 `APPROVAL_DENIED`，不得静默失败
4. 用户确认后必须记录确认来源、时间、规则 ID 和动作摘要
5. MCP server 可配置 default approval mode 和 per-tool override

### 3.4 Structured Execution Output

统一 Browser、Desktop、CLI、MCP、Skill 的执行输出，避免不同面板各自解析字符串。

```typescript
export interface ExecutionOutput {
  id: string;
  runId: string;
  actionId?: string;
  target: ExecutionTargetKind;
  status: 'success' | 'failed' | 'cancelled' | 'timeout';
  summary: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs: number;
  truncated?: boolean;
  artifacts?: RuntimeArtifact[];
  error?: RuntimeError;
}

export interface RuntimeArtifact {
  id: string;
  kind: 'file' | 'screenshot' | 'trace' | 'diff' | 'json' | 'link' | 'log';
  title: string;
  uri?: string;
  inlinePreview?: string;
  metadata?: Record<string, unknown>;
}
```

CLI 输出要求：

1. stdout / stderr 超过阈值时截断，并保存完整输出为 artifact
2. 所有命令都记录 working directory、duration、exit code
3. 命令执行失败必须区分 timeout、non-zero exit、spawn failure、policy denied
4. UI 默认显示 summary 和截断输出，完整日志通过 artifact 查看

### 3.5 Plan Mode Productization

Plan Mode 是只读分析模式，用于“先分析”“给方案”“不要改动”“review”等任务。

```typescript
export interface RuntimeSessionMode {
  mode: 'plan' | 'execute';
  allowedTargets: ExecutionTargetKind[];
  writeAllowed: boolean;
  browserMutationAllowed: boolean;
  cliMutationAllowed: boolean;
}
```

行为要求：

1. Plan Mode 禁止文件写入、提交表单、点击高风险按钮、执行写命令
2. Plan Mode 可以读取文件、搜索、截图、观察页面、生成计划
3. UI 明确展示当前是 Plan Mode 还是 Execute Mode
4. 从 Plan Mode 切换到 Execute Mode 必须有用户确认
5. Plan Mode 输出可以保存为任务草稿或模板草稿

### 3.6 AGENTS.md / Workspace Rules Productization

把当前 repo-specific instruction 能力产品化，而不是只作为开发约定。

能力要求：

1. 任务开始时自动发现工作目录向上的 `AGENTS.md`
2. 把已加载规则写入 run trace
3. UI 中显示当前任务应用了哪些 workspace rules
4. Planner 和 ApprovalPolicyService 可读取规则影响执行策略
5. 规则加载失败不得阻塞任务，但必须产生 warning trace

建议对象：

```typescript
export interface WorkspaceRuleSet {
  id: string;
  sourcePath: string;
  scopePath: string;
  content: string;
  loadedAt: number;
  warnings?: string[];
}
```

### 3.7 Trace / Diff / File Watcher

任务执行必须从“步骤日志”升级为“可审计运行轨迹”。

Trace 需要关联：

1. 用户输入
2. 规划结果
3. 每个动作的开始和结束
4. 审批请求与用户响应
5. 浏览器 / 桌面观察截图
6. CLI / MCP / Skill 输出
7. 文件变更 diff
8. 生成 artifact
9. 最终 TaskResult

建议对象：

```typescript
export interface RuntimeTraceEvent extends RuntimeEvent {
  sequence: number;
  parentEventId?: string;
  visibility: 'user' | 'debug' | 'internal';
}

export interface FileChangeSummary {
  path: string;
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  diffArtifactId?: string;
  detectedAt: number;
}
```

实现要求：

1. 任务开始时记录 baseline file state
2. 任务结束时生成 changed files summary
3. 对文本文件生成 diff artifact
4. 对二进制文件只记录路径、大小、hash 和 change type
5. 用户审批时可看到相关动作和潜在变更影响

### 3.8 Configuration System

建立统一配置入口，降低 settings、stores、MCP、IM、skills、approval policy 分散配置带来的维护成本。

建议配置路径：

```text
~/.opencowork/config.json
~/.opencowork/state.db
~/.opencowork/logs/
~/.opencowork/skills/
```

配置模块：

1. runtime default mode
2. approval policies
3. MCP servers and per-tool approval
4. skill directories
5. log directory and retention
6. sqlite home
7. visual provider defaults
8. benchmark release gate

要求：

1. 提供 schema 和默认值
2. 配置读取失败必须回退默认值并产生 warning
3. 配置写入必须具备并发保护和备份
4. UI settings 面板只作为配置编辑器，不再散落业务规则

### 3.9 TaskEngine Decomposition

`TaskEngine` 继续作为 facade，但把高频职责拆出，减少单文件膨胀。

建议拆分：

```text
src/core/runtime/
├── TaskEngine.ts
├── AgentRuntimeApi.ts
├── TaskLifecycleController.ts
├── TaskEventEmitter.ts
├── TaskApprovalCoordinator.ts
├── TaskTraceCollector.ts
├── TaskStatePersistence.ts
├── WorkspaceRuleLoader.ts
└── RuntimeConfigService.ts
```

拆分原则：

1. `TaskEngine` 保持对外兼容 facade
2. 新能力优先放到独立 service / coordinator
3. 不在一个 PR 中大规模移动无关逻辑
4. 拆分必须带回归测试，避免任务生命周期回退

## 4. 用户可见变化

1. 用户能看到当前任务是 Plan Mode 还是 Execute Mode
2. 高风险动作确认理由更清晰，覆盖 browser / desktop / CLI / MCP / skill
3. 任务结束后可查看完整 trace：计划、动作、审批、截图、输出、文件变更、结果
4. 设置页能集中管理审批策略、MCP 工具默认审批和运行时配置
5. 任务历史更适合审计和复盘，不只是查看聊天消息
6. 后续 CLI、IM、MCP、Web UI 复用同一运行时能力，不再表现不一致

## 5. 实施计划

| Week | 任务 | 交付物 |
| --- | --- | --- |
| 1-2 | Shared protocol foundation | `src/shared/protocol/*`、核心事件类型、迁移测试 |
| 2-3 | Runtime API facade | `AgentRuntimeApi`、IPC adapter 初步迁移 |
| 3-4 | Unified approval policy | `ApprovalPolicyService`、统一审批对象、UI 适配 |
| 4-5 | Structured execution output | CLI / MCP / Skill / Browser 输出归一化、长输出 artifact |
| 5-6 | Plan Mode and workspace rules | Plan Mode 状态、AGENTS.md 加载、UI 展示 |
| 6-7 | Trace / diff / file watcher | 运行轨迹、文件变更摘要、diff artifact |
| 7-8 | Config schema and TaskEngine decomposition | 配置 schema、RuntimeConfigService、首批 coordinator 拆分 |
| 8-9 | Regression and docs | 协议、审批、trace、配置、恢复回归测试与用户文档 |

## 6. 验收标准

1. Chat、Scheduler、IM 至少三类入口通过 shared protocol 产生一致的 run event
2. Browser、Desktop/Visual、CLI、MCP、Skill 至少五类动作能通过统一 approval policy 评估
3. CLI 长输出可被截断并保存完整 artifact，UI 不因大输出卡死
4. Plan Mode 下写文件、写命令、提交表单类动作被阻止或要求切换 Execute Mode
5. 任务 trace 能展示计划、动作、审批、输出、artifact、文件变更和最终结果
6. `AGENTS.md` 加载结果能在 trace 中看到，并参与任务上下文
7. 配置层具备默认值、schema、读取失败回退和写入错误处理
8. `TaskEngine` 外移至少两个职责模块，原有任务生命周期测试通过

## 7. 测试计划

### 7.1 单元测试

1. protocol 类型转换和历史 payload 归一化
2. approval policy rule matching
3. execution output truncation and artifact generation
4. Plan Mode action guard
5. workspace rule discovery
6. config default / invalid config fallback

### 7.2 集成测试

1. chat start task -> Runtime API -> TaskEngine -> renderer event
2. scheduler start task -> Runtime API -> TaskResult
3. IM start task -> Runtime API -> run link / result summary
4. approval requested -> user approve / deny -> execution continue / fail
5. task run generates trace and file change summary

### 7.3 回归测试

1. 现有 browser task run 不因协议层改造回退
2. 现有 result / history / task-run 页面能读取旧数据
3. 现有 visual approval dialog 能消费新的 approval request
4. 现有 MCP panel 和 skill panel 不因统一配置迁移失效

## 8. 风险

1. 协议层改造容易引发跨入口 payload 不兼容，需要迁移函数和兼容测试
2. 统一审批可能短期增加用户确认次数，需要默认策略保持克制
3. Trace / diff / artifact 可能带来存储增长，需要 retention 和大小限制
4. TaskEngine 拆分可能引入生命周期竞态，必须小步拆分并保持 facade
5. 配置系统收口可能与现有 settings store 重叠，需要先读后写、逐步迁移

## 9. 未来扩展

1. Local App Server / websocket transport
2. CLI client 复用 AgentRuntimeApi
3. Web UI 或移动端运行详情查看
4. 企业策略包和团队级审批模板
5. 可导出的 task trace bundle，用于调试、审计和 benchmark 复现
