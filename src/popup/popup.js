/**
 * Popup 弹出窗口脚本
 */

// 状态
let currentCaptcha = null;
let recognizedText = null;

// DOM元素
const elements = {
    statusIndicator: null,
    statusText: null,
    configName: null,
    captchaSection: null,
    captchaType: null,
    captchaConfidence: null,
    resultSection: null,
    resultText: null,
    resultTime: null,
    fillSection: null,
    ruleSection: null,
    ruleText: null,
    btnSettings: null,
    btnManual: null,
    btnRecognize: null,
    btnFill: null,
    btnCopy: null,
    btnPreview: null,
    btnDeleteRule: null,
    errorToast: null,
    errorMessage: null,
    successToast: null,
    successMessage: null
};

// 当前网站信息
let currentHostname = null;
let currentSiteRule = null;

/**
 * 初始化
 */
async function init() {
    // 获取DOM元素
    elements.statusIndicator = document.getElementById('status-indicator');
    elements.statusText = document.getElementById('status-text');
    elements.configName = document.getElementById('config-name');
    elements.captchaSection = document.getElementById('captcha-section');
    elements.captchaType = document.getElementById('captcha-type');
    elements.captchaConfidence = document.getElementById('captcha-confidence');
    elements.resultSection = document.getElementById('result-section');
    elements.resultText = document.getElementById('result-text');
    elements.resultTime = document.getElementById('result-time');
    elements.fillSection = document.getElementById('fill-section');
    elements.ruleSection = document.getElementById('rule-section');
    elements.ruleText = document.getElementById('rule-text');
    elements.btnSettings = document.getElementById('btn-settings');
    elements.btnManual = document.getElementById('btn-manual');
    elements.btnRecognize = document.getElementById('btn-recognize');
    elements.btnFill = document.getElementById('btn-fill');
    elements.btnCopy = document.getElementById('btn-copy');
    elements.btnPreview = document.getElementById('btn-preview');
    elements.btnDeleteRule = document.getElementById('btn-delete-rule');
    elements.errorToast = document.getElementById('error-toast');
    elements.errorMessage = document.getElementById('error-message');
    elements.successToast = document.getElementById('success-toast');
    elements.successMessage = document.getElementById('success-message');

    // 绑定事件
    elements.btnSettings.addEventListener('click', openSettings);
    elements.btnManual.addEventListener('click', manualSelect);
    elements.btnRecognize.addEventListener('click', recognizeCaptcha);
    elements.btnFill.addEventListener('click', fillCaptcha);
    elements.btnCopy.addEventListener('click', copyResult);
    elements.btnPreview.addEventListener('click', previewCaptcha);
    elements.btnDeleteRule.addEventListener('click', deleteSiteRule);

    // 加载配置
    await loadConfig();

    // 检查网站规则并获取当前页面状态
    await checkSiteRuleAndStatus();
}

/**
 * 加载配置信息
 */
async function loadConfig() {
    try {
        const response = await chrome.runtime.sendMessage({ action: 'getActiveConfig' });

        if (response.success && response.config) {
            elements.configName.textContent = response.config.name;
            elements.configName.classList.remove('not-configured');
        } else {
            elements.configName.textContent = '未配置';
            elements.configName.classList.add('not-configured');
        }
    } catch (error) {
        console.error('加载配置失败:', error);
        elements.configName.textContent = '加载失败';
    }
}

/**
 * 检查页面状态
 */
async function checkPageStatus() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) {
            showError('无法获取当前标签页');
            return;
        }

        // 发送消息到内容脚本
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });

        if (response.success) {
            if (response.hasCaptcha) {
                updateCaptchaInfo(response.currentCaptcha);
                elements.btnRecognize.disabled = false;
            }
        }
    } catch (error) {
        // 内容脚本可能未加载
        console.log('页面状态检查失败:', error.message);
    }
}

/**
 * 检查网站规则并获取页面状态
 */
async function checkSiteRuleAndStatus() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url) return;

        // 获取当前域名
        const url = new URL(tab.url);
        currentHostname = url.hostname;

        // 检查是否有保存的规则
        const response = await chrome.runtime.sendMessage({
            action: 'getSiteRule',
            hostname: currentHostname
        });

        if (response.success && response.rule) {
            currentSiteRule = response.rule;
            showRuleSection(response.rule);

            // 自动应用规则
            await applySiteRule(tab.id, response.rule.selector);
        } else {
            hideRuleSection();
            // 检查页面状态
            await checkPageStatus();
        }
    } catch (error) {
        console.error('检查网站规则失败:', error);
        await checkPageStatus();
    }
}

/**
 * 显示网站规则区域
 */
