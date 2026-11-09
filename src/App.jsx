import { Routes, Route } from "react-router-dom"
import Home from "./pages/Home"
import Explorar from './pages/Explorar';
import Reviews from './pages/Reviews';
import ReviewDetalhes from './pages/ReviewDetalhes';
import Listas from './pages/Listas';
import Perfil from './pages/Perfil';
import Configuracoes from './pages/Configuracoes';
import Jogo from './pages/Jogo';
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import EsqueciSenha from './pages/EsqueciSenha';
import RedefinirSenha from './pages/RedefinirSenha';
import ListaDetalhes from './pages/ListaDetalhes';

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
            <Route path="/reviews/:id" element={<ReviewDetalhes />} />
            <Route path="/listas" element={<Listas />} />
            {/* "salvos" é a lista geral (jogos_salvos); qualquer outro valor é o id de uma lista personalizada */}
            <Route path="/listas/:id" element={<ListaDetalhes />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/perfil/:id" element={<Perfil />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="/jogo/:id" element={<Jogo />} />
            <Route path="*" element={<Placeholder titulo="Página não encontrada" />} />
        </Routes>
    )
}

export default App