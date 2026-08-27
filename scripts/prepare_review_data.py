#!/usr/bin/env python3
"""Build reviewed source records, the third English sample, and search documents."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


SOURCES = [
    ("永定门", "北京市文物局文物考古资料", "https://wwj.beijing.gov.cn/bjww/362760/362767/bjwwz/ylzs/508861/2023060916180423846.doc", "official", "pass", ["identity", "history"]),
    ("正阳门", "北京市文物局文物保护资料", "https://wwj.beijing.gov.cn/bjww/362760/362767/bjwwz/ylzs/508861/2023081815303242428.doc", "official", "pass", ["identity", "history"]),
    ("天安门", "天安门地区管理委员会预约办法", "https://tamgw.beijing.gov.cn/zhengwugongkai/tzgg/202111/t20211119_2541156.html", "official", "pass", ["identity", "booking", "visitor_rules"]),
    ("故宫博物院", "故宫博物院", "https://www.dpm.org.cn/", "official", "pass", ["identity", "history", "visit"]),
    ("景山公园", "北京中轴线官网景山资料", "https://www.bjaxiscloud.com.cn/web/address/details/1558142840655642625.html", "official", "pass", ["identity", "history", "highlights", "visit"]),
    ("钟鼓楼", "北京市文物局文物考古资料", "https://wwj.beijing.gov.cn/bjww/362760/362767/bjwwz/ylzs/508861/2023060916180423846.doc", "official", "pass", ["identity", "history"]),
    ("天坛公园", "北京市园林绿化局天坛公园资料", "http://yllhj.beijing.gov.cn/ggfw/bjsggml/lsmy/lsmy2/202206/t20220620_2746558.shtml", "official", "pass", ["identity", "history", "highlights"]),
    ("龙潭公园", "北京市公园管理中心", "https://gygl.beijing.gov.cn/", "official", "limited", ["identity"]),
    ("明城墙遗址", "北京市文物局文物考古资料", "https://wwj.beijing.gov.cn/bjww/362760/362767/bjwwz/ylzs/508861/2023060916180423846.doc", "official", "pass", ["identity", "history"]),
    ("皇城根遗址公园", "北京市园林绿化局皇城根遗址公园资料", "https://yllhj.beijing.gov.cn/ggfw/bjsggml/zlgy/dcq/202206/t20220615_2740843.shtml", "official", "pass", ["identity", "history", "visit"]),
    ("智化寺", "北京市人民政府北京文博交流馆资料", "https://www.beijing.gov.cn/gate/big5/www.beijing.gov.cn/renwen/rwzyd/gdwh/zhs/202107/t20210706_2430372.html", "official", "pass", ["identity", "history", "highlights"]),
    ("中国国家博物馆", "中国国家博物馆", "https://www.chnmuseum.cn/cg/", "official", "pass", ["identity", "visit"]),
    ("毛主席纪念堂", "北京市人民政府毛主席纪念堂资料", "https://www.beijing.gov.cn/renwen/rwzyd/bwg/mzxjnt/202301/t20230111_2896946.html", "official", "pass", ["identity", "history", "visit"]),
    ("西什库教堂", "北京市文物局西什库教堂资料", "https://wwj.beijing.gov.cn/bjww/362679/362680/482911/xxgkgzdt/1782775/index.html", "official", "pass", ["identity", "history", "architecture"]),
    ("先农坛", "北京市文物局先农坛资料", "https://wwj.beijing.gov.cn/bjww/362760/362767/bwgxh/spzl/326100400/index.html", "official", "pass", ["identity", "history", "highlights"]),
    ("白云观", "北京市西城区人民政府白云观资料", "https://www.bjxch.gov.cn/xcfw/whfw/xxxq/pnidpv736416.html", "official", "pass", ["identity", "history"]),
    ("天宁寺塔", "北京市文物局天宁寺塔资料", "https://wwj.beijing.gov.cn/bjww/wwjzzcslm/1737418/1738088/hxqdyzbpqgzdwwbhdw24/11037112/index.html", "official", "pass", ["identity", "history"]),
    ("北京市规划展览馆", "北京市规划展览馆", "https://www.bjghzlg.com.cn/", "official", "pass", ["identity", "visit"]),
    ("宣武艺园", "北京市公园名录", "https://yllhj.beijing.gov.cn/ggfw/bjsggml/bjsgymlzb/", "official", "limited", ["identity", "address"]),
    ("宣武门教堂", "北京旅游网宣武门教堂资料", "https://s.visitbeijing.com.cn/attraction/118033", "editorial", "pass", ["identity", "history", "visit"]),
    ("广济寺", "北京市文物局广济寺资料", "https://wwj.beijing.gov.cn/bjww/362771/362779/dlpqgzdwwbhdw/523427/index.html", "official", "pass", ["identity", "history"]),
    ("北海公园", "北京市公园名录", "https://yllhj.beijing.gov.cn/ggfw/bjsggml/bjsgymlzb/", "official", "limited", ["identity", "address"]),
    ("恭王府", "文化和旅游部恭王府博物馆", "https://www.pgm.org.cn/", "official", "pass", ["identity", "history", "visit"]),
    ("烟袋斜街", "中国新闻网烟袋斜街资料", "https://www.chinanews.com.cn/cul/2010/11-10/2647001.shtml", "editorial", "limited", ["identity", "history"]),
    ("灵境胡同", "高德地图地点页", "https://www.amap.com/search?query=%E7%81%B5%E5%A2%83%E8%83%A1%E5%90%8C%20%E5%8C%97%E4%BA%AC", "other", "limited", ["identity", "location"]),
    ("白塔寺", "北京市文物局白塔寺资料", "https://wwj.beijing.gov.cn/bjww/wwjzzcslm/1730488/1730490/1730491/index.html", "official", "pass", ["identity", "history", "highlights"]),
    ("大栅栏胡同群", "学习强国大栅栏历史文化街区资料", "https://www.xuexi.cn/935f675382ec17b978332e8ac74c3e06/e43e220633a65f9b6d8b53712cba9caa.html", "editorial", "pass", ["identity", "history"]),
    ("中国美术馆", "中国美术馆", "https://www.namoc.cn/", "official", "pass", ["identity", "history", "visit"]),
    ("地坛", "北京市公园名录", "https://yllhj.beijing.gov.cn/ggfw/bjsggml/bjsgymlzb/", "official", "limited", ["identity", "address"]),
    ("青年湖公园", "北京市公园名录", "https://yllhj.beijing.gov.cn/ggfw/bjsggml/bjsgymlzb/", "official", "limited", ["identity", "address"]),
    ("柳荫公园", "北京市公园名录", "https://yllhj.beijing.gov.cn/ggfw/bjsggml/bjsgymlzb/", "official", "limited", ["identity", "address"]),
    ("北京工人体育场", "北京职工体育服务中心工体简介", "https://gongti.bjzgh.org/gtgk/index.html", "official", "pass", ["identity", "history", "facilities"]),
    ("月坛", "北京市公园名录", "https://yllhj.beijing.gov.cn/ggfw/bjsggml/bjsgymlzb/", "official", "limited", ["identity", "address"]),
    ("北京动物园", "北京动物园", "https://www.bjzoo.com/", "official", "pass", ["identity", "visit"]),
    ("北京天文馆", "北京天文馆简介", "https://www.bjp.org.cn/twgjj/", "official", "pass", ["identity", "history", "visit"]),
    ("北京展览馆", "北京市人民政府北京展览馆资料", "https://english.beijing.gov.cn/investinginbeijing/business_activities/venue_resources/202005/t20200521_1905090.html", "official", "pass", ["identity", "address"]),
    ("人定湖公园", "北京市公园名录", "https://yllhj.beijing.gov.cn/ggfw/bjsggml/bjsgymlzb/", "official", "limited", ["identity", "address"]),
    ("中国地质博物馆", "中国地质博物馆", "https://www.gmc.org.cn/", "official", "pass", ["identity", "history", "visit"]),
    ("金融街", "北京市西城区金融街服务局", "https://www.bjxch.gov.cn/xxgk/jgzn/qgzzfb/qzfjrfwb.html", "official", "limited", ["identity", "district"]),
    ("梅兰芳纪念馆", "文化和旅游部梅兰芳纪念馆资料", "https://www.mct.gov.cn/gywhb/jgsz/zsdw_jgsz/202312/t20231226_950516.htm", "official", "pass", ["identity", "history", "visit"]),
    ("北京喜剧院（百老汇音乐剧场）", "北京市东城区人民政府北京喜剧院资料", "https://www.bjdch.gov.cn/ywdt/dcyw/202310/t20231016_3279884.html", "official", "pass", ["identity", "facilities"]),
    ("南锣鼓巷", "北京市规划和自然资源委员会街巷更新资料", "https://ghzrzyw.beijing.gov.cn/zhengwuxinxi/zxzt/zysj/msycc/lcztbh/202006/t20200601_1912886.html", "official", "pass", ["identity", "history", "conservation"]),
    ("孔庙", "北京市人民政府孔庙和国子监博物馆资料", "https://www.beijing.gov.cn/gate/big5/www.beijing.gov.cn/renwen/rwzyd/gdwh/kmhgzjbwg/202107/t20210705_2429470.html", "official", "pass", ["identity", "history", "highlights"]),
    ("国子监", "北京市人民政府孔庙和国子监博物馆资料", "https://www.beijing.gov.cn/gate/big5/www.beijing.gov.cn/renwen/rwzyd/gdwh/kmhgzjbwg/202107/t20210705_2429470.html", "official", "pass", ["identity", "history", "highlights"]),
    ("五道营胡同", "北京市东城区人民政府五道营资料", "https://www.bjdch.gov.cn/ywdt/dcyw/202504/t20250410_4061611.html", "official", "pass", ["identity", "visitor_context"]),
    ("雍和宫", "北京市人民政府雍和宫资料", "https://www.beijing.gov.cn/renwen/rwzyd/gdwh/yhg/202107/t20210708_2431988.html", "official", "pass", ["identity", "history", "highlights"]),
    ("簋街", "高德地图地点页", "https://www.amap.com/search?query=%E7%B0%8B%E8%A1%97%20%E5%8C%97%E4%BA%AC", "other", "limited", ["identity", "location"]),
    ("陶然亭公园", "北京市人民政府陶然亭公园资料", "https://www.beijing.gov.cn/renwen/rwzyd/lyjq/4A/trtgy/202210/t20221019_2839465.html", "official", "pass", ["identity", "history", "highlights"]),
    ("万寿公园", "北京旅游网万寿公园资料", "https://s.visitbeijing.com.cn/attraction/118246", "editorial", "limited", ["identity", "visit"]),
    ("大观园", "北京市园林绿化局北京大观园资料", "https://yllhj.beijing.gov.cn/ggfw/bjsggml/zlgy/xcq/202206/t20220615_2740920.shtml", "official", "pass", ["identity", "history", "visit"]),
    ("法源寺", "北京市人民政府法源寺资料", "https://www.beijing.gov.cn/gate/big5/www.beijing.gov.cn/renwen/rwzyd/qgzdwwbhdw/fys/202210/t20221028_2846902.html", "official", "pass", ["identity", "history"]),
    ("报国寺", "北京市文物局报国寺资料", "https://wwj.beijing.gov.cn/bjww/362771/362779/dlpqgzdwwbhdw/523391/index.html", "official", "pass", ["identity", "history"]),
]


JINGSHAN_EN = {
    "place_id": "jingshan-park",
    "locale": "en",
    "name": "Jingshan Park",
    "aliases": ["Jingshan", "Prospect Hill"],
    "tags": ["Beijing Central Axis", "imperial garden", "panoramic view", "Wanchun Pavilion", "park"],
    "short_intro": "Directly north of the Forbidden City, Jingshan Park is an imperial garden and a high point on Beijing's Central Axis, known for broad views across the former imperial city.",
    "history": "The hill was created during the construction of the Ming imperial city between 1406 and 1420. During the Qing dynasty, five summit pavilions were built and the Shouhuang Hall complex was moved onto the central axis. Jingshan opened to the public in 1928 and became a public park in 1955.",
    "highlights": ["Panorama from Wanchun Pavilion", "Five summit pavilions", "Shouhuang Hall complex", "Views along Beijing's Central Axis"],
    "visitor_tips": "The climb to Wanchun Pavilion includes uphill paths and steps, so wear comfortable shoes. Clear days offer the best views, and the park works well after a Forbidden City visit.",
    "practical_notes": "Opening hours, last admission and booking rules can change by season. Check the official notice before visiting. The south gate is a short walk from the Forbidden City's Shenwu Gate.",
    "photo_spot_notes": "Wanchun Pavilion is the classic place for a wide view over the Forbidden City. Late afternoon can provide softer light across the central axis.",
}

ENGLISH_LOCALIZATIONS = [
    {
        "place_id": "forbidden-city",
        "locale": "en",
        "name": "The Palace Museum",
        "aliases": ["Forbidden City", "Palace Museum", "Beijing Palace Museum"],
        "tags": ["World Heritage Site", "Ming and Qing palace", "museum", "Beijing Central Axis", "historic architecture"],
        "short_intro": "The Palace Museum occupies the Forbidden City, the imperial palace of the Ming and Qing dynasties, and presents both monumental palace architecture and the former imperial collections.",
        "history": "Construction of the Forbidden City began during the Yongle reign of the Ming dynasty. It served as the imperial palace of the Ming and Qing dynasties. The Palace Museum opened in 1925, bringing the palace buildings, ceremonial spaces and imperial collections together as a museum.",
        "highlights": ["Hall of Supreme Harmony complex", "Palace of Heavenly Purity and the Inner Court", "Gallery of Treasures", "Gallery of Clocks", "palace walls and corner towers"],
        "visitor_tips": "Plan your route before visiting. First-time visitors can follow the central axis, then add the eastern and western palaces, the Gallery of Treasures or the corner towers if time allows.",
        "practical_notes": "Entry normally requires real-name advance booking and visitor numbers are limited. Monday closures and holiday arrangements can change, so check the official notice before visiting. A common route enters through the Meridian Gate and exits through the Gate of Divine Prowess.",
        "photo_spot_notes": "The square by the Gate of Supreme Harmony, the Imperial Garden, the area outside the Gate of Divine Prowess and the corner towers are good places to photograph layered palace roofs, red walls and glazed yellow tiles.",
    },
    JINGSHAN_EN,
    {
        "place_id": "temple-of-heaven",
        "locale": "en",
        "name": "Temple of Heaven Park",
        "aliases": ["Temple of Heaven", "Hall of Prayer for Good Harvests"],
        "tags": ["World Heritage Site", "imperial altar", "Hall of Prayer for Good Harvests", "Beijing Central Axis", "park"],
        "short_intro": "Temple of Heaven Park contains the ceremonial complex where Ming and Qing emperors offered sacrifices to Heaven and prayed for good harvests. It is known for its carefully ordered ritual spaces and the Hall of Prayer for Good Harvests.",
        "history": "The Temple of Heaven was first built during the Yongle reign of the Ming dynasty. Emperors of the Ming and Qing dynasties came here for state ceremonies that included sacrifices to Heaven and prayers for good harvests. Its layout expresses ideas often described as a round heaven and square earth.",
        "highlights": ["Hall of Prayer for Good Harvests", "Circular Mound Altar", "Imperial Vault of Heaven", "Echo Wall", "ancient cypress grove"],
        "visitor_tips": "Entering from the south or east makes it easier to follow the Circular Mound Altar, Imperial Vault of Heaven and Hall of Prayer for Good Harvests in sequence and understand the ceremonial route.",
        "practical_notes": "The grounds are extensive. Combination-ticket and individual-attraction rules can change, so check the official notice before visiting. The Hall of Prayer for Good Harvests area is often crowded during peak season and public holidays.",
        "photo_spot_notes": "The front of the Hall of Prayer for Good Harvests, the Danbi Bridge and the Circular Mound Altar suit strong axial compositions. Early morning usually offers gentler light and fewer visitors.",
    },
]

ENGLISH_SEGMENTS = [
    ("forbidden-city", "overview", 1, "The Forbidden City was the imperial palace of the Ming and Qing dynasties and is now home to the Palace Museum."),
    ("forbidden-city", "history", 2, "The three great halls on the central axis express the ceremonial order of the Outer Court and imperial rule."),
    ("forbidden-city", "highlight", 3, "The Inner Court, palace compounds and galleries reveal aspects of court life and the imperial collections."),
    ("forbidden-city", "practical", 4, "Enter through the Meridian Gate, follow the central axis to understand the hierarchy of the complex, then explore the eastern or western areas according to your interests."),
    ("jingshan-park", "overview", 1, "Jingshan stands directly north of the Forbidden City and forms a prominent high point on Beijing's Central Axis."),
    ("jingshan-park", "history", 2, "The hill was created during construction of the Ming imperial city and later developed as an imperial garden."),
    ("jingshan-park", "highlight", 3, "From Wanchun Pavilion, you can read the courtyards of the Forbidden City and the north to south line of historic Beijing."),
    ("jingshan-park", "practical", 4, "Jingshan is a useful final stop after the Forbidden City, giving you a high level view of the palace complex you have just crossed."),
    ("temple-of-heaven", "overview", 1, "The Temple of Heaven was the ceremonial setting where Ming and Qing emperors offered sacrifices to Heaven and prayed for good harvests."),
    ("temple-of-heaven", "history", 2, "The Circular Mound Altar, Imperial Vault of Heaven and Hall of Prayer for Good Harvests served different parts of the imperial ceremonies."),
    ("temple-of-heaven", "highlight", 3, "The colours, forms and axial layout of the buildings express a relationship between Heaven, the emperor and the human world."),
    ("temple-of-heaven", "practical", 4, "Following the ceremonial route from south to north makes the sequence of spaces easier to understand."),
]


def dollar_quote(value: object, tag: str) -> str:
    return f"${tag}${json.dumps(value, ensure_ascii=False, separators=(',', ':'))}${tag}$"


def build_sql(places: list[dict]) -> str:
    ids = {item["name"]: item["id"] for item in places}
    if set(ids) != {item[0] for item in SOURCES}:
        missing = sorted(set(ids) - {item[0] for item in SOURCES})
        extra = sorted({item[0] for item in SOURCES} - set(ids))
        raise ValueError(f"Source coverage mismatch, missing={missing}, extra={extra}")

    sources = [
        {
            "place_id": ids[name],
            "source_name": source_name,
            "source_url": source_url,
            "source_type": source_type,
            "audit_level": audit_level,
            "fact_scope": fact_scope,
        }
        for name, source_name, source_url, source_type, audit_level, fact_scope in SOURCES
    ]
    pass_ids = [item["place_id"] for item in sources if item["audit_level"] == "pass"]
    source_json = dollar_quote(sources, "sources")
    sample_json = dollar_quote(ENGLISH_LOCALIZATIONS, "samples")
    segment_json = dollar_quote(
        [
            {
                "place_id": place_id,
                "segment_type": segment_type,
                "sequence": sequence,
                "content": content,
            }
            for place_id, segment_type, sequence, content in ENGLISH_SEGMENTS
        ],
        "segments",
    )
    pass_json = dollar_quote(pass_ids, "passes")

    return f"""begin;

