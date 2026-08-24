# PRD — Pulse WPP

**Versão:** 1.0
**Status:** Planejamento
**Projeto:** `pulse-wpp`
**Runtime:** Bun
**Framework HTTP:** Elysia
**Linguagem:** TypeScript
**Integração WhatsApp inicial:** Baileys
**Sistema consumidor:** Pulse — Laravel + Vue + Inertia

---

## 1. Visão geral

O **Pulse WPP** será um serviço independente responsável pela integração do Pulse com o WhatsApp.

Sua primeira implementação utilizará **Baileys**, mas a arquitetura deverá ser construída para permitir a substituição dessa implementação por outra solução no futuro, incluindo a API oficial da Meta.

O Pulse WPP não será responsável pela gestão comercial dos leads. Ele funcionará como uma camada especializada de comunicação.

### Responsabilidade do Pulse

* Leads
* Seleção de contatos
* Campanhas
* Templates
* Mensagens
* Agendamento
* Fila
* Histórico comercial
* Métricas de campanhas

### Responsabilidade do Pulse WPP

* Conexão com WhatsApp
* Autenticação via QR Code
* Persistência da sessão
* Status da conexão
* Envio de mensagens
* Retorno dos resultados de envio
* Eventos relacionados à conexão
* Abstração do provider de WhatsApp

---

# 2. Problema

Atualmente, o Pulse permite gerar links `wa.me` para iniciar conversas.

O fluxo atual exige uma ação manual:

```text
Lead
 ↓
Pulse
 ↓
Gerar mensagem
 ↓
Abrir wa.me
 ↓
WhatsApp
 ↓
Usuário envia
```

Isso limita a capacidade de executar campanhas com vários contatos.

O Pulse WPP deverá permitir:

```text
Lead
 ↓
Campanha
 ↓
Fila
 ↓
Pulse WPP
 ↓
WhatsApp
```

O usuário continuará controlando a campanha pelo Pulse, enquanto o Pulse WPP ficará responsável pela execução da comunicação.

---

# 3. Objetivos

## 3.1 Objetivo principal

Permitir que o Pulse envie mensagens de WhatsApp automaticamente através de um serviço independente, sem acoplar a lógica comercial do CRM à implementação específica do WhatsApp.

## 3.2 Objetivos secundários

* Permitir conexão de uma conta WhatsApp através de QR Code.
* Permitir envio de mensagens pelo Pulse.
* Permitir criação de campanhas.
* Permitir selecionar os leads participantes.
* Permitir utilizar múltiplas mensagens em uma campanha.
* Permitir selecionar aleatoriamente uma mensagem disponível para cada envio.
* Permitir configurar um intervalo mínimo e máximo entre mensagens.
* Permitir acompanhar o progresso da campanha.
* Registrar falhas detalhadamente.
* Permitir substituir Baileys futuramente.
* Possibilitar testes automatizados sem depender de uma conexão real com WhatsApp.

---

# 4. Não objetivos

O Pulse WPP **não será responsável**, inicialmente, por:

* gerenciamento de leads;
* scraping de leads;
* CRM;
* pipeline comercial;
* score de leads;
* criação de templates;
* banco de dados comercial;
* autenticação de usuários do Pulse;
* cobrança;
* gestão de clientes;
* inteligência comercial;
* geração de mensagens por IA.

Essas responsabilidades permanecem no Pulse.

---

# 5. Princípios arquiteturais

## 5.1 Provider agnóstico

O sistema não deverá depender diretamente de Baileys.

A implementação deverá utilizar uma abstração:

```text
WhatsAppProvider
        │
        ├── BaileysProvider
        │
        └── MetaProvider (futuro)
```

O restante do sistema deverá depender da interface `WhatsAppProvider`, e não de uma implementação concreta.

---

## 5.2 Strategy Pattern

Cada implementação de WhatsApp deverá seguir o mesmo contrato.

Exemplo conceitual:

```ts
interface WhatsAppProvider {
    connect(): Promise<void>
    disconnect(): Promise<void>
    getStatus(): Promise<WhatsAppStatus>
    getQrCode(): Promise<string | null>
    sendMessage(
        phone: string,
        message: string
    ): Promise<SendMessageResult>
}
```

