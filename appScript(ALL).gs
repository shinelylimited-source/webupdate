function doPost(e) {
  const sheetName = 'formData'; 
  const spreadsheetId = '1U3yPPpfYkLJTAVWJEJVRU5Vgpl8Kjha7Y0S-EFnhAWc'; // <--- REPLACE THIS with your Google Sheet ID
  const adminEmail = 'info@shinelylimited.com'; // <--- REPLACE THIS with your admin email
  const companyName = 'SHINELY LIMITED';

  // --- DEBUGGING START ---
  Logger.log('--- START doPost Execution ---');
  Logger.log('Raw event object (e): ' + JSON.stringify(e));
  Logger.log('e.parameter: ' + JSON.stringify(e ? e.parameter : 'e is undefined'));
  // --- DEBUGGING END ---

  // Basic check for valid event object and parameters
  if (!e || !e.parameter) {
    Logger.log('doPost was called without valid parameters. Likely a manual test or malformed request.');
    return ContentService.createTextOutput('Error: Invalid request. No parameters received.').setMimeType(ContentService.MimeType.TEXT);
  }

  const formData = e.parameter;
  const timestamp = new Date();

  try {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000); // Wait 30 seconds for others to finish

    const ss = SpreadsheetApp.openById(spreadsheetId);
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      // If sheet doesn't exist, create it and add headers
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['Timestamp', 'name', 'email', 'phone', 'address', 'service', 'size', 'details']);
    }

    // Map form data to sheet columns based on expected headers
    const rowData = [
      timestamp,
      formData.name || '',
      formData.email || '',
      formData.phone || '',
      formData.address || '',
      formData.service || '',
      formData.size || '',
      formData.details || ''
    ];

    sheet.appendRow(rowData);
    lock.releaseLock();

    // --- EMAIL NOTIFICATION LOGIC ---
    const userEmail = formData.email;
    const userName = formData.name || 'Valued Customer';

    // 1. Send Admin Notification Email
    let adminSubject = `New Quote Request from ${userName} (${userEmail})`;
    let adminBody = `A new quote request has been submitted via the website form.\n\n`;
    adminBody += `Submission Details:\n`;
    for (let key in formData) {
      adminBody += `- ${key.charAt(0).toUpperCase() + key.slice(1)}: ${formData[key]}\n`;
    }
    adminBody += `\nSubmitted at: ${timestamp.toLocaleString()}\n`;
    adminBody += `\n---\n${companyName} Automated Notification`;

    MailApp.sendEmail({
      to: adminEmail,
      subject: adminSubject,
      body: adminBody,
      name: `${companyName} Website`
    });

    // 2. Send User Confirmation Email
    if (userEmail && userEmail.includes('@')) { // Basic validation for user email
      let userSubject = `${companyName}: Your Quote Request Confirmation`;
      let userBody = `Dear ${userName},\n\n`;
      userBody += `Thank you for your quote request! We have received your submission and a member of our team will review it shortly.\n`;
      userBody += `We aim to get back to you within 24 hours with a personalized quote.\n\n`;
      userBody += `Your submitted details:\n`;
      for (let key in formData) {
        userBody += `- ${key.charAt(0).toUpperCase() + key.slice(1)}: ${formData[key]}\n`;
      }
      userBody += `\nIf you have any urgent questions, please contact us directly at ${adminEmail}.\n\n`;
      userBody += `Best regards,\n`;
      userBody += `The ${companyName} Team`;

      MailApp.sendEmail({
        to: userEmail,
        subject: userSubject,
        body: userBody,
        name: companyName
      });
    }

    Logger.log('--- END doPost Execution (Success) ---');
    return ContentService.createTextOutput('Success').setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    Logger.log('--- END doPost Execution (Error) ---');
    Logger.log('Apps Script Error in doPost: ' + error.toString());
    // Attempt to send an error notification to admin if logging failed but email is functional
    try {
      MailApp.sendEmail({
        to: adminEmail,
        subject: `ERROR: Quote Form Submission Failed - ${companyName}`,
        body: `An error occurred during a quote form submission.\n\nError: ${error.toString()}\n\nRaw form data received: ${JSON.stringify(formData)}\n\n---\n${companyName} Automated Notification`,
        name: `${companyName} Website Error`
      });
    } catch (mailError) {
      Logger.log('Failed to send error email: ' + mailError.toString());
    }
    return ContentService.createTextOutput('Error').setMimeType(ContentService.MimeType.TEXT);
  }
}