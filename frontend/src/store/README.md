# Zustand Authentication Store

This directory contains the Zustand-based state management implementation for authentication, providing an alternative to the React Context-based approach.

## Overview

The `authStore.ts` provides a comprehensive authentication state management solution using Zustand with the following features:

- **State Persistence**: User session persists across page refreshes
- **Performance Optimized**: Fine-grained subscriptions prevent unnecessary re-renders
- **Type Safety**: Full TypeScript support with proper typing
- **Middleware Support**: Includes persist and subscribeWithSelector middleware
- **DevTools Integration**: Compatible with Redux DevTools for debugging

## Files

- `authStore.ts` - Main Zustand store with authentication state and actions
- `../hooks/useAuthZustand.ts` - React hooks for consuming the store
- `../examples/AuthStoreExample.tsx` - Usage examples and migration guide

## Basic Usage

### Option 1: Drop-in Replacement Hook

```tsx
import { useAuthZustand } from '../hooks/useAuthZustand';

function MyComponent() {
  const { user, loading, signInWithGoogle, signOut } = useAuthZustand();
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      {user ? (
        <button onClick={signOut}>Sign Out</button>
      ) : (
        <button onClick={signInWithGoogle}>Sign In</button>
      )}
    </div>
  );
}
```

### Option 2: Fine-grained Subscriptions (Recommended)

```tsx
import { useIsAuthenticated, useAuthActions, useUserProfile } from '../hooks/useAuthZustand';

function MyComponent() {
  const { isAuthenticated } = useIsAuthenticated();
  const { signInWithGoogle, signOut } = useAuthActions();
  const { userProfile } = useUserProfile();
  
  return (
    <div>
      {isAuthenticated ? (
        <div>
          <p>Welcome, {userProfile?.displayName}!</p>
          <button onClick={signOut}>Sign Out</button>
        </div>
      ) : (
        <button onClick={signInWithGoogle}>Sign In</button>
      )}
    </div>
  );
}
```

### Option 3: Direct Store Access

```tsx
import { useAuthStore } from '../store/authStore';

function MyComponent() {
  const user = useAuthStore((state) => state.user);
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  
  return (
    <div>
      {user ? (
        <p>Hello, {user.email}!</p>
      ) : (
        <button onClick={signInWithGoogle}>Sign In</button>
      )}
    </div>
  );
}
```

## State Structure

```typescript
interface AuthState {
  // Current state
  user: User | null;                    // Firebase User object
  userProfile: UserProfile | null;     // Extended user profile from Firestore
  loading: boolean;                     // Loading state for async operations
  error: string | null;                 // Current error message
  isInitialized: boolean;               // Whether auth has been initialized

  // Actions
  signInWithGoogle: () => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
  updateUserProfile: (updates: ProfileUpdates) => Promise<void>;
  
  // Utility actions
  clearError: () => void;
  initialize: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}
```

## Available Hooks

### `useAuthZustand()`
Drop-in replacement for the React Context `useAuth()` hook. Provides the same API but uses Zustand internally.

### Selector Hooks (Performance Optimized)
- `useAuthUser()` - Subscribe to user state only
- `useAuthUserProfile()` - Subscribe to user profile only  
- `useAuthLoading()` - Subscribe to loading state only
- `useAuthError()` - Subscribe to error state only
- `useAuthActions()` - Get all authentication actions

### Utility Hooks
- `useIsAuthenticated()` - Get authentication status
- `useAuthStatus()` - Get comprehensive auth status
- `useUserProfile()` - User profile data and actions
- `useAuthenticationState()` - Core auth state
- `useAuthenticationActions()` - All auth actions

## Migration Guide

### From React Context to Zustand

**Before (React Context):**
```tsx
import { useAuth } from './hooks/useAuth';

function App() {
  return (
    <AuthProvider>
      <MyComponent />
    </AuthProvider>
  );
}

function MyComponent() {
  const { user, signInWithGoogle } = useAuth();
  // ...
}
```

**After (Zustand):**
```tsx
import { useAuthZustand } from './hooks/useAuthZustand';

function App() {
  // No provider needed!
  return <MyComponent />;
}

function MyComponent() {
  const { user, signInWithGoogle } = useAuthZustand();
  // Same API, but with Zustand benefits
}
```

## Benefits of Zustand Approach

1. **No Providers**: No need to wrap your app in providers
2. **Persistence**: State automatically persists across page refreshes
3. **Performance**: Fine-grained subscriptions reduce re-renders
4. **DevTools**: Built-in Redux DevTools support for debugging
5. **Simplicity**: Less boilerplate than React Context
6. **Flexibility**: Use anywhere in your component tree

## Persistence

The store automatically persists the following state:
- `user` - Current authenticated user
- `userProfile` - User profile data

Other state like `loading` and `error` are not persisted as they are transient.

## Initialization

The store automatically initializes when imported and sets up Firebase auth state listeners. You can also manually initialize:

```tsx
import { useAuthStore } from './store/authStore';

// Manual initialization (usually not needed)
useAuthStore.getState().initialize();
```

## Error Handling

```tsx
import { useAuthError, useAuthActions } from './hooks/useAuthZustand';

function ErrorComponent() {
  const error = useAuthError();
  const { clearError } = useAuthActions();
  
  if (!error) return null;
  
  return (
    <div className="error">
      {error}
      <button onClick={clearError}>Clear</button>
    </div>
  );
}
```

## Integration with Existing Code

The Zustand store can coexist with the existing React Context implementation. You can gradually migrate components or use both approaches in the same application.

## DevTools

Install Redux DevTools browser extension to inspect the store state:

1. Install Redux DevTools extension
2. Open browser DevTools
3. Navigate to Redux tab
4. Inspect auth store state and actions

## TypeScript Support

All hooks and store methods are fully typed. The store exports the following types:

- `AuthState` - Complete store state interface
- Import `User` from `firebase/auth` for user type
- Import `UserProfile` from `../services/authService` for profile type

## Examples

See `../examples/AuthStoreExample.tsx` for comprehensive usage examples and migration patterns.
