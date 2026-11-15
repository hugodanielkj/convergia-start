'use client';

import { useState } from 'react';
import { ORDEM_DA_SEMANA, rotuloDia } from '../agenda/mensagens';
import estilos from './lembretes.module.css';
import { escreverLista, lerLista, mensagemDoMotivo, type ConfigLembretes } from './mensagens';

/** Configurações › Lembretes (RN-56, RN-57, RN-59). Só o Admin chega aqui. */
export function FormularioLembretes({ inicial }: { inicial: ConfigLembretes }) {
  const [dias, setDias] = useState(escreverLista(inicial.lembretesPendenciaDias));
  const [maximo, setMaximo] = useState(String(inicial.maxLembretesPendencia));
  const [horas, setHoras] = useState(escreverLista(inicial.lembretesCompromissoHoras));
  const [inicio, setInicio] = useState(inicial.janelaEnvioInicio);
  const [fim, setFim] = useState(inicial.janelaEnvioFim);
  const [diasEnvio, setDiasEnvio] = useState<number[]>(inicial.diasEnvioPermitidos);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function alternarDia(dia: number) {
    setDiasEnvio((atual) =>
      atual.includes(dia) ? atual.filter((d) => d !== dia) : [...atual, dia],
    );
  }

  async function salvar() {
    const listaDias = lerLista(dias);
    const listaHoras = lerLista(horas);
    if (!listaDias || !listaHoras || !/^\d+$/.test(maximo)) {
      setAviso({ ok: false, texto: 'Use só números inteiros, separados por vírgula.' });
      return;
    }
    setOcupado(true);
    setAviso(null);
    const r = await fetch('/api/config/lembretes', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lembretesPendenciaDias: listaDias,
        maxLembretesPendencia: Number(maximo),
        lembretesCompromissoHoras: listaHoras,
        janelaEnvioInicio: inicio,
        janelaEnvioFim: fim,
        diasEnvioPermitidos: diasEnvio,
      }),
    });
    setOcupado(false);
    if (r.status === 422) {
      const { motivo } = (await r.json()) as { motivo: string };
      setAviso({ ok: false, texto: mensagemDoMotivo(motivo) });
      return;
    }
    if (!r.ok) {
      setAviso({ ok: false, texto: 'Algum valor está fora do permitido.' });
      return;
    }
    const { config } = (await r.json()) as { config: ConfigLembretes };
    setDias(escreverLista(config.lembretesPendenciaDias));
    setHoras(escreverLista(config.lembretesCompromissoHoras));
    setAviso({ ok: true, texto: 'Salvo. Os próximos lembretes já seguem estes valores.' });
  }

  return (
    <form
      className={estilos.pagina}
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <h1>Lembretes</h1>

      <section className={estilos.cartao}>
        <h2>Pendências</h2>
        <p className={estilos.dica}>
          Quando o cliente ainda não concluiu as etapas. Os dias contam a partir do envio do
          convite.
        </p>
        <label className={estilos.campo}>
          Dias depois do convite
          <input
            value={dias}
            inputMode="numeric"
            aria-describedby="dica-dias"
            onChange={(e) => {
              setDias(e.target.value);
            }}
          />
        </label>
        <p id="dica-dias" className={estilos.dica}>
          Ex.: 1, 3, 5
        </p>
        <label className={estilos.campo}>
          Máximo de lembretes
          <input
            value={maximo}
            inputMode="numeric"
            onChange={(e) => {
              setMaximo(e.target.value);
            }}
          />
        </label>
        <p className={estilos.dica}>Depois do último, só a agência é avisada.</p>
      </section>

      <section className={estilos.cartao}>
        <h2>Compromissos</h2>
        <label className={estilos.campo}>
          Horas antes da reunião e da captação
          <input
            value={horas}
            inputMode="numeric"
            aria-describedby="dica-horas"
            onChange={(e) => {
              setHoras(e.target.value);
            }}
          />
        </label>
        <p id="dica-horas" className={estilos.dica}>
          Ex.: 24, 2. Se cair fora do horário de envio, o lembrete sai antes.
        </p>
      </section>

      <section className={estilos.cartao}>
        <h2>Horário de envio</h2>
        <p className={estilos.dica}>
          Convite, lembretes e reenvios só saem neste horário. Confirmações saem na hora.
        </p>
        <div className={estilos.linha}>
          <label className={estilos.campo}>
            Das
            <input
              type="time"
              value={inicio}
              required
              onChange={(e) => {
                setInicio(e.target.value);
              }}
            />
          </label>
          <label className={estilos.campo}>
            Às
            <input
              type="time"
              value={fim}
              required
              onChange={(e) => {
                setFim(e.target.value);
              }}
            />
          </label>
        </div>
        <fieldset className={estilos.dias}>
          <legend>Dias</legend>
          {ORDEM_DA_SEMANA.map((dia) => (
            <label key={dia} className={estilos.dia}>
              <input
                type="checkbox"
                checked={diasEnvio.includes(dia)}
                onChange={() => {
                  alternarDia(dia);
                }}
              />
              {rotuloDia(dia)}
            </label>
          ))}
        </fieldset>
      </section>

      {aviso && (
        <p className={aviso.ok ? estilos.ok : estilos.erro} role="status">
          {aviso.texto}
        </p>
      )}
      <button type="submit" className={estilos.salvar} disabled={ocupado}>
        {ocupado ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  );
}
