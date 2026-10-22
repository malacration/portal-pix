# Contrato de contas a receber

A tela `/contas-receber` utiliza o `host` do sistema escolhido em `sistemas`.
São apresentados sistemas com uma operação `tipoTransacao: "CONTAS_RECEBER"`.
O dealerlenium implementa o contrato abaixo. Outros backends devem implementar
o mesmo contrato para disponibilizar títulos nesta tela.
A tela não usa transações Pix como substituto para os títulos do ERP.

## Consulta

`GET /api/contas-receber`

Parâmetros: `pagina` (base zero), `tamanho` (20, 50 ou 100), `busca`
(cliente, CPF/CNPJ ou documento), `empresaId`, `situacao`, `vencimentoDe`
e `vencimentoAte` (datas ISO inclusivas). Filtros vazios são omitidos.
`situacao` aceita `ABERTO`, `PARCIAL`, `PAGO`, `CANCELADO`; omitida significa todas.
`ABERTO` inclui títulos abertos e parcialmente recebidos com saldo positivo.
Na UI, essa opção aparece como "Saldo em aberto", sem filtro separado de parcial.
A filial utiliza o mesmo seletor do adiantamento, alimentado por `GET /branch`
no host do sistema selecionado (`[{ "id": "AUTOVEMA_PVH", "label": "Autovema Porto Velho" }]`).
O frontend envia `id` em `empresaId`; o backend resolve `codigo-dealer` no cadastro.
Uma única filial é selecionada automaticamente. Se houver várias, o usuário
precisa escolher uma antes de consultar. Trocar o sistema recarrega as opções.
No dealerlenium, sem `clienteId`, uma filial e as duas datas são obrigatórias,
com intervalo máximo de 30 dias inclusivos.
Com `clienteId`, o intervalo pode ser maior e `empresaId` pode ser omitido para
consultar todas as filiais autorizadas, sempre restringindo ao cliente exato.
Com cliente, as datas também podem ser omitidas para consultar sem limite de
período; se forem informadas, devem ser válidas e estar em ordem.
A UI preenche hoje até hoje + 29 dias por padrão. Limpar filtros remove o
cliente e seu texto, restaura esse período e a filial única, se houver, sem
consultar o backend. Consultas pendentes e resultados anteriores são descartados.
O parâmetro opcional `clienteId` restringe a consulta ao código exato do cliente
selecionado. O backend envia `Titulo_PessoaCod` ao SOAP e também verifica o
código no retorno. Não é uma busca por prefixo (selecionar `4` não inclui `40`).
Ordenação estável sugerida: vencimento, empresaId, tituloId.

```json
{
  "itens": [
    {
      "tituloId": "1868431",
      "empresaId": "1",
      "empresaNome": "Filial exemplo",
      "documento": "10989",
      "parcela": "1",
      "clienteId": "160614",
      "clienteNome": "Cliente exemplo",
      "clienteDocumento": null,
      "emissao": "2026-09-03",
      "vencimento": "2026-09-30",
      "valorOriginal": 1001.00,
      "saldoAberto": 501.00,
      "situacao": "PARCIAL",
      "podeGerarPix": true
    }
  ],
  "total": 1
}
```

`total` é a quantidade de títulos de todas as páginas após aplicar os filtros.
O frontend envia `todos=true` para receber todos os itens desta seleção em uma
única resposta e usar paginação local na tabela. Trocar página ou quantidade
por página não dispara outra requisição. Buscar ou atualizar refaz a consulta.
Sem `todos=true`, a API mantém `pagina`/`tamanho` para outros consumidores.
IDs são strings opacas; valores são números em reais. A identidade do título
é composta pelo sistema selecionado, empresaId e tituloId.
O backend deve normalizar os estados do ERP e verificar a disponibilidade real
dos campos no SOAP. Não inferir saldo a partir do valor original.

## Buscar e selecionar cliente

O componente novo `shared/customer-picker` usa exclusivamente a API nova
`GET /api/contas-receber/clientes` no host selecionado. Não utiliza os serviços
de demonstração de clientes, o seletor anterior ou a automação de navegador.

`busca` deve conter um CPF completo (11 dígitos) ou CNPJ completo (14 dígitos),
com ou sem pontuação. Nome, código, documento incompleto ou vazio retornam HTTP 400.
Parâmetros opcionais: `pagina` (base zero), `tamanho` (20/50/100), `todos` e `empresaId`.
A filial informada é validada pelas permissões; sem filial, usa a primeira permitida
como contexto de autorização. O SOAP `CONSULTAPESSOA` é global e recebe somente
`Usuario`, `Senha` e `Pessoa_documento`, sem filial, datas ou vencimento.
Não consulta `TITULO` nem depende de títulos existentes para encontrar a pessoa.
O resultado preserva o contrato `{ itens: [{ id, nome, documento }], total }`.
`Pessoa não encontrada` resulta em lista vazia; falhas do WS são propagadas como erro.
O componente envia `todos=true` e pagina localmente os resultados.

