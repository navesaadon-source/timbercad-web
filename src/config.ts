// Business details shown on the public site. Edit here – no other file needs to change.
export const BUSINESS = {
  name: "TimberCad",
  nameHe: "טימבר קאד",
  owner: "נווה סעדון",
  tagline: "מהתוכנית ועד קובץ מוכן למכונה",
  email: "timbercad.cnc@gmail.com",
  phone: "", // e.g. "050-0000000" – leave empty to hide
  // WhatsApp: number in international format without + (e.g. "972501234567"),
  // or a WhatsApp Business short link (e.g. "https://wa.me/message/ABCDEFG") – the short link hides the number completely.
  whatsapp: "",
  whatsappText: "היי נווה, הגעתי מהאתר של TimberCad ואשמח לשמוע פרטים",
  area: "שירות לנגריות בכל הארץ",
  years: 15,
};

export const ADMIN_EMAILS = ["timbercad.cnc@gmail.com"];

export const whatsappUrl = () =>
  !BUSINESS.whatsapp ? "" : BUSINESS.whatsapp.startsWith("http") ? BUSINESS.whatsapp
    : `https://wa.me/${BUSINESS.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(BUSINESS.whatsappText)}`;
