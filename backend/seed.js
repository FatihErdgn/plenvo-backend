require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

// MongoDB bağlantısı
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.DB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error(err.message);
        process.exit(1); // Hata durumunda çık
    }
};

// Örnek veriler
const seedUsers = async () => {
    try {
        const users = [
            {
                username: 'doktor1',
                password: 'password123', // Bu şifre bcrypt ile hashlenecek
                role: 'doctor',
            },
            {
                username: 'danisman1',
                password: 'password123',
                role: 'consultant',
            },
            {
                username: 'admin',
                password: 'admin123',
                role: 'admin',
            },
        ];

        // Var olan kullanıcıları temizle
        await User.deleteMany();

        // Kullanıcıları ekle
        for (let user of users) {
            const newUser = new User(user);
            await newUser.save();
        }

        console.log('Seed data eklendi.');
        process.exit();
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

// MongoDB bağlan ve verileri ekle
connectDB().then(seedUsers);
