GIF ARKA PLAN KURULUM KILAVUZU
==============================

Bu klasöre koyacağınız GIF'ler kazanan duyurularında arka plan olarak OTOMATİK görünecek.

NASIL KULLANILIR:
1. GIF dosyalarınızı bu klasöre kopyalayın
2. Sistem otomatik olarak tüm GIF'leri okur
3. Her kazanan duyurusunda rastgele bir GIF gösterilir

ÖRNEK GIF İSİMLERİ:
- celebration1.gif - Kutlama animasyonu
- celebration2.gif - Konfeti animasyonu
- money1.gif - Para yağmuru
- money2.gif - Altın yağmuru
- winner1.gif - Kupa animasyonu
- winner2.gif - Madalya animasyonu
- party1.gif - Parti animasyonu
- party2.gif - Havai fişek animasyonu

ÖNERİLER:
- GIF boyutu: 1920x1080 veya 1280x720
- Dosya boyutu: Max 5MB
- Format: Animasyonlu GIF
- Döngülü (loop) GIF'ler kullanın

GIF GÖRÜNÜMÜ:
- Opacity: %30 (yarı saydam)
- Blur: 2px (hafif bulanık)
- Arka planda tam ekran görünür

YENİ GIF EKLEME:
1. GIF'i bu klasöre kopyala
2. progress.html dosyasında winnerGifs dizisine ekle:
   const winnerGifs = [
       'yeni-gif.gif',  // Yeni eklenen
       ...
   ];