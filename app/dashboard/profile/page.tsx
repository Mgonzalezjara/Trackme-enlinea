"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Line } from "react-chartjs-2";
import "chart.js/auto";

interface User {
  id: string;
  email: string;
}

interface Profile {
  name: string;
  height: string;
  current_weight: string;
  target_weight: string;
  birth_date: string;
  sex: string;
  activity_level: string;
}

interface Goal {
  daily_calories: number;
  maintenance_calories: number;
  deficit_level: string;
  weeks_to_goal: number;
  weekly_loss: number;
  created_at: string;
}

interface WeightLog {
  id: string;
  weight: number;
  logged_at: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>({
    name: "",
    height: "",
    current_weight: "",
    target_weight: "",
    birth_date: "",
    sex: "",
    activity_level: "",
  });
  const [goal, setGoal] = useState<Goal | null>(null);
  const [deficitLevel, setDeficitLevel] = useState("moderate");
  const [loading, setLoading] = useState(true);
  const [isSettingGoal, setIsSettingGoal] = useState(false);

  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [newWeight, setNewWeight] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const userId = sessionData.session.user.id;
      setUser({ id: userId, email: sessionData.session.user.email ?? "" });

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (profileData) setProfile(profileData);

      const { data: goalData } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", userId)
        .eq("is_current", true)
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (goalData) {
        setGoal(goalData);
        setDeficitLevel(goalData.deficit_level);
      }

