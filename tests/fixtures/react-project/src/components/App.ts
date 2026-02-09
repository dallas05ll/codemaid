import { Header } from './Header.js';
import { useAuth } from '../hooks/useAuth.js';

export function App() {
  const user = useAuth();
  return { Header, user };
}
