import type { Phrase } from "../../../../packages/shared/src"

export const paymentGuidance = {
  title: "支付",
  summary: "Alipay 与微信支付使用广泛。国际银行卡不一定处处可用，部分小商户仅支持本地支付方式。",
  note: "各商户接受方式可能变化，下单前请与商家确认。",
}

export const commonPhrases: Phrase[] = [
  { en: "Hello / excuse me", zh: "你好", pinyin: "nǐ hǎo" },
  { en: "Thank you", zh: "谢谢", pinyin: "xiè xie" },
  { en: "How much is it?", zh: "多少钱？", pinyin: "duō shǎo qián?" },
  { en: "Where is the restroom?", zh: "洗手间在哪里？", pinyin: "xǐ shǒu jiān zài nǎ lǐ?" },
  { en: "I need help", zh: "我需要帮助", pinyin: "wǒ xū yào bāng zhù" },
  { en: "I don't understand", zh: "我听不懂", pinyin: "wǒ tīng bù dǒng" },
]

export type LinkIcon = { label: string; url: string }

export const navigationLinks: LinkIcon[] = [
  { label: "Apple Maps", url: "https://maps.apple.com/" },
  { label: "Google Maps", url: "https://www.google.com/maps" },
  { label: "高德地图", url: "https://www.amap.com/" },
]

export const rideLinks: LinkIcon[] = [
  { label: "支付宝", url: "https://www.alipay.com/" },
  { label: "滴滴", url: "https://www.didiglobal.com/" },
  { label: "高德打车", url: "https://www.amap.com/" },
]

export const paymentLinks: LinkIcon[] = [
  { label: "Alipay", url: "https://www.alipay.com/" },
  { label: "WeChat Pay", url: "https://pay.weixin.qq.com/" },
]

export type HotlineCategory = { label: string; items: { label: string; number: string; href: string }[] }

export const hotlineCategories: HotlineCategory[] = [
  {
    label: "常用",
    items: [
      { label: "政务服务便民热线", number: "12345", href: "tel:12345" },
      { label: "铁路客服", number: "12306", href: "tel:12306" },
      { label: "消费者投诉", number: "12315", href: "tel:12315" },
    ],
  },
  {
    label: "景点",
    items: [
      { label: "全国旅游服务热线", number: "12301", href: "tel:12301" },
    ],
  },
  {
    label: "饭店",
    items: [
      { label: "市场监督服务热线", number: "12315", href: "tel:12315" },
    ],
  },
  {
    label: "酒店",
    items: [
      { label: "全国旅游服务热线", number: "12301", href: "tel:12301" },
    ],
  },
]

export const serviceNote = "景点、饭店、酒店的具体服务热线以官方公布为准，入住或订餐前请先向官方确认。"
