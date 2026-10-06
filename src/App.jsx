import { Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import Explorar from './pages/Explorar';
import Reviews from './pages/Reviews';
import Listas from './pages/Listas';    
import Perfil from './pages/Perfil';
import Jogo from './pages/Jogo';

// Placeholders — troque por suas páginas reais quando estiverem prontas
function Placeholder({ titulo }) {
    return (
        <div style={{ paddingTop: "120px", textAlign: "center", color: "#F5F3FF" }}>
            <h2>{titulo}</h2>
        </div>
    )
}

function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explorar" element={<Explorar />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/listas" element={<Listas />} />
            <Route path="/login" element={<Placeholder titulo="Login" />} />
            <Route path="/cadastro" element={<Placeholder titulo="Cadastre-se" />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/jogo/:id" element={<Jogo />} />
            <Route path="*" element={<Placeholder titulo="Página não encontrada" />} />
        </Routes>
    )
}

export default App
