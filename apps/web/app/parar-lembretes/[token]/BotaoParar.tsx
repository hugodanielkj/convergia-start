'use client';

import { useState } from 'react';
import estilos from './parar.module.css';

export function BotaoParar({ token, empresa }: { token: string; empresa: string }) {
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'feito' | 'erro'>('inicial');

  async function parar() {
    setEstado('enviando');
    const r = await fetch(`/api/publico/lembretes/${encodeURIComponent(token)}/parar`, {
      method: 'POST',
    });
    setEstado(r.ok ? 'feito' : 'erro');
  }

  if (estado === 'feito') {
    return (
      <p role="status" className={estilos.sucesso}>
        Pronto: você não recebe mais lembretes do onboarding da {empresa}.
      </p>
    );
  }
  return (
    <div className={estilos.form}>
      <button
        type="button"
        className={estilos.botao}
        disabled={estado === 'enviando'}
        onClick={() => void parar()}
      >
        {estado === 'enviando' ? 'Enviando…' : 'Parar de receber lembretes'}
      </button>
      {estado === 'erro' && (
        <p role="alert" className={estilos.erro}>
          Não foi possível concluir. Tente de novo em instantes.
        </p>
      )}
    </div>
  );
}
