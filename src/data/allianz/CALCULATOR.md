# Premium Cashflow Calculator — Specification

> Received from Claude in Chrome. Interface `SizeDiscount` at end was truncated — reconstructed from step 2.2.5.

## 1. Contract

### Input
```typescript
interface CalcInput {
  currentAge: number;
  retireAge: number;
  gender: "M" | "F";
  occupationClass: 1 | 2 | 3 | 4;

  main: {
    productCode: string;
    planCode?: string;
    sumAssured: number;
  };

  riders: Array<{
    productCode: string;
    planCode?: string;
    sumAssured?: number;
    dailyBenefit?: number;
    selectedPlan?: string;
  }>;
}
```

### Output
```typescript
interface CashflowYear {
  age: number;
  mainPremium: number;
  ridersPremium: Array<{ code: string; premium: number; note?: string }>;
  totalPremium: number;
  warnings: string[];
}

interface CalcOutput {
  cashflow: CashflowYear[];
  summary: {
    totalPaid: number;
    mainTotalPaid: number;
    riderTotalPaid: number;
    lastPremiumAge: number;
  };
  errors: string[];
}
```

## 2. Lookup Rules

### 2.1 Rate lookup
```
getRate(productCode, planCode, age, gender):
  1. ถ้า product.gender_mode = "unisex" → gender = "ANY"
  2. query premium_rates WHERE product_id AND (plan_id=Y OR plan_id IS NULL)
       AND gender IN (<gender>, 'ANY')
       AND age_min <= age <= age_max LIMIT 1
  3. ถ้าไม่เจอ → null
  4. is_renewal_only=true AND currentAge > age → null
  5. is_renewal_only=true AND currentAge > entry_age_max AND เป็นปีต่ออายุ → ใช้ได้
```

### 2.2 Main premium
```
calcMainPremium(main, age, gender):
  1. หา plan
  2. premium_years check: (age - currentAge) < premium_years → continue, else 0
  3. rate = getRate(...)
  4. basePremium = rate × (sumAssured / product.rate_per)
  5. size_discount: basePremium -= discount × (sumAssured / rate_per)
  6. return basePremium
```

### 2.3 Rider premium
```
calcRiderPremium(rider, age, gender, occClass):
  1. max_renewal_age check
  2. rate = getRate(...)
  3. null → 0
  4. if rider_type in [DAILY_HB, DAILY_HB_CI]: units = dailyBenefit / 100
     else: units = sumAssured / 1000
  5. basePremium = rate × units
  6. has_occ_multiplier: basePremium *= multiplier(occClass)
  7. return round(basePremium, 2)
```

## 3. Edge Cases
1. `*` = renewal-only
2. max_renewal_age → premium = 0 + warning
3. จ่ายเบี้ยครบก่อน retireAge → premium = 0 แต่ยังคุ้มครอง
4. Whole life "X" ต้องให้ user เลือก premium_years
5. Annuity → cashflow 2 ขา (จ่าย + รับ — extension)
6. OPD ต้องมี parent IPD
7. Size discount (MDP): rate ลดตามช่วงทุน
8. Unisex vs gender-specific

## 4. TypeScript Interfaces

```typescript
export type Gender = "M" | "F";
export type DbGender = "M" | "F" | "ANY";
export type OccClass = 1 | 2 | 3 | 4;
export type Category = 1 | 2;

export interface Product {
  id: number;
  code: string;
  name_th: string;
  category: Category;
  rider_type?: string | null;
  rate_per: 1000 | 100;
  gender_mode: "unisex" | "gender_specific";
  has_plans: boolean;
  has_occ_multiplier: boolean;
  has_size_discount: boolean;
  entry_age_min: number;
  entry_age_min_unit: "month" | "year";
  entry_age_max: number;
  max_renewal_age?: number | null;
  sum_min?: number | null;
  sum_max?: number | null;
  requires_product_code?: string | null;
  product_type?: "life" | "annuity" | "term" | null;
}

export interface ProductPlan {
  id: number;
  product_id: number;
  plan_code: string;
  plan_name_th?: string;
  coverage_years?: number | null;
  coverage_until_age?: number | null;
  premium_years?: number | null;
  premium_until_age?: number | null;
}

export interface PremiumRate {
  id: number;
  product_id: number;
  plan_id?: number | null;
  age_min: number;
  age_max: number;
  gender: DbGender;
  rate: number;
  is_renewal_only: boolean;
  confidence: "high" | "medium" | "low";
}

export interface OccupationMultiplier {
  product_id: number;
  occupation_class: OccClass;
  multiplier: number;
}

// Reconstructed from CALCULATOR step 2.2.5
export interface SizeDiscount {
  product_id: number;
  plan_id?: number | null;
  sum_min: number;
  sum_max: number;
  discount_rate: number;
}
```

## 5. Spot-check values (validation)
- HB age 16-35 unisex: **135** (not 120)
- HB age 11-15 unisex: 120
- CI48 age 40 M/F: 4.30 / 4.30
- CI48 age 50 M/F: 13.90 / 9.20
- MDP 15/6 all ages: 230 (unisex)
- MSI1808 all ages: 1,000 (unisex)
