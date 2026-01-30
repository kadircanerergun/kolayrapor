import { createFileRoute } from "@tanstack/react-router";
import { SearchByDateRange } from "@/blocks/search-by-date-range";
import { useMemo, useState } from "react";
import { Recete, ReceteOzet } from "@/types/recete";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { PrescriptionMedicinesModal } from "@/components/prescription-medicines-modal";
import { usePlaywright } from "@/hooks/usePlaywright";
import { useDialogContext } from "@/contexts/dialog-context";
import { useModal } from "@/hooks/useModal";
import { ModalProvider } from "@/components/modal-provider";

function SearchReport() {
  const [receteler, setReceteler] = useState<ReceteOzet[]>()
  const [loading, setLoading] = useState(false);
  const [selectedRecetes, setSelectedRecetes] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingRecete, setLoadingRecete] = useState<string | null>(null);
  const pageSize = 10;
  const playwright = usePlaywright();
  const dialog = useDialogContext();
  const modal = useModal();
  const totalPages = receteler ? Math.ceil(receteler.length / pageSize) : 0;
  const paginatedReceteler = useMemo(() => {
    if (!receteler) return [];
    const start = (currentPage - 1) * pageSize;
    return receteler.slice(start, start + pageSize);
  }, [receteler, currentPage]);

  const handleSelectRecete = (receteNo: string, checked: boolean) => {
    const newSelected = new Set(selectedRecetes);
    if (checked) {
      newSelected.add(receteNo);
    } else {
      newSelected.delete(receteNo);
    }
    setSelectedRecetes(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && receteler) {
      setSelectedRecetes(new Set(receteler.map(r => r.receteNo)));
    } else {
      setSelectedRecetes(new Set());
    }
  };

  const handleSorgula = async (receteNo: string) => {
    setLoadingRecete(receteNo);
    try {
      const searchResult = await playwright.searchPrescription(receteNo);

      if (searchResult.success && searchResult.prescriptionData) {
        const prescriptionData = searchResult.prescriptionData as Recete;

        modal.openModal(
          <PrescriptionMedicinesModal
            prescriptionData={prescriptionData}
            onQueryMedicine={(medicine) => {
              console.log("Querying medicine:", medicine);
            }}
          />,
          {
            title: "Reçete Detayları",
            size: "6xl",
          },
        );
      } else {
        dialog.showAlert({
          title: "Hata",
          description: `SGK portalına giderken hata: ${searchResult.error}`,
        });
      }
    } finally {
      setLoadingRecete(null);
    }
  };

  const handleBulkProcess = () => {
    console.log("Toplu işlem:", Array.from(selectedRecetes));
    // TODO: Implement bulk processing logic
  };

  const isAllSelected = receteler && selectedRecetes.size === receteler.length;
  const isSomeSelected = selectedRecetes.size > 0 && selectedRecetes.size < (receteler?.length || 0);

  return (
    <div className="p-6">
      <div className="mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Reçete Arama</h1>
          <p className="text-muted-foreground">
            SGK sisteminde reçete bilgilerini sorgulayın
          </p>
        </div>
        <div className={"flex flex-row gap-3 overflow-y-hidden"}>
          <SearchByDateRange
            onSearchStart={() => {
              setLoading(true);
              setReceteler(undefined);
              setSelectedRecetes(new Set());
            }}
            onSearchComplete={(results) => {
              setReceteler(results);
              setCurrentPage(1);
              setLoading(false);
            }}
            onError={() => {
              setLoading(false);
            }}
          />
        </div>
        {totalPages > 1 && (
          <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
            <span className="text-muted-foreground text-sm">
              {receteler.length} sonuctan {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, receteler.length)} arasi
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Onceki
              </Button>
              <span className="text-sm font-medium">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Sonraki
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {receteler && receteler.length > 0 && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Bulunan Reçeteler ({receteler.length})
              </h2>
              {selectedRecetes.size > 0 && (
                <Button onClick={handleBulkProcess} variant="outline">
                  Toplu İşlem ({selectedRecetes.size})
                </Button>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                      ref={(checkbox) => {
                        if (checkbox) {
                          checkbox.indeterminate = isSomeSelected;
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Reçete No</TableHead>
                  <TableHead>Hasta</TableHead>
                  <TableHead>Kapsam</TableHead>
                  <TableHead>Reçete Tarihi</TableHead>
                  <TableHead>Son İşlem Tarihi</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedReceteler.map((recete) => (
                  <TableRow key={recete.receteNo}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRecetes.has(recete.receteNo)}
                        onCheckedChange={(checked) =>
                          handleSelectRecete(recete.receteNo, !!checked)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {recete.receteNo}
                    </TableCell>
                    <TableCell>
                      {recete.ad} {recete.soyad}
                    </TableCell>
                    <TableCell>{recete.kapsam}</TableCell>
                    <TableCell>{recete.receteTarihi}</TableCell>
                    <TableCell>{recete.sonIslemTarihi}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={() => handleSorgula(recete.receteNo)}
                        size="sm"
                        disabled={loadingRecete !== null}
                      >
                        {loadingRecete === recete.receteNo ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sorgulanıyor
                          </>
                        ) : (
                          "Sorgula"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
                <span className="text-muted-foreground text-sm">
                  {receteler.length} sonuctan {(currentPage - 1) * pageSize + 1}
                  -{Math.min(currentPage * pageSize, receteler.length)} arasi
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Onceki
                  </Button>
                  <span className="text-sm font-medium">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Sonraki
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <ModalProvider modal={modal.modal} onClose={modal.closeModal} />
    </div>
  );
}

export const Route = createFileRoute("/search-report")({
  component: SearchReport,
});
