package com.ingles.triade;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Contadores de tempo de streaming deste celular (por dia e serviço). */
public final class WatchStore {
    private static final String PREFS = "ingles_watch";
    private static final Map<String, Long> LIVE = new HashMap<>();

    /** Pacotes de apps de streaming → serviço da tríade. */
    public static final Map<String, String> PACKAGES = new HashMap<>();
    static {
        PACKAGES.put("com.netflix.mediaclient", "netflix");
        PACKAGES.put("com.wbd.stream", "hbomax");
        PACKAGES.put("com.hbo.hbonow", "hbomax");
        PACKAGES.put("com.disney.disneyplus", "disney");
        PACKAGES.put("com.crunchyroll.crunchyroid", "crunchyroll");
        PACKAGES.put("com.amazon.avod.thirdpartyclient", "prime");
        PACKAGES.put("com.amazon.avod", "prime");
        PACKAGES.put("com.apple.atve.androidtv.appletv", "appletv");
        PACKAGES.put("com.apple.atve.sony.appletv", "appletv");
        PACKAGES.put("com.google.android.youtube", "youtube");
    }

    private WatchStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    public static synchronized boolean isPaused(Context c, String service) {
        SharedPreferences p = prefs(c);
        if (p.getBoolean("allPaused", false)) return true;
        Set<String> paused = p.getStringSet("paused", new HashSet<>());
        return paused != null && paused.contains(service);
    }

    public static synchronized void setConfig(Context c, Set<String> paused, boolean allPaused) {
        prefs(c).edit().putStringSet("paused", paused).putBoolean("allPaused", allPaused).apply();
    }

    /** Soma segundos ao contador do dia (ignora valores absurdos e serviços pausados). */
    public static synchronized void add(Context c, String service, double seconds) {
        if (service == null || seconds <= 0 || seconds > 120) return;
        if (isPaused(c, service)) return;
        SharedPreferences p = prefs(c);
        String key = "t:" + today() + ":" + service;
        float cur = p.getFloat(key, 0f);
        p.edit().putFloat(key, (float) (cur + seconds)).apply();
        LIVE.put(service, System.currentTimeMillis());
    }

    /** Totais dos últimos dias + quem está "ao vivo" — lidos pelo JavaScript. */
    public static synchronized JSONObject snapshot(Context c) {
        JSONObject out = new JSONObject();
        try {
            JSONArray totals = new JSONArray();
            SharedPreferences p = prefs(c);
            String cutoff = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(System.currentTimeMillis() - 40L * 86400000L));
            SharedPreferences.Editor ed = p.edit();
            for (Map.Entry<String, ?> e : p.getAll().entrySet()) {
                if (!e.getKey().startsWith("t:")) continue;
                String[] parts = e.getKey().split(":");
                if (parts.length != 3) continue;
                if (parts[1].compareTo(cutoff) < 0) { ed.remove(e.getKey()); continue; }
                JSONObject o = new JSONObject();
                o.put("day", parts[1]);
                o.put("service", parts[2]);
                o.put("seconds", ((Number) e.getValue()).doubleValue());
                totals.put(o);
            }
            ed.apply();
            JSONArray live = new JSONArray();
            long now = System.currentTimeMillis();
            Iterator<Map.Entry<String, Long>> it = LIVE.entrySet().iterator();
            while (it.hasNext()) {
                Map.Entry<String, Long> e = it.next();
                if (now - e.getValue() > 20000) { it.remove(); continue; }
                JSONObject o = new JSONObject();
                o.put("service", e.getKey());
                o.put("at", e.getValue());
                live.put(o);
            }
            out.put("totals", totals);
            out.put("live", live);
        } catch (Exception ignored) {
        }
        return out;
    }
}
