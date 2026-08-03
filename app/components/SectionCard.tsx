import { ReactNode } from "react";

interface SectionCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function SectionCard({ title, children, className = "" }: SectionCardProps) {
  return (
    <section
      className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 ${className}`}
    >
      {title && <h2 className="text-lg font-semibold text-gray-800 mb-4">{title}</h2>}
      {children}
    </section>
  );
}
