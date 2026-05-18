import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonModal,
    IonAlert,
    IonToast,
    useIonRouter,
} from '@ionic/react';
import { IonIcon } from '@ionic/react';
import { chevronBackOutline } from 'ionicons/icons';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../hooks/useUser';
import { useDeleteAccount } from '../hooks/useDeleteAccount';
import { useSystemSetting } from '../hooks/useSystemSetting';
import useInteract from '../hooks/useInteract';
import { useNetwork } from '../providers/NetworkProvider';
import { TriggerCaptcha } from '../hooks/useEditProfile';
import useImpression from '../hooks/useImpression';
import './PersonalDetailsPage.css';
import './DeleteAccountPage.css';

const OTP_LENGTH = 6;

const CONDITIONS_KEYS = [
    'deleteCondition1',
    'deleteCondition2',
    'deleteCondition3',
    'deleteCondition4',
    'deleteCondition5',
    'deleteCondition6',
    'deleteCondition7',
] as const;

// ── Inner component — consumes reCAPTCHA context ─────────────────────────────
const DeleteAccountBody: React.FC = () => {
    useImpression({ pageid: 'DeleteAccountPage', env: 'profile' });
    const { t } = useTranslation();
    const router = useIonRouter();
    const { interact } = useInteract();

    useEffect(() => {
        document.title = `${t('deleteAccount')}`;
    }, [t]);

    const { userId, isAuthenticated } = useAuth();
    const { data: profile } = useUser(userId);
    const { isOffline } = useNetwork();
    const { executeRecaptcha } = useGoogleReCaptcha();

    const roles: string[] = React.useMemo(() => {
        const roleSet = new Set<string>();
        const addRole = (r: string | { role?: string } | unknown) => {
            if (typeof r === 'string') roleSet.add(r);
            else if (r && typeof r === 'object' && 'role' in r && typeof (r as any).role === 'string')
                roleSet.add((r as any).role);
        };
        (profile as any)?.organisations?.forEach((org: any) => org.roles?.forEach(addRole));
        (profile as any)?.roles?.forEach(addRole);
        return Array.from(roleSet);
    }, [profile]);

    const [toastMessage, setToastMessage] = React.useState('');

    const routerRef = useRef(router);
    useEffect(() => { routerRef.current = router; });

    // Guard: redirect if not authenticated or ORG_ADMIN
    useEffect(() => {
        if (!isAuthenticated) {
            routerRef.current.push('/sign-in', 'root', 'replace');
            return;
        }
        if (roles.includes('ORG_ADMIN')) {
            setToastMessage(t('deleteAccountAdminBlocked'));
            routerRef.current.push('/profile', 'back', 'pop');
        }
    }, [isAuthenticated, roles, t]);

    const triggerCaptcha = useCallback<TriggerCaptcha>((callback) => {
        if (!executeRecaptcha) {
            callback(null);
            return;
        }
        executeRecaptcha('delete_account')
            .then(token => callback(token))
            .catch(() => callback(null));
    }, [executeRecaptcha]);

    const {
        checkedConditions,
        allChecked,
        otpValue,
        otpStatus,
        otpError,
        pageError,
        timer,
        resendCount,
        maxAttemptsReached,
        showOtpModal,
        showConfirmAlert,
        isDeleting,
        otpContact,
        toggleCondition,
        onSubmit,
        handleOtpChange,
        handleVerifyAndDelete,
        handleResendOtp,
        resetOtpModal,
        dismissConfirmAlert,
        confirmDirectDelete,
    } = useDeleteAccount(userId, profile, triggerCaptcha);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Surface acceptAllConditions and offline as toasts, others as inline errors
    const handleSubmit = async () => {
        if (!allChecked) {
            setToastMessage(t('acceptAllConditions'));
            return;
        }
        if (isOffline) {
            setToastMessage(t('deleteAccountOffline'));
            interact({ id: 'delete-account-blocked-offline', pageid: 'DeleteAccountPage' });
            return;
        }
        await onSubmit();
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otpValue[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpInputChange = (index: number, value: string) => {
        handleOtpChange(index, value);
        if (value && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleResendClick = async () => {
        await handleResendOtp();
        if (!otpValue.some(d => d)) {
            inputRefs.current[0]?.focus();
        }
    };

    const formatTime = (s: number) => {
        const m = String(Math.floor(s / 60)).padStart(2, '0');
        const sec = String(s % 60).padStart(2, '0');
        return `${m}:${sec}`;
    };

    const submitDisabled = !allChecked || isOffline || otpStatus === 'sending-otp' || isDeleting;

    return (
        <IonPage className="delete-account-page">
            {/* ── Header ── */}
            <IonHeader className="da-header ion-no-border">
                <IonToolbar className="da-toolbar">
                    <IonButtons slot="start">
                        <button
                            className="da-back-btn"
                            onClick={() => router.push('/profile', 'back', 'pop')}
                            aria-label={t('back')}
                        >
                            <IonIcon icon={chevronBackOutline} />
                        </button>
                    </IonButtons>
                    <IonTitle className="da-title">{t('deleteAccount')}</IonTitle>
                </IonToolbar>
            </IonHeader>

            {/* ── Scrollable content ── */}
            <IonContent className="da-content">
                <main id="main-content">
                    <div className="da-scroll-container">
                        {/* Warning banner */}
                        <div className="da-warning-banner">
                            <p className="da-warning-text">{t('deleteAccountWarning')}</p>
                        </div>

                        {/* Conditions section */}
                        <div className="da-conditions-section">
                            <h3 className="da-conditions-heading">{t('deleteAccountConditionsHeading')}</h3>
                            <div className="da-conditions-list">
                                {CONDITIONS_KEYS.map((key, index) => (
                                    <div key={index} className="da-condition-item">
                                        <input
                                            type="checkbox"
                                            className="da-condition-checkbox"
                                            id={`da-condition-${index}`}
                                            checked={checkedConditions.has(index)}
                                            onChange={() => toggleCondition(index)}
                                            disabled={isDeleting}
                                        />
                                        <label htmlFor={`da-condition-${index}`} className="da-condition-text">
                                            {t(key)}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Page-level error */}
                        {pageError && (
                            <p className="da-page-error" role="alert">{pageError}</p>
                        )}
                    </div>
                </main>
            </IonContent>

            {/* ── Sticky footer — outside IonContent ── */}
            <div className="da-footer">
                <button
                    className="da-submit-btn"
                    disabled={submitDisabled}
                    onClick={handleSubmit}
                >
                    {isOffline ? t('deleteAccountOfflineButton') : t('deleteAccount')}
                </button>
            </div>

            {/* ── OTP Modal ── */}
            <IonModal
                isOpen={showOtpModal}
                canDismiss={!isDeleting}
                onDidDismiss={resetOtpModal}
                className="da-otp-modal"
                aria-labelledby="da-otp-modal-title"
            >
                <div className="pd-modal-root">
                    <div className="pd-modal-header">
                        {!isDeleting && (
                            <button
                                className="pd-modal-close-btn"
                                onClick={() => { resetOtpModal(); }}
                                aria-label={t('close')}
                            >
                                <svg width="12" height="12" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <path d="M1 1L9 9" stroke="var(--ion-color-primary)" strokeWidth="2" strokeLinecap="round" />
                                    <path d="M9 1L1 9" stroke="var(--ion-color-primary)" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <IonContent className="pd-modal-content">
                        <div className="otp-body">
                            <h2 className="otp-title" id="da-otp-modal-title">{t('enterTheCode')}</h2>
                            <p className="da-otp-instructions">
                                {otpContact ? t(`deleteAccountOtpInstructions_${otpContact.type}`) : ''}
                            </p>

                            {otpError && (
                                <p className="da-otp-error" role="alert">{otpError}</p>
                            )}

                            <div className="otp-inputs" role="group" aria-label={t('enterTheCode')}>
                                {otpValue.map((digit, idx) => (
                                    <input
                                        key={idx}
                                        ref={el => { inputRefs.current[idx] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        className="otp-box"
                                        value={digit}
                                        aria-label={`${t('digit')} ${idx + 1}`}
                                        disabled={maxAttemptsReached || isDeleting}
                                        onChange={e => handleOtpInputChange(idx, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(idx, e)}
                                    />
                                ))}
                            </div>

                            <div className="otp-timer-row">
                                <span className="otp-timer">{formatTime(timer)}</span>
                                <button
                                    className="otp-resend"
                                    onClick={handleResendClick}
                                    disabled={
                                        timer > 0 ||
                                        resendCount >= MAX_RESEND ||
                                        isOffline ||
                                        isDeleting ||
                                        otpStatus === 'verifying-otp'
                                    }
                                >
                                    {isOffline
                                        ? t('resendOffline')
                                        : resendCount >= MAX_RESEND
                                        ? t('maxResendReached')
                                        : t('resendOtp')}
                                </button>
                            </div>
                        </div>
                    </IonContent>

                    <div className="da-footer-danger">
                        <button
                            className="da-confirm-btn"
                            disabled={
                                otpValue.join('').length < OTP_LENGTH ||
                                maxAttemptsReached ||
                                otpStatus === 'verifying-otp' ||
                                isDeleting
                            }
                            onClick={handleVerifyAndDelete}
                        >
                            {otpStatus === 'verifying-otp' || isDeleting
                                ? t('verifying')
                                : t('confirmDeletion')}
                        </button>
                    </div>
                </div>
            </IonModal>

            {/* ── Direct-confirm alert (skipOTP path) ── */}
            <IonAlert
                isOpen={showConfirmAlert}
                cssClass="da-delete-alert"
                header={t('deleteAccountConfirmHeader')}
                message={t('deleteAccountConfirmMessage')}
                buttons={[
                    {
                        text: t('cancel'),
                        role: 'cancel',
                        handler: () => dismissConfirmAlert(),
                    },
                    {
                        text: t('deleteAccount'),
                        role: 'destructive',
                        handler: () => {
                            void confirmDirectDelete();
                        },
                    },
                ]}
                onDidDismiss={() => dismissConfirmAlert()}
            />

            <IonToast
                isOpen={!!toastMessage}
                onDidDismiss={() => setToastMessage('')}
                message={toastMessage}
                duration={3000}
                position="bottom"
            />
        </IonPage>
    );
};

const MAX_RESEND = 4;

// ── Outer component — resolves reCAPTCHA key and provides context ─────────────
const DeleteAccountPage: React.FC = () => {
    const { data: captchaSetting } = useSystemSetting('portal_google_recaptcha_site_key');
    const captchaSiteKey = (captchaSetting?.data as any)?.response?.value ?? '';

    if (!captchaSiteKey) {
        return <DeleteAccountBody />;
    }

    return (
        <GoogleReCaptchaProvider reCaptchaKey={captchaSiteKey}>
            <DeleteAccountBody />
        </GoogleReCaptchaProvider>
    );
};

export default DeleteAccountPage;
