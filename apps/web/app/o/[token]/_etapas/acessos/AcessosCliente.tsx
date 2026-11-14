'use client';

import { useState } from 'react';
import estilos from './acessos.module.css';
import type { AcessoVisao, EstadoAcessos } from './tipos';
import { useAvancoEtapa } from '../../_componentes/avanco';

const ROTULO_STATUS: Record<AcessoVisao['status'], string> = {
  pendente: 'Pendente',
  concedido: 'Acesso confirmado',
  invalido: 'Precisa de ajuste',
};

function rotulo(a: AcessoVisao): string {
  return a.status === 'pendente' && a.informado
    ? 'Aguardando confirmação da agência'
    : ROTULO_STATUS[a.status];
}

export function AcessosCliente({ token, inicial }: { token: string; inicial: EstadoAcessos }) {
  const [estado, setEstado] = useState(inicial);
  const { avancar } = useAvancoEtapa();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function informar(plataforma: string) {
    setOcupado(plataforma);
    setErro(null);
    const r = await fetch(
      `/api/publico/onboardings/${encodeURIComponent(token)}/acessos/${plataforma}/informar`,
      { method: 'POST' },
    );
    setOcupado(null);
    if (!r.ok) {
      setErro('Não foi possível registrar agora. Tente novamente.');
      return;
    }
    const novo = (await r.json()) as EstadoAcessos;
    setEstado(novo);
    // RN-79: avisou em todas as plataformas (ou já concedidas) → segue para a Reunião.
    const todas = novo.plataformas.every(
      (p) => p.status === 'concedido' || (p.informado && p.status === 'pendente'),
    );
    if (todas) avancar();
  }

  return (
    <div className={estilos.lista}>
      <p className={estilos.intro}>
        Adicione a agência como parceira em cada rede. <strong>Sem senhas.</strong>
      </p>
      {estado.plataformas.map((a) => (
        <details
          key={a.plataforma}
          className={estilos.item}
          // Aberto só o que ainda pede ação do cliente; o resto fica recolhido (menos texto).
          open={a.status === 'invalido' || (a.status === 'pendente' && !a.informado)}
        >
          <summary className={estilos.resumo}>
            <span className={estilos.nome}>{a.nome}</span>
            <span className={estilos.selo} data-status={a.status}>
              {rotulo(a)}
            </span>
          </summary>
          {a.status === 'invalido' && a.motivo ? (
            <p className={estilos.alerta}>A agência não conseguiu confirmar: {a.motivo}</p>
          ) : null}
          {a.status !== 'concedido' ? (
            <>
              <ol className={estilos.passos}>
                {a.passos.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
              {a.identificador ? (
                <p className={estilos.identificador}>
                  Adicione: <code>{a.identificador}</code>
                </p>
              ) : null}
              <button
                type="button"
                className={estilos.botao}
                disabled={ocupado === a.plataforma || (a.informado && a.status === 'pendente')}
                onClick={() => void informar(a.plataforma)}
              >
                {a.informado && a.status === 'pendente'
                  ? 'Aviso enviado'
                  : 'Já adicionei a agência'}
              </button>
            </>
          ) : null}
        </details>
      ))}
      {erro ? <p className={estilos.erro}>{erro}</p> : null}
    </div>
  );
}
