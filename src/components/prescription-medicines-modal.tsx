import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Recete, ReceteIlac } from '@/types/recete';
import { reportApiService, ReceteReportResponse } from '@/services/report-api';
import { ReportResultModal } from '@/components/report-result-modal';
import { CircleCheck, Eye, FlaskConical, Loader2, RefreshCw } from 'lucide-react';
import { cacheAnalysis } from '@/lib/db';
import { useAppDispatch, useAppSelector } from '@/store';
import { analizCompleted } from '@/store/slices/receteSlice';

interface PrescriptionMedicinesModalProps {
  prescriptionData: Recete;
  onQueryMedicine?: (medicine: any) => void;
}

const PrescriptionMedicinesModal: React.FC<PrescriptionMedicinesModalProps> = ({
  prescriptionData,
  onQueryMedicine
}) => {
  const dispatch = useAppDispatch();
  const cachedResults = useAppSelector(
    (s) => s.recete.analizSonuclari[prescriptionData.receteNo] ?? {},
  );
  const { loadingRecete, analyzingRecete, bulkProgress } = useAppSelector((s) => s.recete);
  const isSystemBusy = loadingRecete !== null || analyzingRecete !== null || bulkProgress !== null;
  const [reportResult, setReportResult] = useState<ReceteReportResponse | null>(null);
  const [viewingMedicineName, setViewingMedicineName] = useState<string>('');
  const [loadingMedicine, setLoadingMedicine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleQueryMedicine = async (medicine: ReceteIlac) => {
    setLoadingMedicine(medicine.barkod);
    setError(null);

    try {
      const result = await reportApiService.generateReport(medicine.barkod, prescriptionData);

      if (result.success && result.data) {
        setReportResult(result.data);
        setViewingMedicineName(medicine.ad);

        // Save to Dexie cache and Redux
        await cacheAnalysis(prescriptionData.receteNo, medicine.barkod, result.data);
        dispatch(analizCompleted({
          receteNo: prescriptionData.receteNo,
          sonuclar: { [medicine.barkod]: result.data },
        }));
      } else {
        setError(result.error || 'Rapor oluşturulurken bir hata oluştu');
      }
    } catch (error) {
      setError('Beklenmeyen bir hata oluştu');
    } finally {
      setLoadingMedicine(null);
    }
  };

  const handleViewResult = (medicine: ReceteIlac) => {
    const cached = cachedResults[medicine.barkod];
    if (cached) {
      setReportResult(cached);
      setViewingMedicineName(medicine.ad);
    }
  };

  const handleBackToMedicines = () => {
    setReportResult(null);
    setViewingMedicineName('');
    setError(null);
  };

  if (reportResult) {
    return (
      <ReportResultModal
        reportData={reportResult}
        medicineName={viewingMedicineName || 'Seçili İlaç'}
        onBack={handleBackToMedicines}
      />
    );
  }

  return (
    <div className="space-y-4 flex flex-col min-h-0">
      <div className="flex-shrink-0">
        <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 p-3 rounded-lg">
          <div>
            <span className="font-medium">Reçete No:</span> {prescriptionData.receteNo}
          </div>
          <div>
            <span className="font-medium">Reçete Tarihi:</span> {prescriptionData.receteTarihi}
          </div>
          <div>
            <span className="font-medium">Son İşlem Tarihi:</span> {prescriptionData.sonIslemTarihi}
          </div>
          <div>
            <span className="font-medium">Tesis Kodu:</span> {prescriptionData.tesisKodu}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <h3 className="text-md font-semibold mb-3">İlaçlar</h3>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {!prescriptionData.ilaclar || prescriptionData.ilaclar.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Bu reçetede ilaç bulunamadı.
          </div>
        ) : (
          <div className="border rounded-lg overflow-auto">
            <div className="min-w-[900px]">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="min-w-[250px]">İlaç Adı</TableHead>
                    <TableHead className="min-w-[120px]">Barkod</TableHead>
                    <TableHead className="min-w-[60px]">Adet</TableHead>
                    <TableHead className="min-w-[80px]">Doz</TableHead>
                    <TableHead className="min-w-[80px]">Periyot</TableHead>
                    <TableHead className="min-w-[130px]">Verilebileceği Tarih</TableHead>
                    <TableHead className="min-w-[80px]">Durumu</TableHead>
                    <TableHead className="min-w-[180px]">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prescriptionData.ilaclar.map((medicine, index) => {
                    const cached = cachedResults[medicine.barkod];
                    const isAnalyzed = !!cached;
                    const isLoading = loadingMedicine === medicine.barkod;

                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          <div className="max-w-[250px] truncate" title={medicine.ad}>
                            {medicine.ad}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{medicine.barkod}</TableCell>
                        <TableCell className="text-center">{medicine.adet}</TableCell>
                        <TableCell className="text-sm">{medicine.doz}</TableCell>
                        <TableCell className="text-sm">{medicine.periyot}</TableCell>
                        <TableCell className="text-xs">{medicine.verilebilecegiTarih}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {medicine.raporluMu ? (
                              <Badge variant="secondary" className="text-xs">Raporlu</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Normal</Badge>
                            )}
                            {isAnalyzed && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  cached.validityScore >= 80
                                    ? 'border-green-300 text-green-700 bg-green-50'
                                    : cached.validityScore >= 60
                                      ? 'border-yellow-300 text-yellow-700 bg-yellow-50'
                                      : 'border-red-300 text-red-700 bg-red-50'
                                }`}
                              >
                                <CircleCheck className="h-3 w-3 mr-0.5" />
                                {cached.validityScore}%
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {medicine.raporluMu && (
                            <div className="flex items-center gap-1">
                              {isAnalyzed && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => handleViewResult(medicine)}
                                  title="Sonucu Gör"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {isAnalyzed ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  disabled={isLoading || isSystemBusy}
                                  onClick={() => handleQueryMedicine(medicine)}
                                  title="Yeniden Kontrol Et"
                                >
                                  {isLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs px-2 py-1 h-7"
                                  disabled={isLoading || isSystemBusy}
                                  onClick={() => handleQueryMedicine(medicine)}
                                >
                                  {isLoading ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                      Kontrol Ediliyor
                                    </>
                                  ) : (
                                    <>
                                      <FlaskConical className="h-3 w-3 mr-1" />
                                      Kontrol Et
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { PrescriptionMedicinesModal };
