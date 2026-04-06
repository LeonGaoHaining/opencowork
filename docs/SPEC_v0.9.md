# OpenCowork v0.9 技术规格说明书

| 项目     | 内容       |
| -------- | ---------- |
| 版本     | v0.9       |
| 更新日期 | 2026-04-06 |
| 状态     | 规划中     |
| 基于PRD  | v3.2       |
| 前置版本 | v0.8.1     |

---

## 目录

1. [版本目标](#1-版本目标)
2. [技术架构](#2-技术架构)
   - [2.1 整体架构](#21-整体架构)
   - [2.2 组件交互流程](#22-组件交互流程)
   - [2.3 长连接通信架构](#23-长连接通信架构)
3. [核心模块设计](#3-核心模块设计)
   - [3.1 IMConfigPanel](#31-imconfigpanel)
   - [3.2 IMConfigStore](#32-imconfigstore)
   - [3.3 ControlBar状态指示器](#33-controlbar状态指示器)
   - [3.4 平台实现状态](#34-平台实现状态)
   - [3.5 组件交互行为](#35-组件交互行为)
4. [接口设计](#4-接口设计)
   - [4.1 IPC接口](#41-ipc接口)
   - [4.2 配置接口](#42-配置接口)
5. [状态管理](#5-状态管理)
6. [文件结构](#6-文件结构)
7. [实施计划](#7-实施计划)
8. [成功指标](#8-成功指标)
9. [附录](#9-附录)

---

## 1. 版本目标

**目标**: IM平台配置可视化，通过图形界面配置各IM平台集成

### 核心目标

| 目标              | 说明                     |
| ----------------- | ------------------------ |
| **IMConfigPanel** | 图形化配置各IM平台       |
| **配置热更新**    | 保存后自动重连IM服务     |
| **状态指示器**    | ControlBar显示IM连接状态 |

### 与 v0.8.1 关系

| 组件        | v0.8.1 实现        | v0.9 增强             |
| ----------- | ------------------ | --------------------- |
| 飞书长连接  | WSClient SDK       | UI配置界面            |
| 配置存储    | config/feishu.json | IMConfigStore统一管理 |
| IPC Handler | im:load/save/test  | IMConfigPanel调用     |
| 状态显示    | 日志输出           | ControlBar状态指示器  |

---

## 2. 技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Renderer Process                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ControlBar                                                 ││
│  │  └── [IM] ← 状态指示器 ●                                   ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  IMConfigPanel (Modal)                                      ││
│  │  ├── Tab: [飞书] [钉钉] [企业微信] [Slack]                 ││
│  │  ├── Form: appId / appSecret / ...                         ││
│  │  ├── Status: ● 已连接 / ○ 未连接 / ◐ 连接中               ││
│  │  └── Actions: [测试连接] [保存] [取消]                      ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              │ IPC: im:load / im:save / im:test │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                         Main Process                             │
│  ┌──────────────────────────┴──────────────────────────────┐    │
│  │  IPC Handler                                             │    │
│  │  ├── im:load      → 加载所有IM配置                       │    │
│  │  ├── im:save      → 保存配置并热更新                     │    │
│  │  ├── im:test      → 测试连接                             │    │
│  │  └── im:status    → 获取连接状态                         │    │
│  └──────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌──────────────────────────┴──────────────────────────────┐    │
│  │  IMConfigStore                                            │    │
│  │  └── config/{platform}.json                              │    │
│  └──────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌──────────────────────────┴──────────────────────────────┐    │
│  │  IM Service Layer                                         │    │
│  │  ├── FeishuService (长连接)                              │    │
│  │  ├── DingTalkService (预留)                              │    │
│  │  └── WeComService (预留)                                 │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 组件交互流程

```
用户点击ControlBar IM按钮
        ↓
IMConfigPanel 打开
        ↓
IPC: im:load() → 加载所有平台配置
        ↓
显示各平台Tab + 当前状态
        ↓
用户切换Tab → 显示该平台配置表单
        ↓
用户修改配置 → 本地状态更新
        ↓
[测试连接] → IPC: im:test({ platform, config })
        ↓
显示测试结果 (成功/失败)
        ↓
[保存] → IPC: im:save({ platform, config })
        ↓
写入 config/{platform}.json
        ↓
IMService.reload(platform)
        ↓
更新连接状态
        ↓
ControlBar 状态指示器刷新
```

### 2.3 长连接通信架构

飞书SDK支持基于WebSocket的长连接事件回调，桌面应用可直接接收回调，**无需公网服务器**：

```
┌─────────────────┐         wss://open.feishu.cn          ┌─────────────────┐
│  Desktop App    │◄───────────────────────────────►│   飞书开放平台   │
│                 │         长连接（加密）            │                  │
│  WSClient       │                                 │  • 消息事件      │
│  + EventHandler │                                 │  • 卡片交互      │
└─────────────────┘                                 └─────────────────┘
```

**长连接模式特点**：

| 特点           | 说明                             |
| -------------- | -------------------------------- |
| 无需公网服务器 | 应用只需能访问公网，无需暴露端口 |
| 无需回调URL    | 不需要配置Webhook回调地址        |
| 无需Token验证  | SDK自动处理加密和身份认证        |
| 自动重连       | SDK内置断线重连机制              |

**飞书长连接配置项**：

| 配置项    | 说明           | 示例                 |
| --------- | -------------- | -------------------- |
| appId     | 应用的唯一标识 | `cli_xxxxxxxxxx`     |
| appSecret | 应用的访问密钥 | `xxxxxxxxxxxxxxxxxx` |

---

## 3. 核心模块设计

### 3.1 IMConfigPanel

**位置**: `src/renderer/components/IMConfigPanel.tsx`

**功能**: IM平台配置的图形化界面

**Props**:

```typescript
interface IMConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**State**:

```typescript
interface IMConfigState {
  activeTab: IMPlatform; // 'feishu' | 'dingtalk' | 'wecom' | 'slack'
  configs: Record<IMPlatform, IMPlatformConfig | null>;
  statuses: Record<IMPlatform, ConnectionStatus>;
  isLoading: boolean;
  isSaving: boolean;
  message: { type: 'success' | 'error'; text: string } | null;
}

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';
type IMPlatform = 'feishu' | 'dingtalk' | 'wecom' | 'slack';
```

**Tab布局**:

```tsx
const tabs = [
  { key: 'feishu', label: '飞书' },
  { key: 'dingtalk', label: '钉钉' },
  { key: 'wecom', label: '企业微信' },
  { key: 'slack', label: 'Slack' },
] as const;
```

**飞书表单**:

```tsx
interface FeishuFormData {
  enabled: boolean;
  appId: string;
  appSecret: string;
}

// 初始化
const [feishuForm, setFeishuForm] = useState<FeishuFormData>({
  enabled: false,
  appId: '',
  appSecret: '',
});
```

**布局结构**:

```
┌─────────────────────────────────────────────────────────────┐
│  IM 配置                                           [×]     │
├─────────────────────────────────────────────────────────────┤
│  [飞书] [钉钉] [企业微信] [Slack]  ← Tab切换               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ○ 启用 [平台名称] 集成                                     │
│                                                             │
│  App ID:     [cli_xxxxxxxxxxxxxxxxx          ]              │
│  App Secret: [●●●●●●●●●●●●●●●●●●●●●●●●●    ] [显示]       │
│                                                             │
│  状态: ● 已连接  ○ 未连接  ◐ 连接中                        │
│                                                             │
│  [测试连接]                              [保存]  [取消]     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**关键方法**:

```typescript
// 加载配置
const loadConfigs = async () => {
  setIsLoading(true);
  try {
    const configs = await window.electron.invoke('im:load');
    setConfigs(configs);
  } catch (error) {
    console.error('[IMConfigPanel] Load failed:', error);
  } finally {
    setIsLoading(false);
  }
};

// 测试连接
const testConnection = async (platform: string, config: any) => {
  try {
    const result = await window.electron.invoke('im:test', { platform, config });
    setMessage({
      type: result.success ? 'success' : 'error',
      text: result.success ? '连接成功' : result.error,
    });
  } catch (error) {
    setMessage({ type: 'error', text: `测试失败: ${error}` });
  }
};

// 保存配置
const saveConfig = async (platform: string, config: any) => {
  setIsSaving(true);
  try {
    const result = await window.electron.invoke('im:save', { platform, config });
    if (result.success) {
      setMessage({ type: 'success', text: '配置保存成功' });
      // 刷新状态
      const status = await window.electron.invoke('im:status', { platform });
      setStatuses((prev) => ({ ...prev, [platform]: status }));
    } else {
      setMessage({ type: 'error', text: result.error });
    }
  } catch (error) {
    setMessage({ type: 'error', text: `保存失败: ${error}` });
  } finally {
    setIsSaving(false);
  }
};
```

### 3.2 IMConfigStore

**位置**: `src/config/imConfig.ts` (新文件)

**功能**: IM配置的加载、保存、验证

**接口**:

```typescript
interface IMPlatformConfig {
  enabled: boolean;
  platform: IMPlatform;
  config: Record<string, string>; // 平台特定配置
}

interface IMConfigStore {
  // 加载所有平台配置
  loadAll(): Promise<Record<IMPlatform, IMPlatformConfig | null>>;

  // 保存指定平台配置
  save(platform: IMPlatform, config: IMPlatformConfig): Promise<void>;

  // 验证配置格式
  validate(platform: IMPlatform, config: any): ValidationResult;

  // 获取连接状态
  getStatus(platform: IMPlatform): ConnectionStatus;
}

interface ValidationResult {
  valid: boolean;
  errors?: string[];
}
```

**配置验证规则**:

| 平台     | 必填字段                    | 验证规则              |
| -------- | --------------------------- | --------------------- |
| feishu   | appId, appSecret            | appId以`cli_`开头     |
| dingtalk | appKey, appSecret           | appKey非空            |
| wecom    | corpId, agentId, corpSecret | corpId非空            |
| slack    | botToken, signingSecret     | botToken以`xoxb-`开头 |

### 3.3 ControlBar状态指示器

**位置**: `src/renderer/components/ControlBar.tsx`

**变更**: 新增IM按钮和状态指示器

```tsx
// 新增state
const { imStatus, setImStatus } = useIMStore();

// 新增按钮
<button
  onClick={() => setImPanelOpen(true)}
  className={`btn ${imStatus === 'connected' ? 'btn-success' : 'btn-secondary'}`}
  title={getIMStatusText(imStatus)}
>
  <span className={`status-dot ${imStatus}`} />
  IM
</button>;

// 状态文本
function getIMStatusText(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return '飞书已连接';
    case 'connecting':
      return '连接中...';
    case 'error':
      return '连接错误';
    default:
      return '飞书未配置';
  }
}
```

### 3.4 平台实现状态

各平台的实现状态和Tab行为定义：

| 平台     | 实现状态  | Tab行为                      |
| -------- | --------- | ---------------------------- |
| 飞书     | v0.9 实现 | 正常启用，支持完整配置       |
| 钉钉     | 规划中    | 禁用 + tooltip提示"即将支持" |
| 企业微信 | 规划中    | 禁用 + tooltip提示"即将支持" |
| Slack    | 规划中    | 禁用 + tooltip提示"即将支持" |

**Tab禁用状态样式**：

```tsx
const tabs = [
  { key: 'feishu', label: '飞书', disabled: false },
  { key: 'dingtalk', label: '钉钉', disabled: true, tooltip: '即将支持' },
  { key: 'wecom', label: '企业微信', disabled: true, tooltip: '即将支持' },
  { key: 'slack', label: 'Slack', disabled: true, tooltip: '即将支持' },
] as const;
```

**Tab组件渲染**：

```tsx
{
  tabs.map((tab) => (
    <button
      key={tab.key}
      disabled={tab.disabled}
      title={tab.tooltip}
      className={`tab ${activeTab === tab.key ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
      onClick={() => !tab.disabled && setActiveTab(tab.key)}
    >
      {tab.label}
      {tab.disabled && <span className="coming-soon-badge">即将支持</span>}
    </button>
  ));
}
```

### 3.5 组件交互行为

#### 3.5.1 启用开关行为

**UI位置**：表单顶部，单个平台的启用/禁用开关

**行为定义**：

| 状态                 | 行为                                 |
| -------------------- | ------------------------------------ |
| 关闭（默认）         | 隐藏配置表单，显示"已禁用"提示文字   |
| 开启                 | 显示完整配置表单                     |
| 保存时 enabled=false | 停止该平台服务，保持配置但标记为禁用 |

**开关UI结构**：

```
○ 启用 [平台名称] 集成
   ↓ 开启后
● 启用 [平台名称] 集成
```

#### 3.5.2 密码字段显示/隐藏

**App Secret 字段**：默认隐藏，显示为圆点掩码

**交互行为**：

| 按钮   | 行为           |
| ------ | -------------- |
| [显示] | 切换为明文显示 |
| [隐藏] | 切换回掩码显示 |

**实现代码**：

```tsx
const [showSecret, setShowSecret] = useState(false);

<input
  type={showSecret ? 'text' : 'password'}
  value={appSecret}
  onChange={(e) => setAppSecret(e.target.value)}
/>
<button onClick={() => setShowSecret(!showSecret)}>
  {showSecret ? '隐藏' : '显示'}
</button>
```

#### 3.5.3 Tab切换行为

**行为定义**：

1. 切换Tab时，如果有未保存的变更，提示用户确认
2. 切换后重置表单为该平台已保存的配置
3. 清除之前Tab的错误消息

**代码逻辑**：

```tsx
const handleTabChange = (newTab: IMPlatform) => {
  // 如果有未保存变更，提示确认
  if (hasUnsavedChanges) {
    const confirmed = window.confirm('有未保存的变更，确定要切换吗？');
    if (!confirmed) return;
  }

  // 清除消息
  setMessage(null);

  // 切换Tab并加载该平台配置
  setActiveTab(newTab);
  loadPlatformConfig(newTab);
};
```

#### 3.5.4 测试连接行为

**行为定义**：

1. 点击"测试连接"后，显示loading状态
2. 5秒超时限制
3. 返回结果显示成功/失败
4. 不保存配置，仅测试连接

**超时处理**：

```tsx
const testConnection = async (platform: string, config: any) => {
  setIsTesting(true);
  setMessage(null);

  try {
    // 5秒超时
    const result = await Promise.race([
      window.electron.invoke('im:test', { platform, config }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('连接超时(5s)')), 5000)),
    ]);

    if (result.success) {
      setMessage({ type: 'success', text: '连接成功' });
    } else {
      setMessage({ type: 'error', text: result.error || '连接失败' });
    }
  } catch (error: any) {
    setMessage({ type: 'error', text: error.message || '测试失败' });
  } finally {
    setIsTesting(false);
  }
};
```

#### 3.5.5 保存行为

**行为定义**：

1. 点击"保存"后，先验证配置格式
2. 验证通过后，调用 im:save IPC
3. 保存成功后，调用 IMService.reload() 热更新
4. 刷新连接状态
5. 关闭弹窗或停留在当前Tab

**验证规则**（参见3.2节配置验证规则）

---

## 4. 接口设计

### 4.1 IPC接口

| 接口        | 参数                   | 返回值                                               | 说明         |
| ----------- | ---------------------- | ---------------------------------------------------- | ------------ |
| `im:load`   | -                      | `Record<IMPlatform, IMPlatformConfig>`               | 加载所有配置 |
| `im:save`   | `{ platform, config }` | `{ success: boolean; error?: string }`               | 保存配置     |
| `im:test`   | `{ platform, config }` | `{ success: boolean; result?: any; error?: string }` | 测试连接     |
| `im:status` | `{ platform }`         | `ConnectionStatus`                                   | 获取状态     |

### 4.2 配置接口

**FeishuConfig**:

```typescript
interface FeishuConfig {
  appId: string; // 以cli_开头
  appSecret: string;
  enabled: boolean;
}
```

**DingTalkConfig**:

```typescript
interface DingTalkConfig {
  appKey: string;
  appSecret: string;
  enabled: boolean;
}
```

**WeComConfig**:

```typescript
interface WeComConfig {
  corpId: string;
  agentId: string;
  corpSecret: string;
  enabled: boolean;
}
```

**SlackConfig**:

```typescript
interface SlackConfig {
  botToken: string; // 以xoxb-开头
  signingSecret: string;
  enabled: boolean;
}
```

---

## 5. 状态管理

### 5.1 Renderer状态 (Zustand)

**位置**: `src/renderer/stores/imStore.ts` (新文件)

```typescript
interface IMStore {
  // 状态
  configs: Record<IMPlatform, IMPlatformConfig | null>;
  statuses: Record<IMPlatform, ConnectionStatus>;
  activeTab: IMPlatform;
  isPanelOpen: boolean;

  // Actions
  setActiveTab: (tab: IMPlatform) => void;
  setPanelOpen: (open: boolean) => void;
  updateConfig: (platform: IMPlatform, config: IMPlatformConfig) => void;
  setStatus: (platform: IMPlatform, status: ConnectionStatus) => void;
  loadAll: () => Promise<void>;
  save: (platform: IMPlatform, config: IMPlatformConfig) => Promise<boolean>;
  test: (platform: IMPlatform, config: any) => Promise<boolean>;
}

export const useIMStore = create<IMStore>((set, get) => ({
  configs: { feishu: null, dingtalk: null, wecom: null, slack: null },
  statuses: {
    feishu: 'disconnected',
    dingtalk: 'disconnected',
    wecom: 'disconnected',
    slack: 'disconnected',
  },
  activeTab: 'feishu',
  isPanelOpen: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setPanelOpen: (open) => set({ isPanelOpen: open }),

  setStatus: (platform, status) =>
    set((state) => ({
      statuses: { ...state.statuses, [platform]: status },
    })),

  loadAll: async () => {
    const configs = await window.electron.invoke('im:load');
    set({ configs });
  },

  save: async (platform, config) => {
    const result = await window.electron.invoke('im:save', { platform, config });
    if (result.success) {
      set((state) => ({
        configs: { ...state.configs, [platform]: config },
      }));
    }
    return result.success;
  },
}));
```

### 5.2 Main进程状态

```typescript
// IM服务连接状态
const imServiceStatus: Record<IMPlatform, ConnectionStatus> = {
  feishu: 'disconnected',
  dingtalk: 'disconnected',
  wecom: 'disconnected',
  slack: 'disconnected',
};
```

---

## 6. 文件结构

```
src/
├── renderer/
│   ├── components/
│   │   ├── IMConfigPanel.tsx       # IM配置面板 (新)
│   │   └── ControlBar.tsx          # 修改：添加IM按钮
│   ├── stores/
│   │   └── imStore.ts              # IM状态管理 (新)
├── config/
│   └── imConfig.ts                 # IM配置模块 (新)
├── im/
│   └── feishu/
│       └── FeishuBot.ts           # 长连接 (v0.8.1)
└── main/
    └── ipcHandlers.ts              # 新增 im:* handlers
```

**新文件清单**:

| 文件                                        | 用途                 |
| ------------------------------------------- | -------------------- |
| `src/renderer/components/IMConfigPanel.tsx` | IM配置UI组件         |
| `src/renderer/stores/imStore.ts`            | IM状态管理           |
| `src/config/imConfig.ts`                    | IM配置加载/保存/验证 |

**修改文件清单**:

| 文件                                     | 变更                  |
| ---------------------------------------- | --------------------- |
| `src/renderer/components/ControlBar.tsx` | 添加IM按钮+状态指示器 |
| `src/main/ipcHandlers.ts`                | 添加im:\*处理函数     |

---

## 7. 实施计划

### Week 44

| Day     | Task                     | 交付物                   |
| ------- | ------------------------ | ------------------------ |
| Mon     | IMConfigPanel UI组件开发 | IMConfigPanel.tsx        |
| Tue     | IMConfigStore开发        | imConfig.ts + imStore.ts |
| Wed     | IPC Handler开发          | ipcHandlers.ts           |
| Thu     | FeishuBot长连接改造      | (已在v0.8.1完成)         |
| Fri     | ControlBar状态指示器     | ControlBar.tsx           |
| Sat-Sun | 集成测试                 | 测试报告                 |

### 里程碑

| 里程碑       | 日期          | 交付内容          |
| ------------ | ------------- | ----------------- |
| M1: UI完成   | Week 44 Day 3 | IMConfigPanel可用 |
| M2: 集成完成 | Week 44 Day 5 | 端到端测试通过    |

---

## 8. 成功指标

| 指标             | 目标   | 验证方式           |
| ---------------- | ------ | ------------------ |
| 配置保存成功率   | >95%   | 保存10次，≥9次成功 |
| 连接测试反馈时间 | <3s    | 手动计时           |
| 配置热更新时间   | <2s    | 保存到服务重连完成 |
| 状态指示器准确性 | 100%   | 与实际连接状态一致 |
| UI交互满意度     | 无阻塞 | 用户测试           |

---

## 9. 附录

### 9.1 依赖清单

```json
{
  "dependencies": {
    "@larksuiteoapi/node-sdk": "^1.36.0"
  }
}
```

### 9.2 错误码

| 错误码                  | 说明         | 处理方式            |
| ----------------------- | ------------ | ------------------- |
| `IM_CONFIG_INVALID`     | 配置格式错误 | 提示用户修正        |
| `IM_CONFIG_SAVE_FAILED` | 保存失败     | 重试或检查权限      |
| `IM_CONNECTION_TIMEOUT` | 连接超时(5s) | 检查网络或配置      |
| `IM_CONNECTION_FAILED`  | 连接失败     | 检查appId/appSecret |

### 9.3 配置示例

**feishu.json**:

```json
{
  "enabled": true,
  "appId": "cli_xxxxxxxxxxxxxxxxxxxxxxxx",
  "appSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

---

## 文档历史

| 版本 | 日期       | 修改内容                                       |
| ---- | ---------- | ---------------------------------------------- |
| v0.9 | 2026-04-07 | 补充长连接通信架构、平台实现状态、组件交互行为 |
| v0.9 | 2026-04-06 | 初始版本                                       |
