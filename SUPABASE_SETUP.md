# Supabase Setup — Phase A (Auth)

Phase A ติดตั้ง Supabase client + login/signup/logout ให้แล้ว
ขั้นตอนที่เหลือ = คุณต้องสร้าง Supabase project เอง แล้วใส่ credentials

## Step 1 — สร้าง Supabase project

1. ไปที่ https://supabase.com/dashboard → **New project**
2. กรอก:
   - **Name**: `financial-freedom-calc` (หรือชื่ออะไรก็ได้)
   - **Database Password**: ตั้งไว้ให้ปลอดภัย (ไม่ต้องจำ — ใช้ผ่าน connection string)
   - **Region**: `Southeast Asia (Singapore)` — ใกล้ไทยสุด
   - **Pricing Plan**: Free
3. รอประมาณ 1-2 นาที ให้ project เริ่มทำงาน

## Step 2 — Copy API credentials

1. ใน dashboard → **Settings (⚙️)** → **API**
2. Copy 2 ค่า:
   - **Project URL** (e.g. `https://abcxyz.supabase.co`)
   - **anon public** key (ตัวยาวๆ ที่ขึ้นต้น `eyJ...`)

## Step 3 — แก้ `.env.local`

แก้ไฟล์ `.env.local` ที่ root ของ project:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcxyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...(ตัวยาวๆ)
```

> `.env.local` อยู่ใน `.gitignore` อยู่แล้ว — ไม่หลุดขึ้น git

## Step 4 — ตั้ง Site URL + Redirect URLs

ใน Supabase dashboard → **Authentication** → **URL Configuration**:

- **Site URL**: `http://localhost:3000` (ตอน dev)
- **Redirect URLs**: เพิ่ม
  - `http://localhost:3000/auth/callback`
  - (ถ้า deploy แล้ว เพิ่ม `https://your-domain.com/auth/callback` ด้วย)

## Step 5 — (Optional) ปิด email confirmation สำหรับการ test

ตอน dev ถ้าขี้เกียจเปิดอีเมลยืนยันตลอด:

**Authentication** → **Providers** → **Email** → ปิด **Confirm email**

⚠️ อย่าลืมเปิดกลับตอน production

## Step 6 — ทดสอบ

```bash
npm run dev
```

1. เปิด http://localhost:3000
2. Middleware จะ redirect ไป `/login` เพราะยังไม่ได้ login
3. คลิก "สมัครใช้งาน" → กรอกข้อมูล → สร้างบัญชี
4. ถ้าเปิด email confirmation ไว้ → เช็คอีเมล → คลิกลิงก์ → กลับมาที่ `/auth/callback` → ถูกพาไปหน้าหลัก
5. ถ้าปิดไว้ → เข้าได้เลย
6. ดูมุมขวาบน — เห็น UserMenu (avatar + ชื่อ + dropdown สำหรับ sign out)

## Admin Bootstrap (หลังรัน migration 004)

Migration `004_admin_and_approval.sql` เพิ่มระบบอนุมัติ: signup ใหม่
ทุกคนจะ `status='pending'` จนกว่า admin จะอนุมัติ ครั้งแรกคุณต้อง
ตั้งตัวเองเป็น admin ด้วย SQL ใน **Supabase Dashboard → SQL Editor**:

```sql
update public.fa_profiles
   set role = 'admin', status = 'approved'
 where email = 'your@email.com';  -- ใส่อีเมลที่ signup ไว้
```

หลังรันคำสั่งนี้:
1. Logout แล้ว login ใหม่ (session จะ reload role)
2. เห็นเมนู **"Admin Dashboard"** ใน UserMenu มุมขวาบน
3. เข้า `/admin` → เห็น list FA ทั้งหมด, สถิติ, ปุ่มอนุมัติ/ปฏิเสธ/ส่ง reset link

**Flow ของ FA คนอื่นหลังจากนี้:**
- Signup → ไปหน้า `/pending-approval` (ใช้งาน calculator ไม่ได้)
- Admin เข้า `/admin` → กดเครื่องหมาย ✓ อนุมัติ
- FA refresh → เข้าระบบได้ปกติ

## สิ่งที่ Phase A ยังไม่ครอบคลุม

- ❌ ยังไม่มี database tables (Phase B)
- ❌ Data ยังเก็บใน localStorage อยู่ (Phase D)
- ❌ Clients ยังไม่ scope ตาม user (Phase C-D)

เมื่อ Step 1-6 ทำงานแล้ว บอกผม → เริ่ม Phase B (schema + RLS)

---

## Files ที่ Phase A เพิ่ม

```
src/
  lib/supabase/
    client.ts          — browser Supabase client
    server.ts          — server Supabase client (RSC, Route Handlers)
    middleware.ts      — session refresh + route protection helper
  middleware.ts        — Next.js middleware (calls updateSession)
  app/
    login/page.tsx     — หน้า login
    signup/page.tsx    — หน้า signup
    auth/
      callback/route.ts   — handles email confirm + OAuth return
      signout/route.ts    — POST → sign out + redirect
  components/
    UserMenu.tsx       — floating top-right user menu
.env.local.example     — template for env vars
.env.local             — real env vars (gitignored)
```
