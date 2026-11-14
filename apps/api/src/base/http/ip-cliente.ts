import { BlockList, isIPv4, isIPv6 } from 'node:net';
import type { FastifyRequest } from 'fastify';

const redePrivada = new BlockList();
redePrivada.addSubnet('127.0.0.0', 8, 'ipv4');
redePrivada.addSubnet('10.0.0.0', 8, 'ipv4');
redePrivada.addSubnet('172.16.0.0', 12, 'ipv4');
redePrivada.addSubnet('192.168.0.0', 16, 'ipv4');
redePrivada.addSubnet('169.254.0.0', 16, 'ipv4');
redePrivada.addAddress('::1', 'ipv6');
redePrivada.addSubnet('fc00::', 7, 'ipv6');
redePrivada.addSubnet('fe80::', 10, 'ipv6');

const IPV4_MAPEADO = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

/** Endereço de loopback ou de rede privada (IPv4, IPv6 e IPv4 mapeado em IPv6). */
export function ehEnderecoPrivado(endereco: string | undefined): boolean {
  if (!endereco) return false;
  const ip = IPV4_MAPEADO.exec(endereco)?.[1] ?? endereco;
  if (isIPv4(ip)) return redePrivada.check(ip, 'ipv4');
  if (isIPv6(ip)) return redePrivada.check(ip, 'ipv6');
  return false;
}

/**
 * Chamada feita de dentro da rede (ex.: a web renderizando no servidor) sem dizer de qual cliente
 * veio. Não tem IP de cliente para limitar; só conta por token (decisão 2026-11-14-a).
 */
export function ehChamadaInterna(request: FastifyRequest): boolean {
  return (
    request.headers['x-forwarded-for'] === undefined &&
    ehEnderecoPrivado(request.socket.remoteAddress)
  );
}
