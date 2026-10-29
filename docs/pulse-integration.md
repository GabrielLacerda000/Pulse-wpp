# Integração Pulse → Pulse WPP

Guia de referência para quem for implementar, no **Pulse**, o consumo da API do
**Pulse WPP** (o gateway de WhatsApp). Cobre o que já funciona hoje, como
autenticar, quais endpoints existem, os códigos de erro estáveis e o
comportamento de resiliência que o Pulse precisa saber lidar.

> Fonte de verdade completa: `docs/PRD.md` neste repositório (`pulse-wpp`).
> Este documento é um recorte prático, do ponto de vista de quem consome a API.

---

## 1. O que funciona hoje

Implementado e testado (80 testes automatizados, `bun test`):

- Health check público.
- Autenticação por API Key em todas as demais rotas.
- Ciclo completo de conexão do WhatsApp: gerar QR, conectar, status, desconectar.
- Envio de mensagem de texto simples.
- **Resiliência**: reconexão automática após queda transitória (sem pedir QR
  de novo), distinção entre "caiu a conexão" e "logout real" (sessão
  encerrada no celular), e o servidor HTTP nunca cai por falha do WhatsApp —
  toda falha vira uma resposta JSON com código estável.

**Ainda não implementado neste repo** (é responsabilidade do Pulse, por
design — ver `docs/code-guidelines.md` §25): fila de mensagens, intervalo entre
envios, campanhas, controle de concorrência, histórico de mensagens,
variáveis de mensagem, seleção de contatos. O `pulse-wpp` é só o gateway —
"WhatsApp, Connection, Message, Provider", nada de lógica de negócio.

---

## 2. O que o Pulse precisa para consumir

### 2.1 Base URL e autenticação

Toda rota (exceto `/health`) exige:

```http
Authorization: Bearer <PULSE_WPP_API_KEY>
```

A chave é a mesma configurada na variável de ambiente `PULSE_WPP_API_KEY`
(alias aceito: `PULSE_API_KEY`) do lado do `pulse-wpp`. Sem ela, ou com valor
errado, toda requisição retorna:

```http
401 Unauthorized
```

```json
{
  "success": false,
  "error": { "code": "UNAUTHORIZED", "message": "Missing or invalid API key." }
}
```

### 2.2 Content-Type

Rotas com corpo (`POST /messages`) esperam `Content-Type: application/json`.

### 2.3 Formato de resposta

- Sucesso: o corpo é o payload da própria operação (não tem envelope
  `success`/`data` — ver seção 3).
- Erro: **sempre** o mesmo formato, e o Pulse deve depender de `error.code`,
  nunca do texto de `error.message` (que pode mudar):

```json
{
  "success": false,
  "error": {
    "code": "WHATSAPP_NOT_CONNECTED",
    "message": "WhatsApp is not connected."
  }
}
```

---

## 3. Endpoints

| Método | Rota                  | Auth | Descrição                                   |
|--------|-----------------------|------|----------------------------------------------|
| GET    | `/health`              | não  | Verifica se o serviço está no ar.            |
| GET    | `/whatsapp/status`     | sim  | Status atual da conexão.                     |
| GET    | `/whatsapp/qr`         | sim  | QR Code pendente, se houver.                 |
| POST   | `/whatsapp/connect`    | sim  | Inicia/retoma a conexão com o WhatsApp.      |
| POST   | `/whatsapp/disconnect` | sim  | Encerra a conexão local (mantém a sessão).   |
| POST   | `/messages`            | sim  | Envia uma mensagem de texto.                 |

### `GET /health`

```http
GET /health
```
```json
{ "status": "ok" }
```
Sem autenticação. Use para health check de infraestrutura (load balancer,
container orchestrator), não para saber se o WhatsApp está conectado.

### `GET /whatsapp/status`

```json
{ "status": "connected", "phone": "5582999999999" }
```
`phone` só aparece quando `status` é `"connected"`. Ver seção 4 para os
valores possíveis de `status`.

