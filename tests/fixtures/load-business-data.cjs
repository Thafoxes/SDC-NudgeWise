const data = require('./business-data.json');
module.exports = store => store.update(current => Object.assign(current, structuredClone(data)));
