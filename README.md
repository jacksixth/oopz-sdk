# Oopzbot SDK for Node.js

Node.js/TypeScript SDK for the **Oopz** 语音平台 — 异步优先、事件驱动、类型友好。

[![License](https://img.shields.io/badge/license-MIT-97CA00)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5%2B-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

本仓库是原 [Python 版 Oopzbot-SDK](https://github.com/tangqingfeng7/Oopzbot-SDK) 的 Node.js/TypeScript 复刻。

> **注意**：本项目约 99% 代码由 AI 参照 Python 版自动生成，本人仅测试了部分功能，使用前请充分验证。

---

## ✨ 功能特性

- **Bot 入口简单**：通过 `OopzBot` 完成连接、事件监听、消息回复和 Service 调用
- **异步优先**：基于 Promise/async-await，适合长期运行的机器人和服务端应用
- **类型友好**：完整的 TypeScript 类型定义，便于补全和校验
- **事件驱动**：支持消息、私信、撤回、编辑、频道变化、成员进出、语音状态、身份组变化、好友等事件
- **消息与媒体**：支持文本、图片、私信、引用回复、@提及、消息段（Segment）解析和文件上传
- **Service 分层**：提供消息、媒体、域、频道、用户、语音、管理等能力入口
- **可配置性**：支持代理、重试、心跳、缓存、速率限制等细粒度配置

## 📦 安装

```bash
npm install oopz-sdk
```

从源码构建：

```bash
git clone https://github.com/tangqingfeng7/Oopzbot-SDK.git
cd Oopzbot-SDK
npm install
npm run build
```

## 🚀 快速开始

### 1. 配置凭证

创建 `.env` 文件（可放在项目根目录或 `test/` 目录下）：

```env
OOPZ_DEVICE_ID=your-device-id
OOPZ_PERSON_UID=your-person-uid
OOPZ_JWT_TOKEN=your-jwt-token
OOPZ_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

```ts
import { OopzConfig } from "oopz-sdk";

// 方式 1: 从环境变量自动读取
const config = OopzConfig.fromEnv();

// 方式 2: 手动指定
const config = new OopzConfig({
  deviceId: "your-device-id",
  personUid: "your-person-uid",
  jwtToken: "your-jwt-token",
  privateKey: "your-private-key",  // PEM 格式
});
```

### 🔑 如何获取凭据

SDK 需要 4 个凭据字段：`DEVICE_ID`、`PERSON_UID`、`JWT_TOKEN`、`PRIVATE_KEY`。

#### 方式一：Python SDK 凭据工具

```bash
pip install oopz-sdk
python -m oopz_sdk.script.credential_tool
```

工具会自动打开浏览器，登录后抓取所有凭据并保存为 JSON。

#### 方式二：浏览器 Console 提取

1. 打开 Chrome，访问 [web.oopz.cn](https://web.oopz.cn) 并**登录**
2. 按 **F12** → **Console**，粘贴以下代码并回车：

```javascript
// 1. 从 localStorage 提取基础凭据
const session = JSON.parse(localStorage.getItem("session__OopzSession") || "{}");
const raw = session?.state?.session || session?.session || session;
const creds = {
  deviceId: raw.deviceId || "",
  personUid: raw.uid || "",
  jwtToken: raw.signature || "",
  privateKey: "",
};

// 2. 拦截 WebCrypto 捕获私钥
const orig = crypto.subtle.sign;
crypto.subtle.sign = async (a, k, d) => {
  if (k.type === "private" && k.extractable && !creds.privateKey) {
    const e = await crypto.subtle.exportKey("pkcs8", k);
    const b = btoa(String.fromCharCode(...new Uint8Array(e)));
    creds.privateKey = "-----BEGIN PRIVATE KEY-----\\n" + b.match(/.{1,64}/g).join("\\n") + "\\n-----END PRIVATE KEY-----";
    printAll();
  }
  return orig(a, k, d);
};

// 3. 输出 .env 格式
function printAll() {
  console.log(
    "OOPZ_DEVICE_ID=" + creds.deviceId + "\n" +
    "OOPZ_PERSON_UID=" + creds.personUid + "\n" +
    "OOPZ_JWT_TOKEN=" + creds.jwtToken + "\n" +
    "OOPZ_PRIVATE_KEY=" + creds.privateKey
  );
}


printAll();
console.log("%c👆 已输出 deviceId / personUid / jwtToken\n%c⚠️ 执行任意操作（如发消息），私钥会自动追加输出", "font-size:14px", "color:orange");
```

3. 基础凭据立即打印。触发任意操作（发消息/进入频道），私钥会自动追加。复制全部 4 行到 `.env`。

> **重要**：私钥在 `.env` 中必须使用 `\n` 单行格式（脚本已自动处理）。缺少私钥会导致 REST API 返回 401，但不影响 WebSocket 事件推送。

### 2. Echo Bot（最小示例）

```ts
import { OopzBot, OopzConfig } from "oopz-sdk";

const config = OopzConfig.fromEnv();
const bot = new OopzBot(config);

// 监听频道消息 — echo 回复
bot.on("message", async (event) => {
  const msg = event.message;
  console.log(`[${msg.senderNickname}]: ${msg.content}`);

  await bot.reply(
    msg.areaId!,
    msg.channelId!,
    msg.messageId,
    `你说: ${msg.content}`
  );
});

// 监听私信
bot.on("message.private", async (event) => {
  await bot.messages.sendPrivateMessage(
    event.message.senderUid,
    "你好！有什么可以帮你的吗？"
  );
});

// 启动
await bot.start();
console.log("Bot is running...");
```

### 3. 使用便捷方法

`OopzBot` 提供了常用操作的快捷方法：

```ts
// 发送消息
await bot.send(areaId, channelId, "Hello!");

// 回复消息（自动引用）
await bot.reply(areaId, channelId, messageId, "收到！");

// 撤回消息
await bot.recall(areaId, channelId, messageId);
```

### 4. 发送图片

```ts
import type { ImageSegment } from "oopz-sdk";

bot.on("message", async (event) => {
  // 上传图片
  const uploaded = await bot.media.uploadImage("./path/to/image.png");

  // 构造图片消息段
  const imgSegment: ImageSegment = {
    type: "image",
    source: "./path/to/image.png",
    uploaded: {
      fileKey: uploaded.fileKey,
      url: uploaded.url,
    },
  };

  await bot.messages.sendMessage(
    event.message.areaId!,
    event.message.channelId!,
    ["看这张图：\n", imgSegment]
  );
});
```

### 5. 启用日志

```ts
import { setupLogging } from "oopz-sdk";

// 日志级别: "DEBUG" | "INFO" | "WARN" | "ERROR"
setupLogging("DEBUG");
```

---

## 📚 事件参考

所有可用事件及其数据类型：

| 事件名 | 说明 | 事件类型 |
| --- | --- | --- |
| `message` | 频道消息 | `MessageEvent` |
| `message.private` | 私信消息 | `MessageEvent` |
| `message.edit` | 频道消息编辑 | `MessageEvent` |
| `message.private.edit` | 私信消息编辑 | `MessageEvent` |
| `recall` | 频道消息撤回 | `MessageDeleteEvent` |
| `recall.private` | 私信消息撤回 | `MessageDeleteEvent` |
| `message.reaction` | 消息表情 | `MessageReactionEvent` |
| `channel.update` | 频道设置变更 | `ChannelUpdateEvent` |
| `channel.create` | 频道创建 | `ChannelCreateEvent` |
| `channel.delete` | 频道删除 | `ChannelDeleteEvent` |
| `voice.enter` | 进入语音频道 | `VoicePresenceEvent` |
| `voice.leave` | 离开语音频道 | `VoicePresenceEvent` |
| `user.update` | 用户资料变更 | `UserUpdateEvent` |
| `user.login_state` | 用户登录状态变更 | `UserLoginStateEvent` |
| `area.update` | 域信息变更 | `AreaUpdateEvent` |
| `role.change` | 身份组变化 | `RoleChangedEvent` |
| `friend.request` | 收到好友请求 | `FriendRequestEvent` |
| `friend.delete` | 好友被删除 | `FriendDeleteEvent` |
| `moderation.text_ban` | 域内禁言 | `AreaDisableEvent` |
| `moderation.voice_ban` | 域内禁麦 | `AreaDisableEvent` |
| `server_id` | 服务端 ID 分配 | `ServerIdEvent` |
| `auth` | 鉴权结果 | `AuthEvent` |
| `heartbeat` | 心跳 | `HeartbeatEvent` |
| `unknown` | 未映射事件码的兜底 | `AnyEvent` |
| `*` | 通配符，匹配所有事件 | `AnyEvent` |

事件名会决定处理器的参数类型，因此 `event.message.content` 这类访问可以直接通过类型检查，无需手动断言：

```ts
bot.on("message", (event) => {
  // event 的类型是 MessageEvent，event.message 可直接访问
  console.log(event.message.content);
});

bot.on("voice.enter", (event) => {
  // event 的类型是 VoicePresenceEvent
  console.log(event.persons, event.activeNum);
});
```

若需要订阅「协议中没有对应事件码」的自定义事件，可以用 `bot.on("任意名字", handler)`，此时参数类型为 `AnyEvent`。

若需要 `voice` 系列事件，需要在`config`中将`autoSubscribeJoinedAreas`置为`true`，这将在初始化时就订阅所有已加入域的事件。 
若是只想订阅已加入的部分域，请使用`bot.ws.sendSubscribeAreaEvents(areaIds)`订阅指定区域的事件 

## 🧩 Service 列表

| Service | 访问方式 | 说明 |
| --- | --- | --- |
| `messages` | `bot.messages` | 发送/回复/编辑/撤回消息、私信 |
| `media` | `bot.media` | 上传图片/文件 |
| `areas` | `bot.areas` | 列出区域、查询成员 |
| `channels` | `bot.channels` | 创建/编辑/删除频道、进入/退出语音频道 |
| `person` | `bot.person` | 用户信息、好友管理 |
| `members` | `bot.members` | `person` 的别名 |
| `moderation` | `bot.moderation` | 踢人/禁言/封禁 |
| `voice` | `bot.voice` | 加入/退出语音频道、ChannelSign 管理 |

> ⚠️ **语音播放限制**：Oopz 的语音播放依赖 Agora 浏览器运行时（Python SDK 通过 headless 浏览器实现）。
> Node.js 下 `bot.voice.join()` / `leave()` 可正常工作（走服务端 `enter_channel` / `removeFromChannel`），
> 但 `playUrl` / `playFile` / `playBytes` / `pause` / `seek` 等播放方法会抛出
> `OopzVoiceUnsupportedError`，而不是返回一个假的成功结果。

## 🔧 配置选项

```ts
const config = new OopzConfig({
  // ── 凭证 ──
  deviceId: "...",
  personUid: "...",
  jwtToken: "...",
  privateKey: "...",      // PEM 格式

  // ── 端点 ──
  baseUrl: "https://gateway.oopz.cn",
  wsUrl: "wss://ws.oopz.cn",

  // ── 应用标识 ──
  appVersion: "69514",
  platform: "windows",
  channel: "Web",

  // ── 重试 ──
  retry: { maxAttempts: 3 },

  // ── 心跳 ──
  heartbeat: {
    interval: 10,               // 心跳间隔（秒）
    reconnectInterval: 2,        // 重连间隔（秒）
    maxReconnectInterval: 120,   // 最大重连间隔（秒）
  },

  // ── 代理 ──
  // 通过 HTTP 代理时使用 CONNECT 隧道；https/wss 走 proxy.https ?? proxy.http。
  proxy: {
    http: "http://127.0.0.1:7890",
    https: null,
    websocket: null,
  },

  // ── 速率限制 ──
  // 与顶层的 rateLimitInterval 等价，二者同时提供时以 rateLimit.interval 为准。
  rateLimit: { interval: 0 },    // 两次请求之间的最小间隔（秒）

  // ── 请求超时（毫秒） ──
  // 与 request.timeout 等价，二者同时提供时以 request.timeout 为准。
  // 单个数字表示总超时；[连接超时, 读取超时] 表示分段超时。
  requestTimeout: [10_000, 30_000],

  // ── 缓存 ──
  userinfoCacheMaxEntries: 1000,
  userinfoCacheTtl: 300,             // 秒
  areaChannelsCacheMaxEntries: 100,
  areaChannelsCacheTtl: 60,

  // ── 机器人行为 ──
  ignoreSelfMessages: true,          // 忽略机器人自身发言，避免自问自答死循环
  autoSubscribeJoinedAreas: false,   // 是否自动订阅已加入域的事件
  useAnnouncementStyle: false,       // 发言是否使用公告样式（附加 IMPORTANT 标签）

  // ── 调试 ──
  debug: false,                       // 打开调试日志，等价于 setupLogging("DEBUG")
});
```

## 🧪 示例项目

`test/` 目录提供了多个可运行的示例：

| 文件 | 说明 |
| --- | --- |
| `01-echo-bot.js` | 基础 Echo Bot：消息监听、回复、私信、撤回 |
| `02-event-listener.js` | 全事件监听：展示所有事件类型 |
| `03-area-channel.js` | 区域与频道操作 |
| `07-poll-areas.js` | 轮询区域与成员信息 |
| `08-voice-presence.js` | 语音频道进出事件 |

运行示例：

```bash
# 先在 test/.env 中配置凭证
node test/01-echo-bot.js
```

### 单元测试

```bash
npm test
```

测试位于 `test/unit/`，覆盖签名时间戳、事件解析与分发、缓存淘汰、传输层状态码处理等核心逻辑。

---

## 🧱 项目结构

```
src/
├── index.ts              # 主入口，统一导出
├── version.ts            # SDK 版本号（从 package.json 读取）
├── logger.ts             # 日志系统
├── config/               # 配置（端点、凭证、设置）
├── auth/                 # 认证（签名、JWT、请求头、凭据）
├── client/               # 客户端（Bot 入口、REST、WebSocket）
├── services/             # 服务层（消息、媒体、区域、频道、用户、管理、语音）
├── events/               # 事件系统（解析、注册、分发、上下文）
├── models/               # 数据模型（消息、频道、用户、事件、附件等）
├── transport/            # 传输层（HTTP、WebSocket、代理）
├── state/                # 状态管理（缓存、存储）
├── exceptions/           # 异常类型定义
└── utils/                # 工具（图片、文本、时间、表情等）
```

---

## 许可

MIT License

## 免责声明

本项目由社区开发与维护，旨在为 Oopz 机器人开发提供更方便的 Node.js 接口。使用本项目时请遵守 Oopz 平台相关规则，并妥善保管账号凭证、JWT、私钥等敏感信息。
