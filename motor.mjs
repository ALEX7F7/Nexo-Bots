import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { randomInt } from 'node:crypto'

const catalog = JSON.parse(readFileSync(new URL('./catalogo.json', import.meta.url)))
export const db = new DatabaseSync(process.env.BOT_DB || 'premium.sqlite')
db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS state (chat TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS licenses (chat TEXT PRIMARY KEY, until INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS processed (chat TEXT, id TEXT, at INTEGER, PRIMARY KEY(chat,id));`)
export const expiry = chat => db.prepare('SELECT until FROM licenses WHERE chat=?').get(chat)?.until ?? 0
const get = chat => JSON.parse(db.prepare('SELECT data FROM state WHERE chat=?').get(chat)?.data ?? '{}')
const save = (chat, data) => db.prepare('INSERT OR REPLACE INTO state VALUES (?,?)').run(chat, JSON.stringify(data))
export const settings = chat => get(chat).settings ?? {}
const register = new Map()
const handlers = {}
const roles = {}
function add(name, run, role) {
  handlers[name] = run
  roles[name] = role
  const aliases = Object.values(catalog).find(group => name in group)?.[name] ?? []
  for (const key of [name,...aliases]) register.set(key,name)
}
const coins = n => Number(n).toLocaleString('es-GT') + ' coins'
const show = id => id?.split('@')[0] ?? 'usuario'
const amount = value => /^\d+$/.test(value ?? '') && Number(value) <= 1e9 ? Number(value) : 0
const toggle = value => ({on:true,off:false})[value]
const safe = (text, length = 160) => text?.trim().slice(0,length)
const normalize = text => text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'')
const ranking = (members, field) => Object.entries(members).sort((a,b) => b[1][field] - a[1][field])
  .slice(0,10).map(([id,u],i) => `${i+1}. ${u.name || show(id)} · ${u[field]}`).join('\n') || 'Todavía no hay registros.'
function member(data, id) {
  return data.members[id] ??= { wallet:0, bank:0, count:0, cooldown:{} }
}
add('premium', c => expiry(c.chat) > Date.now()
  ? '💎 Premium activo hasta ' + new Date(expiry(c.chat)).toLocaleString('es-GT',{timeZone:'America/Guatemala'})
  : '💎 Envía este ID al vendedor después de pagar para activar Premium: ' + c.chat)
const commandHelp = {
  "premium": [
    "premium",
    "Consulta la vigencia de Premium o el ID para activarlo."
  ],
  "menu": [
    "menu Economía",
    "Abre una categoría del menú."
  ],
  "ping": [
    "ping",
    "Comprueba si el bot responde."
  ],
  "botinfo": [
    "botinfo",
    "Muestra las funciones del bot."
  ],
  "status": [
    "status",
    "Consulta el estado de Premium."
  ],
  "balance": [
    "balance",
    "Muestra tus coins en la cartera y el banco."
  ],
  "economyinfo": [
    "economyinfo",
    "Consulta tu saldo de economía."
  ],
  "economyboard": [
    "economyboard",
    "Muestra el ranking por saldo total."
  ],
  "daily": [
    "daily",
    "Reclama 300 coins cada 24 horas."
  ],
  "work": [
    "work",
    "Trabaja para ganar coins."
  ],
  "crime": [
    "crime",
    "Intenta ganar coins con el riesgo de perder parte de tu saldo."
  ],
  "deposit": [
    "deposit 100",
    "Pasa coins de la cartera al banco."
  ],
  "withdraw": [
    "withdraw all",
    "Retira coins del banco a tu cartera."
  ],
  "givecoins": [
    "darcoins @Ana 500",
    "Envía coins de tu cartera. El dueño puede acreditarlas sin gastar saldo."
  ],
  "steal": [
    "steal @Ana",
    "Intenta robar coins con el riesgo de pagar una multa."
  ],
  "coinflip": [
    "coinflip 10 cara",
    "Apuesta coins a cara o cruz."
  ],
  "roulette": [
    "roulette black 10",
    "Apuesta coins a rojo (red) o negro (black)."
  ],
  "setdescription": [
    "setdescription Me gusta el anime",
    "Cambia la descripción de tu perfil."
  ],
  "setgenre": [
    "setgenre otro",
    "Actualiza el género de tu perfil."
  ],
  "delgenre": [
    "delgenre",
    "Quita el género de tu perfil."
  ],
  "setbirth": [
    "setbirth 08/05",
    "Guarda tu cumpleaños en formato día/mes."
  ],
  "delbirth": [
    "delbirth",
    "Quita tu cumpleaños del perfil."
  ],
  "birthdays": [
    "birthdays",
    "Muestra los cumpleaños de los próximos 30 días."
  ],
  "allbirthdays": [
    "allbirthdays",
    "Lista los cumpleaños registrados."
  ],
  "level": [
    "level",
    "Consulta tu nivel y experiencia."
  ],
  "leaderboard": [
    "leaderboard",
    "Muestra el ranking de experiencia."
  ],
  "profile": [
    "profile @Ana",
    "Consulta el perfil de una persona. Sin mención muestra el tuyo."
  ],
  "rollwaifu": [
    "rollwaifu",
    "Saca un personaje al azar."
  ],
  "claim": [
    "claim",
    "Reclama el personaje que acabas de sacar."
  ],
  "harem": [
    "harem",
    "Muestra tu colección de personajes."
  ],
  "gachainfo": [
    "gachainfo",
    "Consulta tu colección de gacha."
  ],
  "charinfo": [
    "charinfo Bocchi",
    "Consulta la serie y disponibilidad del personaje."
  ],
  "serielist": [
    "serielist",
    "Lista las series disponibles."
  ],
  "serieinfo": [
    "serieinfo Bocchi the Rock!",
    "Muestra los personajes de la serie."
  ],
  "deletewaifu": [
    "deletewaifu Bocchi",
    "Libera un personaje de tu colección."
  ],
  "givechar": [
    "givechar @Ana Bocchi",
    "Regala un personaje de tu colección."
  ],
  "sell": [
    "sell 100 Bocchi",
    "Pon un personaje a la venta por 100 coins."
  ],
  "removesale": [
    "removesale Bocchi",
    "Retira un personaje de la venta."
  ],
  "haremshop": [
    "haremshop",
    "Muestra los personajes en venta."
  ],
  "buycharacter": [
    "buycharacter Bocchi",
    "Compra un personaje disponible en la tienda."
  ],
  "bot": [
    "bot on",
    "Activa las funciones del bot en el grupo."
  ],
  "onlyadmin": [
    "onlyadmin on",
    "Restringe los comandos del grupo a administradores."
  ],
  "economy": [
    "economy on",
    "Activa la economía del grupo."
  ],
  "gacha": [
    "gacha on",
    "Activa el gacha del grupo."
  ],
  "welcome": [
    "welcome on",
    "Activa los avisos de bienvenida."
  ],
  "goodbye": [
    "goodbye on",
    "Activa los avisos de despedida."
  ],
  "antilink": [
    "antilink on",
    "Activa el filtro de enlaces para miembros sin permisos de administrador."
  ],
  "setwelcome": [
    "setwelcome ¡Hola {usuario}!",
    "Personaliza el mensaje de bienvenida."
  ],
  "setgoodbye": [
    "setgoodbye ¡Hasta luego, {usuario}!",
    "Personaliza el mensaje de despedida."
  ],
  "testwelcome": [
    "testwelcome",
    "Prueba el mensaje de bienvenida."
  ],
  "group": [
    "group",
    "Muestra el nombre y el ID del grupo."
  ],
  "msgcount": [
    "msgcount @Ana",
    "Consulta cuántos mensajes ha registrado el bot."
  ],
  "topcount": [
    "topcount",
    "Muestra el ranking de mensajes registrados."
  ],
  "setwarnlimit": [
    "setwarnlimit 3",
    "Ajusta el límite de advertencias."
  ],
  "warns": [
    "warns @Ana",
    "Consulta las advertencias de un miembro."
  ],
  "delwarn": [
    "delwarn @Ana",
    "Quita una advertencia al miembro mencionado."
  ],
  "warn": [
    "warn @Ana",
    "Registra una advertencia para el miembro mencionado."
  ],
  "kick": [
    "kick @Ana",
    "Expulsa del grupo al miembro mencionado."
  ],
  "promote": [
    "promote @Ana",
    "Da permisos de administrador al miembro mencionado."
  ],
  "demote": [
    "demote @Ana",
    "Quita los permisos de administrador al miembro mencionado."
  ],
  "close": [
    "close",
    "Limita el envío de mensajes a administradores."
  ],
  "open": [
    "open",
    "Permite que todos los miembros envíen mensajes."
  ],
  "tag": [
    "tag Reunión a las 8",
    "Envía un aviso con menciones a todos los miembros."
  ],
  "del": [
    "del",
    "Responde a un mensaje con este comando para eliminarlo."
  ],
  "sticker": [
    "sticker",
    "Envía una foto con este texto o responde a una foto para convertirla."
  ],
  "toimage": [
    "toimage",
    "Responde a un sticker para convertirlo en imagen."
  ],
  "getpic": [
    "getpic @Ana",
    "Consulta la foto de perfil de la persona mencionada."
  ]
}
add('menu', c => {
  const sections = Object.entries(catalog).map(([section, commands]) => [section,Object.keys(commands).filter(name => handlers[name])])
    .filter(([,names]) => names.length)
  if (c.text) {
    const section = sections.find(([name]) => normalize(name) === normalize(c.text))
    return section ? '💎 *Nexo-Bots Premium*\n\n' + formatMenuSection(section)
      : 'Categoría desconocida. Escribe #menu para ver todos los comandos.'
  }

  const status = expiry(c.chat) > Date.now() ? 'Acceso activo.' : 'El vendedor debe activar tu acceso.'
  return {
    action: 'menu',
    text: ['💎 *Nexo-Bots Premium*\nAquí tienes la lista de comandos.\n' + status,
      ...sections.map(formatMenuSection)].join('\n\n')
  }
})

function formatMenuSection([title, names]) {
  const entries = names.map(name => {
    const [example, description] = commandHelp[name]
    const command = '#' + example.split(' ')[0]
    const aliases = catalog[title][name].map(alias => '#' + alias)
    if (name === 'givecoins') {
      aliases.splice(aliases.indexOf('#darcoins'), 1, '#givecoins')
    }
    return [
      '✦ *' + command + '*',
      description + (roles[name] === 'admin' ? ' (Administradores del grupo)' : ''),
      'Ejemplo · #' + example,
      ...(aliases.length ? ['Alias · ' + aliases.join(' · ')] : [])
    ].join('\n')
  })
  return '━━ *' + title + '* ━━\n\n' + entries.join('\n\n')
}
add('ping', () => '🏓 Bot en línea.')
add('botinfo', () => '💎 Bot Premium · Economía, gacha, perfiles, stickers y moderación.')
add('status', c => handlers.premium(c))
add('balance', c => `Cartera: ${coins(c.other.wallet)} | Banco: ${coins(c.other.bank)}`)
add('economyinfo', c => handlers.balance(c))
add('economyboard', c => {
  const totals = Object.fromEntries(Object.entries(c.data.members).map(([id,u]) => [id,{...u,total:u.wallet+u.bank}]))
  return ranking(totals,'total')
})
function reward(c, name, period, value) {
  const now = Date.now()
  const left = (c.user.cooldown[name] ?? 0) + period - now
  if (left > 0) return 'Disponible en ' + Math.ceil(left/60000) + ' min.'
  c.user.cooldown[name] = now
  c.user.wallet += value
  return value >= 0 ? 'Ganaste ' + coins(value) : 'Perdiste ' + coins(-value)
}
add('daily', c => reward(c,'daily',86400000,300))
add('work', c => reward(c,'work',900000,randomInt(40,121)))
add('crime', c => reward(c,'crime',1800000,randomInt(2) ? 140 : -Math.min(c.user.wallet,75)))
for (const [name, from, to] of [['deposit','wallet','bank'],['withdraw','bank','wallet']]) {
  add(name,c => {
    const n = c.text === 'all' ? c.user[from] : amount(c.args[0])
    if (!n || n > c.user[from]) return `Usa #${name} cantidad o all. Revisa tu saldo.`
    c.user[from] -= n
    c.user[to] += n
    return 'Moviste ' + coins(n)
  })
}
add('givecoins', c => {
  const usage = 'Usa #darcoins @mención 50, #darcoins +50212345678 50 o #darcoins "Nombre Apellido" 50.'
  const match = /^(.+?)\s+(\d+)$/u.exec(c.text)
  const n = amount(match?.[2])
  if (!n) return usage

  const recipientText = match[1]
  const phone = /^\+?([1-9]\d{6,14})$/.exec(recipientText)?.[1]
  let target = recipientText.startsWith('@') ? c.target : c.phoneTargets?.[phone]
  if (phone && !target) return 'No encontré ese número entre los miembros del grupo. Usa una mención de WhatsApp.'
  if (!target) {
    if (!c.group || match[1].startsWith('@')) return usage
    const name = match[1].replace(/^"([^"]+)"$/u, '$1').trim()
    const matches = Object.entries(c.data.members).filter(([id, user]) =>
      c.groupMembers?.includes(id) && user.name && normalize(user.name) === normalize(name)
    )
    if (matches.length > 1) return 'Hay varias personas con ese nombre. Usa @mención para elegir.'
    if (!matches.length) return 'No encontré ese nombre. Usa @mención o pídele que escriba en el grupo.'
    target = matches[0][0]
  }
  if (c.group && c.groupMembers && !c.groupMembers.includes(target)) return 'La persona debe estar en el grupo.'
  const recipient = member(c.data,target)
  if (!Number.isSafeInteger(recipient.wallet + n)) return 'El saldo resultante supera el límite.'
  if (c.owner === true) {
    recipient.wallet += n
    return '💎 Acreditaste ' + coins(n) + ' a ' + (recipient.name || show(target)) + '.'
  }
  if (target === c.sender) return 'Elige a otra persona para transferir coins.'
  if (n > c.user.wallet) return 'Saldo insuficiente en tu cartera. Usa #balance o retira coins del banco.'
  c.user.wallet -= n
  recipient.wallet += n
  return 'Transferiste ' + coins(n) + ' a ' + (recipient.name || show(target)) + '.'
})
add('steal', c => {
  if (!c.target || c.target === c.sender || !c.other.wallet) return 'Menciona a otro jugador con coins en su cartera.'
  if (Date.now() - (c.user.cooldown.steal ?? 0) < 3600000) return 'Puedes intentar robar una vez por hora.'
  c.user.cooldown.steal = Date.now()
  if (!randomInt(3)) {
    const n = Math.min(50,c.other.wallet)
    c.other.wallet -= n
    c.user.wallet += n
    return 'Robaste ' + coins(n)
  }
  const fine = Math.min(25,c.user.wallet)
  c.user.wallet -= fine
  return 'Te atraparon. Multa: ' + coins(fine)
})
for (const [name, sides] of [['coinflip',['cara','cruz']],['roulette',['red','black']]]) {
  add(name,c => {
    const [value, choice] = name === 'coinflip' ? c.args : [...c.args].reverse()
    const n = amount(value)
    if (!n || n > c.user.wallet || !sides.includes(choice)) return name === 'coinflip'
      ? 'Usa #coinflip cantidad cara/cruz con saldo suficiente.'
      : 'Usa #roulette red/black cantidad con saldo suficiente.'
    const result = sides[randomInt(2)]
    c.user.wallet += result === choice ? n : -n
    return result + ' · ' + (result === choice ? 'Ganaste ' : 'Perdiste ') + coins(n)
  })
}
add('setdescription',c => { c.user.description = safe(c.text); return 'Descripción actualizada.' })
add('setgenre',c => {
  if (!['hombre','mujer','otro'].includes(c.text)) return 'Usa #setgenre hombre, mujer u otro.'
  c.user.genre = c.text
  return 'Género actualizado.'
})
add('delgenre',c => { delete c.user.genre; return 'Género eliminado.' })
add('setbirth',c => {
  const match = /^(\d{1,2})[/-](\d{1,2})$/.exec(c.text)
  if (!match) return 'Usa #setbirth DD/MM.'
  const [,d,m] = match.map(Number)
  const date = new Date(Date.UTC(2000,m-1,d))
  if (date.getUTCDate() !== d || date.getUTCMonth() !== m-1) return 'La fecha no es válida.'
  c.user.birth = String(d).padStart(2,'0')+'/'+String(m).padStart(2,'0')
  return 'Cumpleaños actualizado.'
})
add('delbirth',c => { delete c.user.birth; return 'Cumpleaños eliminado.' })
function birthdays(c, upcoming) {
  const local = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guatemala',dateStyle:'short'}).formatToParts(new Date())
  const part = key => Number(local.find(x=>x.type===key).value)
  const now = Date.UTC(2000,part('month')-1,part('day'))
  return Object.entries(c.data.members).filter(([,u])=>u.birth).map(([id,u])=>{
    const [d,m]=u.birth.split('/').map(Number)
    const days=((Date.UTC(2000,m-1,d)-now)/86400000+366)%366
    return {days,label:`${u.birth} · ${u.name || show(id)}`}
  }).filter(x=>!upcoming || x.days<=30).sort((a,b)=>a.days-b.days).map(x=>x.label).join('\n') || 'Sin cumpleaños registrados para este período.'
}
add('birthdays',c=>birthdays(c,true))
add('allbirthdays',c=>birthdays(c,false))
add('level',c=>`Nivel ${Math.floor(c.other.count/20)+1} · ${c.other.count} XP`)
add('leaderboard',c=>ranking(c.data.members,'count'))
add('profile',c=>[c.other.name||show(c.target||c.sender), c.other.description, c.other.genre, c.other.birth, handlers.level(c)].filter(Boolean).join('\n'))

