import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { otpService } from '../services/OtpService';
import { userService } from '../services/UserService';
import { networkService } from '../services/network/networkService';
import { useAuth } from '../contexts/AuthContext';
import { useTelemetry } from './useTelemetry';
import useInteract from './useInteract';
import type { TriggerCaptcha } from './useEditProfile';
import type { UserProfile } from '../types/userTypes';
import type { OtpType } from '../types/otpTypes';

export type DeleteStatus = 'idle' | 'sending-otp' | 'otp-sent' | 'verifying-otp' | 'deleting' | 'error';

const OTP_LENGTH = 6;
const OTP_COUNTDOWN = 60;
const MAX_RESEND = 4;
const NUM_CONDITIONS = 7;

export const useDeleteAccount = (
  userId: string | null,
  profile: UserProfile | undefined,
  triggerCaptcha: TriggerCaptcha,
) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const telemetry = useTelemetry();
  const { interact } = useInteract();

  // OTP disabled — backend OTP endpoint does not support the masked email/phone
  // returned by the profile API. Re-enable once backend supports type:'userId'.
  // TODO: replace with useSystemSetting('verifyOtpOnDelete') when backend is ready.
  const skipOtpVerification = true;

  // ── Conditions ──────────────────────────────────────────────────────────────
  const [checkedConditions, setCheckedConditions] = useState<Set<number>>(new Set());
  const allChecked = checkedConditions.size === NUM_CONDITIONS;

  // ── OTP / page state ─────────────────────────────────────────────────────────
  const [otpValue, setOtpValue] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [otpStatus, setOtpStatus] = useState<DeleteStatus>('idle');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [maxAttemptsReached, setMaxAttemptsReached] = useState(false);

  // ── Modal / alert state ──────────────────────────────────────────────────────
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showConfirmAlert, setShowConfirmAlert] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const isSubmittingRef = useRef(false);

  // Use userId as the OTP key — profile.email/phone are masked (e.g. te****@yopmail.com)
  // and the OTP API rejects masked values. The backend resolves the actual contact from userId.
  const otpContact = userId
    ? { key: userId, type: 'userId' as OtpType }
    : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Timer ────────────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mountedRef.current) setTimer(OTP_COUNTDOWN);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── reCAPTCHA ────────────────────────────────────────────────────────────────
  const getCaptchaToken = useCallback((): Promise<string | null> =>
    new Promise(resolve => triggerCaptcha(token => resolve(token))), [triggerCaptcha]);

  // ── Conditions ───────────────────────────────────────────────────────────────
  const toggleCondition = useCallback((index: number) => {
    setCheckedConditions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // ── sendOtp (internal) ───────────────────────────────────────────────────────
  const sendOtp = useCallback(async (): Promise<boolean> => {
    if (!otpContact) {
      if (mountedRef.current) setPageError(t('deleteAccountNoContact'));
      return false;
    }

    const captchaToken = await getCaptchaToken();
    if (captchaToken === null) {
      if (mountedRef.current) setPageError(t('recaptchaFailed'));
      return false;
    }

    if (mountedRef.current) {
      setOtpStatus('sending-otp');
      setPageError(null);
    }

    try {
      await otpService.generate({
        request: { key: otpContact.key, type: otpContact.type, captchaToken },
      });
      if (mountedRef.current) {
        setOtpStatus('otp-sent');
        startTimer();
        interact({ id: 'delete-account-otp-sent', pageid: 'DeleteAccountPage' });
      }
      return true;
    } catch {
      if (mountedRef.current) {
        setOtpStatus('error');
        setPageError(t('otpGenerateFailed'));
        telemetry.error({ edata: { err: 'OTP_GENERATE_FAILED', errtype: 'SYSTEM', stacktrace: '' } });
      }
      return false;
    }
  }, [otpContact, getCaptchaToken, startTimer, t, telemetry]);

  // ── executeDelete (internal) ─────────────────────────────────────────────────
  const executeDelete = useCallback(async (): Promise<void> => {
    if (!mountedRef.current) return;
    if (!userId) {
      if (mountedRef.current) setPageError(t('deleteAccountFailed'));
      return;
    }
    setIsDeleting(true);
    setPageError(null);

    try {
      await userService.deleteUser(userId);

      try {
        await userService.clearAccount();
      } catch (cleanupErr) {
        console.warn('Local cleanup failed:', cleanupErr);
      }

      if (mountedRef.current) {
        setCheckedConditions(new Set()); // only cleared here, on success
      }

      telemetry.audit({
        edata: { props: ['account'], state: 'Deleted' },
        object: { id: userId || '', type: 'User', ver: '1' },
      });

      await logout();
    } catch (deleteErr) {
      if (!mountedRef.current) return;
      setIsDeleting(false);
      setOtpStatus('error');
      setPageError(t('deleteAccountFailed'));
      telemetry.error({ edata: { err: 'DELETE_ACCOUNT_FAILED', errtype: 'SYSTEM', stacktrace: '' } });
    }
  }, [userId, logout, t, telemetry]);

  // ── onSubmit ─────────────────────────────────────────────────────────────────
  const onSubmit = useCallback(async (): Promise<void> => {
    if (isSubmittingRef.current) return;

    if (!allChecked) {
      // Toast shown from page component via pageError is not right here — use IonToast
      // The page will show this as a toast.
      setPageError(t('acceptAllConditions'));
      return;
    }

    if (!networkService.isConnected()) {
      interact({ id: 'delete-account-blocked-offline', pageid: 'DeleteAccountPage' });
      setPageError(t('deleteAccountOffline'));
      return;
    }

    isSubmittingRef.current = true;
    interact({ id: 'delete-account-submit', pageid: 'DeleteAccountPage' });

    try {
      if (skipOtpVerification) {
        setShowConfirmAlert(true);
      } else {
        const sent = await sendOtp();
        if (mountedRef.current) {
          if (sent) {
            setShowOtpModal(true);
          }
          // pageError is already set inside sendOtp on failure
        }
      }
    } finally {
      if (mountedRef.current) isSubmittingRef.current = false;
    }
  }, [allChecked, skipOtpVerification, sendOtp, t, telemetry]);

  // ── handleOtpChange ───────────────────────────────────────────────────────────
  const handleOtpChange = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    setOtpValue(prev => {
      const next = [...prev];
      next[index] = value.slice(-1);
      return next;
    });
  }, []);

  // ── handleVerifyAndDelete ─────────────────────────────────────────────────────
  const handleVerifyAndDelete = useCallback(async (): Promise<void> => {
    if (isSubmittingRef.current) return;

    if (!networkService.isConnected()) {
      interact({ id: 'delete-account-otp-blocked-offline', pageid: 'DeleteAccountPage' });
      if (mountedRef.current) setOtpError(t('deleteAccountOtpOffline'));
      return;
    }

    if (otpValue.join('').length < OTP_LENGTH) {
      if (mountedRef.current) setOtpError(t('otpIncomplete'));
      return;
    }

    if (maxAttemptsReached) {
      if (mountedRef.current) setOtpError(t('maxAttemptsReached'));
      return;
    }

    isSubmittingRef.current = true;
    if (mountedRef.current) {
      setOtpStatus('verifying-otp');
      setOtpError(null);
    }

    try {
      await otpService.verify({
        request: { key: otpContact!.key, type: otpContact!.type, otp: otpValue.join('') },
      });

      if (!mountedRef.current) return;
      interact({ id: 'delete-account-otp-verified', pageid: 'DeleteAccountPage' });
      setShowOtpModal(false);
      await executeDelete();
    } catch (err: any) {
      if (!mountedRef.current) return;

      const errData = err?.response?.data;
      const remainingAttempt = errData?.params?.remainingAttempt ?? errData?.result?.remainingAttempt;
      const errCode = errData?.params?.err ?? errData?.params?.status;

      if (remainingAttempt === 0) {
        setMaxAttemptsReached(true);
        setOtpError(t('maxAttemptsReached'));
      } else if (remainingAttempt > 0) {
        setRemainingAttempts(remainingAttempt);
        setOtpValue(Array(OTP_LENGTH).fill(''));
        setOtpError(t('otpRemainingAttempts', { count: remainingAttempt }));
      } else if (errCode === 'UOS_OTPVERFY0063') {
        setOtpError(t(`otpWrong_${otpContact?.type ?? 'email'}`));
      } else {
        setOtpError(t('otpVerifyFailed'));
      }

      setOtpStatus('error');
      telemetry.error({ edata: { err: 'OTP_VERIFY_FAILED', errtype: 'SYSTEM', stacktrace: '' } });
    } finally {
      if (mountedRef.current) isSubmittingRef.current = false;
    }
  }, [otpValue, maxAttemptsReached, otpContact, executeDelete, t, telemetry]);

  // ── handleResendOtp ──────────────────────────────────────────────────────────
  const handleResendOtp = useCallback(async (): Promise<void> => {
    if (!networkService.isConnected()) {
      if (mountedRef.current) setOtpError(t('deleteAccountResendOffline'));
      return;
    }

    if (resendCount >= MAX_RESEND) {
      if (mountedRef.current) setOtpError(t('maxResendReached'));
      return;
    }

    if (timer > 0) return;

    if (mountedRef.current) {
      setResendCount(prev => prev + 1);
      setOtpValue(Array(OTP_LENGTH).fill(''));
      setOtpError(null);
    }

    await sendOtp();
  }, [timer, resendCount, sendOtp, t]);

  // ── resetOtpModal ─────────────────────────────────────────────────────────────
  // Also closes the modal so the close button can call this directly.
  // When IonModal fires onDidDismiss and calls this, setting showOtpModal(false)
  // again is a safe no-op.
  const resetOtpModal = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setShowOtpModal(false);
    setOtpValue(Array(OTP_LENGTH).fill(''));
    setOtpStatus('idle');
    setOtpError(null);
    setTimer(0);
    setResendCount(0);
    setRemainingAttempts(null);
    setMaxAttemptsReached(false);
  }, []);

  // ── dismissConfirmAlert ───────────────────────────────────────────────────────
  const dismissConfirmAlert = useCallback(() => {
    setShowConfirmAlert(false);
  }, []);

  // ── confirmDirectDelete ───────────────────────────────────────────────────────
  const confirmDirectDelete = useCallback(async (): Promise<void> => {
    setShowConfirmAlert(false);

    if (!networkService.isConnected()) {
      if (mountedRef.current) setPageError(t('deleteAccountOffline'));
      return;
    }

    await executeDelete();
  }, [executeDelete, t]);

  return {
    checkedConditions,
    allChecked,
    otpValue,
    otpStatus,
    otpError,
    pageError,
    timer,
    resendCount,
    remainingAttempts,
    maxAttemptsReached,
    showOtpModal,
    showConfirmAlert,
    isDeleting,
    otpContact,
    skipOtpVerification,
    toggleCondition,
    onSubmit,
    handleOtpChange,
    handleVerifyAndDelete,
    handleResendOtp,
    resetOtpModal,
    dismissConfirmAlert,
    confirmDirectDelete,
  };
};
