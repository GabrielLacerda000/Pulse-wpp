# Testando o Pulse WPP com o Yaak

Guia passo a passo para testar a API do `pulse-wpp` localmente usando o
[Yaak](https://yaak.app/) (cliente HTTP tipo Postman/Insomnia). Cobre setup
de ambiente, cada rota com headers/token/body, e a ordem recomendada de
execução para exercitar o fluxo completo (incluindo os cenários de
resiliência da issue #7).

> Endpoints e códigos de erro detalhados: `docs/pulse-integration.md`.
> Aqui o foco é "como clicar no Yaak", não a referência da API.

---

## 1. Subindo o servidor

```bash
cp .env.example .env
```

Edite o `.env`:

```env
APP_PORT=3000
APP_HOST=0.0.0.0
WHATSAPP_PROVIDER=baileys-stub   # comece aqui — não precisa de WhatsApp real
WHATSAPP_SESSION_PATH=./sessions
PULSE_WPP_API_KEY=minha-chave-de-teste
LOG_LEVEL=info
```

```bash
bun run dev
```

Servidor sobe em `http://localhost:3000`. Deixe o terminal aberto — os logs
estruturados (JSON) mostram cada evento (`WHATSAPP_CONNECTING`,
`QR_GENERATED`, `API_REQUEST` etc.) e ajudam a acompanhar o que está
acontecendo por trás de cada chamada.

> `baileys-stub` se comporta como o `baileys` de fora (mesmos estados,
> mesmos formatos), mas sem conexão real — ótimo para testar o fluxo de
> chamadas sem precisar escanear QR de verdade. Quando quiser testar contra
> o WhatsApp de verdade, troque para `WHATSAPP_PROVIDER=baileys` e reinicie
> o servidor (seção 6).

---

## 2. Configurando o Yaak

### 2.1 Criar um Workspace

Crie um workspace novo, ex: **Pulse WPP — Local**.

### 2.2 Criar um Environment

No Yaak, vá em **Environments** e crie um chamado `local` com estas
variáveis:

| Variável   | Valor                     |
|------------|---------------------------|
| `base_url` | `http://localhost:3000`   |
| `api_key`  | `minha-chave-de-teste` (igual ao `.env`) |

Isso permite usar `${{ base_url }}` e `${{ api_key }}` nas requisições em
vez de colar valores fixos em cada uma — se trocar a porta ou a chave, muda
num lugar só.

### 2.3 Auth por request (recomendado) ou por pasta

O Yaak permite herdar autenticação de uma pasta para todas as requisições
dentro dela. Crie uma pasta **Pulse WPP**, e nela configure:

- **Auth type**: `Bearer Token`
- **Token**: `${{ api_key }}`

Assim toda requisição nova dentro da pasta já nasce autenticada — só
`GET /health` não precisa (mas não tem problema deixar o header nela também,
é ignorado).

---

## 3. As 6 requisições

Crie uma requisição para cada rota abaixo, todas dentro da pasta **Pulse
WPP**. URL sempre com `${{ base_url }}` na frente.

### 3.1 `GET /health`

- **Método**: `GET`
- **URL**: `${{ base_url }}/health`
- **Auth**: nenhuma necessária
- **Resposta esperada** (200):
  ```json
  { "status": "ok" }
  ```
- Use isso primeiro pra confirmar que o servidor está no ar.

### 3.2 `GET /whatsapp/status`

- **Método**: `GET`
- **URL**: `${{ base_url }}/whatsapp/status`
- **Auth**: Bearer (herdado da pasta)
- **Resposta esperada** (200), varia conforme o estado atual:
  ```json
  { "status": "disconnected" }
  ```

### 3.3 `POST /whatsapp/connect`

- **Método**: `POST`
- **URL**: `${{ base_url }}/whatsapp/connect`
- **Auth**: Bearer
- **Body**: nenhum
- **Resposta esperada** (200):
  ```json
  { "status": "qr_required" }
  ```
  (ou `{ "status": "connected", "phone": "..." }` se já havia sessão salva)

### 3.4 `GET /whatsapp/qr`

- **Método**: `GET`
- **URL**: `${{ base_url }}/whatsapp/qr`
- **Auth**: Bearer
- **Resposta esperada** (200):
  ```json
  { "qr": "fake-qr-1234567890" }
  ```
  Com `baileys-stub`/`fake` é uma string qualquer — não escaneável, só serve
  pra confirmar que o payload chega. Com `baileys` real, é o payload do QR
  de verdade (ver seção 6 pra visualizar como imagem).

### 3.5 `POST /whatsapp/disconnect`

- **Método**: `POST`
- **URL**: `${{ base_url }}/whatsapp/disconnect`
- **Auth**: Bearer
- **Body**: nenhum
- **Resposta esperada** (200):
  ```json
  { "status": "disconnected" }
  ```

### 3.6 `POST /messages`

- **Método**: `POST`
- **URL**: `${{ base_url }}/messages`
- **Auth**: Bearer
- **Headers**: `Content-Type: application/json` (o Yaak já define isso
  sozinho quando você escolhe body do tipo JSON)
- **Body** (aba Body → JSON):
  ```json
  {
    "phone": "5582999999999",
    "message": "Olá!"
  }
  ```
- **Resposta esperada** (200) se estiver conectado:
  ```json
  { "success": true, "messageId": "fake-message-1234567890" }
  ```
  Se não estiver conectado, vem `409` com `WHATSAPP_NOT_CONNECTED` — isso é
  esperado, não é bug (ver seção 4).

---

## 4. Ordem recomendada de execução (fluxo feliz)

Com `WHATSAPP_PROVIDER=baileys-stub`, rode nessa ordem, uma requisição por
vez, olhando a resposta e os logs no terminal a cada passo:

1. **`GET /health`** → confirma que o servidor está no ar.
2. **`GET /whatsapp/status`** → deve vir `disconnected`.
3. **`POST /messages`** (antes de conectar) → deve vir `409
   WHATSAPP_NOT_CONNECTED`. Teste de propósito o caminho de erro primeiro.
4. **`POST /whatsapp/connect`** → deve vir `qr_required`.
5. **`GET /whatsapp/qr`** → deve trazer uma string não-nula.
6. **`GET /whatsapp/status`** de novo → ainda `qr_required` (o stub não
   "escaneia" sozinho; ver nota abaixo).
7. **`POST /messages`** de novo → ainda `409`, porque `qr_required` não é
   `connected`.
8. **`POST /whatsapp/disconnect`** → volta pra `disconnected`.
9. **`GET /whatsapp/qr`** → agora `null`.

> Nota: com `baileys-stub`/`fake`, não existe um endpoint HTTP para simular
> "QR escaneado" — isso só é possível via código (`provider.simulateQrScanned()`
> nos testes automatizados) ou testando de fato com `WHATSAPP_PROVIDER=baileys`
> e escaneando o QR real (seção 6). Pelo Yaak sozinho, dá pra validar o
> caminho até `qr_required` e os erros de estado; o caminho até `connected`
> exige o provider real.

### 4.1 Testando erros de autenticação

Duplique qualquer requisição, apague o header `Authorization` (ou mude o
token pra algo errado) e rode. Deve vir sempre:

```http
401 Unauthorized
```
```json
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "..." } }
```

### 4.2 Testando validação de telefone

No `POST /messages`, troque `phone` por algo inválido, ex: `"phone":
"abc"`. Deve vir:

```http
400 Bad Request
```
```json
{ "success": false, "error": { "code": "INVALID_REQUEST", "message": "..." } }
```

---

## 5. Testando reconexão e logout (issue #7)

Esses cenários exigem `WHATSAPP_PROVIDER=baileys` (conexão real) — o stub
não simula queda de socket nem logout via HTTP. Passo a passo:

1. Suba com `WHATSAPP_PROVIDER=baileys`, chame `connect`, escaneie o QR
   real (seção 6).
2. Confirme `GET /whatsapp/status` → `connected`.
3. **Simular queda transitória**: derrube a rede da máquina por alguns
   segundos (ex: desliga o WiFi) e religa. Observe no terminal os eventos
   `WHATSAPP_DISCONNECTED` → `WHATSAPP_CONNECTING` (pode repetir algumas
   vezes com backoff) → `WHATSAPP_CONNECTED`. Chame `GET /whatsapp/status`
   de tempos em tempos pelo Yaak até ver `connected` de novo — **sem** ter
   chamado `POST /whatsapp/connect` manualmente e **sem** novo QR.
4. **Simular logout real**: pelo próprio WhatsApp no celular, vá em
   Aparelhos conectados e remova o `pulse-wpp`. No terminal deve aparecer
   `WHATSAPP_LOGGED_OUT`. Chame `GET /whatsapp/status` → deve vir
   `logged_out` (e ficar assim, sem reconectar sozinho).
5. Com `status: logged_out`, chame `POST /messages` → deve vir `401
   WHATSAPP_AUTH_REQUIRED` (diferente do `409 WHATSAPP_NOT_CONNECTED` do
   passo 3 do fluxo feliz — são erros distintos de propósito).
6. Chame `POST /whatsapp/connect` de novo → deve voltar pra `qr_required`,
   exigindo escanear um QR novo (`GET /whatsapp/qr` traz um valor
   diferente do QR anterior).

---

## 6. Testando com WhatsApp real (`baileys`)

1. Pare o servidor, mude `.env`:
   ```env
   WHATSAPP_PROVIDER=baileys
   ```
2. `bun run dev` de novo.
3. `POST /whatsapp/connect` pelo Yaak.
4. `GET /whatsapp/qr` — copie o valor de `qr`.
5. Como o Yaak não renderiza QR Code nativamente, gere a imagem a partir da
   string. Opções rápidas:
   - Colar em qualquer gerador de QR online (ex: `https://www.qr-code-generator.com/`,
     modo "texto simples") — **evite** isso se a sessão for sensível, prefira
     uma opção local.
   - Rodar localmente: `bunx qrcode-terminal "<valor do qr>"` imprime o QR
     direto no terminal.
6. Escaneie com **WhatsApp → Aparelhos conectados → Conectar dispositivo**.
7. `GET /whatsapp/status` deve virar `connected` com o `phone` do número
   escaneado.
8. Teste `POST /messages` enviando para um número real (formato
   `55<DDD><número>`, sem `+` nem espaços) e confira o recebimento no
   celular de destino.

---

## 7. Dicas gerais

- **Sempre olhe o terminal** enquanto testa pelo Yaak — os logs estruturados
  mostram o evento por trás de cada resposta (`API_REQUEST`,
  `API_AUTH_FAILED`, `WHATSAPP_CONNECTING` etc.), o que ajuda a diferenciar
  "a API respondeu errado" de "o WhatsApp/Baileys que está lento".
- **Sessão fica em disco**: `WHATSAPP_SESSION_PATH` (padrão `./sessions`).
  Se quiser forçar um QR novo do zero mesmo sem logout real, pare o
  servidor e apague essa pasta manualmente.
- **Uma instância = um número**: não dá pra testar dois números
  simultaneamente na mesma pasta de sessão; se precisar, use
  `WHATSAPP_SESSION_PATH` diferentes em `.env` separados.
- Depois de validar tudo manualmente, `bun test` roda a suíte automatizada
  (73 testes) cobrindo os mesmos fluxos sem depender de WhatsApp real —
  útil pra checar regressão rápido sem repetir todo esse passo a passo.
