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
}

export default function FoodsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: catData } = await supabase.from("food_categories").select("*").order("name");
      const { data: foodData } = await supabase.from("foods").select("*").order("name");
      setCategories(catData || []);
      setFoods(foodData || []);
      setLoading(false);
    }
    loadData();
  }, []);

  const getFoodsByCategory = (categoryId: string) =>
    foods.filter((f) => f.category_id === categoryId);

  if (loading) return <p className="p-8 text-gray-300">Loading...</p>;

  return (
    <div className="p-8 max-w-3xl mx-auto text-gray-100">
      <h1 className="text-3xl font-bold mb-6 text-white">Foods by Category</h1>
      <div className="space-y-4">
        {categories.map((cat) => (
          <Disclosure key={cat.id}>
            {({ open }) => (
              <div className="border border-gray-700 rounded shadow-sm">
                <Disclosure.Button
                  className={`flex justify-between w-full px-4 py-3 text-left text-lg font-semibold ${
                    open ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-200 hover:bg-gray-700"
                  }`}
                >
                  <span>{cat.name}</span>
                  <span>{open ? "−" : "+"}</span>
                </Disclosure.Button>
                <Disclosure.Panel className="px-4 pb-4 pt-3 bg-gray-900 text-gray-100">
                  {getFoodsByCategory(cat.id).length > 0 ? (
                    <table className="w-full border-collapse border border-gray-700 text-sm">
                      <thead>
                        <tr className="bg-gray-800 text-gray-200">
                          <th className="border border-gray-700 p-2 text-left">Food</th>
                          <th className="border border-gray-700 p-2 text-right">Calories</th>
                          <th className="border border-gray-700 p-2 text-right">Protein</th>
                          <th className="border border-gray-700 p-2 text-right">Fat</th>
                          <th className="border border-gray-700 p-2 text-right">Carbs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getFoodsByCategory(cat.id).map((food, idx) => (
                          <tr key={food.id} className={idx % 2 === 0 ? "bg-gray-900" : "bg-gray-800"}>
                            <td className="border border-gray-700 p-2">{food.name}</td>
                            <td className="border border-gray-700 p-2 text-right">{food.calories}</td>
                            <td className="border border-gray-700 p-2 text-right">{food.protein || 0}</td>
                            <td className="border border-gray-700 p-2 text-right">{food.fat || 0}</td>
                            <td className="border border-gray-700 p-2 text-right">{food.carbs || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-gray-400 mt-2 italic">No foods in this category.</p>
                  )}
                </Disclosure.Panel>
              </div>
            )}
          </Disclosure>
        ))}
      </div>
    </div>
  );
}
