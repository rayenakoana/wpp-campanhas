import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import RedefinirSenha from './pages/RedefinirSenha'
import Desempenho from './pages/dashboard/Desempenho'
import Segmentos from './pages/dashboard/Segmentos'
import CriarCampanha from './pages/dashboard/CriarCampanha'
import Campanhas from './pages/dashboard/Campanhas'
import Templates from './pages/dashboard/Templates'
import Radar from './pages/dashboard/Radar'
import Integracoes from './pages/dashboard/Integracoes'
import Configuracoes from './pages/dashboard/Configuracoes'

function Protegida({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          <Route path="/" element={<Protegida><Desempenho /></Protegida>} />
          <Route path="/segmentos" element={<Protegida><Segmentos /></Protegida>} />
          <Route path="/criar-campanha" element={<Protegida><CriarCampanha /></Protegida>} />
          <Route path="/templates" element={<Protegida><Templates /></Protegida>} />
          <Route path="/campanhas" element={<Protegida><Campanhas /></Protegida>} />
          <Route path="/radar" element={<Protegida><Radar /></Protegida>} />
          <Route path="/integracoes" element={<Protegida><Integracoes /></Protegida>} />
          <Route path="/configuracoes" element={<Protegida><Configuracoes /></Protegida>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
