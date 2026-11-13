# Bot Premium para WhatsApp

Bot en español con licencias por grupo o chat privado. Las compras se verifican manualmente. Las coins son puntos del juego.

## Instalar y probar en Termux (Android)

Descarga el ZIP en **Descargas** del teléfono. Abre Termux y ejecuta:

```bash
pkg update
pkg install nodejs-lts ffmpeg unzip
termux-setup-storage
unzip -o ~/storage/downloads/Bot_Premium_WhatsApp.zip -d ~
cd ~/bot-premium
bash iniciar-termux.sh
```

Acepta el permiso de archivos al ejecutar `termux-setup-storage`. Si el navegador cambió el nombre del ZIP, usa el nombre que aparece en Descargas. Extrae el bot en la carpeta privada de Termux con el comando anterior.

Escribe tu número de dueño, por ejemplo `50212345678`. La primera vez, elige cómo vincular WhatsApp:

- **A · Código QR.** Escanea el QR de Termux desde WhatsApp → Dispositivos vinculados → Vincular un dispositivo. Necesitarás el QR visible en otra pantalla para escanearlo con el teléfono.
- **B · Código de 8 caracteres.** Escribe el número de la cuenta que vas a vincular o presiona Enter para usar el número del dueño. Desde el mismo teléfono, abre WhatsApp → Dispositivos vinculados → Vincular un dispositivo → Vincular con número de teléfono. Ingresa el código que muestra Termux.

El bot debe mostrar «Bot vinculado». Mantén Termux en ejecución mientras lo uses. Al reiniciar con una sesión guardada, el bot se conecta directamente.

### Probar la economía

1. Agrega la cuenta vinculada a un grupo de prueba. En el grupo escribe `#premium` para ver su ID.
2. Abre otra sesión de Termux. Ejecuta `cd ~/bot-premium` y `npm run licencia -- activar ID 1`, reemplazando `ID` por el valor exacto de WhatsApp. Esto activa un día de prueba sin realizar un pago.
3. Desde tu cuenta de dueño escribe `#darcoins @TuUsuario 50000` con una mención real, o usa tu número internacional. Consulta el resultado con `#balance`.

Para volver a iniciar el bot ejecuta `cd ~/bot-premium` y `bash iniciar-termux.sh`. Los datos y la vinculación se conservan en la carpeta del bot.

## Instalar desde GitHub en Termux

Sube el contenido de `bot-premium` a la raíz de tu repositorio, incluido `.gitignore`. Sustituye la URL por la de tu repositorio.

```bash
pkg update
pkg install -y git
git clone https://github.com/TU_USUARIO/Bot-Premium-WhatsApp.git
cd Bot-Premium-WhatsApp
bash iniciar-termux.sh --install
```

Si prefieres instalar las dependencias manualmente, ejecuta dentro del repositorio:

```bash
pkg install -y nodejs-lts ffmpeg
npm ci --omit=optional
bash iniciar-termux.sh
```

## Ejecutar en segundo plano con PM2

Primero vincula WhatsApp con **A (QR)** o **B (código de 8 caracteres)**. Cuando aparezca «Bot vinculado», detén esa ejecución con **Ctrl+C**. Desde la misma carpeta:

```bash
bash iniciar-termux.sh --pm2
pm2 logs bot-premium
```

El script instala PM2 si falta, pide el número del dueño si todavía no lo exportaste y guarda el proceso. Sal de los registros con **Ctrl+C** para volver a la terminal. Para detener el bot y liberar el bloqueo de suspensión:

```bash
pm2 stop bot-premium
termux-wake-unlock
```

Para reanudar, usa otra vez `bash iniciar-termux.sh --pm2`. Si Android detiene Termux o reinicias el teléfono, abre Termux y ejecuta ese comando de nuevo. Android puede suspender o cerrar el proceso incluso con PM2.

## Instalar en Windows

1. Instala Node.js 24 LTS desde https://nodejs.org/ y FFmpeg con el codificador libwebp disponible en el PATH para los stickers.
2. Extrae el ZIP y abre PowerShell o CMD en la carpeta `bot-premium`.
3. Ejecuta `npm ci` y luego `npm start`.
4. En el teléfono abre WhatsApp → Dispositivos vinculados → Vincular un dispositivo y escanea el QR.
5. Desde otro número escribe `#menu` o `#premium`. Para usarlo en un grupo, agrega la cuenta del bot. Dale permisos de administrador si va a moderar.

La conexión usa Baileys, una integración no oficial con WhatsApp Web. Requiere Internet y que el proceso permanezca abierto. Usa una cuenta dedicada al bot y vincúlala solo en un equipo bajo tu control. Evita difusiones y mensajes sin consentimiento. Ejecuta una sola instancia por sesión.

