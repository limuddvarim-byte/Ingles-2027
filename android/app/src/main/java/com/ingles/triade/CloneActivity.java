package com.ingles.triade;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.LocaleList;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.webkit.ProfileStore;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * "Versões clonadas" (Real World/Instagram, YouTube, ChatGPT, Gemini, Claude):
 * navegador isolado dentro do app, em abas, cada clone com seu próprio perfil
 * (cookies/conta separados do app oficial) e sempre pedindo conteúdo em inglês.
 */
public class CloneActivity extends Activity {
    public static final String EXTRA_TABS = "tabs";
    public static final String EXTRA_START = "start";
    private static final String UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
    private static final int FILE_REQ = 4242;

    private final List<WebView> webViews = new ArrayList<>();
    private final List<TextView> chips = new ArrayList<>();
    private final List<String> services = new ArrayList<>();
    private final List<String> injects = new ArrayList<>();
    private FrameLayout content;
    private ProgressBar progress;
    private int current = 0;
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;
    private ValueCallback<Uri[]> fileCallback;
    private Locale previousLocale;

    private static final String WATCH_JS =
        "(function(){if(window.__inglesWatch)return;window.__inglesWatch=1;setInterval(function(){var v=document.querySelectorAll('video');" +
        "for(var i=0;i<v.length;i++){if(!v[i].paused&&!v[i].ended&&v[i].readyState>2){try{InglesWatch.tick()}catch(e){}return;}}},5000);})();";

    private final Map<String, Long> lastTick = new HashMap<>();

    private class WatchBridge {
        private final String service;
        WatchBridge(String service) { this.service = service; }

        @JavascriptInterface
        public void tick() {
            if (service == null) return;
            long now = System.currentTimeMillis();
            Long prev = lastTick.get(service);
            lastTick.put(service, now);
            if (prev != null) WatchStore.add(CloneActivity.this, service, Math.min(now - prev, 10000) / 1000.0);
        }
    }

