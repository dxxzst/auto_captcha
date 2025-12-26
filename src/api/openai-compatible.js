/**
 * OpenAI兼容适配器
 * 支持所有兼容OpenAI API格式的服务
 */

import * as logger from '../utils/logger.js';

/**
 * OpenAI兼容API适配器
 */
export class OpenAICompatibleAdapter {
    /**
     * 构造函数
     * @param {object} config - API配置
     */
    constructor(config) {
        this.config = {
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o',
            maxTokens: 500,
            temperature: 1,
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
     * 构建请求头
     * @returns {object}
     */
    buildHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        // 添加API密钥
        if (this.config.apiKey) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        // 添加自定义请求头
        if (this.config.customHeaders) {
            Object.assign(headers, this.config.customHeaders);
        }

        return headers;
    }

    /**
     * 识别验证码
     * @param {string} imageData - Base64编码的图像数据（不含前缀）
     * @param {string} prompt - 识别提示词
     * @returns {Promise<object>} - 识别结果
     */
    async recognize(imageData, prompt) {
        logger.debug('OpenAI兼容适配器开始识别');

        // 确定图像格式
        const imageUrl = imageData.startsWith('data:')
            ? imageData
            : `data:image/png;base64,${imageData}`;

        const requestBody = {
            model: this.config.model,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: prompt
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageUrl,
                                detail: 'high'
                            }
                        }
                    ]
                }
            ],
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature
        };

        logger.debug('请求配置', {
            url: `${this.config.baseUrl}/chat/completions`,
            model: this.config.model
        });

        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: this.buildHeaders(),
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await this.parseError(response);
            throw new Error(error);
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
            throw new Error('API返回结果为空');
        }

        const text = data.choices[0].message?.content?.trim() || '';

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
        logger.debug('OpenAI兼容适配器测试连接');

        const requestBody = {
            model: this.config.model,
            messages: [
                {
                    role: 'user',
                    content: 'Hi, please respond with "OK" to confirm the connection.'
                }
            ],
            max_tokens: 10
        };

        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: this.buildHeaders(),
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await this.parseError(response);
            throw new Error(error);
        }

        const data = await response.json();

        return {
            success: true,
            message: '连接成功',
            model: data.model
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

export default OpenAICompatibleAdapter;
