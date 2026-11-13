import { db,expiry } from './motor.mjs'

const [action,chat,days]=process.argv.slice(2)
if (action==='listar') {
  for (const row of db.prepare('SELECT * FROM licenses ORDER BY until DESC').all()) {
    console.log(row.chat, new Date(row.until).toISOString(),row.until>Date.now()?'activo':'vencido')
  }
} else if (!/^\d+(?:-\d+)?@(?:g\.us|s\.whatsapp\.net|lid)$/.test(chat??'')) {
  console.error('Copia el ID exacto que te entrega #premium.')
  process.exitCode=1
} else if (action==='activar' && /^\d+$/.test(days??'') && Number(days)>=1 && Number(days)<=3650) {
  const now=Date.now()
  db.prepare(`INSERT INTO licenses VALUES (?,?) ON CONFLICT(chat)
    DO UPDATE SET until=max(licenses.until,?)+?`).run(chat,now+Number(days)*86400000,now,Number(days)*86400000)
  console.log('Activo hasta',new Date(expiry(chat)).toISOString())
} else if (action==='revocar') {
  db.prepare('DELETE FROM licenses WHERE chat=?').run(chat)
  console.log('Acceso revocado.')
} else {
  console.error('Usa activar ID DÍAS (1 a 3650), revocar ID o listar.')
  process.exitCode=1
}
