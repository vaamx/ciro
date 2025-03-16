/**
 * Simple logger utility
 */
const logger = {
  info: (message, meta = {}) => {
    if (typeof message === 'object') {
      console.log(']: ', JSON.stringify(message));
    } else {
      console.log(']: ' + message, meta && Object.keys(meta).length ? meta : '');
    }
  },
  error: (message, meta = {}) => {
    if (typeof message === 'object') {
      console.error(']: ERROR: ', JSON.stringify(message));
    } else {
      console.error(']: ERROR: ' + message, meta && Object.keys(meta).length ? meta : '');
    }
  },
  debug: (message, meta = {}) => {
    if (process.env.DEBUG) {
      if (typeof message === 'object') {
        console.debug(']: DEBUG: ', JSON.stringify(message));
      } else {
        console.debug(']: DEBUG: ' + message, meta && Object.keys(meta).length ? meta : '');
      }
    }
  },
  warn: (message, meta = {}) => {
    if (typeof message === 'object') {
      console.warn(']: WARNING: ', JSON.stringify(message));
    } else {
      console.warn(']: WARNING: ' + message, meta && Object.keys(meta).length ? meta : '');
    }
  }
};

module.exports = logger;
