"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.push("/dashboard/profile");
  }, [router]);

  return null; // solo redirige
}
