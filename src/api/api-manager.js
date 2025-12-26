/**
 * API统一管理器
 * 管理多个API配置，协调适配器调用
 */

import * as storage from '../utils/storage.js';
import * as logger from '../utils/logger.js';
import { OpenAICompatibleAdapter } from './openai-compatible.js';
import { GeminiAdapter } from './gemini-adapter.js';
import { ClaudeAdapter } from './claude-adapter.js';

// API类型常量
export const API_TYPES = {
    OPENAI_COMPATIBLE: 'openai_compatible',
    GEMINI: 'gemini',
    CLAUDE: 'claude'
};

// 预设TAPI配置模板
export const PRESET_TEMPLATES = {
    openai: {
        name: 'OpenAI',
        type: API_TYPES.OPENAI_COMPATIBLE,
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        maxTokens: 500,
        temperature: 1
    },
    claude: {
        name: 'Claude',
        type: API_TYPES.CLAUDE,
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 1024
    },
    azure_openai: {
        name: 'Azure OpenAI',
        type: API_TYPES.OPENAI_COMPATIBLE,
        baseUrl: 'https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT',
        model: 'gpt-4o',
        maxTokens: 500,
        temperature: 1,
        customHeaders: {
            'api-key': '' // Azure使用api-key头
        }
    },
    gemini: {
        name: 'Google Gemini',
        type: API_TYPES.GEMINI,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        model: 'gemini-1.5-flash'
    },
    custom_openai: {
        name: '自定义(OpenAI格式)',
        type: API_TYPES.OPENAI_COMPATIBLE,
        baseUrl: '',
        model: '',
        maxTokens: 500,
        temperature: 1
    },
    custom_claude: {
        name: '自定义(Claude格式)',
        type: API_TYPES.CLAUDE,
        baseUrl: '',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 1024
    }
};

// 默认识别Prompt
export const DEFAULT_RECOGNITION_PROMPT = `请识别这张验证码图片中的文字或数字。
要求：
1. 只返回识别出的验证码内容，不要有任何其他文字
2. 如果是数学运算验证码，请计算结果并只返回最终数字
3. 忽略图片中的干扰线条和噪点
4. 如果无法识别，请返回"无法识别"`;

/**
 * API管理器类
 */
export class ApiManager {
    constructor() {
        this.adapters = new Map();
        this.requestQueue = [];
        this.isProcessing = false;
    }

    /**
     * 获取适配器实例
     * @param {object} config - API配置
     * @returns {object} - 适配器实例
     */
    getAdapter(config) {
        const key = config.id || config.type;

        if (!this.adapters.has(key)) {
            let adapter;

            switch (config.type) {
                case API_TYPES.GEMINI:
                    adapter = new GeminiAdapter(config);
                    break;
                case API_TYPES.CLAUDE:
                    adapter = new ClaudeAdapter(config);
                    break;
                case API_TYPES.OPENAI_COMPATIBLE:
                default:
                    adapter = new OpenAICompatibleAdapter(config);
                    break;
            }

            this.adapters.set(key, adapter);
        }

        return this.adapters.get(key);
    }

    /**
     * 更新适配器配置
     * @param {string} configId - 配置ID
     * @param {object} newConfig - 新配置
     */
    updateAdapter(configId, newConfig) {
        if (this.adapters.has(configId)) {
            this.adapters.delete(configId);
        }
        this.getAdapter({ ...newConfig, id: configId });
    }

    /**
     * 识别验证码
     * @param {string} imageData - Base64编码的图像数据
     * @param {object} options - 选项
     * @returns {Promise<object>} - 识别结果
     */
    async recognize(imageData, options = {}) {
        const startTime = Date.now();

        try {
            // 获取活跃配置
            const config = await storage.getActiveConfig();

            if (!config) {
                throw new Error('请先配置API');
            }

            logger.info('开始识别验证码', { configName: config.name });

            // 获取设置
            const settings = await storage.getSettings();

            // 准备请求参数
            const prompt = config.customPrompt || DEFAULT_RECOGNITION_PROMPT;
            const timeout = options.timeout || settings.timeout;
            const retryCount = options.retryCount || settings.retryCount;

            // 获取适配器
            const adapter = this.getAdapter(config);

            // 执行识别（带重试）
            let lastError = null;

            for (let attempt = 0; attempt < retryCount; attempt++) {
                try {
                    logger.debug(`尝试第 ${attempt + 1} 次识别`);

                    const result = await this.executeWithTimeout(
                        adapter.recognize(imageData, prompt),
                        timeout
                    );

                    const elapsed = Date.now() - startTime;

                    // 记录成功
                    await storage.updateStats(true, elapsed);
                    await storage.addHistory({
                        configName: config.name,
                        result: result.text,
                        success: true,
                        elapsed
                    });

                    logger.info('识别成功', { result: result.text, elapsed });

                    return {
                        success: true,
                        text: result.text,
                        elapsed,
                        attempt: attempt + 1
                    };
                } catch (error) {
                    lastError = error;
                    logger.warn(`第 ${attempt + 1} 次识别失败`, error.message);

                    // 如果不是最后一次尝试，等待后重试
                    if (attempt < retryCount - 1) {
                        await this.delay(1000 * (attempt + 1)); // 指数退避
                    }
                }
            }

            // 所有重试都失败
            throw lastError;

        } catch (error) {
            const elapsed = Date.now() - startTime;

            // 记录失败
            await storage.updateStats(false, elapsed);
            await storage.addHistory({
                configName: (await storage.getActiveConfig())?.name || '未知',
                result: error.message,
                success: false,
                elapsed
            });

            logger.error('识别失败', error);

            return {
                success: false,
                error: error.message,
                elapsed
            };
        }
    }

    /**
     * 测试API连接
     * @param {object} config - API配置（需要解密后的密钥）
     * @returns {Promise<object>} - 测试结果
     */
    async testConnection(config) {
        const startTime = Date.now();

        try {
            logger.info('测试API连接', { configName: config.name });

            // 创建临时适配器
            let adapter;
            switch (config.type) {
                case API_TYPES.GEMINI:
                    adapter = new GeminiAdapter(config);
                    break;
                case API_TYPES.CLAUDE:
                    adapter = new ClaudeAdapter(config);
                    break;
                case API_TYPES.OPENAI_COMPATIBLE:
                default:
                    adapter = new OpenAICompatibleAdapter(config);
                    break;
            }

            // 发送测试请求
            const result = await this.executeWithTimeout(
                adapter.testConnection(),
                30000
            );

            const elapsed = Date.now() - startTime;

            logger.info('连接测试成功', { elapsed });

            return {
                success: true,
                message: result.message || '连接成功',
                elapsed
            };
        } catch (error) {
            const elapsed = Date.now() - startTime;

            logger.error('连接测试失败', error);

            return {
                success: false,
                error: error.message,
                elapsed
            };
        }
    }

    /**
     * 带超时的执行
     * @param {Promise} promise - 要执行的Promise
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise}
     */
    executeWithTimeout(promise, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`请求超时 (${timeout}ms)`));
            }, timeout);

            promise
                .then((result) => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch((error) => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /**
     * 延迟
     * @param {number} ms - 延迟时间（毫秒）
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 导出单例
export const apiManager = new ApiManager();
export default apiManager;
