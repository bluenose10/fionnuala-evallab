"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  FlaskConical,
  LayoutDashboard,
  Trophy,
  Upload,
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
  { title: "Document Manager", href: "/dashboard/upload", icon: Upload },
  { title: "QA & Retrieval Lab", href: "/dashboard/lab", icon: FlaskConical },
  { title: "Evaluation Hub", href: "/dashboard/evaluation", icon: Activity },
  {
    title: "Experiment Leaderboard",
    href: "/dashboard/experiments",
    icon: Trophy,
  },
  {
    title: "Observability",
    href: "/dashboard/observability",
    icon: Activity,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
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
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
