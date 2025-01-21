// middlewares/verifyToken.js
const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Token bulunamadı" });
  }

  const token = authHeader.split(" ")[1]; // "Bearer <token>" formatı varsayıldı

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token geçersiz veya süresi dolmuş" });
    }

    // Token doğru ise decode edilmiş veriyi isteğe ekleyelim
    req.user = decoded; // { userId, role } gibi
    next();
  });
};

module.exports = verifyToken;
