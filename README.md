<h1 align="center">
  <br>
  <img src="docs/images/logo.png" alt="OpenCowork" width="200">
  <br>
  OpenCowork
  <br>
</h1>

<p align="center">
  <a href="https://github.com/LeonGaoHaining/opencowork/stargazers">
    <img src="https://img.shields.io/github/stars/LeonGaoHaining/opencowork?style=social" alt="stars">
  </a>
  <a href="https://github.com/LeonGaoHaining/opencowork/releases">
    <img src="https://img.shields.io/github/v/release/LeonGaoHaining/opencowork?include_prereleases" alt="release">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/LeonGaoHaining/opencowork" alt="license">
  </a>
  <a href="https://github.com/LeonGaoHaining/opencowork/issues">
    <img src="https://img.shields.io/github/issues/LeonGaoHaining/opencowork" alt="issues">
  </a>
  <a href="https://github.com/LeonGaoHaining/opencowork/pulls">
    <img src="https://img.shields.io/github/issues-pr/LeonGaoHaining/opencowork" alt="prs">
  </a>
  <a href="https://opencowork.me">
    <img src="https://img.shields.io/badge/Website-opencowork.me-brightgreen" alt="website">
  </a>
</p>

<p align="center">
  <b>AI Native Desktop Agent</b> - 让 AI 像人类一样操作电脑完成复杂任务
</p>

---

## ✨ 核心特性

| 特性                | 说明                          |
| ------------------- | ----------------------------- |
| 🧠 **AI 智能规划**  | LLM 驱动的任务规划与分解      |
| 🌐 **浏览器自动化** | AI 自主操作浏览器完成网页任务 |
| 🔍 **网页获取**     | 轻量级 HTTP 请求获取网页内容  |
| 🔎 **实时搜索**     | Exa AI 实时网络搜索           |
| ⏰ **定时任务**     | Cron/Interval 任务调度        |
| 💬 **IM 集成**      | 支持飞书、钉钉、企业微信      |
| 📝 **任务历史**     | 完整记录所有任务执行历史      |
| 🛠️ **技能系统**     | 可扩展的自定义技能            |
| 👁️ **实时预览**     | 侧边栏实时观看 AI 操作        |

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 9+
- Python 3.8+（用于某些技能脚本）

### 安装

```bash
# 克隆项目
git clone https://github.com/LeonGaoHaining/opencowork.git
cd opencowork

# 安装依赖
npm install

# 配置 LLM
# 编辑 config/llm.json，填入您的 API 配置

# 启动开发模式
npm run electron:dev
```

### 配置 LLM

创建 `config/llm.json`：

```json
{
  "provider": "openai",
  "model": "gpt-4-turbo",
  "apiKey": "your-api-key",
  "baseUrl": "https://api.openai.com/v1",
  "timeout": 60000
}
```

---

## 📖 使用示例

### 基本任务

```
打开百度并搜索"最新AI新闻"
帮我查一下北京天气
创建个PPT介绍公司产品
```

### IM 消息控制（飞书）

```
任务 帮我查下北京天气
状态 abc123
列表
接管 abc123
```

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                     OpenCowork                           │
├─────────────────────────────────────────────────────────┤
│  UI 层 (React + Electron)                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │   Chat UI   │ │  ControlBar  │ │  Preview    │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
├─────────────────────────────────────────────────────────┤
│  主进程 (Main Process)                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │    IPC      │ │   Session   │ │  Scheduler  │        │
│  │  Manager    │ │  Manager    │ │   Manager   │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
├─────────────────────────────────────────────────────────┤
│  核心层 (Core)                                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │ TaskEngine  │ │  TaskPlan   │ │   Agent     │        │
│  │             │ │   -er       │ │  (LLM)      │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
├─────────────────────────────────────────────────────────┤
│  执行层 (Executors)                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │  Browser    │ │     CLI     │ │  AskUser    │        │
│  │ Executor    │ │  Executor   │ │  Executor   │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
├─────────────────────────────────────────────────────────┤
│  工具层 (Tools)                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │  WebFetch   │ │ WebSearch  │ │  Skills    │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
```

---

## 📂 项目结构

```
opencowork/
├── src/
│   ├── main/              # Electron 主进程
│   ├── renderer/         # React UI
│   ├── core/             # 核心业务逻辑
│   │   ├── action/       # Action 定义
│   │   ├── executor/     # 执行器
│   │   ├── planner/      # 任务规划
│   │   └── runtime/      # 运行时
│   ├── agents/           # AI Agent
│   ├── llm/              # LLM 客户端
│   ├── im/               # IM 集成
│   ├── scheduler/        # 定时任务
│   ├── history/         # 任务历史
│   └── skills/           # 技能系统
├── docs/                 # 文档
├── config/                # 配置文件（不提交到 Git）
└── dist/                 # 构建输出
```

---

## 🛠️ 开发指南

```bash
# 开发
npm run electron:dev

# 构建
npm run build:main     # 主进程
npm run build:preload  # 预加载脚本
npm run build:renderer # 渲染进程

# 测试
npm test

# 代码检查
npm run lint
npm run format
```

---

## 📜 许可证

本项目采用 [Apache License 2.0](LICENSE) 许可证。

---

## 🤝 贡献指南

欢迎贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何参与贡献。

---

## 🔒 安全

如发现安全漏洞，请阅读 [SECURITY.md](SECURITY.md) 了解如何报告。

---

## 📬 联系方式

- GitHub Issues：https://github.com/LeonGaoHaining/opencowork/issues
- GitHub Discussions：https://github.com/LeonGaoHaining/opencowork/discussions
- Website:https://opencowork.me

---

<p align="center">
  ⭐ 如果这个项目对您有帮助，请 star 支持！
</p>
