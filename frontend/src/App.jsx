import React, { useState, useEffect } from 'react';

const API_URL = "https://meterwatch-production.up.railway.app";

function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [location, setLocation] = useState({ lat: null, lng: null });

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => console.log("GPS access denied")
    );
  }, []);

  const handleCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = async () => {
        // --- COMPRESSION LOGIC ---
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_WIDTH) {
            width *= MAX_WIDTH / height;
            height = MAX_WIDTH;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to a smaller JPEG
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        // -------------------------

        setLoading(true);
        try {
          const res = await fetch(`${API_URL}/api/readings/capture`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              photo: compressedBase64, 
              lat: location.lat, 
              lng: location.lng 
            })
          });
          const data = await res.json();
          setResult(data);
        } catch (err) {
          alert("Size error still present. Check backend limits.");
        } finally {
          setLoading(false);
        }
      };
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ color: '#2c3e50' }}>15 Washington Dr</h1>
      <p style={{ fontSize: '12px', color: '#95a5a6' }}>
        GPS: {location.lat ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Searching..."}
      </p>

      <div style={{ margin: '20px 0' }}>
        <input type="file" accept="image/*" capture="environment" onChange={handleCapture} id="camera" style={{ display: 'none' }} />
        <label htmlFor="camera" style={{ padding: '20px 40px', backgroundColor: '#3498db', color: 'white', borderRadius: '10px', cursor: 'pointer', display: 'inline-block' }}>
          {loading ? "SHRINKING & ANALYZING..." : "📷 SCAN & RECORD"}
        </label>
      </div>

      {result && (
        <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '10px', textAlign: 'left' }}>
          <h2 style={{ color: result.confidence === 'high' ? '#27ae60' : '#e67e22' }}>
            Reading: {result.reading_kwh} kWh
          </h2>
          <p><strong>Confidence:</strong> {result.confidence.toUpperCase()}</p>
          <p><strong>AI Notes:</strong> {result.notes}</p>
        </div>
      )}
    </div>
  );
}

export default App;
