import React, { useState, useRef } from 'react';

const API_URL = "https://meterwatch-production.up.railway.app";

function App() {
  const [photo, setPhoto] = useState(null);
  const [reading, setReading] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result.split(',')[1];
      setPhoto(reader.result);
      setLoading(true);
      setReading(null);

      try {
        const res = await fetch(`${API_URL}/api/readings/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo: base64 })
        });

        if (!res.ok) throw new Error("Server responded with error");
        
        const data = await res.json();
        if (data.reading_kwh) setReading(data.reading_kwh);
        else alert("AI couldn't see digits. Try moving further from the screen.");
      } catch (err) {
        alert("Connection Error. Check Railway Logs for 'Payload Too Large'.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>15 Washington Dr Meter</h1>
      <button 
        onClick={() => fileInputRef.current.click()}
        style={{ padding: '20px', margin: '20px', fontSize: '18px', backgroundColor: '#27ae60', color: 'white', borderRadius: '10px', border: 'none' }}
      >
        {loading ? "PROCESSSING..." : "📷 SCAN METER"}
      </button>
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} style={{ display: 'none' }} />
      {photo && <img src={photo} style={{ width: '100%', maxWidth: '350px', borderRadius: '10px' }} />}
      {reading && <h2 style={{ color: '#27ae60', marginTop: '20px' }}>Reading: {reading}</h2>}
    </div>
  );
}

export default App;
