package com.auryx.nexavoria;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/**
 * Mantém a chamada viva com a tela bloqueada ou com outro app aberto:
 * um serviço em primeiro plano (com aviso fixo) impede o Android de congelar o app.
 */
public class CallService extends Service {
    static final String CH = "chamada";
    static final int ID = 3;
    private PowerManager.WakeLock lock;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        MainActivity.createChannels(this);
        String title = intent != null ? intent.getStringExtra("title") : null;
        PendingIntent openPi = PendingIntent.getActivity(this, 3, new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(this, CH)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle("Em chamada")
                .setContentText(title != null && !title.isEmpty() ? title : "Auryx Nexos")
                .setOngoing(true)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setContentIntent(openPi)
                .build();
        if (Build.VERSION.SDK_INT >= 30) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        else startForeground(ID, n);
        if (lock == null) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "auryx:chamada");
            lock.acquire(6 * 60 * 60 * 1000L);   // no máximo 6 horas
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (lock != null && lock.isHeld()) lock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
