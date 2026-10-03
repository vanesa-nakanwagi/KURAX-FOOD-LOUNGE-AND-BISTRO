import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function downloadReportPdf({ filename, title, from, to, sections, periodText, companyName, footerLabel = 'Department Report', orientation = 'portrait' }) {
  const document = new jsPDF({ unit: 'pt', format: 'a4', orientation });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();

  document.setTextColor(0, 0, 0);
  document.setFont('helvetica', 'bold');
  document.setFontSize(16);
  document.text(title, 40, 46);
  document.setFont('helvetica', 'normal');
  document.setFontSize(10);
  if (companyName) document.text(companyName, 40, 64);
  document.text(periodText || `Period: ${from} to ${to}`, 40, companyName ? 80 : 64);
  document.setDrawColor(0, 0, 0);
  document.setLineWidth(0.7);
  const headerLineY = companyName ? 92 : 76;
  document.line(40, headerLineY, pageWidth - 40, headerLineY);

  let cursorY = headerLineY + 18;
  sections.forEach(section => {
    if (cursorY > pageHeight - 70) {
      document.addPage();
      cursorY = 48;
    }
    document.setFont('helvetica', 'bold');
    document.setFontSize(11);
    document.text(section.title, 40, cursorY);
    autoTable(document, {
      startY: cursorY + 8,
      margin: { left: 40, right: 40, bottom: 44 },
      head: [section.columns],
      body: section.rows.length ? section.rows : [['No data for this period', ...section.columns.slice(1).map(() => '')]],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, textColor: 0, fillColor: 255, lineColor: 0, lineWidth: 0.35 },
      headStyles: { fontStyle: 'bold', textColor: 0, fillColor: 230, lineColor: 0 },
      alternateRowStyles: { fillColor: 255 },
    });
    cursorY = document.lastAutoTable.finalY + 24;
  });

  for (let page = 1; page <= document.getNumberOfPages(); page += 1) {
    document.setPage(page);
    document.setFont('helvetica', 'normal');
    document.setFontSize(8);
    document.setTextColor(0, 0, 0);
    document.text(`Kurax ${footerLabel}  |  Page ${page} of ${document.getNumberOfPages()}`, 40, pageHeight - 22);
  }

  document.save(filename);
}