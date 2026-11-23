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
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
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
    private final List<String> titles = new ArrayList<>();
    private final List<int[]> tabColors = new ArrayList<>();
    private TextView headerTitle;
    private TextView headerBadge;
    private LinearLayout bottomNav;
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

        // Desenha atrás das barras do sistema, mas com espaçamento correto (Android 15 edge-to-edge):
        // o cabeçalho nunca fica embaixo do relógio/notificações.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat ctl = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        ctl.setAppearanceLightStatusBars(false);
        ctl.setAppearanceLightNavigationBars(false);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#050508"));

        // ---------- cabeçalho com a identidade do clone
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(this, 14), dp(this, 10), dp(this, 10), dp(this, 10));
        header.setBackgroundColor(Color.parseColor("#050508"));

        headerBadge = new TextView(this);
        headerBadge.setTextColor(Color.WHITE);
        headerBadge.setTypeface(Typeface.DEFAULT_BOLD);
        headerBadge.setTextSize(16);
        headerBadge.setGravity(Gravity.CENTER);
        header.addView(headerBadge, new LinearLayout.LayoutParams(dp(this, 36), dp(this, 36)));

        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        titles.setPadding(dp(this, 12), 0, 0, 0);
        headerTitle = new TextView(this);
        headerTitle.setTextColor(Color.WHITE);
        headerTitle.setTextSize(17);
        headerTitle.setTypeface(Typeface.create("sans-serif-medium", Typeface.BOLD));
        TextView sub = new TextView(this);
        sub.setText("CLONE ISOLADO · EN-US");
        sub.setTextColor(Color.parseColor("#14F0D8"));
        sub.setTextSize(10);
        sub.setLetterSpacing(0.12f);
        sub.setTypeface(Typeface.MONOSPACE);
        titles.addView(headerTitle);
        titles.addView(sub);
        header.addView(titles, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        header.addView(roundButton("↻", v -> { if (!webViews.isEmpty()) webViews.get(current).reload(); }));
        View gap = new View(this);
        header.addView(gap, new LinearLayout.LayoutParams(dp(this, 8), 1));
        header.addView(roundButton("✕", v -> finish()));
        root.addView(header, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#14F0D8")));
        progress.setProgressBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.parseColor("#050508")));
        root.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(this, 2)));

        content = new FrameLayout(this);
        root.addView(content, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        // ---------- navegação inferior (só quando há mais de um app, ex.: Gemini · ChatGPT · Claude)
        bottomNav = new LinearLayout(this);
        bottomNav.setOrientation(LinearLayout.HORIZONTAL);
        bottomNav.setPadding(dp(this, 6), dp(this, 6), dp(this, 6), dp(this, 6));
        GradientDrawable navBg = new GradientDrawable();
        navBg.setColor(Color.parseColor("#12121A"));
        navBg.setCornerRadius(dp(this, 24));
        navBg.setStroke(dp(this, 1), Color.parseColor("#26263A"));
        bottomNav.setBackground(navBg);
        LinearLayout.LayoutParams navLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        navLp.setMargins(dp(this, 10), dp(this, 8), dp(this, 10), dp(this, 8));
        root.addView(bottomNav, navLp);

        setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });

        CookieManager.getInstance().setAcceptCookie(true);

        try {
            JSONArray tabs = new JSONArray(getIntent().getStringExtra(EXTRA_TABS));
            for (int i = 0; i < tabs.length(); i++) {
                JSONObject t = tabs.getJSONObject(i);
                int[] colors = new int[]{Color.parseColor("#C2389B"), Color.parseColor("#2E44B8")};
                JSONArray c = t.optJSONArray("colors");
                if (c != null && c.length() >= 2) {
                    try {
                        colors = new int[]{Color.parseColor(c.getString(0)), Color.parseColor(c.getString(1))};
                    } catch (Exception ignored) {
                    }
                }
                addTab(bottomNav, str(t, "title", "App"), t.getString("url"), str(t, "profile", "default"), str(t, "inject", null), str(t, "service", null), colors);
            }
        } catch (Exception e) {
            finish();
            return;
        }
        bottomNav.setVisibility(webViews.size() > 1 ? View.VISIBLE : View.GONE);
        select(Math.min(getIntent().getIntExtra(EXTRA_START, 0), webViews.size() - 1));
    }

    /** optString que trata JSON null como ausente. */
    private static String str(JSONObject o, String key, String fallback) {
        if (!o.has(key) || o.isNull(key)) return fallback;
        String v = o.optString(key, fallback);
        return v == null || v.isEmpty() ? fallback : v;
    }

    private TextView roundButton(String label, View.OnClickListener l) {
        TextView b = new TextView(this);
        b.setText(label);
        b.setTextColor(Color.WHITE);
        b.setTextSize(16);
        b.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Color.parseColor("#16161F"));
        bg.setStroke(dp(this, 1), Color.parseColor("#2A2A3C"));
        b.setBackground(bg);
        b.setLayoutParams(new LinearLayout.LayoutParams(dp(this, 38), dp(this, 38)));
        b.setOnClickListener(l);
        return b;
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void addTab(LinearLayout row, String title, String url, String profile, String inject, String service, int[] colors) {
        final int index = webViews.size();
        titles.add(title);
        tabColors.add(colors);
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
        chip.setGravity(Gravity.CENTER);
        chip.setPadding(dp(this, 8), dp(this, 12), dp(this, 8), dp(this, 12));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        lp.setMargins(dp(this, 3), 0, dp(this, 3), 0);
        chip.setOnClickListener(v -> select(index));
        row.addView(chip, lp);
        chips.add(chip);
    }

    private void select(int i) {
        current = i;
        for (int k = 0; k < webViews.size(); k++) {
            boolean on = k == i;
            webViews.get(k).setVisibility(on ? View.VISIBLE : View.GONE);
            int[] c = tabColors.get(k);
            GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, on ? c : new int[]{Color.TRANSPARENT, Color.TRANSPARENT});
            bg.setCornerRadius(dp(this, 18));
            chips.get(k).setBackground(bg);
            chips.get(k).setTextColor(on ? Color.WHITE : Color.parseColor("#8A88A3"));
        }
        // cabeçalho com nome e cor do app atual
        headerTitle.setText(titles.get(i));
        headerBadge.setText(titles.get(i).isEmpty() ? "•" : titles.get(i).substring(0, 1).toUpperCase(Locale.ROOT));
        GradientDrawable badge = new GradientDrawable(GradientDrawable.Orientation.TL_BR, tabColors.get(i));
        badge.setCornerRadius(dp(this, 11));
        headerBadge.setBackground(badge);
        progress.setProgressTintList(android.content.res.ColorStateList.valueOf(tabColors.get(i)[0]));
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
