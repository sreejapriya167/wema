export function notFound(_req, res) {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
}

export function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
    details: err.details || null
  });
}

