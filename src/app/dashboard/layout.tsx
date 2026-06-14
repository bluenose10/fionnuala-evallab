import { redirect } from "next/navigation";
import { FlaskConical, LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware guards this already; this is a defensive fallback.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-muted/20 md:block">
        <div className="flex h-16 items-center gap-2 border-b px-6 font-semibold">
          <FlaskConical className="h-5 w-5 text-primary" />
          EvalLab
        </div>
        <Sidebar />
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-6">
          <span className="text-sm text-muted-foreground md:hidden">
            EvalLab
          </span>
          <div className="ml-auto flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.email}
            </span>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
