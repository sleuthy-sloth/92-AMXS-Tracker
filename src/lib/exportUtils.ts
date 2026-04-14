import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { MaintenanceLog, TrainingRecord } from '../types';

// Extend jsPDF with autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export const exportLogsToCSV = (logs: MaintenanceLog[], shopId: string) => {
  const data = logs.map(log => ({
    'Tail Number': log.tail_number,
    'Discrepancy': log.discrepancy,
    'Repair Action': log.repair,
    'Doc Number': log.doc_number || 'N/A',
    'Technician': log.technician_name,
    'Man Number': log.man_number,
    'Date': log.timestamp?.toDate ? format(log.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : 'Pending',
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
    log.timestamp?.toDate ? format(log.timestamp.toDate(), 'yyyy-MM-dd') : 'Pending',
    log.isRedBall ? 'RED BALL' : 'NORMAL'
  ]);

  doc.autoTable({
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

export const exportTrainingToCSV = (records: TrainingRecord[], shopId: string) => {
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

  doc.autoTable({
    startY: 40,
    head: [['Course Name', 'Man #', 'Due Date', 'Status']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 9 }
  });

  doc.save(`Training_Readiness_${shopId}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
