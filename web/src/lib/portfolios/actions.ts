"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export interface PortfolioFormError {
  error: string;
}

export async function createPortfolio(
  formData: FormData
): Promise<PortfolioFormError | void> {
  const name = (formData.get("name") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() ?? null;

  if (!name) {
    return { error: "Portfolio name is required." };
  }
  if (name.length > 80) {
    return { error: "Portfolio name must be 80 characters or less." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data, error } = await supabase
    .from("portfolios")
    .insert({ owner_id: user.id, name, description })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Failed to create portfolio." };
  }

  revalidatePath("/app");
  redirect(`/app/portfolio/${data.id}`);
}

export async function updatePortfolio(
  portfolioId: string,
  formData: FormData
): Promise<PortfolioFormError | void> {
  const name = (formData.get("name") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() ?? null;

  if (!name) return { error: "Portfolio name is required." };
  if (name.length > 80) return { error: "Portfolio name must be 80 characters or less." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("portfolios")
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq("id", portfolioId);

  if (error) return { error: error.message };

  revalidatePath("/app");
  revalidatePath(`/app/portfolio/${portfolioId}`);
}

export async function deletePortfolio(portfolioId: string): Promise<PortfolioFormError | void> {
  const supabase = await createClient();
  const { error } = await supabase.from("portfolios").delete().eq("id", portfolioId);
  if (error) return { error: error.message };

  revalidatePath("/app");
  redirect("/app");
}
