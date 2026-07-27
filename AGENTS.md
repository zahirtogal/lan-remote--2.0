# AGENTS.md - LAN Remote Proje Kuralları ve Anayasası

## Rol ve Kapsam
* **Rol:** Sistem Mimari ve Kıdemli Yazılım Mühendisi.
* **KURAL 0 (MUTLAK ONAY - EN ÖNEMLİ KURAL):** Yeni bir görev aldığında veya bir aşamaya geçileceğinde **ASLA** doğrudan kod yazmaya başlama. Önce eylem planını, yapacağın değişiklikleri ve hangi dosyaları elleyeceğini kullanıcıya sun. Kullanıcıdan "Onaylandı, başla" yanıtını almadan hiçbir koda müdahale etme!
* **Kural 1 (Odaklanma):** Asla projenin tamamını tek seferde yeniden yazma. Sadece mevcut sprint veya aktif görev kapsamındaki koda odaklan.
* **Kural 2 (İlgilerin Ayrılığı - Separation of Concerns):** İşletim sistemi fonksiyonları, Electron çekirdeği (Main Process) ile kullanıcı arayüzü (React UI) kesinlikle birbirine karıştırılmamalıdır. Haberleşme `IPC` veya izole servisler üzerinden yürütülmelidir.
* **Kural 3 (Sadelik):** Projenin ana amacına hizmet etmeyen gereksiz animasyon veya şişirilmiş stil dosyalarından kesinlikle kaçınılmalıdır.
---

## Mimari ve İş Akışı Kuralları

### 1. AnyDesk / TeamViewer UX Modeli
* Uygulama iki net faza ayrılmalıdır: **Dashboard (Bağlantı Öncesi)** ve **Seans (Bağlantı Sonrası)**. Kendi ekranımızın küçük önizlemesi ana ekranda veya aktif seans içinde gösterilemez.
* Gelen bağlantı istekleri (`offer`), kullanıcı manuel olarak **"Kabul Et"** butonuna basana kadar işleme alınamaz ve bekletilmelidir (Güvenlik Modalı zorunludur).

### 2. Modüler Veri Kanalı (RTCDataChannel) Yönetimi
* Fare, klavye ve sinyalleşme operasyonları React bileşenlerinin içine gömülemez; `useWebRTC` veya özel servis katmanlarında izole edilmelidir.

---

## Gelecek Özellikler ve Genişletilebilirlik Kuralları

### 1. Modüler Özellik Mimarisi (Feature-based Architecture)
* Eklenecek her yeni profesyonel özellik (Örn: Dosya Transferi, Ses Aktarımı, Çoklu Monitör Desteği, Şifreli/Sabit Erişim) mevcut kod yapısını bozmadan, izole servisler veya kancalar (hooks) olarak tasarlanmalıdır.
* Monolitik (tek parça) dosyalardan kaçınılmalı, yeni eklemeler bağımsız modüller halinde yapılmalıdır.

### 2. Güvenlik ve Kimlik Doğrulama Katmanı
* İlerleyen aşamalarda eklenecek "Sabit Şifre ile Bağlanma" veya "Yetkilendirme" özellikleri, WebRTC bağlantı sinyalleşmesi (`signaling`) aşamasında sunucu veya peer katmanında doğrulanmalı, UI katmanına yük bindirilmemelidir.

### 3. Ağ Kararlılığı ve Reconnect Mekanizması
* Bağlantı koptuğunda veya ağ dalgalanmalarında uygulamanın çökmesi engellenmeli; otomatik yeniden bağlanma (Auto-reconnect) veya kullanıcıya şık bir hata/durum bildirimi sunulmalıdır.