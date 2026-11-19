// Email relay for NexPlay: paste into a Google Apps Script project (script.google.com), see README steps in chat.
// Mail is sent from the Google account that owns the script. Free accounts can send about 100 emails a day.

// Change this to any long random string, and use the same value as APPS_SCRIPT_SECRET on Render.
var SECRET = 'CHANGE-ME-to-a-long-random-string';

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  if (data.secret !== SECRET) {
    return ContentService.createTextOutput('forbidden');
  }
  MailApp.sendEmail({ to: data.to, subject: data.subject, body: data.body, name: 'NexPlay' });
  return ContentService.createTextOutput('ok');
}
