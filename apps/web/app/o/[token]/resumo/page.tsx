import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { IconeEtapa } from '../../../_componentes/IconeEtapa';
import { fetchDoCliente } from '../../../_lib/fetch-do-cliente';
import { URL_API } from '../../../_lib/url-api';
import { descreverDataEtapa, esquemaResumo, formatarDia, ROTULO_ETAPA } from './formatar';
import estilos from './resumo.module.css';

export const metadata: Metadata = { title: 'Onboarding concluído' };

/**
 * Resumo do onboarding concluído (S7-2, RN-14): só leitura, com etapas e datas. Vale com o link
 * vencido; sem respostas do formulário nem arquivos (decisão 2026-11-14-a-resumo-concluido).
 */
export default async function PaginaResumo({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const caminho = `/o/${encodeURIComponent(token)}`;
  const resposta = await fetchDoCliente(
    `${URL_API}/publico/onboardings/${encodeURIComponent(token)}/resumo`,
    { cache: 'no-store' },
  );
  if (resposta.status === 404) notFound();
  // Ainda não concluído: o cliente continua pelas etapas.
  if (resposta.status === 409) redirect(caminho);
  if (!resposta.ok) throw new Error(`API respondeu ${String(resposta.status)} no resumo`);
  const resumo = esquemaResumo.parse(await resposta.json());

  return (
    <main className={estilos.pagina}>
      <p className={estilos.selo}>Onboarding concluído</p>
      <h1>Tudo pronto, {resumo.empresa}!</h1>
      {resumo.concluidoEm && (
        <p className={estilos.subtitulo}>
          Encerrado em {formatarDia(resumo.concluidoEm, resumo.fuso)}.
        </p>
      )}

      {resumo.primeiroConteudoEm && (
        <section className={estilos.destaque} aria-label="Primeiro conteúdo">
          <span className={estilos.destaqueRotulo}>Primeiro conteúdo entregue</span>
          <strong>{formatarDia(resumo.primeiroConteudoEm, resumo.fuso)}</strong>
        </section>
      )}

      <h2 className={estilos.tituloLista}>O que você fez</h2>
      <ol className={estilos.etapas}>
        {resumo.etapas.map(({ etapa, em }, i) => (
          <li key={etapa} className={estilos.etapa}>
            <IconeEtapa estado="concluida" numero={i + 1} rotulo={ROTULO_ETAPA[etapa]} decorativo />
            <div>
              <span className={estilos.nome}>{ROTULO_ETAPA[etapa]}</span>
              <span className={estilos.data}>{descreverDataEtapa(etapa, em, resumo.fuso)}</span>
            </div>
          </li>
        ))}
      </ol>

      <p className={estilos.nota}>
        Esta página é só para consulta. Para qualquer ajuste, fale com a agência.
      </p>
    </main>
  );
}
