import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ProfilePage from './ProfilePage';

vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: any) => <div>{children}</div>,
  IonContent: ({ children, className }: any) => <div data-testid="ion-content" className={className}>{children}</div>,
  IonList: ({ children, className }: any) => <ul className={className}>{children}</ul>,
  IonItem: ({ children, button, onClick, disabled }: any) => (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <li onClick={onClick} data-disabled={disabled} role={button ? 'button' : undefined}>{children}</li>
  ),
  IonLabel: ({ children, className }: any) => <span className={className}>{children}</span>,
  IonIcon: ({ icon, slot, className }: any) => <span data-icon={icon} data-slot={slot} className={className} />,
  IonGrid: ({ children, className }: any) => <div className={className}>{children}</div>,
  IonRow: ({ children }: any) => <div>{children}</div>,
  IonCol: ({ children, size }: any) => <div data-size={size}>{children}</div>,
  IonAlert: ({ isOpen, header }: any) => isOpen ? <div role="alertdialog">{header}</div> : null,
  useIonRouter: () => ({ push: vi.fn() }),
}));

vi.mock('ionicons/icons', () => ({
  chevronForwardOutline: 'chevron-forward',
  logOutOutline: 'log-out',
  trashOutline: 'trash',
}));

vi.mock('../hooks/useSystemSetting', () => ({
  useSystemSetting: vi.fn().mockReturnValue({ data: null }),
}));

vi.mock('../components/layout/AppHeader', () => ({
  AppHeader: ({ title }: any) => <div data-testid="app-header">{title}</div>,
}));

