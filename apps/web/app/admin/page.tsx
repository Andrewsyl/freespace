"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/dashboard");
  }, [router]);

  return <div className="p-6 text-sm text-slate-600">Redirecting to admin dashboard…</div>;
}
