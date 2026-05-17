// src/components/layout/sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Target,
  LayoutDashboard,
  FileText,
  CheckSquare,
  Users,
  Settings,
  BarChart3,
  Calendar,
  Share2,
} from "lucide-react";
import { Role } from "@prisma/client";

interface SidebarProps {
  user: {
    role: Role;
    name: string;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
    { name: "My Goals", href: "/goals", icon: Target, roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
    { name: "Create Goals", href: "/goals/new", icon: FileText, roles: ["EMPLOYEE"] },
    { name: "Check-ins", href: "/check-ins", icon: CheckSquare, roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
    { name: "Team Goals", href: "/team", icon: Users, roles: ["MANAGER", "ADMIN"] },
    { name: "Approvals", href: "/approvals", icon: CheckSquare, roles: ["MANAGER", "ADMIN"] },
    { name: "Shared Goals", href: "/shared-goals", icon: Share2, roles: ["MANAGER", "ADMIN"] },
    { name: "Reports", href: "/reports", icon: BarChart3, roles: ["MANAGER", "ADMIN"] },
    { name: "Cycles", href: "/admin/cycles", icon: Calendar, roles: ["ADMIN"] },
    { name: "Users", href: "/admin/users", icon: Users, roles: ["ADMIN"] },
    { name: "Settings", href: "/admin", icon: Settings, roles: ["ADMIN"] },
  ];

  const filteredNav = navigation.filter((item) =>
    item.roles.includes(user.role)
  );

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div className="flex min-h-0 flex-1 flex-col bg-gray-900">
        <div className="flex h-16 flex-shrink-0 items-center px-4 bg-gray-800">
          <Target className="h-8 w-8 text-blue-500" />
          <span className="ml-2 text-xl font-bold text-white">Goal Portal</span>
        </div>
        <nav className="mt-5 flex-1 space-y-1 px-2">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0",
                    isActive ? "text-blue-500" : "text-gray-400 group-hover:text-gray-300"
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-shrink-0 bg-gray-800 p-4">
          <div className="flex items-center">
            <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-gray-400">{user.role}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
