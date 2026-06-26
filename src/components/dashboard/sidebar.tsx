"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Trophy,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "Documents", href: "/dashboard/upload", icon: FileText },
  { title: "QA Lab", href: "/dashboard/lab", icon: FlaskConical },
  { title: "Experiments", href: "/dashboard/experiments", icon: Trophy },
  { title: "Observability", href: "/dashboard/observability", icon: Activity },
  { title: "Deploy", href: "/dashboard/deploy", icon: Rocket },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 p-3">
      {navItems.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_rgba(34,197,94,0.25)]"
                : "text-muted-foreground hover:bg-primary/8 hover:text-foreground",
            )}
          >
            {/* Active left bar */}
            {isActive && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
            )}
            <item.icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
