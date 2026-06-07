/**
 * KFMS Notification Service
 * Handles in-app, email (Nodemailer), and push notifications
 * Cron jobs run scheduled checks for vaccinations, low stock, payroll due
 */

const nodemailer = require('nodemailer');
const cron = require('node-cron');
const pool = require('../config/db');

// ── Email transporter ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Core: Create in-app notification ─────────────────────────────────────────
async function createNotification(userId, title, message, type, referenceType, referenceId) {
  try {
    await pool.query(`
      INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, title, message, type, referenceType, referenceId]);
  } catch (err) {
    console.error('[Notifications] DB error:', err.message);
  }
}

// ── Broadcast to all admins/managers ─────────────────────────────────────────
async function broadcastToRoles(roles, title, message, type, refType, refId) {
  try {
    const users = await pool.query(
      `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = ANY($1) AND u.is_active = true`,
      [roles]
    );
    for (const u of users.rows) {
      await createNotification(u.id, title, message, type, refType, refId);
    }
  } catch (err) {
    console.error('[Notifications] Broadcast error:', err.message);
  }
}

// ── Email sender ──────────────────────────────────────────────────────────────
async function sendEmail(to, subject, htmlBody) {
  if (!process.env.SMTP_USER) {
    console.log(`[Email] SMTP not configured. Would send to ${to}: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"Kenena Farm System" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: htmlBody,
    });
    console.log(`[Email] Sent: "${subject}" to ${to}`);
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
  }
}

// ── Email templates ───────────────────────────────────────────────────────────
function emailTemplate(title, body, color = '#1B4332') {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
    <body style="margin:0;padding:0;background:#F8F9FA;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(27,67,50,0.12);">
        <div style="background:${color};padding:24px 28px;">
          <div style="font-size:24px;margin-bottom:8px;">🌿</div>
          <h1 style="color:#fff;font-size:20px;margin:0;font-family:Arial,sans-serif;">${title}</h1>
          <p style="color:rgba(255,255,255,0.65);font-size:13px;margin:4px 0 0;">Kenena Farm Management System</p>
        </div>
        <div style="padding:24px 28px;">
          ${body}
        </div>
        <div style="background:#F8F9FA;padding:14px 28px;border-top:1px solid #E2EDE7;">
          <p style="color:#8FA89A;font-size:12px;margin:0;">Kenena Farm · Kihura Sub-county, Uganda · This is an automated notification.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ── Notification Triggers ────────────────────────────────────────────────────

// 1. Vaccination due (checks animals with next_due_date in ≤7 days)
async function checkVaccinationsDue() {
  try {
    const result = await pool.query(`
      SELECT vr.animal_id, vr.next_due_date, a.animal_id as tag, v.name as vaccine_name, sp.name as species
      FROM vaccination_records vr
      JOIN animals a ON vr.animal_id = a.id
      JOIN vaccines v ON vr.vaccine_id = v.id
      JOIN animal_species sp ON a.species_id = sp.id
      WHERE vr.next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
        AND a.status = 'active'
      ORDER BY vr.next_due_date ASC
      LIMIT 50
    `);

    if (result.rows.length > 0) {
      const dueCount = result.rows.length;
      const title = `💉 ${dueCount} Vaccination${dueCount > 1 ? 's' : ''} Due Within 7 Days`;
      const details = result.rows.slice(0, 5).map(r =>
        `${r.tag} (${r.species}) — ${r.vaccine_name} due ${new Date(r.next_due_date).toLocaleDateString()}`
      ).join('\n');
      const message = `${details}${dueCount > 5 ? `\n...and ${dueCount - 5} more.` : ''}`;

      await broadcastToRoles(['super_admin', 'farm_manager'], title, message, 'vaccination_due', 'vaccination', null);

      // Email to admin
      const admins = await pool.query(`SELECT u.email FROM users u JOIN roles r ON u.role_id=r.id WHERE r.name='super_admin' AND u.is_active=true LIMIT 3`);
      for (const admin of admins.rows) {
        const rows = result.rows.slice(0, 10).map(r => `<tr><td style="padding:8px;border-bottom:1px solid #E2EDE7;">${r.tag}</td><td style="padding:8px;border-bottom:1px solid #E2EDE7;">${r.species}</td><td style="padding:8px;border-bottom:1px solid #E2EDE7;">${r.vaccine_name}</td><td style="padding:8px;border-bottom:1px solid #E2EDE7;color:#FFB703;font-weight:bold;">${new Date(r.next_due_date).toLocaleDateString()}</td></tr>`).join('');
        await sendEmail(admin.email, title, emailTemplate(title, `
          <p style="color:#4A6358;font-size:14px;margin-bottom:16px;">${dueCount} animals require vaccination within the next 7 days. Please ensure the ground team is briefed.</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#F8F9FA;"><th style="padding:8px;text-align:left;">Animal ID</th><th style="padding:8px;text-align:left;">Species</th><th style="padding:8px;text-align:left;">Vaccine</th><th style="padding:8px;text-align:left;">Due Date</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        `, '#1B4332'));
      }
    }
  } catch (err) {
    console.error('[Notifications] Vaccination check error:', err.message);
  }
}

// 2. Low stock alert
async function checkLowStock() {
  try {
    const result = await pool.query(`
      SELECT id, name, current_stock, reorder_level, unit
      FROM inventory_items
      WHERE current_stock <= reorder_level AND is_active = true
      ORDER BY (current_stock / NULLIF(reorder_level, 0)) ASC
    `);

    if (result.rows.length > 0) {
      const title = `📦 ${result.rows.length} Inventory Item${result.rows.length > 1 ? 's' : ''} Low / Out of Stock`;
      const message = result.rows.slice(0, 5).map(r => `${r.name}: ${r.current_stock} ${r.unit} (reorder at ${r.reorder_level})`).join('\n');
      await broadcastToRoles(['super_admin', 'farm_manager', 'storekeeper'], title, message, 'low_stock', 'inventory', null);
    }
  } catch (err) {
    console.error('[Notifications] Low stock check error:', err.message);
  }
}

// 3. Expiring medicines
async function checkExpiringMedicines() {
  try {
    const result = await pool.query(`
      SELECT name, current_stock, unit, expiry_date
      FROM inventory_items
      WHERE expiry_date IS NOT NULL
        AND expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
        AND is_active = true
        AND current_stock > 0
    `);

    if (result.rows.length > 0) {
      const title = `⚠️ ${result.rows.length} Medicine${result.rows.length > 1 ? 's' : ''} Expiring Within 30 Days`;
      const message = result.rows.map(r => `${r.name}: expires ${new Date(r.expiry_date).toLocaleDateString()} (${r.current_stock} ${r.unit} remaining)`).join('\n');
      await broadcastToRoles(['super_admin', 'farm_manager', 'storekeeper'], title, message, 'expiring_medicine', 'inventory', null);
    }
  } catch (err) {
    console.error('[Notifications] Medicine expiry check error:', err.message);
  }
}

// 4. Mortality spike alert
async function checkMortalitySpike() {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as deaths_today
      FROM animal_deaths
      WHERE death_date = CURRENT_DATE
    `);
    const deaths = parseInt(result.rows[0].deaths_today);
    if (deaths >= 3) {
      const title = `🚨 Mortality Spike: ${deaths} Deaths Today`;
      const message = `${deaths} animals have been recorded dead today. Immediate investigation recommended.`;
      await broadcastToRoles(['super_admin', 'farm_manager'], title, message, 'mortality_spike', 'mortality', null);
    }
  } catch (err) {
    console.error('[Notifications] Mortality check error:', err.message);
  }
}

// 5. Pending expense approvals reminder
async function checkPendingApprovals() {
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM expense_requests
      WHERE status = 'pending' AND created_at < NOW() - INTERVAL '24 hours'
    `);
    const count = parseInt(result.rows[0].count);
    if (count > 0) {
      const title = `✅ ${count} Expense Request${count > 1 ? 's' : ''} Awaiting Approval`;
      const message = `${count} requests pending for >24hrs. Total: UGX ${new Intl.NumberFormat('en-UG').format(Math.round(result.rows[0].total || 0))}`;
      await broadcastToRoles(['super_admin'], title, message, 'approval_required', 'expense_request', null);
    }
  } catch (err) {
    console.error('[Notifications] Pending approvals check error:', err.message);
  }
}

