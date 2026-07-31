import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { AppStateProvider } from './contexts/AppStateContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppStateProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </AppStateProvider>,
)