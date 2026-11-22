package com.ingles.triade;

import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;
import java.util.Set;

/** Ponte nativa do app "Inglês". */
@CapacitorPlugin(
    name = "Ingles",
    permissions = { @Permission(alias = "anki", strings = { InglesPlugin.ANKI_PERMISSION }) }
)
public class InglesPlugin extends Plugin {
    static final String ANKI_PERMISSION = "com.ichi2.anki.permission.READ_WRITE_DATABASE";
    private static final String ANKI_PKG = "com.ichi2.anki";
    private static final Uri ANKI = Uri.parse("content://com.ichi2.anki.flashcards");
    private static final String MODEL_NAME = "Inglês (Tríade)";
    private static final String FS = "\u001f";

    // ------------------------------------------------------------ clones / apps

    @PluginMethod
    public void openClone(PluginCall call) {
        try {
            JSArray tabs = call.getArray("tabs");
            Intent i = new Intent(getContext(), CloneActivity.class);
            i.putExtra(CloneActivity.EXTRA_TABS, tabs.toString());
            i.putExtra(CloneActivity.EXTRA_START, call.getInt("start", 0).intValue());
            getActivity().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void openApp(PluginCall call) {
        String pkg = call.getString("package");
        String url = call.getString("url");
        JSObject r = new JSObject();
        PackageManager pm = getContext().getPackageManager();
        if (!TextUtils.isEmpty(pkg)) {
            Intent launch = pm.getLaunchIntentForPackage(pkg);
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(launch);
                r.put("opened", "app");
                call.resolve(r);
                return;
            }
        }
        try {
            Intent view = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(view);
            r.put("opened", "browser");
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Não foi possível abrir: " + e.getMessage());
        }
    }

    // ------------------------------------------------------------ OCR (Google ML Kit, no aparelho)

    @PluginMethod
    public void ocr(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Imagem não informada");
            return;
        }
        try {
            Uri uri = path.startsWith("content://") || path.startsWith("file://") ? Uri.parse(path) : Uri.fromFile(new File(path));
            InputImage image = InputImage.fromFilePath(getContext(), uri);
            TextRecognizer rec = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            rec.process(image)
                .addOnSuccessListener((Text text) -> {
                    StringBuilder sb = new StringBuilder();
                    for (Text.TextBlock b : text.getTextBlocks()) {
                        // junta as linhas de um mesmo bloco (parágrafo) e separa blocos
                        StringBuilder para = new StringBuilder();
                        for (Text.Line l : b.getLines()) {
                            String t = l.getText().trim();
                            if (t.isEmpty()) continue;
                            if (para.length() > 0) {
                                char lastC = para.charAt(para.length() - 1);
                                if (lastC == '-') para.setLength(para.length() - 1);
                                else para.append(' ');
                            }
                            para.append(t);
                        }
                        if (para.length() > 0) sb.append(para).append("\n");
                    }
                    JSObject r = new JSObject();
                    r.put("text", sb.toString().trim());
                    call.resolve(r);
                    rec.close();
                })
                .addOnFailureListener(e -> {
                    call.reject("Falha ao ler o texto: " + e.getMessage());
                    rec.close();
                });
        } catch (Exception e) {
            call.reject("Falha ao abrir a imagem: " + e.getMessage());
        }
    }

    // ------------------------------------------------------------ AnkiDroid

