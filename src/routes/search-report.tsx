import { createFileRoute } from "@tanstack/react-router";
import { SearchByDateRange } from "@/blocks/search-by-date-range";
import { useState } from "react";
import { ReceteOzet } from "@/types/recete";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function SearchReport() {
  const [receteler, setReceteler] = useState<ReceteOzet[]>()
  const [loading, setLoading] = useState(false);
  const [selectedRecetes, setSelectedRecetes] = useState<Set<string>>(new Set());

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

  const handleSorgula = (receteNo: string) => {
    console.log("Sorgulanan reçete:", receteNo);
    // TODO: Implement individual query logic
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
        <div className={"flex flex-row gap-3 h-200 overflow-y-hidden"}>
          <SearchByDateRange
            onSearchStart={() => {
              setLoading(true);
              setReceteler(undefined);
              setSelectedRecetes(new Set());
            }}
            onSearchComplete={(results) => {
              setReceteler(results);
              setLoading(false);
            }}
            onError={() => {
              setLoading(false);
            }}
          />
        </div>
        
        {receteler && receteler.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Bulunan Reçeteler ({receteler.length})</h2>
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
                      ref={checkbox => {
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
                  <TableHead>İlaç Sayısı</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receteler.map((recete) => (
                  <TableRow key={recete.receteNo}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRecetes.has(recete.receteNo)}
                        onCheckedChange={(checked) => 
                          handleSelectRecete(recete.receteNo, !!checked)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">{recete.receteNo}</TableCell>
                    <TableCell>{recete.ad} {recete.soyad}</TableCell>
                    <TableCell>{recete.kapsam}</TableCell>
                    <TableCell>{recete.receteTarihi}</TableCell>
                    <TableCell>{recete.sonIslemTarihi}</TableCell>
                    <TableCell>
                      {recete.ilaclar && recete.ilaclar.length > 0 ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="text-blue-600 hover:text-blue-800 underline cursor-pointer">
                              {recete.ilaclar.length}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80">
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm text-gray-900">İlaçlar</h4>
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {recete.ilaclar.map((ilac, index) => (
                                  <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                                    <div className="font-medium">{ilac.ad}</div>
                                    <div className="text-gray-600">
                                      Barkod: {ilac.barkod}
                                    </div>
                                    <div className="text-gray-600">
                                      Adet: {ilac.adet} • Doz: {ilac.doz}
                                    </div>
                                    {ilac.rapor && (
                                      <div className="text-gray-600">
                                        Rapor: {ilac.rapor}
                                      </div>
                                    )}
                                    <div className="text-gray-500">
                                      Verilebilir: {ilac.verilebilecegiTarih}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="text-gray-500">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        onClick={() => handleSorgula(recete.receteNo)}
                        size="sm"
                      >
                        Sorgula
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/search-report")({
  component: SearchReport,
});
