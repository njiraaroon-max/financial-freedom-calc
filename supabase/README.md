# Supabase Migrations

## วิธีรัน (Phase B setup)

ยังไม่ได้ใช้ Supabase CLI — รันผ่าน Dashboard ไปก่อน

### Step 1: เปิด SQL Editor

https://supabase.com/dashboard → **Project** → **SQL Editor** → **New query**

### Step 2: รัน migrations ตามลำดับ

**ห้ามสลับลำดับ** เพราะ migration หลังพึ่ง table ของ migration ก่อน

1. เปิด `migrations/001_schema.sql` → copy ทั้งหมด → paste ใน SQL Editor → **Run**
   - ควรเห็น: `Success. No rows returned`
2. เปิด `migrations/002_rls.sql` → copy → paste → **Run**
3. เปิด `migrations/003_trigger_fa_profile.sql` → copy → paste → **Run**

### Step 3: ตรวจสอบ

**Table Editor** ควรเห็น 4 tables:
- `fa_profiles`
- `clients`
- `cashflow_items`
- `plan_data`

**Authentication → Policies** ควรเห็น policies 5+ รายการ
(1 per table + 1-2 extras บน fa_profiles)

### Step 4: ทดสอบ RLS

1. Sign up ผ่านหน้า `/signup` (ถ้ายัง ลอง step 6 ของ SUPABASE_SETUP.md)
2. ใน Supabase Dashboard → **Authentication** → **Users** ควรเห็น user ที่เพิ่ง sign up
3. ใน **Table Editor** → `fa_profiles` ควรเห็น row ที่ trigger สร้างให้อัตโนมัติ
   - ถ้าไม่เห็น: ตรวจ migration 003 รันสำเร็จมั้ย

---

## Idempotency

ทุก migration file ใช้ `create ... if not exists` + `drop policy if exists` → รันซ้ำได้ไม่พัง

## Rollback (ถ้าจำเป็น)

```sql
drop table if exists public.plan_data cascade;
drop table if exists public.cashflow_items cascade;
drop table if exists public.clients cascade;
drop table if exists public.fa_profiles cascade;
drop function if exists public.handle_new_user cascade;
drop function if exists public.tg_set_updated_at cascade;
```

⚠️ จะลบข้อมูลทั้งหมดใน tables นี้ — ใช้ตอน dev เท่านั้น
