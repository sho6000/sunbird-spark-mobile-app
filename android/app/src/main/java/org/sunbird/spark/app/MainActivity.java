package org.sunbird.spark.app;

import android.os.Bundle;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "ContentProxy";

    private static final String[] PROXY_PATHS = {
        "/content-plugins/",
        "/assets/public/",
        "/action/",
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeSettingPlugin.class);
        super.onCreate(savedInstanceState);

        String baseUrl = getString(R.string.base_url);

        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                // Skip non-GET requests — shouldInterceptRequest cannot access
                // the request body, so POST/PUT/PATCH would proxy an empty body.
                String method = request.getMethod();
                if (method != null && !method.equalsIgnoreCase("GET")) {
                    return super.shouldInterceptRequest(view, request);
                }

                String path = request.getUrl().getPath();

                if (path != null) {
                    for (String proxyPath : PROXY_PATHS) {
                        if (path.startsWith(proxyPath)) {
                            String query = request.getUrl().getQuery();
                            String targetUrl = baseUrl + path + (query != null ? "?" + query : "");
                            WebResourceResponse response = proxyRequest(targetUrl, request);
                            if (response != null) {
                                return response;
                            }
                            Log.e(TAG, "Proxy failed, falling back to default: " + path);
                            return super.shouldInterceptRequest(view, request);
                        }
                    }
                }

                return super.shouldInterceptRequest(view, request);
            }
        });
    }

    private WebResourceResponse proxyRequest(String targetUrl, WebResourceRequest request) {
        try {
            URL url = new URL(targetUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod(request.getMethod());
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);

            Map<String, String> requestHeaders = request.getRequestHeaders();
            if (requestHeaders != null) {
                for (Map.Entry<String, String> entry : requestHeaders.entrySet()) {
                    String key = entry.getKey().toLowerCase();
                    if (!key.equals("host") && !key.equals("connection") && !key.equals("origin")) {
                        conn.setRequestProperty(entry.getKey(), entry.getValue());
                    }
                }
            }

            int statusCode = conn.getResponseCode();
            String contentType = conn.getContentType();
            String mimeType = "application/octet-stream";
            String encoding = "UTF-8";

            if (contentType != null) {
                String[] parts = contentType.split(";");
                mimeType = parts[0].trim();
                for (String part : parts) {
                    String trimmed = part.trim();
                    if (trimmed.toLowerCase().startsWith("charset=")) {
                        encoding = trimmed.substring(8).trim();
                    }
                }
            }

            InputStream inputStream;
            if (statusCode >= 400) {
                inputStream = conn.getErrorStream();
                if (inputStream == null) {
                    inputStream = conn.getInputStream();
                }
            } else {
                inputStream = conn.getInputStream();
            }

            Map<String, String> responseHeaders = new HashMap<>();
            for (Map.Entry<String, List<String>> entry : conn.getHeaderFields().entrySet()) {
                if (entry.getKey() != null && entry.getValue() != null && !entry.getValue().isEmpty()) {
                    responseHeaders.put(entry.getKey(), entry.getValue().get(0));
                }
            }
            responseHeaders.put("Access-Control-Allow-Origin", "*");

            return new WebResourceResponse(
                mimeType, encoding, statusCode,
                conn.getResponseMessage() != null ? conn.getResponseMessage() : "OK",
                responseHeaders, inputStream
            );
        } catch (Exception e) {
            Log.e(TAG, "Error proxying " + targetUrl, e);
            return null;
        }
    }
}
