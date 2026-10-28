import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from './api';

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancel = false;
    setLoading(true);
    api<T>(path)
      .then((next) => {
        if (!cancel) {
          setData(next);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancel) setError(reason instanceof ApiError ? reason.message : 'request_failed');
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, error, loading, reload };
}
