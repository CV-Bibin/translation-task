export const parseRawTaskText = (text) => {
  if (!text) return null;

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  const taskData = {
    taskFormat: '',
    taskType: '',
    requestId: '',
    estimatedTime: '',
    mapCenterLatLng: '',
    query: '',
    viewportAge: '',
    locale: '',
    country: '',
    userLatLng: '',
    results: [],
  };

  const normalize = (value) => String(value || '').toLowerCase().trim();

  const findGlobalValue = (label) => {
    const idx = lines.findIndex((line) => normalize(line) === normalize(label));
    return idx !== -1 && idx + 1 < lines.length ? lines[idx + 1] : '';
  };

  const getInlineValue = (line, label) => {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const match = String(line || '').match(
      new RegExp(`^${escapedLabel}(?:\\t|\\s*:\\s*|\\s{2,})(.+)$`, 'i')
    );

    return match ? match[1].trim() : '';
  };

  const resultLabels = [
    'Address',
    'Category',
    'Type',
    'Status',
    'Distance to User',
    'Distance to Viewport',
    'Lat, Lng',
    'Result name/title is in unexpected language or script',
    'Business/POI is closed or does not exist',
    'Relevance',
    'Name Accuracy',
    'Name and Category Accuracy',
    'Address Accuracy',
    'Pin Accuracy',
    'Comment and Link',
    'Submit Ratings',
    'Ratings',
  ];

  const isResultLabel = (line) =>
    resultLabels.some((label) => normalize(label) === normalize(line));

  const isResultNumber = (line) => /^\d+\.$/.test(line);

  const isCoordinates = (line) =>
    /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(line);

  const isViewportLine = (line) =>
    /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*:\s*\d+/.test(line);

  taskData.taskFormat = lines[0] || '';
  taskData.taskType = findGlobalValue('Task Type');
  taskData.requestId = findGlobalValue('Request ID');
  taskData.estimatedTime = findGlobalValue('Estimated Rating Time');
  taskData.query = findGlobalValue('Query');
  taskData.viewportAge = findGlobalValue('Viewport Age');
  taskData.locale = findGlobalValue('Locale');
  taskData.country = findGlobalValue('Country');
  taskData.userLatLng = findGlobalValue('User Lat, Lng');

  const topLatLngIdx = lines.findIndex((line) => normalize(line) === 'lat, lng');

  if (topLatLngIdx !== -1) {
    const nextLine = lines[topLatLngIdx + 1];

    if (isCoordinates(nextLine)) {
      taskData.mapCenterLatLng = nextLine;
    } else {
      const viewportLine = lines
        .slice(topLatLngIdx, topLatLngIdx + 8)
        .find(isViewportLine);

      if (viewportLine) {
        taskData.mapCenterLatLng = viewportLine.split(':')[0].trim();
      }
    }
  }

  const getNextResultValue = (index) => {
    const nextLine = lines[index + 1];

    if (
      nextLine &&
      !isResultLabel(nextLine) &&
      !isResultNumber(nextLine) &&
      nextLine !== 'Result name/title is in unexpected language or script'
    ) {
      return nextLine;
    }

    return '';
  };

  // =========================================================================
  // BRANCH 1: AUTOCOMPLETE TASKS (Handles new label-less multiline addresses)
  // =========================================================================
  if (normalize(taskData.taskType) === 'autocomplete') {
    let currentResult = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (isResultNumber(line)) {
        if (currentResult) taskData.results.push(currentResult);

        currentResult = {
          number: line,
          title: '',
          address: '',
          category: '',
          type: '',
          status: '',
          distanceToUser: '',
          distanceToViewport: '',
          pinLatLng: '',
        };

        // Extract Title and dynamic multiline Address
        if (
          i + 1 < lines.length &&
          !isResultLabel(lines[i + 1]) &&
          !isResultNumber(lines[i + 1])
        ) {
          currentResult.title = lines[i + 1];
          i++; // Move past title

          const addressParts = [];
          while (
            i + 1 < lines.length &&
            !isResultLabel(lines[i + 1]) &&
            !isResultNumber(lines[i + 1]) &&
            lines[i + 1] !== 'Result name/title is in unexpected language or script'
          ) {
            addressParts.push(lines[i + 1]);
            i++; // Consume address line
          }

          if (addressParts.length > 0) {
            currentResult.address = addressParts.join(', ');
          }
        }
      } else if (currentResult) {
        const nLine = normalize(line);

        // Allow explicit override if old formatting WITH an 'Address' label appears
        const inlineAddress = getInlineValue(line, 'Address');
        if (nLine === 'address' || inlineAddress) {
          if (inlineAddress) {
            currentResult.address = inlineAddress;
          } else {
            let addrLines = [];
            let j = i + 1;
            while (
              j < lines.length &&
              !isResultLabel(lines[j]) &&
              !isResultNumber(lines[j]) &&
              lines[j] !== 'Result name/title is in unexpected language or script'
            ) {
              addrLines.push(lines[j]);
              j++;
            }
            currentResult.address = addrLines.join(', ');
          }
        }

        // Check for normal explicit labels
        if (nLine === 'category') currentResult.category = getNextResultValue(i);
        if (nLine === 'type') currentResult.type = getNextResultValue(i);
        if (nLine === 'status') currentResult.status = getNextResultValue(i);
        if (nLine === 'distance to user') currentResult.distanceToUser = getNextResultValue(i);
        if (nLine === 'distance to viewport') currentResult.distanceToViewport = getNextResultValue(i);
        if (nLine === 'lat, lng') currentResult.pinLatLng = getNextResultValue(i);
      }
    }

    if (currentResult) taskData.results.push(currentResult);
    return taskData;
  }


  // =========================================================================
  // BRANCH 2: ALL OTHER TASKS (Your exact original logic)
  // =========================================================================
  let topAutocompleteAddress = '';

  if (normalize(taskData.taskType) === 'autocomplete') {
    for (const line of lines) {
      const inlineAddress = getInlineValue(line, 'Address');

      if (inlineAddress) {
        topAutocompleteAddress = inlineAddress;
        break;
      }
    }
  }

  let currentResult = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isResultNumber(line)) {
      if (currentResult) taskData.results.push(currentResult);

      currentResult = {
        number: line,
        title: lines[i + 1] || 'Unknown',
        address:
          normalize(taskData.taskType) === 'autocomplete' && line === '1.'
            ? topAutocompleteAddress
            : '',
        category: '',
        type: '',
        status: '',
        distanceToUser: '',
        distanceToViewport: '',
        pinLatLng: '',
      };

      const possibleSubtitle = lines[i + 2];

      if (
        possibleSubtitle &&
        possibleSubtitle.includes('•') &&
        !currentResult.address
      ) {
        const parts = possibleSubtitle.split('•').map((part) => part.trim());
        currentResult.address = parts.slice(1).join(', ');
      }

      continue;
    }

    if (!currentResult) continue;

    if (line.includes('•') && !currentResult.address) {
      const parts = line.split('•').map((part) => part.trim());
      currentResult.address = parts.slice(1).join(', ');
    }

    const inlineAddress = getInlineValue(line, 'Address');

    if (normalize(line) === 'address' || inlineAddress) {
      if (inlineAddress) {
        currentResult.address = inlineAddress;
      } else {
        let addrLines = [];
        let j = i + 1;

        while (
          j < lines.length &&
          !isResultLabel(lines[j]) &&
          !isResultNumber(lines[j]) &&
          lines[j] !== 'Result name/title is in unexpected language or script'
        ) {
          addrLines.push(lines[j]);
          j++;
        }

        currentResult.address = addrLines.join(', ');
      }
    }

    if (normalize(line) === 'category') {
      currentResult.category = getNextResultValue(i);
    }

    if (normalize(line) === 'type') {
      currentResult.type = getNextResultValue(i);
    }

    if (normalize(line) === 'status') {
      currentResult.status = getNextResultValue(i);
    }

    if (normalize(line) === 'distance to user') {
      currentResult.distanceToUser = getNextResultValue(i);
    }

    if (normalize(line) === 'distance to viewport') {
      currentResult.distanceToViewport = getNextResultValue(i);
    }

    if (normalize(line) === 'lat, lng') {
      currentResult.pinLatLng = getNextResultValue(i);
    }
  }

  if (currentResult) taskData.results.push(currentResult);

  return taskData;
};