with payload as (
  select {source_json}::jsonb as data
), records as (
  select *
  from payload
  cross join lateral jsonb_to_recordset(payload.data) as item(
    place_id text,
    source_name text,
    source_url text,
    source_type text,
    audit_level text,
    fact_scope text[]
  )
)
insert into public.place_sources (
  place_id, source_type, source_name, source_url, fact_scope,
  checked_at, review_due_at, status
)
select
  place_id, source_type, source_name, source_url, fact_scope,
  now(), now() + interval '180 days', 'reviewed'
from records
where not exists (
  select 1 from public.place_sources existing
  where existing.place_id = records.place_id
    and existing.source_url = records.source_url
);

with payload as (
  select {sample_json}::jsonb as data
), records as (
  select *
  from payload
  cross join lateral jsonb_to_recordset(payload.data) as item(
    place_id text, locale text, name text, aliases text[], tags text[],
    short_intro text, history text, highlights text[], visitor_tips text,
    practical_notes text, photo_spot_notes text
  )
)
insert into public.place_localizations (
  place_id, locale, name, aliases, tags, short_intro, history, highlights,
  visitor_tips, practical_notes, photo_spot_notes, review_status, reviewed_at
)
select
  place_id, locale, name, aliases, tags, short_intro, history, highlights,
  visitor_tips, practical_notes, photo_spot_notes, 'reviewed', now()
