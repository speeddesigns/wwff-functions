const errorHandler = (err, req, res, next) => {
  next(err);
};

module.exports = errorHandler;
