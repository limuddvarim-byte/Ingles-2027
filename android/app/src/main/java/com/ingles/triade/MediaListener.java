package com.ingles.triade;

import android.content.ComponentName;
import android.content.Context;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.os.Handler;
import android.os.Looper;
import android.service.notification.NotificationListenerService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Lê (com permissão de acesso às notificações) as sessões de mídia ativas e soma o tempo
 * enquanto Netflix, HBO Max, Disney+, Prime, Crunchyroll, Apple TV ou YouTube estão TOCANDO.
 */
public class MediaListener extends NotificationListenerService {
    private static final long TICK = 5000;
    private static volatile boolean connected = false;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<String, Long> last = new HashMap<>();

    public static boolean isConnected() {
        return connected;
    }

    private final Runnable loop = new Runnable() {
        @Override
        public void run() {
            try {
                poll();
            } catch (Exception ignored) {
            }
            handler.postDelayed(this, TICK);
        }
    };

    private void poll() {
        MediaSessionManager m = (MediaSessionManager) getSystemService(Context.MEDIA_SESSION_SERVICE);
        if (m == null) return;
        List<MediaController> sessions = m.getActiveSessions(new ComponentName(this, MediaListener.class));
        long now = System.currentTimeMillis();
        for (MediaController mc : sessions) {
            String service = WatchStore.PACKAGES.get(mc.getPackageName());
            if (service == null) continue;
            PlaybackState st = mc.getPlaybackState();
            boolean playing = st != null && st.getState() == PlaybackState.STATE_PLAYING;
            Long prev = last.get(service);
            if (playing) {
                if (prev != null) WatchStore.add(this, service, Math.min(now - prev, TICK * 2) / 1000.0);
                last.put(service, now);
            } else {
                last.remove(service);
            }
        }
    }

    @Override
    public void onListenerConnected() {
        connected = true;
        handler.removeCallbacks(loop);
        handler.post(loop);
    }

    @Override
    public void onListenerDisconnected() {
        connected = false;
        handler.removeCallbacks(loop);
    }

    @Override
    public void onDestroy() {
        connected = false;
        handler.removeCallbacks(loop);
        super.onDestroy();
    }
}
