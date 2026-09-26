// Helpers for the structured Kuwaiti delivery address
// (منطقة / قطعة / شارع / جادة / منزل / دور / شقة).

export type KuwaitAddressParts = {
  region?: string;
  block?: string;
  street?: string;
  avenue?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  deliveryNotes?: string;
  [key: string]: any;
};

export type RequiredAddressKey = "region" | "block" | "street" | "building";

export const REQUIRED_ADDRESS_FIELDS: { key: RequiredAddressKey; label: string; error: string }[] = [
  { key: "region", label: "المنطقة", error: "اختار المنطقة من القائمة" },
  { key: "block", label: "القطعة", error: "اكتب رقم القطعة" },
  { key: "street", label: "الشارع", error: "اكتب الشارع" },
  { key: "building", label: "المنزل", error: "اكتب رقم المنزل" },
];

const clean = (value: unknown) => String(value ?? "").trim();

/** Required address fields that are still empty. */
export const getMissingAddressFields = (address: KuwaitAddressParts | null | undefined) =>
  REQUIRED_ADDRESS_FIELDS.filter((f) => !clean(address?.[f.key]));

/**
 * Kuwaiti number: 8 digits (optionally prefixed with 965 / +965 / 00965)
 * starting with 2 (landline), 4, 5, 6 or 9.
 */
export const isValidKuwaitPhone = (phone: unknown): boolean => {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("00965")) digits = digits.slice(5);
  else if (digits.length === 11 && digits.startsWith("965")) digits = digits.slice(3);
  return /^[24569]\d{7}$/.test(digits);
};

/**
 * One-line address string built from the structured parts, e.g.
 * "السالمية، قطعة 5، شارع 12، جادة 3، منزل 20، الدور 2، شقة 4".
 * Stored as address.full next to the structured fields for anything that
 * only understands a free-text address.
 */
export const buildKuwaitAddressText = (address: KuwaitAddressParts | null | undefined): string => {
  if (!address) return "";
  const parts = [
    clean(address.region),
    clean(address.block) && `قطعة ${clean(address.block)}`,
    clean(address.street) && `شارع ${clean(address.street)}`,
    clean(address.avenue) && `جادة ${clean(address.avenue)}`,
    clean(address.building) && `منزل ${clean(address.building)}`,
    clean(address.floor) && `الدور ${clean(address.floor)}`,
    clean(address.apartment) && `شقة ${clean(address.apartment)}`,
  ].filter(Boolean);
  return parts.join("، ");
};

/** Google Maps link for the customer's map pin, or "" when no pin was set. */
export const getAddressMapUrl = (address: KuwaitAddressParts | null | undefined): string => {
  if (!address || typeof address !== "object") return "";
  const lat = Number(address.location?.lat ?? address.lat);
  const lng = Number(address.location?.lng ?? address.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

/** Address block used in admin WhatsApp messages (keeps the original line layout). */
export const formatAdminWhatsAppAddress = (address: KuwaitAddressParts | string | null | undefined): string => {
  if (!address) return "";
  if (typeof address === "string") return `\n\n✉️ العنوان:\n${address}`;
  if (!clean(address.region) && !clean(address.block) && clean(address.full)) {
    return `\n\n✉️ العنوان:\n${clean(address.full)}`;
  }
  const lines = [
    `المنطقة: ${address.region ?? ""}`,
    `قطعة: ${address.block ?? ""}`,
    `شارع: ${address.street ?? ""}`,
    clean(address.avenue) && `جادة: ${clean(address.avenue)}`,
    `منزل: ${address.building ?? ""}`,
    clean(address.floor) && `الدور: ${clean(address.floor)}`,
    clean(address.apartment) && `شقة: ${clean(address.apartment)}`,
    getAddressMapUrl(address) && `الموقع: ${getAddressMapUrl(address)}`,
  ].filter(Boolean);
  return `\n\n✉️ العنوان:\n${lines.join("\n")}`;
};
