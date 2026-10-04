// Importado antes dos módulos da API em testes sem banco: o logger lê LOG_LEVEL ao ser carregado e, sem isto, a
// saída do teste se encheria de linhas de log de falhas que o próprio teste provoca.
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
