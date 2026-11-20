import type { Metadata } from 'next';
import Link from 'next/link';
import estilos from './config.module.css';

export const metadata: Metadata = { title: 'Configurações · Convergia Start' };

const SECOES = [
  { href: '/config/equipe', titulo: 'Equipe', texto: 'Quem entra no sistema e com qual papel.' },
  {
    href: '/config/agenda',
    titulo: 'Agenda',
    texto: 'Horários de reunião e captação, folgas e feriados.',
  },
  { href: '/config/formulario', titulo: 'Formulário', texto: 'Perguntas que o cliente responde.' },
  { href: '/config/acessos', titulo: 'Acessos', texto: 'Identificadores da agência em cada rede.' },
  { href: '/config/templates', titulo: 'Mensagens', texto: 'Textos do WhatsApp e do e-mail.' },
  {
    href: '/config/lembretes',
    titulo: 'Lembretes',
    texto: 'Quando lembrar o cliente e em que horário enviar.',
  },
] as const;

/** Índice das configurações: no celular, uma lista de cartões grandes para tocar. */
export default function Configuracoes() {
  return (
    <>
      <h1>Configurações</h1>
      <ul className={estilos.lista}>
        {SECOES.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className={estilos.cartao}>
              <span className={estilos.titulo}>{s.titulo}</span>
              <span className={estilos.texto}>{s.texto}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
