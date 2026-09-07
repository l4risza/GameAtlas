import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Carousel from '../components/Carousel';
import '../styles/components.css';

export default function Home() {
    return (
        <>
            <Navbar />

            <main
                style={{ paddingTop: '70px' }}
                className="container-fluid px-3 px-lg-5"
            >
                <Carousel />
            </main>

            <footer className="footer text-center py-4 mt-5">
                <p className="m-0">
                    © {new Date().getFullYear()} GameAtlas. Todos os direitos reservados.
                </p>
            </footer>
        </>
    );
}