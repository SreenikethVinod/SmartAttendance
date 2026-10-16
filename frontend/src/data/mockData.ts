import { Student, Faculty, TimetablePeriod, AttendanceRecord, NetworkConfig } from '../types/attendance';

// Official 7-Period Timetable for B.Tech Computer Science & Engineering (The only demo dataset)
export const TIMETABLE_PERIODS: TimetablePeriod[] = [
  {
    periodNumber: 1,
    timeSlot: '09:00 - 09:50',
    subjectCode: 'CSE301',
    subjectName: 'Computer Networks',
    facultyId: 'FAC-CSE-101',
    facultyName: 'Dr. K. Narayanan',
    room: 'Hall CR-304',
  },
  {
    periodNumber: 2,
    timeSlot: '09:55 - 10:45',
    subjectCode: 'CSE302',
    subjectName: 'Operating Systems',
    facultyId: 'FAC-CSE-101',
    facultyName: 'Dr. K. Narayanan',
    room: 'Hall CR-304',
  },
  {
    periodNumber: 3,
    timeSlot: '10:55 - 11:45',
    subjectCode: 'IKS201',
    subjectName: 'Indian Knowledge Systems & Logic',
    facultyId: 'FAC-IKS-204',
    facultyName: 'Dr. Meenakshi Sundaram',
    room: 'Auditorium A-1',
  },
  {
    periodNumber: 4,
    timeSlot: '11:50 - 12:40',
    subjectCode: 'CSE303',
    subjectName: 'Database Management Systems',
    facultyId: 'FAC-CSE-101',
    facultyName: 'Prof. Radhika Menon',
    room: 'CS Lab 2',
  },
  {
    periodNumber: 5,
    timeSlot: '01:30 - 02:20',
    subjectCode: 'CSE304',
    subjectName: 'Design & Analysis of Algorithms',
    facultyId: 'FAC-CSE-101',
    facultyName: 'Dr. K. Narayanan',
    room: 'Hall CR-304',
  },
  {
    periodNumber: 6,
    timeSlot: '02:25 - 03:15',
    subjectCode: 'SAN102',
    subjectName: 'Computational Linguistics & Sanskrit',
    facultyId: 'FAC-SAN-101',
    facultyName: 'Vidwan R. Sharma',
    room: 'Hall CR-301',
  },
  {
    periodNumber: 7,
    timeSlot: '03:20 - 04:10',
    subjectCode: 'CSE305',
    subjectName: 'Software Engineering & Agile Practices',
    facultyId: 'FAC-CSE-101',
    facultyName: 'Dr. K. Narayanan',
    room: 'Hall CR-304',
  },
];

// Pre-added 2 student accounts (neither verified yet, must enroll face on first login)
export const INITIAL_STUDENTS: Student[] = [
  {
    id: 'stud-1',
    prn: 'CVV240871',
    rollNo: 1,
    name: 'Student 1 (Sreeniketh Vinod)',
    email: 'student1@cvv.ac.in',
    department: 'B.Tech Computer Science & Engineering',
    semester: 'Semester 6',
    batch: '2024 - 2028',
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Student+1&backgroundColor=0b2545&textColor=ffffff',
    isFaceEnrolled: false, // Must verify on first login
    overallAttendancePercentage: 85,
  },
  {
    id: 'stud-2',
    prn: 'CVV240872',
    rollNo: 2,
    name: 'Student 2 (Ananya Nair)',
    email: 'student2@cvv.ac.in',
    department: 'B.Tech Computer Science & Engineering',
    semester: 'Semester 6',
    batch: '2024 - 2028',
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Student+2&backgroundColor=0b2545&textColor=ffffff',
    isFaceEnrolled: false, // Must verify on first login
    overallAttendancePercentage: 90,
  },
];

// Pre-added 1 teacher account
export const INITIAL_FACULTY: Faculty[] = [
  {
    id: 'fac-1',
    facultyId: 'FAC-CSE-101',
    name: 'Dr. K. Narayanan',
    department: 'Computer Science & Engineering',
    designation: 'Professor & Head of Department',
    email: 'k.narayanan@cvv.ac.in',
    courses: [
      'CSE301: Computer Networks',
      'CSE302: Operating Systems',
      'CSE304: Design & Analysis of Algorithms',
    ],
  },
];

export const INITIAL_NETWORK_CONFIG: NetworkConfig = {
  isClassroomWifiConnected: true,
  currentSsid: 'Classroom Base Wi-Fi',
  currentIp: '',
  currentIsp: 'Authorized Campus Gateway',
  currentLocation: 'Campus Hall CR-304',
  baseWifiIp: '', // Automatically captured from user's active Wi-Fi connection
  baseWifiIsp: 'Classroom Authorized Wi-Fi',
  baseWifiName: 'Authorized Classroom Wi-Fi Network',
  allowedSsid: 'CVV-Classroom-Secure',
  allowedSubnetPrefix: '',
  isSimulationActive: false,
  lastCheckedAt: Date.now(),
};

export const createInitialRecords = (todayDate: string): AttendanceRecord[] => {
  return [];
};
