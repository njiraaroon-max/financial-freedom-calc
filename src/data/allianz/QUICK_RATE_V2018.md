# Quick Rate v2018 — Archive Note

> Legacy agency pricing manual from Allianz Ayudhya (2018 vintage). Kept as
> historical reference; **not** a consumer-facing brochure, so it does not
> appear in `brochures.ts` or close any `KNOWN_BROCHURE_GAPS` entries.

## Where it lives

- Path (outside repo): `เอกสาร Brochure Allianz/Quick Rate v2018.pdf`
- Size: ~2.1 MB, 227 pages
- Audience: Allianz agents, not the public

## Why we have it

The 2018 Quick Rate is the oldest full-catalogue pricing manual we have. Useful
for two things:

1. **Audit** — cross-check transcribed rates in `premium_rates.json` against a
   primary source for products that still exist today.
2. **Legacy lookup** — if a customer mentions an older product name and we
   want to know what it was / whether it's still sold, v2018 is the reference.

## Audit result (2026-04-22)

Every rate we sampled from `premium_rates.json` matches v2018 **exactly**.
Spot-checked ages 30 / 35 / 40 / 45 / 50 / 55 / 60 for both genders:

| Product | Cells checked | Result |
|---|---|---|
| `CI48` (Critical Illness 48 Classic) | 14 | ✅ all match (v2018 p.141) |
| `MWLA9021` (My Whole Life A90/21) | 14 | ✅ all match (v2018 p.58) |

Matches the `_meta.status.life_simple: "14 spot-checks PASS"` claim in
`premium_rates.json`. **Confirms our 2026 rate table is still on 2018 pricing
for these two products** — no repricing has happened since.

If Allianz reprices these products, the source of truth shifts and this audit
becomes stale. Track it via the `generated_at` stamp in `premium_rates.json`.

## Products in v2018 (inventory)

Kept here so we can tell at a glance whether a legacy product name is covered
by our archive without reopening the PDF.

### Also in the current repo (still sold)

| v2018 page | Code | Notes |
|---|---|---|
| ~55–58 | `MWLA9021` | My Whole Life A90/21 — rates verified ✅ |
| ~61 | `T1010` | Term 10/10 — present in repo |
| ~137–141 | `CI48` | CI 48 Classic — rates verified ✅ |
| (various) | `HB`, `HBP`, `HBCI` | Daily hospital benefit family |
| (various) | `CBN` | Cancer No Worries |

### Legacy / discontinued (informational only, **not in repo**)

| v2018 page | Code | Thai name |
|---|---|---|
| — | `HSMFCP` / `HSMFCB` | Pre-split First Class Platinum / Beyond (before BDMS/ALL variants) |
| — | `HSP` / `OPDP` | ปลดล็อค Classic |
| — | `HSMHPE` / `OPDME` | ปลดล็อค เอ็กซ์ตร้า |
| — | `HSMMK` / `OPDMMK` | คุ้มครองสุขภาพเด็กเหมาจ่าย |
| — | `HSMKC` / `OPDMKC` | คุ้มครองสุขภาพลูกห่วงค่ารักษา |
| — | `CB` | Cancer (pre-CBN, standalone) |
| — | `WP` | Waiver of premium — ทุพพลภาพ |
| — | `PB4` | Premium Payer Benefit (parent waiver) |
| — | `AI` / `ADD` / `ADB` | Accident riders อ.1 / อ.2 / อ.3 |
| — | `RCC` | Accident medical |
| — | `TRN` / `TRC` | Term convertible |
| — | `My PA` / `My PA Plus` / `PA` / `My Super Safety` | Accident packages |

### Newer products **not** in v2018 (expected — post-2018 launches)

- `CIMC` — multi-claim CI (launched after 2018)
- First Class Ultra `HSMFCPN_*` / `HSMFCBN_*` — BDMS/ALL network split
- `OPDMSK` / `HSMHPSK` — ปลดล็อค สบายกระเป๋า
- `HSMHPDC` / `OPDMDC` — ปลดล็อค ดับเบิล แคร์
- `MWLA9920` / `MWLA9906` — newer whole-life variants

## Why it doesn't close brochure gaps

`KNOWN_BROCHURE_GAPS` is specifically about **consumer-facing** brochures —
the glossy PDFs customers see. The Quick Rate is an internal agency document
and would not appear on any consumer-facing "ดูโบรชัวร์" link. So:

- `MWLA9021` stays in `KNOWN_BROCHURE_GAPS` (no consumer brochure yet).
- `CI48` stays in `KNOWN_BROCHURE_GAPS` as "Agency Quick Rate only" — which
  in fact points at this document.
