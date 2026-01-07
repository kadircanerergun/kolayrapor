import { createFileRoute } from "@tanstack/react-router";
import { SearchByRecipe as SearchByRecipeBlock } from "@/blocks/search-by-recipe";

function SearchByRecipe() {
  return (
    <div className="p-6">
      <div className="mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Rapor Arama</h1>
          <p className="text-muted-foreground">
            SGK sisteminde reçete bilgilerini sorgulayın
          </p>
        </div>
        <div className={"flex h-200 flex-row gap-3 overflow-y-hidden"}>
          <SearchByRecipeBlock />
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/search-by-recipe")({
  component: SearchByRecipe,
});
