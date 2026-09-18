import Navbar from "../components/Navbar";
import GameSection from '../components/GameSection';
import { useGames } from '../hooks/useGames';
import '../styles/components.css';

export default function Reviews() {
    const { loading, resolveCategory } = useGames();

    return (
        <>

            <Navbar />

            <main
                style={{ paddingTop: '70px' }}
                className="container-fluid px-3 px-lg-5"
            >

                <>
                   <h1>Reviews</h1>
                    
                
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