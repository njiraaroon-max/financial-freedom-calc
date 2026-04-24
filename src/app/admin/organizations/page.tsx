"use client";

/**
 * /admin/organizations — CRUD for tenant organizations.
 *
 * Admin-only. RLS from migration 007 lets admins read/insert/update
 * the `organizations` table directly — no service-role key needed.
 *
 * Each organization carries its own brand surface (colors, fonts,
 * logos) and a `default_skin` used when a new FA is provisioned.
 * The per-FA skin in /admin can still override the org default.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Pencil,
  Users,
  Loader2,
  RefreshCw,
  ArrowLeft,
  X,
} from "lucide-react";
import {
  listOrganizations,
  createOrganization,
  updateOrganization,
  type OrganizationRow,
  type OrganizationInsert,
  type OrganizationUpdate,
} from "@/lib/supabase/admin";
import type { Skin } from "@/lib/supabase/database.types";
import { toast } from "@/store/toast-store";

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; org: OrganizationRow }
  | null;

export default function OrganizationsAdminPage() {
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const rows = await listOrganizations();
      setOrgs(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดองค์กรไม่สำเร็จ");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async (data: OrganizationInsert) => {
    try {
      await createOrganization(data);
      toast.success(`สร้างองค์กร "${data.name}" สำเร็จ`);
      setModal(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "สร้างองค์กรไม่สำเร็จ");
    }
  };

  const handleUpdate = async (id: string, updates: OrganizationUpdate) => {
    try {
      await updateOrganization(id, updates);
      toast.success(`บันทึกองค์กรสำเร็จ`);
      setModal(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      {/* Header */}
      <div className="px-4 md:px-8 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            title="กลับไปหน้า Admin"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              จัดการองค์กร
            </h1>
            <p className="text-xs text-gray-500">
              สร้าง / แก้ไข tenant + brand surface
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModal({ mode: "create" })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500 text-xs font-medium text-white hover:bg-indigo-600 transition"
          >
            <Plus size={13} />
            สร้างองค์กรใหม่
          </button>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition"
          >
            {refreshing ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 md:mx-8 mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          ⚠️ {error}
        </div>
      )}

      {/* Grid */}
      <div className="px-4 md:px-8 pb-8">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-gray-500 py-6">
            <Loader2 size={14} className="animate-spin" />
            กำลังโหลด...
          </div>
        ) : orgs.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-sm text-gray-500">
            ยังไม่มีองค์กรในระบบ — กด “สร้างองค์กรใหม่” เพื่อเริ่ม
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {orgs.map((org) => (
              <OrgCard
                key={org.id}
                org={org}
                onEdit={() => setModal({ mode: "edit", org })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <OrganizationModal
          initial={modal.mode === "edit" ? modal.org : null}
          onClose={() => setModal(null)}
          onSubmit={(data) =>
            modal.mode === "create"
              ? handleCreate(data)
              : handleUpdate(modal.org.id, data)
          }
        />
      )}
    </div>
  );
}

