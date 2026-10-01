// Axirria Digital Vietnam: contact form mailer (Google Apps Script web app).
// The site's Worker (worker.js) validates the form, then POSTs JSON here; this sends the email
// from the Workspace account that deploys the script.
//
// Script properties (Project Settings > Script properties):
//   TOKEN      shared secret, same value as the Worker secret GAS_TOKEN
//   RECIPIENTS comma-separated addresses, e.g. duy@axirriadigital.com,tsuchida@axirriadigital.com
//
// Deploy > New deployment > Web app: Execute as "Me", Who has access "Anyone".

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply_({ ok: false, error: 'bad json' });
  }
  if (!d.token || d.token !== props.getProperty('TOKEN')) return reply_({ ok: false, error: 'unauthorized' });

  var oneLine = function (s) { return String(s || '').replace(/[\r\n]+/g, ' ').trim(); };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  };
  var rows = [
    ['お名前 / Name', d.name], ['会社名 / Company', d.company || '-'], ['メール / Email', d.email],
    ['ご相談内容 / Topic', d.topic || '-'], ['メッセージ / Message', d.message],
  ];

  MailApp.sendEmail({
    to: props.getProperty('RECIPIENTS'),
    replyTo: oneLine(d.email),
    name: 'Axirria Digital Vietnam Website',
    subject: oneLine('[Webお問い合わせ] ' + (d.topic || 'お問い合わせ') + ' - ' + d.name),
    body: rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n\n'),
    htmlBody: '<table cellpadding="6" style="border-collapse:collapse;font-family:sans-serif">' +
      rows.map(function (r) {
        return '<tr><th align="left" valign="top" style="white-space:nowrap">' + esc(r[0]) +
          '</th><td style="white-space:pre-wrap">' + esc(r[1]) + '</td></tr>';
      }).join('') + '</table>',
  });
  return reply_({ ok: true });
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