Uma implementação inicial:

```text
BaileysProvider
```

Uma implementação futura:

```text
MetaProvider
```

A troca de provider não deverá exigir alterações na lógica das campanhas.

---

## 5.3 Factory Pattern

A criação do provider deverá ser centralizada em uma Factory.

Exemplo:

```ts
WhatsAppProviderFactory.create('baileys')
```

O provider poderá ser definido por configuração:

```env
WHATSAPP_PROVIDER=baileys
```

No futuro:

```env
WHATSAPP_PROVIDER=meta
```

A troca do provider deverá ser uma alteração de configuração e implementação, e não uma alteração generalizada no código do sistema.

---

# 6. Arquitetura

```text
                         PULSE
                  Laravel + Vue + Inertia
                           │
                           │ HTTP
                           ▼
                  ┌─────────────────┐
                  │   Pulse WPP     │
                  │                 │
                  │ Bun             │
                  │ Elysia          │
                  │ TypeScript      │
                  └────────┬────────┘
                           │
                    WhatsAppProvider
                           │
              ┌────────────┴────────────┐
              │                         │
      BaileysProvider             MetaProvider
              │                    (futuro)
              ▼
         WhatsApp
```

O Pulse será a fonte da verdade para campanhas e leads.

O Pulse WPP será a fonte da verdade para o estado da conexão WhatsApp e para a execução da comunicação.

---

# 7. Estrutura do projeto

Estrutura inicial sugerida:

```text
pulse-wpp/
├── src/
│   ├── app.ts
│   ├── server.ts
│   │
│   ├── config/
│   │   └── env.ts
│   │
│   ├── http/
│   │   ├── routes/
│   │   │   ├── health.ts
│   │   │   ├── whatsapp.ts
│   │   │   └── messages.ts
│   │   └── middleware/
│   │       └── authentication.ts
│   │
│   ├── whatsapp/
│   │   ├── providers/
│   │   │   ├── WhatsAppProvider.ts
│   │   │   ├── BaileysProvider.ts
│   │   │   └── WhatsAppProviderFactory.ts
│   │   │
│   │   ├── services/
│   │   │   ├── WhatsAppConnectionService.ts
│   │   │   └── WhatsAppMessageService.ts
│   │   │
│   │   └── types/
│   │
│   ├── logging/
│   │   └── logger.ts
│   │
│   └── shared/
│
├── auth/
│   └── [Baileys session]
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

A estrutura poderá ser ajustada durante a implementação.

---

# 8. Requisitos funcionais

## RF01 — Health check

O sistema deverá disponibilizar um endpoint para verificar se o serviço está funcionando.

```http
GET /health
```

Resposta:

```json
{
    "status": "ok"
}
```

---

## RF02 — Status do WhatsApp

O sistema deverá informar o estado atual da conexão.

Estados mínimos:

```text
disconnected
connecting
qr_required
connected
logged_out
```

Endpoint:

```http
GET /whatsapp/status
```

Exemplo:

```json
{
    "status": "connected",
    "phone": "5582999999999"
}
```

---

## RF03 — Geração do QR Code

O sistema deverá disponibilizar o QR Code necessário para autenticação da sessão.

Endpoint:

```http
GET /whatsapp/qr
```

O Pulse utilizará esse endpoint para exibir o QR Code ao usuário.

O QR Code não deverá ser armazenado permanentemente.

---

## RF04 — Conectar WhatsApp

Endpoint:

```http
POST /whatsapp/connect
```

O endpoint deverá iniciar o processo de conexão.

Caso seja necessária autenticação, o status deverá indicar `qr_required`.

---

## RF05 — Desconectar WhatsApp

Endpoint:

```http
POST /whatsapp/disconnect
```

O sistema deverá encerrar a sessão atual.

---

## RF06 — Persistência da sessão

A sessão de autenticação deverá ser persistida de maneira segura para evitar a necessidade de escanear o QR Code após cada reinicialização.

As credenciais da sessão deverão:

* permanecer fora do controle de versão;
* possuir permissões restritas;
* não aparecer nos logs;
* não ser retornadas pela API.

---

## RF07 — Enviar mensagem

Endpoint:

```http
POST /messages
```

Request:

```json
{
    "phone": "5582999999999",
    "message": "Olá, João!"
}
```

Resposta de sucesso:

```json
{
    "success": true,
    "messageId": "..."
}
```

Caso o WhatsApp esteja desconectado, o endpoint deverá retornar erro apropriado.

---

## RF08 — Validação de telefone

O Gateway deverá validar o formato recebido antes de tentar realizar o envio.

A normalização definitiva dos dados dos leads permanecerá sob responsabilidade do Pulse.

---

## RF09 — Seleção de contatos

A seleção de contatos será realizada exclusivamente pelo Pulse.

O Pulse deverá permitir:

* seleção individual;
* seleção múltipla;
* seleção através dos filtros existentes;
* seleção de todos os resultados filtrados.

O Pulse WPP não deverá possuir banco de leads.

---

# 9. Campanhas

As campanhas serão criadas e administradas pelo Pulse.

Uma campanha deverá possuir, no mínimo:

```text
id
name
status
messages
recipients
min_interval
max_interval
created_at
started_at
paused_at
completed_at
```

---

# 10. Múltiplas mensagens

Uma campanha poderá possuir várias mensagens.

Exemplo:

```text
Campanha: Prospecção

