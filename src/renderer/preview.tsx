import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import { useTranslation } from './i18n/useTranslation';

function Preview() {
  const { t } = useTranslation();
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [status, setStatus] = useState(t('preview.waiting'));

  useEffect(() => {
    const unsubscribe = window.electron.onScreenshot((data) => {
      setScreenshot(data.screenshot);
      setStatus(t('preview.updated'));
    });
    return unsubscribe;
  }, [t]);

  return (
    <div style={{
      backgroundColor: '#0F0F14',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      boxSizing: 'border-box',
    }}>
      {screenshot ? (
        <img
          src={`data:image/png;base64,${screenshot}`}
          alt={t('preview.alt')}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            border: '1px solid #2E2E3A',
            borderRadius: '8px',
          }}
        />
      ) : (
        <div style={{ color: '#A1A1AA', textAlign: 'center' }}>
          <h2 style={{ color: '#fff', marginBottom: '10px' }}>{t('preview.title')}</h2>
          <p>{status}</p>
        </div>
      )}
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <Preview />
    </React.StrictMode>
  );
}
