import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { LabInterface } from "@/components/dashboard/lab-interface";

export default async function RetrievalLabPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensive fallback; middleware already guards this route.
  if (!user) {
    redirect("/login");
  }

  return <LabInterface userId={user.id} />;
}
