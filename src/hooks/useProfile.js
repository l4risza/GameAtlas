import { useEffect, useState } from 'react';

// TODO: trocar por uma chamada real quando o backend estiver pronto, ex:
// async function fetchProfileData(username) {
//     const res = await fetch(`/api/perfil/${username}`);
//     if (!res.ok) throw new Error('Falha ao buscar perfil');
//     return res.json();
// }
async function fetchProfileData() {
    return {
        displayName: 'Nome Exibição',
        username: 'nomeusuario',
        avatar: '/images/perfil.png',
        bio: 'Olá! Eu Estou Usando o GameAtlas!',
        favoriteGames: ['God of War', 'Call of Duty', 'Need for Speed', 'GTA', 'Black'],
        socials: {
            linkedin: 'https://www.linkedin.com',
            github: 'https://www.github.com',
            instagram: 'https://www.instagram.com',
        },
        // reviews e listas ainda não existem de verdade — os arrays abaixo são só
        // exemplo pra visualizar o layout. Troque por [] (ou pelos dados reais) quando quiser.
        reviews: [
            {
                id: 1,
                gameTitle: 'Título do Jogo',
                gameImage: '',
                rating: 3,
                date: '25/08/2026',
                text: 'Este tópico apresenta o levantamento de requisitos do sistema proposto, com o objetivo de definir suas funcionalidades e restrições de funcionamento. Os requisitos foram identificados a partir da análise de plataformas existentes e da revisão bibliográfica, buscando atender às necessidades dos usuários e garantir uma experiência adequada de utilização. Para melhor organização, os requisitos foram divididos em requisitos funcionais e requisitos...',
            },
            {
                id: 2,
                gameTitle: 'Título do Jogo',
                gameImage: '',
                rating: 3,
                date: '25/08/2026',
                text: 'Este tópico apresenta o levantamento de requisitos do sistema proposto, com o objetivo de definir suas funcionalidades e restrições de funcionamento. Os requisitos foram identificados a partir da análise de plataformas existentes e da revisão bibliográfica, buscando atender às necessidades dos usuários e garantir uma experiência adequada de utilização. Para melhor organização, os requisitos foram divididos em requisitos funcionais e requisitos...',
            },
            {
                id: 3,
                gameTitle: 'Título do Jogo',
                gameImage: '',
                rating: 3,
                date: '25/08/2026',
                text: 'Este tópico apresenta o levantamento de requisitos do sistema proposto, com o objetivo de definir suas funcionalidades e restrições de funcionamento. Os requisitos foram identificados a partir da análise de plataformas existentes e da revisão bibliográfica, buscando atender às necessidades dos usuários e garantir uma experiência adequada de utilização. Para melhor organização, os requisitos foram divididos em requisitos funcionais e requisitos...',
            },
        ],
        lists: [],
    };
}

export function useProfile() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        fetchProfileData()
            .then((data) => {
                if (active) setProfile(data);
            })
            .catch((err) => console.error('Erro ao buscar perfil:', err))
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    return { profile, loading };
}