package com.ingles.triade;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.view.accessibility.AccessibilityEvent;

/**
 * Serviço de acessibilidade (reserva): quando o acesso às notificações não está ativo,
 * conta o tempo em que um app de streaming está aberto na tela com a tela ligada.
 */
public class ForegroundService extends AccessibilityService {
    private static final long TICK = 5000;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String currentPackage = null;
    private long last = 0;

    private final Runnable loop = new Runnable() {
        @Override
        public void run() {
            tick();
            handler.postDelayed(this, TICK);
        }
    };

    private void tick() {
        long now = System.currentTimeMillis();
        String service = currentPackage == null ? null : WatchStore.PACKAGES.get(currentPackage);
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        boolean screenOn = pm != null && pm.isInteractive();
        // Se o leitor de mídia (mais preciso) estiver ativo, ele é quem conta.
        if (service != null && screenOn && !MediaListener.isConnected()) {
            if (last > 0) WatchStore.add(this, service, Math.min(now - last, TICK * 2) / 1000.0);
            last = now;
        } else {
            last = 0;
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED && event.getPackageName() != null) {
            String pkg = event.getPackageName().toString();
            if (!pkg.equals("com.android.systemui")) {
                if (!pkg.equals(currentPackage)) last = 0;
                currentPackage = pkg;
            }
        }
    }

    @Override
    protected void onServiceConnected() {
        handler.removeCallbacks(loop);
        handler.post(loop);
    }

    @Override
    public void onInterrupt() {}

    @Override
    public void onDestroy() {
        handler.removeCallbacks(loop);
        super.onDestroy();
    }
}
