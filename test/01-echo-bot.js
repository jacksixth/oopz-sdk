/**
 * 01-echo-bot.js — 基础 Echo Bot
 *
 * 演示：创建 Bot、监听消息、回复消息、发送消息、撤回消息。
 *
 * 运行: node test/01-echo-bot.js
 */

require("dotenv").config({ path: __dirname + "/.env" });

const {
  OopzBot,
  OopzConfig,
  setupLogging,
} = require("../dist/index");

// ============ 配置 ============

const config = OopzConfig.fromEnv();

// 开启日志
setupLogging("DEBUG");

// ============ 创建 Bot ============

const bot = new OopzBot(config);

console.log("Bot 配置:");
console.log(`  baseUrl: ${config.baseUrl}`);
console.log(`  wsUrl:   ${config.wsUrl}`);
console.log(`  hasCredentials: ${config.hasCredentials()}`);

// ============ 事件监听 ============

// 监听频道消息 — 原封不动 echo 回去
bot.on("message", async (event) => {
  const msg = event.message;
  console.log(`\n📨 [消息] ${msg.senderNickname || msg.senderUid}: ${msg.content}`);

  try {
    // Echo: 回复相同内容
    const result = await bot.reply(
      msg.areaId,
      msg.channelId,
      msg.messageId,
      `[Echo] ${msg.content}`
    );
    console.log(`  ✅ 已回复 -> ${result.messageId}`);
  } catch (err) {
    console.error(`  ❌ 回复失败:`, err);
  }
});

// 监听私信
bot.on("message.private", async (event) => {
  const msg = event.message;
  console.log(`\n📩 [私信] ${msg.senderNickname || msg.senderUid}: ${msg.content}`);

  try {
    await bot.messages.sendPrivateMessage(
      msg.senderUid,
      `你好！你说的是: "${msg.content}"`
    );
    console.log(`  ✅ 已回复私信`);
  } catch (err) {
    console.error(`  ❌ 私信回复失败:`, err);
  }
});

// 监听消息编辑
bot.on("message.edit", (event) => {
  const msg = event.message;
  console.log(`\n✏️ [编辑] ${msg.senderNickname}: ${msg.content}`);
});

// 监听消息撤回
bot.on("recall", (event) => {
  console.log(`\n🗑️ [撤回] 消息 ${event.messageId}`);
});

// 通配符：捕获所有事件（调试用）
bot.on("*", (event) => {
  console.log(`\n🔔 [事件] ${event.eventName} (code: ${event.eventCode})`);
});

// ============ 启动与优雅退出 ============

async function main() {
  console.log("\n🚀 正在启动 Bot...");

  try {
    await bot.start();
    console.log("✅ Bot 已启动！按 Ctrl+C 退出\n");
  } catch (err) {
    console.error("❌ 启动失败:", err);
    process.exit(1);
  }

  // 优雅退出
  const shutdown = async () => {
    console.log("\n🛑 正在关闭 Bot...");
    await bot.close();
    console.log("✅ Bot 已关闭");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
