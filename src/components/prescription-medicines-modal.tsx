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
import { Loader2 } from 'lucide-react';

interface PrescriptionMedicinesModalProps {
  prescriptionData: Recete;
  onQueryMedicine?: (medicine: any) => void;
}

const PrescriptionMedicinesModal: React.FC<PrescriptionMedicinesModalProps> = ({
  prescriptionData,
  onQueryMedicine
}) => {
  const [reportResult, setReportResult] = useState<ReceteReportResponse | null>(null);
  const [loadingMedicine, setLoadingMedicine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleQueryMedicine = async (medicine: ReceteIlac) => {
    setLoadingMedicine(medicine.barkod);
    setError(null);
    
    try {
      const result = await reportApiService.generateReport(medicine.barkod, prescriptionData);
      
      if (result.success && result.data) {
        setReportResult(result.data);
      } else {
        setError(result.error || 'Rapor oluşturulurken bir hata oluştu');
      }
    } catch (error) {
      setError('Beklenmeyen bir hata oluştu');
    } finally {
      setLoadingMedicine(null);
    }
  };

  const handleBackToMedicines = () => {
    setReportResult(null);
    setError(null);
  };

  if (reportResult) {
    const currentMedicine = prescriptionData.ilaclar?.find(m => 
      loadingMedicine ? m.barkod === loadingMedicine : true
    );
    
    return (
      <ReportResultModal
        reportData={reportResult}
        medicineName={currentMedicine?.ad || 'Seçili İlaç'}
        onBack={handleBackToMedicines}
      />
    );
  }

  return (
    <div className="space-y-4 max-h-[70vh] overflow-hidden flex flex-col">
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
          <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[400px]">
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
                    <TableHead className="min-w-[100px]">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prescriptionData.ilaclar.map((medicine, index) => (
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
                        {medicine.raporluMu ? (
                          <Badge variant="secondary" className="text-xs">Raporlu</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Normal</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {medicine.raporluMu && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs px-2 py-1 h-7"
                            disabled={loadingMedicine === medicine.barkod}
                            onClick={() => handleQueryMedicine(medicine)}
                          >
                            {loadingMedicine === medicine.barkod ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                Sorgulanıyor
                              </>
                            ) : (
                              'Sorgula'
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
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
