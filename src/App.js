import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import Metadata from './components/Metadata';
import FirmwareUpdate from './components/FirmwareUpdate';
import PcanStatus from './components/PcanStatus';

function App() {
  return (
    <Router>
      <div className="App">
        <nav className="bg-gray-800 text-white p-4">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold">Ergon Bridge Control</h1>
            <div className="flex items-center space-x-6">
              <div className="space-x-4">
                <Link to="/" className="hover:text-gray-300">Home</Link>
                <Link to="/firmware" className="hover:text-gray-300">Firmware Update</Link>
              </div>
              <PcanStatus />
            </div>
          </div>
        </nav>
        
        <main className="container mx-auto p-4">
          <Routes>
            <Route path="/" element={<Metadata />} />
            <Route path="/firmware" element={<FirmwareUpdate />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
