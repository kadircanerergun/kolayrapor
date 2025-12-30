import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import MainLayout from "@/layouts/main-layout";

import { usePlaywright } from "@/hooks/usePlaywright";
import { SearchByDateRange } from "@/blocks/search-by-date-range";
import { SearchByRecipe } from "@/blocks/search-by-recipe";

function SearchReport() {
  const [receteNumarasi, setReceteNumarasi] = useState("");
  const playwright = usePlaywright();



  return (
    <MainLayout>
      <div className="p-6">
        <div className="mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Reçete Arama</h1>
            <p className="text-muted-foreground">
              SGK sisteminde reçete bilgilerini sorgulayın
            </p>
          </div>
          <div className={"flex flex-row gap-3"}>
            <SearchByRecipe />
            <SearchByDateRange />
          </div>

          {/* Status indicator */}
          {playwright.error && (
            <Card className="border-destructive mt-4">
              <CardContent className="p-4">
                <div className="text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Hata: {playwright.error}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

export const Route = createFileRoute("/search-report")({
  component: SearchReport,
});
