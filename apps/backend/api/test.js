module.exports = (req, res) => {
  res.status(200).json({
    message: 'Hello from direct API test!',
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
  });
};
