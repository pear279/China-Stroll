# China Stroll

China Stroll 是面向海外家庭游客的北京旅行导览 PWA。当前代码支持创建多日旅行、筛选景点、查看详情与可信导览、收藏、加入指定日期、使用地图查看行程与附近景点，再确认行程调整建议。景点详情提供 Apple Maps、Google Maps 和高德搜索入口。

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
npx wrangler secret put SILICONFLOW_API_KEY --config apps/worker/wrangler.jsonc
```

服务端密钥不能放入浏览器变量、日志或仓库。

正式环境使用 Cloudflare Pages Functions 接管 `/health` 和 `/v1/*`。这样页面与业务接口共用 `china-stroll.pages.dev`，不依赖单独的 `workers.dev` 域名。本地检查 Pages 完整运行方式如下。

```bash
npm run dev:pages
```

Cloudflare Pages 需要增加名为 `SUPABASE_SERVICE_ROLE_KEY` 和 `SILICONFLOW_API_KEY` 的 Secret。后者填写硅基流动 API Key。模型默认使用 `https://api.siliconflow.cn/v1`、`deepseek-ai/DeepSeek-V4-Flash`、`BAAI/bge-m3` 和 15 秒超时，因此不需要再填普通环境变量。需要调整时才添加 `SILICONFLOW_BASE_URL`、`SILICONFLOW_CHAT_MODEL`、`SILICONFLOW_EMBEDDING_MODEL` 或 `SILICONFLOW_TIMEOUT_MS`。`SUPABASE_URL` 和 `SUPABASE_PUBLISHABLE_KEY` 可以继续读取已有的 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY`，无需重复配置。前端正式构建固定使用同域接口，`VITE_API_BASE_URL` 只用于本地开发，可以从 Pages 正式环境删除。

## 检查命令

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

数据库测试位于 `supabase/tests`。这些脚本使用事务创建临时用户和旅行，完成检查后回滚。

## 当前边界

预览模式显示三个样本地点，账号模式读取已经发布并完成坐标审核的地点。地图使用项目内的 mapcn 源码，支持行程地点、候选景点、一次性位置和一公里、三公里、五公里附近筛选。虚线只表示访问顺序。当前底图用于本地技术试验，正式发布前需要选择符合许可、署名和北京访问要求的底图服务。

行程建议在配置 `SILICONFLOW_API_KEY` 后使用 `deepseek-ai/DeepSeek-V4-Flash` 生成结构化草案。请求失败或密钥未配置时使用可重复测试的规则建议。模型输出继续经过结构校验，并保留用户确认和版本检查。景点问答只读取已发布导览内容，模型不可用时返回导览摘录。`BAAI/bge-m3` 已作为检索嵌入模型配置，批量向量生成和召回质量测试仍待完成。
