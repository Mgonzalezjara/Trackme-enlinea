"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Category {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
}

export default function FoodManagementPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function init() {
      // 1) Obtener sesión / usuario
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (session) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? "",
        });
      }

      // 2) Cargar categorías
      const { data, error } = await supabase
        .from("food_categories")
        .select("*")
        .order("name");

      if (!error) setCategories(data || []);
      setLoading(false);
    }
    init();
  }, []);

  async function handleAddCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const nameInput = form.elements.namedItem("categoryName") as HTMLInputElement;
    const name = nameInput.value.trim();
    if (!name) return;

    const { error } = await supabase.from("food_categories").insert([{ name }]);
    if (error) {
      alert("Error al agregar la categoría: " + error.message);
    } else {
      alert("¡Categoría agregada!");
      const { data } = await supabase
        .from("food_categories")
        .select("*")
        .order("name");
      setCategories(data || []);
    }
    form.reset();
  }

  async function handleAddFood(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;

    const name = (form.elements.namedItem("foodName") as HTMLInputElement).value.trim();
    const category = (form.elements.namedItem("foodCategory") as HTMLSelectElement).value;
    const calories = parseFloat(
      (form.elements.namedItem("calories") as HTMLInputElement).value
    );
    const protein =
      parseFloat((form.elements.namedItem("protein") as HTMLInputElement).value) || 0;
    const fat =
      parseFloat((form.elements.namedItem("fat") as HTMLInputElement).value) || 0;
    const carbs =
      parseFloat((form.elements.namedItem("carbs") as HTMLInputElement).value) || 0;

    // Porción de referencia
    const portionLabel =
      (form.elements.namedItem("reference_portion_name") as HTMLSelectElement).value ||
      null;
    const portionGramsRaw = (
      form.elements.namedItem("reference_portion_grams") as HTMLInputElement
    ).value;
    const portionGrams = portionGramsRaw ? parseFloat(portionGramsRaw) : null;

    // Checkbox "Solo para mí"
    const isPrivate = (
      form.elements.namedItem("isPrivate") as HTMLInputElement
    ).checked;

    if (!name || !category || isNaN(calories)) {
      return alert("Por favor completa todos los campos requeridos.");
    }

    const payload: any = {
      name,
      category_id: category,
      calories,
      protein,
      fat,
      carbs,
      reference_portion_name: portionLabel,
      reference_portion_grams: portionGrams,
      created_by_user_id: user ? user.id : null,
      is_public: !isPrivate,
    };

    const { error } = await supabase.from("foods").insert([payload]);

    if (error) {
      alert("Error al agregar el alimento: " + error.message);
    } else {
      alert("¡Alimento agregado con éxito!");
    }

    form.reset();
  }

  if (loading) return <p className="p-6 text-gray-200">Cargando...</p>;

  return (
    <div className="max-w-2xl mx-auto bg-gray-900 shadow-lg rounded-lg p-6 text-gray-100">
      <h2 className="text-2xl font-bold mb-6 text-white">Gestión de Alimentos</h2>

      {/* Info de usuario */}
      {!user && (
        <p className="text-sm text-red-400 mb-4">
          ⚠️ Debes iniciar sesión para crear alimentos personales.
        </p>
      )}

      {/* Agregar Categoría */}
      <div className="mb-8">
        <h3 className="font-semibold mb-3 text-gray-300">Agregar Categoría</h3>
        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            name="categoryName"
            placeholder="Nombre de la categoría"
            className="p-3 border border-gray-700 bg-gray-800 rounded flex-1 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
            Agregar
          </button>
        </form>
      </div>

      {/* Agregar Alimento */}
      <div>
        <h3 className="font-semibold mb-3 text-gray-300">Agregar Alimento</h3>
        <form onSubmit={handleAddFood} className="flex flex-col gap-3">
          {/* Porción de referencia */}
          <div className="grid grid-cols-2 gap-3">
            <select
              name="reference_portion_name"
              className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Porción de referencia (opcional)</option>
              <option value="vaso">vaso</option>
              <option value="taza">taza</option>
              <option value="cucharada">cucharada</option>
              <option value="cucharadita">cucharadita</option>
              <option value="rebanada">rebanada</option>
              <option value="unidad">unidad</option>
              <option value="puñado">puñado</option>
              <option value="porción">porción</option>
              <option value="filete">filete</option>
            </select>

            <input
              type="number"
              step="1"
              name="reference_portion_grams"
              placeholder="Gramos por porción"
              className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Nombre */}
          <input
            name="foodName"
            placeholder="Nombre del alimento"
            className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />

          {/* Categoría */}
          <select
            name="foodCategory"
            className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Selecciona una categoría</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Macros */}
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="0.1"
              name="calories"
              placeholder="Calorías por 100g"
              className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="number"
              step="0.1"
              name="protein"
              placeholder="Proteínas (g)"
              className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              step="0.1"
              name="fat"
              placeholder="Grasas (g)"
              className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              step="0.1"
              name="carbs"
              placeholder="Carbohidratos (g)"
              className="p-3 border border-gray-700 bg-gray-800 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Checkbox solo para mí */}
          <label className="flex items-center gap-2 text-sm text-gray-300 mt-2">
            <input
              type="checkbox"
              name="isPrivate"
              className="w-4 h-4 accent-blue-500"
              disabled={!user}
            />
            <span>Guardar este alimento solo para mí</span>
          </label>

          <button className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded mt-2">
            Agregar Alimento
          </button>
        </form>
      </div>
    </div>
  );
}
