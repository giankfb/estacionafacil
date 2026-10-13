# Estaciona Fácil — protótipo inicial

## Como abrir no Windows
1. Extraia **todo** o arquivo ZIP para uma pasta do computador.
2. Instale o Node.js LTS se ainda não estiver instalado: https://nodejs.org/
3. Dentro da pasta extraída, dê dois cliques em `iniciar-estaciona-facil.bat`.
4. Na primeira execução, o inicializador instala as dependências (é necessário ter internet).
5. Quando aparecer um endereço como `http://localhost:5173/`, abra esse endereço no navegador.
6. Mantenha a janela preta aberta enquanto usar o sistema. Para encerrar, pressione `Ctrl+C` nela.

**Importante:** não abra `index.html` com dois cliques. O projeto usa React + Vite e precisa ser iniciado pelo arquivo `.bat` ou pelos comandos abaixo.

## Iniciar manualmente
Abra um terminal nesta pasta e execute:
```bash
npm install
npm run dev
```

## O que está prototipado
- PDV com entrada por placa e lista de veículos no pátio.
- Rotativo a R$ 6,00/hora, proporcional por minuto.
- Diária de R$ 40,00 no período das 08h às 18h.
- Mensalista garagem: R$ 400,00/mês.
- Mensalista horário comercial: R$ 200,00/mês, com janela de 08h às 18h.
- Desconto, formas de pagamento, histórico e relatório básico com exportação CSV.
- Configurações com senha demonstrativa inicial `1234`.

## Limitações importantes
Esta é uma versão de protótipo que salva dados no `localStorage` do navegador. Os dados não são compartilhados entre computadores e podem ser perdidos se os dados do navegador forem apagados. A senha também é apenas demonstrativa, não é proteção adequada para produção. Antes do uso real, conectar ao Google Apps Script + Google Sheets, proteger as configurações no servidor, implementar controle de caixa e validar todas as regras operacionais.

## Regras iniciais
- Rotativo: R$ 6,00/hora, proporcional por minuto.
- Diária: R$ 40,00, período de operação das 08h às 18h.
- Mensalista garagem: R$ 400,00/mês; o protótipo considera acesso integral.
- Mensalista comercial: R$ 200,00/mês; o protótipo considera acesso das 08h às 18h.


## Integração Google Sheets — versão evoluída

O app agora pode ler e gravar automaticamente o estado na planilha via Google Apps Script, sem alterar o layout visual do aplicativo.

1. Abra a planilha que será usada pelo sistema.
2. Em **Extensões → Apps Script**, cole o conteúdo de `Code.gs`.
3. Execute `setupEstacionaFacil()` uma vez.
4. Defina `APP_TOKEN` no `Code.gs` com uma chave exclusiva.
5. Publique como **Web app**, permitindo acesso conforme a política da sua conta.
6. Abra o app e entre em **Configurações → Integração com Google Sheets**.
7. Informe a URL do Web App e o mesmo token.
8. Use **Carregar da planilha** para testar a leitura e **Salvar na planilha** para testar a gravação.

### O que foi testado nesta versão

- Build do React/Vite.
- Persistência local continua funcionando.
- Leitura inicial da planilha quando a integração está configurada.
- Gravação automática após alterações, com debounce.
- Botões manuais de carregar/salvar.
- Falha de conexão não bloqueia a operação local.
- `Code.gs` mantém as abas e cabeçalhos existentes e usa `clearContents()`, preservando a formatação da planilha.

> Observação: a gravação real em uma planilha Google exige publicar o `Code.gs` no Google Apps Script. O ambiente deste pacote não consegue autenticar nem executar a sua planilha Google diretamente.
