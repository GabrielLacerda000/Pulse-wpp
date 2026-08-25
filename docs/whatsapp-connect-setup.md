# Conectando o WhatsApp (Baileys)

Passo a passo para sair do provider stub e conectar um número real via Baileys.

## 1. Configurar o `.env`

```
WHATSAPP_PROVIDER=baileys
WHATSAPP_SESSION_PATH=./sessions
PULSE_WPP_API_KEY=<alguma-chave>
```

Hoje o padrão é `baileys-stub`, que não conecta de verdade.

## 2. Subir o servidor

```
bun run dev
```

(ou o script equivalente do `package.json`)

## 3. Iniciar a conexão

```
POST /whatsapp/connect
```

## 4. Pegar o QR e escaneá-lo

```
GET /whatsapp/qr
```

Isso retorna `{ qr: "<string>" }` — é a string crua do Baileys, não um PNG. É preciso renderizá-la como QR code para escanear com o celular. Duas opções rápidas:

- instalar `qrcode-terminal` e imprimir no console (comum em protótipos Baileys), ou
- instalar `qrcode` e gerar um PNG/data-URL a partir da string, servido por outra rota ou script local.

Nenhum dos dois está no projeto ainda.

## 5. Escanear no WhatsApp do celular

Configurações → Aparelhos conectados → Conectar um aparelho.

## 6. Confirmar conexão

```
GET /whatsapp/status
```

Deve retornar `status: "connected"` com o `phone`.

## Persistência da sessão

A sessão fica persistida em `WHATSAPP_SESSION_PATH` (`./sessions`), então reconexões depois não pedem QR de novo — só volta a pedir se o WhatsApp deslogar o aparelho (`status: "logged_out"`).
