import createHmac from 'create-hmac';
import querystring from 'querystring';

/**
 * This client can be used to generate URLs for Apify image proxy server.
 * Usage:
 * const imageProxyClient = new ImageProxyClient({
 *   hmacKey: process.env.CAMO_KEY,
 *   domain: 'apifyusercontent.com',
 * });
 * const imageUrl = imageProxyClient.generateUrl('http://example.com/example.gif');
 */
export default class ImageProxyClient {
    /**
     * @param domain - Domain name of proxy image server
     * @param hmacKey - Key for create Hmac hash
     * @param [protocol] - By default https is used
     */
    constructor({ domain, hmacKey, protocol = 'https' }) {
        if (!domain) throw new Error('ImageProxyClient: Parameter domain is required!');
        if (!hmacKey) throw new Error('ImageProxyClient: Parameter hmacKey is required!');

        this.protocol = protocol;
        this.hmacKey = hmacKey;
        this.domain = domain;
    }

    _createDigest(string) {
        const hmac = createHmac('sha1', this.hmacKey).update(string);
        return hmac.digest('hex');
    }

    // eslint-disable-next-line class-methods-use-this
    _createHex(string) {
        return Buffer.from(string, 'utf8').toString('hex');
    }

    /**
     * Generates image URL in format:
     * http://example.com/<digest of image url>?url=<url encoded image url>
     * @param url
     * @return {string}
     */
    generateUrlWithParam(url) {
        const digest = this._createDigest(url);
        const escapedUrl = querystring.escape(url);
        return `${this.protocol}://${this.domain}/${digest}/?url=${escapedUrl}`;
    }

    /**
     * Generates image URL in format:
     * http://example.com/<digest of image url>/<hex string of image url>
     * @param url
     * @return {string}
     */
    generateUrl(url) {
        const digest = this._createDigest(url);
        const hexUrl = this._createHex(url);
        return `${this.protocol}://${this.domain}/${digest}/${hexUrl}`;
    }

    /**
     * Finds all images in HTML and updates src attributes with image proxy URL
     * @param html - string HTML
     * @return {string} - Updated HTML
     */
    updateImagesInHtml(html) {
        const allImgElements = html.match(/<\s*img[^>]*>/gi);
        if (!allImgElements) return html;

        allImgElements.forEach((img) => {
            const srcMatch = img.match(/src=["|']([^'">]+)['|"]/);
            if (srcMatch && srcMatch[1] && srcMatch[1].toLowerCase().startsWith('http')) {
                const imageUrl = srcMatch[1];
                const updatedImageUrl = this.generateUrl(imageUrl);
                const updatedImg = img.replace(imageUrl, updatedImageUrl);
                html = html.replace(img, updatedImg);
            }
        });

        return html;
    }

    /**
     * Creates HTML of image element with image proxy URL
     * @param src -  Used for src attribute
     * @param title - Used for title attribute
     * @param alt - Used for alt attribute
     * @return {string} - Image element
     */
    createImageHtml(src, title, alt) {
        return `<img src="${this.generateUrl(src)}" alt="${alt}" title="${title}">`;
    }
}
