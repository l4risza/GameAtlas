import { useEffect, useState } from 'react';
import { AuthContext } from './auth-context';
import { authConfigurationError, supabase } from '../services/supabase';
import { confirmationError, observeAuthSession } from '../services/auth';

export default function AuthProvider({ children }) {
    const [state, setState] = useState({ session: null, loading: Boolean(supabase), error: authConfigurationError });
    useEffect(() => {
        if (!supabase) return;
        return observeAuthSession(supabase.auth, setState, confirmationError(window.location));
    }, []);
    return <AuthContext.Provider value={{ ...state, user: state.session?.user || null,
        configured: Boolean(supabase) }}>{children}</AuthContext.Provider>;
}
