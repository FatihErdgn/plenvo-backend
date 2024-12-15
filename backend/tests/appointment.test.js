const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app"); // Express.js uygulamanız

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, {
    dbName: "test",
  });
});

afterAll(async () => {
  if (mongoServer) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  }
});

jest.setTimeout(30000);

describe("Randevu İşlemleri", () => {
  it("Hasta, doğru kod ve isimle randevuyu silebilmeli", async () => {
    const Patient =
      mongoose.models.Patient ||
      mongoose.model(
        "Patient",
        new mongoose.Schema({
          name: String,
          email: String,
          phone: String,
        })
      );

    const User =
      mongoose.models.User ||
      mongoose.model(
        "User",
        new mongoose.Schema({
          username: String,
          password: String,
          role: { type: String, enum: ["doctor", "admin", "consultant"] },
        })
      );

    const Appointment =
      mongoose.models.Appointment ||
      mongoose.model(
        "Appointment",
        new mongoose.Schema({
          uniqueCode: String,
          department: String,
          doctor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
          date: Date,
          time: String,
        })
      );

    const patient = await Patient.create({
      name: "Ahmet Yılmaz",
      email: "ahmet@example.com",
      phone: "5551234567",
    });

    const doctor = await User.create({
      username: "doktor1",
      password: "123456",
      role: "doctor",
    });

    const appointment = await Appointment.create({
      uniqueCode: "test1234",
      department: "Kardiyoloji",
      doctor: doctor._id,
      patient: patient._id,
      date: new Date(),
      time: "10:30",
    });

    const res = await request(app).delete("/api/appointments/delete").send({
      uniqueCode: "test1234",
      name: "Ahmet Yılmaz",
    });

    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toBe("Randevu başarıyla silindi.");
  });
});
