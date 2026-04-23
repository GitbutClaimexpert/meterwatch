const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onloadend = async () => {
    // This converts the image to the string format the AI needs
    const base64Data = reader.result.split(',')[1];
    setPhoto(reader.result);
    setValidating(true);

    try {
      const response = await fetch(`${API_URL}/api/readings/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // CRITICAL: The key must be "photo" to match the backend
        body: JSON.stringify({ photo: base64Data }) 
      });

      const data = await response.json();
      if (data.reading_kwh) {
        setReading(data.reading_kwh);
      } else {
        alert("The AI is still blinded by glare. Try a photo from a side angle.");
      }
    } catch (error) {
      alert("Connection failed. Is Railway ACTIVE?");
    } finally {
      setValidating(false);
    }
  };
  reader.readAsDataURL(file);
};
