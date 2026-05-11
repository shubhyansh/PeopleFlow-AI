import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { signIn, type SignInResult } from './flowdeskAuth';
import { getSupabaseConfigError } from '../services/supabase/client';
import type { Role, SessionUser } from '../domain/types';

interface AuthState {
  flowdeskUser: SessionUser | null;
  configError: string | null;
}

interface AuthApi extends AuthState {
  signIn: (username: string, password: string) => Promise<SignInResult>;
  signOut: () => void;
}

const Ctx = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [flowdeskUser, setFlowdeskUser] = useState<SessionUser | null>(null);
  const [configError] = useState<string | null>(getSupabaseConfigError());

  const handleSignIn = useCallback(async (username: string, password: string) => {
    const result = await signIn(username, password);
    setFlowdeskUser(result.user);
    return result;
  }, []);

  const signOut = useCallback(() => {
    setFlowdeskUser(null);
  }, []);

  const value = useMemo<AuthApi>(
    () => ({ flowdeskUser, configError, signIn: handleSignIn, signOut }),
    [flowdeskUser, configError, handleSignIn, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}

export function RequireRole({
  allowed,
  children,
}: {
  allowed: Role[];
  children: ReactNode;
}) {
  const { flowdeskUser } = useAuth();
  const location = useLocation();
  if (!flowdeskUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!allowed.includes(flowdeskUser.role)) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
