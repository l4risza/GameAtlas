import { useCallback } from 'react';
import { useAuth } from '../context/auth-context';
import { PROFILE_EXTRAS_DEFAULTS, loadSettingsProfile } from '../services/settings';
import { useAccountData } from './useAccountData';

// Perfil do usuário logado: campos básicos + jogos favoritos, redes sociais e preferências
// (criados pela migração das configurações; sem ela, os extras vêm com os valores padrão).
export function useProfile() {
    const { user } = useAuth();
    const userId = user?.id;
    const load = useCallback(async () => {
        if (!userId) return null;
        const { profile, extras } = await loadSettingsProfile(userId);
        return { ...PROFILE_EXTRAS_DEFAULTS, ...profile, ...extras };
    }, [userId]);
    const result = useAccountData(userId || 'visitante', load);
    return { ...result, profile: result.data };
}
