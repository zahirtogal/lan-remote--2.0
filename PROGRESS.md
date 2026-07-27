# Proje İlerleme Durumu (PROGRESS.md)

## Proje Adı: LAN Remote (Profesyonel Uzaktan Masaüstü)
**Mevcut Aşama:** Aşama 10 - Kalite ve Çözünürlük Ayarı (Quality & Bandwidth Switcher)

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
* [x] Electron `desktopCapturer` ile Çoklu Ekran / Monitör Desteği ve anlık geçiş mekanizması.
* [x] Electron `clipboard` ve `RTCDataChannel` ile Pano Eşitleme (Clipboard Sync) altyapısı.
* [x] Ağ kopmalarına karşı `iceConnectionState` tabanlı Otomatik Yeniden Bağlanma (Auto-Reconnect).

### Aktif Görev (Üzerinde Çalışılan)
* [ ] Aktif seans araç çubuğuna (Toolbar) kalite/çözünürlük seçim menüsünün (Yüksek Kalite, Dengeli, Düşük Bant Genişliği) eklenmesi.
* [ ] WebRTC video akış kısıtlamalarının (`constraints` / `maxFramerate` / `maxBitrate`) dinamik olarak güncellenmesi.