"use client";

/**
 * UserMenu — floating top-right button showing the current FA account
 * + a dropdown with a sign-out action. Mounted by AppShell on every
 * authenticated route.
 *
 * We listen to auth state changes so the menu updates instantly when
 * the user signs in/out in another tab. If there's no session we
 * render nothing (middleware redirects unauthed users to /login
 * before they can see this anyway).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LogOut,
  UserCircle,
  ChevronDown,
  Users,
  ShieldCheck,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useActiveClientStore } from "@/store/active-client-store";

export default function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeClientName = useActiveClientStore((s) => s.activeClientName);

  useEffect(() => {
    const supabase = createClient();

    const loadProfile = async (uid: string) => {
      const { data } = await supabase
        .from("fa_profiles")
        .select("role")
        .eq("user_id", uid)
        .maybeSingle();
      setIsAdmin(data?.role === "admin");
    };

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) loadProfile(data.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else setIsAdmin(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!user) return null;

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ||
    user.email?.split("@")[0] ||
    "ผู้ใช้";

  return (
    <div
      ref={menuRef}
      className="fixed top-3 right-3 z-[9400] print:hidden flex items-center gap-2"
    >
      {/* Active client chip — visible when an FA has selected a client */}
      {activeClientName && (
        <Link
          href="/clients"
          className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full bg-indigo-500 text-white shadow-sm text-xs font-medium hover:bg-indigo-600 transition max-w-[180px]"
          title="เปลี่ยน client"
        >
          <Users size={13} className="shrink-0" />
          <span className="truncate">{activeClientName}</span>
        </Link>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-white shadow-sm border border-gray-200 hover:border-gray-300 hover:shadow transition text-xs"
        aria-label="เมนูผู้ใช้"
      >
        <UserCircle size={20} className="text-indigo-500" />
        <span className="font-medium text-gray-700 max-w-[140px] truncate hidden sm:inline">
          {displayName}
        </span>
        <ChevronDown size={12} className="text-gray-400" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl ring-1 ring-black/5 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100">
            <div className="text-xs font-bold text-gray-800 truncate">
              {displayName}
            </div>
            <div className="text-[10px] text-gray-500 truncate">
              {user.email}
            </div>
          </div>
          <Link
            href="/clients"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition"
          >
            <Users size={13} />
            จัดการ Clients
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-indigo-700 hover:bg-indigo-50 transition border-t border-gray-100"
            >
              <ShieldCheck size={13} />
              Admin Dashboard
            </Link>
          )}
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-rose-600 hover:bg-rose-50 transition border-t border-gray-100"
            >
              <LogOut size={13} />
              ออกจากระบบ
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