Mensagem 1:
"Olá {nome}, tudo bem?..."

Mensagem 2:
"Oi {nome}! Estava analisando..."

Mensagem 3:
"Olá {nome}! Posso te fazer uma pergunta..."
```

Para cada contato, o Pulse deverá selecionar uma das mensagens habilitadas.

A seleção poderá ser aleatória.

A variação de mensagens existe para permitir campanhas com diferentes abordagens e evitar que todas as comunicações sejam idênticas.

O sistema **não deverá prometer ou tratar essa variação como garantia contra bloqueios ou mecanismos antiabuso**.

---

# 11. Variáveis de mensagem

O Pulse será responsável por renderizar as variáveis antes do envio.

Exemplo:

```text
Olá {nome}!
```

Resultado:

```text
Olá João!
```

Variáveis inicialmente suportadas:

```text
{nome}
{empresa}
{cidade}
{categoria}
```

O Pulse WPP receberá apenas a mensagem já renderizada.

---

# 12. Intervalo entre mensagens

O usuário poderá configurar:

```text
Intervalo mínimo: 30 segundos
Intervalo máximo: 50 segundos
```

O Pulse deverá calcular um intervalo aleatório dentro do range configurado para cada envio.

Exemplo:

```text
Mensagem 1
    ↓ 37s
Mensagem 2
    ↓ 49s
Mensagem 3
    ↓ 31s
Mensagem 4
    ↓ 44s
```

O intervalo deverá ser calculado pelo Pulse, pois faz parte da lógica da campanha.

O Pulse WPP deverá apenas executar as solicitações recebidas.

Os intervalos devem ser utilizados para controle de ritmo e carga, e não como mecanismo para contornar políticas ou sistemas antiabuso da plataforma.

---

# 13. Fila de mensagens

O Pulse deverá utilizar uma fila para controlar os envios.

Cada item da fila deverá possuir:

```text
campaign_id
lead_id
message
status
scheduled_at
sent_at
message_id
error
```

Estados mínimos:

```text
pending
processing
sent
failed
cancelled
```

---

# 14. Status da campanha

O Pulse deverá possuir uma tela de acompanhamento da campanha.

Exemplo:

```text
Campanha: Clínicas sem site

Status: Em execução

Total:       100
Pendentes:    32
Enviadas:     63
Falhas:        5

