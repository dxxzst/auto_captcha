/**
 * Options 设置页面脚本
 */

import * as storage from '../utils/storage.js';
import { API_TYPES, PRESET_TEMPLATES, DEFAULT_RECOGNITION_PROMPT } from '../api/api-manager.js';

// 当前编辑的配置ID
let editingConfigId = null;

// DOM元素缓存
const elements = {};

/**
 * 初始化
 */
async function init() {
    cacheElements();
    bindEvents();
    await loadData();
}

/**
 * 缓存DOM元素
 */
function cacheElements() {
    // 导航
    elements.navItems = document.querySelectorAll('.nav-item');
    elements.sections = document.querySelectorAll('.section');

    // 配置相关
    elements.configList = document.getElementById('config-list');
    elements.presetBtns = document.querySelectorAll('.preset-btn');

    // 对话框
    elements.configDialog = document.getElementById('config-dialog');
    elements.dialogTitle = document.getElementById('dialog-title');
    elements.configForm = document.getElementById('config-form');
    elements.btnCloseDialog = document.getElementById('btn-close-dialog');
    elements.btnTestConnection = document.getElementById('btn-test-connection');
    elements.btnSaveConfig = document.getElementById('btn-save-config');
    elements.btnToggleKey = document.getElementById('btn-toggle-key');

    // 表单字段
    elements.configId = document.getElementById('config-id');
    elements.configName = document.getElementById('config-name');
    elements.configType = document.getElementById('config-type');
    elements.configBaseUrl = document.getElementById('config-base-url');
    elements.configApiKey = document.getElementById('config-api-key');
    elements.configModel = document.getElementById('config-model');
    elements.configMaxTokens = document.getElementById('config-max-tokens');
    elements.configTemperature = document.getElementById('config-temperature');
    elements.configCustomPrompt = document.getElementById('config-custom-prompt');

    // 设置
    elements.timeout = document.getElementById('timeout');
    elements.retryCount = document.getElementById('retry-count');
    elements.autoFill = document.getElementById('auto-fill');
    elements.autoSubmit = document.getElementById('auto-submit');
    elements.historyRetention = document.getElementById('history-retention');
    elements.debugMode = document.getElementById('debug-mode');
    elements.btnSaveSettings = document.getElementById('btn-save-settings');

    // 历史记录
    elements.historyList = document.getElementById('history-list');
    elements.btnClearHistory = document.getElementById('btn-clear-history');

    // 统计
    elements.statTotal = document.getElementById('stat-total');
    elements.statSuccess = document.getElementById('stat-success');
    elements.statFail = document.getElementById('stat-fail');
    elements.statAvgTime = document.getElementById('stat-avg-time');
    elements.successRateBar = document.getElementById('success-rate-bar');
    elements.successRateText = document.getElementById('success-rate-text');
    elements.btnResetStats = document.getElementById('btn-reset-stats');

    // Toast
    elements.toast = document.getElementById('toast');
    elements.toastMessage = document.getElementById('toast-message');
}

/**
 * 绑定事件
 */
function bindEvents() {
    // 导航
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchSection(item.dataset.section);
        });
    });

    // 预设按钮
    elements.presetBtns.forEach(btn => {
        btn.addEventListener('click', () => openPresetDialog(btn.dataset.preset));
    });

    // 对话框
    elements.btnCloseDialog.addEventListener('click', closeDialog);
    elements.configDialog.addEventListener('click', (e) => {
        if (e.target === elements.configDialog) closeDialog();
    });
    elements.btnToggleKey.addEventListener('click', toggleApiKeyVisibility);
    elements.btnTestConnection.addEventListener('click', testConnection);
    elements.btnSaveConfig.addEventListener('click', saveConfig);

    // 设置
    elements.btnSaveSettings.addEventListener('click', saveSettings);

    // 历史
    elements.btnClearHistory.addEventListener('click', clearHistory);

    // 统计
    elements.btnResetStats.addEventListener('click', resetStats);
}

/**
 * 加载数据
 */
async function loadData() {
    await Promise.all([
        loadConfigs(),
        loadSettings(),
        loadHistory(),
        loadStats()
    ]);
}

/**
 * 切换页面区块
 * @param {string} sectionId - 区块ID
 */
function switchSection(sectionId) {
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });

    elements.sections.forEach(section => {
        section.classList.toggle('active', section.id === sectionId);
    });

    // 刷新数据
    switch (sectionId) {
        case 'history':
            loadHistory();
            break;
        case 'stats':
            loadStats();
            break;
    }
}

// ==================== 配置管理 ====================

/**
 * 加载配置列表
 */
