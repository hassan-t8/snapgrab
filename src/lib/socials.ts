/** Social profiles the admin can link from Settings; shown in the footer and in Google's Organization data. */
export const SOCIALS = [
  { key: "social_facebook", label: "Facebook page", placeholder: "https://facebook.com/yourpage" },
  { key: "social_instagram", label: "Instagram", placeholder: "https://instagram.com/yourname" },
  { key: "social_x", label: "X (Twitter)", placeholder: "https://x.com/yourname" },
  { key: "social_youtube", label: "YouTube channel", placeholder: "https://youtube.com/@yourchannel" },
  { key: "social_tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourname" },
  { key: "social_whatsapp", label: "WhatsApp channel or number", placeholder: "https://whatsapp.com/channel/… or https://wa.me/923001234567" },
  { key: "social_linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/…" },
] as const;

export type SocialKey = (typeof SOCIALS)[number]["key"];
