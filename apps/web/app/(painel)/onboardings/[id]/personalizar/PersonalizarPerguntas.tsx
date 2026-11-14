'use client';

import { useState } from 'react';
import { textoDosErros } from '../../../config/formulario/editor';
import { campoNovo, ListaCampos } from '../../../config/formulario/ListaCampos';
import type { Campo, ErroModelo } from '../../../config/formulario/tipos';
import estilos from './personalizar.module.css';
import { MENSAGEM_TRAVADA, type EstadoPerguntas } from './tipos';

type Aviso = { tom: 'ok' | 'erro'; texto: string } | null;

/** Edição posterior das perguntas do cliente (S6-2, RN-15), até ele começar a responder. */
export function PersonalizarPerguntas({
  onboardingId,
  inicial,
}: {
  onboardingId: string;
  inicial: EstadoPerguntas;
}) {
  const [estado, setEstado] = useState(inicial);
  const [campos, setCampos] = useState<Campo[]>(inicial.campos);
  const [sujo, setSujo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  function mudar(novos: Campo[]) {
    setCampos(novos);
    setSujo(true);
  }

  async function salvar() {
    setOcupado(true);
    setAviso(null);
    const resposta = await fetch(
      `/api/onboardings/${encodeURIComponent(onboardingId)}/formulario/personalizacao`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ campos }),
      },
    ).catch(() => null);
    const corpo = (await resposta?.json().catch(() => ({}))) as
      (EstadoPerguntas & { erro?: string; erros?: ErroModelo[] }) | undefined;
    if (resposta?.ok && corpo) {
      setEstado(corpo);
      setCampos(corpo.campos);
      setSujo(false);
      setAviso({ tom: 'ok', texto: 'Perguntas salvas.' });
    } else if (corpo?.erro === 'PERSONALIZACAO_TRAVADA') {
      setEstado({ ...estado, travada: true });
      setAviso({ tom: 'erro', texto: MENSAGEM_TRAVADA });
    } else {
      setAviso({
        tom: 'erro',
        texto: corpo?.erros ? textoDosErros(corpo.erros, campos) : 'Não foi possível salvar.',
      });
    }
    setOcupado(false);
  }

  return (
    <section className={estilos.bloco} aria-labelledby="titulo-perguntas">
      <header className={estilos.cabecalho}>
        <h2 id="titulo-perguntas">Dados da empresa</h2>
        <span className={estilos.selo}>
          {estado.personalizada ? `Só deste cliente · v${String(estado.versao)}` : 'Modelo padrão'}
        </span>
      </header>
      {estado.travada && (
        <p role="status" className={estilos.travada}>
          🔒 {MENSAGEM_TRAVADA}
        </p>
      )}
      {aviso && (
        <p role={aviso.tom === 'erro' ? 'alert' : 'status'} className={estilos[aviso.tom]}>
          {aviso.texto}
        </p>
      )}
      <fieldset disabled={estado.travada || ocupado} className={estilos.campos}>
        <ListaCampos campos={campos} aoMudar={mudar} />
        <div className={estilos.rodape}>
          <button
            type="button"
            onClick={() => {
              mudar([...campos, campoNovo()]);
            }}
          >
            + Pergunta
          </button>
          <button
            type="button"
            className={estilos.primario}
            disabled={!sujo}
            onClick={() => void salvar()}
          >
            Salvar perguntas
          </button>
        </div>
      </fieldset>
    </section>
  );
}