    private static int dp(Activity a, int v) {
        return Math.round(v * a.getResources().getDisplayMetrics().density);
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        // Pede conteúdo em inglês (Accept-Language / navigator.language).
        previousLocale = Locale.getDefault();
        Locale.setDefault(Locale.US);
        LocaleList.setDefault(new LocaleList(Locale.US, Locale.ENGLISH));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.BLACK);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(this, 8), dp(this, 8), dp(this, 8), dp(this, 8));
        bar.setBackgroundColor(Color.parseColor("#0A0A0F"));

        HorizontalScrollView scroll = new HorizontalScrollView(this);
        scroll.setHorizontalScrollBarEnabled(false);
        LinearLayout tabsRow = new LinearLayout(this);
        tabsRow.setOrientation(LinearLayout.HORIZONTAL);
        scroll.addView(tabsRow);
        bar.addView(scroll, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        bar.addView(iconButton("⟳", v -> { if (!webViews.isEmpty()) webViews.get(current).reload(); }));
        bar.addView(iconButton("✕", v -> finish()));
        root.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#14D2C8")));
        root.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(this, 3)));

        content = new FrameLayout(this);
        root.addView(content, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        CookieManager.getInstance().setAcceptCookie(true);

        try {
            JSONArray tabs = new JSONArray(getIntent().getStringExtra(EXTRA_TABS));
            for (int i = 0; i < tabs.length(); i++) {
                JSONObject t = tabs.getJSONObject(i);
                addTab(tabsRow, t.optString("title", "Aba"), t.getString("url"), t.optString("profile", "default"), t.optString("inject", null), t.optString("service", null));
            }
        } catch (Exception e) {
            finish();
            return;
        }
        select(Math.min(getIntent().getIntExtra(EXTRA_START, 0), webViews.size() - 1));
    }

    private TextView iconButton(String label, View.OnClickListener l) {
        TextView b = new TextView(this);
        b.setText(label);
        b.setTextColor(Color.WHITE);
        b.setTextSize(18);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(this, 12), dp(this, 6), dp(this, 12), dp(this, 6));
        b.setOnClickListener(l);
        return b;
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void addTab(LinearLayout row, String title, String url, String profile, String inject, String service) {
        final int index = webViews.size();
        WebView wv = new WebView(this);
        // Cada clone com seu próprio perfil (conta separada), quando o WebView do aparelho suporta.
        try {
            if (WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)) {
                ProfileStore.getInstance().getOrCreateProfile("clone-" + profile);
                WebViewCompat.setProfile(wv, "clone-" + profile);
            }
        } catch (Throwable ignored) {
        }
        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setUserAgentString(UA);
        CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true);
        wv.setBackgroundColor(Color.BLACK);
        wv.addJavascriptInterface(new WatchBridge(service), "InglesWatch");
        services.add(service);
        injects.add(inject);
        wv.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                String scheme = req.getUrl().getScheme();
                if ("http".equals(scheme) || "https".equals(scheme)) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, req.getUrl()));
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String u) {
                if (services.get(index) != null) view.evaluateJavascript(WATCH_JS, null);
                String js = injects.get(index);
                if (js != null && !js.isEmpty()) {
                    view.evaluateJavascript(js, null);
                    injects.set(index, null); // só uma vez
                }
            }
        });
        wv.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) {
                if (index == current) {
                    progress.setProgress(p);
                    progress.setVisibility(p >= 100 ? View.INVISIBLE : View.VISIBLE);
                }
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback cb) {
                customView = view;
                customCallback = cb;
                ((ViewGroup) getWindow().getDecorView()).addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            }

            @Override
            public void onHideCustomView() {
                if (customView != null) ((ViewGroup) getWindow().getDecorView()).removeView(customView);
                customView = null;
                if (customCallback != null) customCallback.onCustomViewHidden();
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    startActivityForResult(params.createIntent(), FILE_REQ);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });
        Map<String, String> headers = new HashMap<>();
        headers.put("Accept-Language", "en-US,en;q=0.9");
        wv.loadUrl(url, headers);
        wv.setVisibility(View.GONE);
        content.addView(wv, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webViews.add(wv);

        TextView chip = new TextView(this);
        chip.setText(title);
        chip.setTextColor(Color.WHITE);
        chip.setTextSize(14);
        chip.setTypeface(Typeface.DEFAULT_BOLD);
        chip.setPadding(dp(this, 14), dp(this, 8), dp(this, 14), dp(this, 8));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, dp(this, 6), 0);
        chip.setOnClickListener(v -> select(index));
        row.addView(chip, lp);
        chips.add(chip);
    }

    private void select(int i) {
        current = i;
        for (int k = 0; k < webViews.size(); k++) {
            boolean on = k == i;
            webViews.get(k).setVisibility(on ? View.VISIBLE : View.GONE);
            GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                on ? new int[]{Color.parseColor("#C2389B"), Color.parseColor("#2E44B8")} : new int[]{Color.parseColor("#1A1A24"), Color.parseColor("#1A1A24")});
            bg.setCornerRadius(dp(this, 14));
            chips.get(k).setBackground(bg);
            chips.get(k).setAlpha(on ? 1f : 0.75f);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_REQ && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            ((ViewGroup) getWindow().getDecorView()).removeView(customView);
            customView = null;
            if (customCallback != null) customCallback.onCustomViewHidden();
            return;
        }
        if (!webViews.isEmpty() && webViews.get(current).canGoBack()) {
            webViews.get(current).goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onDestroy() {
        for (WebView w : webViews) {
            try {
                w.destroy();
            } catch (Exception ignored) {
            }
        }
        if (previousLocale != null) {
            Locale.setDefault(previousLocale);
            LocaleList.setDefault(new LocaleList(previousLocale));
        }
        super.onDestroy();
    }
}
