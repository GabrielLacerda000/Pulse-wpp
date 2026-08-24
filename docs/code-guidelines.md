# Guidelines — Pulse WPP

## 1. Princípios

* Priorizar **simplicidade, baixo acoplamento e testabilidade**.
* O projeto deve ser um **gateway de WhatsApp**, não um segundo CRM.
* A lógica de negócio do Pulse não deve ser replicada no `pulse-wpp`.
* Baileys deve ficar isolado atrás de uma abstração.
* Evitar abstrações prematuras.
* Preferir código explícito a "mágica".
* Toda decisão arquitetural deve considerar a possibilidade de substituir Baileys futuramente.

---

## 2. Stack

* **Runtime:** Bun
* **Framework:** Elysia
* **Language:** TypeScript
* **WhatsApp:** Baileys
* **Testing:** Bun Test
* **Formatting/Linting:** Biome

Evitar adicionar bibliotecas sem necessidade.

Antes de instalar uma dependência, avaliar se a funcionalidade pode ser resolvida com:

1. recursos nativos do Bun;
2. recursos do Elysia;
3. código simples e local.

---

# 3. TypeScript

### Strict mode obrigatório

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

Não utilizar:

```ts
any
```

sem uma justificativa clara.

Preferir:

```ts
unknown
```

quando o tipo realmente não for conhecido.

### Evitar type assertions desnecessárias

Evitar:

```ts
const user = data as User
```

Preferir validação ou narrowing.

---

# 4. Interfaces representam contratos

Interfaces deverão ser utilizadas principalmente para representar **contratos entre componentes**, especialmente providers.

Exemplo:

```ts
interface WhatsAppProvider {
    connect(): Promise<void>
    disconnect(): Promise<void>
    getStatus(): Promise<WhatsAppStatus>
    getQrCode(): Promise<string | null>
    sendMessage(
        phone: string,
        message: string,
    ): Promise<SendMessageResult>
}
```

A implementação concreta:

```ts
class BaileysProvider implements WhatsAppProvider {
    // ...
}
```

O restante da aplicação deverá depender de:

```ts
WhatsAppProvider
```

e não:

```ts
BaileysProvider
```

---

# 5. Provider Pattern

A integração com WhatsApp deverá ser isolada.

```text
whatsapp/
└── providers/
    ├── WhatsAppProvider.ts
    ├── BaileysProvider.ts
    └── WhatsAppProviderFactory.ts
```

### Regra

Nenhum código fora da camada de provider deverá importar diretamente APIs específicas do Baileys.

Evitar:

```ts
import makeWASocket from 'baileys'
```

em controllers, routes ou services de negócio.

Apenas:

```text
BaileysProvider
```

deve conhecer detalhes específicos do Baileys.

---

# 6. Factory

A criação dos providers deverá ser centralizada.

```ts
const provider = WhatsAppProviderFactory.create(
    config.whatsapp.provider,
)
```

Evitar:

```ts
if (provider === 'baileys') {
    // ...
}

if (provider === 'meta') {
    // ...
}
```

espalhado pela aplicação.

A escolha do provider deve acontecer em um único ponto.

---

# 7. Services

Services devem representar **casos de uso da aplicação**, e não simplesmente agrupar funções aleatórias.

Bom:

```text
WhatsAppConnectionService
WhatsAppMessageService
```

Evitar services gigantes como:

```text
WhatsAppService
```

contendo toda a aplicação.

Um service deve possuir uma responsabilidade clara.

---

# 8. Controllers / Routes

As rotas do Elysia devem ser finas.

Evitar:

```ts
.post('/messages', async ({ body }) => {
    // 100 linhas
    // validação
    // conexão
    // envio
    // logging
    // tratamento
})
```

Preferir:

```ts
.post('/messages', async ({ body }) => {
    return messageService.send(body)
})
```

A rota deve cuidar principalmente de:

* receber request;
* validar entrada;
* chamar o caso de uso;
* retornar resposta.

---

