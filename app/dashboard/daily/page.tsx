"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface FoodItem {
  id: string;
  foods: {
    id: string;
    name: string;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  };
  quantity: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

interface Meal {
  id: string;
  meal_type: string;
  meal_foods: FoodItem[];
}

export default function DailyPage() {
  const [user, setUser] = useState<any>(null);
  const [goal, setGoal] = useState<any>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [foods, setFoods] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [newMealType, setNewMealType] = useState("breakfast");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFood, setSelectedFood] = useState("");
  const [quantity, setQuantity] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      const userId = sessionData.session.user.id;
      setUser(sessionData.session.user);

      const { data: goalData } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", userId)
        .eq("is_current", true)
        .maybeSingle();
      setGoal(goalData);

      const { data: catData } = await supabase.from("food_categories").select("*").order("name");
      const { data: foodData } = await supabase.from("foods").select("*").order("name");
      setCategories(catData || []);
      setFoods(foodData || []);

      await fetchMeals(userId, selectedDate);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (user) fetchMeals(user.id, selectedDate);
  }, [selectedDate]);

  async function fetchMeals(userId: string, date: string) {
    const { data } = await supabase
      .from("daily_meals")
      .select("*, meal_foods(*, foods(*))")
      .eq("user_id", userId)
      .eq("date", date)
      .order("created_at");
    setMeals(data || []);
  }

  async function handleAddMeal() {
    if (!selectedFood || !quantity) return alert("Selecciona alimento y cantidad.");

    const { data: existingMeal } = await supabase
      .from("daily_meals")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", selectedDate)
      .eq("meal_type", newMealType)
      .maybeSingle();

    let mealId = existingMeal?.id;
    if (!mealId) {
      const { data: newMeal } = await supabase
        .from("daily_meals")
        .insert([{ user_id: user.id, date: selectedDate, meal_type: newMealType }])
        .select()
        .single();
      mealId = newMeal?.id;
    }

    await supabase.from("meal_foods").insert([
      {
        meal_id: mealId,
        food_id: selectedFood,
        quantity: parseFloat(quantity),
        calories: preview.calories,
        protein: preview.protein,
        fat: preview.fat,
        carbs: preview.carbs,
      },
    ]);

    await fetchMeals(user.id, selectedDate);
    resetForm();
  }

  async function handleSaveEdit(mealId: string) {
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) return;

    for (const item of meal.meal_foods) {
      const factor = item.quantity / 100;
      await supabase
        .from("meal_foods")
        .update({
          quantity: item.quantity,
          calories: Math.round(item.foods.calories * factor),
          protein: +(item.foods.protein * factor).toFixed(1),
          fat: +(item.foods.fat * factor).toFixed(1),
          carbs: +(item.foods.carbs * factor).toFixed(1),
        })
        .eq("id", item.id);
    }

    await fetchMeals(user.id, selectedDate);
    setEditingMealId(null);
  }

  async function handleDeleteFood(foodId: string) {
    if (!confirm("¿Eliminar este alimento?")) return;
    await supabase.from("meal_foods").delete().eq("id", foodId);
    await fetchMeals(user.id, selectedDate);
  }

  function resetForm() {
    setSelectedCategory("");
    setSelectedFood("");
    setQuantity("");
    setPreview(null);
  }

  useEffect(() => {
    if (!selectedFood || !quantity) {
      setPreview(null);
      return;
    }
    const food = foods.find((f) => f.id === selectedFood);
    if (!food) return;
    const factor = parseFloat(quantity) / 100;
    setPreview({
      calories: Math.round(food.calories * factor),
      protein: +(food.protein * factor).toFixed(1),
      fat: +(food.fat * factor).toFixed(1),
      carbs: +(food.carbs * factor).toFixed(1),
    });
  }, [selectedFood, quantity, foods]);

  const getEditPreview = (food: FoodItem) => {
    const factor = food.quantity / 100;
    return {
      calories: Math.round(food.foods.calories * factor),
      protein: +(food.foods.protein * factor).toFixed(1),
      fat: +(food.foods.fat * factor).toFixed(1),
      carbs: +(food.foods.carbs * factor).toFixed(1),
    };
  };

  const totalCalories = meals.reduce(
    (sum, meal) => sum + meal.meal_foods.reduce((s, f) => s + f.calories, 0),
    0
  );

  const today = new Date().toISOString().split("T")[0];

  if (loading) return <p className="text-gray-300 p-6">Cargando...</p>;

  return (
    <div className="max-w-2xl mx-auto bg-gray-900 text-gray-100 p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4 text-white">Meals by Day</h2>

      {/* Fecha */}
      <div className="mb-4">
        <label className="block text-sm mb-1 text-gray-300">Fecha</label>
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="p-2 border border-gray-700 bg-gray-800 rounded text-gray-100"
        />
      </div>

      {/* Resumen */}
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6">
        <p><span className="font-bold">Meta:</span> {goal ? `${Math.round(goal.daily_calories)} kcal` : "Sin meta"}</p>
        <p><span className="font-bold">Consumidas:</span> {Math.round(totalCalories)} kcal</p>
        <p><span className="font-bold">Restantes:</span> {goal ? `${Math.max(goal.daily_calories - totalCalories, 0)} kcal` : "N/A"}</p>
      </div>

      {/* Meals */}
      {meals.map((meal) => (
        <div key={meal.id} className="mb-4 bg-gray-800 p-4 rounded">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-green-400 capitalize">{meal.meal_type}</h3>
            {editingMealId === meal.id ? (
              <button
                onClick={() => handleSaveEdit(meal.id)}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
              >
                Guardar
              </button>
            ) : (
              <button
                onClick={() => setEditingMealId(meal.id)}
                className="bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded text-sm"
              >
                Editar
              </button>
            )}
          </div>
          <ul className="text-sm text-gray-200">
            {meal.meal_foods.map((f: FoodItem) => {
              const editPreview = getEditPreview(f);
              return (
                <li key={f.id} className="flex flex-col gap-1 mb-2">
                  {editingMealId === meal.id ? (
                    <>
                      <div className="flex items-center gap-2 w-full">
                        <span className="flex-1">{f.foods.name}</span>
                        <input
                          type="number"
                          value={f.quantity}
                          onChange={(e) => {
                            const newQty = parseFloat(e.target.value);
                            setMeals((prev) =>
                              prev.map((m) =>
                                m.id === meal.id
                                  ? {
                                      ...m,
                                      meal_foods: m.meal_foods.map((item) =>
                                        item.id === f.id ? { ...item, quantity: newQty } : item
                                      ),
                                    }
                                  : m
                              )
                            );
                          }}
                          className="w-16 p-1 border border-gray-600 bg-gray-700 rounded text-right"
                        />
                        <span className="text-gray-400">g</span>
                      </div>
                      <div className="text-xs text-gray-400 ml-1">
                        Preview: {editPreview.calories} kcal | P: {editPreview.protein}g | G: {editPreview.fat}g | C: {editPreview.carbs}g
                      </div>
                      <button
                        onClick={() => handleDeleteFood(f.id)}
                        className="self-end text-red-500 hover:underline text-xs"
                      >
                        Eliminar
                      </button>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span>{f.foods.name} - {f.quantity} g ({Math.round(f.calories)} kcal)</span>
                      <button
                        onClick={() => handleDeleteFood(f.id)}
                        className="ml-3 text-red-500 hover:underline text-xs"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* Agregar alimento */}
      {goal && (
        <div className="mt-6 bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h4 className="font-semibold mb-2">Agregar alimento</h4>
          <div className="flex flex-col gap-3">
            <select
              value={newMealType}
              onChange={(e) => setNewMealType(e.target.value)}
              className="p-2 border border-gray-700 bg-gray-900 rounded text-gray-100"
            >
              <option value="breakfast">Desayuno</option>
              <option value="lunch">Almuerzo</option>
              <option value="dinner">Cena</option>
              <option value="snack">Snack</option>
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedFood("");
              }}
              className="p-2 border border-gray-700 bg-gray-900 rounded text-gray-100"
            >
              <option value="">Selecciona categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              value={selectedFood}
              onChange={(e) => setSelectedFood(e.target.value)}
              className="p-2 border border-gray-700 bg-gray-900 rounded text-gray-100"
              disabled={!selectedCategory}
            >
              <option value="">Selecciona alimento</option>
              {foods.filter((f) => f.category_id === selectedCategory).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.calories} kcal/100g)
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Cantidad (g)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="p-2 border border-gray-700 bg-gray-900 rounded text-gray-100"
            />

            {preview && (
              <div className="bg-gray-700 p-3 rounded text-sm text-gray-100">
                <p>Preview: <span className="font-bold">{preview.calories} kcal</span></p>
                <p>Proteínas: {preview.protein} g | Grasas: {preview.fat} g | Carbs: {preview.carbs} g</p>
              </div>
            )}

            <button
              onClick={handleAddMeal}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