## Activar después de una compra

1. El cliente envía `#premium` en el grupo o chat que compró y te pasa el ID mostrado.
2. Comprueba el pago por tu medio de cobro.
3. En otra terminal, dentro de la misma carpeta del bot, activa el ID real. Este ejemplo añade 30 días.

```powershell
npm run licencia -- activar 1234567890@g.us 30
npm run licencia -- listar
npm run licencia -- revocar 1234567890@g.us
```

Activar de nuevo añade días a la fecha vigente. Si venció, empieza desde el momento de la activación. Todos los miembros del grupo con licencia pueden usar los comandos según los permisos del grupo. El acceso privado cubre ese chat individual. La licencia se guarda en `premium.sqlite`. Respalda la base con el bot detenido y protege la carpeta `sesion`, que contiene las credenciales. Cada activación se ejecuta una vez por compra. El bot no recibe pagos ni emite códigos para vincular cuentas de clientes.

## Configurar al dueño

Antes de iniciar el bot en PowerShell, escribe tu número personal en formato internacional. Reemplaza el número de ejemplo por el tuyo.

```powershell
$env:BOT_OWNER_PHONE = "50212345678"
npm start
```

Configura esa variable cada vez que abras una nueva terminal. Puede ser tu número personal aunque uses otro para vincular el bot. El permiso se verifica con la identidad de WhatsApp del remitente. Ser administrador de un grupo no concede ese permiso.

En un grupo con Premium activo, el dueño puede escribir `#darcoins @Alex 50000` para crear 50,000 coins y acreditárselas, incluso con saldo cero. Si WhatsApp no te deja mencionarte, escribe tu número internacional con `#darcoins +50212345678 50000`. También puedes acreditar coins a otro miembro. Usa `#balance` para consultar tu cartera. Si el número no se puede relacionar con un miembro, selecciona al usuario con el @ de WhatsApp.

## Transferir coins

- `#darcoins @Ana 50`. Selecciona a Ana con la mención de WhatsApp.
- `#darcoins "Ana López" 50`. Usa el nombre completo con el que la persona ya escribió en el grupo mientras Premium estaba activo. Si hay dos nombres iguales, usa la mención.

Para los demás usuarios, las coins salen de su propia cartera y requieren saldo suficiente. Usa `#balance` para ver tu saldo. También puedes usar `#givecoins` o `#pay`.

## Actualizar una instalación anterior

Detén el bot. Copia los archivos nuevos sobre la misma carpeta y conserva `sesion` y `premium.sqlite`. Ejecuta `npm ci` y `npm start` desde esa carpeta para seguir usando tus licencias y saldos.

## Comandos

`#menu` muestra el menú real. Usa `#menu Economía`, `#menu Gacha`, `#menu Perfiles`, `#menu Stickers` o `#menu Administración`. Los alias del catálogo se conservan para los comandos implementados.

- Economía. `#daily`, `#work`, `#balance`, `#deposit 100`, `#withdraw all`, `#darcoins @mención 50`, `#coinflip 10 cara`, `#roulette black 10`, `#crime`, `#steal @mención` y ranking.
- Gacha. Tira con `#rollwaifu`, reclama con `#claim` y consulta `#harem`. Usa `#sell 100 Nombre`, `#haremshop` y `#buycharacter Nombre` para vender o comprar personajes. Hay 15 personajes de ejemplo.
- Perfiles. `#profile`, `#setbirth DD/MM`, `#birthdays`, `#setdesc texto`, `#level` y `#leaderboard`. Los mensajes registrados en el chat activo suman XP.
- Stickers. Envía una foto con `#sticker` en el pie o responde a una foto. Responde a un sticker con `#toimage` para convertirlo en PNG.
- Grupos. `#welcome on`, `#setwelcome ¡Hola {usuario}!`, `#goodbye on`, `#warn @mención`, `#warns @mención`, `#kick @mención`, `#promote @mención`, `#demote @mención`, `#open`, `#close`, `#antilink on`, `#tag mensaje` y `#onlyadmin on`. Las expulsiones por advertencias se hacen manualmente con `#kick`. El filtro de enlaces elimina mensajes con enlaces web de participantes sin permisos de administrador.

`catalogo.json` conserva los nombres y alias de la lista de referencia. Están pendientes UNO, descargas, reacciones de anime, contenido adulto, registro de sub-bots, paquetes de stickers, stickers de video y varios comandos adicionales del catálogo. El menú solo anuncia los implementados.

El motor se probó con mensajes simulados. Para verificar QR, envíos y moderación de extremo a extremo, vincula la cuenta y prueba en un grupo que administres.