# 9. Validação

Toda entrada externa deve ser validada.

Nunca confiar diretamente em:

```ts
body.phone
body.message
```

O schema da API deve definir o contrato.

Exemplo conceitual:

```ts
body: t.Object({
    phone: t.String(),
    message: t.String(),
})
```

A validação deve acontecer na fronteira da aplicação.

---

# 10. Erros

Não utilizar `try/catch` indiscriminadamente.

Evitar:

```ts
try {
    await provider.sendMessage(...)
} catch {
    return {
        success: false
    }
}
```

Isso esconde informações importantes.

Preferir erros específicos:

```ts
throw new WhatsAppNotConnectedError()
```

ou:

```ts
throw new MessageSendError(...)
```

A camada HTTP deve transformar esses erros em respostas apropriadas.

---

# 11. Erros estruturados

Erros retornados pela API devem possuir códigos estáveis.

Exemplo:

```json
{
    "success": false,
    "error": {
        "code": "WHATSAPP_NOT_CONNECTED",
        "message": "WhatsApp is not connected."
    }
}
```

O Pulse deverá depender do:

```text
error.code
```

e não do texto da mensagem.

---

# 12. Resultados

Operações cujo resultado possui estados diferentes devem possuir tipos explícitos.

Exemplo:

```ts
type SendMessageResult = {
    success: true
    messageId: string
}
```

ou:

```ts
type SendMessageResult =
    | {
        success: true
        messageId: string
    }
    | {
        success: false
        error: WhatsAppError
    }
```

Evitar retornar objetos inconsistentes dependendo do caminho de execução.

---

# 13. Configuração

Configurações deverão ser centralizadas.

Evitar acessar:

```ts
process.env.X
```

espalhado pelo projeto.

Preferir:

```text
config/
└── env.ts
```

E:

```ts
config.whatsapp.provider
config.server.port
config.auth.apiKey
```

Variáveis obrigatórias devem ser validadas durante a inicialização.

Se uma configuração crítica estiver ausente, o servidor deve falhar rapidamente com uma mensagem clara.

---

# 14. Logging

Não utilizar `console.log()` como mecanismo principal de observabilidade.

Preferir um logger estruturado.

Exemplo:

```ts
logger.info({
    event: 'WHATSAPP_CONNECTED',
})
```

Erros:

```ts
logger.error({
    event: 'MESSAGE_SEND_FAILED',
    phone,
    error,
})
```

Nunca registrar:

* API Keys;
* credenciais do WhatsApp;
* tokens;
* conteúdo sensível da sessão;
* informações desnecessárias.

---

# 15. Correlation ID

Operações que atravessam várias camadas devem possuir um identificador de correlação quando apropriado.

Exemplo:

```text
requestId
    ↓
HTTP request
    ↓
MessageService
    ↓
Provider
    ↓
WhatsApp
```

Isso permite encontrar todos os logs relacionados a uma operação.

---

# 16. Testabilidade

Código externo deve ser substituível.

Não escrever:

```ts
const socket = makeWASocket(...)
```

dentro de um service de negócio.

Preferir:

```ts
constructor(
    private readonly provider: WhatsAppProvider,
) {}
```

Assim:

```text
Production
    ↓
BaileysProvider

Tests
    ↓
FakeWhatsAppProvider
```

---

# 17. Fake Provider

Deverá existir um provider falso para testes.

Exemplo:

```ts
class FakeWhatsAppProvider implements WhatsAppProvider {
    async connect() {}

    async disconnect() {}

    async getStatus() {
        return {
            status: 'connected',
        }
    }

    async getQrCode() {
        return null
    }

    async sendMessage() {
        return {
            success: true,
            messageId: 'fake-message-id',
        }
    }
}
```

Isso evita que testes dependam de uma conta real do WhatsApp.

---

# 18. Testes

Cada caso de uso importante deverá possuir testes.

Prioridade:

1. Provider Factory;
2. Services;
3. autenticação;
4. API;
5. tratamento de erros;
6. provider fake;
7. integração entre camadas.

