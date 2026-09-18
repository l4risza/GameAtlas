import Navbar from "../components/Navbar";
import GameSection from '../components/GameSection';
import { useGames } from '../hooks/useGames';
import '../styles/components.css';

export default function Explorar() {
    const { loading, resolveCategory } = useGames();

    return (
        <>

            <Navbar />

            <main
                style={{ paddingTop: '70px' }}
                className="container-fluid px-3 px-lg-5"
            >
                {/*fazer o exeplorar com os generos dos jogos de forma automatica e criar um filtro talvez componente filtro*/}

                <>
                    <GameSection title="Em alta" games={resolveCategory('emAlta')} />
                    <GameSection title="Melhores avaliados" games={resolveCategory('melhoresAv')} />
                    <GameSection title="Lançamentos" games={resolveCategory('lancamentos')} />
                    <GameSection title="Clássicos" games={resolveCategory('classicos')} />
                    <GameSection title="Indie" games={resolveCategory('indie')} />
                    <GameSection title="Multiplayer" games={resolveCategory('multiplayer')} />
                    
                
                </>
            </main>

            <footer className="footer text-center py-4 mt-5">
                <p className="m-0">
                    © {new Date().getFullYear()} GameAtlas. Todos os direitos reservados.
                </p>
            </footer>

        </>
    );
} 