"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface User {
  id: string;
  email: string;
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
  created_by_user_id?: string | null;
  is_public?: boolean;
}

interface Recipe {
  id: string;
  name: string;
  description: string | null;
  total_servings: number | null;
  serving_label: string | null;
  is_public: boolean;
  created_by_user_id: string | null;
}

interface RecipeIngredientRow {
  id: string;
  recipe_id: string;
  food_id: string;
  grams: number;
}

interface IngredientDraft {
  localId: string; // id solo para React
  food_id: string;
  grams: string;
}

// Para el resumen (macros + lista)
interface RecipeIngredientSummary {
  id: string;
  foodName: string;
  grams: number;
  calories: number;
}

interface RecipeSummary {
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  totalGrams: number;
  ingredients: RecipeIngredientSummary[];
}

type RecipesTab = "mine" | "all";

export default function RecipesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  // mapa: recipeId -> resumen
  const [recipeSummaries, setRecipeSummaries] = useState<
    Record<string, RecipeSummary>
  >({});
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<RecipesTab>("mine");
  const [searchTerm, setSearchTerm] = useState("");

  // estado del formulario (modal)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [recipeName, setRecipeName] = useState("");
  const [description, setDescription] = useState("");
  const [servingLabel, setServingLabel] = useState("porción");
  const [totalServings, setTotalServings] = useState("1");
  const [isPublic, setIsPublic] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // en receta nueva = true, si hay receta y user, chequea dueño
  const isOwner =
    editingRecipe && user ? editingRecipe.created_by_user_id === user.id : true;

  // -------------------------------
  // Helper para construir resúmenes
  // -------------------------------
  function buildRecipeSummaries(
    recipesList: Recipe[],
    ingredientRows: RecipeIngredientRow[],
    foodsList: Food[]
  ): Record<string, RecipeSummary> {
    const summaries: Record<string, RecipeSummary> = {};

    recipesList.forEach((r) => {
      summaries[r.id] = {
        totalCalories: 0,
        totalProtein: 0,
        totalFat: 0,
        totalCarbs: 0,
        totalGrams: 0,
        ingredients: [],
      };
    });

    ingredientRows.forEach((row) => {
      const recipeId = row.recipe_id;
      const grams = row.grams || 0;
      if (!summaries[recipeId] || grams <= 0) return;

      const food = foodsList.find((f) => f.id === row.food_id);
      if (!food) return;

      const factor = grams / 100;

      const kcal = food.calories * factor;
      const protein = food.protein * factor;
      const fat = food.fat * factor;
      const carbs = food.carbs * factor;

      summaries[recipeId].totalCalories += kcal;
      summaries[recipeId].totalProtein += protein;
      summaries[recipeId].totalFat += fat;
      summaries[recipeId].totalCarbs += carbs;
      summaries[recipeId].totalGrams += grams;

      summaries[recipeId].ingredients.push({
        id: row.id,
        foodName: food.name,
        grams,
        calories: kcal,
      });
    });

    return summaries;
  }

  // -------------------------------
  // Carga inicial
  // -------------------------------
  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setLoading(false);
        return;
      }

      const userId = sessionData.session.user.id;
      setUser({
        id: userId,
        email: sessionData.session.user.email ?? "",
      });

      // foods: públicos + míos
      const { data: foodsData, error: foodsError } = await supabase
        .from("foods")
        .select("*")
        .or(`is_public.eq.true,created_by_user_id.eq.${userId}`)
        .order("name");

      if (foodsError) {
        console.error(foodsError);
      } else {
        setFoods(foodsData || []);
      }

      // recipes: públicas + mías
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
        setRecipeSummaries({});
        setLoading(false);
        return;
      }

      const recipesList = (recipesData || []) as Recipe[];
      setRecipes(recipesList);

      // Si hay recetas, cargar ingredientes para resumen
      if (recipesList.length > 0) {
        const recipeIds = recipesList.map((r) => r.id);

        const { data: ingredientsData, error: ingredientsError } =
          await supabase
            .from("recipe_ingredients")
            .select("id, recipe_id, food_id, grams")
            .in("recipe_id", recipeIds);

        if (ingredientsError) {
          console.error(ingredientsError);
          setRecipeSummaries({});
        } else {
          const summaries = buildRecipeSummaries(
            recipesList,
            (ingredientsData || []) as RecipeIngredientRow[],
            (foodsData || []) as Food[]
          );
          setRecipeSummaries(summaries);
        }
      } else {
        setRecipeSummaries({});
      }

      setLoading(false);
    }

    load();
  }, []);

  // -------------------------------
  // Helpers
  // -------------------------------
  function resetForm() {
    setEditingRecipe(null);
    setRecipeName("");
    setDescription("");
    setServingLabel("porción");
    setTotalServings("1");
    setIsPublic(false);
    setIngredients([]);
  }

  function handleNewRecipe() {
    resetForm();
    setIsModalOpen(true);
  }

  function addIngredientRow() {
    setIngredients((prev) => [
      ...prev,
      { localId: crypto.randomUUID(), food_id: "", grams: "" },
    ]);
  }

  function removeIngredientRow(localId: string) {
    setIngredients((prev) => prev.filter((ing) => ing.localId !== localId));
  }

  function toggleExpand(recipeId: string) {
    setExpandedRecipeId((current) =>
      current === recipeId ? null : recipeId
    );
  }

  // -------------------------------
  // Editar / ver receta
  // -------------------------------
  async function handleEditRecipe(recipe: Recipe) {
    if (!user) return;

    setEditingRecipe(recipe);
    setRecipeName(recipe.name);
    setDescription(recipe.description ?? "");
    setServingLabel(recipe.serving_label ?? "porción");
    setTotalServings(String(recipe.total_servings ?? 1));
    setIsPublic(recipe.is_public);

    // Traer ingredientes de esa receta
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("id, recipe_id, food_id, grams")
      .eq("recipe_id", recipe.id);

    if (error) {
      console.error(error);
      alert("Error al cargar ingredientes de la receta.");
      return;
    }

    const mapped: IngredientDraft[] = (data as RecipeIngredientRow[]).map(
      (row) => ({
        localId: row.id,
        food_id: row.food_id,
        grams: String(row.grams ?? ""),
      })
    );

    setIngredients(mapped);
    setIsModalOpen(true);
  }

  // -------------------------------
  // Guardar receta (crear / actualizar)
  // -------------------------------
  async function handleSaveRecipe() {
    if (!user) {
      alert("Sesión no encontrada.");
      return;
    }

    if (!recipeName.trim()) {
      alert("La receta necesita un nombre.");
      return;
    }

    const servingsNum = parseFloat(totalServings || "1");
    if (isNaN(servingsNum) || servingsNum <= 0) {
      alert("Porciones totales inválidas.");
      return;
    }

    const validIngredients = ingredients.filter(
      (ing) => ing.food_id && ing.grams && !isNaN(parseFloat(ing.grams))
    );

    if (validIngredients.length === 0) {
      alert("Agrega al menos un ingrediente con cantidad válida.");
      return;
    }

    setSaving(true);

    try {
      let recipeId = editingRecipe?.id;

      if (!editingRecipe) {
        // Crear nueva receta
        const { data: newRecipeData, error: newRecipeError } = await supabase
          .from("recipes")
          .insert([
            {
              name: recipeName.trim(),
              description: description.trim() || null,
              serving_label: servingLabel.trim() || "1 porción",
              total_servings: servingsNum,
              is_public: isPublic,
              created_by_user_id: user.id,
            },
          ])
          .select()
          .single();

        if (newRecipeError) {
          console.error(newRecipeError);
          alert("Error al crear la receta.");
          return;
        }

        recipeId = (newRecipeData as Recipe).id as string;
      } else {
        // Actualizar receta existente (solo si soy dueño)
        if (editingRecipe.created_by_user_id !== user.id) {
          alert("No puedes editar una receta que no creaste.");
          setSaving(false);
          return;
        }

        const { error: updateError } = await supabase
          .from("recipes")
          .update({
            name: recipeName.trim(),
            description: description.trim() || null,
            serving_label: servingLabel.trim() || "porción",
            total_servings: servingsNum,
            is_public: isPublic,
          })
          .eq("id", editingRecipe.id);

        if (updateError) {
          console.error(updateError);
          alert("Error al actualizar la receta.");
          setSaving(false);
          return;
        }

        // Borrar ingredientes anteriores
        const { error: deleteError } = await supabase
          .from("recipe_ingredients")
          .delete()
          .eq("recipe_id", editingRecipe.id);

        if (deleteError) {
          console.error(deleteError);
          alert("Error al actualizar los ingredientes.");
          setSaving(false);
          return;
        }
      }

      // Insertar ingredientes actuales
      const rowsToInsert = validIngredients.map((ing) => ({
        recipe_id: recipeId,
        food_id: ing.food_id,
        grams: parseFloat(ing.grams),
      }));

      const { error: insertIngError } = await supabase
        .from("recipe_ingredients")
        .insert(rowsToInsert);

      if (insertIngError) {
        console.error(insertIngError);
        alert("Error al guardar los ingredientes.");
        setSaving(false);
        return;
      }

      // Refrescar lista de recetas
      const { data: refreshed, error: refreshError } = await supabase
        .from("recipes")
        .select(
          "id, name, description, total_servings, serving_label, is_public, created_by_user_id"
        )
        .or(`is_public.eq.true,created_by_user_id.eq.${user.id}`)
        .order("name");

      if (!refreshError && refreshed) {
        const refreshedList = refreshed as Recipe[];
        setRecipes(refreshedList);

        // Volver a cargar ingredientes para actualizar resúmenes
        if (refreshedList.length > 0) {
          const recipeIds = refreshedList.map((r) => r.id);
          const { data: ingredientsRows, error: ingErr } = await supabase
            .from("recipe_ingredients")
            .select("id, recipe_id, food_id, grams")
            .in("recipe_id", recipeIds);

          if (!ingErr && ingredientsRows) {
            const summaries = buildRecipeSummaries(
              refreshedList,
              ingredientsRows as RecipeIngredientRow[],
              foods
            );
            setRecipeSummaries(summaries);
          }
        } else {
          setRecipeSummaries({});
        }
      }

      alert("Receta guardada correctamente.");
      resetForm();
      setIsModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  // -------------------------------
  // Texto de etiquetas
  // -------------------------------
  function getRecipeBadge(recipe: Recipe) {
    if (!user) return recipe.is_public ? "Pública" : "Privada";

    if (recipe.created_by_user_id === user.id) {
      return recipe.is_public ? "Mía · pública" : "Mía · privada";
    }
    return "Pública";
  }

  if (loading) {
    return <p className="text-gray-300 p-6">Cargando recetas…</p>;
  }

  // -------------------------------
  // Derivados para las pestañas + filtro
  // -------------------------------
  const myRecipes =
    user ? recipes.filter((r) => r.created_by_user_id === user.id) : [];

  const baseList = activeTab === "mine" ? myRecipes : recipes;

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const displayedRecipes = normalizedSearch
    ? baseList.filter((r) =>
        r.name.toLowerCase().includes(normalizedSearch)
      )
    : baseList;

  return (
    <div className="max-w-4xl mx-auto text-gray-100">
      <h1 className="text-3xl font-bold mb-6 text-white">Recetas</h1>

      {/* Contenedor principal con scroll interno para la lista */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        {/* Header: título + botón nueva receta */}
        <div className="flex flex-col gap-2 mb-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-semibold">Listado</h2>
          <button
            onClick={handleNewRecipe}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm self-start md:self-auto"
          >
            + Nueva receta
          </button>
        </div>

        {/* Tabs + buscador (sticky dentro del contenedor de lista) */}
        <div className="sticky top-0 z-10 pb-2 bg-gray-900">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            {/* Pestañas */}
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("mine")}
                className={`px-3 py-1.5 rounded-full border ${
                  activeTab === "mine"
                    ? "bg-white text-gray-900 border-white"
                    : "border-gray-600 text-gray-300 hover:bg-gray-800"
                }`}
              >
                Mis recetas
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-full border ${
                  activeTab === "all"
                    ? "bg-white text-gray-900 border-white"
                    : "border-gray-600 text-gray-300 hover:bg-gray-800"
                }`}
              >
                Públicas + mías
              </button>
            </div>

            {/* Filtro por nombre */}
            <div className="w-full md:w-64">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar receta por nombre…"
                  className="w-full pl-3 pr-8 py-1.5 rounded border border-gray-700 bg-gray-800 text-xs text-gray-100 placeholder:text-gray-500"
                />
                <span className="absolute right-2 top-1.5 text-gray-500 text-xs">
                  🔍
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Lista con scroll interno */}
        <div className="mt-2 max-h-[500px] overflow-y-auto pr-1">
          {displayedRecipes.length === 0 ? (
            <p className="text-gray-400 italic text-sm">
              {activeTab === "mine"
                ? "Aún no has creado recetas. Crea la primera con el botón “Nueva receta”."
                : "No hay recetas que coincidan con el filtro."}
            </p>
          ) : (
            <div className="space-y-2">
              {displayedRecipes.map((r) => {
                const badge = getRecipeBadge(r);
                const mine = user && r.created_by_user_id === user.id;
                const summary = recipeSummaries[r.id];
                const isExpanded = expandedRecipeId === r.id;

                const servingsNum = r.total_servings || 1;
                const totalKcal = summary ? summary.totalCalories : 0;
                const kcalPerServing =
                  servingsNum > 0 ? totalKcal / servingsNum : totalKcal;

                const totalGrams = summary ? summary.totalGrams : 0;
                const gramsPerServing =
                  servingsNum > 0 ? totalGrams / servingsNum : totalGrams;

                return (
                  <div
                    key={r.id}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-3"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="font-semibold text-white">{r.name}</p>
                        {r.description && (
                          <p className="text-xs text-gray-400 line-clamp-2">
                            {r.description}
                          </p>
                        )}
                        {summary && (
                          <p className="text-[11px] text-gray-400 mt-1">
                            {Math.round(totalKcal)} kcal totales
                            {servingsNum > 0 && (
                              <>
                                {" "}· {servingsNum} porciones (
                                {Math.round(kcalPerServing)} kcal / porción)
                              </>
                            )}
                            {totalGrams > 0 && (
                              <>
                                {" "}· {Math.round(totalGrams)} g totales
                                {servingsNum > 0 && (
                                  <> (~{Math.round(gramsPerServing)} g / porción)</>
                                )}
                              </>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-200">
                          {badge}
                        </span>
                        <div className="flex gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => toggleExpand(r.id)}
                            className="text-[11px] px-2 py-1 rounded border border-gray-600 hover:bg-gray-700"
                          >
                            {isExpanded ? "Ocultar resumen" : "Ver resumen"}
                          </button>
                          {mine && (
                            <button
                              type="button"
                              onClick={() => handleEditRecipe(r)}
                              className="text-[11px] px-2 py-1 rounded border border-blue-500 text-blue-200 hover:bg-blue-600/20"
                            >
                              Editar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Panel desplegable con resumen */}
                    {isExpanded && (
                      <div className="mt-3 border-t border-gray-700 pt-3 text-xs">
                        {!summary || summary.ingredients.length === 0 ? (
                          <p className="text-gray-400">
                            Esta receta aún no tiene ingredientes o no se pudo
                            calcular el resumen.
                          </p>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                              <div className="border border-gray-700 rounded p-2">
                                <p className="text-[11px] text-gray-400">
                                  Kcal totales
                                </p>
                                <p className="text-sm font-semibold">
                                  {Math.round(summary.totalCalories)} kcal
                                </p>
                              </div>
                              <div className="border border-gray-700 rounded p-2">
                                <p className="text-[11px] text-gray-400">
                                  Proteína
                                </p>
                                <p className="text-sm font-semibold">
                                  {summary.totalProtein.toFixed(1)} g
                                </p>
                              </div>
                              <div className="border border-gray-700 rounded p-2">
                                <p className="text-[11px] text-gray-400">
                                  Carbohidratos
                                </p>
                                <p className="text-sm font-semibold">
                                  {summary.totalCarbs.toFixed(1)} g
                                </p>
                              </div>
                              <div className="border border-gray-700 rounded p-2">
                                <p className="text-[11px] text-gray-400">
                                  Grasas
                                </p>
                                <p className="text-sm font-semibold">
                                  {summary.totalFat.toFixed(1)} g
                                </p>
                              </div>
                            </div>

                            <p className="font-semibold mb-1">Ingredientes</p>
                            <div className="space-y-1">
                              {summary.ingredients.map((ing) => (
                                <div
                                  key={ing.id}
                                  className="flex justify-between items-center border border-gray-700 rounded px-2 py-1"
                                >
                                  <div>
                                    <p className="text-xs font-medium">
                                      {ing.foodName}
                                    </p>
                                    <p className="text-[11px] text-gray-400">
                                      {ing.grams} g
                                    </p>
                                  </div>
                                  <p className="text-[11px] text-gray-300">
                                    {Math.round(ing.calories)} kcal
                                  </p>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL Crear / Editar receta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 relative">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-sm"
            >
              ✕
            </button>

            <h2 className="text-xl font-semibold mb-3">
              {editingRecipe ? "Editar receta" : "Nueva receta"}
            </h2>

            {editingRecipe && !isOwner && (
              <p className="text-xs text-yellow-400 mb-3">
                Esta receta es pública y fue creada por otro usuario. Solo
                puedes verla, no editarla.
              </p>
            )}

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-sm mb-1">Nombre</label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  disabled={!!editingRecipe && !isOwner}
                  className="w-full p-2 border border-gray-700 bg-gray-800 rounded text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!!editingRecipe && !isOwner}
                  className="w-full p-2 border border-gray-700 bg-gray-800 rounded text-gray-100 text-sm"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">
                    Porciones totales
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={totalServings}
                    onChange={(e) => setTotalServings(e.target.value)}
                    disabled={!!editingRecipe && !isOwner}
                    className="w-full p-2 border border-gray-700 bg-gray-800 rounded text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">
                    Texto de porción (ej: “plato”, “sandwich”)
                  </label>
                  <input
                    type="text"
                    value={servingLabel}
                    onChange={(e) => setServingLabel(e.target.value)}
                    disabled={!!editingRecipe && !isOwner}
                    className="w-full p-2 border border-gray-700 bg-gray-800 rounded text-gray-100"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Ej: si pones “plato” y porciones = 4 → “Pensada para 4
                    platos”.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  id="is_public"
                  type="checkbox"
                  checked={isPublic}
                  disabled={!!editingRecipe && !isOwner}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="is_public" className="text-sm">
                  Hacer receta pública (visible para todos)
                </label>
              </div>

              {/* Ingredientes */}
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">Ingredientes</h3>
                  {(!editingRecipe || isOwner) && (
                    <button
                      type="button"
                      onClick={addIngredientRow}
                      className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
                    >
                      + Agregar ingrediente
                    </button>
                  )}
                </div>

                {ingredients.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Aún no has agregado ingredientes.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ingredients.map((ing) => {
                      const food = foods.find((f) => f.id === ing.food_id);
                      return (
                        <div
                          key={ing.localId}
                          className="flex flex-col gap-1 border border-gray-700 rounded p-2 bg-gray-850"
                        >
                          <div className="flex gap-2">
                            <select
                              value={ing.food_id}
                              disabled={!!editingRecipe && !isOwner}
                              onChange={(e) => {
                                const value = e.target.value;
                                setIngredients((prev) =>
                                  prev.map((item) =>
                                    item.localId === ing.localId
                                      ? { ...item, food_id: value }
                                      : item
                                  )
                                );
                              }}
                              className="flex-1 p-2 border border-gray-700 bg-gray-900 rounded text-gray-100 text-sm"
                            >
                              <option value="">Selecciona alimento</option>
                              {foods.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>

                            <input
                              type="number"
                              min={0}
                              step="1"
                              placeholder="g"
                              value={ing.grams}
                              disabled={!!editingRecipe && !isOwner}
                              onChange={(e) => {
                                const value = e.target.value;
                                setIngredients((prev) =>
                                  prev.map((item) =>
                                    item.localId === ing.localId
                                      ? { ...item, grams: value }
                                      : item
                                  )
                                );
                              }}
                              className="w-24 p-2 border border-gray-700 bg-gray-900 rounded text-gray-100 text-sm"
                            />

                            {(!editingRecipe || isOwner) && (
                              <button
                                type="button"
                                onClick={() => removeIngredientRow(ing.localId)}
                                className="text-xs text-red-400 hover:text-red-300 px-2"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>

                          {food &&
                            ing.grams &&
                            !isNaN(parseFloat(ing.grams)) && (
                              <p className="text-[11px] text-gray-400">
                                {(() => {
                                  const grams = parseFloat(ing.grams);
                                  const factor = grams / 100;
                                  const kcal = Math.round(
                                    food.calories * factor
                                  );
                                  return `${grams} g · aprox. ${kcal} kcal`;
                                })()}
                              </p>
                            )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Botones */}
              {(!editingRecipe || isOwner) && (
                <div className="mt-4 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                    }}
                    className="px-4 py-2 rounded border border-gray-600 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveRecipe}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded text-sm"
                  >
                    {saving
                      ? "Guardando..."
                      : editingRecipe
                      ? "Guardar cambios"
                      : "Crear receta"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
