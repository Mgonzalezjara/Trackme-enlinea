"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

interface Goal {
  daily_calories: number;
  maintenance_calories: number;
  deficit_level: string;
}

interface User {
  id: string;
  email: string;
}

interface MealFood {
  calories: number;
}

interface DailyMeal {
  date: string;
  meal_foods: MealFood[];
}

export default function ProgressPage() {
  const [user, setUser] = useState<User | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [progressData, setProgressData] = useState<{ days: string[]; calories: number[] }>({
    days: [],
    calories: [],
  });
  const [detailedDays, setDetailedDays] = useState<{ date: string; calories: number }[]>([]);
  const [range, setRange] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const userId = sessionData.session.user.id;
      setUser({ id: userId, email: sessionData.session.user.email ?? "" });

      const { data: goalData } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", userId)
        .eq("is_current", true)
        .maybeSingle();
      setGoal(goalData);

      await fetchProgress(userId, goalData);
      setLoading(false);
    }
    load();
  }, [range]);

  async function fetchProgress(userId: string, goalData: Goal | null) {
    if (!goalData) return;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);
    const startISO = startDate.toISOString().split("T")[0];

    const { data: mealsData } = await supabase
      .from("daily_meals")
      .select("date, meal_foods(calories)")
      .eq("user_id", userId)
      .gte("date", startISO)
      .order("date", { ascending: true });

    const grouped: { [key: string]: number } = {};
    mealsData?.forEach((meal: DailyMeal) => {
      const calories = meal.meal_foods.reduce((sum, f) => sum + (f.calories || 0), 0);
      grouped[meal.date] = (grouped[meal.date] || 0) + calories;
    });

    const days: string[] = [];
    const calories: number[] = [];
    const detailed: { date: string; calories: number }[] = [];

    for (let i = 0; i <= range; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (range - i));
      const iso = date.toISOString().split("T")[0];
      const label = date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });

      days.push(label);
      calories.push(grouped[iso] || 0);

      if (grouped[iso]) {
        detailed.push({ date: label, calories: grouped[iso] });
      }
    }

    setProgressData({ days, calories });
    setDetailedDays(detailed);
  }

  const totalConsumed = detailedDays.reduce((sum, d) => sum + d.calories, 0);
  const totalGoal = goal ? goal.daily_calories * detailedDays.length : 0;
  const totalMaintenance = goal ? goal.maintenance_calories * detailedDays.length : 0;

  const differenceWithGoal = totalConsumed - totalGoal;
  const differenceWithMaintenance = totalConsumed - totalMaintenance;
  const estimatedFatLossKg = differenceWithMaintenance < 0 ? -differenceWithMaintenance / 7700 : 0;

  if (loading) return <p className="text-gray-300 p-6">Cargando...</p>;

  return (
    <div className="max-w-3xl mx-auto bg-gray-900 text-gray-100 p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4 text-white">Resumen de Progreso</h2>

      {!goal ? (
        <p className="text-red-400 italic">
          ⚠️ No se encontró una meta activa. Establece tu meta en el perfil primero.
        </p>
      ) : (
        <>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6">
            <p>
              <span className="font-bold">Meta activa:</span> {Math.round(goal.daily_calories)} kcal/día ({goal.deficit_level})
            </p>
            <p className="text-sm text-gray-400">
              Mostrando los últimos {range} días (solo se suman los días con comidas registradas).
            </p>
          </div>

          <div className="mb-4 flex gap-2">
            {[7, 15, 30].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-2 rounded ${range === r ? "bg-blue-600 text-white" : "bg-gray-700 hover:bg-gray-600"}`}
              >
                {r} días
              </button>
            ))}
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6 space-y-2">
            <p><span className="font-bold">Días con comidas:</span> {detailedDays.length}</p>
            <p><span className="font-bold">Calorías consumidas:</span> {Math.round(totalConsumed)} kcal</p>

            <p><span className="font-bold">Meta total para esos días:</span> {Math.round(totalGoal)} kcal</p>
            <p>
              <span className="font-bold">Diferencia con la meta:</span>{" "}
              <span className={differenceWithGoal > 0 ? "text-red-400" : "text-green-400"}>
                {differenceWithGoal > 0
                  ? `+${Math.round(differenceWithGoal)} kcal (sobre la meta)`
                  : `${Math.round(differenceWithGoal)} kcal (déficit)`}
              </span>
            </p>

            <p><span className="font-bold">Mantenimiento total estimado:</span> {Math.round(totalMaintenance)} kcal</p>
            <p>
              <span className="font-bold">Déficit real respecto al mantenimiento:</span>{" "}
              <span className={differenceWithMaintenance < 0 ? "text-green-400" : "text-red-400"}>
                {differenceWithMaintenance < 0
                  ? `${Math.round(-differenceWithMaintenance)} kcal de déficit`
                  : `+${Math.round(differenceWithMaintenance)} kcal sobre mantenimiento`}
              </span>
            </p>

            <p><span className="font-bold">Grasa estimada perdida:</span> {estimatedFatLossKg.toFixed(2)} kg</p>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6">
            <h3 className="text-lg font-semibold mb-3">Calorías por día</h3>
            {detailedDays.length > 0 ? (
              <table className="w-full border-collapse border border-gray-700 text-sm">
                <thead>
                  <tr className="bg-gray-700 text-gray-200">
                    <th className="border border-gray-700 p-2 text-left">Fecha</th>
                    <th className="border border-gray-700 p-2 text-right">Calorías</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedDays.map((d, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-gray-900" : "bg-gray-800"}>
                      <td className="border border-gray-700 p-2">{d.date}</td>
                      <td className="border border-gray-700 p-2 text-right">{Math.round(d.calories)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-400 italic">No hay comidas registradas en este rango.</p>
            )}
          </div>

          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <div className="w-full" style={{ height: "300px" }}>
              <Line
                data={{
                  labels: progressData.days,
                  datasets: [
                    {
                      label: "Calorías consumidas",
                      data: progressData.calories,
                      borderColor: "#4ade80",
                      backgroundColor: "rgba(74, 222, 128, 0.3)",
                      fill: true,
                      tension: 0.3,
                    },
                    {
                      label: "Meta diaria",
                      data: Array(progressData.days.length).fill(goal.daily_calories),
                      borderColor: "#60a5fa",
                      borderDash: [5, 5],
                      fill: false,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { labels: { color: "#e5e7eb" } },
                  },
                  scales: {
                    x: { ticks: { color: "#e5e7eb" }, grid: { color: "#374151" } },
                    y: { ticks: { color: "#e5e7eb" }, grid: { color: "#374151" } },
                  },
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
