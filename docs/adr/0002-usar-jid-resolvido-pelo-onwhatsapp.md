# 0002. Usar o JID devolvido por `onWhatsApp()` em vez de reconstruí-lo do telefone bruto

## Status

Aceita (2026-08-31)

## Contexto

Sintoma relatado: para um lead com número brasileiro correto, com o 9º
dígito móvel (ex.: `55` + DDD + `9` + 8 dígitos), o envio retornava
`success: true`, mas a mensagem nunca chegava ao WhatsApp do lead. Removendo
manualmente o "9" extra do número (número de 8 dígitos), o envio funcionava
de verdade.

Esse é o problema clássico de ambiguidade do 9º dígito no Brasil: em alguns
cadastros, a conta do WhatsApp está associada, do lado do servidor, à
variante de 8 dígitos do número, mesmo quando o número "correto"/informado
tem 9. `sock.onWhatsApp()` do Baileys já consulta o servidor do WhatsApp e
devolve, por resultado, o `jid` canônico da conta — que pode ter uma
contagem de dígitos diferente da string enviada na consulta.

Em `BaileysProvider.sendMessage()` (`src/whatsapp/providers/BaileysProvider.ts`),
o código já chamava `onWhatsApp(phone)` e conferia `results[].exists` antes
de enviar — um guard deliberado, documentado no próprio código, contra o
comportamento do Baileys de aceitar o envio e devolver um `messageId` mesmo
quando `phone` não corresponde a nenhuma conta real. Mas depois de confirmar
a existência, o envio reconstruía o JID a partir do `phone` bruto original
via `toJid(phone)`, em vez de usar o `jid` que `onWhatsApp()` já havia
resolvido. Quando esse `jid` tem uma contagem de dígitos diferente da
recebida (o caso do 9º dígito), o envio final mirava num JID sem device
real por trás — o Baileys aceita e devolve `messageId` normalmente
(`success: true`), mas nada é entregue. Exatamente o sintoma relatado.

Não existe no repositório nenhuma normalização de número específica do
Brasil (`src/whatsapp/phone.ts` é só uma checagem de formato/tamanho,
`/^\d{10,15}$/`, sem lógica de país/DDD/9º dígito) — a normalização de dado
de lead fica a cargo do Pulse.

## Decisão

Em `BaileysProvider.sendMessage()`, usar o `jid` devolvido pelo resultado
"existe" de `onWhatsApp()` para o `sock.sendMessage(...)`, em vez de
reconstruir o JID a partir do `phone` de entrada:

```ts
const results = await this.socket.onWhatsApp(phone);
const match = results?.find((result) => result.exists);
if (results && !match) {
  return { success: false, error: "Phone number is not registered on WhatsApp." };
}

const sent = await this.socket.sendMessage(match?.jid ?? toJid(phone), {
  text: message,
});
```

Não foi adicionada nenhuma lógica de fallback client-side para tentar as
variantes de 8/9 dígitos manualmente — o WhatsApp já resolve isso do lado
do servidor via `onWhatsApp()`; o bug era simplesmente descartar esse dado.
`toJid(phone)` continua existindo como fallback só para o caso em que
`onWhatsApp()` não retorna array de resultados.

## Consequências

- Números brasileiros afetados pela ambiguidade do 9º dígito agora entregam
  a mensagem de fato, usando o JID que o WhatsApp identifica como a conta
  real, independentemente de quantos dígitos vieram do Pulse.
- Nenhuma normalização de número precisou ser adicionada ao pulse-wpp;
  `phone.ts` continua sendo só uma checagem de formato.
- Teste novo em `BaileysProvider.test.ts` ("sends to the JID onWhatsApp
  resolves, not one rebuilt from the input phone") cobre o cenário em que
  `onWhatsApp` devolve um `jid` com contagem de dígitos diferente do
  `phone` de entrada, e confirma que `sock.sendMessage` é chamado com esse
  `jid`, não com `toJid(phone)`. Os 15 testes do provider passam.

## Como desfazer

1. Em `src/whatsapp/providers/BaileysProvider.ts`, trocar
   `match?.jid ?? toJid(phone)` de volta para `toJid(phone)` em
   `sendMessage()`.
2. Remover (ou adaptar) o teste "sends to the JID onWhatsApp resolves, not
   one rebuilt from the input phone" em `BaileysProvider.test.ts`.
3. Rodar `bun test` para confirmar que a suíte ainda passa.

## Addendum (2026-09-02): a premissa de "sem fallback client-side" não se sustentou

Numa campanha real, 4 leads brasileiros cadastrados sem o 9º dígito (formato
antigo de 8 dígitos locais) falharam com
`"Phone number is not registered on WhatsApp."`, mesmo com contas WhatsApp
ativas confirmadas por fora. Ou seja: ao contrário do que esta ADR assumia,
`onWhatsApp()` consultado só com a string de 8 dígitos **nem sempre** resolve
a ambiguidade do 9º dígito do lado do servidor — às vezes simplesmente não
acha nenhum resultado, em vez de devolver o `jid` da variante de 9 dígitos.

Isso é um caso diferente do bug original desta ADR (lá `onWhatsApp()` achava
um resultado, só com `jid` de contagem de dígitos diferente; aqui ele não
acha resultado nenhum para a consulta de 8 dígitos).

Foi adicionado um fallback client-side restrito em
`BaileysProvider.sendMessage()`: quando `onWhatsApp(phone)` não encontra
nada e `phone` bate no padrão BR de 12 dígitos sem o 9
(`55` + DDD + 8 dígitos locais), o código tenta de novo com o 9 inserido
(`withBrazilianNinthDigit()`) antes de reportar falha. Só cobre essa direção
(faltando o 9); não tenta remover um 9 "sobrando" nem lida com outros
países. Testes novos em `BaileysProvider.test.ts` cobrem o retry
bem-sucedido e o caso de controle em que nenhuma das duas variantes existe.
