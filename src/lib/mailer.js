import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * Send a complaint notification email to the incharge officer.
 * @param {Object} complaint - Complaint details
 */
export async function sendComplaintEmail({ name, quarterNo, mobileNo, issueType, description, photoUrl, videoUrl, timestamp }) {
  const htmlBody = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 32px 40px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">🏛️ New Complaint Received</h1>
        <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">Town Office Complaint Portal</p>
      </div>

      <!-- Body -->
      <div style="padding: 32px 40px; background: #ffffff;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; width: 40%; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Submitted On</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 14px;">${timestamp}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Resident Name</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 14px; font-weight: 600;">${name}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Quarter No.</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 14px;">${quarterNo}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Mobile No.</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 14px;">${mobileNo}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Issue Type</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
              <span style="background: #dbeafe; color: #1d4ed8; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">${issueType}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: top;">Description</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 14px; line-height: 1.6;">${description}</td>
          </tr>
        </table>

        ${photoUrl ? `
        <div style="margin-top: 24px;">
          <p style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px;">Attached Photo</p>
          <img src="${photoUrl}" alt="Complaint Photo" style="max-width: 100%; border-radius: 8px; border: 1px solid #e2e8f0;" />
          <a href="${photoUrl}" style="display: inline-block; margin-top: 8px; color: #3b82f6; font-size: 13px;">View full image →</a>
        </div>` : ''}

        ${videoUrl ? `
        <div style="margin-top: 24px;">
          <p style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px;">Attached Video</p>
          <a href="${videoUrl}" style="display: inline-block; background: #1d4ed8; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">▶ View Video</a>
        </div>` : ''}
      </div>

      <!-- Footer -->
      <div style="padding: 20px 40px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
          This is an automated notification from the Town Office Complaint Portal. Please address this complaint promptly.
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Town Office Portal" <${process.env.GMAIL_USER}>`,
    to: process.env.INCHARGE_EMAIL.split(','),
    subject: `🚨 New Complaint: ${issueType} — Quarter ${quarterNo}`,
    html: htmlBody,
  });
}
