/**
 * 04-area-channel.js — 区域 & 频道管理
 *
 * 演示：列出区域、获取区域信息、列出成员、获取成员详情、
 *       列出频道、创建/编辑/删除频道。
 *
 * 运行: node test/04-area-channel.js
 */

require("dotenv").config({ path: __dirname + "/.env" });

const {
  OopzBot,
  OopzConfig,
  setupLogging,
  ChannelType,
} = require("../dist/index");

// ============ 配置 ============

const config = OopzConfig.fromEnv();
setupLogging("INFO");

const bot = new OopzBot(config);

// ============ 事件监听 ============

bot.on("message", async (event) => {
  const msg = event.message;
  const content = msg.content.trim().toLowerCase();
  const args = content.split(/\s+/);
  const cmd = args[0];

  try {
    switch (cmd) {
      // ── 区域管理 ──
      case "!areas": {
        const areas = await bot.areas.getJoinedAreas();
        const list = areas
          .map((a, i) => `${i + 1}. [${a.areaId}] ${a.name} (成员: ${a.memberCount != null ? a.memberCount : "?"})`)
          .join("\n");
        await bot.reply(msg.areaId, msg.channelId, msg.messageId, `📋 已加入的区域:\n${list || "(无)"}`);
        console.log(`  ✅ 列出 ${areas.length} 个区域`);
        break;
      }

      case "!area": {
        // !area <areaId>
        const areaId = args[1] || msg.areaId;
        const area = await bot.areas.getAreaInfo(areaId);
        if (area) {
          await bot.reply(
            msg.areaId, msg.channelId, msg.messageId,
            `🏠 区域: ${area.name}\nID: ${area.areaId}\n拥有者: ${area.ownerUid != null ? area.ownerUid : "?"}\n成员: ${area.memberCount != null ? area.memberCount : "?"}`
          );
        } else {
          await bot.reply(msg.areaId, msg.channelId, msg.messageId, `❌ 未找到区域: ${areaId}`);
        }
        break;
      }

      // ── 成员管理 ──

      case "!members": {
        // !members [areaId] [page]
        const areaId = args[1] || msg.areaId;
        const offset = parseInt(args[2] || "0");
        const page = await bot.areas.getMembers(areaId, { offset, limit: 20 });
        const list = page.members
          .map((m, i) => `${offset + i + 1}. ${m.nickname != null ? m.nickname : m.uid} [${m.uid}]`)
          .join("\n");
        await bot.reply(
          msg.areaId, msg.channelId, msg.messageId,
          `👥 成员 (${offset + 1}-${offset + page.members.length} / ${page.total}):\n${list || "(无)"}`
        );
        console.log(`  ✅ 列出 ${page.members.length} 个成员 (total: ${page.total})`);
        break;
      }

      case "!member": {
        // !member <areaId> <uid>
        const areaId = args[1] || msg.areaId;
        const uid = args[2];
        if (!uid) {
          await bot.reply(msg.areaId, msg.channelId, msg.messageId, "用法: !member <areaId> <uid>");
          break;
        }
        const detail = await bot.areas.getUserDetail(areaId, uid);
        if (detail) {
          await bot.reply(
            msg.areaId, msg.channelId, msg.messageId,
            `👤 ${detail.nickname} [${detail.uid}]\n身份组: ${(detail.roles || []).map(r => r.name).join(", ") || "(无)"}`
          );
        } else {
          await bot.reply(msg.areaId, msg.channelId, msg.messageId, `❌ 未找到成员: ${uid}`);
        }
        break;
      }

      // ── 频道管理 ──

      case "!channels": {
        const channels = await bot.channels.listChannels(msg.areaId);
        const typeNames = {
          [ChannelType.TEXT]: "💬文字",
          [ChannelType.VOICE]: "🔊语音",
        };
        const list = channels
          .map((c) => `  ${typeNames[c.type] || `[${c.type}]`} #${c.name} [${c.channelId}]`)
          .join("\n");
        await bot.reply(
          msg.areaId, msg.channelId, msg.messageId,
          `📺 频道列表:\n${list || "(无)"}`
        );
        console.log(`  ✅ 列出 ${channels.length} 个频道`);
        break;
      }

      case "!channel": {
        // !channel <channelId>
        const channelId = args[1] || msg.channelId;
        const ch = await bot.channels.getChannel(msg.areaId, channelId);
        if (ch) {
          await bot.reply(
            msg.areaId, msg.channelId, msg.messageId,
            `📺 #${ch.name}\nID: ${ch.channelId}\n类型: ${ch.type}\n私密: ${ch.isPrivate != null ? ch.isPrivate : false}`
          );
        } else {
          await bot.reply(msg.areaId, msg.channelId, msg.messageId, `❌ 未找到频道: ${channelId}`);
        }
        break;
      }

      case "!createchannel": {
        // !createchannel <name>
        const name = args.slice(1).join(" ");
        if (!name) {
          await bot.reply(msg.areaId, msg.channelId, msg.messageId, "用法: !createchannel <名称>");
          break;
        }
        const result = await bot.channels.createChannel(msg.areaId, name, ChannelType.TEXT);
        await bot.reply(
          msg.areaId, msg.channelId, msg.messageId,
          `✅ 频道已创建: #${name}\nID: ${result.channelId}`
        );
        console.log(`  ✅ 创建频道: ${result.channelId}`);
        break;
      }

      case "!deletechannel": {
        // !deletechannel <channelId>
        const channelId = args[1];
        if (!channelId) {
          await bot.reply(msg.areaId, msg.channelId, msg.messageId, "用法: !deletechannel <channelId>");
          break;
        }
        const result = await bot.channels.deleteChannel(msg.areaId, channelId);
        if (result.success) {
          await bot.reply(msg.areaId, msg.channelId, msg.messageId, `✅ 频道已删除: ${channelId}`);
        } else {
          await bot.reply(msg.areaId, msg.channelId, msg.messageId, `❌ 删除失败: ${result.error}`);
        }
        break;
      }

      default:
        // 不处理未知命令
        break;
    }
  } catch (err) {
    console.error(`  ❌ 命令 ${cmd} 执行失败:`, err);
    await bot.reply(msg.areaId, msg.channelId, msg.messageId, `❌ 执行失败: ${err}`);
  }
});

// ============ 启动 ============

async function main() {
  console.log("🏠 区域 & 频道管理测试启动中...\n");
  console.log("可用命令:");
  console.log("  !areas              — 列出所有已加入的区域");
  console.log("  !area [areaId]      — 查看区域详情");
  console.log("  !members [areaId] [offset] — 列出成员");
  console.log("  !member <areaId> <uid>     — 查看成员详情");
  console.log("  !channels           — 列出频道");
  console.log("  !channel [channelId] — 查看频道详情");
  console.log("  !createchannel <名称> — 创建文字频道");
  console.log("  !deletechannel <id> — 删除频道");
  console.log("");

  try {
    await bot.start();
    console.log("✅ 已启动，等待命令...\n");
  } catch (err) {
    console.error("❌ 启动失败:", err);
    process.exit(1);
  }
}

main();

process.on("SIGINT", async () => {
  console.log("\n🛑 正在关闭...");
  await bot.close();
  process.exit(0);
});