const characters = [
  ['Bocchi','Bocchi the Rock!'],['Nijika','Bocchi the Rock!'],['Kita','Bocchi the Rock!'],
  ['Anya','Spy × Family'],['Yor','Spy × Family'],['Loid','Spy × Family'],
  ['Tanjiro','Demon Slayer'],['Nezuko','Demon Slayer'],['Zenitsu','Demon Slayer'],
  ['Luffy','One Piece'],['Nami','One Piece'],['Zoro','One Piece'],
  ['Frieren','Frieren'],['Fern','Frieren'],['Stark','Frieren']
]
const find = text => characters.find(([name])=>normalize(name)===normalize(text))
add('rollwaifu',c=>{
  if (Date.now()-(c.user.cooldown.roll??0)<60000) return 'Puedes tirar una vez por minuto.'
  const pool=characters.filter(([name])=>!c.data.claims[name])
  if (!pool.length) return 'Todos los personajes están reclamados.'
  const [name,series]=pool[randomInt(pool.length)]
  c.user.cooldown.roll=Date.now()
  c.user.roll={name,until:Date.now()+60000}
  return `🎲 ${name} · ${series}\nEscribe #claim en los próximos 60 segundos.`
})
add('claim',c=>{
  const roll=c.user.roll
  if (!roll || roll.until<Date.now()) return 'Usa #rollwaifu para sacar un personaje.'
  if (c.data.claims[roll.name]) return 'Alguien ya reclamó ese personaje.'
  c.data.claims[roll.name]={owner:c.sender}
  delete c.user.roll
  return 'Reclamaste a '+roll.name
})
add('harem',c=>Object.entries(c.data.claims).filter(([,v])=>v.owner===(c.target||c.sender)).map(([n])=>n).join(', ') || 'Sin personajes.')
add('gachainfo',c=>handlers.harem(c))
add('charinfo',c=>{
  const char=find(c.text)
  return char ? `${char[0]} · ${char[1]} · ${c.data.claims[char[0]]?'Reclamado':'Disponible'}` : 'Usa #charinfo nombre.'
})
add('serielist',()=>[...new Set(characters.map(([,s])=>s))].join('\n'))
add('serieinfo',c=>characters.filter(([,s])=>normalize(s)===normalize(c.text)).map(([n])=>n).join(', ') || 'Consulta #serielist.')
add('deletewaifu',c=>{
  const name=find(c.text)?.[0]
  if (c.data.claims[name]?.owner!==c.sender) return 'Ese personaje no está en tu colección.'
  delete c.data.claims[name]
  return name+' vuelve a estar disponible.'
})
add('givechar',c=>{
  const name=find(c.args.slice(1).join(' '))?.[0]
  if (!c.target || c.target===c.sender || c.data.claims[name]?.owner!==c.sender) return 'Usa #givechar @mención personaje que posees.'
  c.data.claims[name]={owner:c.target}
  return 'Regalaste a '+name
})
add('sell',c=>{
  const price=amount(c.args[0]), name=find(c.args.slice(1).join(' '))?.[0]
  if (!price || c.data.claims[name]?.owner!==c.sender) return 'Usa #sell precio personaje que posees.'
  c.data.claims[name].price=price
  return name+' está en venta por '+coins(price)
})
add('removesale',c=>{
  const name=find(c.text)?.[0]
  if (c.data.claims[name]?.owner!==c.sender) return 'Ese personaje no está en tu colección.'
  delete c.data.claims[name].price
  return 'Venta retirada.'
})
add('haremshop',c=>Object.entries(c.data.claims).filter(([,v])=>v.price).map(([n,v])=>n+' · '+coins(v.price)).join('\n') || 'Tienda vacía.')
add('buycharacter',c=>{
  const name=find(c.text)?.[0], listing=c.data.claims[name]
  if (!listing?.price || listing.owner===c.sender || c.user.wallet<listing.price) return 'Revisa la oferta y tu saldo. Usa #haremshop.'
  c.user.wallet-=listing.price
  member(c.data,listing.owner).wallet+=listing.price
  c.data.claims[name]={owner:c.sender}
  return 'Compraste a '+name
})

