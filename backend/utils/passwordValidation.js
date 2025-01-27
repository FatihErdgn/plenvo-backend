// utils/passwordValidation.js
exports.isValidPassword = (password) => {
    // En az 8 karakter, bir büyük harf, bir küçük harf, bir sayı ve bir özel karakter içermeli
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
  };
  