      await fetchWeightLogs(userId);
      setLoading(false);
    }
    load();
  }, []);

  async function fetchWeightLogs(userId: string) {
    const { data } = await supabase
      .from("weight_logs")
      .select("*")
      .eq("user_id", userId)
      .order("logged_at", { ascending: true });
    if (data) setWeightLogs(data);
  }

  async function handleAddWeight() {
    if (!newWeight || !user) return alert("Ingresa un peso válido.");
    const weight = parseFloat(newWeight);
    await supabase
      .from("weight_logs")
      .insert([{ user_id: user.id, weight, logged_at: logDate }]);
    setNewWeight("");
    setLogDate(new Date().toISOString().split("T")[0]);
    await fetchWeightLogs(user.id);
    alert("Peso registrado correctamente.");
  }

  function calculateBMI(weight: number) {
    const heightM = parseFloat(profile.height) / 100;
    return heightM > 0 ? weight / (heightM * heightM) : 0;
  }

  async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    await supabase.from("profiles").update(profile).eq("id", user.id);
    alert("¡Perfil actualizado!");
  }

  async function handleCalculateGoal() {
    if (
      !profile.birth_date ||
      !profile.height ||
      !profile.current_weight ||
      !profile.sex ||
      !profile.activity_level ||
      !profile.target_weight
    ) {
      return alert("Completa todos los campos del perfil primero.");
    }

    if (goal && !confirm("Esto sobrescribirá tu meta actual. ¿Deseas continuar?")) return;

    const age = Math.floor(
      (Date.now() - new Date(profile.birth_date).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000)
    );
    const heightCm = parseFloat(profile.height);
    const weight = parseFloat(profile.current_weight);
    const targetWeight = parseFloat(profile.target_weight);

    const tmb =
      profile.sex === "male"
        ? 10 * weight + 6.25 * heightCm - 5 * age + 5
        : 10 * weight + 6.25 * heightCm - 5 * age - 161;
    const activityFactors: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      intense: 1.725,
    };
    const tdee = tmb * activityFactors[profile.activity_level];

    const deficitValues: Record<string, number> = {
      light: 250,
      moderate: 500,
      aggressive: 1000,
    };
    const dailyCalories = Math.max(tdee - deficitValues[deficitLevel], 1200);

    const kcalPerKg = 7700;
    const weeklyDeficit = deficitValues[deficitLevel] * 7;
    const weeklyLoss = weeklyDeficit / kcalPerKg;
    const kgToLose = weight - targetWeight;
    const weeks =
      kgToLose > 0
        ? Math.ceil((kgToLose * kcalPerKg) / weeklyDeficit)
        : 0;

    await supabase
      .from("goals")
      .update({ is_current: false })
      .eq("user_id", user!.id)
      .eq("is_current", true);

    const { data: savedGoal } = await supabase
      .from("goals")
      .insert({
        user_id: user!.id,
        maintenance_calories: tdee,
        daily_calories: dailyCalories,
        deficit_level: deficitLevel,
        is_current: true,
        weeks_to_goal: weeks,
        weekly_loss: weeklyLoss,
        created_at: new Date(),
      })
      .select()
      .single();

    if (savedGoal) {
      setGoal({ ...savedGoal, weekly_loss: weeklyLoss, weeks_to_goal: weeks });
    }

    setIsSettingGoal(false);
    alert("¡Nueva meta calculada y guardada!");
  }

  if (loading) return <p className="p-6 text-gray-300">Cargando...</p>;

  return (
    <div className="max-w-2xl mx-auto bg-gray-900 shadow-lg p-6 rounded-lg text-gray-100">
      <h2 className="text-2xl font-bold mb-6 text-white">Perfil y Meta</h2>

      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6">
        <h3 className="text-lg font-semibold mb-2 text-green-400">
          🎯 Meta Actual
        </h3>
        {goal ? (
          <>
            <p>
              <span className="font-bold">Calorías diarias:</span>{" "}
              {Math.round(goal.daily_calories)} kcal ({goal.deficit_level})
            </p>
            <p>
              <span className="font-bold">Calorías de mantenimiento:</span>{" "}
              {Math.round(goal.maintenance_calories)} kcal
            </p>
            <p>
              <span className="font-bold">Peso objetivo:</span>{" "}
              {profile.target_weight} kg
            </p>
            <p>
              <span className="font-bold">IMC actual:</span>{" "}
              {calculateBMI(parseFloat(profile.current_weight)).toFixed(1)}
            </p>
          </>
        ) : (
          <p className="text-gray-400 italic">
            Aún no has establecido una meta.
          </p>
        )}
      </div>

      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6">
        <h3 className="text-lg font-semibold mb-3 text-blue-400">
          ⚖️ Registro de Peso
        </h3>

        {/* 🔧 BLOQUE RESPONSIVE PARA NUEVO REGISTRO */}
        <div className="flex flex-col gap-2 mb-3 md:flex-row">
          <input
            type="number"
            placeholder="Peso (kg)"
            className="p-2 border border-gray-700 bg-gray-900 rounded text-gray-100 w-full md:flex-1"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
          />
          <input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="p-2 border border-gray-700 bg-gray-900 rounded text-gray-100 w-full md:w-auto"
          />
          <button
            onClick={handleAddWeight}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded w-full md:w-auto"
          >
            Agregar
          </button>
        </div>

        {weightLogs.length > 0 && (
          <>
            <div
              className="bg-gray-800 p-4 rounded-lg border border-gray-700"
              style={{ height: "350px" }}
            >
              <Line
                data={{
                  labels: weightLogs.map((log) =>
                    new Date(log.logged_at).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                    })
                  ),
                  datasets: [
                    {
                      label: "Peso registrado (kg)",
                      data: weightLogs.map((log) => log.weight),
                      borderColor: "#4ade80",
                      backgroundColor: "rgba(74, 222, 128, 0.3)",
                      tension: 0.3,
                      fill: true,
                      pointRadius: 4,
                      pointBackgroundColor: "#4ade80",
                    },
                    ...(profile.target_weight
                      ? [
                          {
                            label: `Meta de peso (${profile.target_weight} kg)`,
                            data: Array(weightLogs.length).fill(
                              parseFloat(profile.target_weight)
                            ),
                            borderColor: "#60a5fa",
                            borderDash: [6, 6],
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: false,
                          },
                        ]
                      : []),
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { labels: { color: "#e5e7eb" } },
                    tooltip: {
                      callbacks: {
                        label: (context) => `${context.raw} kg`,
                      },
                    },
                  },
                  scales: {
                    x: {
                      ticks: { color: "#e5e7eb" },
                      grid: { color: "#374151" },
                    },
                    y: {
                      ticks: { color: "#e5e7eb" },
                      grid: { color: "#374151" },
                      beginAtZero: false,
                    },
                  },
                }}
              />
            </div>

            <table className="w-full mt-4 border-collapse border border-gray-700 text-sm">
              <thead>
                <tr className="bg-gray-700 text-gray-200">
                  <th className="border border-gray-700 p-2">Fecha</th>
                  <th className="border border-gray-700 p-2">Peso (kg)</th>
                  <th className="border border-gray-700 p-2">IMC</th>
                </tr>
              </thead>
              <tbody>
                {weightLogs.map((log, idx) => (
                  <tr
                    key={log.id}
                    className={
                      idx % 2 === 0 ? "bg-gray-900" : "bg-gray-800"
                    }
                  >
                    <td className="border border-gray-700 p-2">
                      {new Date(log.logged_at).toLocaleDateString("es-ES")}
                    </td>
                    <td className="border border-gray-700 p-2">
                      {log.weight}
                    </td>
                    <td className="border border-gray-700 p-2">
                      {calculateBMI(log.weight).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <form
        onSubmit={handleSaveProfile}
        className="flex flex-col gap-4 mb-6"
      >
        <label>
          <span className="text-sm mb-1 text-gray-300">Nombre</span>
          <input
            className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 w-full"
            value={profile.name || ""}
            onChange={(e) =>
              setProfile({ ...profile, name: e.target.value })
            }
          />
        </label>
        <label>
          <span className="text-sm mb-1 text-gray-300">Altura (cm)</span>
          <input
            className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 w-full"
            type="number"
            value={profile.height || ""}
            onChange={(e) =>
              setProfile({ ...profile, height: e.target.value })
            }
          />
        </label>
        <label>
          <span className="text-sm mb-1 text-gray-300">
            Peso actual (kg)
          </span>
          <input
            className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 w-full"
            type="number"
            value={profile.current_weight || ""}
            onChange={(e) =>
              setProfile({
                ...profile,
                current_weight: e.target.value,
              })
            }
          />
        </label>
        <label>
          <span className="text-sm mb-1 text-gray-300">
            Peso objetivo (kg)
          </span>
          <input
            className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 w-full"
            type="number"
            value={profile.target_weight || ""}
            onChange={(e) =>
              setProfile({
                ...profile,
                target_weight: e.target.value,
              })
            }
          />
        </label>
        <label>
          <span className="text-sm mb-1 text-gray-300">
            Fecha de nacimiento
          </span>
          <input
            className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 w-full"
            type="date"
            value={profile.birth_date || ""}
            onChange={(e) =>
              setProfile({
                ...profile,
                birth_date: e.target.value,
              })
            }
          />
        </label>
        <label>
          <span className="text-sm mb-1 text-gray-300">Sexo</span>
          <select
            className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 w-full"
            value={profile.sex || ""}
            onChange={(e) =>
              setProfile({ ...profile, sex: e.target.value })
            }
          >
            <option value="">Seleccionar</option>
            <option value="male">Hombre</option>
            <option value="female">Mujer</option>
          </select>
        </label>
        <label>
          <span className="text-sm mb-1 text-gray-300">
            Nivel de actividad
          </span>
          <select
            className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 w-full"
            value={profile.activity_level || ""}
            onChange={(e) =>
              setProfile({
                ...profile,
                activity_level: e.target.value,
              })
            }
          >
            <option value="">Seleccionar</option>
            <option value="sedentary">Sedentario</option>
            <option value="light">Ligero</option>
            <option value="moderate">Moderado</option>
            <option value="intense">Intenso</option>
          </select>
        </label>
        <button className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded">
          Guardar perfil
        </button>
      </form>

      {isSettingGoal && (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h4 className="text-lg font-semibold mb-2 text-yellow-400">
            Establecer nueva meta
          </h4>
          <p className="text-sm text-gray-400 mb-3">
            Esto sobrescribirá tu meta actual.
          </p>
          <div className="flex gap-2 mb-3">
            <select
              className="p-3 border border-gray-700 bg-gray-900 rounded text-gray-100 flex-1"
              value={deficitLevel}
              onChange={(e) => setDeficitLevel(e.target.value)}
            >
              <option value="light">Ligero (-250 kcal/día)</option>
              <option value="moderate">Moderado (-500 kcal/día)</option>
              <option value="aggressive">Agresivo (-1000 kcal/día)</option>
            </select>
            <button
              onClick={handleCalculateGoal}
              className="bg-green-600 hover:bg-green-700 text-white px-4 rounded"
            >
              Confirmar y calcular
            </button>
          </div>
          <button
            onClick={() => setIsSettingGoal(false)}
            className="text-gray-400 text-sm underline"
          >
            Cancelar
          </button>
        </div>
      )}

      {!isSettingGoal && (
        <div className="mt-4">
          <button
            onClick={() => setIsSettingGoal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            {goal ? "Establecer nueva meta" : "Crear meta"}
          </button>
        </div>
      )}
    </div>
  );
}
