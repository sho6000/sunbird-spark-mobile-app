import { useEffect, useState } from 'react';
import { NativeConfigServiceInstance } from '../services/NativeConfigService';

/**
 * Whether the AI (semantic) Search toggle should be shown.
 *
 * Sourced from the native build config: `android/gradle.properties`
 * (`enable_ai_search`) → `app/build.gradle` `resValue` → string resource →
 * `NativeSetting` plugin → `NativeConfigService`. Defaults to `true` on web/dev
 * or until the native config has loaded.
 */
export const useAiSearchEnabled = (): boolean => {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let mounted = true;
    NativeConfigServiceInstance.load().then((cfg) => {
      if (mounted) setEnabled(cfg.enableAiSearch);
    });
    return () => { mounted = false; };
  }, []);

  return enabled;
};
