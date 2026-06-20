import React, { useState } from 'react';

const ADDRESS_ISSUES_LIST = [
  'Street Number', 'Unit/Apt', 'Street Name', 'Sub-Locality',
  'Locality', 'Region/State', 'Postal Code', 'Country',
  'Address does not exist', 'Language/Script issue',
  'Country specific issue', 'Other Issue',
];

const IssueNote = ({ issue }) => {
  if (!issue) return null;

  return (
    <div style={{
      display: 'inline-block',
      backgroundColor: '#fff3cd',
      border: '1px solid #ffecb5',
      color: '#664d03',
      padding: '6px 8px',
      borderRadius: '6px',
      marginBottom: '5px',
      fontSize: '12px',
      lineHeight: 1.35,
    }}>
      <div><strong>Possible spelling issue</strong></div>
      {issue.severity && <div><strong>Severity:</strong> {issue.severity}</div>}
      <div><strong>Raw:</strong> {issue.originalWord || '-'}</div>
      <div><strong>Actual transliteration:</strong> {issue.actualTransliteration || '-'}</div>
      <div><strong>Suggested:</strong> {issue.suggestedWord || '-'}</div>
      {issue.reason && <div><strong>Reason:</strong> {issue.reason}</div>}
    </div>
  );
};

const FieldValue = ({ value, issue, children }) => (
  <td style={{ padding: '6px 0' }}>
    <IssueNote issue={issue} />
    <div>{children ?? value ?? '-'}</div>
  </td>
);

