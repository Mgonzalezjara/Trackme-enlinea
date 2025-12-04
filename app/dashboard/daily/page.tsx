"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface FoodItem {
  id: string;
  food_id: string | null;
  recipe_id: string | null;
  foods?: {
    id: string;
    name: string;
    calories: number; // por 100 g
    protein: number;
    fat: number;
    carbs: number;
    reference_portion_name?: string | null;
    reference_portion_grams?: number | null;
  } | null;
  recipes?: {
    id: string;
    name: string;
    total_servings: number | null;
    serving_label: string | null;
    description?: string | null;
  } | null;
  quantity: number; // gramos o nº de porciones (según is_portion / si es receta)
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

interface RecipeForDaily {
  id: string;
  name: string;
  total_servings: number | null;
  serving_label: string | null;
  description: string | null;
}

interface RecipeStats {
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  perServingCalories: number;
  perServingProtein: number;
  perServingFat: number;
  perServingCarbs: number;
}

type EntryMode = "grams" | "portion";
type AddMode = "food" | "recipe";

export default function DailyPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recipes, setRecipes] = useState<RecipeForDaily[]>([]);
  const [recipeStats, setRecipeStats] = useState<Record<string, RecipeStats>>(
    {}
  );

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [newMealType, setNewMealType] = useState("breakfast");

  // --- Modo agregar: alimento o receta ---
  const [addMode, setAddMode] = useState<AddMode>("food");

  // --- Formulario alimentos ---
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFood, setSelectedFood] = useState("");
  const [quantity, setQuantity] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode>("grams");
  const [preview, setPreview] = useState<Preview | null>(null);

  // --- Formulario recetas ---
  const [selectedRecipe, setSelectedRecipe] = useState("");
  const [recipeServings, setRecipeServings] = useState("");
  const [recipePreview, setRecipePreview] = useState<Preview | null>(null);

  // --- Modal de detalle de receta ---
  const [recipeModalId, setRecipeModalId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);

  // Diccionario para traducir tipos de comida
  const mealTypeLabels: Record<string, string> = {
    breakfast: "Desayuno",
    lunch: "Almuerzo",
    dinner: "Cena",
    snack: "Snack",
  };

  // -----------------------------
  // Helper: construir stats de recetas
  // -----------------------------
  function buildRecipeStats(
    recipesList: RecipeForDaily[],
    ingredients: { recipe_id: string; food_id: string; grams: number }[],
    foodsList: Food[]
  ): Record<string, RecipeStats> {
    const map: Record<string, RecipeStats> = {};

    // Inicializar
    recipesList.forEach((r) => {
      map[r.id] = {
        totalCalories: 0,
        totalProtein: 0,
        totalFat: 0,
        totalCarbs: 0,
        perServingCalories: 0,
        perServingProtein: 0,
        perServingFat: 0,
        perServingCarbs: 0,
      };
    });

    // Sumar ingredientes
    ingredients.forEach((row) => {
      const rStats = map[row.recipe_id];
      if (!rStats) return;

      const food = foodsList.find((f) => f.id === row.food_id);
      if (!food) return;

      const grams = row.grams || 0;
      if (grams <= 0) return;

      const factor = grams / 100;
      rStats.totalCalories += food.calories * factor;
      rStats.totalProtein += food.protein * factor;
      rStats.totalFat += food.fat * factor;
      rStats.totalCarbs += food.carbs * factor;
    });

    // Calcular por porción
    recipesList.forEach((r) => {
      const stats = map[r.id];
      if (!stats) return;

      const servings =
        r.total_servings && r.total_servings > 0 ? r.total_servings : 1;

      const factor = 1 / servings;
      stats.perServingCalories = stats.totalCalories * factor;
      stats.perServingProtein = stats.totalProtein * factor;
      stats.perServingFat = stats.totalFat * factor;
      stats.perServingCarbs = stats.totalCarbs * factor;
    });

    return map;
  }

  // -----------------------------
  // Helper: calcular macros de receta para X porciones
  // -----------------------------
  async function calculateRecipeMacros(
    recipeId: string,
    servings: number
  ): Promise<Preview | null> {
    if (!servings || servings <= 0) return null;

    const stats = recipeStats[recipeId];
    if (stats) {
      return {
        calories: Math.round(stats.perServingCalories * servings),
        protein: +(stats.perServingProtein * servings).toFixed(1),
        fat: +(stats.perServingFat * servings).toFixed(1),
        carbs: +(stats.perServingCarbs * servings).toFixed(1),
      };
    }

    // Fallback (no debería pasar casi nunca si load() corrió bien)
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return null;

    const totalServings =
      recipe.total_servings && recipe.total_servings > 0
        ? recipe.total_servings
        : 1;

    const { data: ingRows, error } = await supabase
      .from("recipe_ingredients")
      .select("food_id, grams")
      .eq("recipe_id", recipeId);

    if (error || !ingRows) return null;

    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;

    for (const row of ingRows as { food_id: string; grams: number }[]) {
      const food = foods.find((f) => f.id === row.food_id);
      if (!food) continue;
      const grams = row.grams || 0;
      if (grams <= 0) continue;

      const factor = grams / 100;
      totalCalories += food.calories * factor;
      totalProtein += food.protein * factor;
      totalFat += food.fat * factor;
      totalCarbs += food.carbs * factor;
    }

    const perFactor = 1 / totalServings;

    const perCalories = totalCalories * perFactor;
    const perProtein = totalProtein * perFactor;
    const perFat = totalFat * perFactor;
    const perCarbs = totalCarbs * perFactor;

    return {
      calories: Math.round(perCalories * servings),
      protein: +(perProtein * servings).toFixed(1),
      fat: +(perFat * servings).toFixed(1),
      carbs: +(perCarbs * servings).toFixed(1),
    };
  }

  // -----------------------------
  // Carga inicial
  // -----------------------------
  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const userId = sessionData.session.user.id;
      setUser({ id: userId, email: sessionData.session.user.email ?? "" });

      // Meta
      const { data: goalData } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", userId)
        .eq("is_current", true)
        .maybeSingle();
      if (goalData) setGoal(goalData);

      // Categorías y alimentos
      const { data: catData } = await supabase
        .from("food_categories")
        .select("*")
        .order("name");
      const { data: foodData } = await supabase
        .from("foods")
        .select("*")
        .order("name");

      setCategories(catData || []);
      const foodsList = (foodData || []) as Food[];
      setFoods(foodsList);

      // Recetas (públicas + mías)
      const { data: recipesData, error: recipesError } = await supabase
        .from("recipes")
        .select(
          "id, name, description, total_servings, serving_label, is_public, created_by_user_id"
        )
        .or(`is_public.eq.true,created_by_user_id.eq.${userId}`)
        .order("name");

      if (recipesError) {
        console.error(recipesError);
        setRecipes([]);
        setRecipeStats({});
      } else {
        const recipesList: RecipeForDaily[] = (recipesData || []).map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description ?? null,
          total_servings: r.total_servings,
          serving_label: r.serving_label,
        }));
        setRecipes(recipesList);

        // Calcular stats de recetas (total y por porción)
        if (recipesList.length > 0 && foodsList.length > 0) {
          const recipeIds = recipesList.map((r) => r.id);
          const { data: ingRows, error: ingErr } = await supabase
            .from("recipe_ingredients")
            .select("recipe_id, food_id, grams")
            .in("recipe_id", recipeIds);

          if (ingErr || !ingRows) {
            console.error("Error cargando ingredientes de recetas:", ingErr);
            setRecipeStats({});
          } else {
            const stats = buildRecipeStats(
              recipesList,
              ingRows as {
                recipe_id: string;
                food_id: string;
                grams: number;
              }[],
              foodsList
            );
            setRecipeStats(stats);
          }
        } else {
          setRecipeStats({});
        }
      }

      await fetchMeals(userId, selectedDate);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (user) fetchMeals(user.id, selectedDate);
  }, [user, selectedDate]);

  async function fetchMeals(userId: string, date: string) {
    const { data, error } = await supabase
      .from("daily_meals")
      .select(
        "*, meal_foods(*, foods(*), recipes(id, name, total_servings, serving_label, description))"
      )
      .eq("user_id", userId)
      .eq("date", date)
      .order("created_at");

    if (error) {
      console.error(error);
      setMeals([]);
    } else {
      setMeals((data || []) as Meal[]);
    }
  }

  // -----------------------------
  // Agregar alimento
  // -----------------------------
  async function handleAddMeal() {
    if (!selectedFood || !quantity) {
      return alert("Selecciona alimento y cantidad.");
    }

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
        .insert([
          { user_id: user!.id, date: selectedDate, meal_type: newMealType },
        ])
        .select()
        .single();
      mealId = newMeal?.id;
    }

    await supabase.from("meal_foods").insert([
      {
        meal_id: mealId,
        food_id: selectedFood,
        recipe_id: null,
        quantity: quantityNumber, // gramos o nº de porciones
        is_portion: entryMode === "portion",
        calories: preview.calories,
        protein: preview.protein,
        fat: preview.fat,
        carbs: preview.carbs,
      },
    ]);

    await fetchMeals(user!.id, selectedDate);
    resetFoodForm();
  }

  // -----------------------------
  // Agregar receta a la comida
  // -----------------------------
  async function handleAddRecipeToMeal() {
    if (!selectedRecipe || !recipeServings) {
      return alert("Selecciona receta y cantidad de porciones.");
    }

    const servingsNum = parseFloat(recipeServings);
    if (isNaN(servingsNum) || servingsNum <= 0) {
      return alert("Ingresa una cantidad válida de porciones.");
    }

    const macros = await calculateRecipeMacros(selectedRecipe, servingsNum);
    if (!macros) {
      return alert("No se pudieron calcular las calorías de la receta.");
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
        .insert([
          { user_id: user!.id, date: selectedDate, meal_type: newMealType },
        ])
        .select()
        .single();
      mealId = newMeal?.id;
    }

    await supabase.from("meal_foods").insert([
      {
        meal_id: mealId,
        food_id: null,
        recipe_id: selectedRecipe,
        quantity: servingsNum, // nº de porciones de la receta
        is_portion: true,
        calories: macros.calories,
        protein: macros.protein,
        fat: macros.fat,
        carbs: macros.carbs,
      },
    ]);

    await fetchMeals(user!.id, selectedDate);
    resetRecipeForm();
  }

  // -----------------------------
  // Guardar edición de una comida
  // -----------------------------
  async function handleSaveEdit(mealId: string) {
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) return;

    for (const item of meal.meal_foods) {
      // Ítem basado en receta
      if (item.recipe_id) {
        const newQty = item.quantity;
        if (!newQty || newQty <= 0) continue;

        const macros = await calculateRecipeMacros(item.recipe_id, newQty);
        if (!macros) continue;

        await supabase
          .from("meal_foods")
          .update({
            quantity: newQty,
            is_portion: true,
            calories: macros.calories,
            protein: macros.protein,
            fat: macros.fat,
            carbs: macros.carbs,
          })
          .eq("id", item.id);
      } else {
        // Ítem basado en alimento, comportamiento actual
        const fd = item.foods;
        if (!fd) continue;

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
    }

    await fetchMeals(user!.id, selectedDate);
    setEditingMealId(null);
  }

  async function handleDeleteFood(foodId: string) {
    if (!confirm("¿Eliminar este ítem?")) return;
    await supabase.from("meal_foods").delete().eq("id", foodId);
    if (user) await fetchMeals(user.id, selectedDate);
  }

  // -----------------------------
  // Reset forms
  // -----------------------------
  function resetFoodForm() {
    setSelectedCategory("");
    setSelectedFood("");
    setQuantity("");
    setEntryMode("grams");
    setPreview(null);
  }

  function resetRecipeForm() {
    setSelectedRecipe("");
    setRecipeServings("");
    setRecipePreview(null);
  }

  // -----------------------------
  // Vista previa para alimentos (formulario)
  // -----------------------------
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

  // -----------------------------
  // Vista previa para recetas (formulario)
  // -----------------------------
  useEffect(() => {
    if (!selectedRecipe || !recipeServings) {
      setRecipePreview(null);
      return;
    }

    const servingsNum = parseFloat(recipeServings);
    if (isNaN(servingsNum) || servingsNum <= 0) {
      setRecipePreview(null);
      return;
    }

    (async () => {
      const macros = await calculateRecipeMacros(selectedRecipe, servingsNum);
      setRecipePreview(macros);
    })();
  }, [selectedRecipe, recipeServings, recipeStats, recipes, foods]);

  // Vista previa de edición (cada ítem ya guardado)
  const getEditPreview = (foodItem: FoodItem) => {
    // Para recetas usamos los valores ya guardados (calories/protein/fat/carbs)
    if (foodItem.recipe_id) {
      return {
        calories: Math.round(foodItem.calories),
        protein: +foodItem.protein.toFixed(1),
        fat: +foodItem.fat.toFixed(1),
        carbs: +foodItem.carbs.toFixed(1),
      };
    }

    const fd = foodItem.foods;
    if (!fd) {
      return {
        calories: Math.round(foodItem.calories),
        protein: +foodItem.protein.toFixed(1),
        fat: +foodItem.fat.toFixed(1),
        carbs: +foodItem.carbs.toFixed(1),
      };
    }

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
    (sum, meal) =>
      sum +
      meal.meal_foods.reduce((s, f) => {
        return s + (f.calories || 0);
      }, 0),
    0
  );

  const today = new Date().toISOString().split("T")[0];
  const selectedFoodObj = foods.find((f) => f.id === selectedFood);
  const selectedFoodHasPortion =
    !!selectedFoodObj && !!selectedFoodObj.reference_portion_grams;

  const currentModalRecipe =
    recipeModalId && recipes.find((r) => r.id === recipeModalId);
  const currentModalStats =
    recipeModalId && recipeStats[recipeModalId]
      ? recipeStats[recipeModalId]
      : null;

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
              const isRecipeItem = !!f.recipe_id && !!f.recipes;
              const editPreview = getEditPreview(f);

              let displayName = "";
              let unitLabel = "";

              if (isRecipeItem) {
                const recipe = f.recipes!;
                const label = recipe.serving_label || "porción";
                // Para mostrar en texto: cantidad + label, sin duplicar "1"
                unitLabel = `${f.quantity} ${label}`;
                displayName = recipe.name;
              } else {
                const fd = f.foods;
                displayName = fd ? fd.name : "Ítem";
                unitLabel = f.is_portion
                  ? fd && fd.reference_portion_name
                    ? `${f.quantity} ${fd.reference_portion_name}${
                        f.quantity > 1 ? "s" : ""
                      }`
                    : `${f.quantity} porciones`
                  : `${f.quantity} g`;
              }

              return (
                <li key={f.id} className="flex flex-col gap-1 mb-2">
                  {editingMealId === meal.id ? (
                    <>
                      <div className="flex items-center gap-2 w-full">
                        <span className="flex-1">
                          {displayName}{" "}
                          {isRecipeItem && (
                            <button
                              type="button"
                              onClick={() => setRecipeModalId(f.recipe_id!)}
                              className="ml-2 text-[11px] text-blue-300 underline"
                            >
                              Ver receta
                            </button>
                          )}
                        </span>
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
                          {isRecipeItem
                            ? f.recipes?.serving_label || "porc."
                            : f.is_portion
                            ? "porc."
                            : "g"}
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
                    <div className="flex justify-between items-center">
                      <div>
                        <span>
                          {displayName} - {unitLabel} (
                          {Math.round(f.calories)} kcal)
                        </span>
                        {isRecipeItem && (
                          <button
                            type="button"
                            onClick={() => setRecipeModalId(f.recipe_id!)}
                            className="ml-2 text-[11px] text-blue-300 underline"
                          >
                            Ver receta
                          </button>
                        )}
                      </div>
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

      {/* Toggle Alimento / Receta */}
      {goal && (
        <div className="mt-6 mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setAddMode("food")}
            className={`px-3 py-1 rounded text-sm ${
              addMode === "food"
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-200"
            }`}
          >
            Alimento
          </button>
          <button
            type="button"
            onClick={() => setAddMode("recipe")}
            className={`px-3 py-1 rounded text-sm ${
              addMode === "recipe"
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-200"
            }`}
          >
            Receta
          </button>
        </div>
      )}

      {/* Formulario de agregar ALIMENTO */}
      {goal && addMode === "food" && (
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
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
              Agregar alimento
            </button>
          </div>
        </div>
      )}

      {/* Formulario de agregar RECETA */}
      {goal && addMode === "recipe" && (
        <div className="mt-6 bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h4 className="font-semibold mb-2">Agregar receta</h4>
          <div className="flex flex-col gap-3">
            {/* Usa el mismo tipo de comida (newMealType) */}
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
              value={selectedRecipe}
              onChange={(e) => {
                setSelectedRecipe(e.target.value);
                setRecipeServings("");
                setRecipePreview(null);
              }}
              className="p-2 border border-gray-700 bg-gray-900 rounded text-gray-100"
            >
              <option value="">Selecciona receta</option>
              {recipes.map((r) => {
                const stats = recipeStats[r.id];
                const perServingKcal = stats
                  ? Math.round(stats.perServingCalories)
                  : null;

                return (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {perServingKcal !== null
                      ? ` · ${perServingKcal} kcal / porción`
                      : ""}
                  </option>
                );
              })}
            </select>

            {selectedRecipe && (
              <>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <div>
                    {(() => {
                      const r = recipes.find(
                        (x) => x.id === selectedRecipe
                      );
                      if (!r) return null;
                      const label = r.serving_label || "porción";
                      // Si hay total_servings >1 mostramos "X porciones", si no, mostramos el label tal cual
                      let text: string;
                      if (r.total_servings && r.total_servings > 1) {
                        const pluralLabel = label.endsWith("s")
                          ? label
                          : `${label}s`;
                        text = `${r.total_servings} ${pluralLabel}`;
                      } else if (r.total_servings) {
                        text = label;
                      } else {
                        text = label;
                      }
                      return (
                        <>
                          Pensada para{" "}
                          <span className="font-semibold">{text}</span>.
                        </>
                      );
                    })()}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecipeModalId(selectedRecipe)}
                    className="text-[11px] text-blue-300 underline"
                  >
                    Ver detalle
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    placeholder="Cantidad (porciones/platos)"
                    value={recipeServings}
                    onChange={(e) => setRecipeServings(e.target.value)}
                    className="p-2 border border-gray-700 bg-gray-900 rounded text-gray-100 flex-1"
                  />
                  <span className="text-gray-400 text-sm">porc.</span>
                </div>

                {recipePreview && (
                  <div className="bg-gray-700 p-3 rounded text-sm text-gray-100">
                    <p>
                      Vista previa:{" "}
                      <span className="font-bold">
                        {recipePreview.calories} kcal
                      </span>
                    </p>
                    <p>
                      Proteínas: {recipePreview.protein} g | Grasas:{" "}
                      {recipePreview.fat} g | Carbohidratos:{" "}
                      {recipePreview.carbs} g
                    </p>
                  </div>
                )}

                <button
                  onClick={handleAddRecipeToMeal}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Agregar receta
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de detalle de receta */}
      {recipeModalId && currentModalRecipe && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full p-4 relative">
            <button
              type="button"
              onClick={() => setRecipeModalId(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-sm"
            >
              ✕
            </button>

            <h3 className="text-lg font-semibold mb-2">
              {currentModalRecipe.name}
            </h3>

            {currentModalRecipe.description && (
              <p className="text-sm text-gray-300 mb-3 whitespace-pre-line">
                {currentModalRecipe.description}
              </p>
            )}

            <div className="text-xs text-gray-400 mb-3">
              {(() => {
                const r = currentModalRecipe;
                const label = r.serving_label || "porción";
                let text: string;
                if (r.total_servings && r.total_servings > 1) {
                  const pluralLabel = label.endsWith("s")
                    ? label
                    : `${label}s`;
                  text = `${r.total_servings} ${pluralLabel}`;
                } else if (r.total_servings) {
                  text = label;
                } else {
                  text = label;
                }
                return (
                  <>
                    Pensada para{" "}
                    <span className="font-semibold">{text}</span>.
                  </>
                );
              })()}
            </div>

            {currentModalStats && (
              <>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="border border-gray-700 rounded p-2">
                    <p className="text-[11px] text-gray-400">
                      Kcal totales
                    </p>
                    <p className="text-sm font-semibold">
                      {Math.round(currentModalStats.totalCalories)} kcal
                    </p>
                  </div>
                  <div className="border border-gray-700 rounded p-2">
                    <p className="text-[11px] text-gray-400">
                      Kcal por porción
                    </p>
                    <p className="text-sm font-semibold">
                      {Math.round(currentModalStats.perServingCalories)} kcal
                    </p>
                  </div>
                  <div className="border border-gray-700 rounded p-2">
                    <p className="text-[11px] text-gray-400">
                      Proteína total
                    </p>
                    <p className="text-sm font-semibold">
                      {currentModalStats.totalProtein.toFixed(1)} g
                    </p>
                  </div>
                  <div className="border border-gray-700 rounded p-2">
                    <p className="text-[11px] text-gray-400">
                      Proteína / porción
                    </p>
                    <p className="text-sm font-semibold">
                      {currentModalStats.perServingProtein.toFixed(1)} g
                    </p>
                  </div>
                  <div className="border border-gray-700 rounded p-2">
                    <p className="text-[11px] text-gray-400">Grasas totales</p>
                    <p className="text-sm font-semibold">
                      {currentModalStats.totalFat.toFixed(1)} g
                    </p>
                  </div>
                  <div className="border border-gray-700 rounded p-2">
                    <p className="text-[11px] text-gray-400">
                      Grasas / porción
                    </p>
                    <p className="text-sm font-semibold">
                      {currentModalStats.perServingFat.toFixed(1)} g
                    </p>
                  </div>
                  <div className="border border-gray-700 rounded p-2">
                    <p className="text-[11px] text-gray-400">
                      Carbohidratos totales
                    </p>
                    <p className="text-sm font-semibold">
                      {currentModalStats.totalCarbs.toFixed(1)} g
                    </p>
                  </div>
                  <div className="border border-gray-700 rounded p-2">
                    <p className="text-[11px] text-gray-400">
                      Carbohidratos / porción
                    </p>
                    <p className="text-sm font-semibold">
                      {currentModalStats.perServingCarbs.toFixed(1)} g
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-between mt-3">
              <button
                type="button"
                onClick={() => setRecipeModalId(null)}
                className="px-3 py-1 rounded border border-gray-600 text-sm"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecipeModalId(null);
                  router.push("/dashboard/recipes");
                }}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-sm"
              >
                Ver en Recetas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
