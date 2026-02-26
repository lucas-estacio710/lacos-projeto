import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      const supported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
      setIsSupported(supported);

      if (!supported) {
        setLoading(false);
        return;
      }

      try {
        const swReady = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
        ]);

        if (swReady) {
          const subscription = await (swReady as ServiceWorkerRegistration).pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        }
      } catch (err) {
        console.error('Erro ao checar subscription:', err);
      }

      setLoading(false);
    };

    checkStatus();
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;

    try {
      setLoading(true);

      // 1. Checar VAPID key
      if (!VAPID_PUBLIC_KEY) {
        alert('❌ VAPID key não configurada. Verifique as env vars no Vercel.');
        setLoading(false);
        return false;
      }

      // 2. Pedir permissão
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('❌ Permissão de notificação negada.');
        setLoading(false);
        return false;
      }

      // 3. Registrar/obter SW
      const registration = await navigator.serviceWorker.ready;

      // 4. Criar push subscription
      let subscription;
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      } catch (pushErr) {
        alert('❌ Erro ao criar push subscription: ' + (pushErr instanceof Error ? pushErr.message : pushErr));
        setLoading(false);
        return false;
      }

      const subscriptionJson = subscription.toJSON();

      // 5. Checar user autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('❌ Usuário não autenticado no Supabase.');
        setLoading(false);
        return false;
      }

      // 6. Salvar no Supabase
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscriptionJson.endpoint,
          keys_p256dh: subscriptionJson.keys?.p256dh,
          keys_auth: subscriptionJson.keys?.auth
        }, {
          onConflict: 'endpoint'
        });

      if (error) {
        alert('❌ Erro ao salvar no Supabase: ' + error.message);
        setLoading(false);
        return false;
      }

      setIsSubscribed(true);
      alert('✅ Notificações push ativadas!');
      return true;

    } catch (err) {
      alert('❌ Erro inesperado: ' + (err instanceof Error ? err.message : err));
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    try {
      setLoading(true);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint);
        }
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      alert('🔕 Notificações push desativadas.');
      return true;

    } catch (err) {
      alert('❌ Erro ao desativar: ' + (err instanceof Error ? err.message : err));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { isSupported, isSubscribed, subscribe, unsubscribe, loading };
}