### `GET /whatsapp/qr`

```json
{ "qr": "2@AbC123..." }
```
`qr` é `null` quando não há QR pendente (por exemplo, já conectado, ou nunca
chamou `connect()`). O Pulse deve renderizar essa string como QR Code (ex:
biblioteca `qrcode` no frontend) — o `pulse-wpp` não gera a imagem, só o
payload cru do Baileys.

### `POST /whatsapp/connect`

```http
POST /whatsapp/connect
```
Retorna o `WhatsAppStatusInfo` resultante (mesmo formato do `GET /status`):
- Se já existe sessão persistida válida, pode ir direto para `"connected"`
  sem pedir QR.
- Caso contrário, vai para `"qr_required"` — busque o QR em `GET /whatsapp/qr`
  logo em seguida.

Se o provider falhar ao iniciar (ex: erro de infraestrutura do Baileys),
retorna `503` com `PROVIDER_UNAVAILABLE` (ver seção 5) — **não** deixa a
aplicação inteira cair, então o Pulse pode simplesmente tentar de novo depois.

### `POST /whatsapp/disconnect`

Encerra o socket local mas **mantém a sessão salva em disco** — um
`connect()` posterior reconecta sem novo QR. Use isso para "pausar" a
integração, não para desvincular o número (isso só acontece via logout real
no celular, que o `pulse-wpp` detecta sozinho — ver seção 6).

### `POST /messages`

```http
POST /messages
Content-Type: application/json

{
  "phone": "5582999999999",
  "message": "Olá!"
}
```

Sucesso (`200`):
```json
{ "success": true, "messageId": "..." }
```

Erros possíveis: `400 INVALID_REQUEST` (telefone mal formatado),
`401 WHATSAPP_AUTH_REQUIRED` (sessão foi deslogada, precisa reconectar),
`409 WHATSAPP_NOT_CONNECTED` (não conectado ainda), `502 MESSAGE_SEND_FAILED`
(WhatsApp recusou o envio). Ver tabela completa na seção 5.

**Sem fila, sem intervalo entre mensagens** — o `pulse-wpp` envia
imediatamente e não implementa nenhum controle de taxa ou concorrência. Isso
é responsabilidade do Pulse (PRD §12/§13/§24): a orquestração de campanha,
throttling e retries de negócio ficam do lado de quem consome esta API.

---

## 4. Estados da conexão (`status`)

```text
disconnected  → nunca conectado, ou desconectado manualmente
connecting    → conectando (transitório)
qr_required   → aguardando escaneamento do QR Code
connected     → conectado, "phone" disponível
logged_out    → sessão foi encerrada de fato (ex: removido no celular);
                terminal — só sai daqui com um novo connect() + novo QR
```

`logged_out` é **diferente** de `disconnected`: uma queda de rede vira
`disconnected` e o `pulse-wpp` tenta reconectar sozinho por trás (ver seção
6); `logged_out` significa que a sessão foi invalidada de verdade e exige
reautenticação humana (escanear QR de novo). O Pulse deveria distinguir os
dois na UI — ex: `disconnected` pode ser "reconectando...", `logged_out`
precisa de um alerta pedindo para escanear o QR de novo.

---

## 5. Códigos de erro estáveis (PRD §20)

| Código                     | HTTP | Quando acontece                                              |
|-----------------------------|------|---------------------------------------------------------------|
| `UNAUTHORIZED`               | 401  | API Key ausente ou inválida.                                  |
| `INVALID_REQUEST`            | 400  | Corpo da requisição inválido (ex: telefone mal formatado).    |
| `WHATSAPP_NOT_CONNECTED`     | 409  | Tentou enviar mensagem sem estar conectado.                   |
| `WHATSAPP_AUTH_REQUIRED`     | 401  | Sessão foi deslogada (`logged_out`); precisa de novo QR.      |
| `MESSAGE_SEND_FAILED`        | 502  | WhatsApp recusou/falhou o envio de uma mensagem específica.   |
| `PROVIDER_UNAVAILABLE`       | 503  | Falha ao conectar/desconectar do provider (transitório).      |
| `INTERNAL_ERROR`             | 500  | Erro inesperado não mapeado — não deveria acontecer em uso normal. |

