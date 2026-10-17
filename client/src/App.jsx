import React from 'react';
import { ToastProvider } from './context/ToastContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { LoadingSpinner, EmptyState } from './components/common/EmptyState';
import { OnboardingTour } from './components/common/OnboardingTour';
import { BuddyHelpWidget } from './components/common/BuddyHelpWidget';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { LibrariesDiscoveryScreen } from './screens/LibrariesDiscoveryScreen';
import { CreateLibraryScreen } from './screens/CreateLibraryScreen';
import { LibraryHomeScreen } from './screens/LibraryHomeScreen';
import { BookDetailScreen } from './screens/BookDetailScreen';
import { MyBooksDashboardScreen } from './screens/MyBooksDashboardScreen';
import { HandoverScreen } from './screens/HandoverScreen';
import { ChatScreen } from './screens/ChatScreen';
import { Lock } from 'lucide-react';

/**
 * Route Matcher Helper: extracts params like :id and :bookId
 */
function matchRoute(pattern, pathname) {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);

  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const params = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const patternPart = patternSegments[i];
    const pathPart = pathSegments[i];

    if (patternPart.startsWith(':')) {
      const paramName = patternPart.slice(1);
      params[paramName] = pathPart;
    } else if (patternPart !== pathPart) {
      return null;
    }
  }

  return params;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { navigate } = useNavigation();

  if (loading) {
    return <LoadingSpinner text="Authenticating session..." />;
  }

  if (!user) {
    return (
      <EmptyState
        icon={Lock}
        title="Authentication Required"
        description="Please sign in or register to access this community shelf feature."
        actionText="Sign In"
        onAction={() => navigate('/login')}
      />
    );
  }

  return children;
}

function AppRouter() {
  const { currentPath, navigate } = useNavigation();
  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <LoadingSpinner text="Loading BooksBuddy..." size="lg" />
      </div>
    );
  }

  // 1. Static Routes
  if (currentPath === '/' || currentPath === '') {
    return <LibrariesDiscoveryScreen />;
  }
  if (currentPath === '/login') {
    return <LoginScreen />;
  }
  if (currentPath === '/register') {
    return <RegisterScreen />;
  }
  if (currentPath === '/library/new') {
    return (
      <ProtectedRoute>
        <CreateLibraryScreen />
      </ProtectedRoute>
    );
  }
  if (currentPath === '/my-books') {
    return (
      <ProtectedRoute>
        <MyBooksDashboardScreen />
      </ProtectedRoute>
    );
  }

  // 2. Dynamic Param Routes
  let match = matchRoute('/library/:id/book/:bookId', currentPath);
  if (match) {
    return <BookDetailScreen libraryId={match.id} bookId={match.bookId} />;
  }

  match = matchRoute('/library/:id', currentPath);
  if (match) {
    return <LibraryHomeScreen libraryId={match.id} />;
  }

  match = matchRoute('/handover/:sessionId', currentPath);
  if (match) {
    return (
      <ProtectedRoute>
        <HandoverScreen sessionId={match.sessionId} />
      </ProtectedRoute>
    );
  }

  match = matchRoute('/chat/:requestId', currentPath);
  if (match) {
    return (
      <ProtectedRoute>
        <ChatScreen requestId={match.requestId} />
      </ProtectedRoute>
    );
  }

  // 3. Fallback 404 Route
  return (
    <EmptyState
      title="Page Not Found"
      description="The page you requested does not exist or has been moved."
      actionText="Return to Libraries"
      onAction={() => navigate('/')}
    />
  );
}

export default function App() {
  return (
    <ToastProvider>
      <NavigationProvider>
        <AuthProvider>
          <div className="min-h-screen bg-[#F6F1E7] flex flex-col justify-between text-[#2E2E2E] font-sans selection:bg-[#EDF6EC] selection:text-[#1B4332]">
            <Navbar />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <AppRouter />
            </main>
            <Footer />
            {/* First-Time User Onboarding Guide */}
            <OnboardingTour />
            {/* Corner Help Widget */}
            <BuddyHelpWidget />
          </div>
        </AuthProvider>
      </NavigationProvider>
    </ToastProvider>
  );
}
