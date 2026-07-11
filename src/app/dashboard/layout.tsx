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

  if (!user) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className="hidden w-56 shrink-0 flex-col border-r border-border/60 bg-card/40 md:flex"
        style={{ boxShadow: "1px 0 0 0 rgba(34,197,94,0.06)" }}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-border/60 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 border border-primary/25">
            <FlaskConical className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            fionnuala
          </span>
          <span className="ml-auto rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
            Live
          </span>
        </div>

        <Sidebar />

        {/* Bottom status */}
        <div className="mt-auto border-t border-border/60 p-3">
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
            <span className="text-[11px] text-muted-foreground">
              Eval engine online
            </span>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header
          className="flex h-14 items-center justify-between border-b border-border/60 px-6"
          style={{ boxShadow: "0 1px 0 0 rgba(34,197,94,0.06)" }}
        >
          <span className="text-sm text-muted-foreground md:hidden">
            fionnuala
          </span>
          <div className="ml-auto flex items-center gap-4">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {user.email}
            </span>
            <form action="/auth/signout" method="post">
              <Button
                variant="ghost"
                size="sm"
                type="submit"
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
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
