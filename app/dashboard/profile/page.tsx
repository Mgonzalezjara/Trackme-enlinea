"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>({
    name: "",
    height: "",
    current_weight: "",
    target_weight: "",
    birth_date: "",
    sex: "",
    activity_level: "",
  });
  const [goal, setGoal] = useState<any>(null);
  const [deficitLevel, setDeficitLevel] = useState("moderate");
  const [loading, setLoading] = useState(true);
  const [isSettingGoal, setIsSettingGoal] = useState(false); // 🔥 Modo para establecer nueva meta

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const userId = sessionData.session.user.id;
      setUser(sessionData.session.user);

      // Perfil
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (profileData) setProfile(profileData);

      // Meta actual
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
      setLoading(false);
    }
    load();
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    await supabase.from("profiles").update(profile).eq("id", user.id);
    alert("Profile updated!");
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
      return alert("Complete all profile fields first.");
    }

    // Confirmación UI
    if (goal && !confirm("This will overwrite your current goal. Continue?")) return;

    const age = Math.floor((Date.now() - new Date(profile.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const heightCm = parseFloat(profile.height);
    const heightM = heightCm / 100;
    const weight = parseFloat(profile.current_weight);
    const targetWeight = parseFloat(profile.target_weight);

    // 🔹 TMB y TDEE
    const tmb =
      profile.sex === "male"
        ? 10 * weight + 6.25 * heightCm - 5 * age + 5
        : 10 * weight + 6.25 * heightCm - 5 * age - 161;
    const activityFactors: any = { sedentary: 1.2, light: 1.375, moderate: 1.55, intense: 1.725 };
    const tdee = tmb * activityFactors[profile.activity_level];

    // 🔹 Déficit y meta diaria
    const deficitValues: any = { light: 250, moderate: 500, aggressive: 1000 };
    const dailyCalories = Math.max(tdee - deficitValues[deficitLevel], 1200);

    // 🔹 Estimaciones
    const kcalPerKg = 7700;
    const weeklyDeficit = deficitValues[deficitLevel] * 7;
    const weeklyLoss = weeklyDeficit / kcalPerKg;
    const kgToLose = weight - targetWeight;
    const weeks = kgToLose > 0 ? Math.ceil((kgToLose * kcalPerKg) / weeklyDeficit) : 0;

    // 🔥 Desactivar meta actual
    await supabase.from("goals").update({ is_current: false }).eq("user_id", user.id).eq("is_current", true);

    // 🔥 Insertar nueva meta
    const { data: savedGoal } = await supabase
    .from("goals")
    .insert({
        user_id: user.id,
        maintenance_calories: tdee,
        daily_calories: dailyCalories,
        deficit_level: deficitLevel,
        is_current: true,
        weeks_to_goal: weeks,           // 🔥 Persistimos semanas
        weekly_loss: weeklyLoss,        // 🔥 Persistimos pérdida semanal
        created_at: new Date(),
    })
    .select()
    .single();


    setGoal({
      ...savedGoal,
      weekly_loss: weeklyLoss,
      weeks_to_goal: weeks,
    });

    setIsSettingGoal(false);
    alert("New goal calculated and saved!");
  }

  if (loading) return <p className="p-6 text-gray-300">Loading...</p>;

  return (
    <div className="max-w-xl mx-auto bg-gray-900 shadow-lg p-6 rounded-lg text-gray-100">
      <h2 className="text-2xl font-bold mb-6 text-white">Profile & Goal</h2>

      {/* 🔥 PANEL DE META */}
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6">
        <h3 className="text-lg font-semibold mb-2 text-green-400">🎯 Your Current Goal</h3>
        {goal ? (
          <>
            <p><span className="font-bold text-white">Daily Calories:</span> {Math.round(goal.daily_calories)} kcal ({goal.deficit_level})</p>
            <p><span className="font-bold text-white">Maintenance Calories:</span> {Math.round(goal.maintenance_calories)} kcal</p>
            <p><span className="font-bold text-white">Target Weight:</span> {profile.target_weight} kg</p>
            {goal.weekly_loss && (
            <p>
                <span className="font-bold text-white">Estimated Loss:</span> 
                {goal.weekly_loss.toFixed(2)} kg/week
            </p>
            )}

            {goal.weeks_to_goal > 0 ? (
            <p>
                <span className="font-bold text-white">Time to Goal:</span> 
                {goal.weeks_to_goal} weeks
            </p>
            ) : (
            <p className="text-green-400">✅ You have reached your target weight!</p>
            )}

            <p className="text-gray-400 mt-2 text-sm">
              Set on: {new Date(goal.created_at).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </>
        ) : (
          <p className="text-gray-400 italic">No goal set yet. Fill in your profile and set a goal.</p>
        )}
      </div>

      {!isSettingGoal && (
        <div className="mb-6">
          <button
            onClick={() => setIsSettingGoal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            {goal ? "Set New Goal" : "Create Goal"}
          </button>
        </div>
      )}

      {/* FORM PERFIL */}
      <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 mb-6">
        <label>
          <span className="text-sm mb-1 text-gray-300">Name</span>
          <input className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 w-full"
            value={profile.name || ""} onChange={(e) => setProfile({ ...profile, name: e.target.value })}/>
        </label>
        <label>
          <span className="text-sm mb-1 text-gray-300">Height (cm)</span>
          <input className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 w-full" type="number"
            value={profile.height || ""} onChange={(e) => setProfile({ ...profile, height: e.target.value })}/>
        </label>
        <label>
          <span className="text-sm mb-1 text-gray-300">Current Weight (kg)</span>
          <input className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 w-full" type="number"
            value={profile.current_weight || ""} onChange={(e) => setProfile({ ...profile, current_weight: e.target.value })}/>
        </label>
        <label>
          <span className="text-sm mb-1 text-gray-300">Target Weight (kg)</span>
          <input className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 w-full" type="number"
            value={profile.target_weight || ""} onChange={(e) => setProfile({ ...profile, target_weight: e.target.value })}/>
        </label>
        <label>
          <span className="text-sm mb-1 text-gray-300">Birth Date</span>
          <input className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 w-full" type="date"
            value={profile.birth_date || ""} onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })}/>
        </label>
        <label>
          <span className="text-sm mb-1 text-gray-300">Sex</span>
          <select className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 w-full"
            value={profile.sex || ""} onChange={(e) => setProfile({ ...profile, sex: e.target.value })}>
            <option value="">Select</option><option value="male">Male</option><option value="female">Female</option>
          </select>
        </label>
        <label>
          <span className="text-sm mb-1 text-gray-300">Activity Level</span>
          <select className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 w-full"
            value={profile.activity_level || ""} onChange={(e) => setProfile({ ...profile, activity_level: e.target.value })}>
            <option value="">Select</option><option value="sedentary">Sedentary</option>
            <option value="light">Light</option><option value="moderate">Moderate</option><option value="intense">Intense</option>
          </select>
        </label>
        <button className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded">Save Profile</button>
      </form>

      {/* SOLO SI ESTÁ ACTIVADO: FORM DE NUEVO GOAL */}
      {isSettingGoal && (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h4 className="text-lg font-semibold mb-2 text-yellow-400">Set New Goal</h4>
          <p className="text-sm text-gray-400 mb-3">This will overwrite your current goal.</p>
          <div className="flex gap-2 mb-3">
            <select
              className="p-3 border border-gray-700 bg-gray-900 rounded text-gray-100 flex-1"
              value={deficitLevel}
              onChange={(e) => setDeficitLevel(e.target.value)}
            >
              <option value="light">Light (-250 kcal/day)</option>
              <option value="moderate">Moderate (-500 kcal/day)</option>
              <option value="aggressive">Aggressive (-1000 kcal/day)</option>
            </select>
            <button
              onClick={handleCalculateGoal}
              className="bg-green-600 hover:bg-green-700 text-white px-4 rounded"
            >
              Confirm & Calculate
            </button>
          </div>
          <button onClick={() => setIsSettingGoal(false)} className="text-gray-400 text-sm underline">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
