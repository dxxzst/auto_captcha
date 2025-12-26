/**
 * Google Gemini 适配器
 * 支持 Gemini Pro Vision 和 Gemini 1.5 系列
 */

import * as logger from '../utils/logger.js';

/**
 * Gemini API适配器
 */
export class GeminiAdapter {
    /**
     * 构造函数
     * @param {object} config - API配置
     */
    constructor(config) {
        this.config = {
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            model: 'gemini-1.5-flash',
            ...config
        };

        // 确保baseUrl没有尾部斜杠
        this.config.baseUrl = this.config.baseUrl.replace(/\/+$/, '');
    }

    /**
     * 更新配置
     * @param {object} newConfig - 新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.config.baseUrl = this.config.baseUrl.replace(/\/+$/, '');
    }

    /**
     * 识别验证码
     * @param {string} imageData - Base64编码的图像数据
     * @param {string} prompt - 识别提示词
     * @returns {Promise<object>} - 识别结果
     */
    async recognize(imageData, prompt) {
        logger.debug('Gemini适配器开始识别');

        // 处理图像数据
        let base64Data = imageData;
        let mimeType = 'image/png';

        if (imageData.startsWith('data:')) {
            const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
                mimeType = match[1];
                base64Data = match[2];
            }
        }

        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: prompt
                        },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64Data
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 1,
                maxOutputTokens: 500
            }
        };

        const url = `${this.config.baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

        logger.debug('请求配置', {
            model: this.config.model,
            baseUrl: this.config.baseUrl
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await this.parseError(response);
            throw new Error(error);
        }

        const data = await response.json();

        // 检查是否有错误
        if (data.error) {
            throw new Error(data.error.message || '未知错误');
        }

        // 解析响应
        const candidates = data.candidates;
        if (!candidates || candidates.length === 0) {
            throw new Error('API返回结果为空');
        }

        const content = candidates[0].content;
        if (!content || !content.parts || content.parts.length === 0) {
            throw new Error('识别结果为空');
        }

        const text = content.parts[0].text?.trim() || '';

        if (!text) {
            throw new Error('识别结果为空');
        }

        logger.debug('识别完成', { text });

        return {
            text,
            raw: data
        };
    }

    /**
     * 测试连接
     * @returns {Promise<object>}
     */
    async testConnection() {
        logger.debug('Gemini适配器测试连接');

        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: 'Hi, please respond with "OK" to confirm the connection.'
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 1,
                maxOutputTokens: 500
            }
        };

        const url = `${this.config.baseUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await this.parseError(response);
            throw new Error(error);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || '未知错误');
        }

        return {
            success: true,
            message: '连接成功',
            model: this.config.model
        };
    }

    /**
     * 解析错误响应
     * @param {Response} response - HTTP响应
     * @returns {Promise<string>}
     */
    async parseError(response) {
        try {
            const data = await response.json();

            if (data.error?.message) {
                return data.error.message;
            }

            return `HTTP ${response.status}: ${response.statusText}`;
        } catch {
            return `HTTP ${response.status}: ${response.statusText}`;
        }
    }
}

export default GeminiAdapter;
