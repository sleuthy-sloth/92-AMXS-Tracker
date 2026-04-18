import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { MaintenanceLog, TrainingRecord, DIFMLog } from '../types';
import { tsToDate } from './utils';

// xlsx is ~900 KB; keep it out of the initial chunk by importing only when the
// user actually exports.
const loadXLSX = () => import('xlsx');

export const exportLogsToCSV = async (logs: MaintenanceLog[], shopId: string) => {
  const XLSX = await loadXLSX();
  const data = logs.map(log => ({
    'Tail Number': log.tail_number,
    'Discrepancy': log.discrepancy,
    'Repair Action': log.repair,
    'Doc Number': log.doc_number || 'N/A',
    'Technician': log.technician_name,
    'Man Number': log.man_number,
    'Date': log.timestamp ? format(tsToDate(log.timestamp), 'yyyy-MM-dd HH:mm') : 'Pending',
    'Red Ball': log.isRedBall ? 'YES' : 'NO'
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Maintenance Logs');
  XLSX.writeFile(wb, `Maintenance_Logs_${shopId}_${format(new Date(), 'yyyyMMdd')}.csv`);
};

export const exportLogsToPDF = (logs: MaintenanceLog[], shopId: string) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(`92nd AMXS Maintenance Summary - ${shopId}`, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 30);

  const tableData = logs.map(log => [
    log.tail_number,
    log.discrepancy,
    log.technician_name,
    log.timestamp ? format(tsToDate(log.timestamp), 'yyyy-MM-dd') : 'Pending',
    log.isRedBall ? 'RED BALL' : 'NORMAL'
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Tail #', 'Discrepancy', 'Technician', 'Date', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59] }, // Slate 800
    styles: { fontSize: 8 },
    columnStyles: {
      1: { cellWidth: 80 }
    }
  });

  doc.save(`Maintenance_Report_${shopId}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

export const exportTrainingToCSV = async (records: TrainingRecord[], shopId: string) => {
  const XLSX = await loadXLSX();
  const data = records.map(record => ({
    'Course Name': record.course_name,
    'Man Number': record.man_number,
    'Due Date': record.due_date,
    'Status': record.status.toUpperCase()
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Training Status');
  XLSX.writeFile(wb, `Training_Status_${shopId}_${format(new Date(), 'yyyyMMdd')}.csv`);
};

export const exportTrainingToPDF = (records: TrainingRecord[], shopId: string) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text(`92nd AMXS Training Readiness - ${shopId}`, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 30);

  const tableData = records.map(record => [
    record.course_name,
    record.man_number,
    record.due_date,
    record.status.toUpperCase()
  ]);

  autoTable(doc, {
    startY: 40,
    head: [['Course Name', 'Man #', 'Due Date', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 9 }
  });

  doc.save(`Training_Readiness_${shopId}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

export const exportTurnoverToPDF = (
  logs: MaintenanceLog[], 
  difm: DIFMLog[], 
  shopId: string, 
  amuId: string,
  shift: string
) => {
  const doc = new jsPDF();
  
  // Header
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255);
  doc.setFontSize(22);
  doc.text('SHIFT TURNOVER REPORT', 14, 18);
  doc.setFontSize(10);
  doc.text(`92nd AMXS // ${amuId} AMU // ${shopId} SHOP`, 14, 28);
  doc.text(`SHIFT: ${shift.toUpperCase()} // DATE: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 34);

  // Section 1: Active Maintenance
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.text('ACTIVE MAINTENANCE JOBS', 14, 52);
  
  const maintData = logs.map(l => [
    l.tail_number,
    l.discrepancy,
    l.isRedBall ? 'RED BALL' : 'OPEN',
    l.technician_name
  ]);

  autoTable(doc, {
    startY: 56,
    head: [['TAIL #', 'DISCREPANCY', 'STATUS', 'TECH']],
    body: maintData,
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105] }, // Slate 600
    styles: { fontSize: 8 }
  });

  // Section 2: DIFM / Parts Logistics
  const finalY = (doc as any).lastAutoTable.finalY || 100;
  doc.setFontSize(14);
  doc.text('LOGISTICS / DIFM TRACKING', 14, finalY + 15);

  const difmData = difm.map(d => [
    d.tail_number,
    d.doc_number || 'N/A',
    d.status.toUpperCase(),
    d.pipeline_status?.toUpperCase() || 'ORDERED'
  ]);

  autoTable(doc, {
    startY: finalY + 20,
    head: [['TAIL #', 'DOC #', 'LOG STATUS', 'PIPELINE']],
    body: difmData,
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110] }, // Teal 700
    styles: { fontSize: 8 }
  });

  // Section 3: Shift Notes Area
  const nextY = (doc as any).lastAutoTable.finalY || 200;
  doc.setFontSize(14);
  doc.text('HAND-OFF NOTES', 14, nextY + 15);
  doc.rect(14, nextY + 20, 182, 40);
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Capture any outstanding tasks, tool box status, or safety briefings here...', 18, nextY + 28);

  doc.save(`Turnover_${amuId}_${shopId}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
