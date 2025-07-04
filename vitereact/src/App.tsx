import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMediaQuery } from 'react-responsive';
import { useAppStore } from '@/store/main';

/*
    Import views: unique views (UV_*) and shared global views (GV_*)
*/
import GV_HeaderBar from '@/components/views/GV_HeaderBar.tsx';
import GV_ToastNotification from '@/components/views/GV_ToastNotification.tsx';
import GV_SideBar from '@/components/views/GV_SideBar.tsx';
import GV_SideBar_MobileDrawer from '@/components/views/GV_SideBar_MobileDrawer.tsx';
import GV_ConfirmationModal from '@/components/views/GV_ConfirmationModal.tsx';
import UV_Login from '@/components/views/UV_Login.tsx';
import UV_Register from '@/components/views/UV_Register.tsx';
import UV_ForgotPassword from '@/components/views/UV_ForgotPassword.tsx';
import UV_PasswordResetForm from '@/components/views/UV_PasswordResetForm.tsx';
import UV_TaskDashboard from '@/components/views/UV_TaskDashboard.tsx';
import UV_TaskEditModal from '@/components/views/UV_TaskEditModal.tsx'; // Included, though typically managed by UV_TaskDashboard
import UV_CategoryManagement from '@/components/views/UV_CategoryManagement.tsx';

// Initialize React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevents re-fetching on window focus by default
      retry: false, // Disables retries for failed queries by default
    },
  },
});

interface ConfirmationModalState {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// ProtectedRoute component definition
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { auth_token, current_user } = useAppStore();
  if (!auth_token || !current_user) {
    // User is not authenticated, redirect to login
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// PublicRoute component definition (redirects authenticated users away from auth pages)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { auth_token, current_user } = useAppStore();
  if (auth_token && current_user) {
    // User is authenticated, redirect away from public auth pages
    return <Navigate to="/tasks" replace />;
  }
  return <>{children}</>;
};

// Layout for authenticated users (includes Header, Sidebar, and content)
const AuthenticatedLayout: React.FC = () => {
  const { auth_token, current_user } = useAppStore();
  const isDesktopOrTablet = useMediaQuery({ minWidth: 768 }); // Tailwind's 'md' breakpoint
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // If somehow reached AuthenticatedLayout but not authenticated, redirect
  if (!auth_token || !current_user) {
    return <Navigate to="/login" replace />;
  }

  const toggleMobileDrawer = () => {
    setIsMobileDrawerOpen(!isMobileDrawerOpen);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <GV_HeaderBar toggleMobileDrawer={toggleMobileDrawer} />

      <div className="flex flex-1">
        {isDesktopOrTablet ? (
          <GV_SideBar />
        ) : (
          <GV_SideBar_MobileDrawer isOpen={isMobileDrawerOpen} onClose={() => setIsMobileDrawerOpen(false)} />
        )}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <Outlet /> {/* Renders the matched child route component */}
        </main>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  // Global confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  // Function to show the confirmation modal from anywhere in the app
  const showConfirmation = (message: string, onConfirm: () => void, onCancel: () => void = () => {}) => {
    setConfirmationModal({
      isOpen: true,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        onCancel();
        setConfirmationModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Pass setConfirmationModal into context or directly to relevant components
  // For simplicity here, we'll assume a global context or specific props for now,
  // but a more robust solution might integrate this into Zustand or a React Context.
  // For this problem, we will pass it as a prop to components that require it.
  // Given App.tsx is the root, we need to pass this down.

  // The confirmation modal is a global view, so it should be rendered at a high level.
  // Its visibility and content will be managed by a state that components can trigger.
  // For this example `showConfirmation` is defined here and implicitly made available
  // to components that might need it (e.g., through a context, or by direct prop drilling
  // if limited components need it). For simplicity and scope, we'll demonstrate it being
  // here, and assume relevant `UV_` components will receive a `showConfirmation` prop
  // or use a context provided by `App.tsx` (which is beyond building just App.tsx itself).
  // For the purpose of THIS component, GV_ConfirmationModal should just be rendered here,
  // and its props `isOpen`, `message`, etc. will come from the local state `confirmationModal`.

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="relative isolate min-h-screen flex flex-col">
          {/* Header Bar is always present */}
          {/* GV_HeaderBar needs toggleMobileDrawer if not desktop */}
          {/* We'll manage the toggle state within AuthenticatedLayout */}
          {/* For unauthenticated views, GV_HeaderBar renders login/register options */}
          <Routes>
            {/* Authenticated Layout and Routes */}
            <Route path="/" element={<AuthenticatedLayout />}>
              <Route index element={<Navigate to="/tasks" replace />} /> {/* Default authenticated route */}
              <Route path="/tasks" element={<ProtectedRoute><UV_TaskDashboard showConfirmation={showConfirmation} /></ProtectedRoute>} />
              <Route path="/categories" element={<ProtectedRoute><UV_CategoryManagement showConfirmation={showConfirmation}/></ProtectedRoute>} />
            </Route>

            {/* Public Routes (Login, Register, Forgot Password, Reset Password) */}
            <Route path="/login" element={<PublicRoute><UV_Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><UV_Register /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><UV_ForgotPassword /></PublicRoute>} />
            <Route path="/reset-password" element={<PublicRoute><UV_PasswordResetForm /></PublicRoute>} />

            {/* Fallback for unmatched routes */}
            <Route path="*" element={<Navigate to="/login" replace />} /> {/* Or a 404 page */}
          </Routes>

          {/* Global Shared Views always present */}
          <GV_ToastNotification />
          {/* GV_ConfirmationModal is a global overlay */}
          <GV_ConfirmationModal
            isOpen={confirmationModal.isOpen}
            message={confirmationModal.message}
            onConfirm={confirmationModal.onConfirm}
            onCancel={confirmationModal.onCancel}
          />
          {/* UV_TaskEditModal is typically opened by UV_TaskDashboard, not globally */}
          {/* If it were global, its state would also be managed here like confirmationModal */}
        </div>
      </Router>
    </QueryClientProvider>
  );
};

export default App;