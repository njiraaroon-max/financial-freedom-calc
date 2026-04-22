// ─── Brochure lookup ──────────────────────────────────────────────────────
// Maps Allianz product codes → public brochure PDFs bundled in /public/brochures.
// These are the official customer-facing product brochures the agent was given
// (April 2026 drop).  Call `getBrochureUrl(code)` from any component that wants
// to surface a "📄 ดูโบรชัวร์" link — the function returns `undefined` when
// no brochure is available for that product, so callers can hide the link
// cleanly.
//
// If you add more PDFs later, drop them in /public/brochures and extend the
// BROCHURES map below.  Filenames are ASCII-only (Thai names and `@` are
// avoided) because Next.js serves /public assets via URL and some CDNs mis-
// handle non-ASCII paths.

/** All known brochures, keyed by Allianz product code.  A single PDF can
 *  legitimately appear under multiple keys (e.g. the First Class Ultra BDMS
 *  brochure covers the IPD, OPD and DENTAL sub-products of that package). */
export const BROCHURES: Record<string, string> = {
  // Life / Savings / Annuity ─ main products
  MSI1808:   "/brochures/MSI1808_Brochure.pdf",
  MDP:       "/brochures/MDP_Brochure.pdf",
  MQR1206:   "/brochures/MQ1206_Brochure.pdf",
  SLA85:     "/brochures/SLA85_Brochure.pdf",
  MWLA9920:  "/brochures/MWLA9920_Brochure.pdf",
  MWLA9906:  "/brochures/MWLA9906_Brochure.pdf",
  T1010:     "/brochures/Term1010_Brochure.pdf",
  MAFA9005:  "/brochures/MAFA9005_Brochure.pdf",
  MAPA85A55: "/brochures/MAPA85A55_Brochure.pdf",

  // Riders — First Class Ultra @ BDMS (brochure covers Platinum + Beyond IPD
  // tiers, OPD แบบ ค, and Dental — one PDF for the whole BDMS package)
  HSMFCPN_BDMS:  "/brochures/MFC_Ultra_BDMS_Brochure.pdf",
  HSMFCBN_BDMS:  "/brochures/MFC_Ultra_BDMS_Brochure.pdf",
  OPDMFCPN_BDMS: "/brochures/MFC_Ultra_BDMS_Brochure.pdf",
  OPDMFCPD:      "/brochures/MFC_Ultra_BDMS_Brochure.pdf",
  DVMFCPN_BDMS:  "/brochures/MFC_Ultra_BDMS_Brochure.pdf",

  // Riders — First Class Ultra @ ALL (brochure covers Platinum + Beyond IPD
  // tiers, OPD, and Dental — one PDF for the whole ALL-network package)
  HSMFCPN_ALL:  "/brochures/MFC_Ultra_ALL_Brochure.pdf",
  HSMFCBN_ALL:  "/brochures/MFC_Ultra_ALL_Brochure.pdf",
  OPDMFCPN_ALL: "/brochures/MFC_Ultra_ALL_Brochure.pdf",
  DVMFCPN_ALL:  "/brochures/MFC_Ultra_ALL_Brochure.pdf",

  // Riders — ปลดล็อค สบายกระเป๋า (IPD + companion OPD แบบ ข)
  HSMHPSK: "/brochures/SabaiKapao_Brochure.pdf",
  OPDMSK:  "/brochures/SabaiKapao_Brochure.pdf",

  // Riders — Daily HB / HB Special / HBCI (hospital compensation family)
  HBCI: "/brochures/HBCI_Brochure.pdf",

  // Riders — CI / Cancer
  CI48B: "/brochures/CI48B_Brochure.pdf",
  CIMC:  "/brochures/CIMC_Brochure.pdf",
  CBN:   "/brochures/CBN_Brochure.pdf",
};

/** Return the public URL for this product's brochure, or undefined.
 *  Accepts upper/lower/mixed case codes and trims whitespace. */
export function getBrochureUrl(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  return BROCHURES[code.trim().toUpperCase()];
}

/** Cheap boolean for conditional rendering: `hasBrochure(code) && <Link …/>`. */
export function hasBrochure(code: string | undefined | null): boolean {
  return !!getBrochureUrl(code);
}

// ─── Known brochure gaps ──────────────────────────────────────────────────
// Preset codes that legitimately have no public brochure. This exists so
// spotcheck can tell *drift* (someone added a new preset without a brochure,
// or shipped a PDF without mapping it) apart from *known absence* (Allianz
// hasn't published a consumer brochure for this product).
//
// Rule of thumb:
//  • Agency-only riders (HB, HBP, CI48) → no consumer brochure, only the
//    Quick Rate agency PDF.  These live permanently in this set.
//  • Products in the same family as one we *do* have (e.g. Beyond Platinum
//    vs. Ultra Platinum) → we simply don't have the PDF yet; remove from
//    this set when the brochure drops.
//  • Main-policy variants we haven't been given (MWLA9021, TM1) → same.
//
// When adding a new rider preset, either drop a PDF into /public/brochures
// and map it above, or add the code here with a one-line reason.
export const KNOWN_BROCHURE_GAPS: Record<string, string> = {
  // Agency Quick Rate products — no consumer-facing brochure exists.
  HB:            "Agency Quick Rate only (ค่ารักษาพยาบาลรายวัน พื้นฐาน)",
  HBP:           "Agency Quick Rate only (ค่ารักษาพยาบาลรายวันพิเศษ)",
  CI48:          "Agency Quick Rate only (โรคร้ายแรง 48 คลาสสิก)",
  // Newer / different tier — brochure not yet in /public/brochures.
  MWLA9021:      "Brochure PDF pending (Whole Life A90/21)",
  TM1:           "Brochure PDF pending (Term ปีต่อปี 1/1)",
  HSMHPDC:       "Brochure PDF pending (ปลดล็อค ดับเบิล แคร์ IPD)",
  OPDMDC:        "Brochure PDF pending (ปลดล็อค ดับเบิล แคร์ OPD)",
};

/** True when this code is either mapped to a brochure or documented as a
 *  known gap.  Useful for drift checks — a code that's *neither* is a bug. */
export function isBrochureStateKnown(code: string | undefined | null): boolean {
  if (!code) return false;
  const upper = code.trim().toUpperCase();
  return upper in BROCHURES || upper in KNOWN_BROCHURE_GAPS;
}
