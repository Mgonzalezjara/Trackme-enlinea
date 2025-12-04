"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Disclosure } from "@headlessui/react";

interface Category {
  id: string;
  name: string;
}

interface Food {
  id: string;
  name: string;
  category_id: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  reference_portion_name?: string | null;
  reference_portion_grams?: number | null;
  created_by_user_id?: string | null;
  is_public?: boolean;
}

type Scope = "all" | "mine";

export default function FoodsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewByPortion, setViewByPortion] = useState(false);
  const [scope, setScope] = useState<Scope>("all");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      // 1) Obtener sesión
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id ?? null;
      setUserId(currentUserId);

      // 2) Categorías
      const { data: catData } = await supabase
        .from("food_categories")
        .select("*")
        .order("name");

      // 3) Alimentos: si hay usuario → públicos + suyos.
      //    si NO hay usuario → solo públicos.
      let foodQuery = supabase.from("foods").select("*").order("name");

      if (currentUserId) {
        foodQuery = foodQuery.or(
          `is_public.eq.true,created_by_user_id.eq.${currentUserId}`
        );
      } else {
        foodQuery = foodQuery.eq("is_public", true);
      }

      const { data: foodData } = await foodQuery;

      setCategories(catData || []);
      setFoods(foodData || []);
      setLoading(false);
    }

    loadData();
  }, []);

  const getFoodsByCategory = (categoryId: string) =>
    foods.filter((f) => {
      if (f.category_id !== categoryId) return false;
      if (scope === "mine") {
        if (!userId) return false;
        return f.created_by_user_id === userId;
      }
      // scope === "all"
      return true;
    });

  const renderMacros = (
    food: Food,
    macro: "calories" | "protein" | "fat" | "carbs"
  ) => {
    const baseValue = (food as any)[macro] ?? 0;

    if (!viewByPortion || !food.reference_portion_grams || !baseValue) {
      return baseValue;
    }

    return ((baseValue * food.reference_portion_grams) / 100).toFixed(1);
  };

  if (loading) return <p className="p-8 text-gray-300">Cargando...</p>;

  return (
    <div className="p-8 max-w-3xl mx-auto text-gray-100">
      <h1 className="text-3xl font-bold mb-2 text-white">Alimentos por Categoría</h1>
      <p className="text-sm text-gray-400 mb-6">
        Los alimentos marcados como <span className="text-blue-400 font-semibold">Propio</span>{" "}
        son creados solo por ti.
      </p>

      {/* Tabs de alcance (todos / mis alimentos) */}
      <div className="flex gap-3 mb-4">
        <button
          className={`px-3 py-2 rounded text-sm ${
            scope === "all"
              ? "bg-indigo-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
          onClick={() => setScope("all")}
        >
          Todos los alimentos
        </button>
        <button
          className={`px-3 py-2 rounded text-sm ${
            scope === "mine"
              ? "bg-indigo-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
          onClick={() => setScope("mine")}
        >
          Mis alimentos
        </button>
      </div>

      {/* Tabs de visualización (100 g / porción) */}
      <div className="flex gap-4 mb-6">
        <button
          className={`px-4 py-2 rounded ${
            !viewByPortion
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
          onClick={() => setViewByPortion(false)}
        >
          Por 100 g
        </button>
        <button
          className={`px-4 py-2 rounded ${
            viewByPortion
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
          onClick={() => setViewByPortion(true)}
        >
          Por porción
        </button>
      </div>

      {/* Lista por categorías */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const foodsInCat = getFoodsByCategory(cat.id);
          if (foodsInCat.length === 0) return null;

          return (
            <Disclosure key={cat.id}>
              {({ open }) => (
                <div className="border border-gray-700 rounded shadow-sm">
                  <Disclosure.Button
                    className={`flex justify-between w-full px-4 py-3 text-left text-lg font-semibold ${
                      open
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-200 hover:bg-gray-700"
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span>{open ? "−" : "+"}</span>
                  </Disclosure.Button>
                  <Disclosure.Panel className="px-4 pb-4 pt-3 bg-gray-900 text-gray-100">
                    <table className="w-full border-collapse border border-gray-700 text-sm">
                      <thead>
                        <tr className="bg-gray-800 text-gray-200">
                          <th className="border border-gray-700 p-2 text-left">
                            Alimento
                          </th>
                          <th className="border border-gray-700 p-2 text-right">
                            {viewByPortion
                              ? "Calorías (por porción)"
                              : "Calorías / 100g"}
                          </th>
                          <th className="border border-gray-700 p-2 text-right">
                            Proteínas
                          </th>
                          <th className="border border-gray-700 p-2 text-right">
                            Grasas
                          </th>
                          <th className="border border-gray-700 p-2 text-right">
                            Carbohidratos
                          </th>
                          <th className="border border-gray-700 p-2 text-right">
                            {viewByPortion ? "Porción" : "Porción ref."}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {foodsInCat.map((food, idx) => {
                          const isMine =
                            !!userId && food.created_by_user_id === userId;

                          return (
                            <tr
                              key={food.id}
                              className={
                                idx % 2 === 0 ? "bg-gray-900" : "bg-gray-800"
                              }
                            >
                              <td className="border border-gray-700 p-2">
                                <div className="flex items-center gap-2">
                                  <span>{food.name}</span>
                                  {isMine && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900 text-blue-200 border border-blue-500">
                                      Propio
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="border border-gray-700 p-2 text-right">
                                {renderMacros(food, "calories")}
                              </td>
                              <td className="border border-gray-700 p-2 text-right">
                                {renderMacros(food, "protein")}
                              </td>
                              <td className="border border-gray-700 p-2 text-right">
                                {renderMacros(food, "fat")}
                              </td>
                              <td className="border border-gray-700 p-2 text-right">
                                {renderMacros(food, "carbs")}
                              </td>
                              <td className="border border-gray-700 p-2 text-right">
                                {food.reference_portion_name &&
                                food.reference_portion_grams
                                  ? `${food.reference_portion_name} = ${food.reference_portion_grams} g`
                                  : "–"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Disclosure.Panel>
                </div>
              )}
            </Disclosure>
          );
        })}
      </div>
    </div>
  );
}
