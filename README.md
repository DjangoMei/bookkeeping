# 家账 Bookkeeping

zcy 与 Django 共用的家庭记账网页。

- 正式地址：<https://djangomei.com/bookkeeping>
- GitHub：<https://github.com/DjangoMei/bookkeeping>

## 功能

- zcy / Django 收入独立管理，工资与额外收入分开记录
- 大额消费按每年 6 月至次年 5 月统计，周期上限 ¥50,000
- 孩子支出登记
- 信用卡自然月支出超过 ¥4,000 的异常月份登记
- 礼金、礼物等人情明细
- 飞书历史数据迁移
- 共享安全口令登录

## 本地运行

需要 Node.js 22.13 或更新版本。

复制 `.env.example` 为 `.dev.vars`，并配置：

```text
LEDGER_PASSPHRASE=你的安全口令
SESSION_SECRET=一段足够长的随机字符串
```

安装依赖并启动与正式环境一致的稳定服务：

```bash
npm install
npm run dev
```

需要前端热更新时，改用 `npm run dev:hot`。

## 构建

```bash
npm run build
```

结构化账目存储在 Cloudflare D1，数据库迁移位于 `drizzle/`。

## 自动部署

`main` 更新后，Mac mini 会在两分钟内主动检查、验证并部署新提交。运行方式、日志位置和排障命令见 [Mac mini 自动部署](docs/mac-mini-auto-deploy.md)。
