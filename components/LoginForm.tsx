"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface LoginFormProps {
  initialMode: "login" | "register";
}

export default function LoginForm({ initialMode }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(
    initialMode === "register"
  );
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);

    try {
      // 🔹 Limpia cualquier sesión/refresh token local antes de operar
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});

      if (isRegistering) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/login` },
        });

        if (error) {
          alert(error.message);
          return;
        }

        alert(
          "Registro exitoso. Revisa tu correo y confirma tu cuenta antes de iniciar sesión."
        );
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          alert(error.message);
          return;
        }

        // Opcional: chequeo extra de sesión
        if (!data.session) {
          alert("No se pudo iniciar sesión. Intenta nuevamente.");
          return;
        }

        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen justify-center items-center bg-gray-950 text-gray-100">
      <div className="bg-gray-900 p-8 rounded-lg shadow-lg w-96 border border-gray-800">
        <h1 className="text-2xl font-bold mb-6 text-white text-center">
          {isRegistering ? "Registrarse" : "Iniciar sesión"}
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Contraseña"
            className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white p-3 rounded transition"
          >
            {loading
              ? "Procesando..."
              : isRegistering
              ? "Registrarse"
              : "Iniciar sesión"}
          </button>
        </form>
        <p className="mt-4 text-center text-gray-400">
          {isRegistering ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
          <button
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-blue-400 hover:text-blue-300 underline"
            disabled={loading}
          >
            {isRegistering ? "Inicia sesión" : "Regístrate"}
          </button>
        </p>
      </div>
    </div>
  );
}
