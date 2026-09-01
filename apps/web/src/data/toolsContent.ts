import type { Phrase } from "../../../../packages/shared/src"

export const paymentGuidance = {
  title: "Payments in China",
  summary:
    "Alipay and WeChat Pay are widely accepted. International bank cards may not work everywhere, and some smaller merchants accept only local payment methods.",
  steps: [
    "Set up Alipay or WeChat Pay before you travel and link an accepted card or top-up method.",
    "Carry a backup payment method and some cash for small merchants and transport.",
    "Keep your passport handy: identity checks may be required for some payments or top-ups.",
  ],
  note:
    "Acceptance varies by merchant and can change. Confirm the payment method with the merchant before ordering.",
}

export const commonPhrases: Phrase[] = [
  { en: "Hello / excuse me", zh: "你好", pinyin: "nǐ hǎo" },
  { en: "Thank you", zh: "谢谢", pinyin: "xiè xie" },
  { en: "How much is it?", zh: "多少钱？", pinyin: "duō shǎo qián?" },
  { en: "Where is the restroom?", zh: "洗手间在哪里？", pinyin: "xǐ shǒu jiān zài nǎ lǐ?" },
  { en: "I need help", zh: "我需要帮助", pinyin: "wǒ xū yào bāng zhù" },
  { en: "I don't understand", zh: "我听不懂", pinyin: "wǒ tīng bù dǒng" },
]

export const serviceContacts = {
  emergency: [
    { label: "Police", number: "110", href: "tel:110" },
    { label: "Fire", number: "119", href: "tel:119" },
    { label: "Medical", number: "120", href: "tel:120" },
  ],
  helplines: [
    { label: "Government service hotline", number: "12345", href: "tel:12345" },
    { label: "China Railway", number: "12306", href: "tel:12306" },
  ],
  note:
    "For a hotel, restaurant, or attraction service line, verify the number on its official listing before calling.",
}

export const exchangeCurrencies = [
  { code: "CNY", label: "Chinese yuan (CNY)" },
  { code: "USD", label: "US dollar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "GBP", label: "British pound (GBP)" },
  { code: "JPY", label: "Japanese yen (JPY)" },
  { code: "AUD", label: "Australian dollar (AUD)" },
] as const
