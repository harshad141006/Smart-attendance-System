import { firebaseDb } from '../config/firebase.js';

// Demo in-memory notifications storage
const demoNotifications = [
  {
    id: 'notif_1',
    userId: 'default_student',
    title: 'Face Registration Required',
    message: 'Please register your face profile in the settings to enable auto-attendance.',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
    read: false
  },
  {
    id: 'notif_2',
    userId: 'default_student',
    title: 'Attendance Alert',
    message: 'Your attendance in Web Development is currently 71.4%, which is below the 75% threshold.',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
    read: false
  },
  {
    id: 'notif_3',
    userId: 'default_student',
    title: 'System Profile Verified',
    message: 'Your student profile details have been successfully verified by the administrator.',
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(), // 2 days ago
    read: true
  }
];

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;

    try {
      if (!firebaseDb) {
        throw new Error('Firebase DB not initialized');
      }
      const snapshot = await firebaseDb.collection('notifications')
        .where('userId', '==', userId)
        .orderBy('created_at', 'desc')
        .get();

      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (records.length === 0) {
        const userDemo = demoNotifications.map(n => ({ ...n, userId }));
        return res.json(userDemo);
      }

      res.json(records);
    } catch (firebaseError) {
      // Demo mode / fallback
      const userDemo = demoNotifications.map(n => ({ ...n, userId }));
      res.json(userDemo);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid || req.user.id;

    try {
      if (!firebaseDb) {
        throw new Error('Firebase DB not initialized');
      }
      const notifRef = firebaseDb.collection('notifications').doc(id);
      const doc = await notifRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      await notifRef.update({ read: true });
      res.json({ message: 'Notification marked as read' });
    } catch (firebaseError) {
      // Demo mode update
      const notif = demoNotifications.find(n => n.id === id);
      if (notif) {
        notif.read = true;
        res.json({ message: 'Notification marked as read (demo)' });
      } else {
        res.status(404).json({ error: 'Notification not found' });
      }
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
