import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import hi from '../locales/hi.json';
import ar from '../locales/ar.json';
import fr from '../locales/fr.json';
import pt from '../locales/pt.json';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  ar: { translation: ar },
  fr: { translation: fr },
  pt: { translation: pt },
};

// localStorage can be unavailable or throw (Safari private mode, disabled
// storage, quota errors). Guard so i18n init never crashes app startup.
let initialLanguage = 'en';
try {
  initialLanguage = localStorage.getItem('appLanguage') || 'en';
  // The QuML player web component reads its UI language from the 'app-language'
  // localStorage key. Seed it at startup so a player opened before the user
  // manually switches language still picks up the stored language.
  localStorage.setItem('app-language', initialLanguage);
} catch {
  // Fall back to 'en'; the player applies its own 'en' default too.
}

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
