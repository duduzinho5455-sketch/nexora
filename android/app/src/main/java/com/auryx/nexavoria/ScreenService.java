package com.auryx.nexavoria;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.WindowManager;

import androidx.core.app.NotificationCompat;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

/**
 * Captura a tela do celular (MediaProjection) e guarda o último quadro em JPEG.
 * O site pega os quadros pela ponte e transforma em vídeo para o WebRTC.
 */
public class ScreenService extends Service {
    static final String CH = "tela";
    static final int ID = 2;
    static volatile boolean running = false;
    private static volatile String latest = "";

    private MediaProjection projection;
    private VirtualDisplay display;
    private ImageReader reader;
    private HandlerThread thread;
    private Handler handler;
    private Bitmap buffer;
    private long last = 0;
    private int frameGap = 66;
    private final ByteArrayOutputStream jpeg = new ByteArrayOutputStream(256 * 1024);

    static String takeFrame() {
        String f = latest;
        latest = "";
        return f;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "stop".equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        if (intent == null || running) return START_NOT_STICKY;
        MainActivity.createChannels(this);

        Intent stop = new Intent(this, ScreenService.class).setAction("stop");
        PendingIntent stopPi = PendingIntent.getService(this, 1, stop, PendingIntent.FLAG_IMMUTABLE);
        PendingIntent openPi = PendingIntent.getActivity(this, 2, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(this, CH)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle("Transmitindo sua tela")
                .setContentText("Quem está na call pode assistir. Toque em Parar para encerrar.")
                .setOngoing(true)
                .setContentIntent(openPi)
                .addAction(0, "Parar", stopPi)
                .build();
        // No Android 14+ o serviço precisa estar em primeiro plano ANTES de pegar a captura.
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        else startForeground(ID, n);

        int code = intent.getIntExtra("code", 0);
        Intent data = intent.getParcelableExtra("data");
        int maxW = intent.getIntExtra("w", 1280), maxH = intent.getIntExtra("h", 720);
        frameGap = 1000 / Math.max(5, Math.min(30, intent.getIntExtra("fps", 15)));

        MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        try { projection = mpm.getMediaProjection(code, data); } catch (Exception e) { projection = null; }
        if (projection == null) { stopSelf(); return START_NOT_STICKY; }

        thread = new HandlerThread("captura");
        thread.start();
        handler = new Handler(thread.getLooper());
        projection.registerCallback(new MediaProjection.Callback() {
            @Override public void onStop() { stopSelf(); }
        }, handler);

        // tamanho: a tela do celular reduzida para caber na qualidade escolhida (mantendo a proporção)
        DisplayMetrics dm = new DisplayMetrics();
        ((WindowManager) getSystemService(WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(dm);
        int sw = dm.widthPixels, sh = dm.heightPixels;
        boolean portrait = sh > sw;
        int boxW = portrait ? Math.min(maxW, maxH) : maxW, boxH = portrait ? Math.max(maxW, maxH) : maxH;
        double scale = Math.min(1.0, Math.min(boxW / (double) sw, boxH / (double) sh));
        int w = ((int) (sw * scale)) & ~1, h = ((int) (sh * scale)) & ~1;

        reader = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2);
        reader.setOnImageAvailableListener(r -> onImage(r, w, h), handler);
        display = projection.createVirtualDisplay("auryx-tela", w, h, dm.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader.getSurface(), null, handler);
        running = true;
        return START_NOT_STICKY;
    }

    private void onImage(ImageReader r, int w, int h) {
        Image img = null;
        try {
            img = r.acquireLatestImage();
            if (img == null) return;
            long now = System.currentTimeMillis();
            if (now - last < frameGap) return;      // respeita o FPS escolhido (economiza bateria)
            last = now;
            Image.Plane p = img.getPlanes()[0];
            ByteBuffer buf = p.getBuffer();
            int pixelStride = p.getPixelStride(), rowStride = p.getRowStride();
            int bw = w + (rowStride - pixelStride * w) / pixelStride;
            if (buffer == null || buffer.getWidth() != bw || buffer.getHeight() != h) {
                if (buffer != null) buffer.recycle();
                buffer = Bitmap.createBitmap(bw, h, Bitmap.Config.ARGB_8888);
            }
            buffer.copyPixelsFromBuffer(buf);
            Bitmap frame = bw == w ? buffer : Bitmap.createBitmap(buffer, 0, 0, w, h);
            jpeg.reset();
            frame.compress(Bitmap.CompressFormat.JPEG, 62, jpeg);
            if (frame != buffer) frame.recycle();
            latest = Base64.encodeToString(jpeg.toByteArray(), Base64.NO_WRAP);
        } catch (Exception ignored) {
        } finally {
            if (img != null) img.close();
        }
    }

    @Override
    public void onDestroy() {
        running = false;
        latest = "";
        try { if (display != null) display.release(); } catch (Exception ignored) { }
        try { if (reader != null) reader.close(); } catch (Exception ignored) { }
        try { if (projection != null) projection.stop(); } catch (Exception ignored) { }
        if (thread != null) thread.quitSafely();
        if (buffer != null) buffer.recycle();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
