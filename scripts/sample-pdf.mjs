import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { mkdirSync, writeFileSync } from 'node:fs';

// A reproducible, entirely fictional packet. Section lengths total 30 pages.
const sections = [
  { title: 'Library roof repairs', department: 'Facilities', pages: 3, budget: 84500 },
  { title: 'Street lighting replacement', department: 'Transportation', pages: 5, budget: 162000 },
  { title: 'Riverside park maintenance', department: 'Parks and Recreation', pages: 2, budget: 28750 },
  { title: 'Water quality monitoring', department: 'Water Services', pages: 4, budget: 56000 },
  { title: 'North bridge inspection', department: 'Engineering', pages: 6, budget: 117500 },
  { title: 'School ventilation upgrades', department: 'Facilities', pages: 3, budget: 235000 },
  { title: 'Accessible sidewalk repairs', department: 'Transportation', pages: 4, budget: 92300 },
  { title: 'Community center equipment', department: 'Community Services', pages: 3, budget: 41200 },
];
const pdf = await PDFDocument.create();
pdf.setTitle('Riverton public works: sample procurement packet');
pdf.setAuthor('PDF Splitter');
pdf.setSubject('Fictional example records: 30 pages in 8 sections');
pdf.setCreationDate(new Date('2026-09-18T12:00:00Z'));
pdf.setModificationDate(new Date('2026-09-18T12:00:00Z'));
const regular = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const navy = rgb(.16, .23, .34);
const gray = rgb(.42, .46, .5);
const rule = rgb(.76, .8, .84);
const pale = rgb(.94, .96, .98);
const money = value => `$${value.toLocaleString('en-US')}`;

function text(page, value, x, y, size = 10, font = regular, color = navy) {
  page.drawText(value, { x, y, size, font, color });
}
function paragraph(page, value, y, width = 500) {
  let line = '';
  for (const word of value.split(/\s+/)) {
    if (line && regular.widthOfTextAtSize(`${line} ${word}`, 10) > width) {
      text(page, line, 52, y); y -= 15; line = '';
    }
    line += `${line ? ' ' : ''}${word}`;
  }
  if (line) { text(page, line, 52, y); y -= 15; }
  return y - 12;
}
function heading(page, value, y) {
  text(page, value, 52, y, 12, bold);
  return y - 24;
}
function table(page, rows, y) {
  rows.forEach((row, index) => {
    page.drawRectangle({ x: 52, y: y - 25, width: 508, height: 28, color: index === 0 ? navy : index % 2 ? pale : rgb(1, 1, 1) });
    row.forEach((value, column) => text(page, value, [62, 330, 470][column], y - 15, 9, index === 0 ? bold : regular, index === 0 ? rgb(1, 1, 1) : navy));
    y -= 28;
  });
  return y - 22;
}
for (const [index, section] of sections.entries()) {
  const id = `PW-2026-${String(index + 41).padStart(3, '0')}`;
  for (let within = 0; within < section.pages; within++) {
    const page = pdf.addPage([612, 792]);
    text(page, 'CITY OF RIVERTON', 52, 742, 13, bold);
    text(page, 'OFFICE OF PUBLIC WORKS', 52, 726, 8, regular, gray);
    text(page, id, 458, 742, 10, bold);
    page.drawLine({ start: { x: 52, y: 709 }, end: { x: 560, y: 709 }, thickness: 2, color: navy });
    if (within === 0) {
      text(page, 'PROCUREMENT REQUEST', 52, 671, 23, bold);
      text(page, section.title, 52, 641, 15);
      const fields = [['DEPARTMENT', section.department], ['ESTIMATED COST', money(section.budget)], ['REQUEST DATE', `September ${10 + index}, 2026`], ['REQUEST STATUS', 'Submitted for review']];
      fields.forEach(([label, value], field) => {
        const y = 589 - field * 70;
        text(page, label, 52, y, 8, bold, gray);
        page.drawRectangle({ x: 52, y: y - 39, width: 508, height: 30, borderColor: rule, borderWidth: .7 });
        text(page, value, 63, y - 29, 11);
      });
      let y = heading(page, 'Purpose of request', 270);
      y = paragraph(page, `The ${section.department} department requests approval for ${section.title.toLowerCase()}. This packet includes the proposed scope, supporting estimates and review requirements. Funding is subject to the adopted capital improvement plan.`, y);
      text(page, 'Prepared by: Morgan Lee, Project Coordinator', 52, y - 14, 10);
      page.drawLine({ start: { x: 52, y: 114 }, end: { x: 294, y: 114 }, thickness: .6, color: rule });
      text(page, 'Department approval', 52, 100, 8, regular, gray);
      text(page, `${section.pages} pages including this cover`, 376, 100, 9, regular, gray);
    } else {
      const title = ['Scope of work', 'Cost estimate', 'Schedule and delivery', 'Inspection requirements', 'Review memorandum'][within - 1];
      text(page, title, 52, 673, 21, bold);
      text(page, section.title, 52, 645, 13);
      let y = heading(page, '1. Project overview', 606);
      y = paragraph(page, `This document supports ${id} for ${section.title.toLowerCase()}. Work will take place at city-owned facilities and public rights of way. The contractor must coordinate access with the ${section.department} department and maintain safe public access throughout the project.`, y);
      y = heading(page, '2. Work items and estimate', y - 5);
      y = table(page, [['Work item', 'Allocation', 'Amount'], ['Site survey and preparation', '15%', money(Math.round(section.budget * .15))], ['Materials and installation', '65%', money(Math.round(section.budget * .65))], ['Inspection and handover', '10%', money(Math.round(section.budget * .1))], ['Contingency allowance', '10%', money(Math.round(section.budget * .1))], ['Total estimated cost', '100%', money(section.budget)]], y);
      y = heading(page, '3. Delivery requirements', y);
      y = paragraph(page, 'The department will hold a pre-start meeting within ten business days of authorization. Weekly progress notes must identify completed work, upcoming activities and any changes to the approved schedule. Final payment requires inspection and written acceptance by the project coordinator.', y);
      y = heading(page, '4. Record of review', y - 4);
      paragraph(page, `The preliminary estimate was checked against recent city contracts. No award has been made. The purchasing office will retain bids, correspondence and inspection records under reference ${id}. This supporting page is ${within + 1} of ${section.pages} in the request.`, y);
    }
    page.drawLine({ start: { x: 52, y: 62 }, end: { x: 560, y: 62 }, thickness: .5, color: rule });
    text(page, 'EXAMPLE DOCUMENTS - FICTIONAL RECORDS', 52, 45, 7, regular, gray);
    text(page, `Packet page ${pdf.getPageCount()}  |  ${within + 1} of ${section.pages}`, 429, 45, 8, regular, gray);
  }
}
mkdirSync('public', { recursive: true });
writeFileSync('public/sample-packet.pdf', await pdf.save());
console.log(`Generated ${pdf.getPageCount()} pages in ${sections.length} sections.`);
