"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";

export async function addAnimal(_previousState, formData) {
  const name = String(formData.get("name") || "").trim();
  const tag = String(formData.get("tag") || "").trim();
  const breed = String(formData.get("breed") || "").trim();

  if (name.length < 2 || tag.length < 1) return { error: "Animal name and ID tag are required." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again to add an animal." };

  const { data: farm, error: farmError } = await supabase.from("farms").select("id").eq("owner_id", user.id).maybeSingle();
  if (farmError || !farm) return { error: "Your farm workspace is not ready yet. Refresh after verifying your email." };

  const { error } = await supabase.from("animals").insert({ farm_id: farm.id, name, tag, breed: breed || null });
  if (error) return { error: error.code === "23505" ? "That animal ID is already in use on this farm." : error.message };

  revalidatePath("/dashboard");
  return { success: `${name} has been added to your herd.` };
}
