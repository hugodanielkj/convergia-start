'use client';

import { useState } from 'react';
import estilos from '../lembretes/lembretes.module.css';
import {
  SECOES,
  lerNumero,
  textoLimite,
  type CampoNumerico,
  type ConfigGeral,
  type Limites,
} from './campos';

type Textos = Partial<Record<CampoNumerico, string>>;

const CAMPOS = SECOES.flatMap((s) => s.campos.map((c) => c.campo));
const paraTextos = (c: ConfigGeral): Textos =>
  Object.fromEntries(CAMPOS.map((campo) => [campo, String(c[campo])]));

/** Configurações › Geral: nome da agência, prazos, agenda e avisos (S8-2, RN-03). */
export function FormularioGeral({
  inicial,
  limites,
  nomeMax,
}: {
  inicial: ConfigGeral;
  limites: Limites;
  nomeMax: number;
}) {
  const [nome, setNome] = useState(inicial.nomeAgencia);
  const [canal, setCanal] = useState(inicial.canalNotificacaoPadrao);
  const [textos, setTextos] = useState<Textos>(paraTextos(inicial));
  const [invalidos, setInvalidos] = useState<CampoNumerico[]>([]);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar() {
    const numeros: Partial<Record<CampoNumerico, number>> = {};
    const errados: CampoNumerico[] = [];
    for (const campo of CAMPOS) {
      const n = lerNumero(textos[campo] ?? '', limites[campo]);
      if (n === null) errados.push(campo);
      else numeros[campo] = n;
    }
    setInvalidos(errados);
    if (errados.length > 0 || nome.trim() === '') {
      setAviso({ ok: false, texto: 'Confira os campos marcados.' });
      return;
    }
    setOcupado(true);
    setAviso(null);
    const r = await fetch('/api/config/geral', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nomeAgencia: nome, canalNotificacaoPadrao: canal, ...numeros }),
    });
    setOcupado(false);
    if (!r.ok) {
      setAviso({
        ok: false,
        texto: 'Algum valor está fora do permitido. Confira e tente de novo.',
      });
      return;
    }
    const { config } = (await r.json()) as { config: ConfigGeral };
    setNome(config.nomeAgencia);
    setTextos(paraTextos(config));
    setAviso({
      ok: true,
      texto: 'Salvo. Vale daqui para frente: prazos e links que já existem não mudam.',
    });
  }

  return (
    <form
      className={estilos.pagina}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <h1>Geral</h1>

      <section className={estilos.cartao}>
        <h2>Agência</h2>
        <label className={estilos.campo}>
          Nome da agência
          <input
            value={nome}
            maxLength={nomeMax}
            required
            aria-invalid={nome.trim() === '' ? true : undefined}
            onChange={(e) => {
              setNome(e.target.value);
            }}
          />
        </label>
        <fieldset className={estilos.dias}>
          <legend>Canal padrão das mensagens</legend>
          {(['whatsapp', 'email'] as const).map((c) => (
            <label key={c} className={estilos.dia}>
              <input
                type="radio"
                name="canal"
                checked={canal === c}
                onChange={() => {
                  setCanal(c);
                }}
              />
              {c === 'whatsapp' ? 'WhatsApp' : 'E-mail'}
            </label>
          ))}
        </fieldset>
        <p className={estilos.dica}>Usado quando o cliente não escolheu um canal.</p>
      </section>

      {SECOES.map((secao) => (
        <section key={secao.titulo} className={estilos.cartao}>
          <h2>{secao.titulo}</h2>
          {secao.campos.map(({ campo, rotulo, unidade, dica }) => {
            const idDica = `dica-${campo}`;
            const invalido = invalidos.includes(campo);
            return (
              <div key={campo} className={estilos.campo}>
                <label htmlFor={campo}>
                  {rotulo} ({unidade})
                </label>
                <input
                  id={campo}
                  value={textos[campo] ?? ''}
                  inputMode="numeric"
                  aria-invalid={invalido ? true : undefined}
                  aria-describedby={idDica}
                  onChange={(e) => {
                    setTextos({ ...textos, [campo]: e.target.value });
                  }}
                />
                <p
                  id={idDica}
                  className={`${estilos.notaCampo} ${invalido ? estilos.erro : estilos.dica}`}
                >
                  {textoLimite(limites[campo], unidade)}
                  {dica ? ` ${dica}` : ''}
                </p>
              </div>
            );
          })}
        </section>
      ))}

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