function showRuleSection(rule) {
    elements.ruleSection.classList.remove('hidden');
    elements.ruleText.textContent = `已记住: ${rule.selector.substring(0, 30)}${rule.selector.length > 30 ? '...' : ''}`;
}

/**
 * 隐藏网站规则区域
 */
function hideRuleSection() {
    elements.ruleSection.classList.add('hidden');
    currentSiteRule = null;
}

/**
 * 应用网站规则
 */
async function applySiteRule(tabId, selector) {
    try {
        const response = await chrome.tabs.sendMessage(tabId, {
            action: 'applySiteRule',
            selector: selector
        });

        if (response.success) {
            // 应用规则后，再执行一次扫描确保状态完整
            const scanResponse = await chrome.tabs.sendMessage(tabId, { action: 'scan' });

            if (scanResponse.success && scanResponse.captchas.length > 0) {
                currentCaptcha = scanResponse.bestCaptcha;
                updateCaptchaInfo(scanResponse.bestCaptcha);
                elements.btnRecognize.disabled = false;
                showSuccess('已自动定位验证码');
            } else {
                // 扫描没找到，使用原本规则应用的结果
                updateCaptchaInfo(response.captcha);
                elements.btnRecognize.disabled = false;
                showSuccess('已自动定位验证码');
            }
        } else {
            showError('规则匹配失败，请重新选择');
            hideRuleSection();
        }
    } catch (error) {
        console.error('应用规则失败:', error);
    }
}

/**
 * 手动选择验证码
 */
async function manualSelect() {
    setStatus('scanning', '选择中...');
    elements.btnManual.disabled = true;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) {
            throw new Error('无法获取当前标签页');
        }

        // 关闭popup以便用户在页面上选择
        // 发送消息启动选择器
        await chrome.tabs.sendMessage(tab.id, { action: 'startPicker' });

        // 监听选择完成的消息
        chrome.runtime.onMessage.addListener(function handler(message) {
            if (message.action === 'pickerResult') {
                chrome.runtime.onMessage.removeListener(handler);
                handlePickerResult(message);
            }
        });

        // 提示用户
        showSuccess('请在页面上点击验证码元素');

        // 关闭popup让用户操作
        window.close();

    } catch (error) {
        showError(error.message);
        setStatus('idle', '就绪');
        elements.btnManual.disabled = false;
    }
}

/**
 * 处理选择器结果
 */
async function handlePickerResult(result) {
    if (result.success) {
        // 保存网站规则
        await chrome.runtime.sendMessage({
            action: 'saveSiteRule',
            hostname: result.hostname,
            rule: {
                selector: result.selector,
                info: result.info
            }
        });

        showSuccess('已保存网站规则');
        currentCaptcha = { id: 'manual-selected' };
        elements.btnRecognize.disabled = false;
    }

    setStatus('idle', '就绪');
    elements.btnManual.disabled = false;
}

/**
 * 删除网站规则
 */
async function deleteSiteRule() {
    if (!currentHostname) return;

    try {
        await chrome.runtime.sendMessage({
            action: 'deleteSiteRule',
            hostname: currentHostname
        });

        hideRuleSection();
        showSuccess('已删除网站规则');
    } catch (error) {
        showError('删除失败');
    }
}

/**
 * 扫描页面（内部函数）
 */
async function scanPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) {
            throw new Error('无法获取当前标签页');
        }

        const response = await chrome.tabs.sendMessage(tab.id, { action: 'scan' });

        if (response.success) {
            if (response.captchas.length > 0) {
                currentCaptcha = response.bestCaptcha;
                updateCaptchaInfo(response.bestCaptcha);
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('扫描失败:', error);
        return false;
    }
}

/**
 * 识别验证码（优先使用已保存规则，否则自动扫描）
 */
