import { Routes, Route } from "react-router-dom"
import Home from "./pages/Home"

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
            <Route path="/explorar" element={<Placeholder titulo="Explorar" />} />
            <Route path="/reviews" element={<Placeholder titulo="Reviews" />} />
            <Route path="/listas" element={<Placeholder titulo="Listas" />} />
            <Route path="/login" element={<Placeholder titulo="Login" />} />
            <Route path="/cadastro" element={<Placeholder titulo="Cadastre-se" />} />
            <Route path="/jogo/:id" element={<Placeholder titulo="Detalhes do jogo" />} />
            <Route path="*" element={<Placeholder titulo="Página não encontrada" />} />
        </Routes>
    )
}

export default App
