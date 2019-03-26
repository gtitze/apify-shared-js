/*!
 * This module contains various client-side utility and helper functions.
 *
 * Author: Jan Curn (jan@apify.com)
 * Copyright(c) 2016 Apify. All rights reserved.
 *
 */

const slugg = require('slugg');
const consts = require('./consts');
const regex = require('./regexs');
const { m } = require('./intl');
require('./polyfills');

/**
 * Returns true if object equals null or undefined, otherwise returns false.
 * @param obj
 * @returns {boolean}
 */
export const isNullOrUndefined = function isNullOrUndefined(obj) {
    return obj === undefined || obj === null;
};

/**
 * Converts Date object to ISO string.
 * @param date
 * @param middleT
 * @returns {*}
 */
export const dateToString = function dateToString(date, middleT) {
    if (!(date instanceof Date)) { return ''; }
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // January is 0, February is 1, and so on.
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const millis = date.getMilliseconds();

    return `${
        year}-${
        month < 10 ? `0${month}` : month}-${
        day < 10 ? `0${day}` : day
    }${middleT ? 'T' : ' '
    }${hours < 10 ? `0${hours}` : hours}:${
        minutes < 10 ? `0${minutes}` : minutes}:${
        seconds < 10 ? `0${seconds}` : seconds}.${
        millis < 10 ? `00${millis}` : (millis < 100 ? `0${millis}` : millis)}`;
};

/**
 * Ensures a string is shorter than a specified number of character, and truncates it if not,
 * appending a specific suffix to it.
 * @param str
 * @param maxLength
 * @param suffix Suffix to be appended to truncated string. If null or undefined, it defaults to "...[truncated]".
 */
export const truncate = function (str, maxLength, suffix) {
    maxLength |= 0;
    if (typeof (suffix) !== 'string') { suffix = '...[truncated]'; }
    // TODO: we should just ignore rest of the suffix...
    if (suffix.length > maxLength) { throw new Error('suffix string cannot be longer than maxLength'); }
    if (typeof (str) === 'string' && str.length > maxLength) { str = str.substr(0, maxLength - suffix.length) + suffix; }
    return str;
};

/**
 * Gets ordinal suffix for a number (e.g. "nd" for 2).
 */
export const getOrdinalSuffix = function (num) {
    // code from https://ecommerce.shopify.com/c/ecommerce-design/t/ordinal-number-in-javascript-1st-2nd-3rd-4th-29259
    const s = ['th', 'st', 'nd', 'rd'];
    const v = num % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
};

export const parseUrl = (str) => {
    if (typeof (str) !== 'string') { return {}; }
    const o = {
        strictMode: false,
        key: ['source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port',
            'relative', 'path', 'directory', 'file', 'query', 'fragment'],
        q: {
            name: 'queryKey',
            parser: /(?:^|&)([^&=]*)=?([^&]*)/g,
        },
        parser: {
            strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
            loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,
        },
    };
    const m = o.parser[o.strictMode ? 'strict' : 'loose'].exec(str);
    const uri = {};
    let i = o.key.length;

    while (i--) uri[o.key[i]] = m[i] || '';

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, ($0, $1, $2) => {
        if ($1) uri[o.q.name][$1] = $2;
    });

    // our extension - parse fragment using a query string format (i.e. "#key1=val1&key2=val2")
    // this format is used by many websites
    uri.fragmentKey = {};
    if (uri.fragment) {
        uri.fragment.replace(o.q.parser, ($0, $1, $2) => {
            if ($1) uri.fragmentKey[$1] = $2;
        });
    }

    return uri;
};

export const normalizeUrl = (url, keepFragment) => {
    if (typeof url !== 'string' || !url.length) {
        return null;
    }

    const urlObj = parseUrl(url.trim());
    if (!urlObj.protocol || !urlObj.host) {
        return null;
    }

    const path = urlObj.path.replace(/\/$/, '');
    const params = (urlObj.query
        ? urlObj.query
            .split('&')
            .filter((param) => {
                return !/^utm_/.test(param);
            })
            .sort()
        : []
    );

    return `${urlObj.protocol.trim().toLowerCase()
    }://${
        urlObj.host.trim().toLowerCase()
    }${path.trim()
    }${params.length ? `?${params.join('&').trim()}` : ''
    }${keepFragment && urlObj.fragment ? `#${urlObj.fragment.trim()}` : ''}`;
};

