import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import UpdatePasswordForm from "../../ui/update-password-form";

export const metadata = { title: "Update password | PashuRaksha" };

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <UpdatePasswordForm />;
}
