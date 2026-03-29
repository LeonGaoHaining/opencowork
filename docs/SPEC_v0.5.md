# OpenCowork v0.5 技术规格说明书

| 项目     | 内容       |
| -------- | ---------- |
| 版本     | v0.5       |
| 更新日期 | 2026-03-30 |
| 状态     | 规划中     |
| 基于PRD  | v2.5       |
| 前置版本 | v0.4       |

---

## 目录

1. [版本目标](#1-版本目标)
2. [技术架构](#2-技术架构)
3. [核心模块设计](#3-核心模块设计)
4. [文件结构](#4-文件结构)
5. [实施计划](#5-实施计划)
6. [成功指标](#6-成功指标)

---

## 1. 版本目标

**目标**: 完善功能 + 任务历史 + 白名单配置

### 核心目标

| 目标          | 说明                                   |
| ------------- | -------------------------------------- |
| **任务历史**  | 完整记录所有任务执行历史，支持回溯查看 |
| **白名单UI**  | 可视化配置 CLI/Agent 权限白名单        |
| **Skill系统** | 支持 SKILL.md 规范，可扩展 Agent 能力  |

### 版本功能

| 功能             | 周期     | 交付标准           |
| ---------------- | -------- | ------------------ |
| **任务历史记录** | Week 1-4 | 执行历史、结果保存 |
| **白名单配置UI** | Week 3-6 | 可视化配置界面     |
| **Skill系统**    | Week 5-8 | SKILL.md规范支持   |

### 与 v0.4 关系

| 组件     | v0.4 实现               | v0.5 增强                |
| -------- | ----------------------- | ------------------------ |
| 任务历史 | 无                      | 完整历史记录存储和查询   |
| 白名单   | 代码配置 (whitelist.ts) | 可视化 UI 配置           |
| Skill    | 无                      | SKILL.md 规范 + 加载器   |
| 存储     | MemorySaver             | Memory + SQLite 混合方案 |

---

## 2. 技术架构

### 2.1 架构对比

| 模块         | v0.4 实现           | v0.5 增强                |
| ------------ | ------------------- | ------------------------ |
| **任务历史** | 无                  | History Store + 查询 API |
| **白名单**   | 硬编码 whitelist.ts | UI 配置 + 持久化         |
| **Skill**    | 无                  | SkillLoader + 规范       |
| **存储**     | MemorySaver         | Memory + SQLite 混合     |
| **Agent**    | MainAgent (固定)    | MainAgent + Skill 支持   |

### 2.2 存储架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐      ┌─────────────────┐             │
│  │   MemoryStore   │ ←→   │   SQLite       │             │
│  │   (实时读写)    │      │   (持久化)      │             │
│  └────────┬────────┘      └────────┬────────┘             │
│           │                        │                       │
│           ▼                        ▼                       │
│  ┌─────────────────────────────────────────────┐          │
│  │              HistoryStore                     │          │
│  │  - 当前会话: MemoryStore                    │          │
│  │  - 历史查询: SQLite                         │          │
│  │  - 自动同步到磁盘                           │          │
│  └─────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 架构图

```
User Task
    ↓
┌─────────────────────────────────────────────┐
│           LangGraph Agent                    │
│  ┌─────────────┐   ┌─────────────┐         │
│  │   Planner   │ → │  Executor   │         │
│  │   Node      │   │   Node      │         │
│  └──────┬──────┘   └──────┬──────┘         │
│         │                   │                 │
│         ↓                   ↓                 │
│  ┌─────────────┐   ┌─────────────┐          │
│  │   Memory   │ → │   History   │          │
│  │   Node      │   │   Node      │          │
│  └─────────────┘   └─────────────┘          │
└─────────────────────────────────────────────┘
          ↓                   ↓
┌─────────────────────────────────────────────┐
│           Skill System                       │
│  ┌─────────────┐   ┌─────────────┐         │
│  │ SkillLoader │   │ SkillStore  │         │
│  │ (加载器)    │   │ (存储)      │         │
│  └─────────────┘   └─────────────┘         │
└─────────────────────────────────────────────┘
```

---

## 3. 核心模块设计

### 3.1 TaskHistory 模块

#### 3.1.1 数据模型

```typescript
// src/history/taskHistory.ts

export interface TaskHistoryRecord {
  id: string;
  taskId: string;
  task: string;
  status: 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime: number;
  duration: number;
  steps: TaskStep[];
  result?: {
    success: boolean;
    output?: any;
    error?: string;
  };
  agentMemory?: Record<string, any>;
  metadata?: {
    model?: string;
    threadId?: string;
    [key: string]: any;
  };
}

export interface TaskStep {
  id: string;
  toolName: string;
  args: any;
  result?: any;
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  duration?: number;
}
```

#### 3.1.2 HistoryStore

```typescript
// src/history/historyStore.ts

export interface HistoryQueryOptions {
  limit?: number;
  offset?: number;
  status?: TaskHistoryRecord['status'];
  startDate?: number;
  endDate?: number;
  keyword?: string;
}

export class HistoryStore {
  private memoryStore: MemoryStore;
  private sqliteStore: SQLiteStore;

  constructor() {
    this.memoryStore = new MemoryStore();
    this.sqliteStore = new SQLiteStore({ path: './history.db' });
  }

  async saveTask(record: TaskHistoryRecord): Promise<void> {
    await this.memoryStore.put(['current'], `task_${record.id}`, record);
    await this.sqliteStore.put(['history'], `task_${record.id}`, record);
  }

  async getTask(taskId: string): Promise<TaskHistoryRecord | null> {
    return (
      (await this.memoryStore.get(['current'], `task_${taskId}`)) ||
      (await this.sqliteStore.get(['history'], `task_${taskId}`))
    );
  }

  async listTasks(options: HistoryQueryOptions = {}): Promise<TaskHistoryRecord[]> {
    return await this.sqliteStore.query(['history'], {
      filter: (record) => {
        if (options.status && record.status !== options.status) return false;
        if (options.startDate && record.startTime < options.startDate) return false;
        if (options.endDate && record.endTime > options.endDate) return false;
        if (options.keyword && !record.task.includes(options.keyword)) return false;
        return true;
      },
      limit: options.limit || 50,
      offset: options.offset || 0,
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.sqliteStore.delete(['history'], `task_${taskId}`);
  }

  async searchByDate(start: number, end: number): Promise<TaskHistoryRecord[]> {
    return this.listTasks({ startDate: start, endDate: end });
  }
}
```

#### 3.1.3 History API

```typescript
// src/history/historyApi.ts

export interface HistoryAPI {
  'GET /history': {
    query: HistoryQueryOptions;
    response: { tasks: TaskHistoryRecord[]; total: number };
  };

  'GET /history/:id': {
    params: { id: string };
    response: TaskHistoryRecord;
  };

  'POST /history/:id/replay': {
    params: { id: string };
    response: { taskId: string; status: 'started' };
  };

  'DELETE /history/:id': {
    params: { id: string };
    response: { success: boolean };
  };
}
```

#### 3.1.4 History UI

```typescript
// src/renderer/components/HistoryPanel.tsx

interface HistoryPanelProps {
  onSelectTask: (taskId: string) => void;
  onReplayTask: (taskId: string) => void;
}

export function HistoryPanel({ onSelectTask, onReplayTask }: HistoryPanelProps) {
  // Tab: 全部 | 成功 | 失败
  // 搜索框: 关键词搜索
  // 列表: 时间倒序, 显示任务描述、状态、时间
  // 分页: 加载更多
  // 右键: 查看详情 | 回放 | 删除
}
```

---

### 3.2 WhitelistConfigUI 模块

#### 3.2.1 配置模型

```typescript
// src/config/whitelistConfig.ts

export interface CLICommandWhitelist {
  command: string;
  allowed: boolean;
  args?: string[];
  description?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface PathWhitelist {
  path: string;
  allowed: boolean;
  permissions: ('read' | 'write' | 'execute')[];
  description?: string;
}

export interface AgentWhitelist {
  toolName: string;
  allowed: boolean;
  maxCallsPerTask?: number;
  description?: string;
}

export interface WhitelistConfig {
  cli: {
    enabled: boolean;
    commands: CLICommandWhitelist[];
  };
  paths: {
    enabled: boolean;
    entries: PathWhitelist[];
  };
  agents: {
    enabled: boolean;
    tools: AgentWhitelist[];
    maxStepsPerTask?: number;
  };
}
```

#### 3.2.2 配置编辑器 UI

```typescript
// src/renderer/components/WhitelistConfigPanel.tsx

export function WhitelistConfigPanel() {
  // Tab 页: CLI 命令 | 路径访问 | Agent 工具
  // 每个 Tab:
  //   - 开关: 启用/禁用
  //   - 列表: 显示所有条目
  //   - 操作: 添加 | 编辑 | 删除
  //   - 风险等级: 颜色标识 (绿/黄/橙/红)
  // 底部: 保存 | 重置
}
```

#### 3.2.3 配置持久化

```typescript
// src/config/whitelistConfigStore.ts

export class WhitelistConfigStore {
  private configPath = './config/whitelist.json';

  async load(): Promise<WhitelistConfig> {
    const content = await fs.readFile(this.configPath, 'utf-8');
    return JSON.parse(content);
  }

  async save(config: WhitelistConfig): Promise<void> {
    const validated = this.validate(config);
    if (!validated.valid) {
      throw new Error(`Invalid config: ${validated.errors.join(', ')}`);
    }
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  validate(config: WhitelistConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (config.cli.enabled) {
      config.cli.commands.forEach((cmd) => {
        if (!cmd.command) errors.push('CLI command name is required');
      });
    }
    return { valid: errors.length === 0, errors };
  }
}
```

---

### 3.3 Skill 系统

> 参考: [Claude Official Skill Specification](https://docs.anthropic.com/en/docs/claude-code/skills)

#### 3.3.1 设计原则

1. **兼容 Claude 官方标准** - SKILL.md 格式与 Claude Code 完全兼容
2. **支持 Claude 生态** - 可直接使用 Claude 官方和社区 Skill
3. **扩展能力** - 支持自定义 Skill 和私有 Skill

#### 3.3.2 SKILL.md 规范

Claude Skill 使用 **YAML frontmatter + Markdown content** 格式。

**文件结构**:

```
skill-name/
├── SKILL.md           # 主文件 (必需)
├── reference.md        # 参考文档 (可选)
├── examples/           # 示例目录 (可选)
│   └── sample.md
└── scripts/            # 脚本目录 (可选)
    └── helper.sh
```

#### 3.3.3 SKILL.md 格式

```yaml
---
name: skill-name                    # Skill 名称 (可选, 默认使用目录名)
description: 描述Skill功能和触发条件  # 推荐填写, 用于自动匹配
argument-hint: [argument]          # 参数提示
disable-model-invocation: false    # true=仅用户调用, false=AI可自动调用
user-invocable: true              # false=仅AI调用, 不显示在菜单
allowed-tools: []                  # 允许的工具列表
context: fork                      # fork=子Agent执行
agent: Explore                     # 子Agent类型: Explore/Plan/general-purpose
effort: medium                    # 努力级别: low/medium/high/max
---

# Skill 标题

Skill 描述和指令...

$ARGUMENTS          # 接收调用参数
${CLAUDE_SKILL_DIR}  # Skill 目录路径
${CLAUDE_SESSION_ID}  # 会话ID
```

#### 3.3.4 Frontmatter 字段说明

| 字段                       | 必填 | 说明                              |
| -------------------------- | ---- | --------------------------------- |
| `name`                     | 否   | Skill名称, 默认使用目录名         |
| `description`              | 推荐 | 功能描述, 用于AI自动匹配          |
| `argument-hint`            | 否   | 参数提示, 如 `[issue-number]`     |
| `disable-model-invocation` | 否   | `true`=仅用户调用, 防止AI自动执行 |
| `user-invocable`           | 否   | `false`=仅AI调用, 不显示在菜单    |
| `allowed-tools`            | 否   | 允许的工具列表                    |
| `context`                  | 否   | `fork`=子Agent执行                |
| `agent`                    | 否   | 子Agent类型                       |
| `effort`                   | 否   | 努力级别                          |
| `paths`                    | 否   | 文件路径匹配模式                  |
| `shell`                    | 否   | 使用的shell: `bash`/`powershell`  |

#### 3.3.5 动态内容注入

**Shell命令注入** (预处理):

```yaml
---
name: pr-summary
description: 总结PR变更
---
## PR 信息
- Diff: !`gh pr diff`
- Comments: !`gh pr view --comments`
- Files: !`gh pr diff --name-only`
```

**变量替换**:
| 变量 | 说明 |
|------|------|
| `$ARGUMENTS` | 所有传入参数 |
| `$ARGUMENTS[N]` | 第N个参数 (从0开始) |
| `$N` | `$ARGUMENTS[N]` 的简写 |
| `${CLAUDE_SESSION_ID}` | 当前会话ID |
| `${CLAUDE_SKILL_DIR}` | Skill目录路径 |

#### 3.3.6 Claude vs OpenCowork Skill 对比

| 特性      | Claude             | OpenCowork                  |
| --------- | ------------------ | --------------------------- |
| 文件格式  | SKILL.md (YAML+MD) | SKILL.md (兼容)             |
| 目录结构  | `name/SKILL.md`    | `name/SKILL.md` (兼容)      |
| 自动匹配  | description        | description + 自定义trigger |
| 用户调用  | `/name`            | `/name` (兼容)              |
| AI调用    | auto               | auto + 自定义策略           |
| 子Agent   | `context: fork`    | `context: fork` (兼容)      |
| Shell注入 | `` !`cmd` ``       | `` !`cmd` `` (兼容)         |
| 工具限制  | `allowed-tools`    | `allowed-tools` (兼容)      |

#### 3.3.7 OpenCowork 扩展字段

```yaml
---
name: my-skill
description: 我的Skill
# OpenCowork 扩展 (可选)
triggers: # 自定义触发条件
  - type: keyword # keyword/pattern/intent
    value: ['关键词1', '关键词2']
    priority: 80 # 优先级 0-100
    exclusive: false # 互斥
openworks-only: # 仅OpenCowork使用
  max-steps: 50 # 最大步数限制
  timeout: 300000 # 超时(ms)
---
```

#### 3.3.8 数据模型

```typescript
// src/skills/skillManifest.ts

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  argumentHint?: string;
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  allowedTools?: string[];
  context?: 'fork';
  agent?: 'Explore' | 'Plan' | 'general-purpose';
  effort?: 'low' | 'medium' | 'high' | 'max';
  paths?: string[];
  shell?: 'bash' | 'powershell';
}

export interface SkillManifest {
  name: string;
  description: string;
  content: string;
  frontmatter: SkillFrontmatter;
  directory: string;
  files?: {
    path: string;
    content: string;
  }[];
}

export interface InstalledSkill {
  manifest: SkillManifest;
  path: string;
  enabled: boolean;
}
```

#### 3.3.9 Skill 存储位置

| 位置 | 路径                            | 适用范围 |
| ---- | ------------------------------- | -------- |
| 系统 | `/usr/local/opencowork/skills/` | 所有用户 |
| 用户 | `~/.opencowork/skills/`         | 当前用户 |
| 项目 | `./.opencowork/skills/`         | 当前项目 |

#### 3.3.10 Skill 优先级

当同名 Skill 存在时, 优先级: **项目 > 用户 > 系统**

#### 3.3.2 SkillLoader

```typescript
// src/skills/skillLoader.ts

export class SkillLoader {
  private skillsDir: string;
  private manifestCache: Map<string, SkillManifest>;

  constructor(skillsDir: string = './config/skills') {
    this.skillsDir = skillsDir;
    this.manifestCache = new Map();
  }

  async loadSkill(skillPath: string): Promise<InstalledSkill> {
    const manifestPath = path.join(skillPath, 'SKILL.md');
    const content = await fs.readFile(manifestPath, 'utf-8');
    const manifest = this.parseManifest(content);
    this.manifestCache.set(manifest.name, manifest);
    return { manifest, path: skillPath, enabled: true };
  }

  async loadAllSkills(): Promise<InstalledSkill[]> {
    const entries = await fs.readdir(this.skillsDir);
    const skills: InstalledSkill[] = [];
    for (const entry of entries) {
      const skillPath = path.join(this.skillsDir, entry);
      const stat = await fs.stat(skillPath);
      if (stat.isDirectory()) {
        try {
          const skill = await this.loadSkill(skillPath);
          skills.push(skill);
        } catch (e) {
          console.warn(`Failed to load skill ${entry}:`, e);
        }
      }
    }
    return skills;
  }

  async matchSkill(userInput: string): Promise<InstalledSkill | null> {
    const skills = await this.loadAllSkills();
    const matched = skills
      .filter((s) => s.enabled)
      .filter((s) => this.matchesTrigger(s.manifest, userInput))
      .sort((a, b) => {
        const aPriority = a.manifest.triggers[0]?.priority || 50;
        const bPriority = b.manifest.triggers[0]?.priority || 50;
        return bPriority - aPriority;
      });

    if (matched.length > 0 && matched[0].manifest.triggers[0]?.exclusive) {
      return matched[0];
    }

    return matched[0] || null;
  }

  private matchesTrigger(manifest: SkillManifest, input: string): boolean {
    for (const trigger of manifest.triggers) {
      switch (trigger.type) {
        case 'keyword':
          return trigger.value.some((kw: string) => input.includes(kw));
        case 'pattern':
          return trigger.value.some((re: string) => new RegExp(re).test(input));
        case 'intent':
          // TODO: LLM-based intent matching
          return false;
      }
    }
    return false;
  }
}
```

#### 3.3.3 SkillMarket

```typescript
// src/skills/skillMarket.ts

export interface SkillListing {
  name: string;
  version: string;
  description: string;
  path: string;
  installed: boolean;
  updateAvailable?: boolean;
}

export class SkillMarket {
  private skillsDir: string;

  constructor(skillsDir: string = './config/skills') {
    this.skillsDir = skillsDir;
  }

  async listInstalledSkills(): Promise<SkillListing[]> {
    const loader = new SkillLoader(this.skillsDir);
    const skills = await loader.loadAllSkills();
    return skills.map((s) => ({
      name: s.manifest.name,
      version: s.manifest.version,
      description: s.manifest.description,
      path: s.path,
      installed: true,
    }));
  }

  async installSkill(skillPath: string): Promise<void> {
    const targetPath = path.join(this.skillsDir, path.basename(skillPath));
    await fs.cp(skillPath, targetPath, { recursive: true });
  }

  async uninstallSkill(skillName: string): Promise<void> {
    const skillPath = path.join(this.skillsDir, skillName);
    await fs.rm(skillPath, { recursive: true });
  }
}
```

---

### 3.4 Agent 集成

#### 3.4.1 Skill 与 Agent 的关系

```
User Input
    ↓
┌─────────────────┐
│ Skill Matcher    │ ← 匹配用户输入
└────────┬────────┘
         ↓ (matched)
┌─────────────────┐
│ Skill Executor  │ ← 执行 Skill 特定逻辑
└────────┬────────┘
         ↓
┌─────────────────┐
│   MainAgent     │ ← 继续标准 Agent 流程
└─────────────────┘
```

#### 3.4.2 集成代码

```typescript
// src/agents/skillAwareAgent.ts

export class SkillAwareAgent {
  private mainAgent: MainAgent;
  private skillLoader: SkillLoader;

  async executeTask(task: string): Promise<TaskResult> {
    const matchedSkill = await this.skillLoader.matchSkill(task);

    if (matchedSkill) {
      console.log(`[SkillAwareAgent] Matched skill: ${matchedSkill.manifest.name}`);
      const skillContext = await this.executeSkill(matchedSkill, task);
      return await this.mainAgent.run(task, { skillContext });
    }

    return await this.mainAgent.run(task);
  }

  private async executeSkill(skill: InstalledSkill, task: string): Promise<any> {
    // 执行 Skill 的初始化逻辑
    // 返回上下文供 MainAgent 使用
  }
}
```

---

## 4. 文件结构

### 4.1 新增文件

```
src/
├── history/                    # 任务历史模块
│   ├── taskHistory.ts        # 历史记录数据模型
│   ├── historyStore.ts       # 历史存储 (Memory + SQLite)
│   ├── historyApi.ts        # 历史查询 API
│   └── historyService.ts    # 历史服务
│
├── skills/                    # Skill 系统模块
│   ├── skillManifest.ts      # SKILL.md 规范
│   ├── skillLoader.ts        # Skill 加载器
│   ├── skillRunner.ts        # Skill 执行器
│   └── skillMarket.ts        # Skill 市场
│
├── config/
│   ├── whitelistConfig.ts     # 白名单配置模型
│   ├── whitelistConfigStore.ts # 配置持久化
│   └── whitelist.ts          # (保留) 运行时白名单
│
├── renderer/
│   ├── components/
│   │   ├── HistoryPanel.tsx         # 历史记录面板
│   │   ├── HistoryDetail.tsx        # 历史详情
│   │   ├── HistoryReplay.tsx        # 任务回放
│   │   ├── WhitelistConfigPanel.tsx # 白名单配置面板
│   │   └── SkillPanel.tsx           # Skill 管理面板
│   └── stores/
│       ├── historyStore.ts    # 历史状态管理
│       └── skillStore.ts     # Skill 状态管理
│
config/
├── whitelist.json             # 白名单配置
└── skills/                   # Skill 目录
    └── README.md             # Skill 编写指南
```

### 4.2 修改文件

```
src/
├── agents/
│   ├── mainAgent.ts          # 集成 History + Skill
│   └── skillAwareAgent.ts   # Skill 感知 Agent (新增)
├── renderer/
│   ├── App.tsx              # 添加 HistoryPanel 入口
│   └── components/
│       └── ControlBar.tsx   # 添加历史/配置入口
```

---

## 5. 实施计划

### 5.1 详细时间线

> 注: Week 计算从 v0.4 发布后开始

| 阶段        | 周次          | 任务                           | 交付物                             |
| ----------- | ------------- | ------------------------------ | ---------------------------------- |
| **Phase 1** | Week 1 (v0.5) | History 模块设计与实现         | historyStore.ts, TaskHistoryRecord |
| **Phase 2** | Week 2-3      | History UI 实现                | HistoryPanel.tsx                   |
| **Phase 3** | Week 2-4      | 白名单配置模型设计             | whitelistConfig.ts                 |
| **Phase 4** | Week 3-5      | 白名单配置 UI 实现             | WhitelistConfigPanel.tsx           |
| **Phase 5** | Week 4-6      | Skill 系统设计 + SKILL.md 规范 | skillManifest.ts                   |
| **Phase 6** | Week 5-7      | SkillLoader + SkillRunner 实现 | skillLoader.ts                     |
| **Phase 7** | Week 6-8      | Skill UI + Agent 集成          | SkillPanel.tsx, skillAwareAgent.ts |
| **Phase 8** | Week 8        | 最终测试 + 发布                | v0.5 Release                       |

### 5.2 依赖包

```json
{
  "dependencies": {
    "@langchain/langgraph": "^0.0.50",
    "@langchain/core": "^0.3.0",
    "better-sqlite3": "^9.0.0"
  }
}
```

---

## 6. 成功指标

| 指标       | v0.4   | v0.5 目标      | 说明              |
| ---------- | ------ | -------------- | ----------------- |
| 任务历史   | 无     | **完整保存**   | 可追溯、可回放    |
| 历史查询   | 无     | **<100ms**     | 查询性能          |
| 白名单配置 | 硬编码 | **可视化配置** | 无需修改代码      |
| Skill 系统 | 无     | **基础支持**   | SKILL.md 加载执行 |
| 配置持久化 | 无     | **JSON 文件**  | 用户配置可保存    |

### 6.1 测试指标

| 测试类型 | 覆盖率目标   |
| -------- | ------------ |
| 单元测试 | >75%         |
| 集成测试 | >50%         |
| E2E 测试 | 核心场景覆盖 |

### 6.2 API 指标

| 指标             | 目标   |
| ---------------- | ------ |
| 历史查询响应时间 | <100ms |
| Skill 匹配时间   | <50ms  |
| 白名单验证时间   | <10ms  |

---

## 7. 实施变更记录

### 7.1 v0.5 规划说明

> 更新日期: 2026-03-30

以下为 v0.5 版本的规划说明，基于 PRD v2.5。

---

_最后更新: 2026-03-30_
