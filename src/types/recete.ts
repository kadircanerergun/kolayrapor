type IlacOzet = {
  barkod: string;
  ad: string;
  rapor?: string;
  verilebilecegiTarih: string;
  adet: number;
  periyot: string;
  doz: string;
  raporluMu: boolean;
  /**
   * Real Medula JSF row index (from element id `f:tbl1:<idx>:...`).
   * Used to fetch the correct row's report/drug-info; differs from the array
   * position when rows are skipped or Medula renders non-contiguous indices.
   */
  rowIndex?: number;
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
/**
 * "Rapor İlave Değer Bilgileri" satırı — Medula'nın rapora eklediği ölçüm
 * değerleri (Kilo, Boy, Günlük Kalori Miktarı vb.). SUT kurallarının bir kısmı
 * (enteral beslenme kalorisi, VKİ'ye bağlı ilaçlar) bu değerlere dayanır.
 */
type RaporIlaveDeger = {
  /** "Kilo", "Boy", "Günlük Kalori Miktarı" … */
  tur: string;
  /** Medula'da yazdığı gibi ham değer ("88", "2500"). */
  deger: string;
  aciklama: string;
  eklenmeZamani: string;
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
  ilaveDegerler?: RaporIlaveDeger[];
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
  /** "Ayaktan Maks. Kul. Doz" — ör. "1 Günde 1 x 1.0". */
  ayaktanMaksKullanimDoz?: string;
  /** "Yatan Maks. Kul. Doz" — ör. "1 Günde 1 x 1.0". */
  yatanMaksKullanimDoz?: string;
  sutBilgi?: SutBilgi;
  ozelDurumlar?: OzelDurum[];
  mesajlar?: IlacMesaj[];
  esdegerBilgi?: EsdegerBilgi[];
};

type ReceteTani = {
  icd10Kod: string;
  tani: string;
}

/**
 * "Reçete Uyarı Kodları (Yeni)" dialogundaki bir satır: ilaç ve o ilaca
 * eklenmiş uyarı kodu. Tabloda yalnızca uyumlu kodu olan ilaçlar listelenir,
 * dolayısıyla `secilenUyariKodu` boş bir satır "kod eklenebilirdi ama
 * eklenmemiş" demektir — bu ayrım analiz için anlamlı, satır atılmıyor.
 */
type ReceteUyariKodu = {
  ilacAdi: string;
  /**
   * "Seçilen Uyarı Kodu" kutusunda görünen değer, Medula'da yazdığı hâliyle
   * ("256 - Benign prostat hiperplazisi"). Kod eklenmemişse boş string.
   */
  secilenUyariKodu: string;
};

/**
 * "E-Reçete Görüntüle" (`input#f:buttonEreceteGoruntule`) sayfasındaki
 * "Onay Listesi" satırı. Tablo çoğu reçetede boş gelir; onay varsa hangi
 * onayın kim tarafından verildiğini gösterir.
 */
type EReceteOnay = {
  onayTuru: string;
  onayYapanDoktor: string;
};

/** e-Reçete sayfasındaki "Açıklama Listesi" satırı. */
type EReceteAciklama = {
  /** "Teşhis/Tanı", "Rapor" … */
  aciklamaTuru: string;
  aciklama: string;
};

/**
 * e-Reçete sayfasının "E-Reçete Bilgileri" başlık bloğu. Alanların bir kısmı
 * reçete detay sayfasında da var (tesis kodu, doktor branşı); buradakiler
 * e-Reçete tarafının kendi değerleri, olduğu gibi saklanıyor.
 *
 * DİKKAT: Kimlik bilgileri bilerek toplanmıyor — T.C. Kimlik No, Doktor
 * Dip.Tesc.No ve Doktor Adı/Soyadı sayfada dursa da okunmuyor, dolayısıyla
 * `diger`e de düşmüyor. Bkz. playwright-automation.ts → ATLANAN_ETIKETLER.
 */
type EReceteBaslik = {
  eReceteNo: string;
  takipNo: string;
  tesisKodu: string;
  receteTuru: string;
  receteTarihi: string;
  receteAltTuru: string;
  provizyonTipi: string;
  seriNo: string;
  protokolNo: string;
  doktorBrans: string;
  doktorSertifika: string;
  /**
   * Tanımadığımız etiketler ham hâliyle burada durur — Medula bloğa yeni bir
   * satır eklerse bilgi kaybolmasın diye. Kimlik alanları buraya da girmez.
   */
  diger?: Record<string, string>;
};

/**
 * e-Reçete sayfasındaki "İlaç Bilgileri" bloğundan bir ilaç. Detay
 * sayfasındaki `ReceteIlac`ten ayrıdır: burada hekimin yazdığı hâli
 * (kullanım şekli, ilaca bağlı açıklama satırları) görünür.
 */
type EReceteIlac = {
  /** Barkod parantezinden ayrılmış ilaç adı. */
  ad: string;
  /** Ad'ın sonundaki parantezden çıkarılan barkod; okunamazsa boş string. */
  barkod: string;
  adet: string;
  /** "Günde 2 x 1.0" — Medula'da yazdığı gibi. */
  kullanim: string;
  /** "Ağızdan(Oral)" */
  kullanimSekli: string;
  /** İlacın altındaki açıklama satırları ("Teşhis/Tanı - …"). */
  aciklamalar: string[];
  /** Tanımadığımız etiket/değer çiftleri. */
  ekAlanlar?: Record<string, string>;
};

/**
 * "E-Reçete Görüntüle" sayfasından toplanan bilgiler. Buton yalnızca bazı
 * reçetelerde çıktığı için `Recete.eRecete` opsiyonel: `undefined` = sayfa
 * yok/açılamadı, listelerin boş dizi olması = sayfa açıldı ama satır yok.
 */
type EReceteBilgi = {
  baslik: EReceteBaslik;
  /**
   * Başlık bloğundaki serbest metinler ("Reçete elektronik olarak
   * imzalanmıştır.", varsa kırmızı uyarı satırı).
   */
  mesajlar: string[];
  ilaclar: EReceteIlac[];
  onaylar: EReceteOnay[];
  aciklamalar: EReceteAciklama[];
  /** e-Reçete sayfasındaki "Tanı Listesi" (ICD-10). */
  tanilar: ReceteTani[];
};

/**
 * Reçeteyi yazan hekimin sertifikası (`select#f:m7`). Bazı SUT kuralları
 * branşın yanı sıra sertifika şartı arıyor (Hemodiyaliz, Aile Hekimliği …).
 * Sertifika seçilmemişse Medula "Yok" (kod "0") gösteriyor.
 */
type ReceteSertifika = {
  kod: string;
  ad: string;
};

type ReceteIlac = Omit<IlacOzet, 'rapor'> &{
  rapor?: ReceteRapor;
  detay?: IlacBilgi;
};

/**
 * Okuma hatasının sebebi. "Sayfada yok" burada YER ALMAZ: yokluk ancak sayfa
 * anchor'ı doğrulandıktan sonra geçerli bir sonuçtur ve eksik veri sayılmaz.
 */
type DataGapSebep = "timeout" | "read-failed" | "wrong-page" | "missing-row";

/**
 * Medula'dan okunamayan bir alan. Bir tane bile varsa reçete eksik toplanmış
 * demektir ve analize gönderilmez — bkz. reportApiService.generateReport().
 */
type DataGap = {
  /** Nokta ile ayrılmış alan yolu: "hasta.ad", "ilacBilgi.ayaktanMaksKullanimDoz". */
  alan: string;
  sebep: DataGapSebep;
  /** Selector, satır bilgisi ya da hata mesajı — teşhis için. */
  detay?: string;
  /** Alan bir ilaca aitse o ilacın barkodu. */
  barkod?: string;
};

/**
 * Reçete toplama sürümü. Bu sürümden eski önbellek kayıtları eksik veri
 * içerebilir (okunamayan alanlar sessizce boş string yazılıyordu), bu yüzden
 * bayat sayılıp Medula'dan yeniden çekilir.
 */
const RECETE_VERI_SURUMU = 2;

type Recete = {
  receteNo: string;
  receteTarihi: string;
  sonIslemTarihi: string;
  /**
   * Detay sayfasındaki "İlaç Alım Tarihi" (`#f:t31`). Tarihsel olarak aynı
   * input `sonIslemTarihi`ye de yazılıyor, ama o ad listeden gelen
   * ReceteOzet.sonIslemTarihi ile karışıyor — bu alan doğrudan kendi adıyla.
   */
  ilacAlimTarihi?: string;
  ilaclar?: ReceteIlac[];
  /** Reçete üzerindeki ICD-10 tanıları (rapor tanılarından ayrı). */
  tanilar?: ReceteTani[];
  /** Reçeteyi yazan hekimin sertifikası; doktorBrans'ı tamamlar. */
  sertifika?: ReceteSertifika;
  /**
   * "E-Reçete Görüntüle" sayfasından okunan onay/açıklama/tanı listeleri.
   * Buton her reçetede olmadığı için opsiyonel.
   */
  eRecete?: EReceteBilgi;
  /**
   * "Uyarı Kodu (Yeni)" dialogundan okunan kodlar.
   * `[]` = soruldu, kod yok. `undefined` = sorulamadı (dialog açılmadı).
   */
  receteUyariKodlari?: ReceteUyariKodu[];
  /**
   * Okunamayan alanlar. Boş/undefined = reçete eksiksiz toplandı. Dolu ise
   * reçete analize gönderilmez, kullanıcıya "tekrar dene" gösterilir.
   */
  eksikVeriler?: DataGap[];
  /** Reçetenin hangi toplama sürümüyle çekildiği; bkz. RECETE_VERI_SURUMU. */
  veriSurumu?: number;
  tesisKodu: string;
  doktorBrans: string;
  ad?: string;
  soyad?: string;
};

type RecipeByDateResponse = {
  receteler: ReceteOzet[];
}

export {
  RECETE_VERI_SURUMU,
  DataGap,
  DataGapSebep,
  Recete,
  ReceteIlac,
  ReceteOzet,
  RecipeByDateResponse,
  IlacOzet,
  ReceteRapor,
  IlacBilgi,
  ReceteTani,
  ReceteSertifika,
  ReceteUyariKodu,
  EReceteBilgi,
  EReceteBaslik,
  EReceteIlac,
  EReceteOnay,
  EReceteAciklama,
  RaporDoktor,
  RaporTani,
  RaporAciklama,
  RaporHasta,
  RaporEtkenMadde,
  RaporIlaveDeger,
  SutBilgi,
  SutDetay,
  OzelDurum,
  IlacMesaj,
  EsdegerBilgi,
};
