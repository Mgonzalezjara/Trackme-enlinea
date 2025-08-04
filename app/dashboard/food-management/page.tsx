"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function FoodManagementPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      const { data, error } = await supabase.from("food_categories").select("*").order("name");
      if (!error) setCategories(data || []);
      setLoading(false);
    }
    fetchCategories();
  }, []);

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem("categoryName") as HTMLInputElement).value.trim();
    if (!name) return;

    const { error } = await supabase.from("food_categories").insert([{ name }]);
    if (error) {
      alert("Error adding category: " + error.message);
    } else {
      alert("Category added!");
      const { data } = await supabase.from("food_categories").select("*").order("name");
      setCategories(data || []);
    }
    form.reset();
  }

  async function handleAddFood(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const name = (form.elements.namedItem("foodName") as HTMLInputElement).value.trim();
    const category = (form.elements.namedItem("foodCategory") as HTMLSelectElement).value;
    const calories = parseFloat((form.elements.namedItem("calories") as HTMLInputElement).value);
    const protein = parseFloat((form.elements.namedItem("protein") as HTMLInputElement).value) || 0;
    const fat = parseFloat((form.elements.namedItem("fat") as HTMLInputElement).value) || 0;
    const carbs = parseFloat((form.elements.namedItem("carbs") as HTMLInputElement).value) || 0;

    if (!name || !category || isNaN(calories)) return alert("Please fill all required fields.");

    const { error } = await supabase.from("foods").insert([{ name, category_id: category, calories, protein, fat, carbs }]);
    if (error) {
      alert("Error adding food: " + error.message);
    } else {
      alert("Food added successfully!");
    }
    form.reset();
  }

  if (loading) return <p className="p-6 text-gray-200">Loading...</p>;

  return (
    <div className="max-w-2xl mx-auto bg-gray-900 shadow-lg rounded-lg p-6 text-gray-100">
      <h2 className="text-2xl font-bold mb-6 text-white">Food Management</h2>

      {/* Add Category */}
      <div className="mb-8">
        <h3 className="font-semibold mb-3 text-gray-300">Add Category</h3>
        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            name="categoryName"
            placeholder="Category name"
            className="p-3 border border-gray-700 bg-gray-800 rounded flex-1 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Add</button>
        </form>
      </div>

      {/* Add Food */}
      <div>
        <h3 className="font-semibold mb-3 text-gray-300">Add Food</h3>
        <form onSubmit={handleAddFood} className="flex flex-col gap-3">
          <input
            name="foodName"
            placeholder="Food name"
            className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <select
            name="foodCategory"
            className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="0.1"
              name="calories"
              placeholder="Calories per 100g"
              className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="number"
              step="0.1"
              name="protein"
              placeholder="Protein (g)"
              className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              step="0.1"
              name="fat"
              placeholder="Fat (g)"
              className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              step="0.1"
              name="carbs"
              placeholder="Carbs (g)"
              className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded mt-2">Add Food</button>
        </form>
      </div>
    </div>
  );
}
