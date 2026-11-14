'use client';

import { useState } from 'react';
import { campoNovo, ListaCampos } from '../../../config/formulario/ListaCampos';
import type { Campo } from '../../../config/formulario/tipos';
import estilos from './personalizar.module.css';
import { CAMPO_PERGUNTAS } from './tipos';

/**
 * Seção "Personalizar dados da empresa" do cadastro (S6-2, RN-15). Parte do modelo padrão; só
 * manda as perguntas se a agência mexeu nelas, senão o cliente usa o padrão.
 */
export function SecaoPerguntasCadastro({ padrao }: { padrao: Campo[] }) {
  const [campos, setCampos] = useState<Campo[]>(padrao);
  const [mexeu, setMexeu] = useState(false);
  const semNome = campos.some((c) => c.rotulo.trim() === '');

  function mudar(novos: Campo[]) {
    setCampos(novos);
    setMexeu(true);
  }

  return (
    <details className={estilos.secao}>
      <summary>
        <span className={estilos.tituloSecao}>Personalizar dados da empresa</span>
        <span className={estilos.resumo}>
          {mexeu ? `${String(campos.length)} perguntas só deste cliente` : 'Modelo padrão'}
        </span>
      </summary>
      <ListaCampos campos={campos} aoMudar={mudar} />
      {semNome && (
        <p role="alert" className={estilos.alerta}>
          Dê um nome a todas as perguntas.
        </p>
      )}
      <div className={estilos.rodape}>
        <button
          type="button"
          onClick={() => {
            mudar([...campos, campoNovo()]);
          }}
        >
          + Pergunta
        </button>
        {mexeu && (
          <button
            type="button"
            onClick={() => {
              setCampos(padrao);
              setMexeu(false);
            }}
          >
            Voltar ao padrão
          </button>
        )}
      </div>
      <input type="hidden" name={CAMPO_PERGUNTAS} value={mexeu ? JSON.stringify(campos) : ''} />
    </details>
  );
}
