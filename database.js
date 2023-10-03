const mysql = require("mysql2");
const dayjs = require("dayjs");
const csvtojson = require("csvtojson");
const bcrypt = require("bcryptjs");
const { logger } = require("./logger.js");

const pool = mysql.createPool({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_DATABASE_NAME,
}).promise();

const dateFormatForDB = "YYYY-MM-DD";

const database = {
    testConnection() {
        pool.query("select 1")
            .then(() => logger.info("Database connection successful"))
            .catch(error => logger.info("Database connection failed\n" + error));
    },
    getTakenTimeSlotsForDate: function(date) {
        const query = "select time from appointments where date=?"
        return pool.query(query, date).then(res => res[0]);
    },
    patients: {
        search(searchString) {
            const query = `select * from patients where concat(firstName, lastName, file, nrc, phone, payment, insuranceId) like "%${searchString}%" order by lastName`;
            return pool.query(query)
                .then(res => res[0])
        },
        addNew: function(patient) {
            const query = "insert into patients (firstName, lastName, file, nrc, phone, payment, insuranceId, dateOfBirth, sex, marketing) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
            const array = [patient.firstName, patient.lastName, patient.file, patient.nrc, patient.phone, patient.payment, patient.insuranceId, patient.dateOfBirth, patient.sex, patient.marketing];
            return pool.query(query, array).catch(error => logger.error(error));
        },
        update: function(patient) {
            const query = "UPDATE patients SET firstName=?, lastName=?, file=?, nrc=?, phone=?, payment=?, insuranceId=?, dateOfBirth=?, sex=?, marketing=? WHERE id = ?";
            const array = [patient.firstName, patient.lastName, patient.file, patient.nrc, patient.phone, patient.payment, patient.insuranceId, patient.dateOfBirth, patient.sex, patient.marketing, patient.id];
            return pool.query(query, array).catch(error => logger.error(error));
        },
        delete: function(id) {
            return pool.query("delete from patients where id=?", id).catch(error => logger.error(error));
        },
        getLastInserted() {
            const query = "select * from patients where id = (select last_insert_id())";
            return pool.query(query)
                .then(res => res[0][0]);
        }, 
        createTablePatients() {
            const query = 'create table patients (id mediumint primary key not null auto_increment, firstName varchar(255), lastName varchar(255), file varchar(255), nrc varchar(255), insuranceId varchar(255), phone varchar(255), dateOfBirth date, sex char, dateAdded datetime default now(), marketing varchar(255));';
            return pool.query(query);
        },
        dropTable() {
            const query = "drop table patients";
            pool.query(query);
        },
        describePatientsTable() {
            const query = "describe patients";
            pool.query(query).then((res) => console.log(res[0]));
        },
        deleteAll: function() {
            return pool.query("delete from patients");
        },
        getAllPatients: function() {
            return pool.query("select * from patients").then(res => console.log(res[0]));
        },
        alterTablePatients() {
            const query = "alter table patients add column payment varchar(255)";
            // const query = "alter table patients drop primary key;";
            pool.query(query).then(res => console.log(res[0]));
        },
        importPatientsFromCSVFile() {
            const csvFilePath = "./import/patients.csv";
            return csvtojson()
                .fromFile(csvFilePath)
                    .then(patientsArray => patientsArray.forEach(patient => {
                        if (patient.firstName)
                            if ((patient.dateOfBirth == "") || !dayjs(patient.dateOfBirth).isValid())
                                patient.dateOfBirth = "1000-01-01";
                            patient.dateOfBirth = dayjs(patient.dateOfBirth).format(dateFormatForDB);
                            database.patients.addNew(patient);
                    }))
                    .catch(error => logger.error(error));
        }
    },
    appointments: {
        getForDate: function(date) {
            const query = "select id, date, time, firstName, lastName, doctor, treatment, payment, cost, patientFile, phone, comments, noshow from appointments where date=? order by time";
            return pool.query(query, date).then(res => res[0]);
        },
        search(searchString) {
            const query = `select * from appointments where concat(firstName, lastName, patientFile, doctor, treatment, phone, cost, date) like "%${searchString[0]}%" or "%${searchString[1]}%" order by date, time`;
            return pool.query(query)
                .then(res => res[0])
        },
        getForPatient(patientFile) {
            const query  = "select id, date, time, firstName, lastName, doctor, treatment, payment, cost, patientFile, phone, comments, noshow from appointments where patientFile = ? order by date, time";
            return pool.query(query, [patientFile]).then(res => res[0]).catch(error => logger.error(error));
        },
        addNew: function(appointment) {
            return pool.query("insert into appointments (date, time, firstName, lastName, doctor, treatment, payment, cost, patientFile, phone, comments) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);", 
                [appointment.date, appointment.time, appointment.firstName, appointment.lastName, appointment.doctor, appointment.treatment, appointment.payment, appointment.cost, appointment.patientFile, appointment.phone, appointment.comments]);
        },
        update: function(appointment) {
            return pool.query("UPDATE appointments SET date=?, time=?, firstName=?, lastName=?, doctor=?, treatment=?, payment=?, cost=?, patientFile=?, phone=?, comments=?, noshow=? WHERE id = ?", 
                [appointment.date, appointment.time, appointment.firstName, appointment.lastName, appointment.doctor, appointment.treatment, appointment.payment, appointment.cost, appointment.patientFile, appointment.phone, appointment.comments, appointment.noshow, appointment.id]);
        },
        delete: function(id) {
            return pool.query("delete from appointments where id=?", id);
        },
        createTable() {
            const query = "create table appointments (id mediumint auto_increment not null primary key, date date, time time, firstName varchar(255), lastName varchar(255), doctor varchar(255), treatment varchar(255), payment varchar(255), cost varchar(255), patientFile varchar(255), phone varchar(255), comments varchar(255), noshow boolean, dateAdded datetime default now())";
            pool.query(query);
        },
        describeAppointmentsTable() {
            const query = "describe appointments";
            pool.query(query).then((res) => console.log(res[0]));
        },
        alterTableAppointments() {
            // const query = "alter table appointments drop foreign key appointments_ibfk_1";
            const query = "alter table appointments modify column cost double(10,2)";
            return pool.query(query);
        },
        deleteAll: function() {
            return pool.query("delete from appointments");
        },
        getAll: function() {
            return pool.query("select * from appointments").then(response => response[0]);
        },
        dropTable() {
            const query = "drop table appointments";
            pool.query(query);
        },
        importAppointmentsFromCSVFile() {
            const csvFilePath = "./import/appointments.csv";
            return csvtojson()
                .fromFile(csvFilePath)
                .then(appointmentsArray => appointmentsArray.forEach(appointment => {
                    if ((appointment.date) && (appointment.firstName || appointment.lastName) && (appointment.firstName != "X") && (appointment.firstName != "x") && (appointment.lastName != "X") && (appointment.lastName != "x")) {
                        if ((appointment.cost === "") || (appointment.cost === "paid"))
                            appointment.cost = 0;
                        database.appointments.addNew(appointment)
                            .catch(error => logger.error(error))
                    }
                }));
        }
    },
    users: {
        addNew(username, password, accessLevel) {
            return bcrypt.hash(password, 15)
                .then(hashedPassword => {
                    const query = "insert into users (username, password, accessLevel) values (?, ?, ?)";
                    return pool.query(query, [username, hashedPassword, accessLevel]);
                })
                .catch((error) => {
                    logger.info("Registration failed\n", error)
                });
        },
        find(username) {
            const query = `select * from users where username=?`;
            return pool.query(query, [username]).then(res => res[0][0]);
        },
        createTable() {
            const query = "create table users (id mediumint auto_increment not null primary key, username varchar(255) unique, password varchar(255) unique, accessLevel varchar(255));";
            return pool.query(query);
        },
        describeTable() {
            const query = "describe users";
            pool.query(query).then((res) => console.log(res[0]));
        },
        getAll() {
            const query = "select * from users";
            return pool.query(query)
                .then(res => res[0])
                .catch(error => logger.error(error));
        },
        deleteAll() {
            const query = "delete from users";
            pool.query(query).then((res) => console.log(res[0]));
        },
        dropTable() {
            const query = "drop table users";
            return pool.query(query).then((res) => console.log(res[0]));
        },
        authorizeUser(username) {
           const query = "update users set accessLevel='director' where username=?";
           return pool.query(query, [username]);
        }
    },
    doctors: {
        addNew(...doctors) {
            doctors.forEach(doctor => {
                const query = "insert into doctors (doctor) values (?)";
                pool.query(query, [doctor]);
            });
        },
        find(username) {
            const query = `select * from doctors where username=?`;
            return pool.query(query, [username]).then(res => res[0][0]);
        },
        createTable() {
            const query = "create table doctors (id mediumint auto_increment not null primary key, doctor varchar(255) unique);";
            pool.query(query);
        },
        describeTable() {
            const query = "describe doctors";
            pool.query(query).then((res) => console.log(res[0]));
        },
        getAll() {
            const query = "select doctor from doctors";
            return pool.query(query).then(res => res[0]);
        },
        deleteAll() {
            const query = "delete from doctors";
            pool.query(query).then((res) => console.log(res[0]));
        },
        dropTable() {
            const query = "drop table doctors";
            pool.query(query).then((res) => console.log(res[0]));
        },
    },
    treatments: {
        addNew(...treatments) {
            treatments.forEach(treatment => {
                const query = "insert into treatments (treatment) values (?)";
                pool.query(query, [treatment]);
            });
        },
        createTable() {
            const query = "create table treatments (id mediumint auto_increment not null primary key, treatment varchar(255) unique);";
            pool.query(query);
        },
        describeTable() {
            const query = "describe treatments";
            pool.query(query).then((res) => console.log(res[0]));
        },
        getAll() {
            const query = "select treatment from treatments";
            return pool.query(query).then(res => res[0]);
        },
        deleteAll() {
            const query = "delete from treatments";
            pool.query(query).then((res) => console.log(res[0]));
        },
        dropTable() {
            const query = "drop table treatments";
            pool.query(query).then((res) => console.log(res[0]));
        },
    },
    payments: {
        addNew(...payments) {
            payments.forEach(payment => {
                const query = "insert into payments (payment) values (?)";
                pool.query(query, [payment]);
            });
        },
        createTable() {
            const query = "create table payments (id mediumint auto_increment not null primary key, payment varchar(255) unique);";
            pool.query(query);
        },
        describeTable() {
            const query = "describe payments";
            pool.query(query).then((res) => console.log(res[0]));
        },
        getAll() {
            const query = "select payment from payments";
            return pool.query(query).then(res => res[0]);
        },
        deleteAll() {
            const query = "delete from payments";
            pool.query(query).then((res) => console.log(res[0]));
        },
        dropTable() {
            const query = "drop table payments";
            pool.query(query).then((res) => console.log(res[0]));
        },
    },
    analytics: {
        countTreatment(treatment, month, year) {
            const query = "select count(treatment) from appointments where treatment=? and month(date)=? and year(date)=?";
            const params = [treatment, month, year];
            pool.query(query, params)
                .then(res => {
                    const key = Object.keys(res[0][0])[0];
                    const value = res[0][0][key];
                    console.log(`Number of treatments "${treatment}" for month ${month} of year ${year} is ${value}`);
                });
        },

        getTotalYearlySumsForCategory(year, category) {
            const query = `SELECT ${category}, sum(cost) AS total FROM appointments WHERE year(date)=? GROUP BY ${category} ORDER BY sum(cost) desc`;
            return pool.query(query, year).then(res => res[0]).catch(error => logger.error(error))
        },
        getMonthlySumsForCategory(categoryItem, year, category) {
            const query = `SELECT
                    ${category},
                    IFNULL(SUM(cost), 0) AS sum,
                    months.month
                FROM
                    (
                        SELECT 1 AS month UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
                        UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8
                        UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
                    ) AS months
                LEFT JOIN appointments ON months.month = MONTH(date) AND ${category} = ? AND YEAR(date) = ?
                GROUP BY months.month
                `;
            return pool.query(query, [categoryItem, year]).then(res => res[0]).catch(error => logger.error(error))
        },

        getTotalMonthlySums(year) {
            const query = `SELECT
                    months.month AS month,
                    IFNULL(SUM(appointments.cost), 0) AS total
                FROM
                    (
                        SELECT 1 AS month UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
                        UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8
                        UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
                    ) AS months
                LEFT JOIN
                    appointments
                ON
                    months.month = MONTH(appointments.date) AND YEAR(appointments.date) = ?
                GROUP BY
                    months.month`;
            return pool.query(query, year).then(res => res[0]).catch(error => logger.error(error));
        },
        getTotalSumForYear(year) {
            const query = "select sum(cost) as total from appointments where year(date)=?";
            return pool.query(query, year).then(res => res[0][0]).catch(error => logger.error(error));
        },

        countPatients(month, year) {
            // Need to count unique patientFile, so that if the same patient came 2 during the month, we will count it as 1
            const query = "select count(patientFile) from appointments where month(date)=? and year(date)=?";
            pool.query(query, [month, year]);
        },
        countPatientsForAge(minAge, maxAge, month, year) {
            // Need to make a join with patients on birthDate
            const query = "select * from appointments where month(date)=? and year(date)=?";
            const params = [minAge, maxAge, month, year];
            pool.query(query, params);
        },
    },
    timeSlots: {
        addNew(...timeSlots) {
            timeSlotsArray.forEach(timeSlot => {
                const query = "insert into timeSlots (id, time) values (?, ?)";
                pool.query(query, [timeSlot.id, timeSlot.time])
                    .catch(error => logger.info(error));
            });
        },
        createTable() {
            const query = "create table timeSlots (id int not null primary key, time varchar(255) unique, isEmptyTimeSlot boolean default 1);";
            pool.query(query);
        },
        dropTable() {
            const query = "drop table timeSlots";
            pool.query(query);
        },
        getAll() {
            const query = "select * from timeSlots order by time";
            return pool.query(query)
                .then(res => res[0])
                .catch(error => logger.info(error));
        },
    }
}

module.exports = { database };


// pool.query("delete from appointments where payment='SES' and month(date)='6'");
