import { exigirSessao } from '../../../_lib/sessao';
import { Calendario } from './Calendario';
import { lerParametros, periodoVisivel } from './contas-calendario';
import { BotaoRemover } from './BotaoRemover';
import { FormularioBloqueio } from './FormularioBloqueio';
import { FormularioJanela } from './FormularioJanela';
import { compararJanelas, formatarData, formatarPeriodo, rotuloDia, rotuloTipo } from './mensagens';
import { agendaApiDoServidor } from './servidor';
import estilos from './agenda.module.css';

// A agenda muda a cada cadastro e depende do usuário logado: nunca é gerada em tempo de build.
export const dynamic = 'force-dynamic';

interface Props {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaAgenda({ searchParams }: Props) {
  const usuario = await exigirSessao();
  const api = await agendaApiDoServidor();
  // O "hoje" vem da agência (fuso dela), não do relógio do servidor ou do navegador.
  const { hoje } = await api.listarExcecoes('2000-01-01', '2000-01-01');
  const { visao, data, dia } = lerParametros(await searchParams, hoje);
  const { de, ate } = periodoVisivel(visao, data);
  const [janelas, bloqueios, feriados, { excecoes }, feriadosDoPeriodo] = await Promise.all([
    api.listarJanelas(),
    api.listarBloqueios(),
    api.listarFeriados(),
    api.listarExcecoes(de, ate),
    // O mês pode atravessar a virada do ano; os feriados da API vêm por ano.
    de.slice(0, 4) === ate.slice(0, 4)
      ? Promise.resolve([])
      : api.listarFeriados(Number(ate.slice(0, 4))),
  ]);
  const feriadosVisiveis = [...feriados, ...feriadosDoPeriodo];
  const podeEditar = usuario.papel === 'admin';

  return (
    <>
      <h1>Agenda</h1>
      <p className={estilos.ajuda}>
        Quando a agência atende reuniões e captações, e os dias sem atendimento. Os horários valem
        no fuso da agência.
        {!podeEditar && ' Só o Admin pode alterar.'}
      </p>

      <Calendario
        visao={visao}
        data={data}
        dia={dia}
        hoje={hoje}
        podeEditar={podeEditar}
        janelas={janelas}
        excecoes={excecoes}
        bloqueios={bloqueios}
        feriados={feriadosVisiveis}
      />

      <details className={estilos.secao}>
        <summary className={estilos.resumoBotao}>Horário padrão de atendimento</summary>
        <p className={estilos.ajuda}>
          Vale toda semana. Para mudar só um dia, toque nele no calendário.
        </p>
        {janelas.length === 0 ? (
          <p className={estilos.vazio}>
            Nenhum horário cadastrado. Sem eles, o cliente não vê horários para agendar.
          </p>
        ) : (
          <ul className={estilos.lista}>
            {[...janelas].sort(compararJanelas).map((janela) => {
              const descricao = `${rotuloTipo(janela.tipo)}, ${rotuloDia(janela.diaSemana)}, ${janela.horaInicio} às ${janela.horaFim}`;
              return (
                <li key={janela.id} className={estilos.item}>
                  <span>
                    <strong>{rotuloTipo(janela.tipo)}</strong> · {rotuloDia(janela.diaSemana)} ·{' '}
                    {janela.horaInicio} às {janela.horaFim}
                    {janela.duracaoMinutos !== null &&
                      ` · ${String(janela.duracaoMinutos)} min cada`}
                  </span>
                  {podeEditar && (
                    <BotaoRemover id={janela.id} alvo="janela" descricao={descricao} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {podeEditar && <FormularioJanela />}
      </details>

      <section aria-labelledby="titulo-bloqueios" className={estilos.secao}>
        <h2 id="titulo-bloqueios">Bloqueios</h2>
        <p className={estilos.ajuda}>
          Folgas, recessos e feriados estaduais ou municipais. Os feriados nacionais abaixo já são
          considerados sozinhos.
        </p>
        {bloqueios.length === 0 ? (
          <p className={estilos.vazio}>Nenhum bloqueio cadastrado.</p>
        ) : (
          <ul className={estilos.lista}>
            {bloqueios.map((bloqueio) => {
              const periodo = formatarPeriodo(bloqueio.dataInicio, bloqueio.dataFim);
              return (
                <li key={bloqueio.id} className={estilos.item}>
                  <span>
                    <strong>{periodo}</strong> · {bloqueio.motivo}
                  </span>
                  {podeEditar && (
                    <BotaoRemover
                      id={bloqueio.id}
                      alvo="bloqueio"
                      descricao={`bloqueio de ${periodo}`}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {podeEditar && <FormularioBloqueio />}
      </section>

      <section aria-labelledby="titulo-feriados" className={estilos.secao}>
        <h2 id="titulo-feriados">Feriados nacionais</h2>
        <ul className={estilos.feriados}>
          {feriados.map((feriado) => (
            <li key={feriado.data}>
              <time dateTime={feriado.data}>{formatarData(feriado.data)}</time> · {feriado.nome}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
