"use client";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-gray-100">
      <header className="p-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">TrackMe</h1>
      </header>

      <main className="flex flex-1 flex-col justify-center items-center text-center px-6">
        <h2 className="text-4xl font-extrabold mb-4 text-white">Bienvenido a TrackMe</h2>
        <p className="text-lg text-gray-300 max-w-md mb-8">
          Controla tus comidas, calorías y progreso fácilmente.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto justify-center">
          <button
            onClick={() => router.push("/login?mode=login")}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded text-white text-lg shadow"
          >
            Iniciar Sesión
          </button>
          <button
            onClick={() => router.push("/login?mode=register")}
            className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded text-white text-lg shadow"
          >
            Crear Cuenta
          </button>
        </div>
      </main>

      <footer className="p-4 text-center text-gray-500 text-sm border-t border-gray-800">
        © {new Date().getFullYear()} TrackMe. Todos los derechos reservados.
      </footer>
    </div>
  );
}
