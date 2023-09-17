const express = require("express");
const cors = require("cors");
const app = express();
const { logger } = require("./logger.js");
require("dotenv").config();
const dayjs = require("dayjs");
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");

const { database } = require("./database.js");
const { sanitizeString } = require("./sanitizeString.js");
const authorizeToken = require("./authorizeToken.js");
const checkAccessLevel = require("./checkAccessLevel.js");

app.use(express.static("build"));
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const port = process.env.PORT || 80;

const dateFormatForDB = "YYYY-MM-DD";

function convertTimeFormatFromHHMMSSToHHMM(time) {
    return time.substring(0, 5);
};

app.use((req, res, next) => {
    logger.info(`Received a ${req.method} request for ${req.url}`);
    next();
});

// Real network imitation
app.use((req, res, next) => {
    setTimeout(() => next(), 1000);
});

app.get("/authorization", authorizeToken, (req, res) => {
    res.sendStatus(200);
});

app.get("/appointments", authorizeToken, (req, res) => {

    function compareAppointmentsOnTime(appointment1, appointment2) {
        if (appointment1.time > appointment2.time) 
            return 1;
        else if (appointment1.time < appointment2.time) 
            return -1;
        else 
            return 0;
    };

    function combineAppointmentsAndTimeSlotsArrays(appointments, timeSlots, date) {
        appointments.forEach(appointment => {
            appointment.time = convertTimeFormatFromHHMMSSToHHMM(appointment.time);

            timeSlots.forEach(timeSlot => {
                timeSlot.date = date;
                if (timeSlot.time == appointment.time) {
                    const index = timeSlots.indexOf(timeSlot);
                    timeSlots.splice(index, 1);
                }
            });

        });
        const appointmentsWithTimeSlots = appointments.concat(timeSlots);
        return appointmentsWithTimeSlots;
    };

    if (req.query.date) {
        const date = sanitizeString(req.query.date);
        Promise.all([database.timeSlots.getAll(), database.appointments.getForDate(date)])
            .then(values => {
                const timeSlots = values[0];
                const appointments = values[1];
                const appointmentsWithTimeSlots = combineAppointmentsAndTimeSlotsArrays(appointments, timeSlots, date);
                appointmentsWithTimeSlots.sort(compareAppointmentsOnTime);
                res.json(appointmentsWithTimeSlots);
            });
    } else if (req.query.patientFile) {
        const patientFile = decodeURIComponent(req.query.patientFile);
        database.appointments.getForPatient(patientFile)
            .then(appointments => {
                appointments.forEach(appointment => {
                    appointment.time = convertTimeFormatFromHHMMSSToHHMM(appointment.time);
                });
                res.json(appointments);
            });
    }
    else {
        const searchString = sanitizeString(req.query.searchString);
        database.appointments.search(searchString)
            .then(appointments => {
                appointments.forEach(appointment => {
                    appointment.time = convertTimeFormatFromHHMMSSToHHMM(appointment.time);
                });
                res.json(appointments)
            })
            .catch(error => logger.info(error));
    }


  
});

app.post("/appointments", authorizeToken, (req, res) => {
    for (const [key, value] of Object.entries(req.body)) {
        if (typeof req.body[key] != "boolean")
            req.body[key] = sanitizeString(String(value));    
        }
    const appointment = req.body;
    database.appointments.addNew(appointment)
        .then((result) => res.json({ success: true }))
        .catch(error => {
            logger.info(error);
            res.json({success: false});
        });
});

app.put("/appointments", authorizeToken, (req, res) => {
    for (const [key, value] of Object.entries(req.body)) {
        if (typeof req.body[key] !== "boolean")
            req.body[key] = sanitizeString(String(value));
    }
    const appointment = req.body;
    database.appointments.update(appointment)
        .then(() => {
            res.json({success: true});
        })
        .catch(error => {
            logger.info(error);
            res.json({success: false});
        });
});

app.delete("/appointments/:id", authorizeToken, (req, res) => {
    let { id } = req.params;
    id = sanitizeString(id);
    database.appointments.delete(id)
        .then(() => res.json({ success: true }))
        .catch((error) => {
            logger.info(error);
            res.json({ success: false });
        });
});
    
app.get("/taken-time-slots/:selectedDate", authorizeToken, (req, res) => {
    let { selectedDate } = req.params;
    selectedDate = dayjs(selectedDate).format(dateFormatForDB);
    let takenTimeSlots = [];

    database.getTakenTimeSlotsForDate(selectedDate).then(timeSlots => {
        timeSlots.forEach(item => takenTimeSlots.push(convertTimeFormatFromHHMMSSToHHMM(item.time)));
        res.json(takenTimeSlots);
    });
});

