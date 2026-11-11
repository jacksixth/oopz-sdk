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

// ── 表情事件 ──

bot.on("message.reaction", (event) => {
  console.log(`[message.reaction] ${event.person} 对消息 ${event.messageId} 添加了表情 ${event.emoji}`);
});

// ── 频道事件 ──

bot.on("channel.update", (event) => {
  console.log(`[channel.update]   频道信息更新: ${event.channelId}`);
  console.log(`  name: ${event.name}, type: ${event.channelType}, maxMember: ${event.maxMember}`);
});

bot.on("channel.create", (event) => {
  console.log(`[channel.create]   频道创建: ${event.channelId} (${event.name})`);
});

bot.on("channel.delete", (event) => {
  console.log(`[channel.delete]   频道删除: ${event.channelId}`);
});

// ── 语音事件 ──

bot.on("voice.enter", (event) => {
  console.log(`[voice.enter]      用户进入语音频道: ${event.channelId}`);
  console.log(`  persons: ${event.persons.join(", ")}, activeNum: ${event.activeNum}`);
});

bot.on("voice.leave", (event) => {
  console.log(`[voice.leave]      用户离开语音频道: ${event.channelId}`);
});

// ── 用户 / 域 / 身份组事件 ──

bot.on("user.update", (event) => {
  console.log(`[user.update]      用户资料更新: ${event.person}`);
});

bot.on("user.login_state", (event) => {
  console.log(`[user.login_state] 用户登录状态变更: ${event.person} (${event.type})`);
});

bot.on("area.update", (event) => {
  console.log(`[area.update]      域信息更新: ${event.areaId} (${event.name})`);
});

bot.on("role.change", (event) => {
  console.log(`[role.change]      身份组变更: ${event.roleId} (${event.name})`);
});

// ── 好友事件 ──

bot.on("friend.request", (event) => {
  console.log(`[friend.request]   收到好友请求: ${event.person} (${event.name || "?"})`);
});

bot.on("friend.delete", (event) => {
  console.log(`[friend.delete]    好友被删除: ${event.person}`);
});

// ── 管理事件 ──

bot.on("moderation.text_ban", (event) => {
  console.log(`[moderation.text_ban] 域内禁言: ${event.areaId}`);
});

bot.on("moderation.voice_ban", (event) => {
  console.log(`[moderation.voice_ban] 域内禁麦: ${event.areaId}`);
});

// ── 系统事件 ──

bot.on("server_id", (event) => {
  console.log(`[server_id]        服务端已确认 ID: ${event.serverId}`);
});

bot.on("auth", (event) => {
  console.log(`[auth]             鉴权结果: code=${event.code}`);
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
  console.log("  消息类: message, message.private, message.edit, message.private.edit");
  console.log("  撤回类: recall, recall.private");
  console.log("  表情类: message.reaction");
  console.log("  频道类: channel.update, channel.create, channel.delete");
  console.log("  语音类: voice.enter, voice.leave");
  console.log("  用户类: user.update, user.login_state");
  console.log("  域类:   area.update");
  console.log("  身份组: role.change");
  console.log("  好友类: friend.request, friend.delete");
  console.log("  管理类: moderation.text_ban, moderation.voice_ban");
  console.log("  系统类: server_id, auth, unknown, *");
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
