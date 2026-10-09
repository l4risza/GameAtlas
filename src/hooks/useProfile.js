import { useCallback } from 'react';
import { useAuth } from '../context/auth-context';
import { database, resultOf } from '../services/supabase';
import { useAccountData } from './useAccountData';

export function useProfile() {
    const { user } = useAuth();
    const userId = user?.id;
    const load = useCallback(async () => {
        if (!userId) return null;
        const { data } = await resultOf(database().from('perfis').select('id,nome,username,avatar_url,bio,atualizado_em')
            .eq('id', userId).single());
        return data;
    }, [userId]);
    const result = useAccountData(userId || 'visitante', load);
    return { ...result, profile: result.data };
}
