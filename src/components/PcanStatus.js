import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PcanStatus = () => {
  const [pcanStatus, setPcanStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkPcanStatus = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/pcan-status');
      setPcanStatus(response.data.connected);
      setLoading(false);
    } catch (error) {
      console.error('Error checking PCAN status:', error);
      setPcanStatus(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    checkPcanStatus();
    // Poll for status updates every 2 seconds
    const interval = setInterval(checkPcanStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
        <span className="text-sm">Checking...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <div className={`w-2 h-2 rounded-full ${pcanStatus ? 'bg-green-400' : 'bg-red-400'}`}></div>
      <span className="text-sm font-medium">
        PeakCAN: {pcanStatus ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );
};

export default PcanStatus; 