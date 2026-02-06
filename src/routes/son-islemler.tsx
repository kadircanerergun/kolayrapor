import { createFileRoute } from "@tanstack/react-router";
import { SonIslemlerTable } from "@/components/son-islemler-table";

function SonIslemler() {
  return (
    <div className="p-6">
      <div className="mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Son İşlemler</h1>
          <p className="text-muted-foreground">
            Daha önce sorgulanan ve analiz edilen reçeteler
          </p>
        </div>

        <SonIslemlerTable showHeader={false} />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/son-islemler")({
  component: SonIslemler,
});
