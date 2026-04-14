import { useState } from "react";
import { cn } from "@/utils/tailwind";
import { useAppSelector } from "@/store";

const WHATSAPP_NUMBER = "908503052540";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export function WhatsAppButton() {
  const [hovered, setHovered] = useState(false);
  const groups = useAppSelector((s) => s.taskQueue.groups);
  const bulkProgress = useAppSelector((s) => s.recete.bulkProgress);
  const hasTaskPanel = groups.length > 0 || bulkProgress !== null;

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "fixed right-6 z-50 flex items-center gap-2 rounded-full shadow-lg transition-all duration-300 hover:shadow-xl",
        hasTaskPanel ? "bottom-20" : "bottom-6",
        hovered ? "bg-[#25D366] pr-5 pl-3 py-2.5" : "bg-[#25D366] p-3",
      )}
    >
      <svg
        viewBox="0 0 32 32"
        fill="white"
        className="h-7 w-7 shrink-0"
      >
        <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16c0 3.5 1.128 6.744 3.046 9.378L1.054 31.29l6.118-1.958A15.91 15.91 0 0 0 16.004 32C24.826 32 32 24.822 32 16S24.826 0 16.004 0zm9.31 22.6c-.39 1.1-1.932 2.012-3.182 2.278-.854.18-1.968.324-5.72-1.23-4.804-1.988-7.896-6.862-8.136-7.18-.23-.318-1.934-2.576-1.934-4.914s1.224-3.486 1.658-3.964c.434-.478.948-.598 1.264-.598.316 0 .632.004.908.016.292.014.682-.11 1.066.812.39.94 1.33 3.248 1.448 3.484.118.238.196.514.04.83-.158.316-.236.514-.474.792-.238.278-.5.62-.714.832-.238.238-.486.496-.208.972.278.476 1.236 2.038 2.654 3.302 1.822 1.624 3.358 2.126 3.834 2.364.476.238.754.198 1.032-.118.278-.318 1.192-1.39 1.51-1.868.316-.476.634-.396 1.068-.236.434.158 2.744 1.294 3.218 1.53.474.238.792.356.908.554.118.196.118 1.148-.272 2.25z" />
      </svg>
      <span
        className={cn(
          "text-white text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300",
          hovered ? "max-w-48 opacity-100" : "max-w-0 opacity-0",
        )}
      >
        Teknik Destek
      </span>
    </a>
  );
}
