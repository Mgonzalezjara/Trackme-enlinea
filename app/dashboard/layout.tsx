"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Botón hamburguesa/cerrar (solo en mobile) */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-4 right-4 md:hidden z-50 p-2 rounded bg-gray-800 hover:bg-gray-700 transition"
      >
        {sidebarOpen ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full w-64 bg-gray-800 p-6 flex flex-col transform transition-transform duration-300 z-40
        ${sidebarOpen ? "translate-x-0" : "translate-x-full"} md:translate-x-0 md:static md:left-0 md:right-auto`}
      >
        <h2 className="text-2xl font-bold mb-8 text-white">Dashboard</h2>
        <nav className="flex-1 space-y-2">
          <Link
            href="/dashboard/profile"
            className={`block px-4 py-2 rounded ${pathname === "/dashboard/profile" ? "bg-blue-600 text-white" : "hover:bg-gray-700"}`}
            onClick={() => setSidebarOpen(false)}
          >
            Perfil
          </Link>
          <Link
            href="/dashboard/food-management"
            className={`block px-4 py-2 rounded ${pathname === "/dashboard/food-management" ? "bg-blue-600 text-white" : "hover:bg-gray-700"}`}
            onClick={() => setSidebarOpen(false)}
          >
            Gestión de alimentos
          </Link>
          <Link
            href="/dashboard/foods"
            className={`block px-4 py-2 rounded ${pathname === "/dashboard/foods" ? "bg-blue-600 text-white" : "hover:bg-gray-700"}`}
            onClick={() => setSidebarOpen(false)}
          >
            Alimentos
          </Link>
          <Link
            href="/dashboard/daily"
            className={`block px-4 py-2 rounded ${pathname === "/dashboard/daily" ? "bg-blue-600 text-white" : "hover:bg-gray-700"}`}
            onClick={() => setSidebarOpen(false)}
          >
            Comidas de hoy
          </Link>
          <Link
            href="/dashboard/progress"
            className={`block px-4 py-2 rounded ${pathname === "/dashboard/progress" ? "bg-blue-600 text-white" : "hover:bg-gray-700"}`}
            onClick={() => setSidebarOpen(false)}
          >
            Progreso
          </Link>
        </nav>
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded mt-6"
        >
          Cerrar sesión
        </button>
      </aside>

      {/* Overlay oscuro en mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Contenido principal */}
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
