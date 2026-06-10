const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

const SHEET_ID = '1eNnhDedKnRXrxI7FZHV0qQ5Ni6h1WF4Bv0naSO7YJO4';

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'credentials.json'),
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
  ],
});

async function getSheets() {
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

async function writeTab(sheets, tabName, rows) {
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: tabName + '!A1:Z10000',
    });
    if (rows.length === 0) return;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: tabName + '!A1',
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
    console.log('[Sheets] Written tab:', tabName);
  } catch (err) {
    console.error('[Sheets] Error writing tab ' + tabName + ':', err.message);
    throw err;
  }
}

async function syncMembers(members) {
  const sheets = await getSheets();
  const header = [
    'Member ID', 'Name', 'Mobile', 'Fathers Name', 'Fathers Mobile',
    'Aadhar', 'Fathers Occupation', 'Permanent Address',
    'Relative Name', 'Relative Mobile', 'Local Relative', 'Local Mobile',
    'Room No', 'Rent', 'Advance', 'Join Date', 'Leaving Date',
    'Police Verified', 'Status', 'Registered On',
  ];
  const rows = [header];
  members.forEach(function(m) {
    rows.push([
      m.memberId || '',
      m.name || '',
      m.mobileNo || '',
      m.fathersName || '',
      m.fathersMobileNo || '',
      m.aadharNumber || '',
      m.fathersOccupation || '',
      m.permanentAddress || '',
      m.permanentAddressRelativeName || '',
      m.permanentAddressRelativeMobile || '',
      m.localRelativeName || '',
      m.localRelativeMobile || '',
      m.roomNumber || '',
      m.rent || 0,
      m.advance || 0,
      m.roomJoinDate ? new Date(m.roomJoinDate).toLocaleDateString('en-IN') : '',
      m.roomLeavingDate ? new Date(m.roomLeavingDate).toLocaleDateString('en-IN') : '',
      m.policeFormVerified ? 'Yes' : 'No',
      m.isActive ? 'Active' : 'Inactive',
      m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-IN') : '',
    ]);
  });
  await writeTab(sheets, 'Members', rows);
}

async function syncReceipts(receipts) {
  const sheets = await getSheets();
  const header = [
    'Receipt Date', 'Room No', 'Month', 'Members in Room',
    'Rent', 'Advance', 'Electric', 'Other', 'Total',
    'Mode of Payment', 'Payment Type', 'Notes',
  ];
  const sorted = receipts.slice().sort(function(a, b) {
    if (a.roomNumber !== b.roomNumber) return a.roomNumber - b.roomNumber;
    return new Date(a.receiptDate) - new Date(b.receiptDate);
  });
  const rows = [header];
  sorted.forEach(function(r) {
    rows.push([
      r.receiptDate ? new Date(r.receiptDate).toLocaleDateString('en-IN') : '',
      r.roomNumber || '',
      r.month || '',
      (r.members || []).map(function(m) { return m.name; }).join(', '),
      r.rent || 0,
      r.advance || 0,
      r.electric || 0,
      r.other || 0,
      r.totalAmount || 0,
      r.modeOfPayment || 'cash',
      r.paymentType || '',
      r.notes || '',
    ]);
  });
  await writeTab(sheets, 'Receipts', rows);
}

async function syncMonthlyBilling(receipts) {
  const sheets = await getSheets();
  const header = [
    'Room No', 'Month', 'Rent', 'Advance', 'Electric', 'Other', 'Total', 'Mode', 'Members',
  ];
  var grouped = {};
  receipts.forEach(function(r) {
    var key = r.roomNumber + '-' + (r.monthYear || r.month || '');
    if (!grouped[key]) {
      grouped[key] = {
        room: r.roomNumber,
        month: r.month || '',
        monthYear: r.monthYear || '',
        rent: 0, advance: 0, electric: 0, other: 0, total: 0,
        modes: [], members: [],
      };
    }
    grouped[key].rent += r.rent || 0;
    grouped[key].advance += r.advance || 0;
    grouped[key].electric += r.electric || 0;
    grouped[key].other += r.other || 0;
    grouped[key].total += r.totalAmount || 0;
    if (r.modeOfPayment && grouped[key].modes.indexOf(r.modeOfPayment) === -1) {
      grouped[key].modes.push(r.modeOfPayment);
    }
    (r.members || []).forEach(function(m) {
      if (grouped[key].members.indexOf(m.name) === -1) grouped[key].members.push(m.name);
    });
  });
  var rows = [header];
  Object.values(grouped).sort(function(a, b) {
    return a.room - b.room;
  }).forEach(function(g) {
    rows.push([
      g.room, g.month,
      g.rent, g.advance, g.electric, g.other, g.total,
      g.modes.join(', '),
      g.members.join(', '),
    ]);
  });
  await writeTab(sheets, 'Monthly Billing', rows);
}

