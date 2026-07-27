# LAN Remote - Render Bulut Dağıtım (Deployment) Rehberi

Bu rehber, projenizdeki WebRTC `signaling-server` uygulamasını Render (render.com) gibi bulut platformlarında ücretsiz veya ücretli hesaplarla nasıl ayağa kaldıracağınızı açıklar.

## 1. Sinyal Sunucusunu (Signaling Server) Render'a Yükleme

1. **Yeni Web Service Oluşturun:**
   - Render dashboard üzerinde **New +** butonuna tıklayın ve **Web Service** seçin.
   - GitHub (veya GitLab vb.) yönlendirmenizi yaparak LAN Remote projesinin repository'sini seçin.

2. **Temel Ayarlar:**
   - **Name:** `lan-remote-signaling` (kendiniz belirleyebilirsiniz)
   - **Region:** Müşterilerinize / size en yakın bölge (Örn: Frankfurt, Europe)
   - **Branch:** `main` (veya kodunuz hangi dalda ise)
   - **Root Directory:** `./signaling-server` (Sadece sunucu kodunun olduğu bu dizini kullanması önemlidir)
   - **Environment:** `Node`

3. **Build ve Start Komutları:**
   - **Build Command:** `npm install`
   - **Start Command:** `npm start` (veya `node src/index.js`)

4. **Port ve CORS Yapılandırması:**
   - Uygulamanız zaten `process.env.PORT` ortam değişkenini kullanıyor ve Express ile CORS'a izin veriyor. Render arka planda bu portu statik TLS (WSS - WebSocket Secure) adresine bağlayacaktır.
   - Herhangi başka çevresel değişkene (Environment Variable) ihtiyaç yoktur.

5. **Oluşturun ve Adresinizi Alın:**
   - Süreç tamamlandığında Render size `https://lan-remote-signaling-xxyy.onrender.com` gibi bir adres verecektir. 
   - WebSocket bağlantısı için bunu **`wss://lan-remote-signaling-xxyy.onrender.com`** şeklinde düşünebilirsiniz.

---

## 2. İstemci (Client - React/Electron) Ayarları

WebRTC'nin yeni bulut sunucunuz aracılığıyla haberleşebilmesi için istemciyi inşa etmeden önce adresin değiştirilmesi gerekmektedir.

1. **Yöntem 1: `.env` Dosyası Kullanımı (Önerilen)**
   - `client` klasörünüzde `.env` isimli bir dosya oluşturun:
     ```env
     VITE_WS_URL=wss://lan-remote-signaling-xxyy.onrender.com
     ```
   - React tarafındaki Vite altyapısı bu değişkeni otomatik alarak yapılandıracaktır.

2. **Yöntem 2: Koda Doğrudan Yazma (Build Öncesi Değişiklik)**
   Eğer `.env` ile yapmazsanız `client/src/hooks/useWebRTC.js` dosyasının 38. satırında yer alan fallback adresini kalıcı adresiniz ile değiştirebilirsiniz:
   ```javascript
   const SIGNALING_SERVER_URL = import.meta.env.VITE_WS_URL || 'wss://lan-remote-signaling-xxyy.onrender.com';
   ```

*Not: Uygulamanızı Electron ortamı için dışarı aktarmadan (`npm run build`) hemen önce `VITE_WS_URL` değişkeninin doğru ayarlandığına %100 emin olun.*
