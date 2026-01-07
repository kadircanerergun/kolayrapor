import { createFileRoute } from "@tanstack/react-router";
import { SearchByDateRange } from "@/blocks/search-by-date-range";

function SearchReport() {
  return (
    <div className="p-6">
      <div className="mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Reçete Arama</h1>
          <p className="text-muted-foreground">
            SGK sisteminde reçete bilgilerini sorgulayın
          </p>
        </div>
        <div className={"flex flex-row gap-3 h-200 overflow-y-hidden"}>
          <SearchByDateRange />
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/search-report")({
  component: SearchReport,
});