from records
on conflict (place_id, locale) do update
set name = excluded.name,
    aliases = excluded.aliases,
    tags = excluded.tags,
    short_intro = excluded.short_intro,
    history = excluded.history,
    highlights = excluded.highlights,
    visitor_tips = excluded.visitor_tips,
    practical_notes = excluded.practical_notes,
    photo_spot_notes = excluded.photo_spot_notes,
    review_status = 'reviewed',
    reviewed_at = now(),
    updated_at = now()
where public.place_localizations.review_status <> 'published';

with payload as (
  select {segment_json}::jsonb as data
), records as (
  select *
  from payload
  cross join lateral jsonb_to_recordset(payload.data) as item(
    place_id text, segment_type text, sequence integer, content text
  )
)
insert into public.guide_segments (
  place_id, locale, segment_type, audience, sequence, content, review_status
)
select
  place_id, 'en', segment_type, 'general', sequence, content, 'reviewed'
from records
on conflict (place_id, locale, audience, segment_type, sequence, content_version) do update
set content = excluded.content,
    review_status = 'reviewed',
    updated_at = now()
where public.guide_segments.review_status <> 'published';

update public.place_localizations
set practical_notes = '天安门广场免费参观，进入前需按天安门地区管理委员会的最新要求预约并接受安检。开放和清场时间可能随升旗、重大活动及管理安排调整，出行前应查看官方公告。',
    updated_at = now()
