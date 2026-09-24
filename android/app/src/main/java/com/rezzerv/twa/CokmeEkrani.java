package com.rezzerv.twa;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.util.TypedValue;
import android.widget.ScrollView;
import android.widget.TextView;

/** GEÇİCİ: çökme izini okunabilir şekilde gösterir. Sebep bulununca silinecek. */
public class CokmeEkrani extends Activity {

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);

        TextView tv = new TextView(this);
        tv.setText(getIntent().getStringExtra("iz"));
        // Seçilebilir olmalı: kullanıcı metni kopyalayıp gönderebilsin.
        tv.setTextIsSelectable(true);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        tv.setTextColor(Color.BLACK);
        tv.setPadding(24, 24, 24, 24);

        ScrollView sv = new ScrollView(this);
        sv.setBackgroundColor(Color.WHITE);
        sv.addView(tv);
        setContentView(sv);
    }
}
