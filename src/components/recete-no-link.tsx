import { ExternalLink } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ReceteNoLinkProps {
  receteNo: string;
  className?: string;
}

export function ReceteNoLink({ receteNo, className }: ReceteNoLinkProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("kolayrapor:navigate-to-prescription", {
        detail: { receteNo },
      }),
    );
    navigate({ to: "/gezinti" });
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleClick}
          className={`inline-flex items-center gap-1 hover:text-primary transition-colors cursor-pointer ${className ?? ""}`}
        >
          <span>{receteNo}</span>
          <ExternalLink className="h-3 w-3 opacity-50 hover:opacity-100" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">Medula'da göster</p>
      </TooltipContent>
    </Tooltip>
  );
}
