# OpenCowork v0.8 使用说明

| 项目     | 内容       |
| -------- | ---------- |
| 版本     | v0.8       |
| 更新日期 | 2026-04-02 |
| 状态     | 正式版     |

---

## 目录

1. [项目简介](#1-项目简介)
2. [WebFetch 网页获取](#2-webfetch-网页获取)
3. [WebSearch 网页搜索](#3-websearch-网页搜索)
4. [TaskHistory 任务历史](#4-taskhistory-任务历史)
5. [Skill System 技能系统](#5-skill-system-技能系统)
6. [IM 消息集成](#6-im-消息集成)
7. [定时任务调度](#7-定时任务调度)
8. [WhitelistConfigUI 白名单配置](#8-whitelistconfigui-白名单配置)
9. [快速开始](#9-快速开始)
10. [目录结构](#10-目录结构)
11. [常见问题](#11-常见问题)

---

## 1. 项目简介

OpenCowork v0.8 是一款 **AI Native Desktop Agent**，让AI像人类一样使用电脑完成复杂任务。

### v0.8 新增功能

| 功能          | 说明                     |
| ------------- | ------------------------ |
| **WebFetch**  | 轻量级HTTP网页获取工具   |
| **WebSearch** | Exa AI 实时网页搜索      |
| **UA轮换**    | Cloudflare反爬虫自动绕过 |
| **代理支持**  | HTTP/HTTPS 代理认证      |
| **执行日志**  | 完整日志记录便于调试     |
| **通用重试**  | 网络错误自动重试         |

### 核心能力

| 能力         | 说明                          |
| ------------ | ----------------------------- |
| 浏览器自动化 | AI自主操作浏览器完成网页任务  |
| 网页获取     | 轻量级HTTP请求获取网页内容    |
| 实时搜索     | Exa AI 实时网络搜索           |
| 任务规划     | 将复杂任务分解为可执行步骤    |
| 实时预览     | 侧边栏实时观看AI操作（24fps） |
| 人工接管     | 随时接管AI的控制权            |
| 任务历史     | 完整记录所有任务执行历史      |
| 技能系统     | 安装和管理自定义技能          |
| IM消息       | 支持飞书/钉钉/企业微信        |
| 定时任务     | Cron/Interval 任务调度        |

---

## 2. WebFetch 网页获取

### 功能特点

- **轻量级HTTP请求**：无需启动浏览器，快速获取网页内容
- **多格式支持**：text / markdown / html
- **UA轮换**：Cloudflare反爬虫自动绕过
- **代理支持**：支持HTTP代理认证
- **Cookie管理**：自动保持会话状态
- **响应限制**：最大5MB，超大自动拒绝

### 使用方法

AI会自动根据任务选择使用webfetch或browser工具：

1. **数据采集**：让AI获取指定网页内容
2. **API调用**：调用REST API获取数据
3. **内容提取**：提取网页文本进行分析

### 参数说明

| 参数            | 类型    | 默认值   | 说明       |
| --------------- | ------- | -------- | ---------- |
| url             | string  | 必填     | 目标URL    |
| format          | enum    | markdown | 返回格式   |
| timeout         | number  | 30       | 超时秒数   |
| method          | enum    | GET      | 请求方法   |
| retryOnUAChange | boolean | true     | UA重试     |
| cookieJar       | boolean | true     | Cookie保持 |
| proxy           | string  | null     | 代理地址   |

---

## 3. WebSearch 网页搜索

### 功能特点

- **实时搜索**：基于Exa AI MCP的实时网络搜索
- **内容爬取**：自动获取搜索结果详细内容
- **多种模式**：auto / fast / deep 搜索模式
- **结果控制**：可配置返回结果数量

### 使用方法

让AI搜索最新信息：

```
搜索最新的AI新闻
查找关于OpenCowork的教程
搜索2026年的技术趋势
```

### 参数说明

| 参数                 | 类型   | 默认值   | 说明         |
| -------------------- | ------ | -------- | ------------ |
| query                | string | 必填     | 搜索关键词   |
| numResults           | number | 8        | 结果数量     |
| livecrawl            | enum   | fallback | 实时爬取模式 |
| type                 | enum   | auto     | 搜索类型     |
| contextMaxCharacters | number | 10000    | 上下文长度   |

---

## 4. TaskHistory 任务历史

### 功能特点

- **SQLite 持久化**：任务历史存储在本地数据库，重启后保留
- **状态追踪**：支持 pending/running/completed/failed/cancelled 五种状态
- **步骤详情**：记录每个任务的执行步骤和耗时
- **实时统计**：显示任务成功/失败/取消统计

### 使用方法

1. 点击控制栏中的 **历史** 按钮打开任务历史面板
2. 查看所有任务的执行记录
3. 点击任务查看详细信息（步骤、耗时、结果）
4. 支持搜索和按状态筛选

### 数据存储

- 数据库路径：`./history.db`
- 内存缓存：最近任务缓存在内存中提高查询速度
- 自动同步：任务完成后自动同步到 SQLite

---

## 3. Skill System 技能系统

### 什么是 Skill？

Skill 是一种可扩展的功能模块，通过 `SKILL.md` 文件定义，符合 Claude 官方规范。

### 使用 Skill

1. 打开 **Skill 管理** 面板（控制栏按钮）
2. 点击 **安装 Skill** 输入技能目录路径
3. 已安装的技能会自动显示在列表中
4. 在任务输入框中触发技能（通过关键词匹配）

### SKILL.md 示例

```yaml
---
name: git-helper
description: Git 操作助手
triggers:
  - type: keyword
    value: [git, github]
    priority: 80
    exclusive: false
shell: bash
---

# Git Helper Skill

使用 git 命令帮助完成版本控制任务。

## 可用命令

$ARGUMENTS
```

### 目录结构

```
~/.opencowork/skills/
├── git-helper/
│   ├── SKILL.md
│   └── package.json
└── code-review/
    ├── SKILL.md
    └── package.json
```

### 安全机制

- **路径验证**：Skill 只能在指定目录下加载
- **命令白名单**：仅允许预定义的命令执行
- **Shell 注入保护**：默认关闭 shell 注入

---

## 4. IM 消息集成

### 支持平台

- 飞书 (Feishu)
- 钉钉 (DingTalk)
- 企业微信 (WeCom)
- Slack
- GitHub

### 功能特点

- **任务分发**：通过 IM 消息创建任务
- **状态查询**：查询任务执行状态
- **接管控制**：通过消息接管/交还控制权

### 使用方法

1. 配置 IM 平台应用凭证
2. 启动应用后，IM Bot 自动监听消息
3. 发送命令控制任务

### 命令列表

| 命令        | 说明          | 示例                    |
| ----------- | ------------- | ----------------------- |
| 任务 [描述] | 创建新任务    | `任务 帮我查下北京天气` |
| 状态 [ID]   | 查询任务状态  | `状态 abc123`           |
| 列表        | 查看最近任务  | `列表`                  |
| 接管 [ID]   | 接管任务      | `接管 abc123`           |
| 交还        | 交还控制给 AI | `交还`                  |
| 取消 [ID]   | 取消任务      | `取消 abc123`           |
| 帮助        | 显示帮助      | `帮助`                  |

---

## 5. 定时任务调度

### 功能特点

- **多种调度方式**：Cron / Interval / One-time
- **优先级队列**：支持任务优先级
- **自动重试**：失败任务自动重试
- **持久化存储**：任务配置存储在 SQLite

### 使用方法

1. 打开 **定时任务** 面板
2. 点击 **新建任务**
3. 配置任务参数
4. 设置调度类型和时间
5. 启用任务

### 调度类型

| 类型     | 说明             | 配置示例              |
| -------- | ---------------- | --------------------- |
| Cron     | 标准 cron 表达式 | `0 9 * * *` (每天9点) |
| Interval | 固定间隔         | `3600000` (1小时)     |
| One-time | 一次性           | `2026-04-02T09:00:00` |

---

## 6. WhitelistConfigUI 白名单配置

### 功能特点

- **可视化配置**：图形界面管理 CLI/路径/网络/Agent 白名单
- **风险等级**：每条规则标注风险等级（低/中/高/极高）
- **实时生效**：保存后立即生效

### 配置项

| 类型       | 说明                               |
| ---------- | ---------------------------------- |
| CLI 命令   | 允许执行的系统命令及参数           |
| 路径访问   | 允许访问的目录及权限（读/写/执行） |
| 网络访问   | 允许访问的主机和阻止的端口         |
| Agent 工具 | 允许使用的工具和最大调用次数       |

### 使用方法

1. 打开 **设置** 或 **白名单配置** 面板
2. 切换标签页查看不同类型的配置
3. 修改后点击 **保存** 按钮
4. 点击 **重置** 恢复默认配置

---

## 7. 快速开始

### 5.1 安装依赖

```bash
cd opencowork
npm install
```

### 5.2 配置 LLM

编辑 `config/llm.json`，填入你的 Azure OpenAI 配置：

```json
{
  "provider": "openai",
  "model": "gpt-4-turbo",
  "apiKey": "你的API Key",
  "baseUrl": "https://your-resource.openai.azure.com/openai/v1"
}
```

### 5.3 启动应用

```bash
npm run electron:dev
```

### 5.4 创建任务

在输入框中描述你想完成的任务：

```
打开百度并搜索高海宁
在小红书搜索护肤教程
使用 git-helper 提交代码
```

---

## 8. 目录结构

```
opencowork/
├── src/
│   ├── main/                   # Electron 主进程
│   │   ├── index.ts            # 应用入口
│   │   ├── ipc.ts             # IPC 通信
│   │   ├── ipcHandlers.ts     # IPC 处理器
│   │   ├── SessionManager.ts  # 会话管理
│   │   └── PreviewManager.ts  # 预览管理
│   │
│   ├── core/                  # 核心业务逻辑
│   │   ├── action/             # Action 定义
│   │   │   └── ActionSchema.ts
│   │   ├── executor/            # 执行器
│   │   │   ├── BrowserExecutor.ts
│   │   │   ├── CLIExecutor.ts
│   │   │   ├── AskUserExecutor.ts
│   │   │   └── ScreencastService.ts
│   │   ├── planner/            # 任务规划
│   │   │   ├── TaskPlanner.ts
│   │   │   ├── PlanExecutor.ts
│   │   │   └── Replanner.ts
│   │   └── runtime/            # 运行时
│   │       ├── TaskEngine.ts
│   │       └── TakeoverManager.ts
│   │
│   ├── renderer/              # React UI
│   │   ├── App.tsx
│   │   ├── stores/             # Zustand 状态管理
│   │   │   ├── taskStore.ts
│   │   │   ├── sessionStore.ts
│   │   │   ├── historyStore.ts
│   │   │   └── schedulerStore.ts
│   │   └── components/          # React 组件
│   │
│   ├── im/                    # IM 集成 (v0.7 新增)
│   │   ├── DispatchService.ts
│   │   ├── CommandParser.ts
│   │   ├── feishu/
│   │   └── store/
│   │
│   ├── scheduler/             # 定时任务 (v0.7 新增)
│   │   ├── scheduler.ts
│   │   ├── taskQueue.ts
│   │   ├── taskExecutor.ts
│   │   └── types.ts
│   │
│   ├── history/               # 任务历史
│   │   ├── taskHistory.ts
│   │   ├── memoryStore.ts
│   │   ├── sqliteStore.ts
│   │   ├── historyStore.ts
│   │   └── historyService.ts
│   │
│   ├── skills/                # 技能系统
│   │
│   ├── memory/                # 记忆模块
│   │
│   ├── llm/                   # LLM 客户端
│   │
│   ├── checkpointers/          # Checkpoint 持久化
│   │
│   ├── recovery/              # 恢复引擎
│   │
│   └── browser/               # 浏览器工具
│
└── docs/
    ├── USER_GUIDE.md         # 本文档
    ├── CHANGELOG.md          # 变更日志
    └── PRD.md                 # 产品需求
```

---

## 9. 常见问题

### Q1: TaskHistory 数据存储在哪里？

**A**: 默认存储在 `./history.db` 文件中，使用 SQLite 数据库。

### Q2: 如何安装新的 Skill？

**A**:

1. 准备好包含 `SKILL.md` 的技能目录
2. 打开 Skill 管理面板
3. 点击"安装 Skill"按钮
4. 输入技能目录的完整路径

### Q3: Skill 不起作用怎么办？

**A**:

1. 确认 `SKILL.md` 文件存在且格式正确
2. 检查触发关键词是否匹配
3. 查看控制台是否有加载错误

### Q4: 白名单配置保存失败？

**A**:

1. 检查配置格式是否正确
2. 确认没有重复的主机名或命令
3. 查看验证错误信息并修正

### Q5: 如何配置 IM 集成？

**A**:

1. 在飞书开放平台创建应用
2. 获取 App ID 和 App Secret
3. 配置 Webhook 地址指向应用服务器
4. 在 `config/` 目录下创建 IM 配置文件

### Q6: 定时任务如何工作？

**A**:

- **Cron**: 使用标准 cron 表达式（如 `0 9 * * *` 每天9点）
- **Interval**: 固定间隔（如每 30 分钟）
- **One-time**: 一次性任务，执行后自动禁用

---

## 版本历史

- **v0.8** (2026-04-02) - WebFetch + WebSearch + 执行日志 + 代码审核修复
- **v0.7** (2026-04-01) - IM集成 + 定时任务 + Takeover改进 + 代码审核修复
- **v0.6** (2026-04-01) - 预览模式 + Checkpoint 持久化
- **v0.5** (2026-03-30) - TaskHistory + Skill System + WhitelistConfigUI
- **v0.4** (2026-03-30) - LangChain/LangGraph 重构
- **v0.3** (2026-03-29) - 工业级 Browser Agent 架构
- **v0.2.3** (2026-03-29) - 元素滚动 + PressEnter 支持

---

_OpenCowork v0.8_
_最后更新: 2026-04-02_