Progresso:
████████████████░░░░ 63%
```

O usuário deverá conseguir identificar:

* quantidade total de contatos;
* quantidade enviada;
* quantidade pendente;
* quantidade com erro;
* progresso percentual;
* horário de início;
* horário da última execução.

---

# 15. Controle da campanha

O usuário deverá conseguir:

```text
Iniciar
Pausar
Retomar
Cancelar
```

### Pausar

Mensagens ainda não processadas deverão permanecer na fila.

Nenhuma nova mensagem deverá ser enviada enquanto a campanha estiver pausada.

### Retomar

A campanha deverá continuar a partir dos contatos ainda pendentes.

### Cancelar

Mensagens ainda não enviadas deverão ser canceladas.

Mensagens já enviadas não deverão ser revertidas.

---

# 16. Histórico de mensagens

O Pulse deverá registrar cada tentativa de envio.

Exemplo:

```text
Lead: Clínica X
Campanha: Clínicas sem site
Mensagem: enviada
Horário: 24/08/2026 10:32
Message ID: abc123
```

Em caso de erro:

```text
Lead: Clínica Y
Status: falhou
Erro: WhatsApp desconectado
Horário: 24/08/2026 10:33
```

---

# 17. Logs

O Pulse WPP deverá possuir logging estruturado.

Eventos mínimos:

```text
SERVICE_STARTED
SERVICE_STOPPED

WHATSAPP_CONNECTING
WHATSAPP_CONNECTED
WHATSAPP_DISCONNECTED
WHATSAPP_LOGGED_OUT
QR_GENERATED

MESSAGE_SEND_STARTED
MESSAGE_SENT
MESSAGE_SEND_FAILED

API_REQUEST
API_AUTH_FAILED

PROVIDER_INITIALIZED
PROVIDER_ERROR
```

Os logs deverão conter contexto suficiente para diagnosticar falhas.

Exemplo:

```json
{
    "level": "error",
    "event": "MESSAGE_SEND_FAILED",
    "campaignId": 42,
    "leadId": 123,
    "messageId": "internal-id",
    "error": "Connection closed",
    "timestamp": "2026-08-24T14:30:00Z"
}
```

Dados sensíveis, credenciais e informações de autenticação não deverão ser registrados.

O conteúdo integral das mensagens deverá ser evitado nos logs de infraestrutura sempre que não for necessário para diagnóstico.

---

# 18. Autenticação entre Pulse e Pulse WPP

O Pulse WPP não deverá aceitar livremente requisições externas.

A API deverá utilizar autenticação através de API Key no MVP.

Exemplo:

```http
Authorization: Bearer <API_KEY>
```

A chave deverá ser configurada através de variável de ambiente.

Exemplo:

```env
PULSE_WPP_API_KEY=...
```

Requisições sem credenciais válidas deverão receber:

```http
401 Unauthorized
```

---

# 19. API

## `GET /health`

Verifica disponibilidade do serviço.

---

## `GET /whatsapp/status`

Retorna:

```json
{
    "status": "connected",
    "phone": "5582999999999"
}
```

---

## `GET /whatsapp/qr`

Retorna o QR Code atual.

Quando não houver QR disponível:

```json
{
    "qr": null
}
```

---

## `POST /whatsapp/connect`

Inicia a conexão.

---

## `POST /whatsapp/disconnect`

Encerra a conexão.

---

## `POST /messages`

Envia mensagem.

Request:

```json
{
    "phone": "5582999999999",
    "message": "Olá!"
}
```

Response:

```json
{
    "success": true,
    "messageId": "..."
}
```

---

# 20. Tratamento de erros da API

A API deverá utilizar respostas consistentes.

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

Códigos deverão ser estáveis para que o Pulse consiga tratá-los sem depender de mensagens textuais.

Exemplos:

```text
UNAUTHORIZED
INVALID_REQUEST
WHATSAPP_NOT_CONNECTED
WHATSAPP_AUTH_REQUIRED
MESSAGE_SEND_FAILED
PROVIDER_UNAVAILABLE
INTERNAL_ERROR
```

---

# 21. Entidades do Pulse

O Pulse será responsável pelas entidades de negócio.

## Campaign

```text
id
name
status
min_interval
max_interval
created_at
started_at
paused_at
completed_at
```

## CampaignMessage

```text
id
campaign_id
content
enabled
created_at
```

## CampaignRecipient

```text
id
campaign_id
lead_id
message
status
scheduled_at
sent_at
message_id
error
created_at
```

Não é necessário criar uma entidade de lead no Pulse WPP.

---

# 22. Entidades internas do Pulse WPP

O Pulse WPP deverá evitar persistência desnecessária.

A principal informação persistente será a sessão do provider de WhatsApp.

Estrutura conceitual:

```text
WhatsApp Session
├── credentials
├── keys
└── provider metadata
```

A implementação específica dessa persistência deverá ficar isolada do restante da aplicação.

---

# 23. Comunicação Pulse → Pulse WPP

O Pulse será o cliente da API.

Fluxo:

```text
Campaign
   ↓
