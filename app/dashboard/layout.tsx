"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 p-6 flex flex-col">
        <h2 className="text-2xl font-bold mb-8 text-white">Dashboard</h2>
        <nav className="flex-1 space-y-2">
          <Link
            href="/dashboard/profile"
            className={`block px-4 py-2 rounded ${pathname === "/dashboard/profile" ? "bg-blue-600 text-white" : "hover:bg-gray-700"}`}
          >
            Profile
          </Link>
          <Link
            href="/dashboard/food-management"
            className={`block px-4 py-2 rounded ${pathname === "/dashboard/food-management" ? "bg-blue-600 text-white" : "hover:bg-gray-700"}`}
          >
            Food Management
          </Link>
          <Link
            href="/dashboard/foods"
            className={`block px-4 py-2 rounded ${pathname === "/dashboard/progress" ? "bg-blue-600 text-white" : "hover:bg-gray-700"}`}
          >
            Foods
          </Link>
          <Link
            href="/dashboard/daily"
            className={`block px-4 py-2 rounded ${pathname === "/dashboard/daily" ? "bg-blue-600 text-white" : "hover:bg-gray-700"}`}
          >
            Today's Meals
          </Link>
          <Link
            href="/dashboard/progress"
            className={`block px-4 py-2 rounded ${pathname === "/dashboard/progress" ? "bg-blue-600 text-white" : "hover:bg-gray-700"}`}
          >
            Progress
          </Link>
        </nav>
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded mt-6"
        >
          Logout
        </button>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
