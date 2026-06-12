import api from './api';

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (email, password) => api.post('/auth/login', { email, password }),
  getCurrentUser: () => api.get('/auth/me'),
  changePassword: (oldPassword, newPassword) => 
    api.post('/auth/change-password', { old_password: oldPassword, new_password: newPassword }),
};

export const userService = {
  list: () => api.get('/users'),
  get: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export const studentService = {
  registerFace: (imageDatas) =>
    api.post('/students/register-face', { image_data: Array.isArray(imageDatas) ? imageDatas : [imageDatas] }),
  getAttendanceHistory: () => api.get('/students/attendance-history'),
  getAttendancePercentage: () => api.get('/students/attendance-percentage'),
  markAttendance: (sessionId, imageData, latitude, longitude, wifiBssid, wifiRssi = null, hotspotOnly = false) =>
    api.post('/students/mark-attendance', {
      session_id: sessionId,
      image_data: imageData,
      latitude,
      longitude,
      wifi_bssid: wifiBssid,
      wifi_rssi: wifiRssi,
      hotspot_only: hotspotOnly,
    }),
  submitODRequest: (sessionId, reason, docUrl = null) =>
    api.post('/students/od-request', {
      session_id: sessionId,
      reason,
      supporting_document_url: docUrl,
    }),
  detectFaceVideo: (videoBlob) => {
    const formData = new FormData();
    formData.append('file', videoBlob, 'video.mp4');
    return api.post('/students/face-detect/video', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getAnnouncements: () => api.get('/students/announcements'),
};

export const facultyService = {
  createSession: (subjectId, sessionTitle, durationMinutes, latitude, longitude, radiusMeters, allowFacultyHotspot = false) =>
    api.post('/faculty/create-session', {
      subject_id: subjectId,
      session_title: sessionTitle,
      duration_minutes: durationMinutes,
      latitude,
      longitude,
      radius_meters: radiusMeters,
      allow_faculty_hotspot: allowFacultyHotspot,
    }),
  startSession: (sessionId) => api.post('/faculty/start-session', { session_id: sessionId }),
  endSession: (sessionId) => api.post('/faculty/end-session', { session_id: sessionId }),
  updateHotspotConfig: (userId, ssid, bssid) =>
    api.put(`/faculty/user/${userId}/hotspot-config`, {
      hotspot_ssid: ssid,
      hotspot_bssid: bssid,
    }),
  getSessions: () => api.get('/faculty/sessions'),
  getSessionAttendance: (sessionId) => api.get(`/faculty/session/${sessionId}/attendance`),
  manualMarkAttendance: (sessionId, studentId, status) =>
    api.post(`/faculty/session/${sessionId}/mark`, { student_id: studentId, status }),
  exportSessionAttendance: (sessionId) => api.get(`/faculty/session/${sessionId}/export`),
};

export const advisorService = {
  getStudents: () => api.get('/advisors/students'),
  getAnalytics: () => api.get('/advisors/analytics'),
  getShortageReports: () => api.get('/advisors/shortage-reports'),
  getODRequests: () => api.get('/advisors/od-requests'),
  approveODRequest: (id, status, comment = '') =>
    api.post(`/advisors/od-requests/${id}/approve`, { status, comment }),
  sendWarning: (studentId, message) =>
    api.post('/advisors/send-warning', { student_id: studentId, message }),
  postAnnouncement: (batch, department, section, message) => 
    api.post('/advisors/announcements', { batch, department, section, message }),
  getAnnouncements: () => api.get('/advisors/announcements'),
};

export const departmentService = {
  create: (data) => api.post('/departments/', data),
  list: () => api.get('/departments/'),
  get: (id) => api.get(`/departments/${id}`),
  update: (id, data) => api.put(`/departments/${id}`, data),
  delete: (id) => api.delete(`/departments/${id}`),
};

export const subjectService = {
  create: (data) => api.post('/subjects/', data),
  list: () => api.get('/subjects/'),
  getByFaculty: (facultyId) => api.get(`/subjects/faculty/${facultyId}`),
  update: (id, data) => api.put(`/subjects/${id}`, data),
  delete: (id) => api.delete(`/subjects/${id}`),
};

export const reportService = {
  getSemester: (department, semester, batch, subjectId = null) =>
    api.get('/reports/semester', {
      params: {
        department,
        semester,
        batch,
        subject_id: subjectId
      }
    }),
  getAuditLogs: () => api.get('/reports/audit-logs'),
};

export const notificationService = {
  list: () => api.get('/notifications'),
  markAsRead: (id) => api.post(`/notifications/${id}/read`),
};

export const attendanceService = {
  getActiveSessions: () => api.get('/attendance/active-sessions'),
  getWiFiConfig: () => api.get('/attendance/wifi-config'),
  addWiFiBSSID: (bssid, type = 'college') =>
    api.post('/attendance/wifi-config', { bssid, bssid_type: type }),
  getGeofenceConfig: () => api.get('/attendance/geofence-config'),
};

export const timetableService = {
  saveTimetable: (data) => api.post('/timetable/', data),
  getStudentTimetable: () => api.get('/timetable/student'),
  getFacultyTimetable: () => api.get('/timetable/faculty'),
  getTimetable: (batch, department, section, day_of_week) => 
    api.get('/timetable/search', { params: { batch, department, section, day_of_week } }),
  getTodayTimetable: () => api.get('/timetable/today'),
};

