import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth.api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.getMe();
      setUser(data.user);
      connectSocket();
      return data.user;
    } catch (err) {
      setUser(null);
      disconnectSocket();
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await authApi.getMe();
        if (isMounted) {
          setUser(data.user);
          connectSocket();
        }
      } catch (err) {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const data = await authApi.login({ email, password });
      setUser(data.user);
      connectSocket();
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const register = useCallback(async (formData) => {
    setError(null);
    try {
      const data = await authApi.register(formData);
      setUser(data.user);
      connectSocket();
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      disconnectSocket();
    }
  }, []);

  const getMembership = useCallback((libraryId) => {
    if (!user || !user.memberships) return null;
    const lid = Number(libraryId);
    return user.memberships.find((m) => Number(m.library_id) === lid) || null;
  }, [user]);

  const isMemberOf = useCallback((libraryId) => {
    const mem = getMembership(libraryId);
    return mem ? mem.status === 'APPROVED' : false;
  }, [getMembership]);

  const isLibrarianOf = useCallback((libraryId) => {
    const mem = getMembership(libraryId);
    return mem && mem.status === 'APPROVED' && (mem.role === 'LIBRARIAN' || mem.role === 'PRIMARY_LIBRARIAN');
  }, [getMembership]);

  const isPrimaryLibrarianOf = useCallback((libraryId) => {
    const mem = getMembership(libraryId);
    return mem && mem.status === 'APPROVED' && mem.role === 'PRIMARY_LIBRARIAN';
  }, [getMembership]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        refreshUser,
        getMembership,
        isMemberOf,
        isLibrarianOf,
        isPrimaryLibrarianOf,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
