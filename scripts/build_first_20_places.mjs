#!/usr/bin/env node

import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const root = process.cwd()
const sourcePlacesPath = path.join(root, "data/processed/places.zh-CN.json")
const sourceGuidesPath = path.join(root, "data/processed/guide_segments.zh-CN.json")
const displayManifestPath = path.join(root, "apps/web/public/places/manifest.json")
const curatedPath = path.join(root, "data/curated/first-20-places.json")
const generatedSqlPath = path.join(root, "data/curated/first-20-places.sql")
const migrationPath = path.join(root, "supabase/migrations/20260830072015_publish_first_20_places.sql")
const checkedAt = "2026-08-30T00:00:00Z"
const reviewDueAt = "2026-09-29T00:00:00Z"

const commonVisitEn = {
  openingHoursText: "Opening hours can change. Check the linked official visitor notice before departure.",
  ticketNotes: "Ticket and free-admission rules can change. Use the linked official channel for the current rule.",
  bookingRequired: null,
  bookingUrl: null,
  reservationNotes: "The current dataset does not assert a booking requirement. Confirm it through the official channel before visiting.",
  entranceNotes: "Use the current official visitor entrance and follow on-site signs and security instructions.",
}

const commonVisitZh = {
  openingHoursText: "开放时间可能调整，请在出发前通过所列官方渠道复查最新参观公告。",
  ticketNotes: "门票和免费开放规则可能调整，请以所列官方渠道的当前说明为准。",
  bookingRequired: null,
  bookingUrl: null,
  reservationNotes: "当前资料不对是否必须预约作确定判断，参观前请通过官方渠道确认。",
  entranceNotes: "请使用官方当前公布的游客入口，并遵守现场标识、安检和分流安排。",
}

