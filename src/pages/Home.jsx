import Navbar from '../components/Navbar';
import Carousel from '../components/Carousel';
import GameSection from '../components/GameSection';
import { useGames } from '../hooks/useGames';
import '../styles/components.css';

export default function Home() {
    const { loading, resolveCategory } = useGames();

    return (
        <>
            <Navbar />

            <main
                style={{ paddingTop: '70px' }}
                className="container-fluid px-3 px-lg-5"
            >
                <Carousel />

                {loading ? (
                    <p className="carousel-loading">Carregando jogos...</p>
                ) : (
                    <>
                        <GameSection title="Em alta" games={resolveCategory('emAlta')} />
                        <GameSection title="Melhores avaliados" games={resolveCategory('melhoresAv')} />
                        <GameSection title="Lançamentos" games={resolveCategory('lancamentos')} />

                        
                        {/*<GameSection title="Clássicos" games={resolveCategory('classicos')} />
                        <GameSection title="Indie" games={resolveCategory('indie')} />
                        <GameSection title="Multiplayer" games={resolveCategory('multiplayer')} />
                        <GameSection title="Todos os jogos" games={resolveCategory('todos')} />*/}
                    </>
                )}
            </main>

            <footer className="footer text-center py-4 mt-5">
                <p className="m-0">
                    © {new Date().getFullYear()} GameAtlas. Todos os direitos reservados.
                </p>
            </footer>
        </>
    );
}

/*import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Carousel from '../components/Carousel';
import '../styles/components.css';
import GameSection from '../components/GameSection';

export default function Home() {
    return (
        <>
            <Navbar />

            <main
                style={{ paddingTop: '70px' }}
                className="container-fluid px-3 px-lg-5"
            >
                <Carousel />

                <GameSection />
            </main>

            <footer className="footer text-center py-4 mt-5">
                <p className="m-0">
                    © {new Date().getFullYear()} GameAtlas. Todos os direitos reservados.
                </p>
            </footer>
        </>
    );
}*/