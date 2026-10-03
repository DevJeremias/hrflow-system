import crypto from 'node:crypto';

// Sem 0/O, 1/l/I: a senha provisória é lida e digitada por uma pessoa, não copiada por uma máquina.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const TAMANHO = 12;

// Aleatória, de fonte criptográfica. Passa na regra de tamanho de validarSenhaDeRegistro.
export const gerarSenhaProvisoria = (): string =>
    Array.from({ length: TAMANHO }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join('');
