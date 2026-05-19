import React, { useMemo, useState, useRef, useEffect } from 'react';
import _ from 'lodash';
import {
  IonContent,
  IonPage,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonAlert,
} from '@ionic/react';
import {
  chevronForwardOutline,
  logOutOutline,
  trashOutline,
} from 'ionicons/icons';
import { useSystemSetting } from '../hooks/useSystemSetting';
import { useTranslation } from 'react-i18next';
import { useIonRouter } from '@ionic/react';
import { useAuth } from '../contexts/AuthContext';
import { clearReturnTo } from '../utils/returnTo';
import { BottomNavigation } from '../components/layout/BottomNavigation';
import { AppHeader } from '../components/layout/AppHeader';
import Avatar from 'react-avatar';
import { useUser } from '../hooks/useUser';
import { useUserEnrollmentList } from '../hooks/useUserEnrollment';
import { useUserCertificates } from '../hooks/useUserCertificates';
import useImpression from '../hooks/useImpression';
import { networkService } from '../services/network/networkService';
import { syncService } from '../services/sync/SyncService';
import { LearningStatsGrid } from '../components/home/learning-started/LearningStatsGrid';
import './ProfilePage.css';

const ProfilePage: React.FC = () => {
  useImpression({ pageid: 'ProfilePage', env: 'profile' });
  const { logout, userId, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const router = useIonRouter();

  useEffect(() => {
    document.title = `${t('pageTitle.profile')}`;
  }, [t]);

  const { data: profile } = useUser(userId);
  const { data: enrollmentResponse } = useUserEnrollmentList(userId, { enabled: isAuthenticated });
  const { data: certData } = useUserCertificates(isAuthenticated ? userId : null);

  const courses = useMemo(() => enrollmentResponse?.data?.courses ?? [], [enrollmentResponse]);

  const fullName = useMemo(() => {
    const parts = [profile?.firstName, profile?.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : t('guestUser');
  }, [profile, t]);

  const roles = useMemo(() => {
    const roleSet = new Set<string>();
    const addRole = (r: string | { role?: string } | unknown) => {
      if (typeof r === 'string') {
        roleSet.add(r);
      } else if (r && typeof r === 'object' && 'role' in r && typeof (r as any).role === 'string') {
        roleSet.add((r as any).role);
      }
    };
    profile?.organisations?.forEach(org => org.roles?.forEach(addRole));
    profile?.roles?.forEach(addRole);
    return Array.from(roleSet);
  }, [profile]);

  const { data: deleteSettingData } = useSystemSetting('enableDeleteAccount');
  const showDeleteAccountButton = useMemo(() => {
    const value = (deleteSettingData?.data as any)?.response?.value;
    const isAdmin = roles.includes('ORG_ADMIN');
    return String(value).trim().toLowerCase() === 'true' && !isAdmin;
  }, [deleteSettingData, roles]);

  const [showSyncWarning, setShowSyncWarning] = useState(false);
  const [isCheckingSync, setIsCheckingSync] = useState(false);

  // Ref-based guard so rapid taps are blocked synchronously before React
  // batches the state update — state alone has a render-cycle delay.
  const isCheckingRef = useRef(false);

  // Prevents setIsCheckingSync from firing on an unmounted component if the
  // user navigates away while the DB check is still in flight.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const totalCourses = courses.length;

  const inProgressCount = useMemo(
    () => courses.filter(c => c.status === 1 && (c.completionPercentage ?? 0) < 100).length,
    [courses]
  );

  const completedCount = useMemo(
    () => courses.filter(c => c.status === 2 || (c.completionPercentage ?? 0) >= 100).length,
    [courses]
  );

  const certificatesEarned: number = _.size(_.get(certData, 'data', []));

  const handleLogout = async () => {
    // Use a ref guard (not state) so rapid taps are blocked synchronously —
    // React state updates are async and a second tap can slip through before
    // the first re-render disables the button.
    if (isCheckingRef.current) return;

    // Only check for pending data when offline. When online, enqueueCourseProgress
    // fires an immediate background sync so data is already on its way to the server.
    if (!networkService.isConnected()) {
      isCheckingRef.current = true;
      if (mountedRef.current) setIsCheckingSync(true);
      try {
        // Race the DB check against a 3-second timeout so a frozen DB cannot
        // leave the logout button permanently disabled.
        const timeoutPromise = new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), 3000)
        );
        const hasPending = await Promise.race([
          syncService.hasPendingCourseData(userId ?? ''),
          timeoutPromise,
        ]);
        if (hasPending && mountedRef.current) {
          setShowSyncWarning(true);
          return;
        }
      } catch {
        // DB error or timeout — fail open so the user is never locked out
      } finally {
        isCheckingRef.current = false;
        if (mountedRef.current) setIsCheckingSync(false);
      }
    }

    await logout();
  };

  // ── Unauthenticated view ─────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <IonPage>
        <AppHeader title={t('profile')} />

        <IonContent fullscreen className="profile-content">
          <main id="main-content">
            {/* Guest profile card */}
            <div className="profile-info-card">
              <div className="profile-avatar-wrapper">
                <Avatar name={t('guestUser')} round={true} size="133" color="var(--ion-color-medium)" className="profile-avatar" />
              </div>
              <h2 className="profile-name">{t('guestUser')}</h2>
            </div>

            {/* Sign-in prompt */}
            <div className="profile-signin-prompt">
              <p className="profile-signin-message">
                {t('signInToAccess')}
              </p>
              <button
                className="my-learning__sign-in-button"
                onClick={() => { clearReturnTo(); router.push('/sign-in', 'forward', 'push'); }}
              >
                {t('signIn')}
              </button>
            </div>

            {/* Downloaded Contents & Settings — always visible */}
            <IonList className="profile-actions-list profile-guest-actions" lines="none">
              <IonItem className="profile-action-item" button detail={false} onClick={() => router.push('/profile/downloaded-contents', 'forward', 'push')}>
                <IonLabel className="profile-action-label">{t('downloadedContents')}</IonLabel>
                <IonIcon icon={chevronForwardOutline} slot="end" className="profile-action-chevron" />
              </IonItem>
              <IonItem className="profile-action-item" button detail={false} onClick={() => router.push('/profile/settings', 'forward', 'push')}>
                <IonLabel className="profile-action-label">{t('settings')}</IonLabel>
                <IonIcon icon={chevronForwardOutline} slot="end" className="profile-action-chevron" />
              </IonItem>
            </IonList>

            <div className="profile-bottom-spacer"></div>
          </main>
        </IonContent>

        <BottomNavigation />
      </IonPage>
    );
  }

  // ── Authenticated view ───────────────────────────────────────────────────────
  return (
    <IonPage>
      <AppHeader title={t('profile')} />

      <IonContent fullscreen className="profile-content">
        <main id="main-content">
          {/* Profile Info Card */}
          <div className="profile-info-card">
            <div className="profile-avatar-wrapper">
              <Avatar name={fullName} round={true} size="133" color="var(--ion-color-primary-tint)" className="profile-avatar" />
            </div>

            <h2 className="profile-name">{fullName}</h2>
            <p className="profile-email">{t('sunbirdId')} : {profile?.userName ?? ''}</p>

            <div className="profile-roles">
              {roles.length > 0 ? roles.map((role, i) => (
                <React.Fragment key={role}>
                  {i > 0 && <span className="profile-role-dot"></span>}
                  <span className="profile-role">{role}</span>
                </React.Fragment>
              )) : (
                <span className="profile-role">{t('learner')}</span>
              )}
            </div>
          </div>

          {/* Stats Grid — reuses the same component as HomePage */}
          <LearningStatsGrid
            totalCourses={totalCourses}
            coursesInProgress={inProgressCount}
            coursesCompleted={completedCount}
            certificationsEarned={certificatesEarned}
          />

          {/* Action Items */}
          <IonList className="profile-actions-list" lines="none">
            <IonItem className="profile-action-item" button detail={false} onClick={() => router.push('/profile/personal-details', 'forward', 'push')}>
              <IonLabel className="profile-action-label">{t('personalInformation')}</IonLabel>
              <IonIcon icon={chevronForwardOutline} slot="end" className="profile-action-chevron" />
            </IonItem>

            <IonItem className="profile-action-item" button detail={false} onClick={() => router.push('/profile/learning', 'forward', 'push')}>
              <IonLabel className="profile-action-label">{t('myLearning')}</IonLabel>
              <IonIcon icon={chevronForwardOutline} slot="end" className="profile-action-chevron" />
            </IonItem>

            <IonItem className="profile-action-item" button detail={false} onClick={() => router.push('/profile/downloaded-contents', 'forward', 'push')}>
              <IonLabel className="profile-action-label">{t('downloadedContents')}</IonLabel>
              <IonIcon icon={chevronForwardOutline} slot="end" className="profile-action-chevron" />
            </IonItem>

            <IonItem className="profile-action-item" button detail={false} onClick={() => router.push('/profile/settings', 'forward', 'push')}>
              <IonLabel className="profile-action-label">{t('settings')}</IonLabel>
              <IonIcon icon={chevronForwardOutline} slot="end" className="profile-action-chevron" />
            </IonItem>

            {showDeleteAccountButton && isAuthenticated && (
              <IonItem
                className="profile-action-item profile-delete-item"
                button
                detail={false}
                onClick={() => router.push('/profile/delete-account', 'forward', 'push')}
              >
                <IonIcon icon={trashOutline} slot="start" className="profile-action-chevron profile-delete-icon" />
                <IonLabel className="profile-action-label profile-delete-label">{t('deleteAccount')}</IonLabel>
              </IonItem>
            )}

            <IonItem className="profile-action-item" button detail={false} onClick={handleLogout} disabled={isCheckingSync}>
              <IonIcon icon={logOutOutline} slot="start" className="profile-action-chevron" />
              <IonLabel className="profile-action-label">{t('logout')}</IonLabel>
            </IonItem>
          </IonList>

          <div className="profile-bottom-spacer"></div>
        </main>

        <IonAlert
          isOpen={showSyncWarning}
          header={t('logoutSyncWarning.header')}
          message={t('logoutSyncWarning.message')}
          buttons={[
            {
              text: t('logoutSyncWarning.cancel'),
              role: 'cancel',
              handler: () => setShowSyncWarning(false),
            },
            {
              text: t('logoutSyncWarning.confirm'),
              handler: async () => {
                setShowSyncWarning(false);
                await logout();
              },
            },
          ]}
          onDidDismiss={() => setShowSyncWarning(false)}
        />
      </IonContent>

      <BottomNavigation />
    </IonPage>
  );
};

export default ProfilePage;
