const mongoose = require('mongoose');

// Every operation in the callback must use this session. The driver retries conflicts.
module.exports = (work) => mongoose.connection.transaction(work, {
  readPreference: 'primary',
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
  maxCommitTimeMS: 10000
});