Queue
   ↓
Scheduled message
   ↓
WhatsAppService
   ↓
HTTP POST /messages
   ↓
Pulse WPP
   ↓
WhatsAppProvider
   ↓
WhatsApp
```

O Pulse não deverá importar código do Pulse WPP.

Os projetos serão independentes.

---

# 24. Comunicação em tempo real

Não será obrigatória no primeiro MVP.

Inicialmente, o Pulse poderá utilizar polling para consultar:

```text
GET /whatsapp/status
GET /whatsapp/qr
```

Posteriormente poderá ser implementado WebSocket ou SSE para eventos como:

```text
QR atualizado
WhatsApp conectado
WhatsApp desconectado
Mensagem enviada
Erro de conexão
```

---

# 25. Testes

O projeto deverá possuir testes automatizados.

## Testes unitários

Deverão cobrir:

* `WhatsAppProviderFactory`;
* seleção de provider;
* validação de configurações;
* tratamento de erros;
* normalização de resultados;
* serviços de conexão;
* serviço de envio.

## Testes de API

Deverão cobrir:

* `/health`;
* autenticação;
* `/whatsapp/status`;
* `/whatsapp/qr`;
* `/whatsapp/connect`;
* `/whatsapp/disconnect`;
* `/messages`;
* payload inválido;
* provider desconectado;
* erros internos.

## Testes de integração

Deverão validar a integração:

```text
HTTP
 ↓
Controller
 ↓
WhatsAppService
 ↓
Provider
```

O provider real deverá poder ser substituído por um mock/fake.

Não será necessário estabelecer uma conexão real com o WhatsApp em cada execução da suíte de testes.

---

# 26. Testes do Provider

A interface `WhatsAppProvider` deverá possuir testes de contrato.

Qualquer novo provider deverá respeitar o mesmo comportamento esperado.

Exemplo:

```text
BaileysProvider
      ↓
Contract Tests

MetaProvider
      ↓
Contract Tests
```

Isso ajudará a garantir que a substituição do provider não quebre o restante do sistema.

---

# 27. Observabilidade

O sistema deverá permitir responder às seguintes perguntas através de logs e status:

* O serviço iniciou?
* O provider iniciou corretamente?
* O WhatsApp está conectado?
* Quando a conexão caiu?
* O QR foi gerado?
* Uma mensagem foi solicitada?
* O envio foi iniciado?
* O envio foi concluído?
* Por que um envio falhou?
* O provider estava disponível?
* A API recebeu uma requisição inválida?
* Houve falha de autenticação?

Cada operação relevante deverá possuir identificadores de correlação quando possível.

---

# 28. Configuração

As configurações deverão utilizar variáveis de ambiente.

Exemplo:

```env
APP_PORT=3000
APP_HOST=0.0.0.0

WHATSAPP_PROVIDER=baileys

PULSE_API_KEY=...

LOG_LEVEL=info

