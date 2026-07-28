# Mac mini 自动部署

正式环境采用 pull-based deployment。Mac mini 主动检查 GitHub，不开放部署 webhook。

## 流程

1. 其他设备把代码推送或合并到 `main`。
2. `com.djangomei.bookkeeping.deploy` 每 120 秒运行一次。
3. 部署器执行 `git fetch`，没有新 commit 时立即退出。
4. 有更新时，在临时目录执行 `npm ci`、`npm run lint` 和 `npm test`。
5. 验证通过后，生产副本更新到 `origin/main`。
6. `com.djangomei.bookkeeping` 重启并完成本地 HTTP 健康检查。

## Mac mini 路径

```text
生产副本  /Users/djangomei/bookkeeping-service
部署脚本  /Users/djangomei/.local/bin/git-auto-deploy
网站服务  ~/Library/LaunchAgents/com.djangomei.bookkeeping.plist
部署任务  ~/Library/LaunchAgents/com.djangomei.bookkeeping.deploy.plist
部署日志  ~/Library/Logs/bookkeeping-deploy.log
错误日志  ~/Library/Logs/bookkeeping-deploy.err.log
```

`.dev.vars` 和 `.wrangler` 只保存在生产副本中，并由 Git 忽略。远端更新不会覆盖口令、会话密钥或本地 D1 数据。

## 手动检查

```bash
launchctl print gui/$(id -u)/com.djangomei.bookkeeping
launchctl print gui/$(id -u)/com.djangomei.bookkeeping.deploy
tail -f ~/Library/Logs/bookkeeping-deploy.log
curl -I https://djangomei.com/bookkeeping/
```

需要重新验证并重启当前 commit 时：

```bash
~/.local/bin/git-auto-deploy bookkeeping --force
```

生产副本必须保持干净。部署器发现本地修改、非快进历史、验证失败或健康检查失败时会停止并写入错误日志，不会隐藏或覆盖现场。