async function loadConfigs() {
    const configs = await storage.getApiConfigs();
    const activeId = await storage.getActiveConfigId();

    if (configs.length === 0) {
        elements.configList.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <p>暂无配置</p>
        <span>点击上方按钮添加API配置</span>
      </div>
    `;
        return;
    }

    elements.configList.innerHTML = configs.map(config => `
    <div class="config-item ${config.id === activeId ? 'active' : ''}" data-id="${config.id}">
      <div class="config-item-header">
        <div class="config-item-info">
          <span class="config-item-name">${escapeHtml(config.name)}</span>
          <span class="config-item-type">${config.type === 'gemini' ? 'Gemini' : 'OpenAI兼容'}</span>
        </div>
        <div class="config-item-actions">
          ${config.id === activeId ? '<span class="active-badge">当前使用</span>' : `<button class="btn btn-text btn-activate" data-id="${config.id}">启用</button>`}
          <button class="icon-btn btn-edit" data-id="${config.id}" title="编辑">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="icon-btn btn-delete" data-id="${config.id}" title="删除">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="config-item-details">
        <span class="detail-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
          ${escapeHtml(config.model)}
        </span>
        <span class="detail-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          ${truncateUrl(config.baseUrl)}
        </span>
      </div>
    </div>
  `).join('');

    // 绑定配置项事件
    elements.configList.querySelectorAll('.btn-activate').forEach(btn => {
        btn.addEventListener('click', () => activateConfig(btn.dataset.id));
    });

    elements.configList.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => editConfig(btn.dataset.id));
    });

    elements.configList.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteConfig(btn.dataset.id));
    });
}

/**
 * 打开预设对话框
 * @param {string} preset - 预设名称
 */
function openPresetDialog(preset) {
    editingConfigId = null;
    elements.dialogTitle.textContent = '添加配置';

    const template = PRESET_TEMPLATES[preset] || PRESET_TEMPLATES.custom;

    elements.configId.value = '';
    elements.configName.value = template.name === '自定义API' ? '' : template.name;
    elements.configType.value = template.type;
    elements.configBaseUrl.value = template.baseUrl;
    elements.configApiKey.value = '';
    elements.configModel.value = template.model || '';
    elements.configMaxTokens.value = template.maxTokens || 500;
    elements.configTemperature.value = template.temperature || 1;
    elements.configCustomPrompt.value = '';

    elements.configDialog.classList.remove('hidden');
}

/**
 * 编辑配置
 * @param {string} configId - 配置ID
 */
async function editConfig(configId) {
    const configs = await storage.getDecryptedApiConfigs();
    const config = configs.find(c => c.id === configId);

    if (!config) {
        showToast('配置不存在', 'error');
        return;
    }

    editingConfigId = configId;
    elements.dialogTitle.textContent = '编辑配置';

    elements.configId.value = config.id;
    elements.configName.value = config.name;
    elements.configType.value = config.type;
    elements.configBaseUrl.value = config.baseUrl;
    elements.configApiKey.value = config.apiKey;
    elements.configModel.value = config.model;
    elements.configMaxTokens.value = config.maxTokens || 500;
    elements.configTemperature.value = config.temperature || 1;
    elements.configCustomPrompt.value = config.customPrompt || '';

    elements.configDialog.classList.remove('hidden');
}

/**
 * 关闭对话框
 */
function closeDialog() {
    elements.configDialog.classList.add('hidden');
    elements.configForm.reset();
    editingConfigId = null;
}

/**
 * 切换API密钥可见性
 */
function toggleApiKeyVisibility() {
    const input = elements.configApiKey;
    input.type = input.type === 'password' ? 'text' : 'password';
}

/**
 * 测试连接
 */
async function testConnection() {
    const config = getFormConfig();

    if (!config.apiKey) {
        showToast('请输入API密钥', 'error');
        return;
    }

    elements.btnTestConnection.disabled = true;
    elements.btnTestConnection.textContent = '测试中...';

    try {
        const response = await chrome.runtime.sendMessage({
            action: 'testConnection',
            config: config
        });

        if (response.success) {
            showToast(`连接成功 (${response.elapsed}ms)`, 'success');
        } else {
            showToast(`连接失败: ${response.error}`, 'error');
        }
    } catch (error) {
        showToast(`测试失败: ${error.message}`, 'error');
    } finally {
        elements.btnTestConnection.disabled = false;
        elements.btnTestConnection.textContent = '测试连接';
    }
}

/**
 * 保存配置
 */
async function saveConfig() {
    const form = elements.configForm;

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const config = getFormConfig();

    elements.btnSaveConfig.disabled = true;
    elements.btnSaveConfig.textContent = '保存中...';

    try {
        if (editingConfigId) {
            await storage.updateApiConfig(editingConfigId, config);
            showToast('配置已更新', 'success');
        } else {
            await storage.addApiConfig(config);
            showToast('配置已添加', 'success');
        }

        closeDialog();
        await loadConfigs();
    } catch (error) {
        showToast(`保存失败: ${error.message}`, 'error');
    } finally {
        elements.btnSaveConfig.disabled = false;
        elements.btnSaveConfig.textContent = '保存';
    }
}

/**
 * 获取表单配置
 * @returns {object}
 */
function getFormConfig() {
    return {
        name: elements.configName.value.trim(),
        type: elements.configType.value,
        baseUrl: elements.configBaseUrl.value.trim(),
        apiKey: elements.configApiKey.value.trim(),
        model: elements.configModel.value.trim(),
        maxTokens: parseInt(elements.configMaxTokens.value) || 500,
        temperature: parseFloat(elements.configTemperature.value) || 1,
        customPrompt: elements.configCustomPrompt.value.trim()
    };
}

/**
 * 激活配置
 * @param {string} configId - 配置ID
 */
async function activateConfig(configId) {
    await storage.setActiveConfigId(configId);
    await loadConfigs();
    showToast('配置已启用', 'success');
}

/**
 * 删除配置
 * @param {string} configId - 配置ID
 */
async function deleteConfig(configId) {
    if (!confirm('确定要删除此配置吗？')) {
        return;
    }

    await storage.deleteApiConfig(configId);
    await loadConfigs();
    showToast('配置已删除', 'success');
}

// ==================== 设置管理 ====================

/**
 * 加载设置
 */
async function loadSettings() {
    const settings = await storage.getSettings();

    elements.timeout.value = settings.timeout / 1000;
    elements.retryCount.value = settings.retryCount;
    elements.autoFill.checked = settings.autoFill;
    elements.autoSubmit.checked = settings.autoSubmit;
    elements.historyRetention.value = settings.historyRetention;
    elements.debugMode.checked = settings.debugMode;
}

/**
 * 保存设置
 */
async function saveSettings() {
    const settings = {
        timeout: parseInt(elements.timeout.value) * 1000,
        retryCount: parseInt(elements.retryCount.value),
        autoFill: elements.autoFill.checked,
        autoSubmit: elements.autoSubmit.checked,
        historyRetention: parseInt(elements.historyRetention.value),
        debugMode: elements.debugMode.checked
    };

    await storage.saveSettings(settings);
    showToast('设置已保存', 'success');
}

// ==================== 历史记录 ====================

/**
 * 加载历史记录
 */
async function loadHistory() {
    const history = await storage.getHistory(50);

    if (history.length === 0) {
        elements.historyList.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <p>暂无记录</p>
      </div>
    `;
        return;
    }

    elements.historyList.innerHTML = history.map(record => `
    <div class="history-item ${record.success ? 'success' : 'error'}">
      <div class="history-item-header">
        <span class="history-result">${escapeHtml(record.result)}</span>
        <span class="history-status">${record.success ? '成功' : '失败'}</span>
      </div>
      <div class="history-item-meta">
        <span>${record.configName}</span>
        <span>${formatTime(record.timestamp)}</span>
        <span>${record.elapsed}ms</span>
      </div>
    </div>
  `).join('');
}

