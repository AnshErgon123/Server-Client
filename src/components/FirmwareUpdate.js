import React, { useState, useEffect } from 'react';
import axios from 'axios';

const FirmwareUpdate = () => {
  const [firmwares, setFirmwares] = useState([]);
  const [selectedFirmware, setSelectedFirmware] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [bridgeStatus, setBridgeStatus] = useState(null);
  const [flashingProgress, setFlashingProgress] = useState(null);

  const fetchFirmwares = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/firmwares');
      setFirmwares(response.data.firmwares);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching firmwares:', error);
      setMessage('Error loading firmware list');
      setLoading(false);
    }
  };

  const fetchBridgeStatus = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/bridge-status');
      setBridgeStatus(response.data);
    } catch (error) {
      console.error('Error fetching bridge status:', error);
    }
  };

  const fetchFlashingProgress = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/flashing-progress');
      if (response.data.progress) {
        setFlashingProgress(response.data.progress);
        
        // Clear progress after 5 seconds if completed
        if (response.data.progress.status === 'completed') {
          setTimeout(() => {
            setFlashingProgress(null);
          }, 5000);
        }
      }
    } catch (error) {
      console.error('Error fetching flashing progress:', error);
    }
  };

  const handleUpdate = async () => {
    if (!selectedFirmware) {
      setMessage('Please select a firmware file');
      return;
    }

    setUpdating(true);
    setMessage('');
    setFlashingProgress(null); // Clear previous progress

    try {
      const response = await axios.post('http://localhost:5000/api/update-firmware', {
        firmware_file: selectedFirmware
      });
      
      setMessage('Firmware update initiated successfully!');
      setSelectedFirmware('');
      
    } catch (error) {
      console.error('Error updating firmware:', error);
      setMessage('Error initiating firmware update');
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    fetchFirmwares();
    fetchBridgeStatus();
    fetchFlashingProgress();
    // Poll for bridge status updates every 2 seconds
    const statusInterval = setInterval(fetchBridgeStatus, 2000);
    // Poll for flashing progress updates every 1 second when updating
    const progressInterval = setInterval(fetchFlashingProgress, 1000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(progressInterval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Firmware Update</h2>
        
        <div className="space-y-6">
          <div>
            <label htmlFor="firmware-select" className="block text-sm font-medium text-gray-700 mb-2">
              Select Firmware Package
            </label>
            <select
              id="firmware-select"
              value={selectedFirmware}
              onChange={(e) => setSelectedFirmware(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Choose a firmware package...</option>
              {firmwares.map((firmware, index) => (
                <option key={index} value={firmware}>
                  {firmware}
                </option>
              ))}
            </select>
          </div>

          {firmwares.length === 0 && (
            <div className="text-center py-4">
              <p className="text-gray-500">No firmware packages found in the firmwares directory.</p>
            </div>
          )}

          {message && (
            <div className={`p-4 rounded-md ${
              message.includes('Error') 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message}
            </div>
          )}

          {flashingProgress && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-blue-800">
                  {flashingProgress.status === 'completed' ? '✅ Flashing Complete' : '🔄 Flashing in Progress'}
                </h3>
                <span className="text-sm font-medium text-blue-800">
                  {flashingProgress.percentage}%
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${flashingProgress.percentage}%` }}
                ></div>
              </div>
              <div className="text-xs text-blue-600">
                Frame {flashingProgress.frames} of {flashingProgress.total_frames}
              </div>
            </div>
          )}

          <div className="flex space-x-4">
            <button
              onClick={handleUpdate}
              disabled={!selectedFirmware || updating}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                !selectedFirmware || updating
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {updating ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating...
                </span>
              ) : (
                'Update Firmware'
              )}
            </button>
            
            <button
              onClick={fetchFirmwares}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Refresh List
            </button>
          </div>
        </div>

        {firmwares.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Available Firmware Packages:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              {firmwares.map((firmware, index) => (
                <li key={index} className="font-mono">{firmware}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default FirmwareUpdate; 