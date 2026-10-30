import { useCallback, useEffect, useState } from 'react';
import { type AdminTable, errorMessage, isAuthError, listAdminRows } from '@/admin/adminApi';

export function useAdminRows<T extends { id: string }>(table: AdminTable, onAuthLost: () => void) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await listAdminRows<T>(table));
    } catch (err) {
      if (isAuthError(err)) onAuthLost();
      else setError(errorMessage(err, 'Could not load this list. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [table, onAuthLost]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, loading, error, reload, setError };
}
