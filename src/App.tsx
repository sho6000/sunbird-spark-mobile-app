import { IonActionSheet, IonApp, IonRouterOutlet, setupIonicReact, useIonRouter } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Route, useLocation } from 'react-router-dom';
import { appUpdateService } from './services/AppUpdateService';
import useInteract from './hooks/useInteract';
import { useTranslation } from 'react-i18next';
import { routeNotification } from './services/push/notificationRouter';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useNotificationUpdate } from './hooks/useNotifications';
import { useAuth } from './contexts/AuthContext';
import { useUser } from './hooks/useUser';
import { AppInitializer } from './AppInitializer';
import { consumeReturnTo } from './utils/returnTo';
import { useAppInitialized } from './hooks/useAppInitialized';
import PageLoader from './components/common/PageLoader';
import Dashboard from './pages/Dashboard';
import Home from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import CoursesPage from './pages/CoursesPage';
import DownloadsPage from './pages/DownloadsPage';
import ProfilePage from './pages/ProfilePage';
import ScanPage from './pages/ScanPage';
import PersonalDetailsPage from './pages/PersonalDetailsPage';
import MyLearningPage from './pages/MyLearningPage';
import DownloadedContentsPage from './pages/DownloadedContentsPage';
import HelpAndSupportPage from './pages/HelpAndSupportPage';
import FaqDetailPage from './pages/FaqDetailPage';
import SignInPage from './pages/SignInPage';
import NotificationPage from './pages/NotificationPage';
import OnboardingPage from './pages/OnboardingPage';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/display.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';

/* Theme variables */
import './theme/variables.css';
import './theme/overrides.css';
import VideoContentPage from './pages/VideoContentPage';
import SearchPage from './pages/SearchPage';
import CourseDetailsPage from './pages/CourseDetailsPage';
import CollectionPage from './pages/CollectionPage';
import ContentPlayerPage from './pages/ContentPlayerPage';
import TermsAndConditionsPage from './pages/TermsAndConditionsPage';
import TermsOfUsePage from './pages/TermsOfUsePage';
import ProfileLearningPage from './pages/ProfileLearningPage';
import SettingsPage from './pages/SettingsPage';
import DeleteAccountPage from './pages/DeleteAccountPage';
import BackButtonHandler from './components/common/BackButtonHandler';

setupIonicReact();

