/**
 * 02-event-listener.js — 事件监听演示
 *
 * 演示：所有类型事件的监听与处理，事件类型说明。
 *
 * 运行: node test/02-event-listener.js
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

// ============ 创建 Bot ============

const bot = new OopzBot(config);

// ============ 所有事件监听 ============

// ── 消息类事件 ──

bot.on("message", (event) => {
  const m = event.message;
  console.log(`[message]          ${m.senderNickname}: ${m.content}`);
  console.log(`  areaId: ${m.areaId}, channelId: ${m.channelId}, msgId: ${m.messageId}`);
  if (m.mentions && m.mentions.length) console.log(`  mentions: ${m.mentions.join(", ")}`);
  if (m.reference) console.log(`  reply to: ${m.reference.messageId}`);
});

bot.on("message.private", (event) => {
  const m = event.message;
  console.log(`[message.private]  ${m.senderNickname}: ${m.content}`);
  console.log(`  sessionId: ${m.privateSessionId}`);
});

bot.on("message.edit", (event) => {
  const m = event.message;
  console.log(`[message.edit]     ${m.senderNickname} 编辑了消息: ${m.content}`);
});

bot.on("message.private.edit", (event) => {
  const m = event.message;
  console.log(`[message.private.edit] ${m.senderNickname} 编辑了私信: ${m.content}`);
});

// ── 撤回事件 ──

bot.on("recall", (event) => {
  console.log(`[recall]           消息被撤回: ${event.messageId}`);
  console.log(`  areaId: ${event.areaId}, channelId: ${event.channelId}`);
});

bot.on("recall.private", (event) => {
  console.log(`[recall.private]   私信被撤回: ${event.messageId}`);
});

// ── 频道事件 ──

bot.on("channel.join", (event) => {
  console.log(`[channel.join]     用户 ${event.uid} 加入频道 ${event.channelId}`);
});

bot.on("channel.leave", (event) => {
  console.log(`[channel.leave]    用户 ${event.uid} 离开频道 ${event.channelId}`);
});

bot.on("channel.update", (event) => {
  console.log(`[channel.update]   频道 ${event.channelId} 信息更新:`, event.changes);
});

// ── 成员事件 ──

bot.on("member.join", (event) => {
  console.log(`[member.join]      用户 ${event.uid} 加入区域 ${event.areaId}`);
});

bot.on("member.leave", (event) => {
  console.log(`[member.leave]     用户 ${event.uid} 离开区域 ${event.areaId}`);
});

// ── 语音事件 ──

bot.on("voice.join", (event) => {
  console.log(`[voice.join]       用户进入语音频道`);
});

bot.on("voice.leave", (event) => {
  console.log(`[voice.leave]      用户离开语音频道`);
});

// ── 身份组事件 ──

bot.on("role.update", (event) => {
  console.log(`[role.update]      身份组更新`);
});

// ── 好友事件 ──

bot.on("friend.request", (event) => {
  console.log(`[friend.request]   收到好友请求`);
});

bot.on("friend.accept", (event) => {
  console.log(`[friend.accept]    好友请求被接受`);
});

// ── 服务端 ID 事件 ──

bot.on("server_id", (event) => {
  console.log(`[server_id]        服务端已确认 ID: ${event.serverId}`);
});

// ── 未知事件兜底 ──

bot.on("unknown", (event) => {
  console.log(`[unknown]          未识别事件 (code: ${event.eventCode})`, event.raw);
});

// ── 通配符：所有事件的汇总（调试用） ──

const eventCounts = {};

bot.on("*", (event) => {
  eventCounts[event.eventName] = (eventCounts[event.eventName] || 0) + 1;
});

// ============ 启动 ============

async function main() {
  console.log("🎧 事件监听器启动中...\n");
  console.log("已注册事件:");
  console.log("  消息类: message, message.private, message.edit");
  console.log("  撤回类: recall, recall.private");
  console.log("  频道类: channel.join, channel.leave, channel.update");
  console.log("  成员类: member.join, member.leave");
  console.log("  语音类: voice.join, voice.leave");
  console.log("  身份组: role.update");
  console.log("  好友类: friend.request, friend.accept");
  console.log("  系统类: server_id, unknown, *");
  console.log("");

  try {
    await bot.start();
    console.log("✅ 事件监听器已启动，等待事件...\n");

    // 每 30 秒打印一次事件统计
    setInterval(() => {
      if (Object.keys(eventCounts).length > 0) {
        console.log("\n📊 事件统计:");
        for (const [name, count] of Object.entries(eventCounts).sort()) {
          console.log(`  ${name}: ${count}`);
        }
      }
    }, 5000);
  } catch (err) {
    console.error("❌ 启动失败:", err);
    process.exit(1);
  }
}

main();

// 优雅退出
process.on("SIGINT", async () => {
  console.log("\n🛑 正在关闭...");
  await bot.close();
  process.exit(0);
});
