import { useEffect, useState } from 'react';
import API_URL from '../../config/api';

export default function useOrderPermission(user) {
  const [isGranted, setIsGranted] = useState(false);

  useEffect(() => {
    let active = true;
    let timer;

    const checkPermission = async () => {
      try {
        if (!user?.id || !user?.token) {
          if (active) setIsGranted(false);
          return;
        }

        const response = await fetch(`${API_URL}/api/staff/permission/${user.id}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!response.ok) {
          if (active) setIsGranted(false);
          return;
        }
        const result = await response.json();
        if (active) setIsGranted(result.is_granted === true);
      } catch (error) {
        if (active) {
          setIsGranted(false);
          console.error('Order permission check failed:', error);
        }
      } finally {
        if (active) timer = setTimeout(checkPermission, 3000);
      }
    };

    setIsGranted(false);
    checkPermission();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [user?.id, user?.token]);

  return isGranted;
}
