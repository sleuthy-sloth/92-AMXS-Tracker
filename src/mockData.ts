import { UserProfile, MaintenanceLog, TrainingRecord, AMUType, ShiftType } from './types';
import { addDays, subDays, format } from 'date-fns';

export const SHOPS = ['AVIONICS', 'CREW_CHIEFS', 'JETS', 'E&E', 'LEADERSHIP'] as const;
export type ShopType = typeof SHOPS[number];
export const AMUS: AMUType[] = ['BLACK', 'GREEN', 'SILVER', 'BLUE'];

const FIRST_NAMES = ['JAMES', 'JOHN', 'ROBERT', 'MICHAEL', 'WILLIAM', 'DAVID', 'RICHARD', 'JOSEPH', 'THOMAS', 'CHARLES', 'MARY', 'PATRICIA', 'JENNIFER', 'LINDA', 'ELIZABETH', 'BARBARA', 'SUSAN', 'JESSICA', 'SARAH', 'KAREN'];
const LAST_NAMES = ['SMITH', 'JOHNSON', 'WILLIAMS', 'BROWN', 'JONES', 'GARCIA', 'MILLER', 'DAVIS', 'RODRIGUEZ', 'MARTINEZ', 'HERNANDEZ', 'LOPEZ', 'GONZALEZ', 'WILSON', 'ANDERSON', 'THOMAS', 'TAYLOR', 'MOORE', 'JACKSON', 'MARTIN'];
const RANKS = ['A1C', 'SrA', 'SSgt', 'TSgt', 'MSgt'];
const SHIFTS: ShiftType[] = ['Days', 'Swings', 'Nights', 'Weekend Duty'];

const COURSES = [
  'Advanced Avionics Systems', 'Flight Safety Refresher', 'Classified Comms Handling',
  'Tire & Wheel Maintenance', 'F108 Engine Overhaul', 'Electrical Systems Safety',
  'Battery Maintenance', 'Hydraulics Troubleshooting', 'Egress Systems Familiarization',
  'Cyber Awareness Challenge', 'Force Protection', 'LOAC'
];

const DISCREPANCIES = [
  'Radar altimeter intermittent failure during low-level flight.',
  'Navigation display flickering in cold weather.',
  'Left main tire showing excessive wear.',
  'Engine #2 high oil consumption reported.',
  'Generator #1 offline during run-up.',
  'Hydraulic leak observed near main landing gear.',
  'UHF radio fails to transmit on preset 4.',
  'Anti-collision light inoperative.',
  'Fuel imbalance detected during cruise.',
  'Cabin pressure fluctuating at altitude.'
];

const REPAIRS = [
  'Replaced LRU-3 and verified signal integrity.',
  'Reseated connections and updated firmware.',
  'Replaced tire and inspected brake assembly.',
  'Inspected seals, found leak in scavenge pump, replaced pump.',
  'Reset CSD and performed operational check. Good.',
  'Tightened B-nut on hydraulic line, serviced system, no leaks.',
  'Swapped RT unit, ops check good.',
  'Replaced bulb and cleaned housing.',
  'Calibrated fuel quantity indicating system.',
  'Replaced outflow valve and performed pressure test.'
];

export const MOCK_PERSONNEL: UserProfile[] = [];
export const MOCK_TRAINING: TrainingRecord[] = [];
export const MOCK_LOGS: MaintenanceLog[] = [];

let userCounter = 1;
let logCounter = 1;
let trainingCounter = 1;

// Add the preview user first
MOCK_PERSONNEL.push({
  uid: 'mock-user-preview',
  name: 'PREVIEW USER',
  rank: 'TSgt',
  man_number: '99999',
  shopId: 'AVIONICS',
  amuId: 'BLACK',
  role: 'ncoic',
  email: 'dev.preview@92amxs.af.mil',
  phone: '5672016985',
  status: 'active',
  isDemo: true
});

AMUS.forEach(amu => {
  SHOPS.forEach(shop => {
    // 3 to 5 personnel per shop per AMU
    const numPersonnel = Math.floor(Math.random() * 3) + 3; 
    
    for (let i = 0; i < numPersonnel; i++) {
      const isNcoic = i === 0; // First person is NCOIC
      const isLeadership = shop === 'LEADERSHIP';
      
      const role = isLeadership ? 'leadership' : (isNcoic ? 'ncoic' : 'technician');
      const rank = isLeadership ? 'MSgt' : (isNcoic ? 'TSgt' : RANKS[Math.floor(Math.random() * 3)]); // A1C, SrA, SSgt
      
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
      const manNumber = (10000 + userCounter).toString();
      
      const user: UserProfile = {
        uid: `mock-user-${userCounter}`,
        name: `${lastName}, ${firstName.charAt(0)}`,
        rank,
        man_number: manNumber,
        shopId: shop,
        amuId: amu,
        role,
        email: `${lastName.toLowerCase()}.${firstName.charAt(0).toLowerCase()}@92amxs.af.mil`,
        phone: `555${manNumber.substring(1)}`,
        status: 'active',
        isDemo: true
      };
      
      MOCK_PERSONNEL.push(user);
      
      // Generate 2-4 training records per person
      const numTraining = Math.floor(Math.random() * 3) + 2;
      for (let t = 0; t < numTraining; t++) {
        const course = COURSES[Math.floor(Math.random() * COURSES.length)];
        const daysOffset = Math.floor(Math.random() * 365) - 60; // -60 to +305 days
        const dueDate = addDays(new Date(), daysOffset);
        
        let status: 'current' | 'expiring' | 'expired' = 'current';
        if (daysOffset < 0) status = 'expired';
        else if (daysOffset <= 30) status = 'expiring';
        
        MOCK_TRAINING.push({
          id: `t${trainingCounter++}`,
          man_number: manNumber,
          course_name: course,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          shopId: shop,
          amuId: amu,
          status,
          isDemo: true
        });
      }
      
      // Generate 1-3 maintenance logs per person (if not leadership)
      if (!isLeadership) {
        const numLogs = Math.floor(Math.random() * 3) + 1;
        for (let l = 0; l < numLogs; l++) {
          const discIndex = Math.floor(Math.random() * DISCREPANCIES.length);
          const daysAgo = Math.floor(Math.random() * 14); // Last 14 days
          
          MOCK_LOGS.push({
            id: `mock-log-${logCounter++}`,
            tail_number: `AF-92-0${Math.floor(Math.random() * 900) + 100}`,
            discrepancy: DISCREPANCIES[discIndex],
            repair: REPAIRS[discIndex],
            shopId: shop,
            amuId: amu,
            technician_name: user.name,
            man_number: manNumber,
            timestamp: { toDate: () => subDays(new Date(), daysAgo) } as any,
            isRedBall: Math.random() > 0.8,
            shift: SHIFTS[Math.floor(Math.random() * SHIFTS.length)],
            isDemo: true
          });
        }
      }
      
      userCounter++;
    }
  });
});