const definitions = [
  {
    id: "tiananmen", enName: "Tian'anmen Gate", coordinate: [116.391263, 39.907359],
    externalIds: { osm: "relation/8847697" }, addressZh: "北京市东城区西长安街天安门地区", addressEn: "West Chang'an Avenue, Dongcheng District, Beijing",
    official: ["天安门地区管理委员会", "https://tamgw.beijing.gov.cn/zhengwugongkai/tzgg/202111/t20211119_2541156.html"],
    intro: "Tian'anmen Gate stands on Beijing's Central Axis and links the former imperial city with the modern ceremonial square.",
    history: "First built in the Ming dynasty and renamed in the Qing dynasty, the gate became one of Beijing's most recognisable civic landmarks.",
    highlights: ["Tian'anmen Gate", "Golden Water Bridges", "Central Axis views"],
  },
  {
    id: "national-museum-of-china", enName: "National Museum of China", coordinate: [116.3953896, 39.9037459],
    externalIds: { osm: "relation/8607825" }, addressZh: "北京市东城区东长安街16号", addressEn: "16 East Chang'an Avenue, Dongcheng District, Beijing",
    official: ["中国国家博物馆", "https://www.chnmuseum.cn/cg/"],
    intro: "The National Museum of China presents Chinese civilisation, national history and major collections on the east side of Tian'anmen Square.",
    history: "The museum was formed from the former Museum of Chinese History and Museum of the Chinese Revolution and now combines collections, research and public exhibitions.",
    highlights: ["Ancient China galleries", "Major thematic exhibitions", "Tian'anmen Square architecture"],
  },
  {
    id: "zhengyangmen", enName: "Zhengyangmen Gate", coordinate: [116.3916168, 39.8992142],
    externalIds: { osm: "way/25109960" }, addressZh: "北京市东城区前门东大街正阳门", addressEn: "Qianmen East Street, Dongcheng District, Beijing",
    official: ["北京市文物局", "https://wwj.beijing.gov.cn/bjww/362760/362767/bjwwz/ylzs/508861/2023081815303242428.doc"],
    intro: "Zhengyangmen was the principal southern gate of Beijing's inner city and remains a major landmark on the Central Axis.",
    history: "Built in the Ming dynasty, its gatehouse and archery tower marked the ceremonial and commercial approach to the imperial city.",
    highlights: ["Gatehouse", "Archery tower", "Central Axis view toward Qianmen"],
  },
  {
    id: "dashilar-hutong-area", enName: "Dashilar Historic District", coordinate: [116.3901828, 39.8945303],
    externalIds: { osm: "way/30680703" }, addressZh: "北京市西城区大栅栏街及周边胡同", addressEn: "Dashilar Street and surrounding hutongs, Xicheng District, Beijing",
    official: ["学习强国大栅栏历史文化街区资料", "https://www.xuexi.cn/935f675382ec17b978332e8ac74c3e06/e43e220633a65f9b6d8b53712cba9caa.html"],
    intro: "Dashilar is a historic commercial district south of Qianmen, known for long-running shops, theatres and dense hutong lanes.",
    history: "Its commercial importance grew outside the old city gate during the Ming and Qing periods, creating a distinctive mix of retail streets and residential alleys.",
    highlights: ["Historic shopfronts", "Dashilar Street", "Hutong lanes"],
  },
  {
    id: "forbidden-city", enName: "The Palace Museum", coordinate: [116.3907694, 39.9172757],
    externalIds: { osm: "relation/9511883" }, addressZh: "北京市东城区景山前街4号", addressEn: "4 Jingshan Front Street, Dongcheng District, Beijing",
    official: ["故宫博物院", "https://www.dpm.org.cn/"],
    intro: "The Palace Museum occupies the Forbidden City, the imperial palace of the Ming and Qing dynasties.",
    history: "Construction began during the Yongle reign of the Ming dynasty. The palace later became a museum in 1925, bringing monumental architecture and imperial collections together.",
    highlights: ["Hall of Supreme Harmony", "Inner Court", "Imperial Garden", "Palace walls and corner towers"],
  },
  {
    id: "jingshan-park", enName: "Jingshan Park", coordinate: [116.3903973, 39.9244589],
    externalIds: { osm: "way/29201967" }, addressZh: "北京市西城区景山西街44号", addressEn: "44 Jingshan West Street, Xicheng District, Beijing",
    official: ["北京中轴线官网景山资料", "https://www.bjaxiscloud.com.cn/web/address/details/1558142840655642625.html"],
    intro: "Jingshan Park is the Central Axis viewpoint immediately north of the Forbidden City.",
    history: "The hill was formed during construction of the Ming imperial city and later developed as a royal garden with five summit pavilions.",
    highlights: ["Wanchun Pavilion panorama", "Five summit pavilions", "Central Axis views"],
  },
  {
    id: "drum-and-bell-towers", enName: "Beijing Drum and Bell Towers", coordinate: [116.3896927, 39.94018335],
    externalIds: { osm_drum_tower: "way/267371087", osm_bell_tower: "way/425993664" }, addressZh: "北京市东城区钟楼湾胡同及鼓楼东大街交界区域", addressEn: "Zhonglouwan Hutong and Gulou East Street, Dongcheng District, Beijing",
    official: ["北京市文物局北京中轴线资料", "https://wwj.beijing.gov.cn/bjww/362760/362767/bjwwz/ylzs/508861/2023060916180423846.doc"],
    intro: "The Drum and Bell Towers formed Beijing's historic civic timekeeping centre at the northern end of the old Central Axis.",
    history: "Their drums and bell regulated daily urban time in the imperial capital and remain closely connected to the surrounding hutong neighbourhoods.",
    highlights: ["Drum Tower", "Bell Tower", "Northern Central Axis", "Surrounding hutongs"],
  },
  {
    id: "temple-of-heaven", enName: "Temple of Heaven Park", coordinate: [116.4028716, 39.8799066],
    externalIds: { osm: "way/24824550" }, addressZh: "北京市东城区天坛东路甲1号", addressEn: "1A Tiantan East Road, Dongcheng District, Beijing",
    official: ["北京市园林绿化局天坛公园资料", "https://yllhj.beijing.gov.cn/ggfw/bjsggml/lsmy/lsmy2/202206/t20220620_2746558.shtml"],
    intro: "Temple of Heaven Park contains the ceremonial complex where Ming and Qing emperors offered sacrifices to Heaven and prayed for good harvests.",
    history: "First built during the Yongle reign, its layout and architecture express the ritual order of the imperial state and ideas of heaven and earth.",
    highlights: ["Hall of Prayer for Good Harvests", "Circular Mound Altar", "Imperial Vault of Heaven"],
  },
  {
    id: "beihai-park", enName: "Beihai Park", coordinate: [116.3824632, 39.9264023],
    externalIds: { osm: "way/366464114" }, addressZh: "北京市西城区文津街1号", addressEn: "1 Wenjin Street, Xicheng District, Beijing",
    official: ["北京市公园名录", "https://yllhj.beijing.gov.cn/ggfw/bjsggml/bjsgymlzb/"],
    intro: "Beihai Park is a historic imperial garden centred on a lake, Qionghua Island and the White Dagoba.",
    history: "Developed over successive dynasties, the garden preserves layers of imperial landscape design, religious architecture and lakeside recreation.",
    highlights: ["White Dagoba", "Qionghua Island", "Nine-Dragon Wall", "Lake views"],
  },
  {
    id: "prince-gong-mansion", enName: "Prince Kung's Palace Museum", coordinate: [116.380112, 39.935255],
    externalIds: { osm: "way/26514871" }, addressZh: "北京市西城区前海西街17号", addressEn: "17 Qianhai West Street, Xicheng District, Beijing",
    official: ["文化和旅游部恭王府博物馆", "https://www.pgm.org.cn/"],
    intro: "Prince Kung's Palace is one of Beijing's best-preserved Qing princely residences, combining formal courtyards with an extensive garden.",
    history: "Associated first with Heshen and later Prince Gong Yixin, the complex illustrates Qing elite residence, ceremony and garden design.",
    highlights: ["Residential courtyards", "Rear garden", "Qing princely architecture"],
  },
  {
    id: "lama-temple", enName: "Yonghe Temple", coordinate: [116.4110049, 39.9455793],
    externalIds: { osm: "way/24825312" }, addressZh: "北京市东城区雍和宫大街12号", addressEn: "12 Yonghegong Street, Dongcheng District, Beijing",
    official: ["北京市人民政府雍和宫资料", "https://www.beijing.gov.cn/renwen/rwzyd/gdwh/yhg/202107/t20210708_2431988.html"],
    intro: "Yonghe Temple is a major Tibetan Buddhist monastery in Beijing with strong connections to the Qing imperial court.",
    history: "The site began as a prince's residence, became an imperial palace and was converted into a Tibetan Buddhist monastery during the Qing dynasty.",
    highlights: ["Wanfu Pavilion", "Falun Hall", "Han and Tibetan architectural features"],
  },
  {
    id: "confucius-temple", enName: "Beijing Temple of Confucius", coordinate: [116.4083074, 39.9451172],
    externalIds: { osm: "way/24825402" }, addressZh: "北京市东城区国子监街13号", addressEn: "13 Guozijian Street, Dongcheng District, Beijing",
    official: ["北京市人民政府孔庙和国子监博物馆资料", "https://www.beijing.gov.cn/gate/big5/www.beijing.gov.cn/renwen/rwzyd/gdwh/kmhgzjbwg/202107/t20210705_2429470.html"],
    intro: "Beijing's Temple of Confucius was the state ritual site for honouring Confucius during the Yuan, Ming and Qing dynasties.",
    history: "Founded in the Yuan dynasty and expanded later, it forms a connected ritual and educational complex with the neighbouring Imperial Academy.",
    highlights: ["Dacheng Hall", "Steles of successful scholars", "Historic cypress trees"],
  },
  {
    id: "guozijian", enName: "Imperial Academy (Guozijian)", coordinate: [116.4069724, 39.9458544],
    externalIds: { osm: "way/30784273" }, addressZh: "北京市东城区国子监街15号", addressEn: "15 Guozijian Street, Dongcheng District, Beijing",
    official: ["北京市人民政府孔庙和国子监博物馆资料", "https://www.beijing.gov.cn/gate/big5/www.beijing.gov.cn/renwen/rwzyd/gdwh/kmhgzjbwg/202107/t20210705_2429470.html"],
    intro: "Guozijian was the highest state educational institution of imperial China in Beijing.",
    history: "Established in the Yuan dynasty and used through the Ming and Qing periods, the academy combined official education, lectures and state ritual.",
    highlights: ["Biyong Hall", "Glazed archway", "Yilun Hall", "Imperial education spaces"],
  },
  {
    id: "ditan-park", enName: "Temple of Earth Park", coordinate: [116.4098147, 39.951435],
    externalIds: { osm: "way/78050667" }, addressZh: "北京市东城区安定门外大街甲2号", addressEn: "2A Andingmen Outer Street, Dongcheng District, Beijing",
    official: ["北京市公园名录", "https://yllhj.beijing.gov.cn/ggfw/bjsggml/bjsgymlzb/"],
    intro: "The Temple of Earth was the imperial altar for sacrifices to the Earth and is now a public park with surviving ritual spaces.",
    history: "Built in the Ming dynasty, its square altar and related buildings formed the northern counterpart to the Temple of Heaven in Beijing's ritual landscape.",
    highlights: ["Fangze Altar", "Imperial ritual spaces", "Ancient cypress trees"],
  },
  {
    id: "xiannongtan", enName: "Altar of Agriculture", coordinate: [116.3852186, 39.8756496],
    externalIds: { osm: "way/587608667" }, addressZh: "北京市西城区东经路21号", addressEn: "21 Dongjing Road, Xicheng District, Beijing",
    official: ["北京市文物局先农坛资料", "https://wwj.beijing.gov.cn/bjww/362760/362767/bwgxh/spzl/326100400/index.html"],
    intro: "The Altar of Agriculture was the imperial site for rituals honouring farming and now also houses the Beijing Ancient Architecture Museum.",
    history: "Founded in the Ming dynasty, the complex linked state ceremony with agriculture and preserves important ritual buildings and architectural exhibits.",
    highlights: ["Taisui Hall", "Imperial agricultural ritual sites", "Ancient architecture displays"],
  },
  {
    id: "nanluoguxiang", enName: "Nanluoguxiang", coordinate: [116.3969002, 39.9357674],
    externalIds: { osm: "way/4922662" }, addressZh: "北京市东城区南锣鼓巷及周边胡同", addressEn: "Nanluoguxiang and surrounding hutongs, Dongcheng District, Beijing",
    official: ["北京市规划和自然资源委员会街巷更新资料", "https://ghzrzyw.beijing.gov.cn/zhengwuxinxi/zxzt/zysj/msycc/lcztbh/202006/t20200601_1912886.html"],
    intro: "Nanluoguxiang is a well-known hutong district where historic lanes and courtyard neighbourhoods meet shops and cultural venues.",
    history: "The district retains a street pattern associated with the Yuan capital and has evolved through conservation, residential use and visitor-oriented commerce.",
    highlights: ["Hutong street pattern", "Courtyard gateways", "Side-lane neighbourhoods"],
  },
  {
    id: "national-art-museum-of-china", enName: "National Art Museum of China", coordinate: [116.4027108, 39.9238348],
    externalIds: { osm: "way/131710744" }, addressZh: "北京市东城区五四大街1号", addressEn: "1 Wusi Street, Dongcheng District, Beijing",
    official: ["中国美术馆", "https://www.namoc.cn/"],
    intro: "The National Art Museum of China collects, researches and exhibits modern and contemporary Chinese visual art.",
    history: "Opened as a major national cultural institution in the twentieth century, the museum supports exhibitions, collections, research and public education.",
    highlights: ["Collection exhibitions", "Temporary art exhibitions", "Public cultural programmes"],
  },
  {
    id: "beijing-zoo", enName: "Beijing Zoo", coordinate: [116.3295423, 39.941041],
    externalIds: { osm: "way/29222967" }, addressZh: "北京市西城区西直门外大街137号", addressEn: "137 Xizhimen Outer Street, Xicheng District, Beijing",
    official: ["北京动物园", "https://www.bjzoo.com/"],
    intro: "Beijing Zoo is a major family attraction and zoological education site, best known internationally for its giant pandas.",
    history: "Its origins reach back to a late-Qing agricultural and animal exhibition site, later developing into a large urban zoo with conservation and education roles.",
    highlights: ["Giant pandas", "Animal habitats", "Family science education"],
  },
  {
    id: "beijing-planetarium", enName: "Beijing Planetarium", coordinate: [116.3308878, 39.9356769],
    externalIds: { osm: "way/78051172" }, addressZh: "北京市西城区西直门外大街138号", addressEn: "138 Xizhimen Outer Street, Xicheng District, Beijing",
    official: ["北京天文馆", "https://www.bjp.org.cn/twgjj/"],
    intro: "Beijing Planetarium provides astronomy exhibitions, dome programmes and science education for families and general visitors.",
    history: "One of China's early large public astronomy institutions, it has long combined sky theatre presentations, exhibitions and educational activities.",
    highlights: ["Planetarium theatre", "Dome cinema", "Astronomy exhibitions", "Interactive science displays"],
  },
  {
    id: "beijing-planning-exhibition-hall", enName: "Beijing Planning Exhibition Hall", coordinate: [116.395157, 39.89841],
    externalIds: { osm: "way/194280230" }, addressZh: "北京市东城区前门东大街20号", addressEn: "20 Qianmen East Street, Dongcheng District, Beijing",
    official: ["北京市规划展览馆", "https://www.bjghzlg.com.cn/"],
    intro: "Beijing Planning Exhibition Hall explains the capital's historical form, urban planning and future development through models and displays.",
    history: "The hall serves as a public education venue for Beijing's urban evolution, planning framework, Central Axis and major development areas.",
    highlights: ["Large city model", "Central Axis displays", "Urban development exhibitions"],
  },
]

