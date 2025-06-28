import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Metadata = () => {
  const [metadata, setMetadata] = useState(null);
  const [status, setStatus] = useState("Idle");
  const [loading, setLoading] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState(null);

  const initiateHandshake = async () => {
    try {
      setLoading(true);
      setStatus("🔄 Initiating handshake...");
      const response = await axios.post("http://localhost:5000/api/initiate-handshake");
      setStatus(response.data.message || "Handshake started.");
    } catch (error) {
      console.error("Handshake initiation failed:", error);
      setStatus("❌ Failed to initiate handshake.");
    } finally {
      setLoading(false);
    }
  };

  const clearMetadata = async () => {
    try {
      await axios.post("http://localhost:5000/api/clear-metadata");
      setMetadata(null);
      setStatus("Metadata cleared.");
    } catch (error) {
      console.error("Failed to clear metadata:", error);
      setStatus("❌ Failed to clear metadata.");
    }
  };

  const togglePing = async () => {
    try {
      const newPingState = !bridgeStatus?.ping_active;
      await axios.post("http://localhost:5000/api/ping-control", { active: newPingState });
      setStatus(newPingState ? "Ping messages activated" : "Ping messages deactivated");
    } catch (error) {
      console.error("Failed to toggle ping:", error);
      setStatus("❌ Failed to toggle ping messages.");
    }
  };

  const fetchMetadata = async () => {
    try {
      setFetchingMetadata(true);
      const response = await axios.get('http://localhost:5000/api/metadata');
      if (response.data && response.data.metadata) {
        setMetadata(response.data.metadata);
      }
    } catch (error) {
      console.error('Error fetching metadata:', error);
    } finally {
      setFetchingMetadata(false);
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

  useEffect(() => {
    fetchBridgeStatus();
    fetchMetadata();
    const metadataInterval = setInterval(fetchMetadata, 3000);
    const statusInterval = setInterval(fetchBridgeStatus, 2000);
    return () => {
      clearInterval(metadataInterval);
      clearInterval(statusInterval);
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto mt-10">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Unit Metadata</h2>
          <div className="flex space-x-3">
            {metadata && metadata.length > 0 && (
              <button
                onClick={clearMetadata}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-all"
              >
                Clear Metadata
              </button>
            )}
            {bridgeStatus && bridgeStatus.command !== "idle" && (
              <button
                onClick={togglePing}
                className={`${
                  bridgeStatus.ping_active 
                    ? 'bg-yellow-600 hover:bg-yellow-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white font-semibold py-2 px-4 rounded-lg transition-all`}
              >
                {bridgeStatus.ping_active ? 'Stop Ping' : 'Start Ping'}
              </button>
            )}
            <button
              onClick={initiateHandshake}
              disabled={loading || (bridgeStatus && bridgeStatus.command !== "idle")}
              className={`${
                loading || (bridgeStatus && bridgeStatus.command !== "idle") 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700'
              } text-white font-semibold py-2 px-4 rounded-lg transition-all`}
            >
              {loading ? 'Connecting...' : 
               bridgeStatus && bridgeStatus.command !== "idle" ? 'Handshake in Progress' : 'Connect'}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-gray-600">{status}</p>
          {bridgeStatus && (
            <p className="text-sm text-gray-500 mt-1">
              Bridge Status: {bridgeStatus.command} 
              {bridgeStatus.unit_id && ` | Unit ID: ${bridgeStatus.unit_id}`}
              {bridgeStatus.pcan_connected && ' | PCAN Connected'}
              {bridgeStatus.ping_active && ' | 📡 Ping Active'}
            </p>
          )}
        </div>

        {!metadata || metadata.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 text-lg mb-4">
              {fetchingMetadata ? "Looking for metadata..." : 
               bridgeStatus && bridgeStatus.command === "idle" ? "Click 'Connect' to start handshake" :
               "No metadata available yet."}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tag
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Raw Bytes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {metadata.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      0x{item.tag.toString(16).toUpperCase().padStart(2, '0')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.tag_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.value}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {item.raw_bytes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Metadata;
