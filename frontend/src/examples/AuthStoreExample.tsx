/**
 * Example component demonstrating Zustand Auth Store usage
 * 
 * This file shows different ways to use the new Zustand-based authentication
 * state management as an alternative to React Context.
 */

// Removed unused React import due to new JSX transform
import { useAuthZustand, useAuthStatus, useUserProfile, useIsAuthenticated } from '../hooks/useAuthZustand';
import { useAuthStore } from '../store/authStore';

// Example 1: Drop-in replacement for useAuth hook
function AuthStoreBasicExample() {
  const { 
    user, 
    userProfile, 
    loading, 
    error, 
    signInWithGoogle, 
    signInWithEmail, 
    signOut, 
    clearError 
  } = useAuthZustand();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div className="text-red-600">
        Error: {error}
        <button onClick={clearError} className="ml-2 underline">
          Clear
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <h2>Sign In</h2>
        <button 
          onClick={signInWithGoogle}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Sign in with Google
        </button>
        <button 
          onClick={() => signInWithEmail('test@example.com', 'password123')}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Test Email Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2>Welcome, {userProfile?.displayName || user.email}!</h2>
      {userProfile && (
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: userProfile.avatarColor }}
        >
          {userProfile.displayName?.charAt(0) || user.email?.charAt(0)}
        </div>
      )}
      <button 
        onClick={signOut}
        className="bg-red-500 text-white px-4 py-2 rounded"
      >
        Sign Out
      </button>
    </div>
  );
}

// Example 2: Fine-grained subscriptions (better performance)
function AuthStoreOptimizedExample() {
  const { isAuthenticated, isInitialized } = useIsAuthenticated();
  const { isLoading, hasError, error } = useAuthStatus();
  const { userProfile } = useUserProfile();

  if (!isInitialized || isLoading) {
    return <div>Loading...</div>;
  }

  if (hasError) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  if (!isAuthenticated) {
    return <SignInForm />;
  }

  return (
    <div>
      <h2>Hello, {userProfile?.displayName || 'User'}!</h2>
      <SignOutButton />
    </div>
  );
}

// Example 3: Direct store access (most flexible)
function AuthStoreDirectExample() {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const signOut = useAuthStore((state) => state.signOut);
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {user ? (
        <div>
          <p>Signed in as: {user.email}</p>
          <button onClick={signOut}>Sign Out</button>
        </div>
      ) : (
        <button onClick={signInWithGoogle}>Sign in with Google</button>
      )}
    </div>
  );
}

// Helper components
function SignInForm() {
  const { signInWithGoogle, signInWithEmail } = useAuthZustand();

  return (
    <div className="space-y-4">
      <button 
        onClick={signInWithGoogle}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Sign in with Google
      </button>
      <button 
        onClick={() => signInWithEmail('test@example.com', 'password123')}
        className="bg-green-500 text-white px-4 py-2 rounded"
      >
        Test Email Sign In
      </button>
    </div>
  );
}

function SignOutButton() {
  const { signOut } = useAuthZustand();
  
  return (
    <button 
      onClick={signOut}
      className="bg-red-500 text-white px-4 py-2 rounded"
    >
      Sign Out
    </button>
  );
}

// Migration comparison examples
export function MigrationExample() {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h2 className="text-xl font-bold mb-4">Zustand Auth Store Examples</h2>
        <p className="text-gray-600 mb-6">
          These examples show different ways to use the new Zustand-based authentication state.
        </p>
      </div>

      <div className="border p-4 rounded">
        <h3 className="font-bold mb-2">Example 1: Drop-in Replacement</h3>
        <p className="text-sm text-gray-600 mb-4">
          Uses useAuthZustand() hook - similar API to the React Context useAuth hook
        </p>
        <AuthStoreBasicExample />
      </div>

      <div className="border p-4 rounded">
        <h3 className="font-bold mb-2">Example 2: Optimized with Fine-grained Subscriptions</h3>
        <p className="text-sm text-gray-600 mb-4">
          Uses individual selector hooks for better performance
        </p>
        <AuthStoreOptimizedExample />
      </div>

      <div className="border p-4 rounded">
        <h3 className="font-bold mb-2">Example 3: Direct Store Access</h3>
        <p className="text-sm text-gray-600 mb-4">
          Uses useAuthStore directly for maximum flexibility
        </p>
        <AuthStoreDirectExample />
      </div>
    </div>
  );
}

export default AuthStoreBasicExample;
