type IlacOzet = {
  barkod: string;
  ad: string;
  rapor?: string;
  verilebilecegiTarih: string;
  adet: number;
  periyot: string;
  doz: string;
  raporluMu: boolean;
};
type ReceteOzet = {
  receteNo: string;
  sonIslemTarihi: string;
  receteTarihi: string;
  ad: string;
  soyad: string;
  kapsam: string;
  //ilaclar?: IlacOzet[];
};

type RaporAciklama = {
  aciklama: string;
  eklenmeTarihi: string;
};
type RaporTani = {
  tani: string;
  baslangicTarihi: string;
  bitisTarihi: string;
};
type RaporDoktor = {
  brans: string;
};
type RaporEtkenMadde = {
  kod: string;
  ad: string;
  form: string;
  tedaviSema: string;
  adet: number;
  icerikMiktari: string;
  eklenmeZamani: string;
};
type RaporHasta = {
  cinsiyet: string;
  dogumTarihi: string;
};
type ReceteRapor = {
  raporNo: string;
  raporTarihi: string;
  protokolNo: string;
  duzenlemeTuru: string;
  kayitSekli: string;
  aciklama: string;
  tesisKodu: string;
  raporTakipNo: string;
  tesisUnvan: string;
  tanilar?: RaporTani[];
  doktorlar?: RaporDoktor[];
  etkenMaddeler?: RaporEtkenMadde[];
  aciklamalar?: RaporAciklama[];
  hastaBilgileri?: RaporHasta;
};

type SutDetay = {
  /** Tarihler */
  baslangicTarihi?: string;
  bitisTarihi?: string;

  /** Kullanım & limitler */
  maksOdenenSure: number; // Ay / Gün gibi değerler backend'de normalize edilebilir
  maksKullanim: string; // "Günde 0 x 0.0"
  maksimumIlacAdet?: number;
  kullanimSuresi?: string; // "0 Günde"
  gunlukMaksKaloriMiktari?: number;

  /** Demografi */
  cinsiyet: string; // Hepsi
  yasAraligi: string; // "0-0"

  /** Takip */
  takipYontemi: string; // Normal
  takipliIlacMiktari: string; // "Ayda 0 Kutu"

  /** Etkin madde */
  etkinMaddeler?: string[]; // boş olabilir

  /** Doz bilgileri */
  kutuBirimDozMiktari?: number; // 0,0
  birimDozMiktari?: string; // "0,0 Adet"

  /** Reçete kuralları */
  receteUyariKodu?: string;
  receteTesisTuru?: string;
  receteYazanBranslar?: string;

  /** Rapor kuralları */
  raporAciklama?: string; // "Uzman Hekim Raporu / I09"
  raporYazanBranslar?: string;
  raporTesisTuru?: string;

  /** Rapor limitleri */
  maksimumRaporTarihi?: string;
  maksimumRaporSuresiAy?: number;
};

type SutBilgi = {
  sutKodu: string;
  sutTipi: string;
  sutRaporTipi: string;
  detay: SutDetay;
};

type OzelDurum = {
  kod: string;
  mesaj: string;
};

type IlacMesaj = {
  baslik: string;
  mesaj: string;
};

type EsdegerBilgi = {
  baslangicTarihi: string;
  bitisTarihi: string;
  uyariKodu: string;
  esdegerKodu: string;
};

type IlacBilgi = {
  ilacAdi: string;
  ambalajMiktari: string;
  tekDozMiktari: string;
  cinsiyeti: string;
  etkinMadde: string;
  raporluMaksKullanimDoz?: string;
  sutBilgi?: SutBilgi;
  ozelDurumlar?: OzelDurum[];
  mesajlar?: IlacMesaj[];
  esdegerBilgi?: EsdegerBilgi[];
};

type ReceteTani = {
  icd10Kod: string;
  tani: string;
}

type ReceteIlac = Omit<IlacOzet, 'rapor'> &{
  rapor?: ReceteRapor;
  detay?: IlacBilgi;
};

type Recete = {
  receteNo: string;
  receteTarihi: string;
  sonIslemTarihi: string;
  ilaclar?: ReceteIlac[];
  tesisKodu: string;
  doktorBrans: string;
};

type RecipeByDateResponse = {
  receteler: ReceteOzet[];
}

export {
  Recete,
  ReceteIlac,
  ReceteOzet,
  RecipeByDateResponse,
  IlacOzet,
  ReceteRapor,
  IlacBilgi,
  ReceteTani,
  RaporDoktor,
  RaporTani,
  RaporAciklama,
  RaporHasta,
  RaporEtkenMadde,
  SutBilgi,
  SutDetay,
  OzelDurum,
  IlacMesaj,
  EsdegerBilgi,
};