const ResultCard = ({ result, color, spellingIssues = {} }) => {
  const [formState, setFormState] = useState({
    relevance: '',
    userIntentIssue: false,
    distanceIssue: false,
    nameCatAccuracy: '',
    nameIssue: false,
    categoryIssue: false,
    addressAccuracy: '',
    addressIssues: {},
    pinAccuracy: '',
  });

  const handleSelectChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (field, isChecked) => {
    setFormState((prev) => ({ ...prev, [field]: isChecked }));
  };

  const handleAddressIssueToggle = (issue) => {
    setFormState((prev) => ({
      ...prev,
      addressIssues: {
        ...prev.addressIssues,
        [issue]: !prev.addressIssues[issue],
      },
    }));
  };

  return (
    <div style={{ border: '1px solid #ced4da', borderRadius: '6px', marginBottom: '25px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
      <div style={{ backgroundColor: color, color: 'white', padding: '10px 15px', fontWeight: 'bold', fontSize: '15px' }}>
        <IssueNote issue={spellingIssues.title} />
        <div>{result.number} {result.title}</div>
      </div>

      <div style={{ padding: '15px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', marginBottom: '15px' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '6px 0', width: '35%', color: '#555' }}>Address</th>
              <FieldValue value={result.address} issue={spellingIssues.address} />
            </tr>

            <tr style={{ borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '6px 0', color: '#555' }}>Category</th>
              <FieldValue issue={spellingIssues.category}>
                <span style={{ background: '#e8f0fe', padding: '2px 6px', borderRadius: '4px', color: '#1a73e8' }}>
                  {result.category || '-'}
                </span>
              </FieldValue>
            </tr>

            <tr style={{ borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '6px 0', color: '#555' }}>Type</th>
              <FieldValue value={result.type} issue={spellingIssues.type} />
            </tr>

            <tr style={{ borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '6px 0', color: '#555' }}>Status</th>
              <FieldValue value={result.status} issue={spellingIssues.status} />
            </tr>

            <tr style={{ borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '6px 0', color: '#555' }}>Distance to User</th>
              <td style={{ padding: '6px 0' }}>{result.distanceToUser || '-'}</td>
            </tr>

            <tr style={{ borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '6px 0', color: '#555' }}>Distance to Viewport</th>
              <td style={{ padding: '6px 0' }}>{result.distanceToViewport || '-'}</td>
            </tr>

            <tr style={{ borderBottom: '1px solid #eee' }}>
              <th style={{ padding: '6px 0', color: '#555' }}>Lat, Lng (Pin)</th>
              <td style={{ padding: '6px 0', fontFamily: 'monospace' }}>{result.pinLatLng || '-'}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontSize: '13px', color: '#495057', marginBottom: '15px' }}>
          <label style={{ display: 'block', margin: '4px 0', color: '#555' }}>
            <input type="checkbox" disabled style={{ marginRight: '8px' }} /> Result name/title is in unexpected language or script
          </label>
          <label style={{ display: 'block', margin: '4px 0', color: '#555' }}>
            <input type="checkbox" disabled style={{ marginRight: '8px' }} /> Business/POI is closed or does not exist
          </label>
        </div>

        <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '6px', border: '1px solid #e9ecef', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', color: '#555', marginBottom: '4px' }}>Relevance</label>
            <select value={formState.relevance} onChange={(e) => handleSelectChange('relevance', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: 'white' }}>
              <option value="">Select...</option>
              <option value="Navigational">Navigational</option>
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Acceptable">Acceptable</option>
              <option value="Bad">Bad</option>
            </select>

            <div style={{ marginTop: '8px', paddingLeft: '5px' }}>
              <label style={{ display: 'block', margin: '4px 0', cursor: 'pointer', color: '#555' }}>
                <input type="checkbox" checked={formState.userIntentIssue} onChange={(e) => handleCheckboxChange('userIntentIssue', e.target.checked)} style={{ marginRight: '8px' }} /> User intent issue
              </label>
              <label style={{ display: 'block', margin: '4px 0', cursor: 'pointer', color: '#555' }}>
                <input type="checkbox" checked={formState.distanceIssue} onChange={(e) => handleCheckboxChange('distanceIssue', e.target.checked)} style={{ marginRight: '8px' }} /> Distance/Prominence issue
              </label>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: '#555', marginBottom: '4px' }}>Name and Category Accuracy</label>
            <select value={formState.nameCatAccuracy} onChange={(e) => handleSelectChange('nameCatAccuracy', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: 'white' }}>
              <option value="">Select...</option>
              <option value="n/a">n/a</option>
              <option value="Correct">Correct</option>
              <option value="Partially Correct">Partially Correct</option>
              <option value="Incorrect">Incorrect</option>
              <option value="Can't Verify">Can't Verify</option>
            </select>

            {(formState.nameCatAccuracy === 'Partially Correct' || formState.nameCatAccuracy === 'Incorrect') && (
              <div style={{ marginTop: '8px', paddingLeft: '5px' }}>
                <label style={{ display: 'block', margin: '4px 0', cursor: 'pointer', color: '#555' }}>
                  <input type="checkbox" checked={formState.nameIssue} onChange={(e) => handleCheckboxChange('nameIssue', e.target.checked)} style={{ marginRight: '8px' }} /> Name Issue
                </label>
                <label style={{ display: 'block', margin: '4px 0', cursor: 'pointer', color: '#555' }}>
                  <input type="checkbox" checked={formState.categoryIssue} onChange={(e) => handleCheckboxChange('categoryIssue', e.target.checked)} style={{ marginRight: '8px' }} /> Category Issue
                </label>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', color: '#555', marginBottom: '4px' }}>Address Accuracy</label>
            <select value={formState.addressAccuracy} onChange={(e) => handleSelectChange('addressAccuracy', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: 'white' }}>
              <option value="">Select...</option>
              <option value="Correct">Correct</option>
              <option value="Correct with formatting issue">Correct with formatting issue</option>
              <option value="Incorrect">Incorrect</option>
              <option value="Can't Verify">Can't Verify</option>
            </select>

            {formState.addressAccuracy === 'Incorrect' && (
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#444' }}>Specify Address Issues:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {ADDRESS_ISSUES_LIST.map((issue) => (
                    <label key={issue} style={{ display: 'block', cursor: 'pointer', color: '#555' }}>
                      <input type="checkbox" checked={!!formState.addressIssues[issue]} onChange={() => handleAddressIssueToggle(issue)} style={{ marginRight: '6px' }} />
                      {issue}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', color: '#555', marginBottom: '4px' }}>Pin Accuracy</label>
            <select value={formState.pinAccuracy} onChange={(e) => handleSelectChange('pinAccuracy', e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: 'white' }}>
              <option value="">Select...</option>
              <option value="Perfect">Perfect</option>
              <option value="Approximate">Approximate</option>
              <option value="Next Door">Next Door</option>
              <option value="Wrong">Wrong</option>
              <option value="Can't Verify">Can't Verify</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultCard;