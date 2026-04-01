import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
function Preview() {
    const [screenshot, setScreenshot] = useState(null);
    const [status, setStatus] = useState('等待任务执行...');
    useEffect(() => {
        const unsubscribe = window.electron.onScreenshot((data) => {
            setScreenshot(data.screenshot);
            setStatus('截图已更新');
        });
        return unsubscribe;
    }, []);
    return (_jsx("div", { style: {
            backgroundColor: '#0F0F14',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            boxSizing: 'border-box',
        }, children: screenshot ? (_jsx("img", { src: `data:image/png;base64,${screenshot}`, alt: "Preview", style: {
                maxWidth: '100%',
                maxHeight: '100%',
                border: '1px solid #2E2E3A',
                borderRadius: '8px',
            } })) : (_jsxs("div", { style: { color: '#A1A1AA', textAlign: 'center' }, children: [_jsx("h2", { style: { color: '#fff', marginBottom: '10px' }, children: "Preview Window" }), _jsx("p", { children: status })] })) }));
}
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(_jsx(React.StrictMode, { children: _jsx(Preview, {}) }));
}
