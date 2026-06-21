import React, { useState } from 'react';
import { parseRawTaskText } from '../features/task-parser/utils/parser';
import ResultCard from '../features/task-parser/components/ResultCard';
import MapComponent from '../features/map-view/MapComponent';
import { translateTaskFields } from '../features/translator/services/deeplService';
import { smartLocalizeTaskFields } from '../features/localizer/services/geminiLocalizeService';

import { db } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const THEME_COLORS = ['#6f42c1', '#007bff', '#28a745', '#dc3545', '#ffc107'];
const APP_THEME = {
  pageBg: '#eef1f5',
  topBar: '#111827',
  topBarAccent: '#2563eb',
  panelBg: '#ffffff',
  panelBorder: '#d8dee9',
  primary: '#174a7c',
  primaryHover: '#123a61',
  purple: '#6f42c1',
  teal: '#0f766e',
  danger: '#e94560',
  textMain: '#111827',
  textMuted: '#5b6472',
};

const SUPPORTED_LANGUAGES = [
  { code: 'EN-US', name: 'English' },
  { code: 'ML', name: 'Malayalam' },
  { code: 'TA', name: 'Tamil' },
  { code: 'HI', name: 'Hindi' },
  { code: 'ES', name: 'Spanish' },
];

const LANGUAGE_NAMES = {
  EN: 'English',
  'EN-US': 'English',
  ML: 'Malayalam',
  TA: 'Tamil',
  HI: 'Hindi',
  ES: 'Spanish',
  MIXED: 'Mixed',
  UNKNOWN: 'Unknown',
  AUTO: 'Auto Detect',
};

const getLanguageLabel = (code) => {
  if (!code) return '';
  const normalizedCode = String(code).toUpperCase();
  const languageName = LANGUAGE_NAMES[normalizedCode];
  return languageName ? `${languageName} (${normalizedCode})` : normalizedCode;
};