where place_id = 'tiananmen'
  and locale = 'zh-CN'
  and review_status <> 'published';

with pass_ids as (
  select value #>> '{{}}' as place_id
  from jsonb_array_elements({pass_json}::jsonb)
)
update public.place_localizations
set review_status = 'reviewed', reviewed_at = now(), updated_at = now()
where locale = 'zh-CN'
  and review_status <> 'published'
  and place_id in (select place_id from pass_ids);

with pass_ids as (
  select value #>> '{{}}' as place_id
  from jsonb_array_elements({pass_json}::jsonb)
)
update public.guide_segments
set review_status = 'reviewed', updated_at = now()
where locale = 'zh-CN'
  and review_status <> 'published'
  and place_id in (select place_id from pass_ids);

update public.place_localizations
set review_status = 'reviewed', reviewed_at = now(), updated_at = now()
where locale = 'en'
  and review_status <> 'published'
  and place_id in ('forbidden-city', 'temple-of-heaven', 'jingshan-park');

update public.guide_segments
set review_status = 'reviewed', updated_at = now()
where locale = 'en'
  and review_status <> 'published'
  and place_id in ('forbidden-city', 'temple-of-heaven', 'jingshan-park');

insert into public.place_search_documents (
  place_id, locale, section, content, source_ids, content_version, status
)
select
  localization.place_id,
  localization.locale,
  'overview',
  concat_ws(E'\n', localization.name, localization.short_intro, localization.history,
    array_to_string(localization.highlights, E'\n')),
  coalesce(sources.ids, '{{}}'::bigint[]),
  localization.content_version,
  localization.review_status