async function recognizeCaptcha() {
    setStatus('recognizing', '识别中...');
    elements.btnRecognize.disabled = true;
    elements.btnManual.disabled = true;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) {
            throw new Error('无法获取当前标签页');
        }

        let captchaReady = false;

        // 如果有已保存的规则，优先使用规则
        if (currentSiteRule && currentSiteRule.selector) {
            setStatus('scanning', '应用规则...');
            const ruleResponse = await chrome.tabs.sendMessage(tab.id, {
                action: 'applySiteRule',
                selector: currentSiteRule.selector
            });

            if (ruleResponse.success) {
                currentCaptcha = ruleResponse.captcha;
                updateCaptchaInfo(ruleResponse.captcha);
                captchaReady = true;
            }
        }

        // 如果规则不可用，尝试自动扫描
        if (!captchaReady) {
            setStatus('scanning', '扫描中...');
            const scanResponse = await chrome.tabs.sendMessage(tab.id, { action: 'scan' });

            if (scanResponse.success && scanResponse.captchas.length > 0) {
                currentCaptcha = scanResponse.bestCaptcha;
                updateCaptchaInfo(scanResponse.bestCaptcha);
                captchaReady = true;
            }
        }

        if (!captchaReady) {
            throw new Error('未检测到验证码，请使用"选择元素"手动选择');
        }

        // 执行识别
        setStatus('recognizing', '识别中...');
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'recognize',
            captchaId: currentCaptcha?.id
        });

        if (response.success) {
            recognizedText = response.text;
            showResult(response.text, response.elapsed);
            showSuccess('识别成功');

            // 检查是否启用了自动填充
            try {
                const settingsResponse = await chrome.runtime.sendMessage({ action: 'getSettings' });
                if (settingsResponse.success && settingsResponse.settings.autoFill) {
                    // 延迟一小段时间让用户看到结果，然后自动填充
                    setTimeout(() => fillCaptcha(), 300);
                }
            } catch (e) {
                console.error('获取设置失败:', e);
            }
        } else {
            throw new Error(response.error || '识别失败');
        }
    } catch (error) {
        showError(error.message);
    } finally {
        setStatus('idle', '就绪');
        elements.btnRecognize.disabled = false;
        elements.btnManual.disabled = false;
    }
}

/**
 * 填充验证码
 */
async function fillCaptcha() {
    if (!recognizedText) {
        showError('没有可填充的结果');
        return;
    }

    setStatus('filling', '填充中...');
    elements.btnFill.disabled = true;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) {
            throw new Error('无法获取当前标签页');
        }

        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'fill',
            text: recognizedText,
            options: { simulate: true }
        });

        if (response.success) {
            showSuccess('填充成功');
        } else {
            throw new Error(response.error || '填充失败');
        }
    } catch (error) {
        showError(error.message);
    } finally {
        setStatus('idle', '就绪');
        elements.btnFill.disabled = false;
    }
}

/**
 * 复制结果
 */
async function copyResult() {
    if (!recognizedText) return;

    try {
        await navigator.clipboard.writeText(recognizedText);
        showSuccess('已复制');
    } catch (error) {
        showError('复制失败');
    }
}

/**
 * 打开设置页面
 */
function openSettings() {
    chrome.runtime.openOptionsPage();
}

/**
 * 调试预览 - 查看发送给AI的图片
 */
async function previewCaptcha() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) {
            throw new Error('无法获取当前标签页');
        }

        showSuccess('调试窗口已在页面中打开');

        await chrome.tabs.sendMessage(tab.id, {
            action: 'previewCaptcha',
            captchaId: currentCaptcha?.id
        });
    } catch (error) {
        showError(error.message);
    }
}

/**
 * 设置状态
 * @param {string} status - 状态类型
 * @param {string} text - 状态文本
 */
function setStatus(status, text) {
    elements.statusIndicator.className = `status - indicator status - ${status} `;
    elements.statusText.textContent = text;
}

/**
 * 更新验证码信息
 * @param {object} captcha - 验证码信息
 */
function updateCaptchaInfo(captcha) {
    if (!captcha) {
        hideCaptchaInfo();
        return;
    }

    elements.captchaSection.classList.remove('hidden');
    elements.captchaType.textContent = captcha.type.toUpperCase();
    elements.captchaConfidence.textContent = `${captcha.confidence}% `;

    // 根据置信度设置颜色
    if (captcha.confidence >= 70) {
        elements.captchaConfidence.className = 'value confidence-high';
    } else if (captcha.confidence >= 40) {
        elements.captchaConfidence.className = 'value confidence-medium';
    } else {
        elements.captchaConfidence.className = 'value confidence-low';
    }
}

/**
 * 隐藏验证码信息
 */
function hideCaptchaInfo() {
    elements.captchaSection.classList.add('hidden');
    currentCaptcha = null;
}

/**
 * 显示识别结果
 * @param {string} text - 识别结果
 * @param {number} elapsed - 耗时
 */
function showResult(text, elapsed) {
    elements.resultSection.classList.remove('hidden');
    elements.resultText.textContent = text;
    elements.resultTime.textContent = `耗时: ${(elapsed / 1000).toFixed(2)} s`;
    elements.fillSection.classList.remove('hidden');
}

/**
 * 显示错误提示
 * @param {string} message - 错误消息
 */
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorToast.classList.remove('hidden');

    setTimeout(() => {
        elements.errorToast.classList.add('hidden');
    }, 3000);
}

/**
 * 显示成功提示
 * @param {string} message - 成功消息
 */
function showSuccess(message) {
    elements.successMessage.textContent = message;
    elements.successToast.classList.remove('hidden');

    setTimeout(() => {
        elements.successToast.classList.add('hidden');
    }, 2000);
}

// 初始化
document.addEventListener('DOMContentLoaded', init);
