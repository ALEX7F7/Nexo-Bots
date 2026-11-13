import makeWASocket, { DisconnectReason, useMultiFileAuthState, jidNormalizedUser, normalizeMessageContent, downloadMediaMessage } from '@whiskeysockets/baileys'
import qrTerminal from 'qrcode-terminal'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { db, expiry, receive, settings, greeting, isTransfer, isBalance } from './motor.mjs'

const ownerNumber=(process.env.BOT_OWNER_PHONE??'').trim().replace(/^\+/,'')
if (ownerNumber && !/^[1-9]\d{6,14}$/.test(ownerNumber)) {
  throw new Error('BOT_OWNER_PHONE debe ser un número internacional sin espacios, por ejemplo 50212345678.')
}
const pairingPhone=process.env.BOT_PAIR_PHONE?.trim().replace(/^\+/,'')
if (pairingPhone && !/^[1-9]\d{6,14}$/.test(pairingPhone)) {
  throw new Error('BOT_PAIR_PHONE debe incluir el código de país, sin espacios.')
}
const ownerJid=ownerNumber ? ownerNumber+'@s.whatsapp.net' : undefined
if (!ownerJid) console.log('Configura BOT_OWNER_PHONE para activar la entrega de coins del dueño.')

const {state,saveCreds}=await useMultiFileAuthState('sesion')
let retry=1000
async function start() {
  const sock=makeWASocket({auth:state, markOnlineOnConnect:false})
  const reply=(chat,text,quoted)=>sock.sendMessage(chat,{text:String(text).slice(0,4000)},{quoted})
  sock.ev.on('creds.update',saveCreds)
  let requestingCode=false
  sock.ev.on('connection.update',({qr,connection,lastDisconnect})=>{
    if (qr && !pairingPhone) qrTerminal.generate(qr,{small:true})
    if (qr && pairingPhone && !state.creds.registered && !requestingCode) {
      requestingCode=true
      sock.requestPairingCode(pairingPhone).then(code=>{
        console.log('Código de vinculación:', code)
        console.log('WhatsApp → Dispositivos vinculados → Vincular un dispositivo → Vincular con número de teléfono.')
      }).catch(error=>{
        requestingCode=false
        console.error('No se pudo solicitar el código:', error.message)
      })
    }
    if (connection==='open') { retry=1000; console.log('Bot vinculado.') }
    if (connection==='close') {
      if (lastDisconnect?.error?.output?.statusCode===DisconnectReason.loggedOut) {
        console.log('Sesión cerrada. Para volver a vincular, elimina la carpeta sesion y reinicia.')
        return
      }
      setTimeout(()=>start().catch(console.error),retry)
      retry=Math.min(retry*2,30000)
    }
  })
  let queue=Promise.resolve()
  sock.ev.on('messages.upsert',({type,messages})=>{
    if (type!=='notify') return
    for (const msg of messages) queue=queue.then(()=>handle(msg)).catch(error=>console.error(error.message))
  })
  async function handle(msg) {
    const {key}=msg
    const chat=key.remoteJid
    if (!key.id || !chat || !/@(?:g\.us|s\.whatsapp\.net|lid)$/.test(chat)) return
    const group=chat.endsWith('@g.us')
    const content=normalizeMessageContent(msg.message)
    if (!content) return
    const envelope=content.extendedTextMessage??content.imageMessage??content.videoMessage??content.stickerMessage
    const ctx=envelope?.contextInfo
    const body=content.conversation??envelope?.text??envelope?.caption??''
    if (!body && !Object.keys(content).some(k=>['imageMessage','videoMessage','stickerMessage','audioMessage','documentMessage'].includes(k))) return
    const transfer=isTransfer(body)
    if (key.fromMe && (!ownerJid || !group || (!transfer && !isBalance(body) && !/^#(?:premium|menu)(?:\s|$)/i.test(body.trim())))) return
    const config=settings(chat)
    const meta=group && (body.trimStart().startsWith('#') || config.antilink) ? await sock.groupMetadata(chat) : undefined
    const ids=p=>[p?.id,p?.lid,p?.phoneNumber].filter(Boolean).map(jidNormalizedUser)
    const participant=(...values)=>meta?.participants.find(p=>ids(p).some(id=>values.filter(Boolean).map(jidNormalizedUser).includes(id)))
    const canonical=(id,alt)=>jidNormalizedUser(participant(id,alt)?.id||id)
    const rawSender=group ? key.participant ?? (key.fromMe ? sock.user?.id : undefined) : chat
    if (!rawSender) return
    const senderAlt=group ? key.participantAlt : key.remoteJidAlt
    const sender=canonical(rawSender,senderAlt)
    const bot=participant(sock.user?.id,sock.user?.lid)
    const senderMember=participant(rawSender,senderAlt)
    const mapping=sock.signalRepository.lidMapping
    const senderIds=[rawSender,senderAlt,...ids(senderMember),...(key.fromMe ? ids(sock.user) : [])]
      .filter(Boolean).map(jidNormalizedUser)
    let owner=Boolean(ownerJid && senderIds.includes(ownerJid))
    if (ownerJid && !owner && (transfer || key.fromMe)) {
      const lid=senderIds.find(id=>id.endsWith('@lid'))
      if (lid) owner=jidNormalizedUser(await mapping.getPNForLID(lid) ?? '')===ownerJid
    }
    if (key.fromMe && !owner) return

    const rawTarget=ctx?.mentionedJid?.[0]??(transfer ? undefined : ctx?.participant)
    let target=rawTarget ? canonical(rawTarget) : undefined
    if (transfer && rawTarget && group && !participant(target)) {
      const normalized=jidNormalizedUser(rawTarget)
      const alternate=normalized.endsWith('@lid') ? await mapping.getPNForLID(normalized) : await mapping.getLIDForPN(normalized)
      if (alternate) target=canonical(rawTarget,alternate)
    }
    const phoneTargets=Object.create(null)
    const phone=transfer && group ? /^#\S+\s+\+?([1-9]\d{6,14})\s+\d+$/u.exec(body.trim())?.[1] : undefined
    if (phone) {
      const pn=phone+'@s.whatsapp.net'
      const matched=participant(pn) ?? participant(await mapping.getLIDForPN(pn))
      if (matched) phoneTargets[phone]=jidNormalizedUser(matched.id)
    }
    const targetParticipant=target ? participant(target) : undefined
    const result=receive({id:key.id,chat,group,body,sender,target,owner,phoneTargets,displayName:msg.pushName,
      groupName:meta?.subject,groupMembers:meta?.participants.map(p=>jidNormalizedUser(p.id)),admin:Boolean(senderMember?.admin),
      targetAdmin:Boolean(targetParticipant?.admin),targetOwner:targetParticipant?.admin==='superadmin',
      targetBot:Boolean(target && ids(bot).includes(target))})
    if (!result) return
    if (typeof result==='string') return reply(chat,result,msg)
    try {
      switch (result.action) {
        case 'participants': {
          if (!bot?.admin || !targetParticipant) return reply(chat,'El bot debe ser administrador y el usuario debe estar en el grupo.',msg)
          const [response]=await sock.groupParticipantsUpdate(chat,[targetParticipant.id],result.mode)
          return reply(chat,String(response?.status)==='200'?'Permisos o miembros actualizados.':'WhatsApp rechazó el cambio.',msg)
        }
        case 'groupMode':
          if (!bot?.admin) return reply(chat,'El bot debe ser administrador.',msg)
          return await sock.groupSettingUpdate(chat,result.mode)
        case 'tag':
          return await sock.sendMessage(chat,{text:result.text,mentions:meta.participants.map(p=>p.id)},{quoted:msg})
        case 'delete':
        case 'antilink':
          if (!bot?.admin) return result.action==='delete' ? reply(chat,'El bot debe ser administrador.',msg) : undefined
          if (result.action==='antilink') return await sock.sendMessage(chat,{delete:key})
          if (!ctx?.stanzaId || !ctx.participant) return reply(chat,'Responde al mensaje que quieres eliminar.',msg)
          return await sock.sendMessage(chat,{delete:{remoteJid:chat,id:ctx.stanzaId,participant:ctx.participant,fromMe:ids(bot).includes(jidNormalizedUser(ctx.participant))}})
        case 'getpic': {
          const url=await sock.profilePictureUrl(result.target,'image')
          return await sock.sendMessage(chat,{image:{url}},{quoted:msg})
        }
        case 'sticker':
        case 'toimage': {
          const quoted=normalizeMessageContent(ctx?.quotedMessage)
          const media=result.action==='sticker' ? 'imageMessage' : 'stickerMessage'
          const source=content[media] ? content : quoted
          if (!source?.[media]) return reply(chat,result.action==='sticker'?'Envía una foto con #sticker o responde a una foto.':'Responde a un sticker con #toimage.',msg)
          const limit=10*1024*1024
          if (Number(source[media].fileLength)>limit) return reply(chat,'El archivo supera 10 MB.',msg)
          const stream=await downloadMediaMessage({key:{...key,id:ctx?.stanzaId||key.id,participant:ctx?.participant||key.participant},message:source},'stream',{})
          const chunks=[]
          let size=0
          for await (const chunk of stream) {
            size+=chunk.length
            if (size>limit) {stream.destroy();return reply(chat,'El archivo supera 10 MB.',msg)}
            chunks.push(chunk)
          }
          const asSticker=result.action==='sticker'
          const output=await convertImage(Buffer.concat(chunks),asSticker)
          return await sock.sendMessage(chat,asSticker ? {sticker:output} : {image:output},{quoted:msg})
        }
      }
    } catch (error) {
      console.error(error.message)
      return reply(chat,'No pude ejecutar esta acción. Revisa los permisos o el archivo.',msg)
    }
  }
  sock.ev.on('group-participants.update',async ({id,participants,action})=>{
    try {
      if (expiry(id)<=Date.now()) return
      const config=settings(id)
      const key=({add:'welcome',remove:'goodbye'})[action]
      if (!key || !config[key] || config.bot===false) return
      for (const entry of participants) {
        const user=typeof entry==='string' ? entry : entry.id
        if (user) await sock.sendMessage(id,{text:greeting(config,key,user),mentions:[user]})
      }
    } catch(error) {console.error(error.message)}
  })
}
async function convertImage(input, asSticker) {
  const directory=await mkdtemp(join(tmpdir(),'bot-sticker-'))
  try {
    const source=join(directory,'entrada')
    const output=join(directory,asSticker?'salida.webp':'salida.png')
    await writeFile(source,input)
    const filter=asSticker
      ? 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0'
      : "scale='min(1024,iw)':'min(1024,ih)':force_original_aspect_ratio=decrease"
    const codec=asSticker ? ['-c:v','libwebp','-quality','65'] : []
    await promisify(execFile)('ffmpeg',['-nostdin','-v','error','-max_pixels','25000000',
      '-i',source,'-frames:v','1','-vf',filter,...codec,output],{timeout:15000})
    return await readFile(output)
  } finally {
    await rm(directory,{recursive:true,force:true})
  }
}

db.prepare('DELETE FROM processed WHERE at<?').run(Date.now()-7*86400000)
await start()
