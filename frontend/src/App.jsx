import React, { useState, useEffect } from 'react';

const API_URL = "https://meterwatch-production.up.railway.app";

function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [location, setLocation] = useState({ lat: null, lng: null });

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => console.log("GPS Denied")
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
        // Canvas compression to keep file size small
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

        setLoading(true);
        setResult(null);

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
          alert("Server error. Check Railway logs.");
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
      
      <div style={{ marginBottom: '30px' }}>
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          onChange={handleCapture} 
          id="cam-input" 
          style={{ display: 'none' }} 
        />
        <label htmlFor="cam-input" style={{ 
          padding: '20px 40px', backgroundColor: '#3498db', color: 'white', 
          borderRadius: '12px', cursor: 'pointer', display: 'inline-block', fontSize: '18px'
        }}>
          {loading ? "⌛ ANALYZING..." : "📷 TAKE PHOTO"}
        </label>
      </div>

      {result && (
        <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '12px', textAlign: 'left', border: '1px solid #ddd' }}>
          <h2 style={{ color: result.confidence === 'high' ? '#27ae60' : '#e67e22', marginTop: 0 }}>
            Reading: {result.reading_kwh}
          </h2>
          <p><strong>Confidence:</strong> {result.confidence}</p>
          <p><strong>Notes:</strong> {result.notes}</p>
          <p style={{ fontSize: '10px', color: '#999' }}>Time: {new Date(result.timestamp).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

export default App;
