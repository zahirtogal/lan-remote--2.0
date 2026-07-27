# Proje İlerleme Durumu (PROGRESS.md)

## Proje Adı: LAN Remote (Profesyonel Uzaktan Masaüstü)
**Mevcut Aşama:** Aşama 4 - Adres Defteri ve Kayıtlı Cihazlar Yönetimi

### Tamamlanan Görevler
* [x] Projenin sıfırdan AnyDesk tarzı mimariye göre yeniden planlanması.
* [x] `AGENTS.md` anayasasının güncellenmesi ve kuralların netleştirilmesi.
* [x] Ana Dashboard arayüzünün kurulması (ID ve Bağlan Paneli).
* [x] Gelen bağlantılar için Güvenlik Onay Modalı (Kabul Et / Reddet) entegrasyonu.
* [x] Bağlantı onaylandığında veya kurulduğunda Dashboard'dan **Aktif Seans Ekranı**na geçiş yapılması.
* [x] Kendi yerel önizlememizin arayüzden tamamen kaldırılması (Performans iyileştirmesi).
* [x] Bağlantı sonlandırıldığında WebRTC tünelinin kapatılıp güvenli bir şekilde Dashboard'a geri dönülmesi.
* [x] Minimalist Araç Çubuğu (Toolbar), Tam Ekran, Sohbet, Dosya Aktarımı, Ekran Kaydı ve Bağlantıyı Kes özelliklerinin tasarımı ve entegrasyonu tamamlandı.

### Aktif Görev (Üzerinde Çalışılan)
* [ ] Ana Dashboard ekranına **Adres Defteri (Address Book)** sekmesinin veya panelinin eklenmesi.
* [ ] Kaydedilen uzak cihazların (Cihaz Adı, Uzak ID, Notlar ve Son Bağlantı Tarihi) yerel depolamada (`localStorage` veya SQLite/Electron Store) saklanması.
* [ ] Adres defterindeki bir cihaza **tek tıkla (quick-connect)** bağlanabilme altyapısının kurulması.
* [ ] Kayıt ekleme, düzenleme, silme ve favorilere ekleme arayüz bileşenlerinin `shadcn/ui` uyumlu olarak tasarlanması.