Testes não devem depender de:

* QR Code real;
* conta real do WhatsApp;
* conexão com internet;
* sessão persistida real.

---

# 19. Naming

Utilizar nomes descritivos.

Preferir:

```ts
WhatsAppMessageService
BaileysProvider
SendMessageResult
WhatsAppConnectionError
```

Evitar:

```ts
WppSvc
WAClient
MsgManager
Helper
Utils
```

Principalmente `utils`: se algo tem uma responsabilidade clara, deve ter um nome que represente essa responsabilidade.

---

# 20. Estrutura de dependências

A direção das dependências deve ser:

```text
HTTP
 ↓
Application / Services
 ↓
Domain contracts
 ↓
Infrastructure
```

Baileys pertence à infraestrutura.

```text
HTTP
 ↓
WhatsAppMessageService
 ↓
WhatsAppProvider
 ↓
BaileysProvider
 ↓
Baileys
```

Nunca:

```text
Route
 ↓
Baileys
```

---

# 21. Não criar abstrações sem necessidade

Não criar interfaces para tudo.

A abstração `WhatsAppProvider` existe porque há uma **razão arquitetural concreta**:

> Baileys pode ser substituído por outro provider.

Já uma classe simples que só possui uma implementação e nenhuma fronteira importante pode permanecer concreta.

A regra é:

> **abstrair pontos de mudança, não todas as classes.**

---

# 22. Imutabilidade

Preferir `const`:

```ts
const message = ...
```

Evitar mutação desnecessária.

Quando uma função puder ser pura, preferir funções puras.

---

# 23. Async / Await

Preferir:

```ts
const result = await provider.sendMessage(...)
```

em vez de cadeias complexas de `.then()`.

Promises rejeitadas nunca devem ser ignoradas.

---

# 24. Concorrência

O envio de mensagens deverá possuir controle explícito de concorrência.

Não disparar múltiplos envios indiscriminadamente:

```ts
messages.forEach(async message => {
    await sendMessage(message)
})
```

O processamento deverá respeitar a estratégia de fila definida pelo Pulse.

---

# 25. Responsabilidade do Pulse WPP

O `pulse-wpp` **não deverá implementar lógica comercial**.

Não adicionar:

```text
LeadService
CampaignService
ProspectingService
ScoreService
TemplateService
```

Esses conceitos pertencem ao Pulse.

O `pulse-wpp` deve pensar em:

```text
WhatsApp
Connection
Message
Provider
```

---

# 26. API como contrato

A API HTTP é o contrato entre os projetos.

Alterações incompatíveis deverão ser evitadas.

Se for necessário quebrar o contrato:

```text
/api/v1/...
```

poderá ser utilizado no futuro para versionamento.

---

# 27. Segurança

Nunca commitar:

```text
.env
auth/
session/
credentials/
```

Adicionar ao `.gitignore`.

Exemplo:

```gitignore
.env
.env.*
!.env.example

/auth/
/sessions/
```

---

# 28. Commits

Preferir commits pequenos e focados.

Exemplo:

```text
feat: add whatsapp provider contract
feat: implement baileys provider
feat: add whatsapp connection endpoint
test: add message service tests
fix: handle whatsapp disconnect
```

Evitar commits como:

```text
feat: everything
fix: stuff
changes
```

---

# 29. Definition of Done

Uma funcionalidade só será considerada concluída quando:

* implementação estiver funcionando;
* tipos estiverem corretos;
* validação estiver implementada;
* erros relevantes forem tratados;
* logs necessários existirem;
* testes forem adicionados;
* nenhum segredo estiver exposto;
* responsabilidades estiverem na camada correta.

---

# 30. Regra arquitetural principal

> **O Pulse WPP deve conhecer WhatsApp, mas não deve conhecer o negócio do Pulse.**

E:

> **O Pulse deve conhecer o negócio, mas não deve conhecer os detalhes de Baileys.**

