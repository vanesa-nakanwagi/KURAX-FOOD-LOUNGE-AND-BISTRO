import { useCallback, useEffect, useState } from 'react';
import API_URL from '../../config/api';

export default function useClaimedProduction(station, user, enabled) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [updatingWorkId, setUpdatingWorkId] = useState(null);

  const load = useCallback(async () => {
    if (!user?.token) return;
    const headers = { Authorization: `Bearer ${user.token}` };
    const mineResponse = await fetch(`${API_URL}/api/production/${station}/queue`, { headers });
    const mine = await mineResponse.json().catch(() => ({}));
    if (!mineResponse.ok) throw new Error(mine.error || 'Could not load your production work.');
    if (!Array.isArray(mine)) {
      throw new Error('Production queue response was invalid.');
    }
    setItems(mine);
  }, [station, user?.token]);

  useEffect(() => {
    if (!enabled || !user?.token) {
      setItems([]);
      setError('');
      setMessage('');
      return undefined;
    }

    let mounted = true;
    const refresh = async () => {
      try {
        await load();
        if (mounted) setError('');
      } catch (loadError) {
        if (mounted) setError(loadError.message);
      }
    };

    refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [load, user?.token, enabled]);

  const updateStatus = useCallback(async (work, status) => {
    if (updatingWorkId !== null) return null;
    setUpdatingWorkId(work.work_id);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/production/work/${work.work_id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ status }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not update production work.');
      if (status === 'Completed') {
        setMessage(result.ticket_ready
          ? 'Order completed. The waiter has been notified.'
          : 'Item completed. The waiter will be notified when the station order is complete.');
      } else {
        setMessage('Preparation started.');
      }
      await load();
      return result;
    } catch (updateError) {
      setError(updateError.message);
      return null;
    } finally {
      setUpdatingWorkId(null);
    }
  }, [load, updatingWorkId, user?.token]);

  const claim = useCallback(async (work, pin) => {
    if (updatingWorkId !== null) return null;
    setUpdatingWorkId(work.work_id);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_URL}/api/production/work/${work.work_id}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ pin, station }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not claim production work.');
      setMessage(`${work.item_name} claimed. You can start preparing it now.`);
      await load();
      return result;
    } catch (claimError) {
      setError(claimError.message);
      return null;
    } finally {
      setUpdatingWorkId(null);
    }
  }, [load, station, updatingWorkId, user?.token]);

  return { items, error, message, updatingWorkId, updateStatus, claim };
}
