'use client';

import { useEffect, useRef, useState } from 'react';
import { EscolhaPlataformas } from './EscolhaPlataformas';
import estilos from './personalizar.module.css';
import { CAMPO_ACESSOS_MEXEU, CAMPO_PLATAFORMAS, type EstadoAcessos } from './tipos';

/**
 * Seção "Personalizar acessos" do cadastro (S6-3, RN-27): vem marcada conforme a config da
 * agência; só manda a escolha se a agência mexeu.
 */
export function SecaoAcessosCadastro({ padrao }: { padrao: EstadoAcessos }) {
  const iniciais = padrao.plataformas.filter((p) => p.escolhida).map((p) => p.plataforma);
  const [escolhidas, setEscolhidas] = useState<string[]>(iniciais);
  const mexeu = escolhidas.join() !== iniciais.join();
  const secao = useRef<HTMLDetailsElement>(null);

  // RN-27: sem nenhuma plataforma o cadastro não sai (a seção fica aberta mostrando o alerta).
  useEffect(() => {
    const elemento = secao.current;
    const formulario = elemento?.closest('form');
    if (!elemento || !formulario || escolhidas.length > 0) return;
    const barrar = (evento: SubmitEvent) => {
      evento.preventDefault();
      evento.stopPropagation();
      elemento.open = true;
      elemento.scrollIntoView({ block: 'center' });
    };
    formulario.addEventListener('submit', barrar);
    return () => {
      formulario.removeEventListener('submit', barrar);
    };
  }, [escolhidas.length]);

  return (
    <details ref={secao} className={estilos.secao}>
      <summary>
        <span className={estilos.tituloSecao}>Personalizar acessos</span>
        <span className={estilos.resumo}>
          {padrao.plataformas
            .filter((p) => escolhidas.includes(p.plataforma))
            .map((p) => p.nome.split(' ')[0])
            .join(' · ') || 'Nenhuma'}
        </span>
      </summary>
      <EscolhaPlataformas
        opcoes={padrao.plataformas}
        escolhidas={escolhidas}
        aoMudar={setEscolhidas}
        nome={CAMPO_PLATAFORMAS}
      />
      <input type="hidden" name={CAMPO_ACESSOS_MEXEU} value={mexeu ? '1' : ''} />
    </details>
  );
}