vi.mock('../components/layout/BottomNavigation', () => ({
  BottomNavigation: () => <nav data-testid="bottom-nav" />,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../hooks/useImpression', () => ({ default: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks/useUser', () => ({ useUser: vi.fn() }));
vi.mock('../hooks/useUserEnrollment', () => ({ useUserEnrollmentList: vi.fn() }));
vi.mock('../hooks/useUserCertificates', () => ({ useUserCertificates: vi.fn() }));
vi.mock('../components/home/learning-started/LearningStatsGrid', () => ({
  LearningStatsGrid: ({ totalCourses, coursesInProgress, coursesCompleted, certificationsEarned }: any) => (
    <div data-testid="learning-stats-grid">
      <span className="stats-grid__value">{String(totalCourses).padStart(2, '0')}</span>
      <span className="stats-grid__value">{String(coursesInProgress).padStart(2, '0')}</span>
      <span className="stats-grid__value">{String(coursesCompleted).padStart(2, '0')}</span>
      <span className="stats-grid__value">{String(certificationsEarned).padStart(2, '0')}</span>
    </div>
  ),
}));
vi.mock('../services/network/networkService', () => ({
  networkService: { isConnected: vi.fn().mockReturnValue(true) },
}));
vi.mock('../services/sync/SyncService', () => ({
  syncService: { hasPendingCourseData: vi.fn().mockResolvedValue(false) },
}));
vi.mock('react-avatar', () => ({ default: ({ name }: any) => <div data-testid="avatar">{name}</div> }));

import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../hooks/useUser';
import { useUserEnrollmentList } from '../hooks/useUserEnrollment';
import { useUserCertificates } from '../hooks/useUserCertificates';

const mockAuthBase = { logout: vi.fn() };

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useUser as any).mockReturnValue({ data: null });
    (useUserEnrollmentList as any).mockReturnValue({ data: null });
    (useUserCertificates as any).mockReturnValue({ data: null });
  });

  describe('unauthenticated view', () => {
    beforeEach(() => {
      (useAuth as any).mockReturnValue({ ...mockAuthBase, isAuthenticated: false, userId: null });
    });

    it('has a <main id="main-content"> landmark', () => {
      const { container } = render(<ProfilePage />);
      expect(container.querySelector('main#main-content')).toBeInTheDocument();
    });

    it('shows guest avatar', () => {
      render(<ProfilePage />);
      expect(screen.getByTestId('avatar')).toBeInTheDocument();
    });

    it('shows sign-in button', () => {
      render(<ProfilePage />);
      expect(screen.getByText('signIn')).toBeInTheDocument();
    });

    it('shows downloaded contents and settings links', () => {
      render(<ProfilePage />);
      expect(screen.getByText('downloadedContents')).toBeInTheDocument();
      expect(screen.getByText('settings')).toBeInTheDocument();
    });
  });

  describe('authenticated view — no profile data', () => {
    beforeEach(() => {
      (useAuth as any).mockReturnValue({ ...mockAuthBase, isAuthenticated: true, userId: 'u1' });
      (useUser as any).mockReturnValue({ data: null });
      (useUserEnrollmentList as any).mockReturnValue({ data: null });
    });

    it('has a <main id="main-content"> landmark', () => {
      const { container } = render(<ProfilePage />);
      expect(container.querySelector('main#main-content')).toBeInTheDocument();
    });

    it('shows fallback "User" name when no profile', () => {
      const { container } = render(<ProfilePage />);
      expect(container.querySelector('.profile-name')?.textContent).toBe('guestUser');
    });

    it('shows learner role when no roles', () => {
      const { container } = render(<ProfilePage />);
      expect(container.querySelector('.profile-role')?.textContent).toBe('learner');
    });

    it('shows zeroed stats when no enrollments', () => {
      const { container } = render(<ProfilePage />);
      const statValues = container.querySelectorAll('.stats-grid__value');
      expect(statValues.length).toBeGreaterThan(0);
      statValues.forEach(v => expect(v.textContent).toBe('00'));
    });
  });

  describe('authenticated view — with profile data', () => {
    beforeEach(() => {
      (useAuth as any).mockReturnValue({ ...mockAuthBase, isAuthenticated: true, userId: 'u1' });
      (useUser as any).mockReturnValue({
        data: {
          firstName: 'Alice',
          lastName: 'Smith',
          userName: 'alice.smith',
          organisations: [{ roles: [{ role: 'Admin' }] }],
          roles: [],
        },
      });
      (useUserEnrollmentList as any).mockReturnValue({
        data: {
          data: {
            courses: [
              { status: 1, completionPercentage: 50, issuedCertificates: [] },
              { status: 2, completionPercentage: 100, issuedCertificates: [{ identifier: 'cert-1' }] },
              { status: 2, completionPercentage: 100, issuedCertificates: [] },
            ],
          },
        },
      });
    });

    it('shows full name from profile', () => {
      const { container } = render(<ProfilePage />);
      expect(container.querySelector('.profile-name')?.textContent).toBe('Alice Smith');
    });

    it('shows role from organisation', () => {
      const { container } = render(<ProfilePage />);
      expect(container.querySelector('.profile-role')?.textContent).toBe('Admin');
    });

    it('shows correct stat values', () => {
      const { container } = render(<ProfilePage />);
      const statValues = Array.from(container.querySelectorAll('.stats-grid__value')).map(el => el.textContent);
      expect(statValues).toContain('03'); // total
      expect(statValues).toContain('01'); // in-progress
      expect(statValues).toContain('02'); // completed
    });

    it('shows all action list items', () => {
      render(<ProfilePage />);
      expect(screen.getByText('personalInformation')).toBeInTheDocument();
      expect(screen.getByText('myLearning')).toBeInTheDocument();
      expect(screen.getByText('downloadedContents')).toBeInTheDocument();
      expect(screen.getByText('settings')).toBeInTheDocument();
      expect(screen.getByText('logout')).toBeInTheDocument();
    });

    it('excludes status=1 with completionPercentage>=100 from in-progress and counts it as completed', () => {
      (useUserEnrollmentList as any).mockReturnValue({
        data: {
          data: {
            courses: [
              { status: 1, completionPercentage: 100, issuedCertificates: [] }, // lag: should be completed
              { status: 1, completionPercentage: 50, issuedCertificates: [] },  // genuinely in-progress
            ],
          },
        },
      });
      const { container } = render(<ProfilePage />);
      const statValues = Array.from(container.querySelectorAll('.stats-grid__value')).map(el => el.textContent);
      expect(statValues).toContain('02'); // total = 2
      // in-progress = 1 and completed = 1, so '01' should appear twice across the stat cards
      expect(statValues.filter(value => value === '01')).toHaveLength(2);
    });

    it('renders certificationsEarned count correctly from useUserCertificates', () => {
      // Re-mock useUserCertificates directly in this test to assert non-empty
      (useUserCertificates as any).mockReturnValue({
        data: {
          data: [
            { identifier: 'cert-1' },
            { identifier: 'cert-2' },
            { identifier: 'cert-3' },
            { identifier: 'cert-4' },
          ],
        },
      });

      const { container } = render(<ProfilePage />);
      const statValues = Array.from(container.querySelectorAll('.stats-grid__value')).map(el => el.textContent);

      // With 4 certificates in the array, the count should be '04'
      expect(statValues).toContain('04');
    });
  });

  describe('authenticated view — role as string', () => {
    beforeEach(() => {
      (useAuth as any).mockReturnValue({ ...mockAuthBase, isAuthenticated: true, userId: 'u1' });
      (useUser as any).mockReturnValue({
        data: {
          firstName: 'Bob',
          lastName: null,
          userName: 'bob',
          organisations: [],
          roles: ['CONTENT_CREATOR'],
        },
      });
      (useUserEnrollmentList as any).mockReturnValue({ data: null });
    });

    it('shows first name only when lastName is null', () => {
      const { container } = render(<ProfilePage />);
      expect(container.querySelector('.profile-name')?.textContent).toBe('Bob');
    });

    it('shows string role directly', () => {
      render(<ProfilePage />);
      expect(screen.getByText('CONTENT_CREATOR')).toBeInTheDocument();
    });
  });
});
