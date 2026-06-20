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

  const normalise = (value) => String(value || '').toLowerCase().trim();

  const findGlobalValue = (label) => {
    const idx = lines.findIndex((line) => normalise(line) === normalise(label));
    return idx !== -1 && idx + 1 < lines.length ? lines[idx + 1] : '';
  };

  const getInlineValue = (line, label) => {
    const normalizedLine = String(line || '').replace(/\s+/g, ' ').trim();
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = normalizedLine.match(new RegExp(`^${escapedLabel}\\s+(.+)$`, 'i'));
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
    resultLabels.some((label) => normalise(label) === normalise(line));

  const startsWithResultLabel = (line, label) =>
    normalise(line).startsWith(normalise(label));

  const isResultNumber = (line) => /^\d+\.$/.test(line);

  const isCoordinates = (line) =>
    /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(line);

  const isViewportLine = (line) =>
    /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*:\s*\d+/.test(line);

  const getNextResultValue = (index) => {
    const nextLine = lines[index + 1];

    if (
      nextLine &&
      !isResultLabel(nextLine) &&
      !isResultNumber(nextLine)
    ) {
      return nextLine;
    }

    return '';
  };

  taskData.taskFormat = lines[0] || '';
  taskData.taskType = findGlobalValue('Task Type');
  taskData.requestId = findGlobalValue('Request ID');
  taskData.estimatedTime = findGlobalValue('Estimated Rating Time');
  taskData.query = findGlobalValue('Query');
  taskData.viewportAge = findGlobalValue('Viewport Age');
  taskData.locale = findGlobalValue('Locale');
  taskData.country = findGlobalValue('Country');
  taskData.userLatLng = findGlobalValue('User Lat, Lng');

  const latLngIndexes = lines
    .map((line, index) => (normalise(line) === normalise('Lat, Lng') ? index : -1))
    .filter((index) => index !== -1);

  const topLatLngIdx = latLngIndexes[0];

  if (topLatLngIdx !== undefined) {
    const nextLine = lines[topLatLngIdx + 1];

    if (isCoordinates(nextLine)) {
      taskData.mapCenterLatLng = nextLine;
    } else {
      const nearbyViewportLine = lines
        .slice(topLatLngIdx, topLatLngIdx + 8)
        .find(isViewportLine);

      if (nearbyViewportLine) {
        taskData.mapCenterLatLng = nearbyViewportLine.split(':')[0].trim();
      }
    }
  }

  let topAutocompleteAddress = '';

  if (normalise(taskData.taskType) === normalise('Autocomplete')) {
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
          normalise(taskData.taskType) === normalise('Autocomplete') &&
          line === '1.'
            ? topAutocompleteAddress
            : '',
        category: '',
        type: '',
        status: '',
        distanceToUser: '',
        distanceToViewport: '',
        pinLatLng: '',
      };

      continue;
    }

    if (!currentResult) continue;

    if (line.includes('•') && !currentResult.address) {
      const parts = line.split('•').map((part) => part.trim());
      currentResult.address = parts.slice(1).join(', ');
    }

    if (startsWithResultLabel(line, 'Address')) {
      const inlineAddress = getInlineValue(line, 'Address');

      if (inlineAddress) {
        currentResult.address = inlineAddress;
      } else {
        const addrLines = [];
        let j = i + 1;

        while (
          j < lines.length &&
          !isResultLabel(lines[j]) &&
          !isResultNumber(lines[j])
        ) {
          addrLines.push(lines[j]);
          j++;
        }

        currentResult.address = addrLines.join(', ');
      }
    }

    if (normalise(line) === normalise('Category')) {
      currentResult.category = getNextResultValue(i);
    }

    if (normalise(line) === normalise('Type')) {
      currentResult.type = getNextResultValue(i);
    }

    if (normalise(line) === normalise('Status')) {
      currentResult.status = getNextResultValue(i);
    }

    if (normalise(line) === normalise('Distance to User')) {
      currentResult.distanceToUser = getNextResultValue(i);
    }

    if (normalise(line) === normalise('Distance to Viewport')) {
      currentResult.distanceToViewport = getNextResultValue(i);
    }

    if (normalise(line) === normalise('Lat, Lng')) {
      currentResult.pinLatLng = getNextResultValue(i);
    }
  }

  if (currentResult) taskData.results.push(currentResult);

  return taskData;
};