// Helper function for markdown rendered marked
// Renders links outside apify.com in readme with rel="nofollow" and target="_blank" attributes
export const markedSetNofollowLinks = (href, title, text) => {
    let urlParsed;
    try {
        urlParsed = URL.parse(href);
    } catch (e) {
        // Probably invalid url, go on
    }
    const isApifyLink = (urlParsed && /\.apify\.com$/i.test(urlParsed.hostname));
    return (isApifyLink) ? `<a href="${href}">${title || text}</a>` : `<a rel="nofollow" target="_blank" href="${href}">${title || text}</a>`;
};

// Helper function for markdown rendered marked
// Decreases level of all headings by one, h1 -> h2
export const markedDecreaseHeadsLevel = (text, level) => {
    level += 1;
    return `<h${level}>${text}</h${level}>`;
};

/**
 * Creates a "nice path" for public act consisting of 5 chars of it's _id
 * word "api" and slug version of either public.domain and customId.
 */
export const getPublicCrawlerNicePath = (actId, customId, domain) => {
    const parts = [actId.substr(0, consts.SHORT_CRAWLER_ID_LENGTH), 'api', slugg(domain || customId)];

    return parts.join('-');
};

/**
 * Converts integer version number previously generated by buildNumberToInt() or versionNumberToInt()
 * to string in a form 'MAJOR.MINOR' or 'MAJOR.MINOR.BUILD' in case build number is non-zero.
 * @param int
 * @return {string}
 */
export const buildOrVersionNumberIntToStr = (int) => {
    if (typeof (int) !== 'number' || !(int >= 0)) return null;

    const major = Math.floor(int / consts.VERSION_INT_MAJOR_BASE);
    const remainder = int % consts.VERSION_INT_MAJOR_BASE;
    const minor = Math.floor(remainder / consts.VERSION_INT_MINOR_BASE);
    const build = remainder % consts.VERSION_INT_MINOR_BASE;

    let str = `${major}.${minor}`;
    if (build > 0) str += `.${build}`;
    return str;
};


// escaped variants for various strings
const ESCAPE_DOT = '\uFF0E'; // "."
const ESCAPE_DOLLAR = '\uFF04'; // "$"
const ESCAPE_TO_BSON = '\uFF54\uFF4F\uFF22\uFF33\uFF2F\uFF2E'; // "toBSON"
const ESCAPE_BSON_TYPE = '\uFF3F\uFF42\uFF53\uFF4F\uFF4E\uFF54\uFF59\uFF50\uFF45'; // "_bsontype"
const ESCAPE_NULL = ''; // "\0" (null chars are removed completely, they won't be recovered)

const REGEXP_IS_ESCAPED = new RegExp(`(${ESCAPE_DOT}|^${ESCAPE_DOLLAR}|^${ESCAPE_TO_BSON}$|^${ESCAPE_BSON_TYPE}$)`);

const REGEXP_DOT = new RegExp(ESCAPE_DOT, 'g');
const REGEXP_DOLLAR = new RegExp(`^${ESCAPE_DOLLAR}`);
const REGEXP_TO_BSON = new RegExp(`^${ESCAPE_TO_BSON}$`);
const REGEXP_BSON_TYPE = new RegExp(`^${ESCAPE_BSON_TYPE}$`);


/**
 * If a property name is invalid for MongoDB or BSON, the function transforms
 * it to a valid form, which can be (most of the time) reversed back using _unescapePropertyName().
 * For a detailed list of transformations, see escapeForBson().
 * @private
 */
const _escapePropertyName = (name) => {
    // From MongoDB docs:
    // "Field names cannot contain dots (.) or null ("\0") characters, and they must not start with
    // a dollar sign (i.e. $). See faq-dollar-sign-escaping for an alternate approach."
    // Moreover, the name cannot be "toBSON" and "_bsontype" because they have a special meaning in BSON serialization.
    // Other special BSON properties like $id and $db are covered thanks to $ escape.

    // pre-test to improve performance
    if (/(\.|^\$|^toBSON$|^_bsontype$|\0)/.test(name)) {
        name = name.replace(/\./g, ESCAPE_DOT);
        name = name.replace(/^\$/, ESCAPE_DOLLAR);
        name = name.replace(/^toBSON$/, ESCAPE_TO_BSON);
        name = name.replace(/^_bsontype$/, ESCAPE_BSON_TYPE);
        name = name.replace(/\0/g, ESCAPE_NULL);
    }

    return name;
};

