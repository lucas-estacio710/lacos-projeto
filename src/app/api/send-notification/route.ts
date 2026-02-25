import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Forçar rota dinâmica (não pre-render no build)
export const dynamic = 'force-dynamic';

let vapidConfigured = false;

function ensureVapid() {
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      'mailto:lacos@lacos.app',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    vapidConfigured = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureVapid();

    const { count } = await request.json();

    if (!count || count <= 0) {
      return NextResponse.json({ error: 'count inválido' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Buscar todas as subscriptions
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error) {
      console.error('Erro ao buscar subscriptions:', error);
      return NextResponse.json({ error: 'Erro ao buscar subscriptions' }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, message: 'Nenhuma subscription encontrada' });
    }

    const payload = JSON.stringify({
      title: 'MANDOU BEM! 🔥',
      body: `Lucão acaba de subir ${count} lançamentos no Laços! Bora classificar 🔥`,
      icon: '/icon-192x192.png'
    });

    let sent = 0;
    const expiredEndpoints: string[] = [];

    // Enviar pra cada subscription
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys_p256dh,
                auth: sub.keys_auth
              }
            },
            payload
          );
          sent++;
        } catch (err: unknown) {
          const pushError = err as { statusCode?: number };
          if (pushError.statusCode === 410 || pushError.statusCode === 404) {
            // Subscription expirada, marcar pra remoção
            expiredEndpoints.push(sub.endpoint);
          } else {
            console.error('Erro ao enviar push para', sub.endpoint, err);
          }
        }
      })
    );

    // Remover subscriptions expiradas
    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
      console.log(`🗑️ ${expiredEndpoints.length} subscriptions expiradas removidas`);
    }

    console.log(`📬 Push enviado: ${sent}/${subscriptions.length} (${expiredEndpoints.length} expiradas)`);

    return NextResponse.json({
      sent,
      total: subscriptions.length,
      expired: expiredEndpoints.length
    });

  } catch (err) {
    console.error('Erro no send-notification:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
