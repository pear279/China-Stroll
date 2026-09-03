# China Stroll · 漫游北京

> 面向海外游客的北京旅行导览 PWA —— 在一个手机优先的产品里，找到可信景点、看懂地图与位置、处理来华旅行工具问题、管理个人行程与预约。

**在线访问：https://china-stroll.pages.dev**（手机浏览器直接打开即可使用）

---

## 这是什么

China Stroll 是一款面向来北京旅行的海外游客（优先服务家庭行程组织者、多代家庭和希望深入了解中国文化的英语用户）的渐进式 Web 应用。它把四件分散的事收敛到一个产品里：

1. **景点（Attractions）** —— 找到可信、经过坐标与内容审核的景点
2. **地图（Map）** —— 在地图上理解当前位置与行程
3. **工具（Tools）** —— 处理来华旅行中的支付、翻译、导航、热线等日常问题
4. **我的（Mine）** —— 管理个人资料、共享成员、完整行程与预约

产品以“可信内容 + 共同日程 + 现场地图 + 来华工具”为核心，AI 只用于解释、推荐和提出结构化建议，**不能绕过来源、权限、版本或用户确认直接修改行程**。

---

## 核心功能

### 1. 景点 / Attractions
- 首批 20 个经过 WGS84 坐标、内容、游览信息与来源审核的北京景点
- 最近景点 / 当前景点、搜索与分类 / 时长 / 距离筛选
- 景点详情：可信导览、来源卡片、复核提示、票价 / 开放 / 预约 / 入口信息
- 收藏、加入指定日期、加入行程
- 根据行程与偏好的 AI 推荐与问答（未命中已审核资料时显式返回“无法确认”，并附检索时间与引用）

### 2. 地图 / Map
- mapcn / MapLibre 视觉层，行程地点与附近地点高亮
- 当前位置与 1 / 3 / 5 / 10 / 20 公里附近筛选
- 点击标记后提供 Apple Maps / Google Maps / 高德 / 百度 导航入口
- 当天行程卡片、拖拽排序、访问顺序虚线提示
- 可选的位置共享（仅对已接受邀请的同行成员，默认关闭）

### 3. 工具 / Tools
- 导航、打车、支付说明与汇率
- AI 翻译与 AI 对话（可离线回退，基础能力不依赖 AI）
- 常用语、服务热线（景点 / 饭店 / 酒店 / 常用）

### 4. 我的 / Mine
- 紧凑个人资料卡（头像 / 昵称 / 国家 / 语言 / 旅行者称号）+ 编辑资料
- 快捷入口：收藏 / 去过 / 语言切换
- 共享成员：头像行、邀请链接（角色 + 有效期）、成员资料
- **My itinerary**：周 / 月日历、按日期查看行程与预约、景点完成勾选（与“去过”联动）、拖拽排序、删除、预约增删改

### 行程（跨模块共享对象）
“行程”是跨模块共享的核心：景点负责发现并加入，地图负责空间展示，我的负责完整编辑与管理，工具读取当前行程提供上下文服务。四个模块共用同一个 `placeId` 与 `Trip` 快照，不是互相拷贝的数据孤岛。

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 客户端 | React 19 · TypeScript · Vite 8 · Tailwind CSS 4 · PWA |
| 地图 | 项目自有的 mapcn 组件 · MapLibre GL JS |
| API | Hono（Cloudflare Pages Functions 与独立 Worker 共用） |
| 数据库 / 认证 | Supabase PostgreSQL 17 · Auth · RLS · Realtime |
| AI | Worker 内 provider 抽象；当前聊天 / 嵌入适配 SiliconFlow 兼容接口 |
| 校验 / 测试 | Zod · Vitest · oxlint · TypeScript · 事务型 SQL 测试 |

本地运行要求：**Node.js 22 或 24**（Apple Silicon）。

---

## 快速上手（用户）

1. 手机打开 <https://china-stroll.pages.dev>
2. 点击 **Get started**（无需邮箱，匿名登录）
3. 首次使用完成三步 onboarding：昵称 → 同行人数 → 行程起止日期
4. 进入四个模块开始使用；返回用户会直接回到已有行程

---

## 本地开发

```bash
# 安装依赖（使用锁文件）
npm ci

# 配置前端环境变量（Vite）
cp .env.example apps/web/.env.local
# 填入 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY

# 启动 Web（Vite dev server，默认 http://localhost:5173）
npm run dev:web
```

没有后端密钥时可使用三景点预览，预览数据只保存在当前浏览器。

