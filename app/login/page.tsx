import LoginForm from "@/components/LoginForm"; // ✅ usando alias "@/"

export default function LoginPage({ searchParams }: { searchParams: { mode?: string } }) {
  return <LoginForm initialMode={searchParams.mode || "login"} />;
}