async function syncElectric(readings) {
  const sheets = await getSheets();
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const header = [
    'Room No', 'Month', 'Year', 'Start Reading', 'End Reading',
    'Units Used', 'Rate per Unit', 'Total Bill',
  ];
  var sorted = readings.slice().sort(function(a, b) {
    return a.roomNumber - b.roomNumber || b.year - a.year || b.month - a.month;
  });
  var rows = [header];
  sorted.forEach(function(r) {
    rows.push([
      r.roomNumber,
      MONTHS[(r.month || 1) - 1],
      r.year,
      r.startReading,
      r.endReading,
      r.unitsConsumed,
      r.ratePerUnit,
      r.totalAmount,
    ]);
  });
  await writeTab(sheets, 'Electric', rows);
}

async function syncSalary(salaries) {
  const sheets = await getSheets();
  const header = [
    'Employee Name', 'Role', 'Mobile', 'Basic Salary',
    'Allowances', 'Deductions', 'Net Salary',
    'Maintenance Cost', 'Other Expenses', 'Total Expense',
    'Month', 'Notes',
  ];
  var rows = [header];
  salaries.forEach(function(s) {
    rows.push([
      s.employeeName || '',
      s.role || '',
      s.mobile || '',
      s.basicSalary || 0,
      s.allowances || 0,
      s.deductions || 0,
      s.netSalary || 0,
      s.maintenanceCost || 0,
      s.otherExpenses || 0,
      s.totalExpense || 0,
      s.month || '',
      s.notes || '',
    ]);
  });
  await writeTab(sheets, 'Salary and Expenses', rows);
}

async function syncRoomSummary(members, receipts) {
  const sheets = await getSheets();
  const header = [
    'Room No', 'Total Members', 'Member Names', 'Member IDs',
    'Total Rent Collected', 'Total Electric', 'Total Advance', 'Total Billed',
  ];
  var rows = [header];
  for (var i = 1; i <= 20; i++) {
    var roomMembers = members.filter(function(m) { return m.roomNumber === i && m.isActive; });
    var roomReceipts = receipts.filter(function(r) { return r.roomNumber === i; });
    rows.push([
      i,
      roomMembers.length,
      roomMembers.map(function(m) { return m.name; }).join(', '),
      roomMembers.map(function(m) { return m.memberId || ''; }).join(', '),
      roomReceipts.reduce(function(s, r) { return s + (r.rent || 0); }, 0),
      roomReceipts.reduce(function(s, r) { return s + (r.electric || 0); }, 0),
      roomReceipts.reduce(function(s, r) { return s + (r.advance || 0); }, 0),
      roomReceipts.reduce(function(s, r) { return s + (r.totalAmount || 0); }, 0),
    ]);
  }
  await writeTab(sheets, 'Room Summary', rows);
}

async function syncAll(data) {
  var members  = data.members  || [];
  var receipts = data.receipts || [];
  var electric = data.electric || [];
  var salaries = data.salaries || [];

  await syncMembers(members);
  await syncReceipts(receipts);
  await syncMonthlyBilling(receipts);
  await syncElectric(electric);
  await syncSalary(salaries);
  await syncRoomSummary(members, receipts);
}

module.exports = {
  syncAll,
  syncMembers,
  syncReceipts,
  syncElectric,
  syncSalary,
  syncMonthlyBilling,
};
