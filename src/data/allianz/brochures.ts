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

  // Riders — First Class Ultra Platinum @ BDMS (IPD + OPD (ค) + Dental share one brochure)
  HSMFCPN_BDMS:  "/brochures/MFC_Ultra_BDMS_Brochure.pdf",
  OPDMFCPN_BDMS: "/brochures/MFC_Ultra_BDMS_Brochure.pdf",
  OPDMFCPD:      "/brochures/MFC_Ultra_BDMS_Brochure.pdf",
  DVMFCPN_BDMS:  "/brochures/MFC_Ultra_BDMS_Brochure.pdf",

  // Riders — First Class Ultra Platinum @ ALL (IPD + OPD + Dental share one brochure)
  HSMFCPN_ALL:  "/brochures/MFC_Ultra_ALL_Brochure.pdf",
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
