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

  // Checar suporte e estado atual
  useEffect(() => {
    const checkStatus = async () => {
      const supported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
      setIsSupported(supported);

      if (!supported) {
        setLoading(false);
        return;
      }

      try {
        // Esperar SW registrar (com timeout de 3s pra não travar)
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

      // Pedir permissão
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Permissão de notificação negada');
        setLoading(false);
        return false;
      }

      // Registrar/obter SW
      const registration = await navigator.serviceWorker.ready;

      // Criar subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      const subscriptionJson = subscription.toJSON();

      // Salvar no Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

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

      if (error) throw error;

      setIsSubscribed(true);
      console.log('✅ Push subscription ativada');
      return true;

    } catch (err) {
      console.error('Erro ao ativar push:', err);
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
        // Remover do Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subscription.endpoint);
        }

        // Cancelar no browser
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      console.log('🔕 Push subscription desativada');
      return true;

    } catch (err) {
      console.error('Erro ao desativar push:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { isSupported, isSubscribed, subscribe, unsubscribe, loading };
}
