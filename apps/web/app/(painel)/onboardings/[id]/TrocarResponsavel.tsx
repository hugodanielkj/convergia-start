'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { rotuloResponsavel, type Responsavel } from '../../clientes/SeletorResponsavel';
import estilos from './detalhe.module.css';
import { mensagemDeErro } from './tipos';

/** RN-08: o Admin troca o responsável do onboarding por alguém ativo da equipe. */
export function TrocarResponsavel({
  onboardingId,
  atual,
  responsaveis,
}: {
  onboardingId: string;
  atual: string;
  responsaveis: readonly Responsavel[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [escolhido, setEscolhido] = useState(atual);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) {
    return (
      <div className={`${estilos.botoes} ${estilos.trocar}`}>
        <button
          type="button"
          onClick={() => {
            setAberto(true);
          }}
        >
          Trocar responsável
        </button>
      </div>
    );
  }

  async function salvar() {
    setOcupado(true);
    setErro(null);
    const r = await fetch(`/api/onboardings/${onboardingId}/responsavel`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ responsavelId: escolhido }),
    });
    setOcupado(false);
    if (!r.ok) {
      setErro(await mensagemDeErro(r));
      return;
    }
    setAberto(false);
    router.refresh();
  }

  return (
    <form
      className={`${estilos.confirmacao} ${estilos.trocar}`}
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <label>
        Novo responsável
        <select
          value={escolhido}
          onChange={(e) => {
            setEscolhido(e.target.value);
          }}
        >
          {responsaveis.map((r) => (
            <option key={r.id} value={r.id}>
              {rotuloResponsavel(r, responsaveis)}
            </option>
          ))}
        </select>
      </label>
      {erro && (
        <p role="alert" className={estilos.erro}>
          {erro}
        </p>
      )}
      <div className={estilos.botoes}>
        <button type="submit" disabled={ocupado || escolhido === atual}>
          Salvar
        </button>
        <button
          type="button"
          className={estilos.secundario}
          onClick={() => {
            setAberto(false);
            setEscolhido(atual);
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