/**
 * 清空历史记录
 */
async function clearHistory() {
    if (!confirm('确定要清空所有历史记录吗？')) {
        return;
    }

    await storage.clearHistory();
    await loadHistory();
    showToast('历史记录已清空', 'success');
}

// ==================== 统计数据 ====================

/**
 * 加载统计数据
 */
async function loadStats() {
    const stats = await storage.getStats();

    elements.statTotal.textContent = stats.totalRequests;
    elements.statSuccess.textContent = stats.successCount;
    elements.statFail.textContent = stats.failCount;

    if (stats.totalRequests > 0) {
        const avgTime = (stats.totalTime / stats.totalRequests / 1000).toFixed(2);
        elements.statAvgTime.textContent = `${avgTime}s`;

        const successRate = ((stats.successCount / stats.totalRequests) * 100).toFixed(1);
        elements.successRateBar.style.width = `${successRate}%`;
        elements.successRateText.textContent = `${successRate}%`;
    } else {
        elements.statAvgTime.textContent = '0s';
        elements.successRateBar.style.width = '0%';
        elements.successRateText.textContent = '0%';
    }
}

/**
 * 重置统计数据
 */
async function resetStats() {
    if (!confirm('确定要重置所有统计数据吗？')) {
        return;
    }

    await storage.resetStats();
    await loadStats();
    showToast('统计数据已重置', 'success');
}

// ==================== 工具函数 ====================

/**
 * 显示Toast提示
 * @param {string} message - 消息
 * @param {string} type - 类型
 */
function showToast(message, type = 'info') {
    elements.toast.className = `toast ${type}`;
    elements.toastMessage.textContent = message;
    elements.toast.classList.remove('hidden');

    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

/**
 * HTML转义
 * @param {string} text - 文本
 * @returns {string}
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 截断URL
 * @param {string} url - URL
 * @returns {string}
 */
function truncateUrl(url) {
    if (!url) return '-';
    try {
        const parsed = new URL(url);
        return parsed.host;
    } catch {
        return url.substring(0, 30) + (url.length > 30 ? '...' : '');
    }
}

/**
 * 格式化时间
 * @param {number} timestamp - 时间戳
 * @returns {string}
 */
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) {
        return '刚刚';
    } else if (diff < 3600000) {
        return `${Math.floor(diff / 60000)}分钟前`;
    } else if (diff < 86400000) {
        return `${Math.floor(diff / 3600000)}小时前`;
    } else {
        return date.toLocaleDateString('zh-CN');
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', init);