O formulário também oferece o modo **ID do cliente**, para operadores que conhecem
o código exato. O ID deve ser um inteiro positivo até 2147483647. O campo permanece
editável, sem confirmação: "Consultar" ou Enter lista títulos por `clienteId`
diretamente em `/api/contas-receber`, sem consultar o cadastro de pessoas.
Digitar não dispara chamadas ao backend. Filial e datas tornam-se opcionais com
um ID válido; datas automáticas são removidas e datas editadas são preservadas.
Apagar o ID restaura as datas removidas. Trocar o modo remove a seleção anterior,
e limpar filtros ou trocar sistema também remove o ID digitado.

Ao selecionar, o frontend preenche `clienteId`. A seleção é preservada ao mudar
filial ou período, permitindo consultar todas as filiais e períodos maiores.
Ao mudar o sistema ou limpar os filtros, ela é removida. Requisições pendentes
do seletor são descartadas quando o sistema muda ou os filtros são limpos.
A seleção é opcional: sem cliente escolhido, os demais filtros continuam valendo.
O campo de CPF/CNPJ fica disponível antes do modal. Digitar não consulta
a API; Enter ou "Buscar cliente" abre o modal com a busca já preenchida.
Depois da resposta, o primeiro cliente recebe foco. As setas permitem navegar
pelos resultados e outro Enter confirma o cliente em foco.
O modal fecha pelo X, Esc ou clique fora. Fechar sem selecionar cancela a
consulta pendente, sem alterar o cliente selecionado ou consultar títulos.
Com cliente selecionado, o campo fica somente para leitura: o botão de busca
é substituído por "Limpar seleção". Limpar libera novamente a edição e a busca.
Ao selecionar um cliente, datas ainda automáticas são removidas. Datas editadas
pelo usuário são preservadas. Ao remover o cliente, as datas removidas são
restauradas. As alterações de seleção não disparam a consulta de títulos.

## Gerar cobrança

`POST /api/contas-receber/{tituloId}/pix`

```json
{ "empresaId": "1" }
```

Retorna `PixGenerationResponse`, definido em `src/app/pages/service/pix.service.ts`.
A tela reutiliza a apresentação e o compartilhamento do QR Code existentes.
O backend deve revalidar autorização, saldo e situação do título, resolver a
conta recebedora e reutilizar uma cobrança válida quando apropriado. O frontend
não envia valor para geração. O endpoint é um contrato novo; não redirecionar
automaticamente para rotas antigas que identifiquem o título apenas pelo número.

A ação fica indisponível se `podeGerarPix` for falso, o saldo for zero ou a
situação não for `ABERTO`/`PARCIAL`. Gerar Pix não significa quitar o título.
A baixa deve ocorrer no backend após confirmação do pagamento.

Respostas 404/501 na consulta exibem indisponibilidade da integração.
Outras falhas exibem o erro retornado ou uma mensagem de nova tentativa.
Não existem dados simulados ou baixa de títulos nesta entrega. Consulte
`../../dealerlenium/docs/contas-receber.md` para configurar o Web Service e os
códigos das filiais. No dealerlenium, `empresaId` usa a chave da filial
configurada (por exemplo, `AUTOVEMA_PVH`), e `clienteDocumento` pode ser nulo
porque a seleção SOAP não inclui o CPF/CNPJ.

## Validação do frontend

`npm run build` valida a compilação de produção e os templates.
Os testes HTTP podem ser executados com:

```sh
npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/pages/service/receivables.service.spec.ts --styles=src/assets/demo/demo.scss
```

O override de estilos evita um problema existente no runner Karma: ele não
resolve o alias Sass `@/assets/layout/layout.scss` dos estilos globais. Os testes
verificam as requisições HTTP e não dependem desses estilos.

## Filtros de lançamento, documento e parcela

A listagem oferece três filtros opcionais e exatos: `lancamento` (código interno
exibido na coluna Lançamento), `documento` (número exibido antes do hífen em
Documento/parcela) e `parcela`. Podem ser combinados, aceitam inteiros positivos
até 2147483647 e são removidos por Limpar filtros. A busca livre continua disponível.
O backend Dealer envia `Titulo_Codigo`, `Titulo_Numero` e `Titulo_Parcela` ao SOAP
e confere os mesmos valores no retorno. As regras de filial e período continuam
valendo: esses filtros não substituem a seleção de cliente.
