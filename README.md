# Estaciona Fácil — Cobranças v2

Esta versão mantém o layout e acrescenta:
- edição de dados do mensalista;
- gerenciamento de cobranças;
- recebimentos parciais (ex.: 2x ou mais);
- histórico dos recebimentos dentro de cada cobrança;
- estorno do último recebimento, mantendo auditoria;
- edição de valor e vencimento da cobrança;
- recibo do valor de cada recebimento;
- sincronização desses dados com a aba Pagamentos do Google Sheets.

## Apps Script
Substitua o `Code.gs` e publique uma nova versão do Web App. A aba `Pagamentos` agora usa 12 colunas, incluindo valor recebido e histórico em JSON. Execute `setupEstacionaFacil()` uma vez se a estrutura ainda não existir.

## GitHub Pages
Publique pelo GitHub Actions conforme a versão anterior. O ZIP contém o projeto fonte; o workflow deve executar o build do Vite.