/** Checks for app updates on startup and shows a bottom sheet prompt if an update is available */
const AppUpdateGuard: React.FC = () => {
  const { t } = useTranslation();
  const { interact } = useInteract();
  const [showUpdateSheet, setShowUpdateSheet] = useState(false);

  useEffect(() => {
    let cancelled = false;
    appUpdateService.isUpdateAvailable()
      .then((available) => {
        if (!cancelled && available) setShowUpdateSheet(true);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <IonActionSheet
      isOpen={showUpdateSheet}
      header={t('appUpdate.header')}
      subHeader={t('appUpdate.subHeader')}
      buttons={[
        {
          text: t('appUpdate.updateNow'),
          handler: () => {
            interact({ id: 'app-update-now', pageid: 'AppUpdate' });
            void appUpdateService.openAppStore();
          },
        },
        {
          text: t('appUpdate.later'),
          role: 'cancel',
          handler: () => {
            interact({ id: 'app-update-later', pageid: 'AppUpdate' });
          },
        },
      ]}
      onDidDismiss={() => setShowUpdateSheet(false)}
    />
  );
};

/** Redirects to /terms-and-conditions when TnC is pending after login */
const TnCGuard: React.FC = () => {
  const { needsTnC } = useAuth();
  const location = useLocation();

  if (needsTnC && location.pathname !== '/terms-and-conditions') {
    return <Redirect to="/terms-and-conditions" />;
  }
  return null;
};

/** Navigates to /home when the user is logged out (handles auto-logout from token refresh failure) */
const LogoutGuard: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const router = useIonRouter();
  const prevAuthRef = useRef(isAuthenticated);

  useEffect(() => {
    const wasAuthenticated = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    // Only fire on true → false transition, not on initial load
    if (wasAuthenticated && !isAuthenticated) {
      router.push('/home', 'root', 'replace');
    }
  }, [isAuthenticated, router]);

  return null;
};

/** Redirects to the stored returnTo path when the user successfully logs in from /sign-in */
const LoginRedirectGuard: React.FC = () => {
  const { isAuthenticated, needsTnC } = useAuth();
  const location = useLocation();

  if (isAuthenticated && !needsTnC && location.pathname === '/sign-in') {
    return <Redirect to={consumeReturnTo()} />;
  }
  return null;
};

/** Redirects to /onboarding when onboarding is not yet completed */
const OnboardingGuard: React.FC = () => {
  const { isAuthenticated, userId, needsTnC, onboardingDismissed } = useAuth();
  const { data: profile } = useUser(userId);
  const location = useLocation();
  const router = useIonRouter();

  useEffect(() => {
    if (onboardingDismissed || !isAuthenticated || needsTnC || location.pathname === '/onboarding') {
      return;
    }
    if (!profile) return;

    const onboardingDetails = (profile as Record<string, any>).framework?.onboardingDetails;
    if (!onboardingDetails) {
      router.push('/onboarding', 'root', 'replace');
    }
  }, [isAuthenticated, needsTnC, onboardingDismissed, profile, location.pathname, router]);

  return null;
};

/**
 * Listens for push notification events dispatched by PushNotificationService.
 * - push:received  → emits receive telemetry + invalidates notification feed cache
 * - push:tapped    → routes to the correct screen, marks the row read on the
 *                    backend, clears the OS tray, and emits tap telemetry
 * - push:update-app → opens the app store
 */
const PushNotificationGuard: React.FC = () => {
  const router = useIonRouter();
  const queryClient = useQueryClient();
  const { interact } = useInteract();
  const { userId } = useAuth();
  const { mutateAsync: updateNotification } = useNotificationUpdate();

  // Refs let us reference the latest values inside the effect's stable listeners
  // without re-subscribing every render.
  const interactRef = useRef(interact);
  const userIdRef = useRef(userId);
  const updateRef = useRef(updateNotification);
  useLayoutEffect(() => {
    interactRef.current = interact;
    userIdRef.current = userId;
    updateRef.current = updateNotification;
  });

  useEffect(() => {
    const handleReceived = (e: Event) => {
      const data = (e as CustomEvent<Record<string, any>>).detail ?? {};
      const notificationId: string | undefined = data?.id ?? data?.notificationId;
      interactRef.current({
        id: 'push-notification-received',
        type: 'FCM',
        pageid: 'Notification',
        ...(notificationId && { cdata: [{ id: String(notificationId), type: 'NotificationId' }] }),
      });
      queryClient.invalidateQueries({ queryKey: ['notificationFeed'] });
    };

    const handleTap = (e: Event) => {
      const data = (e as CustomEvent<Record<string, any>>).detail ?? {};
      const notificationId: string | undefined = data?.id ?? data?.notificationId;
      const ownerUserId: string | undefined = data?.userId ?? userIdRef.current ?? undefined;

      interactRef.current({
        id: 'push-notification-tapped',
        type: 'FCM',
        subtype: 'notification-clicked',
        pageid: 'Notification',
        ...(notificationId && { cdata: [{ id: String(notificationId), type: 'NotificationId' }] }),
      });

      routeNotification(
        data,
        (path) => router.push(path),
        (url) => window.open(url, '_system'),
      );

      if (notificationId && ownerUserId) {
        void updateRef.current({ ids: [String(notificationId)], userId: ownerUserId }).catch((err) => {
          console.warn('[PushNotificationGuard] Failed to mark notification read', err);
        });
      }

      if (Capacitor.isNativePlatform()) {
        void PushNotifications.removeAllDeliveredNotifications().catch(() => {
          /* tray clearing is best-effort */
        });
      }
    };

    const handleUpdateApp = () => {
      interactRef.current({ id: 'push-notification-update-app', pageid: 'AppUpdate' });
      void appUpdateService.openAppStore();
    };

    window.addEventListener('push:received', handleReceived);
    window.addEventListener('push:tapped', handleTap);
    window.addEventListener('push:update-app', handleUpdateApp);

    return () => {
      window.removeEventListener('push:received', handleReceived);
      window.removeEventListener('push:tapped', handleTap);
      window.removeEventListener('push:update-app', handleUpdateApp);
    };
  }, [router, queryClient]);

  return null;
};

const App: React.FC = () => {
  const isInitialized = useAppInitialized();

  useEffect(() => {
    AppInitializer.init().catch((error) => {
      console.error('App: Failed to initialize application:', error);
    });
  }, []);

  if (!isInitialized) {
    return (
      <IonApp>
        <PageLoader />
      </IonApp>
    );
  }

  return (
    <IonApp>
      <IonReactRouter>
        <AppUpdateGuard />
        <TnCGuard />
        <LogoutGuard />
        <LoginRedirectGuard />
        <OnboardingGuard />
        <PushNotificationGuard />
        <IonRouterOutlet>
          <BackButtonHandler />
          <Route exact path="/search">
            <SearchPage />
          </Route>
          <Route exact path="/explore">
            <ExplorePage />
          </Route>
          <Route exact path="/home">
            <Home />
          </Route>
          <Route exact path="/courses">
            <CoursesPage />
          </Route>
          <Route exact path="/scan">
            <ScanPage />
          </Route>
          <Route exact path="/downloads">
            <DownloadsPage />
          </Route>
          <Route exact path="/profile">
            <ProfilePage />
          </Route>
          <Route exact path="/profile/personal-details">
            <PersonalDetailsPage />
          </Route>
          <Route exact path="/profile/my-learning">
            <MyLearningPage />
          </Route>
          <Route exact path="/profile/learning">
            <ProfileLearningPage />
          </Route>
          <Route exact path="/profile/downloaded-contents">
            <DownloadedContentsPage />
          </Route>
          <Route exact path="/profile/settings">
            <SettingsPage />
          </Route>
          <Route exact path="/profile/delete-account">
            <DeleteAccountPage />
          </Route>
          <Route exact path="/support">
            <HelpAndSupportPage />
          </Route>
          <Route exact path="/support/:category">
            <FaqDetailPage />
          </Route>
          <Route exact path="/dashboard">
            <Dashboard />
          </Route>
          <Route exact path="/video/:id">
            <VideoContentPage />
          </Route>
          <Route exact path="/course-details">
            <CourseDetailsPage />
          </Route>
          <Route exact path="/collection/:collectionId">
            <CollectionPage />
          </Route>
          <Route exact path="/content/:contentId">
            <ContentPlayerPage />
          </Route>
          <Route exact path="/">
            <Redirect to="/home" />
          </Route>
          <Route exact path="/sign-in">
            <SignInPage />
          </Route>
          <Route exact path="/notifications">
            <NotificationPage />
          </Route>
          <Route exact path="/terms-and-conditions">
            <TermsAndConditionsPage />
          </Route>
          <Route exact path="/terms-of-use">
            <TermsOfUsePage />
          </Route>
          <Route exact path="/onboarding">
            <OnboardingPage />
          </Route>
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
