/**
 * KFMS PDF Payslip Generator
 * Generates professional payslips using jsPDF + autoTable
 * Works entirely client-side — no server needed
 */

// Dynamic import to keep bundle size down
async function getJsPDF() {
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');
  return jsPDF;
}

const FARM_INFO = {
  name: 'Kenena Farm',
  location: 'Kihura Sub-county, Uganda',
  phone: '+256 700 000 000',
  email: 'admin@kenenafarm.ug',
};

function fmt(n) { return new Intl.NumberFormat('en-UG').format(Math.round(n)); }
function fmtUGX(n) { return `UGX ${fmt(n)}`; }

/**
 * Generate a single employee payslip PDF
 * @param {Object} employee - Employee record
 * @param {Object} payrollRecord - Payroll record with earnings/deductions
 * @param {Object} period - { period_name, start_date, end_date, payment_date }
 * @returns {Blob} PDF blob ready for download or share
 */
export async function generatePayslip(employee, payrollRecord, period) {
  const jsPDF = await getJsPDF();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentW = pageW - 2 * margin;

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(27, 67, 50); // #1B4332 emerald
  doc.rect(0, 0, pageW, 42, 'F');

  // Farm name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(FARM_INFO.name, margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 220, 190);
  doc.text(FARM_INFO.location, margin, 25);
  doc.text(`Tel: ${FARM_INFO.phone}  ·  ${FARM_INFO.email}`, margin, 31);

  // PAYSLIP label on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('PAYSLIP', pageW - margin, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 220, 190);
  doc.text(period.period_name || 'Pay Period', pageW - margin, 25, { align: 'right' });
  doc.text(`Pay Date: ${period.payment_date || new Date().toLocaleDateString()}`, pageW - margin, 31, { align: 'right' });

  let y = 55;

  // ── Employee Details ────────────────────────────────────────────────────────
  doc.setFillColor(248, 249, 250); // #F8F9FA
  doc.roundedRect(margin, y, contentW, 32, 3, 3, 'F');
  doc.setDrawColor(226, 237, 231);
  doc.roundedRect(margin, y, contentW, 32, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(13, 31, 23); // textPrimary
  doc.text(employee.full_name, margin + 6, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(74, 99, 88);
  doc.text(`Employee Code: ${employee.employee_code}`, margin + 6, y + 18);
  doc.text(`Position: ${employee.position || '—'}`, margin + 6, y + 25);

  // Right side of employee block
  doc.text(`Pay Type: ${employee.salary_type?.charAt(0).toUpperCase() + employee.salary_type?.slice(1) || '—'}`, pageW - margin - 6, y + 10, { align: 'right' });
  doc.text(`Period: ${period.start_date} to ${period.end_date}`, pageW - margin - 6, y + 18, { align: 'right' });
  doc.text(`Department: ${employee.department || 'Farm Operations'}`, pageW - margin - 6, y + 25, { align: 'right' });

  y += 42;

  // ── Earnings table ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(27, 67, 50);
  doc.text('EARNINGS', margin, y);
  y += 3;

  const earningsRows = [
    ['Basic Pay', employee.salary_type === 'daily' ? `${payrollRecord.days_worked || 0} days × ${fmtUGX(employee.salary_rate)}` : 'Monthly Rate', fmtUGX(payrollRecord.base_pay || 0)],
    ['Overtime Pay', `${payrollRecord.overtime_hours || 0} hrs × 1.5x rate`, fmtUGX(payrollRecord.overtime_pay || 0)],
    ['Bonus / Allowance', '—', fmtUGX(payrollRecord.bonus || 0)],
  ];

  doc.autoTable({
    startY: y,
    head: [['Description', 'Details', 'Amount (UGX)']],
    body: earningsRows,
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [45, 106, 79], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, textColor: [13, 31, 23] },
    alternateRowStyles: { fillColor: [240, 250, 243] },
    columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
    theme: 'grid',
  });

  y = doc.lastAutoTable.finalY + 8;

  // ── Deductions table ────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(230, 57, 70); // coral
  doc.text('DEDUCTIONS', margin, y);
  y += 3;

  const deductionRows = [
    ['Salary Advance Repayment', '—', fmtUGX(payrollRecord.advance_deduction || 0)],
    ['Other Deductions', '—', fmtUGX(payrollRecord.other_deductions || 0)],
  ];

  doc.autoTable({
    startY: y,
    head: [['Description', 'Details', 'Amount (UGX)']],
    body: deductionRows,
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [180, 42, 51], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, textColor: [13, 31, 23] },
    alternateRowStyles: { fillColor: [253, 236, 234] },
    columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
    theme: 'grid',
  });

  y = doc.lastAutoTable.finalY + 8;

  // ── Net Pay summary box ─────────────────────────────────────────────────────
  const summaryBoxH = 28;
  doc.setFillColor(27, 67, 50);
  doc.roundedRect(margin, y, contentW, summaryBoxH, 4, 4, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 220, 190);
  doc.text('Gross Pay:', margin + 8, y + 8);
  doc.text('Total Deductions:', margin + 8, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(fmtUGX(payrollRecord.gross_pay || 0), margin + 55, y + 8);
  doc.text(fmtUGX((payrollRecord.advance_deduction || 0) + (payrollRecord.other_deductions || 0)), margin + 55, y + 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('NET PAY:', pageW - margin - 6 - 60, y + 17, { align: 'left' });
  doc.setFontSize(16);
  doc.setTextColor(77, 222, 128); // bright green
  doc.text(fmtUGX(payrollRecord.net_pay || 0), pageW - margin - 6, y + 17, { align: 'right' });

  y += summaryBoxH + 10;

  // ── Payment method ──────────────────────────────────────────────────────────
  if (employee.mobile_money_number) {
    doc.setFillColor(240, 250, 243);
    doc.roundedRect(margin, y, contentW, 18, 3, 3, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(74, 99, 88);
    doc.text('Payment Method:', margin + 6, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(27, 67, 50);
    doc.text(`${employee.mobile_money_provider || 'Mobile Money'} — ${employee.mobile_money_number}`, margin + 42, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(74, 99, 88);
    doc.text('Status:', margin + 6, y + 13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(45, 106, 79);
    doc.text(payrollRecord.payment_status === 'paid' ? '✓ PAID' : 'PENDING', margin + 24, y + 13);
    y += 26;
  }

  // ── Signature section ───────────────────────────────────────────────────────
  y += 8;
  doc.setDrawColor(226, 237, 231);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + 60, y);
  doc.line(pageW - margin - 60, y, pageW - margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(143, 168, 154);
  doc.text("Employee Signature", margin, y + 5);
  doc.text("Authorized By", pageW - margin, y + 5, { align: 'right' });

  // ── Footer ──────────────────────────────────────────────────────────────────
  doc.setFillColor(27, 67, 50);
  doc.rect(0, pageH - 14, pageW, 14, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 220, 190);
  doc.text('This is a computer-generated payslip. Kenena Farm Management System.', pageW / 2, pageH - 6, { align: 'center' });

  return doc.output('blob');
}

/**
 * Generate all payslips for a period as separate PDFs
 * Returns array of { employee_name, blob }
 */
export async function generateBatchPayslips(employees, payrollRecords, period) {
  const results = [];
  for (const emp of employees) {
    const record = payrollRecords.find(r => r.employee_id === emp.id);
    if (!record) continue;
    const blob = await generatePayslip(emp, record, period);
    results.push({ employee_name: emp.full_name, employee_code: emp.employee_code, blob });
  }
  return results;
}

/**
 * Trigger browser download of a payslip PDF
 */
export function downloadPayslip(blob, employeeName, period) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Payslip_${employeeName.replace(/\s+/g, '_')}_${period}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Share payslip via Web Share API (native Android share sheet)
 */
export async function sharePayslip(blob, employeeName, period) {
  const file = new File([blob], `Payslip_${employeeName}_${period}.pdf`, { type: 'application/pdf' });
  if (navigator.share && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: `Payslip — ${employeeName}`, text: `Payslip for ${period}` });
    return true;
  }
  // Fallback to download
  downloadPayslip(blob, employeeName, period);
  return false;
}
