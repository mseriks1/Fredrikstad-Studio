/**
 * Fredrikstad Studio – backend for kontaktskjema
 * Publiseres som Google Apps Script-nettapp fra fredrikstadstudio@gmail.com.
 */

const RECIPIENT_EMAIL = 'fredrikstadstudio@gmail.com';
const MAX_MESSAGE_LENGTH = 8000;
const MAX_REQUESTS_PER_10_MINUTES = 30;
const MAX_AUDIO_FILE_BYTES = 10 * 1024 * 1024;

function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'Fredrikstad Studio kontaktskjema'
  });
}

function doPost(event) {
  try {
    const params = event && event.parameter ? event.parameter : {};

    // Skjult felt som vanlige besøkende aldri fyller ut.
    if (clean_(params.website, 200)) {
      return jsonResponse_({ ok: true });
    }

    enforceRateLimit_();

    const name = clean_(params.name, 150);
    const email = clean_(params.email, 254).toLowerCase();
    const type = clean_(params.type, 150);
    const message = clean_(params.message, MAX_MESSAGE_LENGTH);
    const demo = clean_(params.demo, 1000);
    const page = clean_(params.page, 1000);
    const submittedAt = clean_(params.submittedAt, 100);

    if (name.length < 2) throw new Error('Navn mangler.');
    if (!isValidEmail_(email)) throw new Error('Ugyldig e-postadresse.');
    if (!type) throw new Error('Område mangler.');
    if (message.length < 5) throw new Error('Melding mangler.');

    const audioAttachment = createAudioAttachment_(params);
    const audioDescription = audioAttachment
      ? `${audioAttachment.getName()} (${formatMegabytes_(audioAttachment.getBytes().length)})`
      : 'Ikke vedlagt';
    const subject = `Ny forespørsel fra nettsiden – ${type}`;
    const demoHtml = isHttpUrl_(demo)
      ? `<a href="${escapeHtml_(demo)}">${escapeHtml_(demo)}</a>`
      : escapeHtml_(demo || 'Ikke oppgitt');

    const plainBody = [
      'Ny forespørsel fra fredrikstadstudio.no',
      '',
      `Navn: ${name}`,
      `E-post: ${email}`,
      `Gjelder: ${type}`,
      demo ? `Demo-lenke: ${demo}` : 'Demo-lenke: Ikke oppgitt',
      `MP3-fil: ${audioDescription}`,
      '',
      'Melding:',
      message,
      '',
      `Side: ${page || 'Ikke oppgitt'}`,
      `Sendt: ${submittedAt || new Date().toISOString()}`
    ].join('\n');

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#17171c;max-width:680px">
        <h2 style="margin:0 0 20px">Ny forespørsel fra nettsiden</h2>
        <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
          ${row_('Navn', escapeHtml_(name))}
          ${row_('E-post', `<a href="mailto:${escapeHtml_(email)}">${escapeHtml_(email)}</a>`)}
          ${row_('Gjelder', escapeHtml_(type))}
          ${row_('Demo-lenke', demoHtml)}
          ${row_('MP3-fil', escapeHtml_(audioDescription))}
        </table>
        <h3 style="margin:0 0 8px">Melding</h3>
        <div style="white-space:pre-wrap;background:#f4f4f6;border-radius:10px;padding:16px">${escapeHtml_(message)}</div>
        <p style="margin-top:24px;color:#666;font-size:12px">
          Side: ${escapeHtml_(page || 'Ikke oppgitt')}<br>
          Sendt: ${escapeHtml_(submittedAt || new Date().toISOString())}
        </p>
      </div>`;

    const mailOptions = {
      to: RECIPIENT_EMAIL,
      replyTo: email,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody,
      name: 'Fredrikstad Studio – nettsiden'
    };

    if (audioAttachment) {
      mailOptions.attachments = [audioAttachment];
    }

    MailApp.sendEmail(mailOptions);

    return jsonResponse_({ ok: true });
  } catch (error) {
    console.error(error);
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : 'Ukjent feil.'
    });
  }
}

function createAudioAttachment_(params) {
  const rawBase64 = String(params.audioFileBase64 || '');
  const rawName = clean_(params.audioFileName, 220);
  const rawType = clean_(params.audioFileType, 100).toLowerCase();
  const rawSize = clean_(params.audioFileSize, 30);
  const hasAnyFileData = Boolean(rawBase64 || rawName || rawType || rawSize);

  if (!hasAnyFileData) return null;
  if (!rawBase64 || !rawName) throw new Error('MP3-filen er ufullstendig.');

  const fileName = safeMp3FileName_(rawName);
  if (!fileName.toLowerCase().endsWith('.mp3')) {
    throw new Error('Kun MP3-filer er tillatt.');
  }

  const allowedTypes = ['', 'audio/mpeg', 'audio/mp3', 'audio/x-mpeg', 'audio/mpeg3', 'audio/x-mpeg-3', 'application/octet-stream'];
  if (allowedTypes.indexOf(rawType) === -1) {
    throw new Error('Kun MP3-filer er tillatt.');
  }

  const base64 = rawBase64
    .replace(/ /g, '+')
    .replace(/[\r\n\t]/g, '');

  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    throw new Error('MP3-filen kunne ikke leses.');
  }

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const estimatedBytes = Math.floor(base64.length * 3 / 4) - padding;
  if (estimatedBytes <= 0) throw new Error('MP3-filen er tom.');
  if (estimatedBytes > MAX_AUDIO_FILE_BYTES) {
    throw new Error('MP3-filen kan være maks 10 MB.');
  }

  const bytes = Utilities.base64Decode(base64);
  if (bytes.length <= 0) throw new Error('MP3-filen er tom.');
  if (bytes.length > MAX_AUDIO_FILE_BYTES) {
    throw new Error('MP3-filen kan være maks 10 MB.');
  }

  const declaredSize = Number(rawSize || 0);
  if (declaredSize && Math.abs(declaredSize - bytes.length) > 2) {
    throw new Error('MP3-filen ble ikke lastet opp fullstendig.');
  }

  return Utilities.newBlob(bytes, 'audio/mpeg', fileName);
}

function safeMp3FileName_(value) {
  const lastPart = String(value || '').split(/[\\/]/).pop();
  const cleaned = lastPart
    .replace(/[^A-Za-z0-9ÆØÅæøå._ ()-]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return cleaned || 'demo.mp3';
}

function formatMegabytes_(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function enforceRateLimit_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    const cache = CacheService.getScriptCache();
    const now = new Date();
    const bucket = Math.floor(now.getTime() / (10 * 60 * 1000));
    const key = `contact-rate-${bucket}`;
    const count = Number(cache.get(key) || 0);

    if (count >= MAX_REQUESTS_PER_10_MINUTES) {
      throw new Error('For mange innsendinger. Prøv igjen senere.');
    }

    cache.put(key, String(count + 1), 650);
  } finally {
    lock.releaseLock();
  }
}

function clean_(value, maxLength) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength);
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isHttpUrl_(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function row_(label, value) {
  return `<tr>
    <th style="text-align:left;vertical-align:top;padding:8px 12px 8px 0;border-bottom:1px solid #ddd;width:110px">${escapeHtml_(label)}</th>
    <td style="padding:8px 0;border-bottom:1px solid #ddd">${value}</td>
  </tr>`;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