WHATSAPP_SESSION_PATH=./auth/session
```

Nenhuma credencial deverá ser hardcoded.

O arquivo `.env` não deverá ser versionado.

Deverá existir:

```text
.env.example
```

---

# 29. Segurança

O sistema deverá:

* autenticar chamadas da API;
* proteger credenciais;
* não versionar sessões;
* não expor credenciais do WhatsApp;
* não registrar tokens nos logs;
* validar payloads;
* limitar acesso aos endpoints administrativos;
* utilizar HTTPS quando exposto fora da máquina local;
* evitar exposição pública desnecessária do Gateway.

---

# 30. Resiliência

O Gateway deverá tentar reconectar automaticamente quando a conexão for perdida, quando isso for suportado pelo provider.

O sistema deverá distinguir:

```text
conexão temporariamente perdida
```

de:

```text
sessão encerrada / logout
```

Em caso de logout, o usuário deverá ser informado de que uma nova autenticação será necessária.

Falhas do WhatsApp não deverão causar o encerramento definitivo do servidor HTTP.

---

# 31. Requisitos não funcionais

## RNF01 — TypeScript

Todo o código de aplicação deverá ser escrito em TypeScript.

## RNF02 — Tipagem

Evitar `any` sempre que possível.

Interfaces e tipos deverão representar contratos importantes.

## RNF03 — Modularidade

Provider, HTTP, logging e configuração deverão possuir responsabilidades separadas.

## RNF04 — Testabilidade

Dependências externas deverão ser abstraídas para permitir mocks e testes isolados.

## RNF05 — Configuração externa

Configurações deverão utilizar variáveis de ambiente.

## RNF06 — Logs

Falhas relevantes deverão ser registradas com contexto suficiente para diagnóstico.

## RNF07 — Performance

O Gateway deverá ser capaz de manter sua conexão WhatsApp sem bloquear o servidor HTTP.

Operações de longa duração não deverão bloquear o event loop.

## RNF08 — Disponibilidade

Uma falha temporária da conexão WhatsApp não deverá derrubar a API.

## RNF09 — Manutenibilidade

O código deverá priorizar simplicidade, coesão e baixo acoplamento.

## RNF10 — Provider agnostic

A lógica de negócio não deverá depender diretamente de Baileys.

---

# 32. Critérios de aceite — MVP

O MVP será considerado funcional quando todos os seguintes critérios forem atendidos.

### Conexão

* [ ] O Gateway inicia corretamente.
* [ ] O Pulse consegue consultar o status.
* [ ] O Pulse consegue obter o QR Code.
* [ ] O usuário consegue escanear o QR pelo Pulse.
* [ ] O Gateway detecta a conexão.
* [ ] O Pulse exibe o estado conectado.
* [ ] A sessão permanece após reinicialização.
* [ ] Uma desconexão é detectada.
* [ ] Um logout exige nova autenticação.

### Envio

* [ ] O Pulse consegue solicitar o envio de uma mensagem.
* [ ] O Gateway valida a requisição.
* [ ] O provider recebe a mensagem.
* [ ] A mensagem é enviada ao WhatsApp.
* [ ] O Gateway retorna um resultado.
* [ ] O Pulse registra o resultado.
* [ ] Falhas são retornadas de forma estruturada.

### Campanhas

* [ ] O usuário consegue criar campanha.
* [ ] O usuário consegue selecionar leads.
* [ ] O usuário consegue adicionar múltiplas mensagens.
* [ ] O usuário consegue configurar intervalo mínimo e máximo.
* [ ] O sistema calcula intervalos dentro do range.
* [ ] O sistema cria uma fila.
* [ ] A campanha pode ser iniciada.
* [ ] A campanha pode ser pausada.
* [ ] A campanha pode ser retomada.
* [ ] A campanha pode ser cancelada.
* [ ] O progresso é exibido.
* [ ] Enviadas e falhas são contabilizadas.

### Logs

* [ ] Inicialização é registrada.
* [ ] Conexão é registrada.
* [ ] Desconexão é registrada.
* [ ] Geração de QR é registrada.
* [ ] Início de envio é registrado.
* [ ] Sucesso é registrado.
* [ ] Falha é registrada.
* [ ] Erros possuem contexto suficiente para diagnóstico.
* [ ] Credenciais não aparecem nos logs.

### Arquitetura

* [ ] Baileys está isolado atrás de `WhatsAppProvider`.
* [ ] A criação do provider utiliza Factory.
* [ ] A lógica do Pulse não depende diretamente de Baileys.
* [ ] É possível criar um provider alternativo sem reescrever as campanhas.

### Testes

* [ ] Testes unitários dos componentes críticos existem.
* [ ] Endpoints possuem testes.
* [ ] Autenticação possui testes.
* [ ] Falhas do provider possuem testes.
* [ ] O provider pode ser mockado.
* [ ] A suíte de testes não depende de uma sessão real do WhatsApp.

---

# 33. Roadmap

## Fase 1 — Gateway

```text
Bun
+
Elysia
+
Baileys
```

Implementar:

* conexão;
* QR;
* sessão;
* status;
* envio;
* API;
* autenticação;
* logs;
* testes.

---

## Fase 2 — Integração com Pulse

Implementar:

* tela WhatsApp;
* QR Code;
* status;
* envio individual;
* histórico.

---

## Fase 3 — Campanhas

Implementar:

* seleção de leads;
* mensagens;
* templates;
* intervalo;
* fila;
* progresso;
* pausa;
* retomada;
* cancelamento.

---

## Fase 4 — Observabilidade avançada

Implementar:

* eventos em tempo real;
* WebSocket/SSE;
* correlation IDs;
* métricas;
* dashboard de erros.

---

## Fase 5 — Providers adicionais

Implementar, quando necessário:

```text
BaileysProvider
MetaProvider
OutroProvider
```

Todos deverão obedecer ao contrato comum de `WhatsAppProvider`.

---

# 34. Decisões arquiteturais fundamentais

O projeto deverá seguir estas regras:

### Regra 1

**Pulse é o cérebro.**

Campanhas, leads, filas e regras comerciais pertencem ao Pulse.

### Regra 2

**Pulse WPP é o gateway.**

Ele conecta e comunica com o WhatsApp.

### Regra 3

**Baileys é uma implementação, não a arquitetura.**

O projeto não deverá ser construído em torno de APIs específicas do Baileys fora da camada do provider.

### Regra 4

**A troca de provider deve ser barata.**

O restante do sistema deverá continuar funcionando independentemente da implementação de WhatsApp utilizada.

### Regra 5

**Não antecipar complexidade.**

O MVP deverá utilizar uma única sessão e um único provider.

Multiusuário, múltiplos números, WebSockets, múltiplos providers e recursos avançados deverão ser adicionados somente quando houver necessidade real.

---

# 35. Resultado esperado

Ao final da versão 1.0, o ecossistema deverá funcionar assim:

```text
                         PULSE
                           │
                 ┌─────────┴─────────┐
                 │                   │
               Leads             Campanhas
                 │                   │
                 └─────────┬─────────┘
                           │
                         Fila
                           │
                     Mensagem
                           │
                           ▼
                    ┌─────────────┐
                    │  Pulse WPP  │
                    │             │
                    │ Elysia      │
                    │ TypeScript  │
                    │ Baileys     │
                    └──────┬──────┘
                           │
                           ▼
                       WhatsApp
```

O usuário deverá conseguir entrar no Pulse, conectar seu WhatsApp pelo QR Code, selecionar leads, criar uma campanha, definir várias mensagens, configurar um intervalo mínimo/máximo, iniciar a campanha e acompanhar em tempo real ou quase real quantas mensagens foram enviadas e quais apresentaram erro.

A implementação inicial utilizará Baileys, mas o restante do ecossistema deverá permanecer desacoplado dele, permitindo uma futura migração para outra implementação ou para a API oficial da Meta sem reescrever a lógica de campanhas do Pulse.

36. Estratégia de desenvolvimento

O desenvolvimento deverá ocorrer em duas etapas principais.

Etapa 1 — Pulse WPP independente

O pulse-wpp deverá ser desenvolvido e validado sem depender da implementação do Pulse.

Nesta etapa, deverão ser implementados:

API HTTP;
autenticação;
conexão WhatsApp;
QR Code;
persistência da sessão;
status da conexão;
envio de mensagens;
WhatsAppProvider;
BaileysProvider;
Factory;
tratamento de erros;
logs;
testes;
documentação da API.

A API deverá poder ser testada utilizando ferramentas como Postman, Insomnia ou curl.