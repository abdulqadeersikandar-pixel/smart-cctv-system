import { useContext } from 'react';
import { AuthContext } from '../contexts/authContext';

export function useAuth() {
  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return authContext;
}
