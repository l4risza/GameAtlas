import { useEffect, useState } from 'react';
import { AuthContext } from './auth-context';
import { supabase } from '../services/supabase';

export default function AuthProvider({ children }) {
    const [state, setState] = useState({ session: null, loading: Boolean(supabase), error: null });
    useEffect(() => {
        if (!supabase) return;
        let active = true;
        let authChanged = false;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            authChanged = true;
            if (active) setState({ session, loading: false, error: null });
        });
        supabase.auth.getSession().then(({ data, error }) => {
            if (active && !authChanged) setState({ session: data.session, loading: false,
                error: error ? 'Não foi possível recuperar sua sessão. Entre novamente.' : null });
        }).catch(() => {
            if (active && !authChanged) setState({ session: null, loading: false, error: 'Não foi possível recuperar sua sessão.' });
        });
        return () => { active = false; subscription.unsubscribe(); };
    }, []);
    return <AuthContext.Provider value={{ ...state, user: state.session?.user || null,
        configured: Boolean(supabase) }}>{children}</AuthContext.Provider>;
}
