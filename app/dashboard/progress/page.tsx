"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

type Goal = {
  daily_calories: number;
  deficit_level: string;
};

export default function ProgressPage() {
  const [user, setUser] = useState<any>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [progressData, setProgressData] = useState<{ days: string[]; calories: number[] }>({
    days: [],
    calories: [],
  });
  const [detailedDays, setDetailedDays] = useState<{ date: string; calories: number }[]>([]);
  const [range, setRange] = useState(7); // default 7 days
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const userId = sessionData.session.user.id;
      setUser(sessionData.session.user);

      // ✅ Goal actual
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

  async function fetchProgress(userId: string, goalData: any) {
    if (!goalData) return;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - range);
    const startISO = startDate.toISOString().split("T")[0];

    // ✅ Traer comidas del rango
    const { data: mealsData } = await supabase
      .from("daily_meals")
      .select("date, meal_foods(calories)")
      .eq("user_id", userId)
      .gte("date", startISO)
      .order("date", { ascending: true });

    // Agrupar por fecha y sumar calorías
    const grouped: { [key: string]: number } = {};
    mealsData?.forEach((meal) => {
      const date = meal.date;
      const calories = meal.meal_foods.reduce((sum: number, f: any) => sum + (f.calories || 0), 0);
      grouped[date] = (grouped[date] || 0) + calories;
    });

    // Crear arreglo de progreso (todos los días del rango)
    const days: string[] = [];
    const calories: number[] = [];
    const detailed: { date: string; calories: number }[] = [];

    for (let i = 0; i <= range; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (range - i));
      const iso = date.toISOString().split("T")[0];
      const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      days.push(label);
      calories.push(grouped[iso] || 0);

      // Solo agregar a la tabla días con registros
      if (grouped[iso]) {
        detailed.push({ date: label, calories: grouped[iso] });
      }
    }

    setProgressData({ days, calories });
    setDetailedDays(detailed);
  }

  // 🔥 Cálculos de sumatorias
  const totalConsumed = detailedDays.reduce((sum, d) => sum + d.calories, 0);
  const totalGoal = goal ? goal.daily_calories * detailedDays.length : 0;
  const difference = totalConsumed - totalGoal;

  if (loading) return <p className="text-gray-300 p-6">Loading...</p>;

  return (
    <div className="max-w-3xl mx-auto bg-gray-900 text-gray-100 p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4 text-white">Progress Overview</h2>

      {!goal ? (
        <p className="text-red-400 italic">
          ⚠️ No active goal found. Set your goal in Profile first.
        </p>
      ) : (
        <>
          {/* Meta actual */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6">
            <p><span className="font-bold">Active Goal:</span> {Math.round(goal.daily_calories)} kcal/day ({goal.deficit_level})</p>
            <p className="text-sm text-gray-400">
              Tracking last {range} days (only days with meals are summed in stats).
            </p>
          </div>

          {/* Selector de rango */}
          <div className="mb-4 flex gap-2">
            {[7, 15, 30].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-2 rounded ${range === r ? "bg-blue-600 text-white" : "bg-gray-700 hover:bg-gray-600"}`}
              >
                {r} days
              </button>
            ))}
          </div>

          {/* 🔥 Resumen total */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6">
            <p><span className="font-bold">Days with meals:</span> {detailedDays.length}</p>
            <p><span className="font-bold">Total Consumed:</span> {Math.round(totalConsumed)} kcal</p>
            <p><span className="font-bold">Goal for those days:</span> {Math.round(totalGoal)} kcal</p>
            <p>
              <span className="font-bold">Difference:</span>{" "}
              <span className={difference > 0 ? "text-red-400" : "text-green-400"}>
                {difference > 0 ? `+${Math.round(difference)} kcal (over goal)` : `${Math.round(difference)} kcal (deficit)`}
              </span>
            </p>
          </div>

          {/* Tabla de días con comidas */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6">
            <h3 className="text-lg font-semibold mb-3">Calories by Day</h3>
            {detailedDays.length > 0 ? (
              <table className="w-full border-collapse border border-gray-700 text-sm">
                <thead>
                  <tr className="bg-gray-700 text-gray-200">
                    <th className="border border-gray-700 p-2 text-left">Date</th>
                    <th className="border border-gray-700 p-2 text-right">Calories</th>
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
              <p className="text-gray-400 italic">No meals logged in this range.</p>
            )}
          </div>

          {/* Chart */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <Line
              data={{
                labels: progressData.days,
                datasets: [
                  {
                    label: "Calories Consumed",
                    data: progressData.calories,
                    borderColor: "#4ade80",
                    backgroundColor: "rgba(74, 222, 128, 0.3)",
                    fill: true,
                    tension: 0.3,
                  },
                  {
                    label: "Daily Goal",
                    data: Array(progressData.days.length).fill(goal.daily_calories),
                    borderColor: "#60a5fa",
                    borderDash: [5, 5],
                    fill: false,
                  },
                ],
              }}
              options={{
                responsive: true,
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
        </>
      )}
    </div>
  );
}
