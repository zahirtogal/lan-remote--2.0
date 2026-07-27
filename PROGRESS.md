# Proje İlerleme Durumu (PROGRESS.md)

## Proje Adı: LAN Remote (Profesyonel Uzaktan Masaüstü)
**Mevcut Aşama:** Aşama 7 - Çoklu Ekran / Monitör Desteği (Multi-Monitor Switching)

### Tamamlanan Görevler
* [x] Projenin sıfırdan AnyDesk tarzı mimariye göre yeniden planlanması.
* [x] `AGENTS.md` anayasasının güncellenmesi ve kuralların netleştirilmesi.
* [x] Ana Dashboard arayüzünün kurulması (ID ve Bağlan Paneli).
* [x] Gelen bağlantılar için Güvenlik Onay Modalı (Kabul Et / Reddet) entegrasyonu.
* [x] Bağlantı onaylandığında veya kurulduğunda Dashboard'dan **Aktif Seans Ekranı**na geçiş yapılması.
* [x] Kendi yerel önizlememizin arayüzden tamamen kaldırılması (Performans iyileştirmesi).
* [x] Bağlantı sonlandırıldığında WebRTC tünelinin kapatılıp güvenli bir şekilde Dashboard'a geri dönülmesi.
* [x] Minimalist Araç Çubuğu (Toolbar), Tam Ekran, Sohbet, Dosya Aktarımı, Ekran Kaydı ve Bağlantıyı Kes özelliklerinin tasarımı ve entegrasyonu tamamlandı.
* [x] Adres Defteri ve Kayıtlı Cihazlar Yönetimi (`localStorage` entegrasyonu ile).
* [x] Kalıcı ID (Persistent Client ID) mekanizmasının kurulması.
* [x] Render bulut sinyal sunucusu entegrasyonunun tamamlanması.
* [x] WebRTC `RTCDataChannel` üzerinden parça tabanlı (chunking) güvenli dosya aktarımı ve indirme mekanizması.
* [x] WebRTC `RTCDataChannel` üzerinden JSON tabanlı anlık Canlı Sohbet (Live Chat) entegrasyonu.

### Aktif Görev (Üzerinde Çalışılan)
* [ ] Hedef cihazda bulunan birden fazla ekranın (monitörün) Electron `desktopCapturer.getSources({ types: ['screen'] })` ile listelenmesi.
* [ ] Araç çubuğu (Toolbar) üzerine bir Monitör Seçim Menüsü/Dropdown eklenerek istenen ekrana geçiş yapılabilmesi.
* [ ] Seçilen yeni monitör akışının (MediaStream) mevcut WebRTC tüneli üzerinden karşı tarafa kesintisiz yansıtılması.