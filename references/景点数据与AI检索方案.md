# 景点数据与 AI 检索方案

## 当前数据检查

data 目录目前有一份 Excel 和一份 CSV。

1. CSV 实际包含 52 条景点记录。
2. 52 个景点标识没有重复，格式可以继续使用。
3. 北京喜剧院原记录缺少经纬度，已经根据场馆地址和高德地点页补齐。
4. CSV 多出一个空白列，需要在导入前删除。
5. 中文内容已经覆盖介绍、历史、看点、提示、实用信息、拍照建议和分段导览。
6. 52 个景点都已记录来源、检查时间和复查日期。39 个景点通过当前审核，13 个因来源覆盖有限而保留草稿。
7. guide_segments 当前保存的是顺序段落，字段说明中的四种风格没有真实对应数据。
8. Excel 的图片列仍是 image.png 占位文字。50景点图片附件文件夹中有 58 张 PNG，覆盖全部 52 个景点，6 个景点有备选图。
9. 图片没有来源、授权范围和署名资料。28 张分辨率偏低，2 张带可见水印或来源文字，3 张为竖图或近方图，当前不能公开发布。

原始资料只作为编辑来源，不直接提供给客户端，也不直接用于 AI 回答。

## 存放决定

结构化景点数据和中英文内容存入 Supabase PostgreSQL。图片与音频存入 Supabase Storage。Git 仓库保存数据结构、迁移文件、导入程序和不含密钥的内容模板。

原始 Excel 和 CSV 暂时只保留在本地 data 目录。当前远程仓库可以匿名读取，图片版权和文本来源核实前不推送原始资料。

## 建议数据表

### places

保存语言无关的稳定信息。

主要字段包括 id、slug、category、latitude、longitude、recommended_duration_minutes、status、created_at 和 updated_at。

### place_localizations

每个景点和每种语言一条记录。首批语言使用 zh-CN 和 en。

主要字段包括 place_id、locale、name、aliases、short_intro、history、highlights、visitor_tips、practical_notes、photo_spot_notes、review_status、reviewed_at 和 content_version。

中英文分行保存，避免为每种语言不断增加数据库列。客户端根据当前语言读取对应记录，缺少英文时退回中文并显示提示。

### guide_segments

把长导览拆成可以排序和检索的小段。

主要字段包括 id、place_id、locale、segment_type、audience、sequence、title、content、review_status 和 content_version。

segment_type 可使用 overview、history、highlight、family、practical 和 faq。audience 首批使用 general 与 child。

### place_sources

保存事实来源和复查状态。

主要字段包括 id、place_id、source_type、source_name、source_url、fact_scope、published_at、checked_at、review_due_at 和 status。

票价、开放时间、预约和交通信息必须关联来源。超过复查日期后仍可显示，但要提醒用户重新确认。

### place_media

保存媒体说明和 Storage 文件位置。

主要字段包括 id、place_id、media_type、storage_path、locale、alt_text、credit、license、sort_order 和 status。

没有版权、授权范围和署名信息的图片不进入正式环境。

### place_search_documents

保存供 AI 检索的小段文字。

主要字段包括 id、place_id、locale、section、content、source_ids、content_version、embedding_model 和 embedding。

内容更新后生成新版本和新向量。旧版本停止检索，但保留审核记录。

## 产品读取方式

普通页面按照地点标识和语言读取 places、place_localizations、guide_segments 与 place_media。地图只读取坐标、分类、名称和短介绍，避免一次加载整份导览。

AI 不能直接读取整张表。Cloudflare Worker 先根据地点、语言、问题类型和当前时间筛选，再从 place_search_documents 取少量相关段落。模型收到段落、来源和更新时间后生成回答。动态信息过期时，回答必须提示再次确认。

52 个景点的数据量很小。第一版可以使用字段筛选、关键词搜索和 pgvector 精确扫描，无需提前建立复杂向量索引。中英文检索使用同一个多语言向量模型，模型名称与维度写入记录，避免不同向量混用。

## 权限安排

1. 已发布的景点内容允许匿名只读。
2. 草稿、导入记录和审核信息只允许编辑人员或服务端读取。
3. 客户端不能写入景点内容、来源和检索向量。
4. Cloudflare Worker 保存服务密钥并承担受控写入，浏览器只使用 Supabase publishable key。
5. 所有公开表启用行级权限，并单独确认 Data API 暴露设置与数据库授权。
6. Storage 上传权限只给受信任的编辑流程，公开图片只开放读取。

## 中英文内容制作

1. 清理字段、空白列、分隔符和坐标格式。
2. 已为 52 个景点补充事实来源、复查日期和内容状态。
3. 故宫、天坛和景山三个中英文样本已经完成事实与语言检查。景山是第三个样本。
4. 将中文内容按页面字段和检索段落拆开。
5. 生成英文初稿，保留中文专名并补充通行英文名称。
6. 人工检查专名、年代、宗教表达、门票、预约和安全信息。
7. 已生成无向量的分段检索文档。确定多语言嵌入模型并完成检索测试后再生成向量。
8. 三个样本先用于页面和 AI 问答测试，13 个受限景点继续补充更具体的资料。

英文内容允许先处于 draft 状态。只有经过事实和语言检查的记录可以进入 published 状态。

## 仓库与 Supabase 状态

本地目录已经连接 GitHub 仓库 pear279/China-Stroll 的 main 分支。数据结构、导入程序和说明文档已经推送。

Supabase 项目 yjguudzllzjdmqsgwtru 已经通过 OAuth 连接。项目位于 ap-southeast-2，使用 PostgreSQL 17。

数据库已经创建 places、place_localizations、guide_segments、place_sources、place_media 和 place_search_documents 六张表，并启用 vector 扩展和行级权限。52 个地点、52 条中文内容和 209 个中文导览段落已经导入。39 条中文内容通过当前审核，13 条保留草稿。故宫、天坛和景山另有三条已审核英文内容及十二个英文导览段落。

北京喜剧院坐标已经补齐。52 个景点都有来源记录，数据库现有 54 条来源。已生成 165 条检索文档，其中 126 条来自已审核内容。向量尚未生成。

图片文件只保存在本地并列入 Git 忽略规则。授权资料补齐前不写入 place_media，不上传 Supabase Storage，也不通过客户端读取。

逐条结果见 [景点来源与图片审核](./景点来源与图片审核.md)。

匿名角色实测看不到任何草稿，服务角色可以读取全部 52 个地点。Supabase 安全检查没有发现问题。性能检查只提示新索引尚未使用，当前没有真实请求，这类提示符合现状。

不要在聊天、Git 仓库或前端代码中提供 service_role 或 secret key。

## 导入验收

1. 52 个 place 标识唯一。
2. 每个已发布地点至少有一条中文和一条英文记录。
3. 坐标完整，并通过北京地图抽查。
4. 动态信息都有来源、检查时间和复查日期。
5. 页面切换语言后名称、介绍、导览和图片替代文字同步变化。
6. AI 只返回已发布内容，并能给出来源和更新时间。
7. 未发布草稿、服务密钥和原始导入文件无法从浏览器取得。