function osmUrls(externalIds) {
  return Object.values(externalIds).map((value) => `https://www.openstreetmap.org/${value}`)
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

async function buildPackage() {
  const [sourcePlaces, sourceGuides, displayManifest] = await Promise.all([
    readFile(sourcePlacesPath, "utf8").then(JSON.parse),
    readFile(sourceGuidesPath, "utf8").then(JSON.parse),
    readFile(displayManifestPath, "utf8").then(JSON.parse),
  ])
  const displayIds = new Set(displayManifest.images.map((image) => image.placeId))
  const places = definitions.map((definition) => {
    const zh = sourcePlaces.find((place) => place.id === definition.id)
    if (!zh) throw new Error(`Missing Chinese source content for ${definition.id}`)
    if (!displayIds.has(definition.id)) throw new Error(`Missing display illustration for ${definition.id}`)
    const guidesZh = sourceGuides.filter((guide) => guide.place_id === definition.id).map((guide) => ({
      locale: "zh-CN", segmentType: guide.segment_type, audience: guide.audience, sequence: guide.sequence,
      title: null, content: guide.content,
    }))
    return {
      id: definition.id,
      categoryCode: zh.category_code,
      durationMinutes: zh.recommended_duration_minutes,
      coordinate: {
        longitude: definition.coordinate[0], latitude: definition.coordinate[1], system: "WGS84",
        checkedAt, externalIds: definition.externalIds, sourceUrls: osmUrls(definition.externalIds),
      },
      localizations: [
        {
          locale: "zh-CN", name: zh.name, aliases: zh.aliases, tags: zh.tags, shortIntro: zh.short_intro,
          history: zh.history, highlights: zh.highlights, visitorTips: zh.visitor_tips,
          practicalNotes: "开放、票务和预约等动态信息请查看下方已核对渠道并在出发前复查。",
          photoSpotNotes: zh.photo_spot_notes,
        },
        {
          locale: "en", name: definition.enName, aliases: [], tags: zh.tags, shortIntro: definition.intro,
          history: definition.history, highlights: definition.highlights,
          visitorTips: "Plan the visit around the current official notice, allow time for security checks and follow on-site visitor rules.",
          practicalNotes: "Opening, ticket and booking information can change. Recheck the linked official channel before departure.",
          photoSpotNotes: "Follow on-site photography signs and avoid flash, restricted interiors and disruption to residents or worshippers.",
        },
      ],
      visitInformation: [
        { locale: "zh-CN", address: definition.addressZh, ...commonVisitZh },
        { locale: "en", address: definition.addressEn, ...commonVisitEn },
      ].map((visit) => ({ ...visit, openingHours: { timeZone: "Asia/Shanghai", weekly: [], exceptions: [] }, checkedAt, reviewDueAt })),
      sources: [
        { key: "official", type: "official", name: definition.official[0], url: definition.official[1], factScope: ["identity", "history", "visit_recheck"] },
        ...osmUrls(definition.externalIds).map((url, index) => ({ key: `coordinate-${index + 1}`, type: "other", name: "OpenStreetMap display object", url, factScope: ["display_coordinate"] })),
      ].map((source) => ({ ...source, checkedAt, reviewDueAt })),
      guides: [
        ...guidesZh,
        { locale: "en", segmentType: "overview", audience: "general", sequence: 1, title: "Thirty-second introduction", content: definition.intro },
        { locale: "en", segmentType: "history", audience: "general", sequence: 2, title: "Why it matters", content: definition.history },
        { locale: "en", segmentType: "highlight", audience: "general", sequence: 3, title: "What to notice", content: definition.highlights.join("; ") },
      ],
      displayImage: `/places/${definition.id}.webp`,
    }
  })
  return { version: 1, checkedAt, reviewDueAt, places }
}

function validate(payload) {
  if (payload.places.length !== 20 || new Set(payload.places.map((place) => place.id)).size !== 20) throw new Error("Curated package must contain exactly 20 unique places")
  for (const place of payload.places) {
    if (place.coordinate.system !== "WGS84" || place.coordinate.latitude < 39.7 || place.coordinate.latitude > 40.1 || place.coordinate.longitude < 116.2 || place.coordinate.longitude > 116.6) throw new Error(`Invalid Beijing WGS84 coordinate for ${place.id}`)
    if (!Object.keys(place.coordinate.externalIds).length || !place.coordinate.sourceUrls.every((url) => url.startsWith("https://www.openstreetmap.org/"))) throw new Error(`Untraceable coordinate for ${place.id}`)
    if (place.localizations.length !== 2 || !place.localizations.some((item) => item.locale === "zh-CN") || !place.localizations.some((item) => item.locale === "en")) throw new Error(`Missing localization for ${place.id}`)
    if (place.visitInformation.length !== 2 || place.visitInformation.some((item) => !item.address || !item.openingHoursText || !item.ticketNotes)) throw new Error(`Incomplete visit information for ${place.id}`)
    if (!place.sources.some((source) => source.type === "official") || place.sources.some((source) => !source.url.startsWith("https://"))) throw new Error(`Missing HTTPS official source for ${place.id}`)
    if (!place.guides.some((guide) => guide.locale === "zh-CN") || !place.guides.some((guide) => guide.locale === "en")) throw new Error(`Missing guides for ${place.id}`)
  }
}

function jsonLiteral(data, tag) {
  return `$${tag}$${JSON.stringify(data)}$${tag}$::jsonb`
}

function buildSql(payload) {
  const places = payload.places.map((place) => ({
    id: place.id, category_code: place.categoryCode, latitude: place.coordinate.latitude, longitude: place.coordinate.longitude,
    recommended_duration_minutes: place.durationMinutes, external_ids: place.coordinate.externalIds,
    coordinate_system: place.coordinate.system, coordinates_checked_at: place.coordinate.checkedAt,
  }))
  const localizations = payload.places.flatMap((place) => place.localizations.map((item) => ({ place_id: place.id, ...item })))
  const sources = payload.places.flatMap((place) => place.sources.map((item) => ({ place_id: place.id, ...item })))
  const visits = payload.places.flatMap((place) => place.visitInformation.map((item) => ({ place_id: place.id, ...item })))
  const guides = payload.places.flatMap((place) => place.guides.map((item) => ({ place_id: place.id, ...item })))
  return `-- Generated by scripts/build_first_20_places.mjs. Do not edit by hand.\n\nbegin;\n\n` +
`with records as (select * from jsonb_to_recordset(${jsonLiteral(places, "places")}) as x(id text, category_code text, latitude double precision, longitude double precision, recommended_duration_minutes integer, external_ids jsonb, coordinate_system text, coordinates_checked_at timestamptz))\n` +
`insert into public.places (id, category_code, latitude, longitude, recommended_duration_minutes, external_ids, coordinate_system, coordinates_checked_at, status) select id, category_code, latitude, longitude, recommended_duration_minutes, external_ids, coordinate_system, coordinates_checked_at, 'published' from records on conflict (id) do update set category_code=excluded.category_code, latitude=excluded.latitude, longitude=excluded.longitude, recommended_duration_minutes=excluded.recommended_duration_minutes, external_ids=excluded.external_ids, coordinate_system=excluded.coordinate_system, coordinates_checked_at=excluded.coordinates_checked_at, status='published', updated_at=now();\n\n` +
`with records as (select * from jsonb_to_recordset(${jsonLiteral(localizations, "localizations")}) as x(place_id text, locale text, name text, aliases text[], tags text[], \"shortIntro\" text, history text, highlights text[], \"visitorTips\" text, \"practicalNotes\" text, \"photoSpotNotes\" text))\n` +
`insert into public.place_localizations (place_id, locale, name, aliases, tags, short_intro, history, highlights, visitor_tips, practical_notes, photo_spot_notes, review_status, reviewed_at) select place_id, locale, name, aliases, tags, \"shortIntro\", history, highlights, \"visitorTips\", \"practicalNotes\", \"photoSpotNotes\", 'published', '${checkedAt}'::timestamptz from records on conflict (place_id, locale) do update set name=excluded.name, aliases=excluded.aliases, tags=excluded.tags, short_intro=excluded.short_intro, history=excluded.history, highlights=excluded.highlights, visitor_tips=excluded.visitor_tips, practical_notes=excluded.practical_notes, photo_spot_notes=excluded.photo_spot_notes, review_status='published', reviewed_at=excluded.reviewed_at, updated_at=now();\n\n` +
`with records as (select * from jsonb_to_recordset(${jsonLiteral(sources, "sources")}) as x(place_id text, key text, type text, name text, url text, \"factScope\" text[], \"checkedAt\" timestamptz, \"reviewDueAt\" timestamptz)) insert into public.place_sources (place_id, source_type, source_name, source_url, fact_scope, checked_at, review_due_at, status) select place_id, type, name, url, \"factScope\", \"checkedAt\", \"reviewDueAt\", 'published' from records r where not exists (select 1 from public.place_sources s where s.place_id=r.place_id and s.source_url=r.url);\n` +
`update public.place_sources s set status='published', checked_at='${checkedAt}'::timestamptz, review_due_at='${reviewDueAt}'::timestamptz from jsonb_to_recordset(${jsonLiteral(sources, "source_updates")}) as r(place_id text, url text) where s.place_id=r.place_id and s.source_url=r.url;\n\n` +
`with records as (select * from jsonb_to_recordset(${jsonLiteral(visits, "visits")}) as x(place_id text, locale text, address text, \"openingHoursText\" text, \"openingHours\" jsonb, \"ticketNotes\" text, \"bookingRequired\" boolean, \"bookingUrl\" text, \"reservationNotes\" text, \"entranceNotes\" text, \"checkedAt\" timestamptz, \"reviewDueAt\" timestamptz)) insert into public.place_visit_information (place_id, locale, address, opening_hours_text, opening_hours, ticket_notes, booking_required, booking_url, reservation_notes, entrance_notes, checked_at, review_due_at, status) select place_id, locale, address, \"openingHoursText\", \"openingHours\", \"ticketNotes\", \"bookingRequired\", \"bookingUrl\", \"reservationNotes\", \"entranceNotes\", \"checkedAt\", \"reviewDueAt\", 'published' from records on conflict (place_id, locale) do update set address=excluded.address, opening_hours_text=excluded.opening_hours_text, opening_hours=excluded.opening_hours, ticket_notes=excluded.ticket_notes, booking_required=excluded.booking_required, booking_url=excluded.booking_url, reservation_notes=excluded.reservation_notes, entrance_notes=excluded.entrance_notes, checked_at=excluded.checked_at, review_due_at=excluded.review_due_at, status='published', updated_at=now();\n` +
`insert into public.place_visit_information_sources (place_id, locale, source_id) select v.place_id, v.locale, s.id from public.place_visit_information v join public.place_sources s on s.place_id=v.place_id and s.status='published' where v.place_id in (${payload.places.map((place) => `'${place.id}'`).join(",")}) on conflict do nothing;\n\n` +
`with records as (select * from jsonb_to_recordset(${jsonLiteral(guides, "guides")}) as x(place_id text, locale text, \"segmentType\" text, audience text, sequence integer, title text, content text)) insert into public.guide_segments (place_id, locale, segment_type, audience, sequence, title, content, review_status, content_version) select place_id, locale, \"segmentType\", audience, sequence, title, content, 'published', 1 from records on conflict (place_id, locale, audience, segment_type, sequence, content_version) do update set title=excluded.title, content=excluded.content, review_status='published', updated_at=now();\n\ncommit;\n`
}

async function build() {
  const payload = await buildPackage()
  validate(payload)
  await mkdir(path.dirname(curatedPath), { recursive: true })
  const json = `${JSON.stringify(payload, null, 2)}\n`
  const sql = buildSql(payload)
  await writeFile(curatedPath, json)
  await writeFile(generatedSqlPath, sql)
  console.log(`Built ${payload.places.length} curated places (${sha256(json).slice(0, 12)})`)
}

async function verify() {
  const payload = JSON.parse(await readFile(curatedPath, "utf8"))
  validate(payload)
  const regenerated = buildSql(payload)
  const currentSql = await readFile(generatedSqlPath, "utf8")
  if (regenerated !== currentSql) throw new Error("Generated first-20 SQL is stale; run npm run places:prepare")
  const migrationSql = await readFile(migrationPath, "utf8")
  if (currentSql !== migrationSql) throw new Error("First-20 migration is stale; copy the generated SQL into the migration")
  console.log(`Verified ${payload.places.length} curated places and deterministic SQL`)
}

const command = process.argv[2] ?? "verify"
if (command === "build") await build()
else if (command === "verify") await verify()
else throw new Error(`Unknown command ${command}`)
