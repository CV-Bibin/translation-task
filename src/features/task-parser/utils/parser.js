export const parseRawTaskText = (text) => {
  if (!text) return null;

  const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');
  
  let taskData = {
    taskType: '', requestId: '', estimatedTime: '', mapCenterLatLng: '',
    query: '', viewportAge: '', locale: '', country: '', userLatLng: '',
    results: []
  };

  const findGlobalValue = (label) => {
    const idx = lines.findIndex(l => l.toLowerCase() === label.toLowerCase());
    return idx !== -1 && idx + 1 < lines.length ? lines[idx + 1] : '';
  };

  taskData.taskType = findGlobalValue('Task Type');
  taskData.requestId = findGlobalValue('Request ID');
  taskData.estimatedTime = findGlobalValue('Estimated Rating Time'); // Fixed label
  taskData.query = findGlobalValue('Query');
  taskData.viewportAge = findGlobalValue('Viewport Age');
  taskData.locale = findGlobalValue('Locale');
  taskData.country = findGlobalValue('Country');
  taskData.userLatLng = findGlobalValue('User Lat, Lng');

  // Grab the initial viewport Lat/Lng at the top
  const topLatLngIdx = lines.findIndex(l => l === 'Lat, Lng');
  if (topLatLngIdx !== -1 && topLatLngIdx < 15) {
    taskData.mapCenterLatLng = lines[topLatLngIdx + 1];
  }

  let currentResult = null;
  
  // CRITICAL FIX: Added 'Address' to this list so the parser knows it is a stopping point
  const resultLabels = ['Category', 'Type', 'Status', 'Distance to User', 'Distance to Viewport', 'Lat, Lng', 'Address'];

  // Helper to safely get the value under a label, ignoring if it's blank
  const getNextResultValue = (index) => {
    const nextLine = lines[index + 1];
    if (nextLine && !resultLabels.includes(nextLine) && !/^\d+\.$/.test(nextLine) && nextLine !== 'Result name/title is in unexpected language or script') {
      return nextLine;
    }
    return '';
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for numbers followed by a dot (e.g., "1.", "2.")
    if (/^\d+\.$/.test(line)) {
      if (currentResult) taskData.results.push(currentResult);
      currentResult = { 
        number: line, 
        title: lines[i + 1] || 'Unknown', 
        address: '', category: '', type: '', status: '', 
        distanceToUser: '', distanceToViewport: '', pinLatLng: '' 
      };

      // --- AUTOCOMPLETE (SM) PATCH ---
      // Autocomplete tasks don't use the label "Address", they use a subtitle immediately after the title.
      // We peek at the line right after the title (i + 2).
      const possibleSubtitle = lines[i + 2];
      
      if (
        possibleSubtitle && 
        !resultLabels.includes(possibleSubtitle) && 
        !/^\d+\.$/.test(possibleSubtitle) && 
        possibleSubtitle !== 'Result name/title is in unexpected language or script'
      ) {
        // Pre-fill the address with the subtitle
        currentResult.address = possibleSubtitle; 
      }

    } else if (currentResult) {
      if (line === 'Category') currentResult.category = getNextResultValue(i);
      if (line === 'Type') currentResult.type = getNextResultValue(i);
      if (line === 'Status') currentResult.status = getNextResultValue(i);
      if (line === 'Distance to User') currentResult.distanceToUser = getNextResultValue(i);
      if (line === 'Distance to Viewport') currentResult.distanceToViewport = getNextResultValue(i);
      if (line === 'Lat, Lng') currentResult.pinLatLng = getNextResultValue(i);

      // --- STANDARD TASK OVERRIDE ---
      // If the task IS a standard search task and explicitly has an "Address" label, 
      // this block will safely overwrite the autocomplete subtitle from above.
      if (line === 'Address') {
        let addrLines = [];
        let j = i + 1;
        while (j < lines.length && !resultLabels.includes(lines[j]) && !/^\d+\.$/.test(lines[j]) && lines[j] !== 'Result name/title is in unexpected language or script') {
          addrLines.push(lines[j]);
          j++;
        }
        currentResult.address = addrLines.join(', ');
      }
    }
  }
  
  if (currentResult) taskData.results.push(currentResult);

  return taskData;
};