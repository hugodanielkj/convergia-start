'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import estilos from './avisos.module.css';

/** "Resolver" tira o aviso da lista para todos (decisão do PO). */
export function BotaoResolver({ id }: { id: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(false);

  async function resolver() {
    setOcupado(true);
    setErro(false);
    const r = await fetch(`/api/alertas/${id}/resolver`, { method: 'POST' });
    setOcupado(false);
    if (!r.ok) {
      setErro(true);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className={estilos.principal}
        disabled={ocupado}
        onClick={() => void resolver()}
      >
        {ocupado ? 'Resolvendo…' : 'Resolver'}
      </button>
      {erro && (
        <p role="alert" className={estilos.erro}>
          Não foi possível resolver. Tente de novo.
        </p>
      )}
    </>
  );
}
