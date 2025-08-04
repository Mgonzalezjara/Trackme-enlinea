"use client";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams; // ✅ Tipado correcto con Promise
  const mode = params?.mode === "register" ? "register" : "login";

  return <LoginForm initialMode={mode} />;
}
