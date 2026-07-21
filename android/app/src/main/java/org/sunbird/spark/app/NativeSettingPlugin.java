package org.sunbird.spark.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "NativeSetting")
public class NativeSettingPlugin extends Plugin {

    private static final Set<String> ALLOWED_KEYS = Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
        "base_url",
        "mobile_app_consumer",
        "mobile_app_key",
        "mobile_app_secret",
        "producer_id",
        "app_version",
        "enable_ai_search"
    )));

    @PluginMethod
    public void read(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.isEmpty()) {
            call.reject("key is required");
            return;
        }

        if (!ALLOWED_KEYS.contains(key)) {
            call.reject("Key not allowed");
            return;
        }

        int resId = getContext().getResources().getIdentifier(key, "string", getContext().getPackageName());
        if (resId == 0) {
            call.reject("Resource not found: " + key);
            return;
        }

        String value = getContext().getString(resId);
        JSObject result = new JSObject();
        result.put("value", value);
        call.resolve(result);
    }
}