function OrgCard({
  org,
  onEdit,
}: {
  org: OrganizationRow;
  onEdit: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Color strip + logo preview */}
      <div
        className="h-16 flex items-center justify-between px-4"
        style={{
          background: `linear-gradient(135deg, ${org.color_primary_dark ?? org.color_primary} 0%, ${org.color_primary} 100%)`,
        }}
      >
        {org.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={org.logo_url}
            alt={org.name}
            className="h-10 max-w-[60%] object-contain"
          />
        ) : (
          <div className="text-white/80 text-sm font-semibold tracking-wide">
            {org.name}
          </div>
        )}
        {org.color_accent && (
          <div
            className="w-6 h-6 rounded-full border-2 border-white/50"
            style={{ background: org.color_accent }}
            title="Accent"
          />
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-800 truncate">
              {org.name}
            </div>
            <div className="text-[11px] text-gray-500 font-mono mt-0.5">
              {org.slug}
            </div>
          </div>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
            title="แก้ไข"
          >
            <Pencil size={13} />
          </button>
        </div>

        {org.tagline && (
          <div className="text-xs text-gray-500 mt-2 line-clamp-2">
            {org.tagline}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 text-[11px] text-gray-500">
          <div className="inline-flex items-center gap-1">
            <Users size={11} />
            {org.fa_count ?? 0} FAs
          </div>
          <div
            className={`px-1.5 py-0.5 rounded-full font-medium border ${
              org.default_skin === "professional"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-gray-50 text-gray-600 border-gray-200"
            }`}
          >
            Default: {org.default_skin}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────

type FormState = {
  slug: string;
  name: string;
  tagline: string;
  logo_url: string;
  logo_dark_url: string;
  favicon_url: string;
  color_primary: string;
  color_primary_dark: string;
  color_accent: string;
  font_display: string;
  font_body: string;
  default_skin: Skin;
};

function toForm(org: OrganizationRow | null): FormState {
  return {
    slug: org?.slug ?? "",
    name: org?.name ?? "",
    tagline: org?.tagline ?? "",
    logo_url: org?.logo_url ?? "",
    logo_dark_url: org?.logo_dark_url ?? "",
    favicon_url: org?.favicon_url ?? "",
    color_primary: org?.color_primary ?? "#6366f1",
    color_primary_dark: org?.color_primary_dark ?? "",
    color_accent: org?.color_accent ?? "",
    font_display: org?.font_display ?? "",
    font_body: org?.font_body ?? "",
    default_skin: org?.default_skin ?? "legacy",
  };
}

/** Strip empty strings → null so we don't persist "" for optional fields. */
function toPayload(f: FormState): OrganizationInsert {
  const n = (s: string) => (s.trim() === "" ? null : s.trim());
  return {
    slug: f.slug.trim(),
    name: f.name.trim(),
    tagline: n(f.tagline),
    logo_url: n(f.logo_url),
    logo_dark_url: n(f.logo_dark_url),
    favicon_url: n(f.favicon_url),
    color_primary: f.color_primary,
    color_primary_dark: n(f.color_primary_dark),
    color_accent: n(f.color_accent),
    font_display: n(f.font_display),
    font_body: n(f.font_body),
    default_skin: f.default_skin,
  };
}

function OrganizationModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial: OrganizationRow | null;
  onClose: () => void;
  onSubmit: (data: OrganizationInsert) => Promise<void> | void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [saving, setSaving] = useState(false);
  const isEdit = initial !== null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("กรุณากรอก Slug และ Name");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(toPayload(form));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl w-full max-w-2xl shadow-xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <Building2 size={14} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">
                {isEdit ? "แก้ไของค์กร" : "สร้างองค์กรใหม่"}
              </div>
              {isEdit && (
                <div className="text-[11px] text-gray-500 font-mono">
                  {initial.id}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Identity */}
          <section>
            <SectionTitle>Identity</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Slug *" hint="ตัวเล็ก a-z และขีด (-) เท่านั้น">
                <input
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  required
                  placeholder="victory-group"
                  disabled={isEdit}
                  className="field font-mono disabled:opacity-60"
                />
              </Field>
              <Field label="Name *">
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                  placeholder="Victory Group"
                  className="field"
                />
              </Field>
              <Field label="Tagline" className="col-span-2">
                <input
                  value={form.tagline}
                  onChange={(e) => set("tagline", e.target.value)}
                  placeholder="Personal Wealth Planning"
                  className="field"
                />
              </Field>
            </div>
          </section>

          {/* Branding */}
          <section>
            <SectionTitle>Brand Colors</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <ColorField
                label="Primary *"
                value={form.color_primary}
                onChange={(v) => set("color_primary", v)}
              />
              <ColorField
                label="Primary dark"
                value={form.color_primary_dark}
                onChange={(v) => set("color_primary_dark", v)}
              />
              <ColorField
                label="Accent"
                value={form.color_accent}
                onChange={(v) => set("color_accent", v)}
              />
            </div>
            {/* Preview strip */}
            <div
              className="mt-2 h-10 rounded-lg border border-gray-200"
              style={{
                background: `linear-gradient(135deg, ${form.color_primary_dark || form.color_primary} 0%, ${form.color_primary} 60%, ${form.color_accent || form.color_primary} 100%)`,
              }}
              aria-label="color preview"
            />
          </section>

          {/* Assets */}
          <section>
            <SectionTitle>Logos &amp; Assets</SectionTitle>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Logo URL (light)">
                <input
                  value={form.logo_url}
                  onChange={(e) => set("logo_url", e.target.value)}
                  placeholder="https://.../logo.svg"
                  className="field"
                />
              </Field>
              <Field label="Logo URL (dark)">
                <input
                  value={form.logo_dark_url}
                  onChange={(e) => set("logo_dark_url", e.target.value)}
                  placeholder="https://.../logo-dark.svg"
                  className="field"
                />
              </Field>
              <Field label="Favicon URL">
                <input
                  value={form.favicon_url}
                  onChange={(e) => set("favicon_url", e.target.value)}
                  placeholder="https://.../favicon.ico"
                  className="field"
                />
              </Field>
            </div>
          </section>

          {/* Typography */}
          <section>
            <SectionTitle>Typography</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Display font" hint="Google Fonts name">
                <input
                  value={form.font_display}
                  onChange={(e) => set("font_display", e.target.value)}
                  placeholder="Oswald"
                  className="field"
                />
              </Field>
              <Field label="Body font">
                <input
                  value={form.font_body}
                  onChange={(e) => set("font_body", e.target.value)}
                  placeholder="Sarabun"
                  className="field"
                />
              </Field>
            </div>
          </section>

          {/* Skin */}
          <section>
            <SectionTitle>Default Skin</SectionTitle>
            <div className="flex gap-2">
              {(["legacy", "professional"] as Skin[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("default_skin", s)}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition ${
                    form.default_skin === s
                      ? s === "professional"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-indigo-100 text-indigo-700 border-indigo-300"
                      : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {s === "professional" ? "Professional" : "Legacy"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Skin ที่ใช้เมื่อมี FA ใหม่เข้ามาองค์กรนี้ (admin override per-FA ได้จากหน้าหลัก)
            </p>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 transition"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? "บันทึก" : "สร้าง"}
          </button>
        </div>

        <style jsx>{`
          :global(.field) {
            width: 100%;
            font-size: 13px;
            padding: 8px 10px;
            border-radius: 8px;
            border: 1px solid rgb(229, 231, 235);
            background: white;
            color: rgb(55, 65, 81);
            outline: none;
          }
          :global(.field:focus) {
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
          }
        `}</style>
      </form>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // Accept blank (optional fields); color input needs a valid hex so
  // we show a placeholder swatch when empty.
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "";
  return (
    <div>
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={hex || "#cccccc"}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-9 rounded-lg border border-gray-200 cursor-pointer bg-white p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#6366f1"
          className="flex-1 font-mono text-[13px] px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>
    </div>
  );
}
