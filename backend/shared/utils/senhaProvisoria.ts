// A senha provisória que quem gere uma conta (o RH, para colaboradores; o Administrador, para RH e
// Administradores) entrega à pessoa. Aleatória, de fonte criptográfica; passa na regra de tamanho de
// validarSenhaDeRegistro.
import crypto from 'node:crypto';

// Sem 0/O, 1/l/I e demais pares que se confundem quando a senha é lida em voz alta ou digitada.
const ALFABETO = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TAMANHO_DA_SENHA_PROVISORIA = 12;

export const gerarSenhaProvisoria = (): string =>
    Array.from({ length: TAMANHO_DA_SENHA_PROVISORIA }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join('');
