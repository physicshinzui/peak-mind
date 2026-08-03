"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Clock, FlaskConical, BarChart3, Settings } from "lucide-react";

const navItems = [
  { href: "/now", label: "今", icon: Sparkles },
  { href: "/timeline", label: "記録", icon: Clock },
  { href: "/experiments", label: "実験", icon: FlaskConical },
  { href: "/insights", label: "分析", icon: BarChart3 },
  { href: "/settings", label: "設定", icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb z-50">
      <div className="max-w-md mx-auto flex justify-around items-center h-16">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 h-full text-xs ${
                active ? "text-blue-600" : "text-gray-500"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span className="mt-1">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
