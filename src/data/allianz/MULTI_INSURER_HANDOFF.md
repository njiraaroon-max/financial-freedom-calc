# Multi-Insurer Premium Tool — Session Handoff

> **Status:** Paused 2026-04-23 — to resume in a later session.
> **Context:** We inspected two versions of AVP's internal premium tool to
> assess whether it can bootstrap a multi-insurer catalog beyond the
> current Allianz-only repo.

## Files referenced (outside repo, at project root)

| File | Date | Use |
|---|---|---|
| `AVP_INS_Premium_Tool_Ver.6.18.xlsm` | 22/10/2024 | Old version — superseded |
| `AVP_INS_Premium_Tool_2510.xlsm` | Oct 2025 (content = v2505, May 2025) | **Current reference** |

Both are .xlsm (VBA enabled), 16 sheets, same architecture.

## Architecture understood

5-layer engine the Excel implements:

1. **`DATA_List`** (hidden, 204×29 in v2510) — master catalog: company × category × product name → lookup code (e.g. `AZAY_T10_M`, `AIA_HH_1M_F`)
2. **`<INSURER>_DATA`** sheets (8 total) — rate tables, rows = age 0–99, cols = product × gender, stored as Excel named ranges
3. **`AGE_CAL`** — 3 age-calculation methods per insurer (critical business logic):
   - `AGE_A` ปีบริบูรณ์ / `DATEDIF(birth,today,"Y")` → AIA, FWD, TKM, AXA
   - `AGE_B` ปีปัดเศษ 6mo+ → BLA, TLI, **AZAY**
   - `AGE_C` ปีปัจจุบัน−ปีเกิด → MTL
4. **`CALCULATION`** (284×23) — dynamic lookup using `INDEX(INDIRECT(OFFSET(DATA_List,…)))`
5. **`ForUse`** (241×25) — presentation layer, ค.ศ↔พ.ศ conversion, 30-year projection

## Insurer data inventory (v2510)

| Insurer | Cols | Notes |
|---|---|---|
| MTL | 474 | Largest — most active product line |
| TLI | 295 | Grew +60 cols since v6.18 |
| AIA | 285 | +10 cols |
| AZAY | 259 | +6 cols (added MWLA9920 = A99/20 Par, HBCI split) |
| BLA | 241 | |
| FWD | 204 | +49 cols |
| AXA | 193 | |
| TKM | 77 | Smallest; not updated since v6.18 |

## Allianz drift check vs current repo

**v2505/v2504 changelog explicitly says AZAY = "ไม่มีความเปลี่ยนแปลง"** → repo `premium_rates.json` + `brochures.ts` are still valid; no re-audit needed for Allianz rates.

The only Allianz additions since v6.18:
- `My Whole Life (A99/20) Par` → already in repo as `MWLA9920` ✅
- `HBCI` split into its own column → already in repo ✅

## Product gap vs repo `BROCHURES`

AZAY_DATA products NOT in repo brochures map:
- A85/10, A85/15, A85/25 (SLA85-family variants)
- Double Care 1/2/3/DD (= HSMHPDC — currently listed in `KNOWN_BROCHURE_GAPS`)
- CI48 Beyond
- AI, ADD, ADB (accident riders อ.1/2/3)
- TRC, TRN (term convertible)
- HS_S (hospital benefit)
- CB (legacy Cancer, pre-CBN)

Repo has but Excel missing (post-Oct-2025 launches):
- MSI1808, MQR1206
- MAFA9005, MAPA85A55
- CIMC
- HSMFCPN_ALL/BDMS + OPDMFCPN_ALL/BDMS + DVMFCPN_* (First Class Ultra BDMS/ALL split)
- HSMHPSK, OPDMSK (Sabai Kapao)

## Decision point reached (unanswered)

User was asked to choose the next step:

- **(A)** Phase 1 full extract (1–2 days): DATA_List → JSON catalog, port AGE_CAL to `src/lib/insurance/ageConvention.ts`, port `ข้อควรทราบ` → `cross-rider-rules.json`, verify AZAY against repo
- **(B)** AZAY v2510 deep diff vs repo (half day) — confirm no drift before scaling
- **(C)** Extract MTL_DATA first (biggest, 474 cols) — add new insurer immediately
- **(D)** Write `MULTI_INSURER_ARCHITECTURE.md` tech doc first

My recommendation: **B → A → C** (verify before scaling).

## Tied-in strategic questions (also deferred)

These came up earlier in the session and are still pending:

1. **Path A/B/C choice** — Insurance-First Specialist vs bank enterprise vs partner-with-ThaiPFA
2. Revised pricing ladder (Free / 990 / 1,990 / 4,990) + phased team scaling model → Excel financial model not yet built
3. Detailed P0 roadmap at sprint/task level
4. $100M Leads book (157MB PDF at `Marketing/`) not yet read

## How to resume

Open this file + `src/data/allianz/QUICK_RATE_V2018.md` + `src/data/allianz/SCHEMA.md` and the Excel file `AVP_INS_Premium_Tool_2510.xlsm`, then pick one of (A)/(B)/(C)/(D).

Inspection script pattern used (keep for reuse):

```python
from openpyxl import load_workbook
wb = load_workbook('AVP_INS_Premium_Tool_2510.xlsm', data_only=True, keep_vba=True)
# row 1 = company/product group, row 2 = plan name, row 3 = gender, row 4 = named-range code
# rows 5–104 = age 0–99 with rate in the product-gender column
```
