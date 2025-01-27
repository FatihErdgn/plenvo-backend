// middlewares/checkPermission.js
exports.checkPermission = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user.role; // JWT'den gelen user role
    if (allowedRoles.includes(userRole)) {
      return next(); // İzin verilen rollerden biri eşleşiyorsa devam et
    }
    return res.status(403).json({ success: false, message: "Yetkiniz yok." });
  };
};
