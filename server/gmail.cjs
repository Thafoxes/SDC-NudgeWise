'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, createHash, createCipheriv, createDecipheriv } = require('node:crypto');
const BASE = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email' + (process.env.GMAIL_ENABLE_REPLY_SCOPE === 'true' ? ' https://www.googleapis.com/auth/gmail.readonly' : '');
const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const b64 = value => Buffer.from(value).toString('base64url');
function createGmailService(directory) {
  const clientId = process.env.GMAIL_CLIENT_ID || '';
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || '';
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://127.0.0.1:8787/api/email/callback';
  const keyText = process.env.EMAIL_TOKEN_KEY || '';
  const key = /^[0-9a-fA-F]{64}$/.test(keyText) ? Buffer.from(keyText, 'hex') : null;
  const configured = !!(clientId && clientSecret && key);
  const stateFile = path.join(directory, 'gmail-oauth.json');
  let record = null;
  let pending = null;
  let testLimit = [];
  if (key && fs.existsSync(stateFile)) {
    try {
      const blob = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(blob.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(blob.tag, 'base64'));
      record = JSON.parse(Buffer.concat([decipher.update(Buffer.from(blob.data, 'base64')), decipher.final()]).toString());
    } catch { console.error('Gmail token file could not be decrypted. Check EMAIL_TOKEN_KEY.'); }
  }
  const persist = () => {
    if (!record) { try { fs.unlinkSync(stateFile); } catch(e) { if(e.code !== 'ENOENT') throw e; } return; }
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(record)), cipher.final()]);
    fs.writeFileSync(stateFile, JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}), {mode:0o600});
    fs.chmodSync(stateFile,0o600);
  };
  const status = () => ({configured,connected:!!record?.refresh_token,email:record?.email||'',autoRemindersEnabled:!!record?.autoRemindersEnabled,automationLiveEnabled:!!record?.automationLiveEnabled,incomingEnabled:!!record?.incomingEnabled,canRead:!!record?.scopes?.includes('https://www.googleapis.com/auth/gmail.readonly'),lastTest:record?.lastTest||null});
  function start() {
    if (!configured) throw Error('Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and EMAIL_TOKEN_KEY in .env');
    const state = b64(randomBytes(32)), verifier = b64(randomBytes(48));
    pending = {state,verifier,expires:Date.now()+10*60*1000};
    const q = new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent',state,code_challenge:b64(createHash('sha256').update(verifier).digest()),code_challenge_method:'S256'});
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  async function callback(query) {
    const saved=pending; pending=null;
    if (!saved || saved.expires<Date.now() || query.get('state')!==saved.state || !query.get('code')) throw Error('Invalid or expired Gmail authorization. Connect again.');
    const res=await fetch(BASE,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code',code:query.get('code'),code_verifier:saved.verifier})});
    const tokens=await res.json();
    if (!res.ok || !tokens.refresh_token || !tokens.access_token) throw Error('Gmail authorization did not return a refresh token. Reconnect with consent.');
    const user=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`}});
    const profile=await user.json();
    if (!user.ok || !validEmail(profile.email)) throw Error('Could not verify connected Gmail address.');
    record={email:profile.email,refresh_token:tokens.refresh_token,autoRemindersEnabled:false,automationLiveEnabled:false,incomingEnabled:false,scopes:tokens.scope||'',lastTest:null};persist();
  }
  async function accessToken() {
    if (!record?.refresh_token) throw Error('Connect Gmail first');
    const res=await fetch(BASE,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:record.refresh_token,grant_type:'refresh_token'})});
    const token=await res.json();
    if (!res.ok || !token.access_token) throw Error('Gmail authorization expired or revoked. Reconnect the account.');
    return token.access_token;
  }
  async function sendTest(input) {
    if (!record) throw Error('Connect Gmail before sending a test');
    if (!validEmail(input?.to)) throw Error('Enter a valid recipient email');
    const subject=String(input.subject||'').trim(), message=String(input.message||'').trim();
    if (!subject || subject.length>160 || /[\r\n]/.test(subject)) throw Error('Subject must be 1–160 characters, on one line');
    if (!message || message.length>4000) throw Error('Message must be 1–4000 characters');
    const now=Date.now();testLimit=testLimit.filter(t=>now-t<60*60*1000);
    if(testLimit.length>=5) throw Error('Maximum 5 test emails per hour');
    testLimit.push(now);
    const mime=`From: ${record.email}\r\nTo: ${input.to}\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\nX-NudgeWise-Test: true\r\n\r\n${Buffer.from('[NudgeWise TEST EMAIL — no action required]\n\n'+message).toString('base64')}\r\n`;
    const token=await accessToken();
    const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({raw:b64(mime)})});
    if(!response.ok) throw Error(`Gmail rejected the message (HTTP ${response.status}). Check connection and permissions.`);
    const sent=await response.json();
    record.lastTest={at:new Date().toISOString(),recipient:input.to,messageId:sent.id||'',status:'accepted'};persist();
    return record.lastTest;
  }
  function updateSettings(input) {
    if (!record && input?.autoRemindersEnabled) throw Error('Connect Gmail before enabling reminders');
    if (record) { if (Object.prototype.hasOwnProperty.call(input||{},'autoRemindersEnabled')) record.autoRemindersEnabled=!!input.autoRemindersEnabled; if(!record.autoRemindersEnabled)record.automationLiveEnabled=false; if(Object.prototype.hasOwnProperty.call(input||{},'automationLiveEnabled')){ if(input.automationLiveEnabled && (!record.autoRemindersEnabled || input.confirmActivation !== true))throw Error('Explicit live automation confirmation required'); record.automationLiveEnabled=!!input.automationLiveEnabled; } if(Object.prototype.hasOwnProperty.call(input||{},'incomingEnabled')){if(input.incomingEnabled && !status().canRead)throw Error('Reconnect Gmail with gmail.readonly permission before enabling inbox monitoring');record.incomingEnabled=!!input.incomingEnabled;}persist(); }
    return status();
  }
  let sendTimes=[];
  async function sendMessage({to,subject,message,attachment}){
    if(!record?.email)throw Error('Connect Gmail first');
    if(!validEmail(to)||!subject||subject.length>170||/[\r\n]/.test(subject)||typeof message!=='string'||!message.trim()||message.length>6000)throw Error('Invalid email recipient or content');
    if(attachment && (!Buffer.isBuffer(attachment.bytes)||attachment.bytes.length>4*1024*1024||!/^%PDF-/.test(attachment.bytes.subarray(0,5).toString())||!/^[-a-zA-Z0-9_.]+\.pdf$/.test(attachment.filename)))throw Error('Invalid PDF attachment');
    const now=Date.now();sendTimes=sendTimes.filter(t=>now-t<3600000);if(sendTimes.length>=100)throw Error('Email hourly safety limit reached');sendTimes.push(now);
    const head=`From: ${record.email}\r\nTo: ${to}\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\nMIME-Version: 1.0\r\n`;
    const text=Buffer.from(message,'utf8').toString('base64').replace(/.{76}/g,'$&\r\n');
    let mime;
    if(attachment){
      const boundary='nw-'+randomBytes(16).toString('hex');
      mime=head+`Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${text}\r\n--${boundary}\r\nContent-Type: application/pdf; name="${attachment.filename}"\r\nContent-Disposition: attachment; filename="${attachment.filename}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${attachment.bytes.toString('base64').replace(/.{76}/g,'$&\r\n')}\r\n--${boundary}--\r\n`;
    }else mime=head+`Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${text}\r\n`;
    const token=await accessToken();
    const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({raw:b64(mime)})});
    if(!response.ok)throw Error(`Gmail sending rejected (HTTP ${response.status})`);
    return response.json();
  }
  async function readThread(threadId){
    if(!status().canRead)throw Error('Gmail read permission not granted');
    if(!/^[A-Za-z0-9_-]{6,100}$/.test(threadId))throw Error('Invalid Gmail thread');
    const token=await accessToken();
    const response=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=full`,{headers:{Authorization:`Bearer ${token}`}});
    if(!response.ok)throw Error(`Gmail thread read failed (HTTP ${response.status})`);
    const result=await response.json();return Array.isArray(result.messages)?result.messages:[];
  }
  function disconnect(){record=null;pending=null;persist();return status();}
  return {start,callback,status,sendTest,sendMessage,readThread,updateSettings,disconnect};
}
module.exports={createGmailService};