for (const name of ['bot','onlyadmin','economy','gacha','welcome','goodbye','antilink']) {
  add(name,c=>{
    const value=toggle(c.text)
    if (typeof value!=='boolean') return `Usa #${name} on/off.`
    c.data.settings[name]=value
    return `#${name} · ${c.text}`
  },'admin')
}
for (const name of ['welcome','goodbye']) {
  add('set'+name,c=>{
    if (!c.text) return `Usa #set${name} mensaje con {usuario}.`
    c.data.settings[name+'Text']=safe(c.text,500)
    return 'Mensaje guardado.'
  },'admin')
}
add('testwelcome',c=>greeting(c.data.settings,'welcome',c.sender),'admin')
export function greeting(config, key, id) {
  return (config[key+'Text'] ?? (key==='welcome'?'👋 ¡Te damos la bienvenida, {usuario}!':'👋 Hasta pronto, {usuario}.'))
    .replaceAll('{usuario}','@'+show(id))
}
add('group',c=>c.group ? 'Grupo: '+c.groupName+'\nID: '+c.chat : 'Usa #group dentro del grupo.')
add('msgcount',c=>`Mensajes registrados: ${c.other.count}`)
add('topcount',c=>ranking(c.data.members,'count'))
add('setwarnlimit',c=>{
  const n=amount(c.text)
  if (!n || n>20) return 'Usa #setwarnlimit con un número del 1 al 20.'
  c.data.settings.warnLimit=n
  return 'Límite actualizado.'
},'admin')
add('warns',c=>`Advertencias: ${c.other.warnings??0}/${c.data.settings.warnLimit??3}`)
add('delwarn',c=>{
  if (!c.target) return 'Menciona al usuario.'
  c.other.warnings=Math.max(0,(c.other.warnings??0)-1)
  return handlers.warns(c)
},'admin')
add('warn',c=>{
  if (!c.target || c.targetAdmin || c.targetBot) return 'Menciona a un miembro sin permisos de administrador.'
  c.other.warnings=(c.other.warnings??0)+1
  const text=handlers.warns(c)
  return c.other.warnings >= (c.data.settings.warnLimit??3) ? text+' · Límite alcanzado. Usa #kick si corresponde.' : text
},'admin')
for (const [name,action] of [['kick','remove'],['promote','promote'],['demote','demote']]) {
  add(name,c=>{
    if (!c.target || c.targetBot || c.targetOwner || c.target === c.sender) return 'Menciona a otro miembro del grupo.'
    return {action:'participants',target:c.target,mode:action}
  },'admin')
}
for (const [name,mode] of [['close','announcement'],['open','not_announcement']]) {
  add(name,()=>({action:'groupMode',mode}),'admin')
}
add('tag',c=>({action:'tag',text:safe(c.text,500)||'Aviso del grupo'}),'admin')
add('del',()=>({action:'delete'}),'admin')
add('sticker',()=>({action:'sticker'}))
add('toimage',()=>({action:'toimage'}))
add('getpic',c=>({action:'getpic',target:c.target||c.sender}))

