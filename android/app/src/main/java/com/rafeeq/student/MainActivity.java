package com.rafeeq.student;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
    private static final String APP_ASSET_PREFIX = "file:///android_asset/";
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.addJavascriptInterface(new LibraryBridge(), "RafeeqNative");
        webView.setWebViewClient(new RafeeqWebViewClient());
        setContentView(webView, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        webView.loadUrl(APP_ASSET_PREFIX + "index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    private final class RafeeqWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (url.toString().startsWith(APP_ASSET_PREFIX)) return false;
            return true;
        }
    }

    private final class LibraryBridge {
        @JavascriptInterface
        public void openBook(String url) {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(Intent.createChooser(intent, "فتح الكتاب"));
            });
        }

        @JavascriptInterface
        public void downloadBook(String url, String filename) {
            runOnUiThread(() -> {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setTitle(filename);
                request.setDescription("جارٍ تنزيل الكتاب إلى جهازك");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setMimeType("application/pdf");
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
                DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (manager != null) manager.enqueue(request);
            });
        }
    }
}
