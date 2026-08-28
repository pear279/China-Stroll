# China Stroll

China Stroll 是面向海外家庭游客的北京旅行导览 PWA。当前代码完成了第一条可运行过程，用户可以创建旅行、加入故宫、景山和天坛，查看地图，再确认行程调整建议。

产品范围与判断记录在 [迭代版](./references/迭代版.md)。数据关系与接口要求记录在 [MVP 数据结构与接口契约](./references/MVP数据结构与接口契约.md)。

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm install
cp .env.example apps/web/.env.local
npm run dev:web
```

浏览器打开 `http://localhost:5173`。没有后端密钥时可以使用三景点预览，预览数据只保存在当前浏览器。

当前生产构建暂时开启测试登录。用户填写邮箱后会创建 Supabase 匿名会话，不发送邮件，也不验证邮箱。邮箱只在当前标签页保存为遮罩后的显示文字。退出登录或清除浏览器数据后，该匿名账号无法恢复。公开发布前应关闭 `VITE_ENABLE_TEST_LOGIN`，恢复正式账号登录，并为匿名入口增加 Turnstile。

单独调试 Worker 时需要设置 Supabase 服务端密钥。

```bash
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
npm run dev:worker
```

把密钥填入忽略提交的 `.dev.vars`。部署时再使用下面的命令写入 Cloudflare Secret。

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config apps/worker/wrangler.jsonc
```

服务端密钥不能放入浏览器变量、日志或仓库。

正式环境使用 Cloudflare Pages Functions 接管 `/health` 和 `/v1/*`。这样页面与业务接口共用 `china-stroll.pages.dev`，不依赖单独的 `workers.dev` 域名。本地检查 Pages 完整运行方式如下。

```bash
npm run dev:pages
```

Cloudflare Pages 需要增加名为 `SUPABASE_SERVICE_ROLE_KEY` 的 Secret。`SUPABASE_URL` 可以继续读取已有的 `VITE_SUPABASE_URL`，无需重复配置。前端正式构建固定使用同域接口，`VITE_API_BASE_URL` 只用于本地开发，可以从 Pages 正式环境删除。

## 检查命令

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

数据库测试位于 `supabase/tests`。这些脚本使用事务创建临时用户和旅行，完成检查后回滚。

## 当前边界

地图只显示三个样本地点与访问顺序。虚线不是道路路线。当前底图只用于本地技术试验，正式发布前需要选择符合许可、署名和北京访问要求的底图服务。

行程建议暂时使用可重复测试的规则生成。模型服务接入后继续输出同一套结构化改动，并保留用户确认和版本检查。
