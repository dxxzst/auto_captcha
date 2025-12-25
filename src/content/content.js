/**
 * 内容脚本 - 打包版本（无ES模块依赖）
 * 在网页中运行，负责验证码检测和自动填充
 */

(function () {
    'use strict';

    // ==================== 日志模块 ====================
    const logger = {
        debug: (msg, ...args) => console.log('[AI Captcha]', msg, ...args),
        info: (msg, ...args) => console.log('[AI Captcha]', msg, ...args),
        warn: (msg, ...args) => console.warn('[AI Captcha]', msg, ...args),
        error: (msg, ...args) => console.error('[AI Captcha]', msg, ...args)
    };

    // ==================== 验证码检测器 ====================
    const CAPTCHA_PATTERNS = {
        classKeywords: [
            'captcha', 'verify', 'code', 'vcode', 'imgcode',
            'checkcode', 'seccode', 'authcode', 'validcode',
            'yzm', 'yanzhengma', '验证码'
        ],
        idKeywords: [
            'captcha', 'verify', 'code', 'vcode', 'imgcode',
            'checkcode', 'seccode', 'authcode', 'validcode',
            'yzm', 'captchaImg', 'codeImg'
        ],
        sizeRange: {
            minWidth: 50,
            maxWidth: 300,
            minHeight: 20,
            maxHeight: 100
        },
        inputKeywords: [
            'captcha', 'verify', 'code', 'vcode',
            'checkcode', 'seccode', 'authcode', 'validcode',
            'yzm', 'yanzhengma', '验证码'
        ]
    };

    class CaptchaDetector {
        constructor() {
            this.detectedCaptchas = [];
        }

        scan() {
            logger.debug('开始扫描页面验证码');
            this.detectedCaptchas = [];
            this.scanImages();
            this.scanCanvas();
            this.scanSvg();
            logger.info(`扫描完成，找到 ${this.detectedCaptchas.length} 个可能的验证码`);
            return this.detectedCaptchas;
        }

        scanImages() {
            const images = document.querySelectorAll('img');
            images.forEach((img, index) => {
                if (this.isLikelyCaptcha(img)) {
                    this.detectedCaptchas.push({
                        type: 'image',
                        element: img,
                        src: img.src,
                        rect: img.getBoundingClientRect(),
                        confidence: this.calculateConfidence(img),
                        inputElement: this.findRelatedInput(img),
                        id: `captcha-${index}`
                    });
                }
            });
        }

        scanCanvas() {
            const canvases = document.querySelectorAll('canvas');
            canvases.forEach((canvas, index) => {
                if (this.isLikelyCanvasCaptcha(canvas)) {
                    this.detectedCaptchas.push({
                        type: 'canvas',
                        element: canvas,
                        rect: canvas.getBoundingClientRect(),
                        confidence: this.calculateConfidence(canvas),
                        inputElement: this.findRelatedInput(canvas),
                        id: `captcha-canvas-${index}`
                    });
                }
            });
        }

        scanSvg() {
            const svgs = document.querySelectorAll('svg');
            svgs.forEach((svg, index) => {
                if (this.isLikelySvgCaptcha(svg)) {
                    this.detectedCaptchas.push({
                        type: 'svg',
                        element: svg,
                        rect: svg.getBoundingClientRect(),
                        confidence: this.calculateConfidence(svg),
                        inputElement: this.findRelatedInput(svg),
                        id: `captcha-svg-${index}`
                    });
                }
            });
        }

        isLikelyCaptcha(img) {
            const rect = img.getBoundingClientRect();
            if (!this.isCaptchaSize(rect.width, rect.height)) return false;
            if (!this.isVisible(img)) return false;
            if (this.matchesKeywords(img)) return true;
            if (this.srcContainsKeywords(img.src)) return true;
            if (this.matchesKeywordsInText(img.alt)) return true;
            if (this.parentContainsKeywords(img)) return true;
            if (this.hasNearbyInput(img)) return true;
            return false;
        }

        isLikelyCanvasCaptcha(canvas) {
            const rect = canvas.getBoundingClientRect();
            if (!this.isCaptchaSize(rect.width, rect.height)) return false;
            if (!this.isVisible(canvas)) return false;
            if (this.matchesKeywords(canvas)) return true;
            if (this.parentContainsKeywords(canvas)) return true;
            if (this.hasNearbyInput(canvas)) return true;
            return false;
        }

        isLikelySvgCaptcha(svg) {
            const rect = svg.getBoundingClientRect();
            if (!this.isCaptchaSize(rect.width, rect.height)) return false;
            if (!this.isVisible(svg)) return false;
            if (this.matchesKeywords(svg)) return true;
            if (this.parentContainsKeywords(svg)) return true;
            if (this.hasNearbyInput(svg)) return true;
            return false;
        }

        isCaptchaSize(width, height) {
            const { minWidth, maxWidth, minHeight, maxHeight } = CAPTCHA_PATTERNS.sizeRange;
            return width >= minWidth && width <= maxWidth && height >= minHeight && height <= maxHeight;
        }

        isVisible(element) {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' &&
                style.opacity !== '0' && rect.width > 0 && rect.height > 0;
        }

        matchesKeywords(element) {
            const className = (element.className || '').toString().toLowerCase();
            const id = (element.id || '').toLowerCase();
            return CAPTCHA_PATTERNS.classKeywords.some(k => className.includes(k)) ||
                CAPTCHA_PATTERNS.idKeywords.some(k => id.includes(k));
        }

        matchesKeywordsInText(text) {
            if (!text) return false;
            const lowerText = text.toLowerCase();
            return CAPTCHA_PATTERNS.classKeywords.some(k => lowerText.includes(k));
        }

        srcContainsKeywords(src) {
            if (!src) return false;
            const lowerSrc = src.toLowerCase();
            return CAPTCHA_PATTERNS.classKeywords.some(k => lowerSrc.includes(k));
        }

        parentContainsKeywords(element) {
            let parent = element.parentElement;
            let depth = 0;
            while (parent && depth < 3) {
                if (this.matchesKeywords(parent)) return true;
                parent = parent.parentElement;
                depth++;
            }
            return false;
        }

        hasNearbyInput(element) {
            return this.findRelatedInput(element) !== null;
        }

        findRelatedInput(element) {
            let parent = element.parentElement;
            let depth = 0;
            while (parent && depth < 5) {
                const input = this.findCaptchaInput(parent);
                if (input) return input;
                parent = parent.parentElement;
                depth++;
            }

            const rect = element.getBoundingClientRect();
            const inputs = document.querySelectorAll('input[type="text"], input:not([type])');

            for (const input of inputs) {
                const inputRect = input.getBoundingClientRect();
                if (inputRect.left > rect.right && inputRect.left - rect.right < 150 &&
                    Math.abs(inputRect.top - rect.top) < 50) {
                    return input;
                }
                if (inputRect.top > rect.bottom && inputRect.top - rect.bottom < 100 &&
                    Math.abs(inputRect.left - rect.left) < 100) {
                    return input;
                }
            }

            return null;
        }

        findCaptchaInput(container) {
            const inputs = container.querySelectorAll('input[type="text"], input:not([type])');
            for (const input of inputs) {
                if (this.isCaptchaInputByName(input)) return input;
            }
            return null;
        }

        isCaptchaInputByName(input) {
            const name = (input.name || '').toLowerCase();
            const id = (input.id || '').toLowerCase();
            const placeholder = (input.placeholder || '').toLowerCase();
            const className = (input.className || '').toString().toLowerCase();
            return CAPTCHA_PATTERNS.inputKeywords.some(k =>
                name.includes(k) || id.includes(k) || placeholder.includes(k) || className.includes(k)
            );
        }

        calculateConfidence(element) {
            let score = 0;
            if (this.matchesKeywords(element)) score += 30;
            if (element.src && this.srcContainsKeywords(element.src)) score += 20;
            if (this.parentContainsKeywords(element)) score += 15;
            if (this.findRelatedInput(element)) score += 25;
            const rect = element.getBoundingClientRect();
            if (this.isCaptchaSize(rect.width, rect.height)) score += 10;
            return Math.min(score, 100);
        }

        async captureImage(captchaInfo) {
            switch (captchaInfo.type) {
                case 'image':
                    return this.captureImgElement(captchaInfo.element);
                case 'canvas':
                    return this.captureCanvasElement(captchaInfo.element);
                case 'svg':
                    return this.captureSvgElement(captchaInfo.element);
                default:
                    throw new Error(`不支持的验证码类型: ${captchaInfo.type}`);
            }
        }

        async captureImgElement(img) {
            // 首先确保图片已完全加载
            await this.waitForImageLoad(img);

            return new Promise((resolve, reject) => {
                try {
                    // 方法1：直接从页面上已渲染的img元素绘制到canvas
                    // 这样不会重新请求URL，避免验证码刷新
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // 使用图片的实际渲染尺寸或原始尺寸
                    const width = img.naturalWidth || img.width;
                    const height = img.naturalHeight || img.height;

                    if (width === 0 || height === 0) {
                        reject(new Error('图片尺寸为0，可能未加载完成'));
                        return;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // 直接绘制页面上的img元素
                    ctx.drawImage(img, 0, 0, width, height);

                    try {
                        const dataUrl = canvas.toDataURL('image/png');

                        // 检查是否成功获取了图像数据
                        if (dataUrl === 'data:,') {
                            throw new Error('获取到空白图像');
                        }

                        logger.info('直接从页面img元素捕获成功', { width, height });
                        resolve(dataUrl);
                    } catch (securityError) {
                        // 如果因为跨域安全策略无法直接绘制，尝试备用方案
                        logger.warn('直接绘制失败，尝试备用方案', securityError.message);

                        // 备用方案：如果src是data URL，直接使用
                        if (img.src.startsWith('data:')) {
                            logger.info('使用data URL');
                            resolve(img.src);
                            return;
                        }

                        // 备用方案2：尝试使用html2canvas方式截取元素
                        this.captureElementAsScreenshot(img)
                            .then(resolve)
                            .catch(() => {
                                reject(new Error('无法捕获跨域图片，请尝试手动截图'));
                            });
                    }
                } catch (error) {
                    logger.error('图片捕获失败', error);
                    reject(error);
                }
            });
        }

        /**
         * 等待图片加载完成
         */
        async waitForImageLoad(img) {
            // 如果图片已经加载完成
            if (img.complete && img.naturalWidth > 0) {
                return Promise.resolve();
            }

            // 如果是data URL，直接返回
            if (img.src && img.src.startsWith('data:')) {
                return Promise.resolve();
            }

            logger.info('等待图片加载完成...');

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('图片加载超时'));
                }, 5000);

                img.onload = () => {
                    clearTimeout(timeout);
                    logger.info('图片加载完成');
                    resolve();
                };

                img.onerror = () => {
                    clearTimeout(timeout);
                    reject(new Error('图片加载失败'));
                };

                // 如果图片已经在加载过程中完成了
                if (img.complete && img.naturalWidth > 0) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        }

        /**
         * 使用屏幕截图方式捕获元素（备用方案）
         */
        async captureElementAsScreenshot(element) {
            return new Promise((resolve, reject) => {
                try {
                    const rect = element.getBoundingClientRect();
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // 使用元素的显示尺寸
                    canvas.width = rect.width;
                    canvas.height = rect.height;

                    // 尝试直接绘制
                    ctx.drawImage(element, 0, 0, rect.width, rect.height);

                    const dataUrl = canvas.toDataURL('image/png');
                    if (dataUrl && dataUrl !== 'data:,') {
                        resolve(dataUrl);
                    } else {
                        reject(new Error('截图失败'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        }

        async captureCanvasElement(canvas) {
            return canvas.toDataURL('image/png');
        }

        async captureSvgElement(svg) {
            return new Promise((resolve, reject) => {
                try {
                    const clonedSvg = svg.cloneNode(true);
                    const rect = svg.getBoundingClientRect();
                    clonedSvg.setAttribute('width', rect.width);
                    clonedSvg.setAttribute('height', rect.height);

                    const serializer = new XMLSerializer();
                    const svgString = serializer.serializeToString(clonedSvg);
                    const blob = new Blob([svgString], { type: 'image/svg+xml' });
                    const url = URL.createObjectURL(blob);

                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = rect.width;
                        canvas.height = rect.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        URL.revokeObjectURL(url);
                        resolve(canvas.toDataURL('image/png'));
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(url);
                        reject(new Error('SVG转换失败'));
                    };
                    img.src = url;
                } catch (error) {
                    reject(error);
                }
            });
        }

        highlight(captchaInfo) {
            if (captchaInfo && captchaInfo.element) {
                captchaInfo.element.style.outline = '3px solid #4CAF50';
                captchaInfo.element.style.outlineOffset = '2px';
            }
        }

        unhighlight(captchaInfo) {
            if (captchaInfo && captchaInfo.element) {
                captchaInfo.element.style.outline = '';
                captchaInfo.element.style.outlineOffset = '';
            }
        }

        getDetectedCaptchas() {
            return this.detectedCaptchas;
        }

        getMostLikelyCaptcha() {
            if (this.detectedCaptchas.length === 0) return null;
            return this.detectedCaptchas.reduce((best, current) =>
                current.confidence > best.confidence ? current : best
            );
        }
    }

    // ==================== 自动填充 ====================
    class AutoFill {
        constructor() {
            this.lastFilledInput = null;
        }

        async fill(inputElement, text, options = {}) {
            const { simulate = true } = options;

            try {
                if (!inputElement) throw new Error('未找到输入框');

                inputElement.focus();
                inputElement.value = '';
                this.dispatchEvent(inputElement, 'input');

                if (simulate) {
                    await this.simulateTyping(inputElement, text);
                } else {
                    inputElement.value = text;
                    this.dispatchEvent(inputElement, 'input');
                    this.dispatchEvent(inputElement, 'change');
                }

                this.lastFilledInput = inputElement;
                this.highlightInput(inputElement);

                return true;
            } catch (error) {
                logger.error('填充失败', error);
                return false;
            }
        }

        async simulateTyping(input, text) {
            for (const char of text) {
                this.dispatchKeyEvent(input, 'keydown', char);
                input.value += char;
                this.dispatchEvent(input, 'input');
                this.dispatchKeyEvent(input, 'keyup', char);
                await this.delay(50 + Math.random() * 100);
            }
            this.dispatchEvent(input, 'change');
            this.dispatchEvent(input, 'blur');
        }

        dispatchEvent(element, eventType) {
            element.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
        }

        dispatchKeyEvent(element, eventType, key) {
            element.dispatchEvent(new KeyboardEvent(eventType, {
                key, code: `Key${key.toUpperCase()}`,
                charCode: key.charCodeAt(0), keyCode: key.charCodeAt(0),
                bubbles: true, cancelable: true
            }));
        }

        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        highlightInput(input) {
            const originalBorder = input.style.border;
            const originalBoxShadow = input.style.boxShadow;
            input.style.border = '2px solid #4CAF50';
            input.style.boxShadow = '0 0 8px rgba(76, 175, 80, 0.5)';
            setTimeout(() => {
                input.style.border = originalBorder;
                input.style.boxShadow = originalBoxShadow;
            }, 2000);
        }
    }

    // ==================== 主入口 ====================
    const detector = new CaptchaDetector();
    const autoFill = new AutoFill();
    let currentCaptcha = null;
    let isProcessing = false;

    function init() {
        logger.info('内容脚本已加载');
        chrome.runtime.onMessage.addListener(handleMessage);
        setTimeout(() => scanPage(), 1000);
    }

    function handleMessage(message, sender, sendResponse) {
        logger.debug('收到消息:', message.action);

        switch (message.action) {
            case 'scan':
                handleScan(sendResponse);
                return true;
            case 'recognize':
                handleRecognize(message.captchaId, sendResponse);
                return true;
            case 'fill':
                handleFill(message.text, message.options, sendResponse);
                return true;
            case 'getStatus':
                handleGetStatus(sendResponse);
                return true;
            case 'highlight':
                handleHighlight(message.captchaId, sendResponse);
                return true;
            case 'previewCaptcha':
                handlePreviewCaptcha(message.captchaId, sendResponse);
                return true;
            case 'startPicker':
                handleStartPicker(sendResponse);
                return true;
            case 'applySiteRule':
                handleApplySiteRule(message.selector, sendResponse);
                return true;
            default:
                sendResponse({ success: false, error: '未知操作' });
        }
        return false;
    }

    function handleScan(sendResponse) {
        try {
            const captchas = detector.scan();
            const simplifiedCaptchas = captchas.map(c => ({
                id: c.id, type: c.type, confidence: c.confidence,
                rect: c.rect, hasInput: !!c.inputElement
            }));
            currentCaptcha = detector.getMostLikelyCaptcha();
            sendResponse({
                success: true,
                captchas: simplifiedCaptchas,
                bestCaptcha: currentCaptcha ? {
                    id: currentCaptcha.id, type: currentCaptcha.type, confidence: currentCaptcha.confidence
                } : null
            });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    async function handleRecognize(captchaId, sendResponse) {
        if (isProcessing) {
            sendResponse({ success: false, error: '正在处理中' });
            return;
        }

        isProcessing = true;

        try {
            const captchas = detector.getDetectedCaptchas();
            const captcha = captchaId
                ? captchas.find(c => c.id === captchaId)
                : detector.getMostLikelyCaptcha();

            if (!captcha) throw new Error('未找到验证码');

            // 检查元素是否仍然存在于DOM中
            if (!document.body.contains(captcha.element)) {
                throw new Error('验证码元素已不存在，请重新扫描');
            }

            currentCaptcha = captcha;
            detector.highlight(captcha);

            // 等待一小段时间确保DOM完全渲染
            await new Promise(resolve => setTimeout(resolve, 100));

            logger.info('开始捕获验证码图像...', { type: captcha.type, id: captcha.id });

            // 确保元素可见
            const rect = captcha.element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                throw new Error('验证码元素不可见');
            }

            const imageData = await detector.captureImage(captcha);

            // 验证图像数据有效性
            if (!imageData || imageData.length < 100) {
                throw new Error('图像数据无效，请重试');
            }

            // 调试输出：显示图像数据信息
            logger.info('图像捕获完成', {
                dataLength: imageData.length,
                prefix: imageData.substring(0, 50) + '...',
                isBase64: imageData.startsWith('data:image')
            });

            // 在控制台输出图像预览（可以在浏览器控制台查看）
            console.log('%c[AI Captcha] 捕获的验证码图像预览：', 'color: #4CAF50; font-weight: bold');
            console.log('%c ', `
                background: url(${imageData}) no-repeat;
                background-size: contain;
                padding: 50px 100px;
                border: 2px solid #4CAF50;
            `);

            const response = await chrome.runtime.sendMessage({
                action: 'recognizeCaptcha',
                imageData: imageData
            });

            detector.unhighlight(captcha);

            if (response.success) {
                sendResponse({
                    success: true, text: response.text,
                    elapsed: response.elapsed, captchaId: captcha.id
                });
            } else {
                sendResponse({ success: false, error: response.error });
            }
        } catch (error) {
            logger.error('识别失败', error);
            if (currentCaptcha) {
                detector.unhighlight(currentCaptcha);
            }
            sendResponse({ success: false, error: error.message });
        } finally {
            isProcessing = false;
        }
    }

    async function handleFill(text, options, sendResponse) {
        try {
            if (!currentCaptcha) throw new Error('未检测到验证码');
            if (!currentCaptcha.inputElement) throw new Error('未找到验证码输入框');
            const success = await autoFill.fill(currentCaptcha.inputElement, text, options);
            sendResponse({ success });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    function handleGetStatus(sendResponse) {
        const captchas = detector.getDetectedCaptchas();
        sendResponse({
            success: true, isProcessing,
            captchaCount: captchas.length, hasCaptcha: captchas.length > 0,
            currentCaptcha: currentCaptcha ? {
                id: currentCaptcha.id, type: currentCaptcha.type, confidence: currentCaptcha.confidence
            } : null
        });
    }

    function handleHighlight(captchaId, sendResponse) {
        const captchas = detector.getDetectedCaptchas();
        const captcha = captchas.find(c => c.id === captchaId);
        if (captcha) {
            detector.highlight(captcha);
            setTimeout(() => detector.unhighlight(captcha), 2000);
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: '未找到验证码' });
        }
    }

    function scanPage() {
        const captchas = detector.scan();
        if (captchas.length > 0) {
            chrome.runtime.sendMessage({
                action: 'captchaDetected',
                count: captchas.length,
                bestConfidence: detector.getMostLikelyCaptcha()?.confidence || 0
            }).catch(() => { });
        }
    }

    // ==================== 调试功能 ====================

    /**
     * 处理验证码预览请求（调试用）
     */
    async function handlePreviewCaptcha(captchaId, sendResponse) {
        try {
            const captchas = detector.getDetectedCaptchas();
            const captcha = captchaId
                ? captchas.find(c => c.id === captchaId)
                : detector.getMostLikelyCaptcha();

            if (!captcha) throw new Error('未找到验证码');

            const imageData = await detector.captureImage(captcha);

            // 在页面上显示预览弹窗
            showCaptchaPreview(imageData, captcha);

            sendResponse({
                success: true,
                imageData: imageData,
                captchaInfo: {
                    id: captcha.id,
                    type: captcha.type,
                    confidence: captcha.confidence
                }
            });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * 在页面上显示验证码预览弹窗
     */
    function showCaptchaPreview(imageData, captchaInfo) {
        // 移除已有的预览
        const existing = document.getElementById('captcha-debug-preview');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'captcha-debug-preview';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #1a1a2e;
            padding: 24px;
            border-radius: 16px;
            max-width: 500px;
            color: white;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: #6366f1;">🔍 验证码捕获调试</h3>
            <div style="margin-bottom: 16px;">
                <p style="margin: 0 0 8px 0; color: #a1a1aa; font-size: 14px;">以下是发送给AI的图像：</p>
                <div style="background: #252540; padding: 16px; border-radius: 8px; text-align: center;">
                    <img src="${imageData}" style="max-width: 100%; border: 2px solid #4CAF50; border-radius: 4px;" />
                </div>
            </div>
            <div style="background: #252540; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;">
                <div style="margin-bottom: 6px;"><strong>类型:</strong> ${captchaInfo.type}</div>
                <div style="margin-bottom: 6px;"><strong>置信度:</strong> ${captchaInfo.confidence}%</div>
                <div style="margin-bottom: 6px;"><strong>数据长度:</strong> ${imageData.length} 字符</div>
                <div><strong>格式:</strong> ${imageData.substring(5, 30)}...</div>
            </div>
            <div style="display: flex; gap: 12px;">
                <button id="debug-copy-base64" style="
                    flex: 1;
                    padding: 10px;
                    background: #6366f1;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                ">复制Base64</button>
                <button id="debug-download" style="
                    flex: 1;
                    padding: 10px;
                    background: #10b981;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                ">下载图片</button>
                <button id="debug-close" style="
                    flex: 1;
                    padding: 10px;
                    background: #3f3f46;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                ">关闭</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // 绑定事件
        document.getElementById('debug-copy-base64').onclick = async () => {
            try {
                await navigator.clipboard.writeText(imageData);
                alert('Base64已复制到剪贴板！\n\n您可以将其粘贴到AI对话中测试。');
            } catch (e) {
                // 备用方案
                const textarea = document.createElement('textarea');
                textarea.value = imageData;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                textarea.remove();
                alert('Base64已复制！');
            }
        };

        document.getElementById('debug-download').onclick = () => {
            const link = document.createElement('a');
            link.href = imageData;
            link.download = `captcha-debug-${Date.now()}.png`;
            link.click();
        };

        document.getElementById('debug-close').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    }

    // ==================== 手动选择功能 ====================

    /**
     * 启动元素选择器
     */
    function handleStartPicker(sendResponse) {
        // 创建选择器
        initElementPicker(async (result) => {
            if (result.cancelled) {
                sendResponse({ success: false, cancelled: true });
            } else if (result.success) {
                // 将选择的元素设置为当前验证码
                const element = result.element;
                const rect = element.getBoundingClientRect();

                currentCaptcha = {
                    type: element.tagName.toLowerCase() === 'img' ? 'image' :
                        element.tagName.toLowerCase() === 'canvas' ? 'canvas' : 'svg',
                    element: element,
                    src: element.src || null,
                    rect: rect,
                    confidence: 100,
                    inputElement: detector.findRelatedInput(element),
                    id: 'manual-selected',
                    selector: result.selector
                };

                detector.detectedCaptchas = [currentCaptcha];

                // 直接保存网站规则到storage（通过Service Worker）
                try {
                    await chrome.runtime.sendMessage({
                        action: 'saveSiteRule',
                        hostname: location.hostname,
                        rule: {
                            selector: result.selector,
                            info: result.info
                        }
                    });
                    logger.info('网站规则已保存', { hostname: location.hostname, selector: result.selector });

                    // 显示成功提示
                    showSaveSuccessToast(result.selector);
                } catch (error) {
                    logger.error('保存规则失败', error);
                }

                sendResponse({
                    success: true,
                    selector: result.selector,
                    info: result.info,
                    hostname: location.hostname
                });
            }
        });

        return true; // 保持消息通道开放
    }

    /**
     * 显示保存成功的提示
     */
    function showSaveSuccessToast(selector) {
        // 移除已有的提示
        const existing = document.getElementById('captcha-save-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'captcha-save-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 14px 24px;
            border-radius: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            z-index: 999999;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideDown 0.3s ease;
        `;

        toast.innerHTML = `
            <span style="font-size: 18px;">✅</span>
            <span>验证码规则已保存！下次访问将自动识别</span>
        `;

        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideDown {
                from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(toast);

        // 3秒后自动消失
        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s ease';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * 应用网站规则选择元素
     */
    async function handleApplySiteRule(selector, sendResponse) {
        try {
            const element = document.querySelector(selector);

            if (!element) {
                sendResponse({ success: false, error: '未找到匹配元素' });
                return;
            }

            // 如果是图片元素，等待加载完成
            if (element.tagName === 'IMG') {
                await waitForElementLoad(element);
            }

            const rect = element.getBoundingClientRect();

            // 确保元素可见
            if (rect.width === 0 || rect.height === 0) {
                sendResponse({ success: false, error: '元素不可见' });
                return;
            }

            currentCaptcha = {
                type: element.tagName.toLowerCase() === 'img' ? 'image' :
                    element.tagName.toLowerCase() === 'canvas' ? 'canvas' : 'svg',
                element: element,
                src: element.src || null,
                rect: rect,
                confidence: 100,
                inputElement: detector.findRelatedInput(element),
                id: 'rule-selected',
                selector: selector
            };

            detector.detectedCaptchas = [currentCaptcha];
            detector.highlight(currentCaptcha);

            setTimeout(() => detector.unhighlight(currentCaptcha), 2000);

            sendResponse({
                success: true,
                captcha: {
                    id: currentCaptcha.id,
                    type: currentCaptcha.type,
                    confidence: 100
                }
            });
        } catch (error) {
            logger.error('应用规则失败', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * 等待元素加载完成
     */
    async function waitForElementLoad(element) {
        // 如果是图片元素
        if (element.tagName === 'IMG') {
            // 已经加载完成
            if (element.complete && element.naturalWidth > 0) {
                return;
            }

            // data URL 不需要等待
            if (element.src && element.src.startsWith('data:')) {
                return;
            }

            logger.info('等待验证码图片加载...');

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    // 超时了但图片可能已经加载，检查一下
                    if (element.complete && element.naturalWidth > 0) {
                        resolve();
                    } else {
                        reject(new Error('图片加载超时'));
                    }
                }, 5000);

                const checkComplete = () => {
                    if (element.complete && element.naturalWidth > 0) {
                        clearTimeout(timeout);
                        logger.info('验证码图片加载完成');
                        resolve();
                    }
                };

                element.addEventListener('load', () => {
                    clearTimeout(timeout);
                    logger.info('验证码图片加载完成');
                    resolve();
                }, { once: true });

                element.addEventListener('error', () => {
                    clearTimeout(timeout);
                    reject(new Error('图片加载失败'));
                }, { once: true });

                // 立即检查一次
                checkComplete();

                // 定期检查（有些情况下load事件可能不触发）
                const interval = setInterval(() => {
                    if (element.complete && element.naturalWidth > 0) {
                        clearInterval(interval);
                        clearTimeout(timeout);
                        resolve();
                    }
                }, 100);

                // 5秒后停止检查
                setTimeout(() => clearInterval(interval), 5000);
            });
        }
    }

    /**
     * 初始化元素选择器
     */
    function initElementPicker(callback) {
        // 选择器状态
        let isActive = true;
        let hoveredElement = null;
        let overlay = null;
        let tooltip = null;

        // 创建高亮覆盖层
        overlay = document.createElement('div');
        overlay.id = 'captcha-picker-overlay';
        overlay.style.cssText = `
            position: fixed;
            pointer-events: none;
            border: 3px solid #6366f1;
            background: rgba(99, 102, 241, 0.15);
            z-index: 999998;
            transition: all 0.1s ease;
            display: none;
            border-radius: 4px;
        `;
        document.body.appendChild(overlay);

        // 创建提示
        tooltip = document.createElement('div');
        tooltip.id = 'captcha-picker-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            color: white;
            padding: 12px 24px;
            border-radius: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            z-index: 999999;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            gap: 16px;
            border: 1px solid #6366f1;
        `;

        tooltip.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">🎯</span>
                <span>点击选择验证码元素</span>
            </div>
            <div id="picker-element-info" style="color: #a1a1aa; font-size: 12px;"></div>
            <button id="picker-cancel-btn" style="
                background: #ef4444;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
            ">取消 (ESC)</button>
        `;

        document.body.appendChild(tooltip);

        // 清理函数
        function cleanup() {
            isActive = false;
            document.removeEventListener('mousemove', handleMouseMove, true);
            document.removeEventListener('click', handleClick, true);
            document.removeEventListener('keydown', handleKeyDown, true);
            if (overlay) overlay.remove();
            if (tooltip) tooltip.remove();
        }

        // 鼠标移动
        function handleMouseMove(e) {
            if (!isActive) return;

            const element = document.elementFromPoint(e.clientX, e.clientY);

            if (!element || element.id === 'captcha-picker-overlay' ||
                element.id === 'captcha-picker-tooltip' ||
                element.closest('#captcha-picker-tooltip')) {
                return;
            }

            // 查找可选择的元素
            let target = null;
            if (['IMG', 'CANVAS', 'SVG'].includes(element.tagName)) {
                target = element;
            } else {
                target = element.querySelector('img, canvas, svg') ||
                    element.closest('img, canvas, svg');
            }

            if (target) {
                hoveredElement = target;
                const rect = target.getBoundingClientRect();
                overlay.style.display = 'block';
                overlay.style.top = rect.top + 'px';
                overlay.style.left = rect.left + 'px';
                overlay.style.width = rect.width + 'px';
                overlay.style.height = rect.height + 'px';

                // 更新提示
                const infoEl = document.getElementById('picker-element-info');
                if (infoEl) {
                    let info = `${target.tagName.toLowerCase()}`;
                    if (target.id) info += `#${target.id}`;
                    else if (target.className) {
                        const cls = target.className.toString().split(' ').slice(0, 2).join('.');
                        if (cls) info += `.${cls}`;
                    }
                    info += ` (${Math.round(rect.width)}×${Math.round(rect.height)})`;
                    infoEl.textContent = info;
                }
            } else {
                overlay.style.display = 'none';
                hoveredElement = null;
            }
        }

        // 点击选择
        function handleClick(e) {
            if (!isActive) return;

            e.preventDefault();
            e.stopPropagation();

            if (hoveredElement) {
                const selector = generateSelector(hoveredElement);
                const rect = hoveredElement.getBoundingClientRect();

                cleanup();

                callback({
                    success: true,
                    element: hoveredElement,
                    selector: selector,
                    info: {
                        tagName: hoveredElement.tagName.toLowerCase(),
                        id: hoveredElement.id || null,
                        className: hoveredElement.className ? hoveredElement.className.toString() : null,
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                    }
                });
            }
        }

        // 键盘事件
        function handleKeyDown(e) {
            if (!isActive) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                cleanup();
                callback({ cancelled: true });
            }
        }

        // 生成选择器
        function generateSelector(element) {
            if (element.id) return `#${element.id}`;

            if (element.className) {
                const classes = element.className.toString().trim().split(/\s+/)
                    .filter(c => c && !c.includes(':'));
                if (classes.length > 0) {
                    const selector = `${element.tagName.toLowerCase()}.${classes.join('.')}`;
                    if (document.querySelectorAll(selector).length === 1) {
                        return selector;
                    }
                }
            }

            // 使用路径
            const path = [];
            let current = element;

            while (current && current !== document.body && path.length < 5) {
                let sel = current.tagName.toLowerCase();

                if (current.id) {
                    path.unshift(`#${current.id}`);
                    break;
                }

                const parent = current.parentElement;
                if (parent) {
                    const siblings = Array.from(parent.children)
                        .filter(c => c.tagName === current.tagName);
                    if (siblings.length > 1) {
                        sel += `:nth-of-type(${siblings.indexOf(current) + 1})`;
                    }
                }

                path.unshift(sel);
                current = current.parentElement;
            }

            return path.join(' > ');
        }

        // 取消按钮
        document.getElementById('picker-cancel-btn').addEventListener('click', () => {
            cleanup();
            callback({ cancelled: true });
        });

        // 添加事件监听
        document.addEventListener('mousemove', handleMouseMove, true);
        document.addEventListener('click', handleClick, true);
        document.addEventListener('keydown', handleKeyDown, true);

        logger.info('元素选择器已启动');
    }

    init();
})();

