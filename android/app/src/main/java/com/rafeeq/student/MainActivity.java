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
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.text.TextUtils;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
    private static final String APP_ASSET_PREFIX = "file:///android_asset/";
    private WebView webView;
    private WebView printWebView;

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

        @JavascriptInterface
        public void exportTeacherPdf(String title, String content) {
            runOnUiThread(() -> {
                printWebView = new WebView(MainActivity.this);
                printWebView.setBackgroundColor(Color.WHITE);
                printWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        PrintManager manager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                        if (manager != null) {
                            PrintAttributes attributes = new PrintAttributes.Builder()
                                .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                                .build();
                            manager.print(title, view.createPrintDocumentAdapter(title), attributes);
                        }
                    }
                });
                String safeTitle = TextUtils.htmlEncode(title == null ? "إجابة المعلم الخاص" : title);
                String safeContent = TextUtils.htmlEncode(content == null ? "" : content).replace("\n", "<br>");
                String document = "<!doctype html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\">"
                    + "<style>body{font:18px/1.9 Tahoma,Arial,sans-serif;color:#14233a;padding:30px}"
                    + "h1{font-size:25px;color:#244a78;margin:0 0 22px;border-bottom:2px solid #d9e6f4;padding-bottom:12px}"
                    + ".footer{margin-top:28px;color:#607189;font-size:13px}</style></head><body><h1>"
                    + safeTitle + "</h1><main>" + safeContent
                    + "</main><div class=\"footer\">رفيق الطالب</div></body></html>";
                printWebView.loadDataWithBaseURL(null, document, "text/html", "UTF-8", null);
            });
        }
    }
}
