/**
 * 08-voice-presence.js — 语音频道进出事件监听
 *
 * 演示：监听 voice.enter / voice.leave 事件，显示谁进入/离开了语音频道。
 *
 * 运行: node test/08-voice-presence.js
 */

require("dotenv").config({ path: __dirname + "/.env" });

const {
  OopzBot,
  OopzConfig,
  setupLogging,
} = require("../dist/index");

// ============ 配置 ============

const config = OopzConfig.fromEnv();
setupLogging("INFO");

const bot = new OopzBot(config);

// ============ 缓存：在线用户昵称 + 频道名 + 区域名 ============

const nicknameCache = {};
const channelNameCache = {};  // key: "areaId:channelId"
const areaNameCache = {};     // key: areaId

/** 批量查昵称并缓存 */
async function fetchNicknames(uids) {
  const missing = uids.filter((uid) => !nicknameCache[uid]);
  if (missing.length === 0) return;

  try {
    const map = await bot.person.getUserInfos(missing);
    for (const uid of missing) {
      nicknameCache[uid] = (map[uid] && map[uid].nickname) || uid.slice(0, 10) + "...";
    }
  } catch {
    // 忽略
  }
}

function nick(uid) {
  return nicknameCache[uid] || uid.slice(0, 10) + "...";
}

/** 查区域名（按需拉取并缓存） */
async function areaName(areaId) {
  if (areaNameCache[areaId]) return areaNameCache[areaId];

  try {
    const info = await bot.areas.getAreaInfo(areaId);
    areaNameCache[areaId] = (info && info.name) || areaId;
  } catch {
    areaNameCache[areaId] = areaId;
  }

  return areaNameCache[areaId];
}

/** 查频道名（按需拉取区域频道列表并缓存） */
async function channelName(areaId, channelId) {
  const key = `${areaId}:${channelId}`;
  if (channelNameCache[key]) return channelNameCache[key];

  try {
    const groups = await bot.areas.getAreaChannels(areaId);
    for (const g of groups) {
      for (const ch of g.channels) {
        channelNameCache[`${areaId}:${ch.channelId}`] = ch.name;
      }
    }
  } catch {
    // 忽略
  }

  return channelNameCache[key] || channelId;
}

// ============ 事件监听 ============

// ── 消息事件：证明 Bot 在线 ──
bot.on("message", (event) => {
  const m = event.message;
  console.log(`💬 [${m.senderNickname || m.senderUid}] ${m.content}`);
  if (m.content === "ping") {
    bot.send(m.areaId, m.channelId, "pong")
  }
});

// ── 语音进出 ──

// 有人进入语音频道
bot.on("voice.enter", async (event) => {
  await fetchNicknames(event.persons);
  const chName = await channelName(event.areaId, event.channelId);
  const aName = await areaName(event.areaId);
  const names = event.persons.map(nick).join(", ");
  const from = event.fromChannel
    ? ` (从 ${await channelName(event.areaId, event.fromChannel)} 移动)` : "";
  console.log(`\n🎤 [语音进入] ${names} → ${chName} @ ${aName}  👥${event.activeNum}${from}`);
});

// 有人离开语音频道（跨频道移动时不输出离开，因为 enter 已显示"从 X 移动"）
bot.on("voice.leave", async (event) => {
  if (event.fromChannel) return;  // 移动 → 跳过，已在 voice.enter 中显示

  await fetchNicknames(event.persons);
  const chName = await channelName(event.areaId, event.channelId);
  const aName = await areaName(event.areaId);
  const names = event.persons.map(nick).join(", ");
  console.log(`\n🔇 [语音离开] ${names} ← ${chName} @ ${aName}  👥${event.activeNum}`);
});

// ── 通配符：显示所有收到的事件（方便调试）──
let eventCount = {};
bot.on("*", (event) => {
  const name = event.eventName;
  eventCount[name] = (eventCount[name] || 0) + 1;
});

// 每 60 秒打印一次事件统计
setInterval(() => {
  const entries = Object.entries(eventCount);
  if (entries.length === 0) return;
  console.log(`\n📊 [事件统计] ${new Date().toLocaleTimeString()}`);
  entries.sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`   ${k}: ${v} 次`);
  });
}, 60_000);

// ============ 启动 ============

async function main() {
  console.log("🎧 语音频道进出监听 Bot 启动中...");
  console.log("   监听: voice.enter / voice.leave / message / *");
  console.log("   提示: 语音事件只在有人进出语音频道时触发");
  console.log("   按 Ctrl+C 退出\n");

  await bot.start();
  console.log("✅ 已连接，等待事件...\n");
  console.log("   💡 试着在 Oopz 客户端加入/离开一个语音频道来触发 voice.enter/voice.leave\n");
}

main().catch((err) => {
  console.error("❌ 启动失败:", err);
  process.exit(1);
});