app.get("/time-slots/", authorizeToken, (req, res) => {

});

app.get("/patients/:searchString", authorizeToken, (req, res) => {
    let searchString = req.params.searchString;
    searchString = decodeURIComponent(searchString);
    searchString = sanitizeString(searchString);
    database.patients.search(searchString)
        .then(response => {
            const patients = response;
            res.json(patients);
        })
        .catch(error => logger.info(error));
});

app.post("/patients", authorizeToken, (req, res) => {
    for (const [key, value] of Object.entries(req.body)) {
        if ((typeof req.body[key] != "boolean") && (typeof req.body[key] != "number") && (req.body[key] != null))
            req.body[key] = sanitizeString(String(value));    
        }
    const patient = req.body;
    database.patients.addNew(patient)
        .then(() => database.patients.getLastInserted())
        .then((lastInsertedPatient) => res.json(lastInsertedPatient))
        .catch(error => {
            logger.info(error);
            res.json({success: false});
        });
});

app.put("/patients", authorizeToken, (req, res) => {
    for (const [key, value] of Object.entries(req.body)) {
        if (value !== null)
            req.body[key] = sanitizeString(String(value));
    }
    const patient = req.body;
    database.patients.update(patient)
        .then(() => {
            res.json({success: true});
        })
        .catch(error => {
            logger.info(error);
            res.json({success: false});
        });
});

app.delete("/patients/:id", authorizeToken, (req, res) => {
    let id = req.params.id;
    id = sanitizeString(id);
    database.patients.delete(id)
        .then(() => res.json({ success: true }))
        .catch(error => {
            logger.info(error);
            res.json({ success: false });
        });
});

app.get("/reports", authorizeToken, (req, res) => {

});

app.get("/analytics", authorizeToken, checkAccessLevel, (req, res) => {

});

app.get("/settings", authorizeToken, checkAccessLevel, (req, res) => {

});

app.get("/doctors", authorizeToken, (req, res) => {
    database.doctors.getAll()
        .then(doctors => { 
            const doctorsArray = [];
            doctors.forEach(item => {
                doctorsArray.push(item.doctor);
            })
            res.json(doctorsArray) 
        });
});

app.get("/treatments", authorizeToken, (req, res) => {
    database.treatments.getAll()
        .then(treatments => { 
            const treatmentsArray = [];
            treatments.forEach(item => {
                treatmentsArray.push(item.treatment);
            })
            res.json(treatmentsArray) 
        });
});

app.get("/payments", authorizeToken, (req, res) => {
    database.payments.getAll()
        .then(payments => { 
            const paymentsArray = [];
            payments.forEach(item => {
                paymentsArray.push(item.payment);
            })
            res.json(paymentsArray) 
        });
});

app.post("/login", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    let accessLevel;

    database.users.find(username)
        .then(response => {
            if (response) {
                accessLevel = response.accessLevel;
                if (accessLevel === "unauthorized")
                    res.json({ success: false, message: "You are unauthorized" });
                return bcrypt.compare(password, response.password);
            }
            else 
                res.json({ message: "User does not exist" });
        })
        .then(passwordCheck => {
            if (passwordCheck) {
                const token = jwt.sign(
                    { accessLevel }, 
                    process.env.ACCESS_TOKEN_SECRET, 
                    { expiresIn: "2 days" }, 
                    // (err) => logger.info(err)
                );
                res.json({ token: token, success: true, accessLevel: accessLevel });
            }
            else if (passwordCheck === false) {
                res.json({ message: "Wrong password or username" });
            }
        })
        .catch(response => 
            res.json({ message: "SOMETHING WENT WRONG" })
        );
});

app.post("/register", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const accessLevel = "unauthorized";

    database.users.addNew(username, password, accessLevel)
        .then(() => res.json({ success: true, message: "Registration successful" }))
        .catch(() => res.json({ success: false, message: "Something went wrong" }));
});

app.get("/import-appointments", authorizeToken, checkAccessLevel, (req, res) => {
    database.appointments.importAppointmentsFromCSVFile()
        .then(() => res.json({ success: true }))
        .catch(error => {
            logger.info(error);
            res.json({ success: false });
        });
});

app.get("/import-patients", authorizeToken, checkAccessLevel, (req, res) => {
    database.patients.importPatientsFromCSVFile()
        .then(() => res.json({ success: true }))
        .catch(error => {
            logger.info(error);
            res.json({ success: false });
        });
});

app.listen(port, () => logger.info(`Listening to port ${port}`));

database.testConnection();