    private boolean ankiInstalled() {
        try {
            getContext().getPackageManager().getPackageInfo(ANKI_PKG, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void ankiStatus(PluginCall call) {
        JSObject r = new JSObject();
        r.put("installed", ankiInstalled());
        r.put("permission", getPermissionState("anki") == PermissionState.GRANTED);
        call.resolve(r);
    }

    @PluginMethod
    public void ankiRequestPermission(PluginCall call) {
        if (getPermissionState("anki") == PermissionState.GRANTED) {
            JSObject r = new JSObject();
            r.put("granted", true);
            call.resolve(r);
            return;
        }
        requestPermissionForAlias("anki", call, "ankiPermCallback");
    }

    @PermissionCallback
    private void ankiPermCallback(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", getPermissionState("anki") == PermissionState.GRANTED);
        call.resolve(r);
    }

    @PluginMethod
    public void ankiDecks(PluginCall call) {
        try {
            JSArray decks = new JSArray();
            Cursor c = getContext().getContentResolver().query(Uri.withAppendedPath(ANKI, "decks"), new String[]{"deck_id", "deck_name"}, null, null, null);
            if (c != null) {
                while (c.moveToNext()) {
                    JSObject d = new JSObject();
                    d.put("id", String.valueOf(c.getLong(0)));
                    d.put("name", c.getString(1));
                    decks.put(d);
                }
                c.close();
            }
            JSObject r = new JSObject();
            r.put("decks", decks);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("AnkiDroid: " + e.getMessage());
        }
    }

    private long findDeck(String name) {
        Cursor c = getContext().getContentResolver().query(Uri.withAppendedPath(ANKI, "decks"), new String[]{"deck_id", "deck_name"}, null, null, null);
        long id = -1;
        if (c != null) {
            while (c.moveToNext()) if (name.equals(c.getString(1))) id = c.getLong(0);
            c.close();
        }
        return id;
    }

    private long createDeck(String name) {
        long id = findDeck(name);
        if (id >= 0) return id;
        ContentValues v = new ContentValues();
        v.put("deck_name", name);
        Uri u = getContext().getContentResolver().insert(Uri.withAppendedPath(ANKI, "decks"), v);
        return u == null ? -1 : Long.parseLong(u.getLastPathSegment());
    }

    @PluginMethod
    public void ankiCreateDeck(PluginCall call) {
        try {
            long id = createDeck(call.getString("name", "Inglês"));
            JSObject r = new JSObject();
            r.put("id", String.valueOf(id));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("AnkiDroid: " + e.getMessage());
        }
    }

    private long ensureModel(ContentResolver cr, long deckId) {
        Cursor c = cr.query(Uri.withAppendedPath(ANKI, "models"), new String[]{"_id", "name"}, null, null, null);
        if (c != null) {
            while (c.moveToNext()) {
                if (MODEL_NAME.equals(c.getString(1))) {
                    long id = c.getLong(0);
                    c.close();
                    return id;
                }
            }
            c.close();
        }
        ContentValues v = new ContentValues();
        v.put("name", MODEL_NAME);
        v.put("field_names", TextUtils.join(FS, new String[]{"Frente", "Verso", "Audio", "Notas"}));
        v.put("num_cards", 1);
        v.put("css", ".card{font-family:sans-serif;font-size:24px;text-align:center;color:#111;background:#fff}.nightMode .card{color:#fff;background:#000}.term{border-bottom:2px dashed #14D2C8}.notes{margin-top:16px;font-size:16px;text-align:left}hr#answer{border:0;height:2px;background:#7b3fd0}");
        v.put("deck_id", deckId);
        v.put("sort_field_index", 0);
        v.put("type", 0);
        Uri modelUri = cr.insert(Uri.withAppendedPath(ANKI, "models"), v);
        if (modelUri == null) return -1;
        long mid = Long.parseLong(modelUri.getLastPathSegment());
        ContentValues t = new ContentValues();
        t.put("card_template_name", "Inglês");
        t.put("question_format", "{{Frente}}<div>{{Audio}}</div>");
        t.put("answer_format", "{{FrontSide}}<hr id=answer>{{Verso}}{{#Notas}}<div class=notes>{{Notas}}</div>{{/Notas}}");
        cr.update(Uri.withAppendedPath(Uri.withAppendedPath(modelUri, "templates"), "0"), t, null, null);
        return mid;
    }

    @PluginMethod
    public void ankiAddNote(PluginCall call) {
        try {
            Context ctx = getContext();
            ContentResolver cr = ctx.getContentResolver();
            long deckId = createDeck(call.getString("deck", "Inglês"));
            long mid = ensureModel(cr, deckId);
            if (mid < 0) throw new Exception("não foi possível criar o tipo de nota");

            String audioField = "";
            String b64 = call.getString("audioBase64");
            if (b64 != null && !b64.isEmpty()) {
                File dir = new File(ctx.getCacheDir(), "anki");
                dir.mkdirs();
                String name = call.getString("audioName", "ingles.mp3");
                File f = new File(dir, name);
                try (OutputStream os = new FileOutputStream(f)) {
                    os.write(Base64.decode(b64, Base64.DEFAULT));
                }
                Uri fileUri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);
                ctx.grantUriPermission(ANKI_PKG, fileUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                ContentValues mv = new ContentValues();
                mv.put("file_uri", fileUri.toString());
                mv.put("preferred_name", name.replace(".mp3", ""));
                Uri res = cr.insert(Uri.withAppendedPath(ANKI, "media"), mv);
                if (res != null && res.getPath() != null) audioField = "[sound:" + new File(res.getPath()).getName() + "]";
            }

            ContentValues v = new ContentValues();
            v.put("mid", mid);
            v.put("flds", TextUtils.join(FS, new String[]{call.getString("front", ""), call.getString("back", ""), audioField, call.getString("notes", "")}));
            v.put("tags", "ingles");
            Uri note = cr.insert(Uri.withAppendedPath(ANKI, "notes"), v);
            if (note == null) throw new Exception("o AnkiDroid recusou o card (duplicado?)");

            // move os cards da nota para o baralho escolhido
            Uri cards = Uri.withAppendedPath(note, "cards");
            Cursor c = cr.query(cards, null, null, null, null);
            if (c != null) {
                int ordCol = c.getColumnIndex("ord");
                while (c.moveToNext()) {
                    String ord = ordCol >= 0 ? c.getString(ordCol) : "0";
                    ContentValues cv = new ContentValues();
                    cv.put("deck_id", deckId);
                    cr.update(Uri.withAppendedPath(cards, ord), cv, null, null);
                }
                c.close();
            }
            JSObject r = new JSObject();
            r.put("id", note.getLastPathSegment());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("AnkiDroid: " + e.getMessage());
        }
    }

    // ------------------------------------------------------------ atualização do APK

    @PluginMethod
    public void appInfo(PluginCall call) {
        try {
            PackageInfo pi = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject r = new JSObject();
            r.put("version", pi.versionName);
            r.put("build", Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode);
            call.resolve(r);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String url = call.getString("url");
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            call.reject("Permita “instalar apps desconhecidos” para o Inglês e toque em Atualizar de novo.");
            return;
        }
        new Thread(() -> {
            try {
                File dir = new File(ctx.getCacheDir(), "updates");
                dir.mkdirs();
                File apk = new File(dir, "ingles-update.apk");
                HttpURLConnection con = null;
                URL u = new URL(url);
                for (int i = 0; i < 6; i++) { // segue redirecionamentos do GitHub
                    con = (HttpURLConnection) u.openConnection();
                    con.setInstanceFollowRedirects(false);
                    con.setConnectTimeout(20000);
                    con.setReadTimeout(60000);
                    int code = con.getResponseCode();
                    if (code >= 300 && code < 400) {
                        u = new URL(u, con.getHeaderField("Location"));
                        con.disconnect();
                        continue;
                    }
                    break;
                }
                try (InputStream in = con.getInputStream(); OutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
                Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(uri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(install);
                call.resolve();
            } catch (Exception e) {
                call.reject("Falha ao baixar a atualização: " + e.getMessage());
            }
        }).start();
    }

    // ------------------------------------------------------------ contagem de streaming

    @PluginMethod
    public void trackingTotals(PluginCall call) {
        try {
            JSONObject snap = WatchStore.snapshot(getContext());
            call.resolve(JSObject.fromJSONObject(snap));
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void trackingConfig(PluginCall call) {
        try {
            Set<String> paused = new HashSet<>();
            JSArray arr = call.getArray("paused", new JSArray());
            for (int i = 0; i < arr.length(); i++) paused.add(arr.getString(i));
            WatchStore.setConfig(getContext(), paused, Boolean.TRUE.equals(call.getBoolean("allPaused", false)));
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    private boolean notificationAccess() {
        String flat = Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        return flat != null && flat.contains(new ComponentName(getContext(), MediaListener.class).flattenToString());
    }

    private boolean accessibilityOn() {
        String flat = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return flat != null && flat.contains(getContext().getPackageName() + "/" + ForegroundService.class.getName());
    }

    @PluginMethod
    public void trackingStatus(PluginCall call) {
        JSObject r = new JSObject();
        r.put("notification", notificationAccess());
        r.put("accessibility", accessibilityOn());
        call.resolve(r);
    }

    @PluginMethod
    public void openNotificationAccess(PluginCall call) {
        Intent i = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    @PluginMethod
    public void openAccessibility(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}