/**
 * Reverses a string transformed using _escapePropertyName() back to its original form.
 * Note that the reverse transformation might not be 100% correct for certain unlikely-to-occur strings
 * (e.g. string contain null chars).
 * @param key
 * @returns {*}
 * @private
 */
const _unescapePropertyName = function (name) {
    // pre-test to improve performance
    if (REGEXP_IS_ESCAPED.test(name)) {
        name = name.replace(REGEXP_DOT, '.');
        name = name.replace(REGEXP_DOLLAR, '$');
        name = name.replace(REGEXP_TO_BSON, 'toBSON');
        name = name.replace(REGEXP_BSON_TYPE, '_bsontype');
    }

    return name;
};

exports.escapePropertyName = _escapePropertyName;
exports.unescapePropertyName = _unescapePropertyName;


/**
 * Traverses an object, creates a deep clone if requested and transforms object keys using a provided function.
 * @param obj Object to traverse, it must not contain circular references!
 * @param clone If true, object is not modified but cloned.
 * @param keyTransformFunc Function used to transform the property names. It has one string argument and one string return value.
 * @returns {*}
 * @private
 */
const _traverseObject = function (obj, clone, keyTransformFunc) {
    // primitive types don't need to be cloned or further traversed
    if (obj === null || typeof (obj) !== 'object' || Object.prototype.toString.call(obj) === '[object Date]') return obj;

    let result;

    if (Array.isArray(obj)) {
        // obj is an array, keys are numbers and never need to be escaped
        result = clone ? new Array(obj.length) : obj;
        for (let i = 0; i < obj.length; i++) {
            const val = _traverseObject(obj[i], clone, keyTransformFunc);
            if (clone) result[i] = val;
        }
    } else {
        // obj is an object, all keys need to be checked
        result = clone ? {} : obj;
        for (const key in obj) {
            const val = _traverseObject(obj[key], clone, keyTransformFunc);
            const escapedKey = keyTransformFunc(key);
            if (key === escapedKey) {
                // key doesn't need to be renamed
                if (clone) result[key] = val;
            } else {
                // key needs to be renamed
                result[escapedKey] = val;
                if (!clone) delete obj[key];
            }
        }
    }

    return result;
};


/**
 * Transforms an object so that it can be stored to MongoDB or serialized to BSON.
 * It does so by transforming prohibited property names (e.g. names starting with "$",
 * containing "." or null char, equal to "toBSON" or "_bsontype") to equivalent full-width Unicode chars
 * which are normally allowed. To revert this transformation, use unescapeFromBson().
 * @param obj Object to be transformed. It must not contain circular references or any complex types (e.g. Maps, Promises etc.)!
 * @param clone If true, the function transforms a deep clone of the object rather than the original object.
 * @returns {*} Transformed object
 */
exports.escapeForBson = function (obj, clone) {
    return _traverseObject(obj, clone, _escapePropertyName);
};


/**
 * Reverts a transformation of object property names performed by escapeForBson().
 * Note that the reverse transformation might not be 100% equal to the original object
 * for certain unlikely-to-occur property name (e.g. one contain null chars or full-width Unicode chars).
 * @param obj Object to be transformed. It must not contain circular references or any complex types (e.g. Maps, Promises etc.)!
 * @param clone If true, the function transforms a deep clone of the object rather than the original object.
 * @returns {*} Transformed object.
 */
exports.unescapeFromBson = function (obj, clone) {
    return _traverseObject(obj, clone, _unescapePropertyName);
};


/**
 * Determines whether an object contains property names that cannot be stored to MongoDB.
 * See escapeForBson() for more details.
 * Note that this function only works with objects that are serializable to JSON!
 * @param obj Object to be checked. It must not contain circular references or any complex types (e.g. Maps, Promises etc.)!
 * @returns {boolean} Returns true if object is invalid, otherwise it returns false.
 */
exports.isBadForMongo = function (obj) {
    let isBad = false;
    try {
        _traverseObject(obj, false, (key) => {
            const escapedKey = _escapePropertyName(key);
            if (key !== escapedKey) {
                isBad = true;
                throw new Error();
            }
            return key;
        });
    } catch (e) {
        if (!isBad) throw e;
    }
    return isBad;
};

