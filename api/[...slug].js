const app = require('../backend/src/server');

module.exports = (req, res) => {
  return app(req, res);
};
