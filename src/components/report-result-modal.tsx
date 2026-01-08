import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Clock, ArrowLeft } from 'lucide-react';
import { ReceteReportResponse } from '@/services/report-api';

interface ReportResultModalProps {
  reportData: ReceteReportResponse;
  medicineName: string;
  onBack: () => void;
}

const ReportResultModal: React.FC<ReportResultModalProps> = ({
  reportData,
  medicineName,
  onBack
}) => {
  const getValidityColor = (isValid: boolean, score: number) => {
    if (isValid && score >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (isValid && score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getValidityIcon = (isValid: boolean, score: number) => {
    if (isValid && score >= 80) return <CheckCircle className="h-4 w-4" />;
    if (isValid && score >= 60) return <Clock className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  return (
    <div className="flex max-h-[70vh] flex-col space-y-6 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Rapor Sonuçları</h2>
          <p className="text-muted-foreground text-sm">{medicineName}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Geri Dön
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {/* Validity Status */}
        <div
          className={`rounded-lg border p-4 ${getValidityColor(reportData.isValid, reportData.validityScore)}`}
        >
          <div className="flex items-center gap-3">
            {getValidityIcon(reportData.isValid, reportData.validityScore)}
            <div>
              <h3 className="font-semibold">
                {reportData.isValid ? "Geçerli Rapor" : "Geçersiz Rapor"}
              </h3>
              <p className="text-sm">
                Geçerlilik Skoru: {reportData.validityScore}%
              </p>
            </div>
          </div>
        </div>

        {/* Report Summary */}
        <div className="space-y-2">
          <h3 className="font-semibold">Rapor Özeti</h3>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="text-sm">{reportData.reportEvolutionDetails}</p>
          </div>
        </div>


        {/* Report Info */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">İşlenme Tarihi:</span>
              <p className="text-muted-foreground">
                {new Date(reportData.processedAt).toLocaleString("tr-TR")}
              </p>
            </div>
            <div>
              <span className="font-medium">Eczane ID:</span>
              <p className="text-muted-foreground">{reportData.pharmacyId}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { ReportResultModal };
