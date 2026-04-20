# Database Schema — Allianz Premium Rates

> Received from Claude in Chrome, with inferred missing pieces marked `[inferred]`.

## products
| field | type | note |
|---|---|---|
| id | int PK | product_id จาก Allianz |
| code | string | short code เช่น MDP, HB |
| name_th | string | ชื่อไทย |
| category | int | 1=main life, 2=rider |
| rider_type | string | IPD/OPD/DAILY_HB/DAILY_HB_CI/CI/CANCER/DENTAL/WAIVER/TERM/null |
| rate_per | int | หน่วยทุน: 1000 หรือ 100 (สำหรับ daily) |
| gender_mode | enum | "unisex" / "gender_specific" |
| has_plans | bool | มีแผนย่อยไหม |
| has_occ_multiplier | bool | ปรับตามอาชีพไหม |
| has_size_discount | bool | มีส่วนลดตามขนาดทุนไหม |
| entry_age_min | int | เดือนหรือปี (ดู unit) |
| entry_age_min_unit | enum | "month"/"year" |
| entry_age_max | int | |
| max_renewal_age | int | nullable |
| requires_product_code | string | สำหรับ OPD ที่ต้องมี IPD ด้วย |
| sum_min | int | nullable (ทุนขั้นต่ำ) |
| sum_max | int | nullable (ทุนสูงสุด) |
| product_type | enum | "life"/"annuity"/"term"/null [inferred from CALCULATOR.md] |

## product_plans
| field | type |
|---|---|
| id | int PK |
| product_id | FK |
| plan_code | string เช่น "18/10", "Platinum 500" |
| plan_name_th | string nullable [inferred] |
| coverage_years | int nullable |
| coverage_until_age | int nullable |
| premium_years | int nullable |
| premium_until_age | int nullable |

## premium_rates
| field | type | note |
|---|---|---|
| id | int PK | |
| product_id | FK | |
| plan_id | FK nullable | |
| age_min | int | |
| age_max | int | |
| gender | enum "M"/"F"/"ANY" | "ANY" เมื่อ product เป็น unisex |
| rate | decimal | |
| is_renewal_only | bool | `*` ในรูป = ปีต่ออายุเท่านั้น [inferred] |
| confidence | enum "high"/"medium"/"low" | OCR confidence [inferred] |

## occupation_multipliers [inferred from CALCULATOR step 2.3.6]
| field | type |
|---|---|
| product_id | FK |
| occupation_class | int (1-4) |
| multiplier | decimal |

## size_discounts [inferred from CALCULATOR step 2.2.5]
| field | type |
|---|---|
| product_id | FK |
| plan_id | FK nullable |
| sum_min | int | ช่วงทุน เช่น 500000 |
| sum_max | int | ช่วงทุน เช่น 999999 |
| discount_rate | decimal | ลดจาก rate per unit (บาท/1000) |
