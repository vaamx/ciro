import { AuthProvider } from './contexts/AuthContext';
import { AppRouter } from './components/routing/AppRouter';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

export default App;
