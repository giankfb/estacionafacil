# Estaciona Fácil — versão com controle de mensalidades

## O que mudou
- Removida a aba separada **Veículos**. O cadastro permanente agora fica em **Mensalistas**; veículos rotativos são registrados pela placa no PDV.
- Em **Mensalistas**, é possível gerar cobranças por mês de referência para os mensalistas cadastrados, definir vencimento e impedir duplicidade para a mesma placa/cliente e mês.
- Cada cobrança fica **Pendente** até o operador registrar o recebimento. O registro inclui data e forma de pagamento (Pix, Dinheiro ou Cartão).
- **Relatórios** mostram separadamente arrecadação de rotativos/diárias, mensalidades recebidas e mensalidades pendentes. Os valores pendentes não entram no total recebido.
- Relatório filtrável por mês e forma de pagamento, com exportação CSV e impressão do navegador (escolha “Salvar como PDF”).
- Nome e telefone do mensalista passaram a ser opcionais; a placa continua obrigatória.

## Executar localmente
1. Instale Node.js LTS.
2. Execute `npm install` na pasta do projeto.
3. Execute `npm run dev` e abra o endereço informado pelo Vite.

No Windows, o arquivo `iniciar-estaciona-facil.bat` também pode iniciar o ambiente após a instalação das dependências.

## Importante sobre armazenamento
Esta versão de interface ainda usa `localStorage` neste navegador. Os novos registros de mensalidades **não são sincronizados automaticamente com o Google Sheets** ainda. O arquivo `backend/Code.gs` foi atualizado para criar a aba `Mensalidades` e incluir esses registros no formato de estado da API, como preparação para a próxima etapa de integração. Não use o armazenamento local como única cópia dos dados reais.

## Atualizar o Apps Script
1. Faça uma cópia de segurança da planilha.
2. No editor do Apps Script vinculado à planilha, atualize o código usando `backend/Code.gs`, preservando a sua chave `APP_TOKEN` atual (não a compartilhe).
3. Execute `setupEstacionaFacil()` para criar a nova aba `Mensalidades` sem apagar as abas existentes.
4. Atualize a implantação do Web App para uma nova versão.

**Segurança:** antes de usar dados pessoais reais, proteja a leitura da API. Uma chave incluída no JavaScript do navegador não é segredo e não deve ser considerada autenticação forte.