**Regra de ouro**: o Pulse deve tratar por `error.code`, nunca por
`error.message` (o texto pode mudar sem aviso). `PROVIDER_UNAVAILABLE` e
`INTERNAL_ERROR` são bons candidatos a retry automático (com backoff); os
demais são erros de estado/validação e não adianta repetir sem mudar algo.

---

## 6. Resiliência — o que o Pulse pode assumir

- **Queda transitória de rede/socket**: o `pulse-wpp` reconecta sozinho por
  trás (retry com backoff), sem exigir nenhuma ação do Pulse. O `status`
  passa por `disconnected` e volta para `connected` sozinho; o Pulse só
  precisa fazer polling de `GET /whatsapp/status` (ou aguardar o próximo
  `sendMessage` funcionar) — não precisa chamar `connect()` de novo.
- **Logout real** (`logged_out`): exige ação humana. O Pulse deve detectar
  esse estado (via polling de status, ou via `WHATSAPP_AUTH_REQUIRED` ao
  tentar enviar) e sinalizar para o usuário reconectar — chamando
  `POST /whatsapp/connect` e mostrando o novo QR de `GET /whatsapp/qr`.
- **Servidor do `pulse-wpp` não cai** por falha do WhatsApp — se uma request
  falhar com `PROVIDER_UNAVAILABLE`/`INTERNAL_ERROR`, o serviço continua no
  ar; vale a pena o Pulse ter um retry com backoff para esses dois casos.
- Hoje **não há webhook/push** de mudança de status — a única forma de saber
  que o QR foi escaneado ou que a sessão caiu é fazer **polling** de
  `GET /whatsapp/status` (ver PRD §24 "Comunicação em tempo real", que ainda
  não está implementado neste repo — item de roadmap).

---

## 7. Configuração do lado do `pulse-wpp`

Variáveis de ambiente relevantes para quem for subir uma instância para o
Pulse consumir (ver `.env.example`):

```env
APP_PORT=3000
APP_HOST=0.0.0.0
WHATSAPP_PROVIDER=baileys        # "fake" e "baileys-stub" são só para dev/teste
WHATSAPP_SESSION_PATH=./sessions
PULSE_WPP_API_KEY=<mesma chave usada pelo Pulse no header Authorization>
LOG_LEVEL=info
```

Em produção, `WHATSAPP_PROVIDER` precisa ser `baileys` (os outros dois valores
não conectam a um WhatsApp real).

---

## 8. Próximos passos (roadmap, ainda não disponível para o Pulse)

Do `docs/PRD.md`, o que vem depois da Fase 1 (gateway, concluída):

- **Fase 3 — Campanhas**: fila de mensagens, intervalo entre envios,
  controle de campanha (pause/retomar/cancelar), histórico. Tudo isso é
  esperado ser construído **no Pulse**, não no gateway — o `pulse-wpp`
  seguirá sendo só "enviar 1 mensagem agora".
- **Fase 4 — Observabilidade avançada**: possivelmente correlation IDs
  ponta a ponta (PRD §15) — hoje não há `requestId` propagado entre Pulse e
  Pulse WPP.
- **Fase 2/24 — Comunicação em tempo real**: hoje é só polling; um
  webhook/SSE/WebSocket de mudança de status ainda não existe.

Se for começar a implementação no Pulse agora, o caminho mais direto é:
1. Client HTTP fino em torno destes 6 endpoints, com o header de auth fixo.
2. Um enum local espelhando os `status` da seção 4.
3. Tratamento de erro central mapeando os códigos da seção 5 (não strings).
4. Polling simples de `GET /whatsapp/status` para acompanhar conexão/QR até
   existir algo em tempo real.
