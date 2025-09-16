import { useEffect, useRef, useState } from 'react';

interface UseMobileGestureProtectionProps {
  enabled?: boolean;
  confirmMessage?: string;
  onBeforeUnload?: () => void;
}

export function useMobileGestureProtection({
  enabled = true,
  confirmMessage = 'Você tem classificações não salvas. Deseja realmente sair?',
  onBeforeUnload
}: UseMobileGestureProtectionProps = {}) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const isNavigatingRef = useRef(false);

  // Detectar se está em um dispositivo móvel
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  useEffect(() => {
    if (!enabled || !isMobile()) return;

    // Prevenir pull-to-refresh (puxar de cima para atualizar)
    const preventPullToRefresh = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const scrollY = window.scrollY || document.documentElement.scrollTop;

      if (e.type === 'touchstart') {
        touchStartY.current = touch.clientY;
      } else if (e.type === 'touchmove') {
        if (touchStartY.current === null) return;

        const deltaY = touch.clientY - touchStartY.current;

        // Se estiver no topo da página e puxando para baixo
        if (scrollY === 0 && deltaY > 0) {
          e.preventDefault();
        }
      }
    };

    // Prevenir swipe back acidental (gesture de voltar pelas laterais)
    // Mas permitir se o usuário segurar por mais tempo (navegação intencional)
    const preventSwipeBack = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];

      if (e.type === 'touchstart') {
        touchStartX.current = touch.clientX;

        // Timer para detectar toque intencional (mais de 500ms)
        setTimeout(() => {
          // Se ainda está tocando na mesma posição, permitir navegação
          if (touchStartX.current !== null) {
            touchStartX.current = null; // Reset para permitir o gesto
          }
        }, 500);

      } else if (e.type === 'touchmove') {
        if (touchStartX.current === null) return; // Permitir se foi reset pelo timer

        const deltaX = touch.clientX - touchStartX.current;
        const screenWidth = window.innerWidth;

        // Prevenir apenas gestos rápidos (acidentais) nas laterais
        // Se começou próximo à lateral esquerda e está deslizando rapidamente para a direita
        if (touchStartX.current < 30 && deltaX > 80) {
          e.preventDefault();
        }

        // Se começou próximo à lateral direita e está deslizando rapidamente para a esquerda (iOS)
        if (touchStartX.current > screenWidth - 30 && deltaX < -80) {
          e.preventDefault();
        }
      }
    };

    // Event listeners para touch events
    document.addEventListener('touchstart', preventPullToRefresh, { passive: false });
    document.addEventListener('touchmove', preventPullToRefresh, { passive: false });
    document.addEventListener('touchstart', preventSwipeBack, { passive: false });
    document.addEventListener('touchmove', preventSwipeBack, { passive: false });

    return () => {
      document.removeEventListener('touchstart', preventPullToRefresh);
      document.removeEventListener('touchmove', preventPullToRefresh);
      document.removeEventListener('touchstart', preventSwipeBack);
      document.removeEventListener('touchmove', preventSwipeBack);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Prevenir beforeunload (incluindo botão voltar do navegador)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !isNavigatingRef.current) {
        e.preventDefault();
        e.returnValue = confirmMessage;
        onBeforeUnload?.();
        return confirmMessage;
      }
    };

    // Detectar navigation via History API
    const handlePopState = (e: PopStateEvent) => {
      if (hasUnsavedChanges) {
        const shouldLeave = window.confirm(confirmMessage);
        if (!shouldLeave) {
          // Restaurar o estado atual
          window.history.pushState(null, '', window.location.href);
        } else {
          isNavigatingRef.current = true;
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    // Adicionar um estado à história para capturar o botão voltar
    if (hasUnsavedChanges) {
      window.history.pushState(null, '', window.location.href);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enabled, hasUnsavedChanges, confirmMessage, onBeforeUnload]);

  // CSS para prevenir overscroll
  useEffect(() => {
    if (!enabled || !isMobile()) return;

    const style = document.createElement('style');
    style.textContent = `
      body {
        overscroll-behavior: none;
        touch-action: pan-x pan-y;
      }

      /* Prevenir pull-to-refresh especificamente */
      html, body {
        overscroll-behavior-y: none;
      }

      /* Prevenir zoom no double tap */
      * {
        touch-action: manipulation;
      }
    `;

    document.head.appendChild(style);

    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, [enabled]);

  return {
    setHasUnsavedChanges,
    hasUnsavedChanges,
    markAsSafe: () => {
      isNavigatingRef.current = true;
      setHasUnsavedChanges(false);
    }
  };
}