"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface FoodItem {
  id: string;
  foods: {
    id: string;
    name: string;
    calories: number; // por 100 g
    protein: number;
    fat: number;
    carbs: number;
    reference_portion_name?: string | null;
    reference_portion_grams?: number | null;
  };
  quantity: number;  // gramos o nº de porciones (según is_portion)
  is_portion: boolean;
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

interface Goal {
  daily_calories: number;
}

interface Food {
  id: string;
  name: string;
  calories: number; // por 100 g
  protein: number;
  fat: number;
  carbs: number;
  category_id: string;
  reference_portion_name?: string | null;
  reference_portion_grams?: number | null;
}

interface Category {
  id: string;
  name: string;
}

interface Preview {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

interface User {
  id: string;
  email: string;
}

type EntryMode = "grams" | "portion";

export default function DailyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [newMealType, setNewMealType] = useState("breakfast");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFood, setSelectedFood] = useState("");
  const [quantity, setQuantity] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode>("grams");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);

  // Diccionario para traducir tipos de comida
  const mealTypeLabels: Record<string, string> = {
    breakfast: "Desayuno",
    lunch: "Almuerzo",
    dinner: "Cena",
    snack: "Snack",
  };

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
      if (goalData) setGoal(goalData);

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
  }, [user, selectedDate]);

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

    const food = foods.find((f) => f.id === selectedFood);
    if (!food) return alert("Alimento no encontrado.");
    if (!preview) return alert("No se pudo calcular la vista previa.");

    const quantityNumber = parseFloat(quantity);
    if (isNaN(quantityNumber) || quantityNumber <= 0) {
      return alert("Ingresa una cantidad válida.");
    }

    // Buscar si ya existe comida de ese tipo ese día
    const { data: existingMeal } = await supabase
      .from("daily_meals")
      .select("*")
      .eq("user_id", user!.id)
      .eq("date", selectedDate)
      .eq("meal_type", newMealType)
      .maybeSingle();

    let mealId = existingMeal?.id;
    if (!mealId) {
      const { data: newMeal } = await supabase
        .from("daily_meals")
        .insert([{ user_id: user!.id, date: selectedDate, meal_type: newMealType }])
        .select()
        .single();
      mealId = newMeal?.id;
    }

    await supabase.from("meal_foods").insert([
      {
        meal_id: mealId,
        food_id: selectedFood,
        quantity: quantityNumber,                 // gramos o nº de porciones
        is_portion: entryMode === "portion",     // <- clave
        calories: preview.calories,
        protein: preview.protein,
        fat: preview.fat,
        carbs: preview.carbs,
      },
    ]);

    await fetchMeals(user!.id, selectedDate);
    resetForm();
  }

  async function handleSaveEdit(mealId: string) {
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) return;

    for (const item of meal.meal_foods) {
      const fd = item.foods;
      let grams: number;

      if (item.is_portion && fd.reference_portion_grams) {
        grams = item.quantity * fd.reference_portion_grams;
      } else {
        grams = item.quantity; // asumimos gramos
      }

      const factor = grams / 100;

      await supabase
        .from("meal_foods")
        .update({
          quantity: item.quantity, // sigue siendo gramos o porciones según is_portion
          is_portion: item.is_portion,
          calories: Math.round(fd.calories * factor),
          protein: +(fd.protein * factor).toFixed(1),
          fat: +(fd.fat * factor).toFixed(1),
          carbs: +(fd.carbs * factor).toFixed(1),
        })
        .eq("id", item.id);
    }

    await fetchMeals(user!.id, selectedDate);
    setEditingMealId(null);
  }

  async function handleDeleteFood(foodId: string) {
    if (!confirm("¿Eliminar este alimento?")) return;
    await supabase.from("meal_foods").delete().eq("id", foodId);
    if (user) await fetchMeals(user.id, selectedDate);
  }

  function resetForm() {
    setSelectedCategory("");
    setSelectedFood("");
    setQuantity("");
    setEntryMode("grams");
    setPreview(null);
  }

  // Vista previa para el formulario (agregar)
  useEffect(() => {
    if (!selectedFood || !quantity) {
      setPreview(null);
      return;
    }
    const food = foods.find((f) => f.id === selectedFood);
    if (!food) {
      setPreview(null);
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setPreview(null);
      return;
    }

    let grams: number;
    if (entryMode === "portion") {
      if (!food.reference_portion_grams) {
        setPreview(null);
        return;
      }
      grams = qty * food.reference_portion_grams;
    } else {
      grams = qty;
    }

    const factor = grams / 100;

    setPreview({
      calories: Math.round(food.calories * factor),
      protein: +(food.protein * factor).toFixed(1),
      fat: +(food.fat * factor).toFixed(1),
      carbs: +(food.carbs * factor).toFixed(1),
    });
  }, [selectedFood, quantity, foods, entryMode]);

  // Vista previa de edición (cada ítem ya guardado)
  const getEditPreview = (foodItem: FoodItem) => {
    const fd = foodItem.foods;
    let grams: number;
    if (foodItem.is_portion && fd.reference_portion_grams) {
      grams = foodItem.quantity * fd.reference_portion_grams;
    } else {
      grams = foodItem.quantity;
    }
    const factor = grams / 100;

    return {
      calories: Math.round(fd.calories * factor),
      protein: +(fd.protein * factor).toFixed(1),
      fat: +(fd.fat * factor).toFixed(1),
      carbs: +(fd.carbs * factor).toFixed(1),
    };
  };

  const totalCalories = meals.reduce(
    (sum, meal) => sum + meal.meal_foods.reduce((s, f) => s + f.calories, 0),
    0
  );

  const today = new Date().toISOString().split("T")[0];
  const selectedFoodObj = foods.find((f) => f.id === selectedFood);
  const selectedFoodHasPortion =
    !!selectedFoodObj && !!selectedFoodObj.reference_portion_grams;

  if (loading) return <p className="text-gray-300 p-6">Cargando...</p>;

  return (
    <div className="max-w-2xl mx-auto bg-gray-900 text-gray-100 p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4 text-white">Comidas por día</h2>

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

      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6">
        <p>
          <span className="font-bold">Meta:</span>{" "}
          {goal ? `${Math.round(goal.daily_calories)} kcal` : "Sin meta"}
        </p>
        <p>
          <span className="font-bold">Consumidas:</span>{" "}
          {Math.round(totalCalories)} kcal
        </p>
        <p>
          <span className="font-bold">Restantes:</span>{" "}
          {goal
            ? `${Math.max(goal.daily_calories - totalCalories, 0)} kcal`
            : "N/A"}
        </p>
      </div>

      {/* Listado de comidas */}
      {meals.map((meal) => (
        <div key={meal.id} className="mb-4 bg-gray-800 p-4 rounded">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-green-400">
              {mealTypeLabels[meal.meal_type] || meal.meal_type}
            </h3>
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
            {meal.meal_foods.map((f) => {
              const editPreview = getEditPreview(f);

              const unitLabel = f.is_portion
                ? f.foods.reference_portion_name
                  ? `${f.quantity} ${f.foods.reference_portion_name}${
                      f.quantity > 1 ? "s" : ""
                    }`
                  : `${f.quantity} porciones`
                : `${f.quantity} g`;

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
                                        item.id === f.id
                                          ? { ...item, quantity: newQty }
                                          : item
                                      ),
                                    }
                                  : m
                              )
                            );
                          }}
                          className="w-16 p-1 border border-gray-600 bg-gray-700 rounded text-right"
                        />
                        <span className="text-gray-400">
                          {f.is_portion ? "porc." : "g"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 ml-1">
                        Vista previa: {editPreview.calories} kcal | P:{" "}
                        {editPreview.protein}g | G: {editPreview.fat}g | C:{" "}
                        {editPreview.carbs}g
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
                      <span>
                        {f.foods.name} - {unitLabel} (
                        {Math.round(f.calories)} kcal)
                      </span>
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

      {/* Formulario de agregar alimento */}
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
                setEntryMode("grams");
                setPreview(null);
                setQuantity("");
              }}
              className="p-2 border border-gray-700 bg-gray-900 rounded text-gray-100"
            >
              <option value="">Selecciona categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={selectedFood}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedFood(value);
                setQuantity("");
                setPreview(null);
                const f = foods.find((food) => food.id === value);
                if (!f || !f.reference_portion_grams) {
                  setEntryMode("grams");
                }
              }}
              className="p-2 border border-gray-700 bg-gray-900 rounded text-gray-100"
              disabled={!selectedCategory}
            >
              <option value="">Selecciona alimento</option>
              {foods
                .filter((f) => f.category_id === selectedCategory)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.calories} kcal/100g)
                  </option>
                ))}
            </select>

            {/* Toggle gramos / porciones (solo si el alimento tiene porción de referencia) */}
            {selectedFoodObj && selectedFoodHasPortion && (
              <div>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setEntryMode("grams")}
                    className={`px-3 py-1 rounded text-sm ${
                      entryMode === "grams"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-200"
                    }`}
                  >
                    Gramos
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryMode("portion")}
                    className={`px-3 py-1 rounded text-sm ${
                      entryMode === "portion"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-200"
                    }`}
                  >
                    Porciones
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  1 {selectedFoodObj.reference_portion_name} ={" "}
                  {selectedFoodObj.reference_portion_grams} g
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder={
                  entryMode === "grams"
                    ? "Cantidad (g)"
                    : "Cantidad (porciones)"
                }
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="p-2 border border-gray-700 bg-gray-900 rounded text-gray-100 flex-1"
              />
              <span className="text-gray-400 text-sm">
                {entryMode === "grams" ? "g" : "porc."}
              </span>
            </div>

            {preview && (
              <div className="bg-gray-700 p-3 rounded text-sm text-gray-100">
                <p>
                  Vista previa:{" "}
                  <span className="font-bold">{preview.calories} kcal</span>
                </p>
                <p>
                  Proteínas: {preview.protein} g | Grasas: {preview.fat} g |
                  Carbohidratos: {preview.carbs} g
                </p>
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