from public.place_localizations localization
left join lateral (
  select array_agg(source.id order by source.id) as ids
  from public.place_sources source
  where source.place_id = localization.place_id and source.status = 'reviewed'
) sources on true
on conflict (place_id, locale, section, content_version) do update
set content = excluded.content,
    source_ids = excluded.source_ids,
    status = excluded.status,
    embedding = null,
    embedding_model = null,
    updated_at = now()
where public.place_search_documents.status <> 'published';

insert into public.place_search_documents (
  place_id, locale, section, content, source_ids, content_version, status
)
select
  localization.place_id,
  localization.locale,
  'visit',
  concat_ws(E'\n', localization.visitor_tips, localization.practical_notes,
    localization.photo_spot_notes),
  coalesce(sources.ids, '{{}}'::bigint[]),
  localization.content_version,
  localization.review_status
from public.place_localizations localization
left join lateral (
  select array_agg(source.id order by source.id) as ids
  from public.place_sources source
  where source.place_id = localization.place_id and source.status = 'reviewed'
) sources on true
on conflict (place_id, locale, section, content_version) do update
set content = excluded.content,
    source_ids = excluded.source_ids,
    status = excluded.status,
    embedding = null,
    embedding_model = null,
    updated_at = now()
where public.place_search_documents.status <> 'published';

