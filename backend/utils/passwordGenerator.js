exports.generateRandomPassword = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '@$!%*?&';
    const allChars = uppercase + lowercase + numbers + symbols;
  
    let password = '';
    // Her kategoriden en az bir karakter
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
  
    // Kalan 4 karakteri rastgele seç
    for (let i = 0; i < 4; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
  
    // Karakterleri karıştır
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };