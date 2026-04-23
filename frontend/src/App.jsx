import React, { useState, useRef } from 'react';

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
      const base64Data = reader.result.split(',')[1];
      setPhoto(reader.result);
      setValidating(true);
      setReading(null);

      try {
        const response = await fetch(`${API_URL}/api/readings/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo: base64Data })
        });

        const data = await response.json();
        // FIX: If the AI is even 1% sure, show the number instead of an error
        if (data.reading_kwh) {
          setReading(data.reading_kwh);
        } else {
          alert("AI is struggling with the glare. Please try to angle the camera slightly to avoid the flash reflection.");
        }
      } catch (error) {
        alert("Connection error. Check Railway logs.");
      } finally {
        setValidating(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>15 Washington Dr Meter</h1>
      <div style={{ margin: '30px 0' }}>
        <button 
          onClick={() => fileInputRef.current.click()}
          style={{ padding: '20px', fontSize: '18px', backgroundColor: '#27ae60', color: 'white', borderRadius: '10px', border: 'none' }}
        >
          {isValidating ? "READING DRUMS..." : "📷 TAKE PHOTO"}
        </button>
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
      </div>
      {photo && <img src={photo} style={{ width: '100%', maxWidth: '400px', borderRadius: '10px' }} />}
      {reading && <div style={{ fontSize: '40px', fontWeight: 'bold', color: '#27ae60', marginTop: '20px' }}>{reading} kWh</div>}
    </div>
  );
}

export default App;