const free = new Set(['menu','ping','premium','status','botinfo'])
export const isTransfer = body => register.get(/^#([^\s]+)/.exec(body.trim())?.[1].toLowerCase()) === 'givecoins'
export const isBalance = body => register.get(/^#([^\s]+)/.exec(body.trim())?.[1].toLowerCase()) === 'balance'
const sectionOf = name => Object.keys(catalog).find(section=>name in catalog[section])
const known = new Set(Object.values(catalog).flatMap(section=>Object.entries(section).flatMap(([name,aliases])=>[name,...aliases])))
export function receive(input) {
  const [,raw,text=''] = /^#([^\s]+)(?:\s+([\s\S]*))?$/.exec(input.body.trim()) ?? []
  const key = raw?.toLowerCase()
  const name = register.get(key)
  db.exec('BEGIN IMMEDIATE')
  try {
    const active=expiry(input.chat)>Date.now()
    if (!active && !free.has(name)) return key && known.has(key) ? handlers.premium(input) : undefined
    const first = db.prepare('INSERT OR IGNORE INTO processed VALUES (?,?,?)').run(input.chat,input.id,Date.now())
    if (!first.changes) return
    const data=get(input.chat)
    data.settings??={}
    data.members??={}
    data.claims??={}
    const user=member(data,input.sender)
    if (active) {
      user.count++
      if (input.displayName) user.name=safe(input.displayName,60)
    }
    const c={...input,data,user,other:input.target ? member(data,input.target) : user,text:text.trim(),args:text.trim().split(/\s+/)}
    const section=sectionOf(name)
    let result
    if (active && data.settings.antilink && input.group && !input.admin && /(?:https?:\/\/|www\.)\S+/i.test(input.body)) {
      result={action:'antilink'}
    } else if (name) {
      if (roles[name]==='admin' && (!input.group || !input.admin)) result='Este comando requiere ser administrador del grupo.'
      else if (data.settings.bot===false && !free.has(name) && name!=='bot') result=undefined
      else if (data.settings.onlyadmin && !input.admin && !free.has(name)) result='Solo administradores pueden usar este comando.'
      else if (section==='Economía' && data.settings.economy===false && name!=='economy') result='La economía está desactivada.'
      else if (section==='Gacha' && data.settings.gacha===false) result='El gacha está desactivado.'
      else result=handlers[name](c)
    } else if (key && known.has(key)) result='Este comando figura en el catálogo original y está pendiente. Usa #menu para ver los disponibles.'
    save(input.chat,data)
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  } finally {
    if (db.isTransaction) db.exec('COMMIT')
  }
}