// 6. Payroll due reminder
async function checkPayrollDue() {
  const today = new Date();
  // Remind on 28th of each month
  if (today.getDate() === 28) {
    await broadcastToRoles(
      ['super_admin', 'accountant'],
      '👷 Monthly Payroll Due in 3 Days',
      'Reminder: Month-end payroll processing is due. Please review attendance records and run payroll.',
      'payroll_due', 'payroll', null
    );
  }
}

// ── Notification API helpers (used by routes) ─────────────────────────────────
async function notifyExpenseApproved(requestId, amount, approvedByName, requesterEmail) {
  await sendEmail(requesterEmail, '✅ Expense Request Approved',
    emailTemplate('Your Expense Request Was Approved', `
      <p style="color:#4A6358;font-size:15px;margin:0 0 16px;">Your expense request of <strong style="color:#1B4332;">UGX ${new Intl.NumberFormat('en-UG').format(Math.round(amount))}</strong> has been approved by ${approvedByName}.</p>
      <p style="color:#8FA89A;font-size:13px;">The funds will be released as per the approved payment method.</p>
    `, '#2D6A4F')
  );
}

async function notifyExpenseRejected(requestId, reason, requesterEmail) {
  await sendEmail(requesterEmail, '❌ Expense Request Rejected',
    emailTemplate('Expense Request Rejected', `
      <p style="color:#4A6358;font-size:15px;margin:0 0 16px;">Your expense request has been rejected.</p>
      ${reason ? `<p style="color:#E63946;font-size:13px;background:#FDECEA;padding:12px;border-radius:8px;margin:0;"><strong>Reason:</strong> ${reason}</p>` : ''}
      <p style="color:#8FA89A;font-size:13px;margin-top:12px;">Please contact the farm administrator if you have questions.</p>
    `, '#E63946')
  );
}

// ── Start all cron jobs ───────────────────────────────────────────────────────
function startNotificationJobs() {
  console.log('[Notifications] Starting scheduled jobs…');

  // Every day at 7:00 AM Uganda time
  cron.schedule('0 7 * * *', async () => {
    console.log('[CRON] Running daily notification checks…');
    await Promise.allSettled([
      checkVaccinationsDue(),
      checkLowStock(),
      checkExpiringMedicines(),
      checkMortalitySpike(),
      checkPendingApprovals(),
      checkPayrollDue(),
    ]);
  }, { timezone: 'Africa/Kampala' });

  // Every hour — mortality spike check
  cron.schedule('0 * * * *', checkMortalitySpike, { timezone: 'Africa/Kampala' });

  console.log('[Notifications] Cron jobs active. Daily check at 07:00 Africa/Kampala');
}

module.exports = {
  createNotification,
  broadcastToRoles,
  sendEmail,
  notifyExpenseApproved,
  notifyExpenseRejected,
  startNotificationJobs,
  checkVaccinationsDue,
  checkLowStock,
};
