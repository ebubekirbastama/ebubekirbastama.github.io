# EBS AI Studio Pro — Statik PWA

**Yayın:** https://www.ebubekirbastama.com.tr/ebs-ai-studio/

## Kurulum (npm YOK)

ZIP içindeki `EBS_AI_Studio_PWA` klasörünün **içeriğini** web sitenizde `ebs-ai-studio/` alt klasörüne yükleyin. GitHub Pages için de bu klasörü aynı yolla ekleyin. Dosyalar `./` göreli yollara sahiptir. `index.html` doğrudan HTTP(S) üzerinden açılır.

`file://` yerine HTTPS veya yerel `http://localhost` kullanın. Windows Chrome/Edge üzerinden PWA kurulumu yapılabilir.

## Demucs — kaynak ve model adresi

Kaynak: https://github.com/bengfarrell/demucs-wasm/tree/main/models

Vokal modeli adı: `htdemucs_ft_vocals.ort.gzipped` (upstream `src/demucs.ts` dosyası).

**Gelişmiş ayarlarda varsayılan URL**: `https://raw.githubusercontent.com/bengfarrell/demucs-wasm/main/models/`

Modeli aynı sitede sunmak isterseniz dosyayı `./models/` içine koyup ayarlar penceresinde URL'yi `./models/` yapın. GitHub sayfasındaki `tree/main/models` adresini **doğrudan model URL olarak kullanmayın** (bu bir HTML dizin sayfasıdır).

Demucs çalışan modülü (`worker.js`, `demucs_onnx_simd.js`, `demucs_onnx_simd.wasm`) uzak kaynaktan çağırmaya yönelik köprü eklidir, ancak tarayıcı ve CDN davranışı nedeniyle **gerçek video işleme garanti edilmez**. Model ağırlıkları ZIP'e dahil edilmemiştir. Uzak RAW model yanıtı büyük dosyalarda başarısız olabilir. Yerel kopyaları kullanmak daha güvenilirdir. Uzun videolar yüksek RAM kullanır.

## SEO / alan adı

Başlık, açıklama, OG/Twitter etiketleri, canonical, JSON-LD, favicon, sosyal önizleme ve sitemap hazır. **Canonical URL** `/ebs-ai-studio/` olarak ayarlandı. Farklı bir klasöre koyarsanız `index.html` içindeki canonical + og:url + og:image ve `sitemap.xml` adreslerini güncelleyin. Sitemap, sitenin kökünden değil alt klasöründen servis edilir; Search Console'a `https://www.ebubekirbastama.com.tr/ebs-ai-studio/sitemap.xml` adresini gönderebilirsiniz. Bu paket sitenin kök `robots.txt` dosyasını değiştirmez.

## Bilinen teknik sınırlamalar

- Demucs WASM uzak worker ve model çağrısı deneysel; uçtan uca browser testi yapılmadı.
- FFmpeg WASM çevrimiçi CDN üzerinden gelir; ilk çalışmada internet gerekir.
- H.265 / HEVC, standart tarayıcı FFmpeg çekirdeğinde bulunmayabilir. Varsayılan H.264 seçildi.
- PWA arayüzü önbelleklenir; büyük WASM/model/CDN varlıkları çevrimdışı garanti değildir.
- Sürüm doğrulaması için DevTools Console/Network ile test edin; eski PWA kaydını yenileyin.
- Orijinal dosyalar doğrudan tarayıcı belleğinde işlenir, kaynak videolar değiştirilmez.

## Telif

Demucs WASM üçüncü taraf bir açık kaynak projedir; upstream lisanslarına ayrıca uyun.


## 2026-11-07 — FFmpeg yardımcı dosyası düzeltmesi

`@ffmpeg/util@0.12.2/dist/umd/index.js` tarayıcıda `exports is not defined`
hatası çıkardığından CDN script'i çıkarıldı. `fetchFile` ve `toBlobURL`
fonksiyonları `main.js` içinde yerel ve doğrudan tarayıcı uyumlu olarak
yazıldı. npm/build gerekmez. Değişikliklerden sonra eski PWA önbelleğinin
yenilenmesi için uygulamayı kapatıp Ctrl+Shift+R ile tekrar açın.
Not: Demucs çalışma kalitesi ve WASM motoru gerçek video ile henüz doğrulanmamıştır.

## 2026-11-07 — `Cannot find module blob:` FFmpeg düzeltmesi

Önceki sürümde `ffmpeg.load()` işlemi `ffmpeg-core.js` dosyasını `blob:` URL'ye
çeviriyordu. Webpack'in `814.ffmpeg.js` worker paketi içindeki dinamik import
yolu bazı tarayıcılarda bu blob adresini modül olarak arayıp hata veriyordu.

Yeni sürüm `ffmpeg-worker.js` dosyasını uygulamanın kendi sunucusundan açar,
FFmpeg UMD çekirdeğini doğrudan CDN'den `importScripts` ile yükler ve WASM
çekirdeğinin URL'sini doğrudan geçirir. Bu, `npm` veya derleme gerektirmez.

**Gerekli bağlantı:** İnternet bağlantısı ve jsDelivr erişimi. Worker yüklenmezse
F12 → Network sekmesinde `ffmpeg-worker.js`, `814.ffmpeg.js`,
`ffmpeg-core.js` ve `ffmpeg-core.wasm` isteklerini kontrol edin.

**Sınır:** Tarayıcı üzerinde gerçek video dönüşümü bu ortamda test edilmemiştir;
özellikle Demucs ses ayırma ayrı bir entegrasyondur ve bu yamayla doğrulanmış sayılmaz.

**Güncelleme:** Eski PWA service worker'ı varsa Application → Service Workers →
Unregister sonrasında Ctrl+Shift+R kullanın.

## 2026-11-07 — Module Worker düzeltmesi (v6)

Hata: `Module scripts don't support importScripts()`. Önceki `ffmpeg-worker.js`,
modül Worker içinde `importScripts()` çağırdığı için başlatılamıyordu.
Artık `ffmpeg-worker.js`, FFmpeg 0.12.15 ESM Worker modülünü import eder ve
`main.js` çekirdeği `@ffmpeg/core@0.12.10/dist/esm` adresinden ister.
Böylece npm, Vite veya derleme gerektirmez. `index.html` ile aynı dizinde
`ffmpeg-worker.js` olmalıdır. HTTPS üzerinden yayımlayın.

**Test sınırı:** Bu ortamdan CDN'deki WASM motoru indirilemediğinden,
gerçek video işleme testi yapılmadı. CDN bağlantılarının erişilebilir olması
ve tarayıcıda modül importuna izin verilmesi gerekir.

PWA önbelleği için yeni sürüm `ebs-studio-static-v6`; eski sürüm aktifse
Application → Service Workers → Unregister ve ardından hard reload yapın.


## Eski worker önbelleği (v7)
Bu sürüm JS/CSS isteklerini önce ağdan alır ve FFmpeg worker URL'sine sürüm parametresi ekler. Chrome Application > Storage > Clear site data işleminden sonra test edin.
