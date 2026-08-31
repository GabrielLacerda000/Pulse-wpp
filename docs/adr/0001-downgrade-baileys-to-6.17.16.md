# 0001. Downgrade @whiskeysockets/baileys para 6.17.16

## Status

Aceita (2026-08-25)

## Contexto

O `package.json` fixava `@whiskeysockets/baileys` em `^7.0.0-rc14` — uma release
candidate, não uma versão estável (o pacote não tem nenhuma `7.x` estável
publicada; `rc14` é a última de uma sequência só de RCs).

Sintoma observado: o QR aparecia normalmente no Pulse (renderizado com
`qrcode.vue`), nenhum erro era logado no pulse-wpp, mas escanear o QR com a
câmera do WhatsApp no celular não tinha efeito algum — nem sucesso, nem
qualquer resposta do celular chegava de volta ao socket do Baileys.

Investigação (`BaileysProvider.ts`, com `baileysLogger.level` temporariamente
em `trace`) mostrou que o backend fazia todo o handshake corretamente: sessão
limpa, `fetchLatestBaileysVersion()` retornando a versão mais recente
(`isLatest: true`), IQ `pair-device` recebido do servidor da Meta, QR gerado.
Depois disso, silêncio total — nem erro, nem fechamento de conexão, nem novo
QR — mesmo escaneando com a câmera real do celular.

Comparando a string crua devolvida por `GET /whatsapp/qr` nas duas versões:

- **`7.0.0-rc14`**: `https://wa.me/settings/linked_devices#2@<ref>,<b64>,<b64>,<b64>,<platform>`
- **`6.17.16`**: `2@<ref>,<b64>,<b64>,<b64>` (formato clássico, sem prefixo de URL)

A função `buildPairingQRData` (em
`node_modules/@whiskeysockets/baileys/lib/Utils/companion-reg-client-utils.js`)
que gera o prefixo `https://wa.me/settings/linked_devices#` existe nas duas
versões, mas só é usada no caminho principal de `connection.update.qr` na
`7.0.0-rc14`. O app do WhatsApp instalado no celular do time não reconhece
esse formato prefixado — a leitura da câmera não gera nenhum tráfego de volta
para o servidor, exatamente o silêncio observado.

Depois do downgrade para `6.17.16`, o QR voltou ao formato clássico e o
pareamento por scan funcionou.

## Decisão

Fixar `@whiskeysockets/baileys` em `^6.17.16` (última estável publicada) em
vez de `^7.0.0-rc14`.

## Consequências

- Pareamento por QR volta a funcionar com o app atual do WhatsApp.
- Ficamos presos à série `6.x` até que uma `7.x` estável (não-RC) seja
  publicada e validada manualmente com um scan real antes de qualquer futura
  atualização de major version desse pacote.
- Os 77 testes existentes (`bun test`) passam sem alteração — a API que o
  `BaileysProvider` usa (`makeWASocket`, `useMultiFileAuthState`,
  `fetchLatestBaileysVersion`, `onWhatsApp`, `sendMessage`) é compatível entre
  as duas versões.

## Como desfazer

1. Em `package.json`, trocar `"@whiskeysockets/baileys": "^6.17.16"` de volta
   para `"^7.0.0-rc14"` (ou a RC/versão desejada).
2. Rodar `bun install` para atualizar `bun.lock`.
3. Rodar `bun test` para confirmar que a suíte ainda passa.
4. **Antes de considerar revertido**: gerar um QR real (`POST /whatsapp/connect`
   → `GET /whatsapp/qr`) e confirmar visualmente se a string voltou a vir com
   o prefixo `https://wa.me/settings/linked_devices#`. Se sim, validar com um
   scan real antes de reverter em qualquer ambiente compartilhado — essa é a
   condição que causou a falha original.
