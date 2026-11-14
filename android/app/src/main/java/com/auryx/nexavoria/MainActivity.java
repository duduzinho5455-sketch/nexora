package com.auryx.nexavoria;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.util.ArrayList;
import java.util.List;

/**
 * Auryx Nexavória para Android.
 * Abre o site numa tela própria e acrescenta o que o navegador do celular não faz:
 * transmitir a tela (MediaProjection), manter a chamada com a tela bloqueada e avisar de mensagens.
 */
public class MainActivity extends Activity {
    static final String APP_URL = "https://nexora-ujw6.onrender.com";
    static final String HOST = Uri.parse(APP_URL).getHost();
    static final String CH_MSG = "mensagens";
    static final int REQ_PERM = 1, REQ_FILE = 2, REQ_SCREEN = 3;

    private WebView web;
    private PermissionRequest pendingPerm;
    private ValueCallback<Uri[]> fileCallback;
    private int screenW = 1280, screenH = 720, screenFps = 15;
    private int notifId = 100;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        createChannels(this);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#08090F"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " AuryxAndroid/1.0");
        CookieManager.getInstance().setAcceptCookie(true);

        web.addJavascriptInterface(new Bridge(), "AuryxAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("https".equals(u.getScheme()) && HOST.equals(u.getHost())) return false;
                openExternal(u);           // Pix do Nubank, Steam, links de fora: abrem no app certo
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest req) {
                runOnUiThread(() -> handlePermission(req));
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    Intent i = params.createIntent();
                    if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    startActivityForResult(i, REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });
        web.setDownloadListener((url, ua, cd, mime, len) -> openExternal(Uri.parse(url)));

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 9);
        }

        String open = getIntent() != null ? getIntent().getStringExtra("url") : null;
        web.loadUrl(open != null && open.startsWith("/") ? APP_URL + open : APP_URL);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String url = intent.getStringExtra("url");
        if (url != null && web != null) {
            String safe = url.replace("\\", "").replace("'", "");
            web.evaluateJavascript("window.__axOpen && window.__axOpen('" + safe + "')", null);
        }
    }

    // A WebView NÃO é pausada ao sair do app: a chamada continua com a tela bloqueada.
    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else moveTaskToBack(true);
    }

    @Override
    protected void onDestroy() {
        stopService(new Intent(this, ScreenService.class));
        stopService(new Intent(this, CallService.class));
        if (web != null) web.destroy();
        super.onDestroy();
    }

    private void openExternal(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception ignored) { }
    }

    /* ---------- microfone e câmera ---------- */
    private void handlePermission(PermissionRequest req) {
        List<String> need = new ArrayList<>();
        for (String r : req.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
                need.add(Manifest.permission.RECORD_AUDIO);
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
                need.add(Manifest.permission.CAMERA);
        }
        if (need.isEmpty()) { req.grant(req.getResources()); return; }
        if (pendingPerm != null) pendingPerm.deny();
        pendingPerm = req;
        requestPermissions(need.toArray(new String[0]), REQ_PERM);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        super.onRequestPermissionsResult(code, perms, results);
        if (code != REQ_PERM || pendingPerm == null) return;
        List<String> ok = new ArrayList<>();
        for (String r : pendingPerm.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) ok.add(r);
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) ok.add(r);
        }
        if (ok.isEmpty()) pendingPerm.deny(); else pendingPerm.grant(ok.toArray(new String[0]));
        pendingPerm = null;
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == REQ_FILE) {
            if (fileCallback != null) fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        } else if (code == REQ_SCREEN) {
            boolean ok = result == RESULT_OK && data != null;
            if (ok) {
                Intent i = new Intent(this, ScreenService.class)
                        .putExtra("code", result).putExtra("data", data)
                        .putExtra("w", screenW).putExtra("h", screenH).putExtra("fps", screenFps);
                if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
            }
            web.evaluateJavascript("window.__axScreenResult && window.__axScreenResult(" + ok + ")", null);
        }
    }

    /* ---------- avisos ---------- */
    static void createChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CH_MSG, "Mensagens", NotificationManager.IMPORTANCE_HIGH));
        nm.createNotificationChannel(new NotificationChannel(CallService.CH, "Chamada em andamento", NotificationManager.IMPORTANCE_LOW));
        nm.createNotificationChannel(new NotificationChannel(ScreenService.CH, "Transmissão de tela", NotificationManager.IMPORTANCE_LOW));
    }

    private void showMessage(String title, String body, String url) {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        Intent open = new Intent(this, MainActivity.class).putExtra("url", url).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, notifId, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH_MSG)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pi);
        try { NotificationManagerCompat.from(this).notify(notifId++, b.build()); } catch (SecurityException ignored) { }
    }

    /* ---------- ponte com o site (window.AuryxAndroid) ---------- */
    class Bridge {
        @JavascriptInterface
        public void startScreen(int w, int h, int fps) {
            screenW = Math.max(320, Math.min(1920, w));
            screenH = Math.max(240, Math.min(1080, h));
            screenFps = Math.max(5, Math.min(30, fps));
            runOnUiThread(() -> {
                MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
                startActivityForResult(mpm.createScreenCaptureIntent(), REQ_SCREEN);
            });
        }

        @JavascriptInterface
        public String frame() {
            return ScreenService.takeFrame();
        }

        @JavascriptInterface
        public boolean screenActive() {
            return ScreenService.running;
        }

        @JavascriptInterface
        public void stopScreen() {
            runOnUiThread(() -> stopService(new Intent(MainActivity.this, ScreenService.class)));
        }

        @JavascriptInterface
        public void callState(boolean on, String title) {
            runOnUiThread(() -> {
                Intent i = new Intent(MainActivity.this, CallService.class).putExtra("title", title);
                if (!on) { stopService(i); return; }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return;
                try {
                    if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
                } catch (Exception ignored) { }
            });
        }

        @JavascriptInterface
        public void notify(String title, String body, String url) {
            runOnUiThread(() -> showMessage(title, body, url));
        }
    }
}
