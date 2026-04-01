import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
function InstallModal({ isOpen, onClose, onInstall, isLoading }) {
    const [path, setPath] = useState('');
    if (!isOpen)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-[60] flex", children: [_jsx("div", { className: "flex-1 bg-black/50", onClick: onClose }), _jsxs("div", { className: "w-[400px] bg-surface border border-border rounded-lg p-6 m-auto", children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-4", children: "\u5B89\u88C5 Skill" }), _jsx("input", { type: "text", value: path, onChange: (e) => setPath(e.target.value), placeholder: "\u8F93\u5165 Skill \u76EE\u5F55\u8DEF\u5F84", className: "w-full px-3 py-2 bg-background border border-border rounded text-sm text-white placeholder-text-muted focus:outline-none focus:border-primary mb-4", onKeyDown: (e) => e.key === 'Enter' && path.trim() && onInstall(path.trim()), disabled: isLoading }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { onClick: onClose, className: "btn btn-secondary", disabled: isLoading, children: "\u53D6\u6D88" }), _jsx("button", { onClick: () => onInstall(path.trim()), className: "btn btn-primary", disabled: !path.trim() || isLoading, children: isLoading ? '安装中...' : '安装' })] })] })] }));
}
export function SkillPanel({ isOpen, onClose }) {
    const [skills, setSkills] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showInstallModal, setShowInstallModal] = useState(false);
    const [message, setMessage] = useState(null);
    const loadSkills = useCallback(async () => {
        setIsLoading(true);
        try {
            const skillList = await window.electron.invoke('skill:list');
            setSkills(skillList || []);
        }
        catch (error) {
            console.error('[SkillPanel] Failed to load skills:', error);
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    useEffect(() => {
        if (isOpen) {
            loadSkills();
        }
    }, [isOpen, loadSkills]);
    const handleInstall = async (skillPath) => {
        if (!skillPath)
            return;
        setShowInstallModal(false);
        setMessage(null);
        setIsLoading(true);
        try {
            const result = await window.electron.invoke('skill:install', { path: skillPath });
            if (result.success) {
                setMessage({ type: 'success', text: '安装成功' });
                loadSkills();
            }
            else {
                setMessage({ type: 'error', text: result.error || '安装失败' });
            }
        }
        catch (error) {
            setMessage({ type: 'error', text: `安装失败: ${error}` });
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleUninstall = async (skillName) => {
        if (!confirm(`确定卸载 "${skillName}"？`))
            return;
        setIsLoading(true);
        try {
            const result = await window.electron.invoke('skill:uninstall', { name: skillName });
            if (result.success) {
                setMessage({ type: 'success', text: '卸载成功' });
                loadSkills();
            }
            else {
                setMessage({ type: 'error', text: result.error || '卸载失败' });
            }
        }
        catch (error) {
            setMessage({ type: 'error', text: `卸载失败: ${error}` });
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleOpenSkillsDir = async () => {
        try {
            await window.electron.invoke('skill:openDirectory');
        }
        catch (error) {
            console.error('[SkillPanel] Failed to open skills directory:', error);
        }
    };
    if (!isOpen) {
        return null;
    }
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "fixed inset-0 z-50 flex", children: [_jsx("div", { className: "flex-1 bg-black/50", onClick: onClose }), _jsxs("div", { className: "w-[800px] bg-surface border-l border-border flex flex-col", children: [_jsxs("div", { className: "h-14 flex items-center justify-between px-4 border-b border-border", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("h2", { className: "text-lg font-semibold text-white", children: "Skill \u7BA1\u7406" }), message && (_jsx("span", { className: `text-sm ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`, children: message.text }))] }), _jsx("button", { onClick: onClose, className: "p-1 rounded hover:bg-border text-text-muted hover:text-white", children: _jsx("svg", { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsxs("div", { className: "flex items-center gap-2 px-4 py-2 border-b border-border", children: [_jsx("button", { onClick: () => setShowInstallModal(true), className: "btn btn-primary text-sm", disabled: isLoading, children: "\u5B89\u88C5 Skill" }), _jsx("button", { onClick: handleOpenSkillsDir, className: "btn btn-secondary text-sm", children: "\u6253\u5F00\u76EE\u5F55" }), _jsx("div", { className: "flex-1" }), _jsx("button", { onClick: loadSkills, className: "btn btn-secondary text-sm", disabled: isLoading, children: "\u5237\u65B0" })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-4", children: isLoading && skills.length === 0 ? (_jsx("div", { className: "flex items-center justify-center h-32 text-text-muted", children: "\u52A0\u8F7D\u4E2D..." })) : skills.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center h-32 text-text-muted", children: [_jsx("p", { children: "\u6682\u65E0\u5DF2\u5B89\u88C5\u7684 Skill" }), _jsx("p", { className: "text-sm mt-2", children: "\u70B9\u51FB\"\u5B89\u88C5 Skill\"\u5F00\u59CB\u4F7F\u7528" })] })) : (_jsx("div", { className: "grid grid-cols-2 gap-4", children: skills.map((skill, index) => (_jsxs("div", { className: "bg-elevated border border-border rounded-lg p-4 hover:border-primary/50 transition-colors", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-sm font-medium text-white", children: skill.name }), skill.version && (_jsxs("span", { className: "text-xs text-text-muted", children: ["v", skill.version] }))] }), _jsx("button", { onClick: () => handleUninstall(skill.name), className: "p-1 rounded hover:bg-border text-text-muted hover:text-red-400", title: "\u5378\u8F7D", children: _jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }) })] }), _jsx("p", { className: "text-sm text-text-muted mt-2 line-clamp-2", children: skill.description || '无描述' }), _jsx("div", { className: "flex items-center gap-2 mt-3", children: _jsx("span", { className: "text-xs text-text-muted truncate", children: skill.path }) })] }, skill.name || index))) })) }), _jsx("div", { className: "p-4 border-t border-border", children: _jsxs("div", { className: "text-xs text-text-muted", children: [_jsx("p", { children: "Skill \u76EE\u5F55: ~/.opencowork/skills" }), _jsx("p", { className: "mt-1", children: "\u652F\u6301 Claude \u5B98\u65B9 SKILL.md \u89C4\u8303" })] }) })] })] }), _jsx(InstallModal, { isOpen: showInstallModal, onClose: () => setShowInstallModal(false), onInstall: handleInstall, isLoading: isLoading })] }));
}
export default SkillPanel;
