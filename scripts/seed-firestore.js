/**
 * Firebase Firestore Seed Script
 * ─────────────────────────────
 * Run this script ONCE to create the initial Faculty, Advisor, and HOD 
 * accounts in Firebase. These roles cannot self-register.
 * 
 * PREREQUISITES:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Enable Email/Password authentication in Firebase Console > Authentication > Sign-in method
 * 3. Update src/firebase/config.js with your actual Firebase project credentials
 * 4. Create the following users in Firebase Console > Authentication > Users:
 *    - alan.turing@sece.ac.in (password: Alan@123)
 *    - grace.hopper@sece.ac.in (password: Grace@123)
 *    - margaret.h@sece.ac.in (password: Margaret@123)
 * 5. Copy each user's UID from the Firebase Console
 * 6. Update the UIDs below with the actual UIDs
 * 7. Run: node scripts/seed-firestore.js
 * 
 * NOTE: This script uses the Firebase Admin SDK approach via REST.
 * For simplicity, you can also manually add documents in Firebase Console > Firestore.
 */

// ═══════════════════════════════════════════════════════════════
// MANUAL FIRESTORE SETUP GUIDE
// ═══════════════════════════════════════════════════════════════
//
// If you prefer to set up Firestore manually via the Firebase Console:
//
// 1. Go to Firebase Console > Firestore Database > Create Database
// 2. Start in TEST MODE for development
// 3. Create a collection called "users"
// 4. Add the following documents (use the Auth UID as document ID):
//
// Document 1 (Faculty):
//   Document ID: <UID from Firebase Auth for alan.turing@sece.ac.in>
//   Fields:
//     name: "Dr. Alan Turing" (string)
//     email: "alan.turing@sece.ac.in" (string)
//     role: "faculty" (string)
//     department: "Computer Science" (string)
//     createdAt: <server timestamp>
//
// Document 2 (Advisor):
//   Document ID: <UID from Firebase Auth for grace.hopper@sece.ac.in>
//   Fields:
//     name: "Prof. Grace Hopper" (string)
//     email: "grace.hopper@sece.ac.in" (string)
//     role: "advisor" (string)
//     department: "Computer Science" (string)
//     batch: "CSE-2026" (string)
//     createdAt: <server timestamp>
//
// Document 3 (HOD):
//   Document ID: <UID from Firebase Auth for margaret.h@sece.ac.in>
//   Fields:
//     name: "Dr. Margaret Hamilton" (string)
//     email: "margaret.h@sece.ac.in" (string)
//     role: "hod" (string)
//     department: "Computer Science" (string)
//     createdAt: <server timestamp>
//
// 5. Create a collection called "classes" and add:
//
// Document 1:
//   Document ID: "CS101"
//   Fields:
//     name: "Computer Science 101" (string)
//     code: "CS101" (string)
//     timeSlot: "10:00 AM - 11:00 AM" (string)
//     room: "LH-01" (string)
//     facultyId: <UID of alan.turing> (string)
//     activeDays: ["Mon", "Wed", "Fri"] (array)
//     wifiSSID: "CAMPUS_WIFI_LH01" (string)
//     wifiBSSID: "00:1A:2B:3C:4D:5E" (string)
//
// Document 2:
//   Document ID: "CS102"
//   Fields:
//     name: "Data Structures & Algorithms" (string)
//     code: "CS102" (string)
//     timeSlot: "11:00 AM - 12:00 PM" (string)
//     room: "LH-02" (string)
//     facultyId: <UID of alan.turing> (string)
//     activeDays: ["Mon", "Wed"] (array)
//     wifiSSID: "CAMPUS_WIFI_LH02" (string)
//     wifiBSSID: "00:1A:2B:3C:4D:7F" (string)
//
// Document 3:
//   Document ID: "CS103"
//   Fields:
//     name: "Artificial Intelligence" (string)
//     code: "CS103" (string)
//     timeSlot: "02:00 PM - 03:00 PM" (string)
//     room: "Lab-03" (string)
//     facultyId: <UID of alan.turing> (string)
//     activeDays: ["Tue", "Thu"] (array)
//     wifiSSID: "CAMPUS_WIFI_LAB03" (string)
//     wifiBSSID: "00:1A:2B:3C:4D:9A" (string)
//
// ═══════════════════════════════════════════════════════════════

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Smart Attendance System - Firebase Setup Guide             ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  STEP 1: Create a Firebase project                          ║
║    → https://console.firebase.google.com                    ║
║                                                              ║
║  STEP 2: Enable Email/Password auth                         ║
║    → Authentication > Sign-in method > Email/Password       ║
║                                                              ║
║  STEP 3: Create Firestore Database                          ║
║    → Firestore > Create Database > Start in Test mode       ║
║                                                              ║
║  STEP 4: Update your Firebase config                        ║
║    → Edit src/firebase/config.js with your project keys     ║
║                                                              ║
║  STEP 5: Create staff accounts in Auth console              ║
║    → Add users with @sece.ac.in emails                      ║
║                                                              ║
║  STEP 6: Add user profiles in Firestore                     ║
║    → See the detailed guide above in this file              ║
║                                                              ║
║  Students can self-register via the app!                    ║
║  Faculty/Admin accounts must be created manually.           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