完整本地运行 Pages（静态 + Pages Functions）：

```bash
npm run dev:pages
```

单独调试 Worker：

```bash
cp apps/worker/.dev.vars.example apps/worker/.dev.vars   # 填入 Supabase 服务端密钥
npm run dev:worker
```

> 服务端密钥（Supabase service-role key、SiliconFlow key）**绝不能**写入浏览器变量、日志或仓库。

---

## 数据与内容管线

- **景点数据**：`data/` + `references/` 是源材料；经确定性校验 / 生成后产出 20 个可发布地点的版本化 JSON 与 Supabase migration。
- **展示图**：只使用 `data/processed/place-display-images` 中的非真实照片风格图片；`data/50景点图片附件` 的真实照片不进公开目录、数据库或正式构建。`forbidden-city` 有意映射到 `palace-museum` 的展示图源。
- 生成与校验：

```bash
npm run images:prepare   # 校验 52 个映射并生成 WebP
npm run images:verify
npm run places:prepare
npm run places:verify
npm run catalog:prepare
npm run catalog:verify
```

- 动态事实（开放时间、票价、预约、入口）不确定时**保持显式未知**，不填“看起来合理”的占位值。

---

## 安全与隐私

- 浏览器只使用 publishable 凭据；service-role key 与 AI 密钥只留在服务端。
- 所有公开表启用 RLS 与显式授权。
- 所有行程写入都带 **命令 id、期望版本、权限检查与变更日志**；AI 建议走同一条写入路径。
- 位置共享默认关闭，只对已接受邀请的同行成员开放，只存“一个带有效期的当前点”，不存轨迹；关闭立即停止上传并撤销服务端可见性。**位置共享不是安全保证。**
- 日志不记录原始访问令牌、精确位置历史、service-role key 或 AI 密钥。

---

## 检查命令

```bash
npm run typecheck   # 类型检查
npm run lint        # oxlint（0 警告）
npm test            # Vitest（单元 + 组件 + 事务 SQL 测试）
npm run build       # 完整构建：typecheck + lint + 数据校验 + 测试 + Web/Functions/Worker 构建
npm run db:verify   # 本地 Supabase 从空库重建两次并跑事务回滚测试（需要 Supabase CLI + OrbStack）
```

---

## 部署

正式环境使用 **Cloudflare Pages**（静态站点 + Pages Functions 接管 `/health` 与 `/v1/*`），页面与业务接口共用 `china-stroll.pages.dev`；数据库使用 **Supabase**。

1. Supabase：`supabase link` 关联项目，`npm run db:push`（或 `supabase db push`）应用迁移。
2. Cloudflare Pages 项目需要配置环境变量 / Secret：
   - `SUPABASE_SERVICE_ROLE_KEY`（Secret）
   - `SILICONFLOW_API_KEY`（Secret，可选，启用 AI 建议 / 翻译 / 问答）
   - `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`（构建期变量，也可由 `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` 复用）
   - `WEB_ORIGIN`（生产域名，例如 `https://china-stroll.pages.dev`）
3. 构建并部署：

```bash
npm run build
npx wrangler pages deploy dist/web --project-name china-stroll
```

> Pages 已与 GitHub 仓库 `pear279/China-Stroll` 的 `main` 分支集成，push 到 `main` 会自动触发构建与发布。

---

## 目录结构

```
apps/web          React PWA 与公开生成展示图
apps/worker       可复用 Hono API
components/ui     项目自有 UI 原语（含 mapcn 派生地图组件）
packages/shared   领域类型与确定性共享逻辑（地点契约等）
functions         Cloudflare Pages 适配器
supabase          migrations、数据库类型与事务型 SQL 测试
scripts           确定性校验 / 生成 / 本地验证脚本
data              源材料与处理后内容
references        研究、历史 PRD 与实现记录
docs/superpowers  已批准的功能设计与实现计划
```

---

## 当前边界

- 预览模式显示三个样本地点；账号模式读取已发布且完成坐标审核的地点。
- 地图底图当前用于本地技术试验，正式发布前需选择符合许可、署名与北京访问要求的底图服务。
- 完整离线地图包、北京以外城市、原生 iOS / Android / 微信小程序、公开社区与好友可见旅行记录在 MVP 之后分阶段实现。

更完整的产品范围、数据契约与判断记录见 [`PRODUCT.md`](./PRODUCT.md)、[`ARCHITECTURE.md`](./ARCHITECTURE.md)、[`TASKS.md`](./TASKS.md) 及 [`references/`](./references)。
