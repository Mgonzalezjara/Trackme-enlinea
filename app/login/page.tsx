"use client";
import LoginForm from "@/components/LoginForm";

interface PageProps {
  searchParams?: { mode?: string };
}

export default function LoginPage({ searchParams }: PageProps) {
  const mode = searchParams?.mode === "register" ? "register" : "login";
  return <LoginForm mode={mode} />;
}
