import { useCallback, useEffect, useState } from 'react';
import { accountError } from '../services/supabase';

export function useAccountData(key, load) {
    const [version, setVersion] = useState(0);
    const [result, setResult] = useState({ key: null, data: null, error: null });
    const requestKey = `${key}:${version}`;
    useEffect(() => {
        let active = true;
        load().then((data) => { if (active) setResult({ key: requestKey, data, error: null }); })
            .catch((error) => { if (active) setResult({ key: requestKey, data: null, error: accountError(error) }); });
        return () => { active = false; };
    }, [load, requestKey]);
    const reload = useCallback(() => setVersion((value) => value + 1), []);
    return result.key === requestKey ? { ...result, loading: false, reload }
        : { data: null, error: null, loading: true, reload };
}
