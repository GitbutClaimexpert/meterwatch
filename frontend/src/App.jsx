import React, { useState, useRef } from 'react';

const API_URL = "https://meterwatch-production.up.railway.app";

function App() {
  const [photo, setPhoto] = useState(null);
  const [reading, setReading] = useState(null);
  const [isValidating, setValidating] = useState(false);
  const fileInputRef = useRef(null);

  // This function takes the photo and sends it to your Railway backend
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
          body: JSON.stringify({ photo: base64Data }) // Matches your backend req.body.photo
        });

        const data = await response.json();
        if (data.reading_kwh) {
          setReading(data.reading_kwh);
        } else {
          alert("AI couldn't read the digits. Try a clearer photo.");
        }
      } catch (error) {
        console.error("Upload failed:", error);
        alert("Server connection failed. Check Railway logs.");
      } finally {
        setValidating(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>MeterWatch</h1>
      
      <div style={{ margin: '20px 0' }}>
        <button 
          onClick={() => fileInputRef.current.click()}
          style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '8px' }}
        >
          {isValidating ? "Validating..." : "📷 Take Meter Photo"}
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

      {photo && <img src={photo} alt="Meter" style={{ width: '100%', maxWidth: '300px', borderRadius: '10px' }} />}
      
      {reading && (
        <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f1f1f1', borderRadius: '10px' }}>
          <h2>Reading: <span style={{ color: '#27ae60' }}>{reading} kWh</span></h2>
        </div>
      )}
    </div>
  );
}

export default App;
