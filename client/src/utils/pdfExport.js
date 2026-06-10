/**
 * PDF export using browser print — no extra library needed.
 * Opens a styled print window and triggers print dialog.
 */
export function printReceiptAsPDF(receipt, onDone) {
  const PKG = { rent:'Rent / किराया', advance:'Advance / एडवांस', electric:'Electric / बिजली', final:'Final / अंतिम', other:'Other / अन्य' };
  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'}) : '—';
  const words = receipt.amountInWords || '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Receipt ${receipt.billNumber}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Noto Sans',sans-serif;padding:32px;color:#111;font-size:13px;max-width:600px;margin:auto;}
    .header{text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px;}
    .title{font-size:22px;font-weight:700;letter-spacing:1px;}
    .subtitle{font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.1em;margin-top:2px;}
    .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #ddd;}
    .label{color:#555;} .value{font-weight:500;}
    .amount-box{text-align:center;padding:16px;background:#111;color:#fff;border-radius:6px;margin:16px 0;}
    .amount-num{font-size:28px;font-weight:900;letter-spacing:2px;}
    .words-box{background:#f8f8f8;border:1px solid #ddd;border-radius:4px;padding:10px 14px;margin:12px 0;}
    .words-label{font-size:10px;color:#777;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;}
    .sig{display:flex;justify-content:flex-end;margin-top:40px;}
    .sig-line{width:180px;text-align:center;border-top:1px solid #333;padding-top:6px;font-size:11px;color:#555;}
    @media print{body{padding:16px;} @page{margin:10mm;}}
  </style></head><body>
  <div class="header">
    <div class="title">HOSTEL MANAGER</div>
    <div class="subtitle">Payment Receipt / भुगतान रसीद</div>
  </div>
  <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
    <div><span style="color:#555">Date: </span><strong>${fmt(receipt.receiptDate)}</strong></div>
    <div><span style="color:#555">Receipt #: </span><strong>${receipt.receiptNumber}</strong></div>
  </div>
  <div style="margin-bottom:14px;"><span style="color:#555">Bill No.: </span><strong style="color:#c00;font-size:15px;">${receipt.billNumber||'—'}</strong></div>
  ${[
    ['Name / नाम', receipt.memberName],
    ['Contact / संपर्क', receipt.memberMobile],
    ['Room / कमरा', receipt.roomNumber ? `Room ${receipt.roomNumber}` : '—'],
    ['Package / पैकेज', PKG[receipt.packageName] || receipt.packageName],
    ['From / दिनांक से', fmt(receipt.fromDate)],
    ['To / दिनांक तक', fmt(receipt.toDate)],
    ['Mode / भुगतान विधि', receipt.modeOfPayment === 'online' ? 'Online / ऑनलाइन' : 'Cash / नगद'],
  ].map(([l,v]) => `<div class="row"><span class="label">${l}</span><span class="value">${v||'—'}</span></div>`).join('')}
  <div class="amount-box">
    <div style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;opacity:.7;margin-bottom:4px;">Amount Paid / भुगतान राशि</div>
    <div class="amount-num">₹${receipt.totalAmount}</div>
  </div>
  <div class="words-box">
    <div class="words-label">Sum of Rupees / शब्दों में</div>
    <div style="font-size:14px;font-weight:600;">${words}</div>
  </div>
  ${receipt.notes ? `<div style="margin-top:10px;font-size:11px;color:#777;">Note: ${receipt.notes}</div>` : ''}
  <div class="sig"><div class="sig-line">हस्ताक्षर / Signature<br><span style="font-size:10px;">(Authorized Signatory)</span></div></div>
  </body></html>`;

  const w = window.open('', '_blank', 'width=700,height=900');
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.print(); if (onDone) onDone(); }, 600);
}

export function printFinalBillAsPDF(ref) {
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Final Bill</title>
  <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans',sans-serif;padding:24px;color:#111;font-size:12px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;}th{background:#f5f5f5;font-weight:700;}@media print{@page{margin:10mm;}}</style>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  </head><body>${ref.current.innerHTML}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 600);
}
