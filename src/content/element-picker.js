/**
 * 元素选择器 - 类似DevTools的元素拾取功能
 * 允许用户在页面上选择验证码元素
 */

(function () {
    'use strict';

    // 调试模式（从父上下文继承，如果存在的话）
    const debugMode = window.__captchaDebugMode || false;
    const log = (msg) => { if (debugMode) console.log('[AI Captcha]', msg); };

    // 选择器状态
    let isActive = false;
    let hoveredElement = null;
    let overlay = null;
    let tooltip = null;
    let onSelectCallback = null;

    /**
     * 启动元素选择器
     * @param {Function} callback - 选择完成后的回调函数
     */
    function startPicker(callback) {
        if (isActive) return;

        isActive = true;
        onSelectCallback = callback;

        createOverlay();
        createTooltip();
        addEventListeners();

        log('元素选择器已启动，请点击验证码元素');
    }

    /**
     * 停止元素选择器
     */
    function stopPicker() {
        if (!isActive) return;

        isActive = false;
        onSelectCallback = null;

        removeEventListeners();
        removeOverlay();
        removeTooltip();
        clearHighlight();

        log('元素选择器已停止');
    }

    /**
     * 创建高亮覆盖层
     */
    function createOverlay() {
        overlay = document.createElement('div');
        overlay.id = 'captcha-picker-overlay';
        overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 2px solid #6366f1;
      background: rgba(99, 102, 241, 0.1);
      z-index: 999998;
      transition: all 0.1s ease;
      display: none;
    `;
        document.body.appendChild(overlay);
    }

    /**
     * 创建提示工具栏
     */
    function createTooltip() {
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
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

        document.getElementById('picker-cancel-btn').addEventListener('click', () => {
            stopPicker();
            if (onSelectCallback) {
                onSelectCallback({ cancelled: true });
            }
        });
    }

    /**
     * 移除覆盖层
     */
    function removeOverlay() {
        if (overlay) {
            overlay.remove();
            overlay = null;
        }
    }

    /**
     * 移除提示
     */
    function removeTooltip() {
        if (tooltip) {
            tooltip.remove();
            tooltip = null;
        }
    }

    /**
     * 添加事件监听
     */
    function addEventListeners() {
        document.addEventListener('mousemove', handleMouseMove, true);
        document.addEventListener('click', handleClick, true);
        document.addEventListener('keydown', handleKeyDown, true);
    }

    /**
     * 移除事件监听
     */
    function removeEventListeners() {
        document.removeEventListener('mousemove', handleMouseMove, true);
        document.removeEventListener('click', handleClick, true);
        document.removeEventListener('keydown', handleKeyDown, true);
    }

    /**
     * 处理鼠标移动
     */
    function handleMouseMove(e) {
        if (!isActive) return;

        const element = document.elementFromPoint(e.clientX, e.clientY);

        // 忽略我们自己创建的元素
        if (!element || element.id === 'captcha-picker-overlay' ||
            element.id === 'captcha-picker-tooltip' ||
            element.closest('#captcha-picker-tooltip')) {
            return;
        }

        // 只高亮图片、canvas或svg元素
        if (isSelectableElement(element)) {
            hoveredElement = element;
            highlightElement(element);
            updateTooltipInfo(element);
        } else {
            // 尝试找到最近的可选择父/子元素
            const selectableChild = element.querySelector('img, canvas, svg');
            const selectableParent = element.closest('img, canvas, svg');
            const target = selectableChild || selectableParent;

            if (target) {
                hoveredElement = target;
                highlightElement(target);
                updateTooltipInfo(target);
            } else {
                clearHighlight();
                hoveredElement = null;
            }
        }
    }

    /**
     * 处理点击
     */
    function handleClick(e) {
        if (!isActive) return;

        e.preventDefault();
        e.stopPropagation();

        if (hoveredElement) {
            const elementInfo = getElementInfo(hoveredElement);
            const selector = generateSelector(hoveredElement);

            stopPicker();

            if (onSelectCallback) {
                onSelectCallback({
                    success: true,
                    element: hoveredElement,
                    selector: selector,
                    info: elementInfo
                });
            }
        }
    }

    /**
     * 处理键盘事件
     */
    function handleKeyDown(e) {
        if (!isActive) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            stopPicker();
            if (onSelectCallback) {
                onSelectCallback({ cancelled: true });
            }
        }
    }

    /**
     * 检查元素是否可选择
     */
    function isSelectableElement(element) {
        return element.tagName === 'IMG' ||
            element.tagName === 'CANVAS' ||
            element.tagName === 'SVG';
    }

    /**
     * 高亮元素
     */
    function highlightElement(element) {
        if (!overlay) return;

        const rect = element.getBoundingClientRect();

        overlay.style.display = 'block';
        overlay.style.top = rect.top + 'px';
        overlay.style.left = rect.left + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
    }

    /**
     * 清除高亮
     */
    function clearHighlight() {
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * 更新提示信息
     */
    function updateTooltipInfo(element) {
        const infoEl = document.getElementById('picker-element-info');
        if (!infoEl) return;

        const rect = element.getBoundingClientRect();
        let info = `${element.tagName.toLowerCase()}`;

        if (element.id) {
            info += `#${element.id}`;
        } else if (element.className) {
            const classes = element.className.toString().split(' ').slice(0, 2).join('.');
            if (classes) info += `.${classes}`;
        }

        info += ` (${Math.round(rect.width)}×${Math.round(rect.height)})`;

        infoEl.textContent = info;
    }

    /**
     * 获取元素信息
     */
    function getElementInfo(element) {
        const rect = element.getBoundingClientRect();

        return {
            tagName: element.tagName.toLowerCase(),
            id: element.id || null,
            className: element.className ? element.className.toString() : null,
            src: element.src || null,
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
    }

    /**
     * 生成选择器
     * 尽量生成稳定、唯一的CSS选择器
     */
    function generateSelector(element) {
        // 优先使用ID
        if (element.id) {
            return `#${element.id}`;
        }

        // 尝试使用类名组合
        if (element.className) {
            const classes = element.className.toString().trim().split(/\s+/);
            const validClasses = classes.filter(c => c && !c.includes(':'));

            if (validClasses.length > 0) {
                const selector = `${element.tagName.toLowerCase()}.${validClasses.join('.')}`;

                // 验证选择器是否唯一
                if (document.querySelectorAll(selector).length === 1) {
                    return selector;
                }
            }
        }

        // 尝试使用属性
        if (element.src) {
            // 从src中提取关键部分
            const srcPath = new URL(element.src, location.href).pathname;
            const srcMatch = srcPath.match(/\/([^\/]+?)(\.|\?|$)/);
            if (srcMatch) {
                const selector = `${element.tagName.toLowerCase()}[src*="${srcMatch[1]}"]`;
                if (document.querySelectorAll(selector).length === 1) {
                    return selector;
                }
            }
        }

        // 使用父元素路径
        const path = [];
        let current = element;

        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();

            if (current.id) {
                path.unshift(`#${current.id}`);
                break;
            }

            if (current.className) {
                const classes = current.className.toString().trim().split(/\s+/).slice(0, 2);
                if (classes.length > 0 && classes[0]) {
                    selector += '.' + classes.filter(c => c && !c.includes(':')).join('.');
                }
            }

            // 添加nth-child如果有多个同级元素
            const parent = current.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children).filter(
                    c => c.tagName === current.tagName
                );
                if (siblings.length > 1) {
                    const index = siblings.indexOf(current) + 1;
                    selector += `:nth-of-type(${index})`;
                }
            }

            path.unshift(selector);
            current = current.parentElement;

            // 限制深度
            if (path.length > 5) break;
        }

        return path.join(' > ');
    }

    // 暴露API
    window.__captchaPicker = {
        start: startPicker,
        stop: stopPicker,
        isActive: () => isActive
    };
})();
