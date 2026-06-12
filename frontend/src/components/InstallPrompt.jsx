import React, { useState, useEffect } from 'react';
import { Snackbar, Button, IconButton, Typography, Box } from '@mui/material';
import { Close, GetApp } from '@mui/icons-material';

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if already dismissed in this session
      const dismissed = sessionStorage.getItem('installPromptDismissed');
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleClose = () => {
    setShowPrompt(false);
    sessionStorage.setItem('installPromptDismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <Snackbar
      open={showPrompt}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ bottom: { xs: 90, sm: 24 } }}
    >
      <Box sx={{ 
        bgcolor: 'primary.main', 
        color: 'white', 
        p: 2, 
        borderRadius: 2, 
        boxShadow: 3, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        maxWidth: 400
      }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            Install Smart Attendance App
          </Typography>
          <Typography variant="caption">
            Add to home screen for a faster, native app experience!
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          size="small" 
          color="secondary"
          startIcon={<GetApp />}
          onClick={handleInstallClick}
          sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 'bold' }}
        >
          Install
        </Button>
        <IconButton size="small" color="inherit" onClick={handleClose}>
          <Close fontSize="small" />
        </IconButton>
      </Box>
    </Snackbar>
  );
};

export default InstallPrompt;
