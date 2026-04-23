import React, { useState, useRef } from 'react';

// This MUST match your Railway URL
const API_URL = "https://meterwatch-production.up.railway.app";

function App() {
  const [photo, setPhoto] = useState(null);
  const [reading, setReading] = useState(null);
  const [isValidating, setValidating] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result.split(',')[1]; // Get only the data part
      setPhoto(reader.result);
      setValidating(true);
      setReading(null);

      try {
        console.log("Sending photo to Railway...");
        const response = await fetch(`${API_URL}/api/readings/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo: base64Data }) // The 'photo' key matches your backend
        });

        const data = await response.json();
        if (data.reading_kwh) {
          setReading(data.reading_kwh);
        } else {
          alert("AI could not read the digits. Please try a closer, clearer photo.");
        }
      } catch (error) {
        console.error("Connection error:", error);
        alert("Could not connect to the server. Check if Railway is ACTIVE.");
      } finally {
        setValidating(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif', color: '#333' }}>
      <h1 style={{ color: '#2c3e50' }}>MeterWatch</h1>
      <p>Scan your 15 Washington Dr meter</p>
      
      <div style={{ margin: '30px 0' }}>
        <button 
          onClick={() => fileInputRef.current.click()}
          style={{ 
            padding: '20px 40px', 
            fontSize: '20px', 
            backgroundColor: isValidating ? '#95a5a6' : '#27ae60', 
            color: 'white', 
            border: 'none', 
            borderRadius: '50px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            cursor: 'pointer'
          }}
          disabled={isValidating}
        >
          {isValidating ? "⌛ ANALYZING..." : "📷 TAKE PHOTO"}
        </button>
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          style={{ display: 'none' }} 
        />
      </div>

      {photo && (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img src={photo} alt="Meter Preview" style={{ width: '100%', maxWidth: '350px', borderRadius: '15px', border: '3px solid #ddd' }} />
          {isValidating && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(255,255,255,0.8)', padding: '10px', borderRadius: '5px' }}>Reading Drums...</div>}
        </div>
      )}
      
      {reading && (
        <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#ebfdf2', borderRadius: '15px', border: '2px solid #27ae60' }}>
          <h2 style={{ margin: 0 }}>Current Reading:</h2>
          <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#27ae60' }}>{reading} <span style={{ fontSize: '20px' }}>kWh</span></div>
        </div>
      )}
    </div>
  );
}

export default App;