/**
 * Validate's input field configured with proxy editor
 * @param {Object} fieldKey Proxy field value
 * @param {Object} value Proxy field value
 * @param {Boolean} isRequired Whether the field is required or not
 * @param {Object} options (Optional) Information about proxy groups availability
 * @param {Boolean} options.hasAutoProxyGroups Informs validation whether user has atleast one proxy group available in auto mode
 * @param {Array<String>} options.availableProxyGroups List of available proxy groups
 * @param {Object} options.disabledProxyGroups Object with groupId as key and error message as value (mostly for residential/SERP)
 */
function validateProxyField(fieldKey, value, isRequired = false, options = null) {
    const fieldErrors = [];
    if (isRequired) {
        // Nullable error is already handled by AJV
        if (value === null) return fieldErrors;
        if (!value) {
            const message = m('inputSchema.validation.required', { fieldKey });
            fieldErrors.push(message);
            return fieldErrors;
        }

        const { useApifyProxy, proxyUrls } = value;
        if (!useApifyProxy && (!Array.isArray(proxyUrls) || proxyUrls.length === 0)) {
            fieldErrors.push(m('inputSchema.validation.proxyRequired', { fieldKey }));
            return fieldErrors;
        }
    }

    // Input is not required, so missing value is valid
    if (!value) return fieldErrors;

    const { useApifyProxy, proxyUrls, apifyProxyGroups } = value;

    if (!useApifyProxy && Array.isArray(proxyUrls)) {
        let invalidUrl = false;
        proxyUrls.forEach((url) => {
            if (!regex.PROXY_URL_REGEX.test(url.trim())) invalidUrl = url.trim();
        });
        if (invalidUrl) {
            fieldErrors.push(m('inputSchema.validation.customProxyInvalid', { invalidUrl }));
        }
    }

    // If Apify proxy is not used skip additional checks
    if (!useApifyProxy) return fieldErrors;

    // If options are not provided skip additional checks
    if (!options) return fieldErrors;

    const selectedProxyGroups = (apifyProxyGroups || []);

    // Auto mode, check that user has access to alteast one proxy group usable in this mode
    if (!selectedProxyGroups.length && !options.hasAutoProxyGroups) {
        fieldErrors.push(m('inputSchema.validation.noAvailableAutoProxy'));
        return fieldErrors;
    }

    // Check if proxy groups selected by user are available to him
    const availableProxyGroupsById = {};
    (options.availableProxyGroups || []).forEach((group) => { availableProxyGroupsById[group] = true; });
    const unavailableProxyGroups = selectedProxyGroups.filter(group => !availableProxyGroupsById[group]);

    if (unavailableProxyGroups.length) {
        fieldErrors.push(m('inputSchema.validation.proxyGroupsNotAvailable', { fieldKey, groups: unavailableProxyGroups.join(', ') }));
    }

    // Check if any of the proxy groups are blocked and if yes then output the associated message
    const blockedProxyGroupsById = options.disabledProxyGroups || {};
    selectedProxyGroups.filter(group => blockedProxyGroupsById[group]).forEach((blockedGroup) => {
        fieldErrors.push(blockedProxyGroupsById[blockedGroup]);
    });

    return fieldErrors;
}

/**
 * Uses AJV validator to validate input with input schema and then
 * does custom validation for our own properties (nullable, patternKey, patternValue)
 * @param {AJV.Validator} validator Initialized AJV validator
 * @param {Object} inputSchema Valid input schema in object
 * @param {Object} input Input object to be validated
 * @param {Object} options (Optional) Additional validation configuration for certain fields
 */
