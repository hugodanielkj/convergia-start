'use client';

import { useEffect, useRef, useState } from 'react';
import { formatarDataHora, urlCompleta } from './formatar';
import estilos from './clientes.module.css';

interface Props {
  readonly caminho: string;
  readonly expiraEm: string;
}

/** Mostra o link do cliente com botão de copiar. O endereço completo usa a origem do navegador. */
export function LinkParaCopiar({ caminho, expiraEm }: Props) {
  const [url, setUrl] = useState(caminho);
  const [copiado, setCopiado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUrl(urlCompleta(window.location.origin, caminho));
  }, [caminho]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      // Sem permissão para a área de transferência: deixa o texto selecionado para copiar à mão.
      campo.current?.select();
    }
  }

  return (
    <div className={estilos.link}>
      <label htmlFor="link-cliente">Link do cliente</label>
      <div className={estilos.linhaLink}>
        <input
          id="link-cliente"
          ref={campo}
          readOnly
          value={url}
          onFocus={(evento) => {
            evento.currentTarget.select();
          }}
        />
        <button type="button" onClick={() => void copiar()}>
          {copiado ? 'Copiado!' : 'Copiar link'}
        </button>
      </div>
      <p className={estilos.ajuda}>Válido até {formatarDataHora(expiraEm)}.</p>
    </div>
  );
}
