// Máscaras dos campos numéricos do cadastro: pontuam enquanto se digita, sem pontuação sobrando no fim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mascaraCep, mascaraCnpj, mascaraCpf, mascaraPis, somenteDigitos } from '../src/utils/mascaras.ts';

test('CPF ganha pontos e traço conforme os dígitos chegam', () => {
  const passos: [string, string][] = [
    ['', ''], ['5', '5'], ['529', '529'], ['5299', '529.9'], ['529982', '529.982'], ['5299822', '529.982.2'],
    ['529982247', '529.982.247'], ['5299822472', '529.982.247-2'], ['52998224725', '529.982.247-25'],
  ];
  for (const [digitado, esperado] of passos) assert.equal(mascaraCpf(digitado), esperado, digitado);
});

test('a máscara descarta o que não é dígito, o que passa do tamanho e refaz uma pontuação colada', () => {
  assert.equal(mascaraCpf('529.982.247-25'), '529.982.247-25');
  assert.equal(mascaraCpf('abc529x982y247z25'), '529.982.247-25');
  assert.equal(mascaraCpf('529982247259999'), '529.982.247-25');
  assert.equal(mascaraCpf('529.'), '529');
});

test('CNPJ, CEP e PIS seguem o molde de cada um', () => {
  assert.equal(mascaraCnpj('11222333000181'), '11.222.333/0001-81');
  assert.equal(mascaraCnpj('112223'), '11.222.3');
  assert.equal(mascaraCep('66000000'), '66000-000');
  assert.equal(mascaraCep('66000'), '66000');
  assert.equal(mascaraPis('12012345672'), '120.12345.67-2');
});

test('somenteDigitos devolve o que a API grava', () => {
  assert.equal(somenteDigitos('529.982.247-25'), '52998224725');
  assert.equal(somenteDigitos('sem número'), '');
});