insert into public.place_search_documents (
  place_id, locale, section, content, source_ids, content_version, status
)
select
  localization.place_id,
  localization.locale,
  'guide',
  string_agg(segment.content, E'\n' order by segment.sequence),
  coalesce(sources.ids, '{{}}'::bigint[]),
  localization.content_version,
  localization.review_status
from public.place_localizations localization
join public.guide_segments segment
  on segment.place_id = localization.place_id and segment.locale = localization.locale
left join lateral (
  select array_agg(source.id order by source.id) as ids
  from public.place_sources source
  where source.place_id = localization.place_id and source.status = 'reviewed'
) sources on true
group by localization.place_id, localization.locale, localization.content_version,
  localization.review_status, sources.ids
on conflict (place_id, locale, section, content_version) do update
set content = excluded.content,
    source_ids = excluded.source_ids,
    status = excluded.status,
    embedding = null,
    embedding_model = null,
    updated_at = now()
where public.place_search_documents.status <> 'published';

commit;
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--places",
        type=Path,
        default=Path("data/processed/places.zh-CN.json"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/processed/review-seed.sql"),
    )
    args = parser.parse_args()
    places = json.loads(args.places.read_text(encoding="utf-8"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(build_sql(places), encoding="utf-8")
    print(
        json.dumps(
            {
                "sources": len(SOURCES),
                "passed": sum(item[4] == "pass" for item in SOURCES),
                "limited": sum(item[4] == "limited" for item in SOURCES),
                "english_samples": 3,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
