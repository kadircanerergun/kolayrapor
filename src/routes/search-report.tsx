import { createFileRoute } from "@tanstack/react-router";
import { SearchByDateRange } from "@/blocks/search-by-date-range";
import { useMemo } from "react";
import { Recete } from "@/types/recete";
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
import { useDialogContext } from "@/contexts/dialog-context";
import { useModal } from "@/hooks/useModal";
import { ModalProvider } from "@/components/modal-provider";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  setCurrentPage,
  toggleReceteSelection,
  selectAllRecetes,
  clearReceteSelection,
} from "@/store/slices/receteSlice";
import { searchPrescriptionDetail } from "@/store/slices/playwrightSlice";

function SearchReport() {
  const dispatch = useAppDispatch();
  const {
    receteler,
    currentPage,
    selectedRecetes,
    loadingRecete,
  } = useAppSelector((s) => s.recete);
  const dialog = useDialogContext();
  const modal = useModal();
  const pageSize = 10;
  const totalPages = receteler.length ? Math.ceil(receteler.length / pageSize) : 0;
  const paginatedReceteler = useMemo(() => {
    if (!receteler.length) return [];
    const start = (currentPage - 1) * pageSize;
    return receteler.slice(start, start + pageSize);
  }, [receteler, currentPage]);

  const handleSelectRecete = (receteNo: string, checked: boolean) => {
    if (checked) {
      if (!selectedRecetes.includes(receteNo)) {
        dispatch(toggleReceteSelection(receteNo));
      }
    } else {
      if (selectedRecetes.includes(receteNo)) {
        dispatch(toggleReceteSelection(receteNo));
      }
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      dispatch(selectAllRecetes());
    } else {
      dispatch(clearReceteSelection());
    }
  };

  const handleSorgula = async (receteNo: string) => {
    const result = await dispatch(searchPrescriptionDetail(receteNo));

    if (searchPrescriptionDetail.fulfilled.match(result)) {
      const prescriptionData = result.payload as Recete;

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
        description: `SGK portalına giderken hata: ${result.error?.message || "Bilinmeyen hata"}`,
      });
    }
  };

  const handleBulkProcess = () => {
    console.log("Toplu işlem:", selectedRecetes);
    // TODO: Implement bulk processing logic
  };

  const isAllSelected = receteler.length > 0 && selectedRecetes.length === receteler.length;
  const isSomeSelected = selectedRecetes.length > 0 && selectedRecetes.length < receteler.length;

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
          <SearchByDateRange />
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
                onClick={() => dispatch(setCurrentPage(currentPage - 1))}
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
                onClick={() => dispatch(setCurrentPage(currentPage + 1))}
              >
                Sonraki
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {receteler.length > 0 && (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Bulunan Reçeteler ({receteler.length})
              </h2>
              {selectedRecetes.length > 0 && (
                <Button onClick={handleBulkProcess} variant="outline">
                  Toplu İşlem ({selectedRecetes.length})
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
                        checked={selectedRecetes.includes(recete.receteNo)}
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
                    onClick={() => dispatch(setCurrentPage(currentPage - 1))}
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
                    onClick={() => dispatch(setCurrentPage(currentPage + 1))}
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
