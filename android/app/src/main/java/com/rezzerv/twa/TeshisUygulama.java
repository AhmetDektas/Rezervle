package com.rezzerv.twa;

import android.app.Application;
import android.content.Intent;
import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;

/**
 * GEÇİCİ teşhis katmanı.
 *
 * Uygulama telefonda açılışta ölüyor ("sürekli duruyor") ve çökme kaydına
 * erişimimiz yok: cihazda kablosuz hata ayıklama yok (Android 11 öncesi) ve
 * elimizde veri taşıyan USB kablosu da yok. Sebebi tahmin ederek iki tur
 * harcadık; bu sınıf tahmini bitiriyor.
 *
 * Yakalanmayan istisnayı alıp üç yere birden yazıyor:
 *   1. Ekrana (CokmeEkrani) — kullanıcı okuyup aktarabilsin
 *   2. Uygulamanın dış dosya dizinine — Dosyalar'dan açılabilsin
 *   3. Logcat'e — kablo bulunursa oradan da okunabilsin
 *
 * SEBEP BULUNUNCA SİLİNECEK. Son kullanıcıya ham yığın izi göstermek
 * kabul edilebilir bir ürün davranışı değil.
 */
public class TeshisUygulama extends Application {

    @Override
    public void onCreate() {
        super.onCreate();

        final Thread.UncaughtExceptionHandler onceki =
                Thread.getDefaultUncaughtExceptionHandler();

        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread t, Throwable e) {
                String iz = izeCevir(e);
                android.util.Log.e("RezzervTeshis", iz);
                dosyayaYaz(iz);
                ekranaGoster(iz);
                // Süreci kapat: çöken süreci ayakta tutmak tanımsız davranış.
                android.os.Process.killProcess(android.os.Process.myPid());
                System.exit(10);
            }
        });
    }

    private String izeCevir(Throwable e) {
        StringWriter sw = new StringWriter();
        sw.write("Rezzerv çökme kaydı\n");
        sw.write("cihaz: " + android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL + "\n");
        sw.write("android: " + android.os.Build.VERSION.RELEASE
                + " (API " + android.os.Build.VERSION.SDK_INT + ")\n\n");
        e.printStackTrace(new PrintWriter(sw));
        return sw.toString();
    }

    private void dosyayaYaz(String iz) {
        try {
            File d = getExternalFilesDir(null);
            if (d == null) return;
            FileOutputStream fos = new FileOutputStream(new File(d, "cokme.txt"));
            fos.write(iz.getBytes("UTF-8"));
            fos.close();
        } catch (Throwable yoksay) {
            // Teşhis katmanı asla ikinci bir çökme üretmemeli.
        }
    }

    private void ekranaGoster(String iz) {
        try {
            Intent i = new Intent(this, CokmeEkrani.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            i.putExtra("iz", iz);
            startActivity(i);
        } catch (Throwable yoksay) {
            // Etkinlik başlatılamazsa dosya ve logcat hâlâ elimizde.
        }
    }
}
