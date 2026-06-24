"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  FileText,
  FlaskConical,
  LayoutDashboard,
<<<<<<< HEAD
  Trophy,
  type LucideIcon,
} from "lucide-react";
=======
  Trophy, 
  Rocket,
  type LucideIcon
} from "lucide-react"; 
>>>>>>> eaf677d (Phase 11: Deployment Bridge, Public API Keys, and Auto-Winner Logic)

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
<<<<<<< HEAD
];
=======
  { title: "Deploy", href: "/dashboard/deploy", icon: Rocket },
]; 
>>>>>>> eaf677d (Phase 11: Deployment Bridge, Public API Keys, and Auto-Winner Logic)

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
