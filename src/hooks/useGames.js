import { useEffect, useState } from 'react';

// !! trocar por uma chamada real quando o backend estiver pronto, ex:
// async function fetchGamesData() {
//     const res = await fetch('/api/jogos');
//     if (!res.ok) throw new Error('Falha ao buscar jogos');
//     return res.json(); // já no formato { games, categories }
// }
async function fetchGamesData() {
    const games = {
        1: {
            id: 1,
            title: 'Jogo Um',
            image: '/images/game1.jpg',
            description: 'Descrição do Jogo Um.',
            rating: 8.5,
            platform: 'PC',
            genre: 'Ação',
            year: 2023,
        },
        2: {
            id: 2,
            title: 'Jogo Dois',
            image: '/images/game2.jpg',
            description: 'Descrição do Jogo Dois.',
            rating: 9.1,
            platform: 'PS5',
            genre: 'RPG',
            year: 2022,
        },
        3: {
            id: 3,
            title: 'Jogo Três',
            image: '/images/game3.jpg',
            description: 'Descrição do Jogo Três.',
            rating: 7.8,
            platform: 'Switch',
            genre: 'Indie',
            year: 2021,
        },
        
    };

    // cada categoria guarda só os ids, igual no script original (emAlta, melhoresAv, etc.)
    const categories = {
        emAlta: [1, 2],
        melhoresAv: [2],
        lancamentos: [1],
        classicos: [],
        indie: [3],
        multiplayer: [],
        todos: [1, 2, 3],
    };

    return { games, categories };
}

export function useGames() {
    const [games, setGames] = useState({});
    const [categories, setCategories] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        fetchGamesData()
            .then((data) => {
                if (!active) return;
                setGames(data.games);
                setCategories(data.categories);
            })
            .catch((err) => console.error('Erro ao buscar jogos:', err))
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    // transforma uma lista de ids da categoria nos objetos completos do jogo,
    // igual ao "data.forEach(id => games[id])" do script original
    const resolveCategory = (key) => (categories[key] || []).map((id) => games[id]).filter(Boolean);

    return { games, categories, loading, resolveCategory };
}