exports.validateInputUsingValidator = function (validator, inputSchema, input, options = {}) {
    const isValid = validator(input); // Check if input is valid based on schema values

    const { required, properties } = inputSchema;

    let errors = [];
    // Process AJV validation errors
    if (!isValid) {
        errors = validator.errors
            .map((error) => {
                // There are 3 possible errors comming from validation:
                // - either { keword: 'anything', dataPath: '.someField', message: 'error message that we can use' }
                // - or { keyword: 'additionalProperties', params: { additionalProperty: 'field' }, message: 'should NOT have additional properties' }
                // - or { keyword: 'required', dataPath: '', params.missingProperty: 'someField' }

                let fieldKey;
                let message;

                // If error is with keyword type, it means that type of input is incorrect
                // this can mean that provided value is null
                if (error.keyword === 'type') {
                    fieldKey = error.dataPath.split('.').pop();
                    // Check if value is null and field is nullable, if yes, then skip this error
                    if (properties[fieldKey] && properties[fieldKey].nullable && input[fieldKey] === null) {
                        return null;
                    }
                    message = m('inputSchema.validation.generic', { fieldKey, message: error.message });
                } else if (error.keyword === 'required') {
                    fieldKey = error.params.missingProperty;
                    message = m('inputSchema.validation.required', { fieldKey });
                } else if (error.keyword === 'additionalProperties') {
                    fieldKey = error.params.additionalProperty;
                    message = m('inputSchema.validation.additionalProperty', { fieldKey });
                } else {
                    fieldKey = error.dataPath.split('.').pop();
                    message = m('inputSchema.validation.generic', { fieldKey, message: error.message });
                }

                return { fieldKey, message };
            }).filter(error => !!error);
    }

    Object.keys(properties).forEach((property) => {
        const value = input[property];
        const { type, editor, patternKey, patternValue } = properties[property];
        const fieldErrors = [];
        // Check that proxy is required, if yes, valides that it's correctly setup
        if (type === 'object' && editor === 'proxy') {
            const proxyValidationErrors = validateProxyField(property, value, required.includes(property), options.proxy);
            proxyValidationErrors.forEach((error) => {
                fieldErrors.push(error);
            });
        }
        // Check that array items fit patternKey and patternValue
        if (type === 'array' && value && Array.isArray(value)) {
            // If patternKey is provided, then validate keys of objects in array
            if (patternKey && editor === 'keyValue') {
                const check = new RegExp(patternKey);
                const invalidIndexes = [];
                value.forEach((item, index) => {
                    if (!check.test(item.key)) invalidIndexes.push(index);
                });
                if (invalidIndexes.length) {
                    fieldErrors.push(m('inputSchema.validation.arrayKeysInvalid', {
                        fieldKey: property,
                        invalidIndexes: invalidIndexes.join(','),
                        pattern: patternKey,
                    }));
                }
            }
            // If patternValue is provided and editor is keyValue, then validate values of objecs in array
            if (patternValue && editor === 'keyValue') {
                const check = new RegExp(patternValue);
                const invalidIndexes = [];
                value.forEach((item, index) => {
                    if (!check.test(item.value)) invalidIndexes.push(index);
                });
                if (invalidIndexes.length) {
                    fieldErrors.push(m('inputSchema.validation.arrayValuesInvalid', {
                        fieldKey: property,
                        invalidIndexes: invalidIndexes.join(','),
                        pattern: patternValue,
                    }));
                }
            // If patternValue is provided and editor is stringList, then validate each item in array
            } else if (patternValue && editor === 'stringList') {
                const check = new RegExp(patternValue);
                const invalidIndexes = [];
                value.forEach((item, index) => {
                    if (!check.test(item)) invalidIndexes.push(index);
                });
                if (invalidIndexes.length) {
                    fieldErrors.push(m('inputSchema.validation.arrayValuesInvalid', {
                        fieldKey: property,
                        invalidIndexes: invalidIndexes.join(','),
                        pattern: patternValue,
                    }));
                }
            }
        }
        // Check that object items fit patternKey and patternValue
        if (type === 'object' && value) {
            if (patternKey) {
                const check = new RegExp(patternKey);
                const invalidKeys = [];
                Object.keys(value).forEach((key) => {
                    if (!check.test(key)) invalidKeys.push(key);
                });
                if (invalidKeys.length) {
                    fieldErrors.push(m('inputSchema.validation.objectKeysInvalid', {
                        fieldKey: property,
                        invalidKeys: invalidKeys.join(','),
                        pattern: patternKey,
                    }));
                }
            }
            if (patternValue) {
                const check = new RegExp(patternValue);
                const invalidKeys = [];
                Object.keys(value).forEach((key) => {
                    const propertyValue = value[key];
                    if (typeof propertyValue !== 'string' || !check.test(propertyValue)) invalidKeys.push(key);
                });
                if (invalidKeys.length) {
                    fieldErrors.push(m('inputSchema.validation.objectValuesInvalid', {
                        fieldKey: property,
                        invalidKeys: invalidKeys.join(','),
                        pattern: patternValue,
                    }));
                }
            }
        }
        if (fieldErrors.length > 0) {
            const message = fieldErrors.join(', ');
            errors.push({ fieldKey: property, message });
        }
    });

    return errors;
};
