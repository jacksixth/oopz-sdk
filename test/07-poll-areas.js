/**
 * 07-poll-areas.js — 定时轮询已加入的区域、频道及房间
 *
 * 演示：每 30 秒查询一次已加入的区域列表、频道分组及子频道（房间）。
 *
 * 运行: node test/07-poll-areas.js
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

// ============ 轮询间隔（毫秒）============

const POLL_INTERVAL_MS = 30_000; // 30 秒

// ============ 频道类型中文名 ============

const CHANNEL_TYPE_CN = {
  TEXT: "文字",
  VOICE: "语音",
  AUDIO: "语音",
};

// ============ 查询已加入区域及频道房间 ============

async function pollJoinedAreas() {
  try {
    const areas = await bot.areas.getJoinedAreas();
    const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });

    console.log(`\n[${now}] 📋 已加入的区域 (共 ${areas.length} 个):`);
    if (areas.length === 0) {
      console.log("  (无)");
      return;
    }

    for (let i = 0; i < areas.length; i++) {
      const a = areas[i];
      console.log(`  ${i + 1}. 🏠 ${a.name}`);

      // 查询该区域下的频道分组及子频道（房间）
      try {
        const groups = await bot.areas.getAreaChannels(a.areaId);

        // 查询语音频道内的在线用户
        let voiceMembers = {};
        try {
          const vm = await bot.channels.getVoiceChannelMembers(a.areaId);
          voiceMembers = vm.channelMembers || {};
        } catch (e) {
          console.log(`     ⚠️ 获取语音用户失败: ${e.message}`);
        }

        // 收集所有语音频道内的 UID，批量查昵称
        const allUids = [...new Set(
          Object.values(voiceMembers).flatMap((members) => members.map((m) => m.uid))
        )];
        let nicknameMap = {};

        if (allUids.length > 0) {
          // 优先用 personInfos 批量查
          try {
            nicknameMap = await bot.person.getUserInfos(allUids);
          } catch {
            // 忽略
          }

          // 如果没查到（API 返回空），回退用区域成员列表查
          const missing = allUids.filter((uid) => !nicknameMap[uid]);
          if (missing.length > 0) {
            try {
              // 分页拉取区域成员，直到找齐或拉完
              let offset = 0;
              const pageSize = 100;
              while (missing.some((uid) => !nicknameMap[uid]) && offset < 1000) {
                const page = await bot.areas.getMembers(a.areaId, { offset, limit: pageSize });
                for (const m of page.members) {
                  if (missing.includes(m.uid) && !nicknameMap[m.uid]) {
                    nicknameMap[m.uid] = { nickname: m.nickname || m.uid };
                  }
                }
                if (page.members.length < pageSize) break;
                offset += pageSize;
              }
            } catch {
              // 忽略
            }
          }
        }

        if (groups.length === 0) {
          console.log(`     📂 (无频道)`);
        } else {
          groups.forEach((g) => {
            const sysTag = g.system ? " [系统]" : "";
            console.log(`     📁 ${g.name} ${sysTag}`);

            g.channels.forEach((ch) => {
              const typeName = CHANNEL_TYPE_CN[ch.type] || ch.type;
              const lock = ch.secret ? " 🔒" : "";
              const temp = ch.isTemp ? " ⏳临时" : "";
              const isVoice = ch.type === "VOICE" || ch.type === "AUDIO";

              // 显示语音频道的在线用户
              let memberStr = "";
              if (isVoice) {
                const members = voiceMembers[ch.channelId] || [];
                if (members.length > 0) {
                  const names = members.slice(0, 5).map((m) => {
                    const info = nicknameMap[m.uid];
                    return info ? info.nickname : m.uid.slice(0, 10) + "...";
                  });
                  memberStr = ` 👥${members.length}人: ${names.join(", ")}`;
                  if (members.length > 5) memberStr += ` +${members.length - 5}`;
                } else {
                  memberStr = ` 👤0人`;
                }
              }

              console.log(`        🗣 ${ch.name} [(${typeName}${lock}${temp})${memberStr}`);
            });
          });
        }
      } catch (chErr) {
        console.log(`     ⚠️ 获取频道失败: ${chErr.message}`);
      }
    }
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ 查询区域失败:`, err.message);
  }
}

// ============ 启动 ============

async function main() {
  console.log("🚀 启动区域轮询 Bot...");
  console.log(`⏱  轮询间隔: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`🔗 baseUrl: ${config.baseUrl}`);
  console.log(`🔗 wsUrl:   ${config.wsUrl}`);
  console.log(`🔑 凭据:    ${config.hasCredentials() ? "✅ 已配置" : "❌ 缺失"}`);

  // 启动 Bot（REST + WebSocket）
  await bot.start();
  console.log("✅ Bot 已启动\n");

  // 立即执行一次查询
  await pollJoinedAreas();

  // 定时轮询
  const timer = setInterval(pollJoinedAreas, POLL_INTERVAL_MS);

  // 优雅退出
  const shutdown = async (signal) => {
    console.log(`\n🛑 收到 ${signal}，正在关闭...`);
    clearInterval(timer);
    await bot.close();
    console.log("👋 已退出");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("❌ 启动失败:", err);
  process.exit(1);
});
