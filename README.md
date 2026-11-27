# Hinário Digital – Contralto

Aplicativo web (PWA) para abrir a partitura do hinário digitando o número do hino (1 a 480).

## Como funciona
1. Publique esta pasta em uma hospedagem HTTPS (por exemplo, GitHub Pages).
2. Em cada celular, abra o endereço no Chrome e escolha **Instalar app / Adicionar à tela inicial**.
3. Na primeira vez, toque em **Escolher o PDF do hinário** e selecione o seu arquivo. Ele é guardado só naquele aparelho (não é enviado a lugar nenhum), e depois o app funciona sem internet.
4. Digite o número (ou parte do título) e toque em **Abrir**.

Recursos: busca por número ou título, partitura com zoom (botões ou pinça), hino anterior/seguinte, favoritos, recentes e atalho para o índice alfabético do hinário.

## Direitos autorais (importante)
A página 3 do PDF informa: "Todos os direitos reservados", "Proibida a reprodução total ou parcial" e que é "terminantemente vedada a distribuição ou comercialização fora dos recintos da Congregação Cristã no Brasil".
Por isso este projeto **não inclui o PDF nem imagens das páginas**: só o programa e um índice (número, título e página). Cada pessoa carrega a sua própria cópia. **Não coloque o PDF no repositório nem na hospedagem.** Antes de divulgar o link para outras pessoas, confirme com a responsável pelo material se o uso entre as organistas está autorizado.

## Índice dos hinos (hinos.js)
Cada linha é `[número, título, página do PDF onde o hino começa, posição na página]`. Os títulos foram lidos automaticamente das páginas e podem ter algum acento errado: basta editar o texto no `hinos.js`. A posição na página é a altura onde o hino começa (0 = topo); quando o hino começa no meio da página, o app corta o trecho anterior e mostra o botão "Mostrar o início da página".
O índice foi feito para o PDF de 534 páginas (hinos nas páginas 8 a 519; índice alfabético a partir da 520). Se você usar outra versão do PDF, os números de página precisarão ser refeitos.

## Arquivos
`index.html`, `style.css`, `app.js`, `hinos.js`, `manifest.webmanifest`, `service-worker.js`, ícones e o leitor de PDF `pdf.min.mjs` / `pdf.worker.min.mjs` (PDF.js, licença Apache 2.0 em `LICENSE-pdfjs.txt`).
Ao mudar qualquer arquivo depois de publicado, aumente o número da versão em `service-worker.js` (`hinario-v1` → `hinario-v2`) para os celulares atualizarem.