const Dashboard = () => {
  const [rawData, setRawData] = useState('');

  const [originalTask, setOriginalTask] = useState(null);
  const [translatedTask, setTranslatedTask] = useState(null);
  const [smartLocalizedTask, setSmartLocalizedTask] = useState(null);
  // viewMode can now be: 'original', 'translated', 'smartLocalized', 'compare', 'tips'
  const [viewMode, setViewMode] = useState('original');

  const [isTranslating, setIsTranslating] = useState(false);
  const [isSmartLocalizing, setIsSmartLocalizing] = useState(false);
  const [isGettingTips, setIsGettingTips] = useState(false); // New state for tips loading
  const [tipsData, setTipsData] = useState(''); // New state to store generated tips
  const [manualViewportLatLng, setManualViewportLatLng] = useState(null);
  const [realMapData, setRealMapData] = useState([]);

  const [detectedLang, setDetectedLang] = useState('');
  const [transError, setTransError] = useState('');
  const [targetLang, setTargetLang] = useState('EN-US');
  const [spellingIssues, setSpellingIssues] = useState([]);
  const [fieldNotes, setFieldNotes] = useState([]);
  const [fieldLanguages, setFieldLanguages] = useState([]);

  const [isCached, setIsCached] = useState(false);
  const [isCheckingDB, setIsCheckingDB] = useState(false);

  const [showDbModal, setShowDbModal] = useState(false);
  const [pendingDbData, setPendingDbData] = useState(null);
  const [pendingExtractedData, setPendingExtractedData] = useState(null);
  const [transliteratedTexts, setTransliteratedTexts] = useState([]);

  const clearAiMeta = () => {
    setSpellingIssues([]);
    setFieldNotes([]);
    setFieldLanguages([]);
    setTransliteratedTexts([]);
    setTipsData('');
  };

  const resetTaskState = () => {
    setOriginalTask(null);
    setTranslatedTask(null);
    setSmartLocalizedTask(null);
    clearAiMeta();
    setRawData('');
    setIsCached(false);
    setDetectedLang('');
    setTransError('');
    setViewMode('original');
  };

  const handleProcessTask = async () => {
    if (!rawData.trim()) return;

    setIsCheckingDB(true);
    setTransError('');

    try {
      const extractedData = parseRawTaskText(rawData);

      if (extractedData.requestId && extractedData.requestId !== 'N/A') {
        const docRef = doc(db, 'tasks', extractedData.requestId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setPendingDbData(docSnap.data());
          setPendingExtractedData(extractedData);
          setShowDbModal(true);
          setIsCheckingDB(false);
          return;
        }
      }

      setOriginalTask(extractedData);
      setTranslatedTask(null);
      setSmartLocalizedTask(null);
      clearAiMeta();
      setViewMode('original');
      setIsCached(false);
      setDetectedLang('');
    } catch (err) {
      console.error(err);
      setTransError('Failed to parse task data.');
    } finally {
      setIsCheckingDB(false);
    }
  };

  const handleAcceptDb = () => {
    if (!pendingDbData) return;

    if (pendingDbData.translatedData || pendingDbData.smartLocalizedData) {
      setOriginalTask(pendingDbData.originalData || pendingDbData);
      setTranslatedTask(pendingDbData.translatedData || null);
      setSmartLocalizedTask(pendingDbData.smartLocalizedData || null);
      setSpellingIssues(pendingDbData.spellingIssues || []);
      setFieldNotes(pendingDbData.fieldNotes || []);
      setFieldLanguages(pendingDbData.fieldLanguages || []);
      setDetectedLang(pendingDbData.detectedLang || '');
      setTransliteratedTexts(pendingDbData.transliteratedTexts || []);
      setTipsData(pendingDbData.tipsData || '');

      if (pendingDbData.smartLocalizedData) {
        setViewMode('smartLocalized');
      } else if (pendingDbData.translatedData) {
        setViewMode('translated');
      } else {
        setViewMode('original');
      }
    } else {
      setOriginalTask(pendingDbData);
      setTranslatedTask(null);
      setSmartLocalizedTask(null);
      clearAiMeta();
      setViewMode('original');
    }

    setIsCached(true);
    setShowDbModal(false);
  };

  const handleRejectDb = () => {
    setOriginalTask(pendingExtractedData);
    setTranslatedTask(null);
    setSmartLocalizedTask(null);
    clearAiMeta();
    setViewMode('original');
    setIsCached(false);
    setDetectedLang('');
    setShowDbModal(false);
  };

  const handleTranslate = async () => {
    if (!originalTask) return;

    setIsTranslating(true);
    setTransError('');

    try {
      const textsToTranslate = [originalTask.query || ''];

      originalTask.results.forEach((res) => {
        textsToTranslate.push(res.title || '');
        textsToTranslate.push(res.address || '');
        textsToTranslate.push(res.category || '');
      });

      const { translations, detectedSourceLanguage } = await translateTaskFields(
        textsToTranslate,
        targetLang
      );

      let ptr = 0;

      const newTranslatedTask = {
        ...originalTask,
        query: translations[ptr++],
        results: originalTask.results.map((res) => ({
          ...res,
          title: translations[ptr++],
          address: translations[ptr++],
          category: translations[ptr++],
        })),
      };

      setTranslatedTask(newTranslatedTask);
      setDetectedLang(detectedSourceLanguage);
      setViewMode('translated');

      if (newTranslatedTask.requestId && newTranslatedTask.requestId !== 'N/A') {
        try {
          await setDoc(doc(db, 'tasks', newTranslatedTask.requestId), {
            originalData: originalTask,
            translatedData: newTranslatedTask,
            smartLocalizedData: smartLocalizedTask || null,
            spellingIssues,
            fieldNotes,
            fieldLanguages,
            detectedLang: detectedSourceLanguage,
            tipsData: tipsData,
          }, { merge: true });

          setIsCached(true);
        } catch (dbErr) {
          console.error('Failed to save translated data to Firebase:', dbErr);
        }
      }
    } catch (err) {
      setTransError(err.message);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSmartLocalize = async () => {
    if (!originalTask) return;

    setIsSmartLocalizing(true);
    setTransError('');

    try {
      const textsToLocalize = [originalTask.query || ''];

      originalTask.results.forEach((res) => {
        textsToLocalize.push(res.title || '');
        textsToLocalize.push(res.address || '');
        textsToLocalize.push(res.category || '');
        textsToLocalize.push(res.type || '');
        textsToLocalize.push(res.status || '');
      });

      const {
        localizedTexts,
        transliteratedTexts: aiTransliteratedTexts,
        spellingIssues: aiSpellingIssues,
        fieldNotes: aiFieldNotes,
        fieldLanguages: aiFieldLanguages,
        detectedSourceLanguage,
      } = await smartLocalizeTaskFields(textsToLocalize, 'AUTO');

      let ptr = 0;

      const newSmartLocalizedTask = {
        ...originalTask,
        query: localizedTexts[ptr++],
        results: originalTask.results.map((res) => ({
          ...res,
          title: localizedTexts[ptr++],
          address: localizedTexts[ptr++],
          category: localizedTexts[ptr++],
          type: localizedTexts[ptr++],
          status: localizedTexts[ptr++],
        })),
      };

      const finalDetectedLang = detectedSourceLanguage || detectedLang || 'AUTO';

      setSmartLocalizedTask(newSmartLocalizedTask);
      setSpellingIssues(aiSpellingIssues || []);
      setTransliteratedTexts(aiTransliteratedTexts || []);
      setFieldNotes(aiFieldNotes || []);
      setFieldLanguages(aiFieldLanguages || []);
      setDetectedLang(finalDetectedLang);
      setViewMode('smartLocalized');

      if (newSmartLocalizedTask.requestId && newSmartLocalizedTask.requestId !== 'N/A') {
        try {
          await setDoc(doc(db, 'tasks', newSmartLocalizedTask.requestId), {
            originalData: originalTask,
            translatedData: translatedTask || null,
            smartLocalizedData: newSmartLocalizedTask,
            spellingIssues: aiSpellingIssues || [],
            fieldNotes: aiFieldNotes || [],
            fieldLanguages: aiFieldLanguages || [],
            transliteratedTexts: aiTransliteratedTexts || [],
            detectedLang: finalDetectedLang,
            tipsData: tipsData,
          }, { merge: true });

          setIsCached(true);
        } catch (dbErr) {
          console.error('Failed to save smart localized data to Firebase:', dbErr);
        }
      }
    } catch (err) {
      console.error('AI localization failed:', err);
      setTransError(err.message || 'AI localization failed.');
    } finally {
      setIsSmartLocalizing(false);
    }
  };

 const handleGetTips = async () => {
    if (!smartLocalizedTask) return;
    setIsGettingTips(true);
    setTransError('');
    
    try {
      const response = await fetch('/api/get-rating-tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: smartLocalizedTask.query,
          taskType: smartLocalizedTask.taskType,
          userLatLng: smartLocalizedTask.userLatLng || smartLocalizedTask.mapCenterLatLng,
          viewportAge: smartLocalizedTask.viewportAge,
          manualViewportLatLng: manualViewportLatLng, // Send the user's click data
          results: smartLocalizedTask.results
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load tips');
      
      setTipsData(data.evaluation); // The JSON rules evaluation
      setRealMapData(data.realData || []); // The Ola Maps ground truth pins
      setViewMode('tips'); 

      if (smartLocalizedTask.requestId && smartLocalizedTask.requestId !== 'N/A') {
        try {
          await setDoc(doc(db, 'tasks', smartLocalizedTask.requestId), {
            tipsData: data.evaluation,
            realMapData: data.realData || []
          }, { merge: true });
        } catch (dbErr) {
          console.error('Failed to save tips to Firebase:', dbErr);
        }
      }

    } catch (err) {
      setTransError('Error fetching tips: ' + err.message);
    } finally {
      setIsGettingTips(false);
    }
  };

  const activeTask =
    viewMode === 'translated' && translatedTask
      ? translatedTask
      : (viewMode === 'smartLocalized' || viewMode === 'compare' || viewMode === 'tips') && smartLocalizedTask
        ? smartLocalizedTask
        : originalTask;

  const querySpellingIssue = spellingIssues.find((issue) => issue.inputIndex === 0);

  const getLanguageInfo = (inputIndex) =>
    fieldLanguages.find((item) => item.inputIndex === inputIndex);

  const getFieldNote = (inputIndex) =>
    fieldNotes.find((item) => item.inputIndex === inputIndex);

  const renderFieldMeta = (inputIndex) => {
    const languageInfo = getLanguageInfo(inputIndex);
    const fieldNote = getFieldNote(inputIndex);

    if (!languageInfo && !fieldNote) return null;

    return (
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
        {languageInfo?.languages?.map((lang) => (
          <span key={lang} style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
            {lang}
          </span>
        ))}

        {fieldNote?.mode && (
          <span style={{ backgroundColor: '#e7f5ec', color: '#146c43', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
            {fieldNote.mode.replaceAll('_', ' ')}
          </span>
        )}

        {fieldNote?.confidence && (
          <span style={{ backgroundColor: '#fff3cd', color: '#664d03', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
            {fieldNote.confidence} confidence
          </span>
        )}
      </div>
    );
  };

  const CompareField = ({ label, originalValue, smartValue, inputIndex }) => {
    const transliteration = transliteratedTexts[inputIndex];
    const spellingIssue = spellingIssues.find((issue) => issue.inputIndex === inputIndex);

    const shouldShowTransliteration =
      transliteration &&
      transliteration.trim() &&
      transliteration.trim() !== String(originalValue || '').trim();

    return (
      <div style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
        <div style={{ fontWeight: 'bold', color: '#555', marginBottom: '6px' }}>{label}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#777', fontWeight: 'bold', marginBottom: '2px' }}>Original</div>
            <div>{originalValue || '-'}</div>

            {shouldShowTransliteration && (
              <div style={{ marginTop: '6px' }}>
                <div style={{ fontSize: '11px', color: '#777', fontWeight: 'bold' }}>Read as</div>
                <div style={{ color: '#0f3460', fontWeight: 'bold' }}>{transliteration}</div>
              </div>
            )}

            {spellingIssue && (
              <div style={{
                marginTop: '8px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffecb5',
                color: '#664d03',
                padding: '7px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                lineHeight: 1.35,
              }}>
                <div><strong>Possible spelling issue</strong></div>
                <div><strong>Raw:</strong> {spellingIssue.originalWord || '-'}</div>
                <div><strong>Read as:</strong> {spellingIssue.actualTransliteration || '-'}</div>
                <div><strong>Suggested:</strong> {spellingIssue.suggestedWord || '-'}</div>
                {spellingIssue.severity && <div><strong>Severity:</strong> {spellingIssue.severity}</div>}
                {spellingIssue.reason && <div><strong>Reason:</strong> {spellingIssue.reason}</div>}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#777', fontWeight: 'bold', marginBottom: '2px' }}>Smart English</div>
            <div style={{ color: '#0f3460', fontWeight: 'bold' }}>{smartValue || '-'}</div>
            {renderFieldMeta(inputIndex)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', backgroundColor: APP_THEME.pageBg, minHeight: '100vh', margin: 0, padding: 0, color: APP_THEME.textMain }}>
      {showDbModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '8px', maxWidth: '400px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0 }}>Task Found in Database</h3>
            <p style={{ color: '#555', marginBottom: '25px' }}>This Request ID has already been processed previously. Would you like to load the saved data?</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={handleRejectDb} style={{ padding: '10px 15px', border: '1px solid #ccc', backgroundColor: '#f8f9fa', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Ignore & Use New Paste</button>
              <button onClick={handleAcceptDb} style={{ padding: '10px 15px', border: 'none', backgroundColor: '#0d6efd', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Load from Database</button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        backgroundColor: APP_THEME.topBar,
        color: 'white',
        padding: '14px 26px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.18)',
        borderBottom: `3px solid ${APP_THEME.topBarAccent}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '10px',
            height: '28px',
            backgroundColor: APP_THEME.topBarAccent,
            borderRadius: '2px',
          }} />
          <div>
            <div style={{ fontSize: '17px', fontWeight: '800', letterSpacing: '0' }}>
              Rating Workflow Dashboard
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
              Multilingual map task assistant
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* We removed the old Rating Tips button from up here since it will now live next to Smart English */}

          {originalTask && (
            <button
              onClick={resetTaskState}
              style={{
                backgroundColor: APP_THEME.danger,
                color: 'white',
                border: 'none',
                padding: '8px 14px',
                cursor: 'pointer',
                borderRadius: '6px',
                fontWeight: '700',
              }}
            >
              Reset Interface
            </button>
          )}
        </div>
      </div>

      {!originalTask ? (
        <div style={{
          maxWidth: '980px',
          margin: '50px auto',
          padding: '26px',
          backgroundColor: APP_THEME.panelBg,
          borderRadius: '10px',
          border: `1px solid ${APP_THEME.panelBorder}`,
          boxShadow: '0 14px 35px rgba(15, 23, 42, 0.10)',
        }}>
          <div style={{ marginBottom: '18px' }}>
            <h2 style={{ margin: 0, fontSize: '26px', color: APP_THEME.textMain }}>
              Paste Task Data
            </h2>
            <div style={{ marginTop: '6px', color: APP_THEME.textMuted, fontSize: '13px' }}>
              Paste AC or SM task text to parse, map, and localize.
            </div>
          </div>

          <textarea
            rows="12"
            value={rawData}
            onChange={(e) => setRawData(e.target.value)}
            style={{
              width: '100%',
              padding: '14px',
              border: `1px solid ${APP_THEME.panelBorder}`,
              borderRadius: '8px',
              fontFamily: 'Consolas, monospace',
              fontSize: '13px',
              lineHeight: 1.45,
              outline: 'none',
              boxSizing: 'border-box',
              backgroundColor: '#fbfdff',
            }} />

          <button
            onClick={handleProcessTask}
            disabled={isCheckingDB}
            style={{
              width: '100%',
              padding: '13px',
              marginTop: '18px',
              backgroundColor: APP_THEME.primary,
              color: 'white',
              cursor: isCheckingDB ? 'not-allowed' : 'pointer',
              fontWeight: '800',
              border: 'none',
              borderRadius: '8px',
              boxShadow: '0 6px 14px rgba(23, 74, 124, 0.22)',
            }}
          >
            {isCheckingDB ? 'Checking Database...' : 'Extract & Build Layout'}
          </button>

          {transError && <p style={{ color: '#dc3545', fontWeight: 'bold' }}>{transError}</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', height: 'calc(100vh - 45px)' }}>
          <div style={{ width: '45%', borderRight: '2px solid #ccc', position: 'relative' }}>
           <MapComponent
              userLatLng={activeTask.userLatLng || activeTask.mapCenterLatLng}
              results={activeTask.results}
              resultColors={THEME_COLORS}
              isTipsMode={viewMode === 'tips'}
              manualViewportLatLng={manualViewportLatLng}
              onMapClick={(coords) => setManualViewportLatLng(coords)}
              realData={realMapData}
            />
          </div>

          <div style={{ width: '55%', backgroundColor: 'white', overflowY: 'auto', padding: '20px' }}>
            {/* --- NEW SEPARATED CONTROL PANEL HEADER --- */}
            <div style={{
              backgroundColor: '#f8fbff',
              padding: '16px 20px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: `1px solid ${APP_THEME.panelBorder}`,
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
            }}>

              {/* TOP ROW: Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>

                {/* Left Side: Translation/Localization Tools */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {isCached && <span style={{ fontSize: '13px', color: '#198754', fontWeight: 'bold', marginRight: '5px', backgroundColor: '#d1e7dd', padding: '4px 8px', borderRadius: '4px' }}>DB Archive</span>}

                  <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontWeight: 'bold' }}>
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>

                  <button onClick={handleTranslate} disabled={isTranslating} style={{ backgroundColor: '#0d6efd', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: isTranslating ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                    {isTranslating ? 'Translating...' : 'Translate'}
                  </button>

                  <button onClick={handleSmartLocalize} disabled={isSmartLocalizing} style={{ backgroundColor: '#6f42c1', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: isSmartLocalizing ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                    {isSmartLocalizing ? 'Checking...' : 'Smart English'}
                  </button>
                </div>

                {/* Right Side: Meta Tools (Tips & Lang Detection) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {detectedLang && (
                    <span style={{ fontSize: '13px', color: '#084298', fontWeight: 'bold' }}>
                      Detected: {getLanguageLabel(detectedLang)}
                    </span>
                  )}

                  {smartLocalizedTask && (
                    <button
                      onClick={handleGetTips}
                      disabled={isGettingTips}
                      style={{
                        backgroundColor: '#f59e0b',
                        color: '#111827',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: isGettingTips ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 6px rgba(245, 158, 11, 0.2)'
                      }}
                    >
                      {isGettingTips ? 'Analyzing Rules...' : 'Get Rating Tips'}
                    </button>
                  )}
                </div>
              </div>

              {/* BOTTOM ROW: Tabs */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>

                {/* Left Side: Data View Tabs */}
                <div style={{ display: 'flex', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #ccc', overflow: 'hidden' }}>
                  <button onClick={() => setViewMode('original')} style={{ padding: '6px 14px', border: 'none', cursor: 'pointer', fontWeight: 'bold', backgroundColor: viewMode === 'original' ? '#0f3460' : 'transparent', color: viewMode === 'original' ? 'white' : '#555' }}>
                    Raw Data
                  </button>

                  <button onClick={() => setViewMode('translated')} disabled={!translatedTask} style={{ padding: '6px 14px', border: 'none', cursor: translatedTask ? 'pointer' : 'not-allowed', fontWeight: 'bold', backgroundColor: viewMode === 'translated' && translatedTask ? '#0f3460' : 'transparent', color: viewMode === 'translated' && translatedTask ? 'white' : '#aaa' }}>
                    Translated
                  </button>

                  <button onClick={() => setViewMode('smartLocalized')} disabled={!smartLocalizedTask} style={{ padding: '6px 14px', border: 'none', cursor: smartLocalizedTask ? 'pointer' : 'not-allowed', fontWeight: 'bold', backgroundColor: viewMode === 'smartLocalized' && smartLocalizedTask ? '#0f3460' : 'transparent', color: viewMode === 'smartLocalized' && smartLocalizedTask ? 'white' : '#aaa' }}>
                    Smart English
                  </button>

                  <button
                    onClick={() => setViewMode('compare')}
                    disabled={!smartLocalizedTask}
                    style={{
                      padding: '6px 14px',
                      border: 'none',
                      cursor: smartLocalizedTask ? 'pointer' : 'not-allowed',
                      fontWeight: 'bold',
                      backgroundColor: viewMode === 'compare' && smartLocalizedTask ? '#0f766e' : 'transparent',
                      color: viewMode === 'compare' && smartLocalizedTask ? 'white' : smartLocalizedTask ? '#0f766e' : '#aaa',
                      borderLeft: '1px solid #bae6fd',
                    }}
                  >
                    Compare
                  </button>
                </div>

                {/* Right Side: Rating Guide Tab */}
                {tipsData && (
                  <div style={{ display: 'flex', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #fcd34d', overflow: 'hidden', boxShadow: '0 2px 4px rgba(245, 158, 11, 0.1)' }}>
                    <button
                      onClick={() => setViewMode('tips')}
                      disabled={!tipsData}
                      style={{
                        padding: '6px 16px',
                        border: 'none',
                        cursor: tipsData ? 'pointer' : 'not-allowed',
                        fontWeight: 'bold',
                        backgroundColor: viewMode === 'tips' && tipsData ? '#b45309' : '#fef3c7',
                        color: viewMode === 'tips' && tipsData ? 'white' : '#b45309',
                      }}
                    >
                      ★ Rating Guide
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* --- END OF CONTROL PANEL HEADER --- */}
            {transError && <p style={{ color: '#dc3545', fontWeight: 'bold', padding: '10px', backgroundColor: '#f8d7da', borderRadius: '4px' }}>{transError}</p>}

            {/* --- NEW VIEW: THE RATING TIPS TAB --- */}
            {/* --- NEW VIEW: THE RATING TIPS TAB --- */}
            {viewMode === 'tips' && tipsData && (
              <div style={{ backgroundColor: '#fff', border: '1px solid #f59e0b', borderRadius: '8px', padding: '20px', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.1)' }}>
                <h3 style={{ marginTop: 0, color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #fde68a', paddingBottom: '10px' }}>
                  <span>🎯</span> Smart Evaluation Guide
                </h3>
                
                {/* 1. Location Intent Header */}
                <div style={{ backgroundColor: '#ffffff', padding: '15px', borderRadius: '6px', border: '1px solid #fef08a', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#92400e', fontSize: '15px' }}>
                    📍 Location Intent: {tipsData.locationIntentDecision || 'Unknown'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '13.5px', color: '#555', lineHeight: '1.5' }}>
                    {tipsData.locationIntentReason || 'Check user and viewport rules.'}
                  </p>
                </div>

                {/* 2. Individual Result Evaluations */}
                <h4 style={{ color: '#0f3460', marginBottom: '12px', fontSize: '16px' }}>Result Breakdown</h4>
                
                {tipsData.resultEvaluations?.map((resEval, idx) => (
                  <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px', backgroundColor: '#f8fafc' }}>
                    <h5 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                      Result {resEval.resultNumber}
                    </h5>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', marginBottom: '12px' }}>
                      <div>
                        <strong style={{ color: '#64748b' }}>Relevance:</strong>{' '}
                        <span style={{ fontWeight: 'bold', color: String(resEval.suggestedRelevance).includes('Bad') ? '#ef4444' : '#10b981' }}>
                          {resEval.suggestedRelevance}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#64748b' }}>Name:</strong> <span style={{ fontWeight: '500' }}>{resEval.nameAccuracy}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#64748b' }}>Address:</strong> <span style={{ fontWeight: '500' }}>{resEval.addressAccuracy}</span>
                      </div>
                      <div>
                        <strong style={{ color: '#64748b' }}>Pin:</strong> <span style={{ fontWeight: '500' }}>{resEval.pinAccuracy}</span>
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '13px', color: '#334155', backgroundColor: '#fff', padding: '10px', borderRadius: '4px', border: '1px dashed #cbd5e1' }}>
                      <strong>Reasoning:</strong> {resEval.briefExplanation}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Existing Warning Message UI */}
            {viewMode === 'smartLocalized' && spellingIssues.length > 0 && (
              <div style={{ backgroundColor: '#fff3cd', border: '1px solid #ffecb5', color: '#664d03', padding: '10px 12px', borderRadius: '6px', marginBottom: '15px', fontSize: '13px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                  {spellingIssues.length} possible spelling {spellingIssues.length === 1 ? 'issue' : 'issues'} found
                </div>

                <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
                  {spellingIssues.map((issue, index) => (
                    <li key={`${issue.inputIndex}-${index}`} style={{ marginBottom: '5px' }}>
                      <strong>{issue.fieldType || 'field'}</strong> #{issue.inputIndex}:{' '}
                      <span>{issue.originalWord || '-'}</span> {' -> '}
                      <span>{issue.suggestedWord || '-'}</span>
                      {issue.severity ? ` [${issue.severity}]` : ''}
                      {issue.reason ? ` - ${issue.reason}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Existing Task Metadata UI */}
            {viewMode !== 'tips' && (
              <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #e9ecef', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '10px' }}>
                  <div><strong>Task Type:</strong> {activeTask.taskType}</div>
                  <div><strong>Request ID:</strong> {activeTask.requestId}</div>
                  <div><strong>Time:</strong> {activeTask.estimatedTime}</div>
                </div>

                <div style={{ margin: '6px 0' }}>
                  <strong>Query:</strong>{' '}
                  <span style={{ color: '#0f3460', fontWeight: 'bold', fontSize: '15px' }}>{activeTask.query}</span>

                  {viewMode === 'smartLocalized' && querySpellingIssue && (
                    <div style={{ marginTop: '8px', backgroundColor: '#fff3cd', border: '1px solid #ffecb5', color: '#664d03', padding: '8px', borderRadius: '6px', fontSize: '12px' }}>
                      <strong>Possible query spelling issue:</strong>{' '}
                      {querySpellingIssue.originalWord || '-'} {' -> '} {querySpellingIssue.suggestedWord || '-'}
                      {querySpellingIssue.reason ? ` (${querySpellingIssue.reason})` : ''}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Existing Compare UI */}
            {viewMode === 'compare' && originalTask && smartLocalizedTask ? (
              <>
                <div style={{ backgroundColor: '#f2ec97', padding: '15px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #e9ecef' }}>
                  <CompareField label="Query" originalValue={originalTask.query} smartValue={smartLocalizedTask.query} inputIndex={0} />
                </div>

                {smartLocalizedTask.results.map((smartResult, idx) => {
                  const originalResult = originalTask.results[idx] || {};
                  const baseIndex = 1 + idx * 5;

                  return (
                    <div key={idx} style={{ border: '1px solid #ced4da', borderRadius: '6px', marginBottom: '25px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                      <div style={{ backgroundColor: THEME_COLORS[idx % THEME_COLORS.length], color: 'white', padding: '10px 15px', fontWeight: 'bold', fontSize: '15px' }}>
                        {smartResult.number} {smartResult.title}
                      </div>

                      <div style={{ padding: '15px', fontSize: '13px' }}>
                        <CompareField label="Title" originalValue={originalResult.title} smartValue={smartResult.title} inputIndex={baseIndex} />
                        <CompareField label="Address" originalValue={originalResult.address} smartValue={smartResult.address} inputIndex={baseIndex + 1} />
                        <CompareField label="Category" originalValue={originalResult.category} smartValue={smartResult.category} inputIndex={baseIndex + 2} />
                        <CompareField label="Type" originalValue={originalResult.type} smartValue={smartResult.type} inputIndex={baseIndex + 3} />
                        <CompareField label="Status" originalValue={originalResult.status} smartValue={smartResult.status} inputIndex={baseIndex + 4} />
                      </div>
                    </div>
                  );
                })}
              </>
            ) : viewMode !== 'tips' ? (
              /* Existing Standard UI */
              activeTask.results.map((result, idx) => {
                const baseIndex = 1 + idx * 5;

                const issuesForResult = {
                  title: spellingIssues.find((issue) => issue.inputIndex === baseIndex),
                  address: spellingIssues.find((issue) => issue.inputIndex === baseIndex + 1),
                  category: spellingIssues.find((issue) => issue.inputIndex === baseIndex + 2),
                  type: spellingIssues.find((issue) => issue.inputIndex === baseIndex + 3),
                  status: spellingIssues.find((issue) => issue.inputIndex === baseIndex + 4),
                };

                return (
                  <ResultCard
                    key={idx}
                    result={result}
                    color={THEME_COLORS[idx % THEME_COLORS.length]}
                    spellingIssues={viewMode === 'smartLocalized' ? issuesForResult : {}}
                  />
                );
              })
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;