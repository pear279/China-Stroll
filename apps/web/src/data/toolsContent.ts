import type { Phrase } from "../../../../packages/shared/src"

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
  { label: "Amap", url: "https://www.amap.com/" },
]

export const rideLinks: LinkIcon[] = [
  { label: "Alipay", url: "https://www.alipay.com/" },
  { label: "DiDi", url: "https://www.didiglobal.com/" },
  { label: "Amap Taxi", url: "https://www.amap.com/" },
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
