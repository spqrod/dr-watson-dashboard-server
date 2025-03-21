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
            return pool.query("insert into appointments (date, time, firstName, lastName, doctor, treatment, payment, cost, patientFile, phone, comments, noShow) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);", 
                [appointment.date, appointment.time, appointment.firstName, appointment.lastName, appointment.doctor, appointment.treatment, appointment.payment, appointment.cost, appointment.patientFile, appointment.phone, appointment.comments, appointment.noShow]);
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
        getTotalDailySums(year, month) {
            const query = `
                SELECT
                IFNULL(SUM(cost), 0) as total,
                days.day as day
                FROM (
                    SELECT 1 AS day UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
                    UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8
                    UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
                    UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16
                    UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
                    UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24
                    UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28
                    UNION SELECT 29 UNION SELECT 30 UNION SELECT 31
                ) as days
                LEFT JOIN appointments
                ON DAY(date) = days.day
                AND YEAR(date) = ?
                AND MONTH(date) = ?
                GROUP BY days.day
                ORDER BY days.day;
            `;
        
            return pool.query(query, [year, month]).then(res => res[0]).catch(error => logger.error(error));
        },
        getTotalSumForYear(year) {
            const query = "select sum(cost) as total from appointments where year(date)=?";
            return pool.query(query, year).then(res => res[0][0]).catch(error => logger.error(error));
        },
    },
    reports: {
        countAppointmentsByMonth(year) {
            const query = `
                        SELECT
                IFNULL(appointmentCounts.appointmentCount, 0) as appointmentCount,
                months.month as month
            FROM
                (
                    SELECT 1 as month UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
                    UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8
                    UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
                ) as months
            LEFT JOIN
                (
                    SELECT
                        COUNT(patientFile) as appointmentCount,
                        MONTH(date) as month
                    FROM
                        appointments
                    WHERE
                        YEAR(date) = ?
                        AND noShow = false
                        AND firstName != 'x'
                        AND lastName != 'x'
                    GROUP BY
                        MONTH(date)
                ) as appointmentCounts
            ON
                months.month = appointmentCounts.month;
            `;
            return pool.query(query, year).then(res => res[0]).catch(error => logger.error(error));
        },
        countAppointmentsByQuarter(year) {
            const query = `SELECT
            IFNULL(appointmentCounts.appointmentCount, 0) as appointmentCount,
            quarters.quarter as quarter
        FROM
            (
                SELECT 1 as quarter UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
            ) as quarters
        LEFT JOIN
            (
                SELECT
                    COUNT(patientFile) as appointmentCount,
                    QUARTER(date) as quarter
                FROM
                    appointments
                WHERE
                    YEAR(date) = ?
                    AND noShow = false
                    AND firstName != 'x'
                    AND lastName != 'x'
                GROUP BY
                    QUARTER(date)
            ) as appointmentCounts
        ON
            quarters.quarter = appointmentCounts.quarter;
        
            `;
            return pool.query(query, year).then(res => res[0]).catch(error => logger.error(error));
        },
        countAppointmentsTotal(year) {
            const query = `
            SELECT 
                COUNT(patientFile) as total
            FROM
                appointments
            WHERE 
                YEAR(date) = ? 
                AND noShow = false
                AND firstName != 'x'
                AND lastName != 'x'`;
            return pool.query(query, year).then(res => res[0]).catch(error => logger.error(error));
        },

        countNhimaAppointmentsByMonth(year) {
            const query = `
                        SELECT
                IFNULL(appointmentCounts.appointmentCount, 0) as appointmentCount,
                months.month as month
            FROM
                (
                    SELECT 1 as month UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
                    UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8
                    UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
                ) as months
            LEFT JOIN
                (
                    SELECT
                        COUNT(patientFile) as appointmentCount,
                        MONTH(date) as month
                    FROM
                        appointments
                    WHERE
                        YEAR(date) = ?
                        AND noShow = false
                        AND firstName != 'x'
                        AND lastName != 'x'
                        AND payment = 'Nhima'
                    GROUP BY
                        MONTH(date)
                ) as appointmentCounts
            ON
                months.month = appointmentCounts.month;
            `;
            return pool.query(query, year).then(res => res[0]).catch(error => logger.error(error));
        },
        countNhimaAppointmentsByQuarter(year) {
            const query = `SELECT
            IFNULL(appointmentCounts.appointmentCount, 0) as appointmentCount,
            quarters.quarter as quarter
        FROM
            (
                SELECT 1 as quarter UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
            ) as quarters
        LEFT JOIN
            (
                SELECT
                    COUNT(patientFile) as appointmentCount,
                    QUARTER(date) as quarter
                FROM
                    appointments
                WHERE
                    YEAR(date) = ?
                    AND noShow = false
                    AND firstName != 'x'
                    AND lastName != 'x'
                    AND payment = 'Nhima'
                GROUP BY
                    QUARTER(date)
            ) as appointmentCounts
        ON
            quarters.quarter = appointmentCounts.quarter;
        
            `;
            return pool.query(query, year).then(res => res[0]).catch(error => logger.error(error));
        },
        countNhimaAppointmentsTotal(year) {
            const query = `
            SELECT 
                COUNT(patientFile) as total
            FROM
                appointments
            WHERE 
                YEAR(date) = ? 
                AND noShow = false
                AND firstName != 'x'
                AND lastName != 'x'
                AND payment = 'Nhima'
                `;
            return pool.query(query, year).then(res => res[0]).catch(error => logger.error(error));
        },
        
        countTreatments(year, month) {

            const minPatientAgeInDaysForAgeGroup0To1 = 0;
            const maxPatientAgeInDaysForAgeGroup0To1 = 365;

            const minPatientAgeInDaysForAgeGroup1To4 = 365;
            const maxPatientAgeInDaysForAgeGroup1To4 = 365 * 4;

            const minPatientAgeInDaysForAgeGroup5To14 = 365 * 5;
            const maxPatientAgeInDaysForAgeGroup5To14 = 365 * 14;

            const minPatientAgeInDaysForAgeGroup15To120 = 365 * 15;
            const maxPatientAgeInDaysForAgeGroup15To120 = 365 * 120;

            const query = `
                SELECT
                    ageGroups.ageGroup,
                    treatments.treatment,
                    IFNULL(COUNT(appointments.treatment), 0) AS count
                FROM (
                    SELECT '0-1' AS ageGroup
                    UNION SELECT '1-4'
                    UNION SELECT '5-14'
                    UNION SELECT '15-120'
                ) ageGroups
                CROSS JOIN (
                    SELECT DISTINCT treatment AS treatment
                    FROM appointments
                    WHERE YEAR(appointments.date) = ? AND MONTH(appointments.date) = ?
                ) treatments
                LEFT JOIN (
                    SELECT 
                        '0-1' AS ageGroup,
                        patients.file AS file
                    FROM patients
                    WHERE DATEDIFF(CURRENT_DATE(), patients.dateOfBirth) BETWEEN ? AND ?
                    UNION ALL
                    SELECT
                        '1-4' AS ageGroup,
                        patients.file AS file
                    FROM patients
                    WHERE DATEDIFF(CURRENT_DATE(), patients.dateOfBirth) BETWEEN ? AND ?
                    UNION ALL
                    SELECT
                        '5-14' AS ageGroup,
                        patients.file AS file
                    FROM patients
                    WHERE DATEDIFF(CURRENT_DATE(), patients.dateOfBirth) BETWEEN ? AND ?
                    UNION ALL
                    SELECT
                        '15-120' AS ageGroup,
                        patients.file AS file
                    FROM patients
                    WHERE DATEDIFF(CURRENT_DATE(), patients.dateOfBirth) BETWEEN ? AND ?
                ) AS filteredPatients
                ON ageGroups.ageGroup = filteredPatients.ageGroup
                LEFT JOIN (
                    SELECT
                        patientFile,
                        treatment
                    FROM appointments
                    WHERE 
                        YEAR(appointments.date) = ? AND 
                        MONTH(appointments.date) = ? AND
                        NOT appointments.firstName = 'x' AND 
                        NOT appointments.treatment = '' AND
                        NOT appointments.patientFile = ''
                ) AS appointments
                ON filteredPatients.file = appointments.patientFile
                AND treatments.treatment = appointments.treatment
                GROUP BY ageGroups.ageGroup, treatments.treatment
                ORDER BY treatments.treatment
            `;
            const params = [ 
                year,
                month,
                minPatientAgeInDaysForAgeGroup0To1, 
                maxPatientAgeInDaysForAgeGroup0To1, 
                minPatientAgeInDaysForAgeGroup1To4, 
                maxPatientAgeInDaysForAgeGroup1To4, 
                minPatientAgeInDaysForAgeGroup5To14,
                maxPatientAgeInDaysForAgeGroup5To14,
                minPatientAgeInDaysForAgeGroup15To120,
                maxPatientAgeInDaysForAgeGroup15To120,
                year, 
                month, 
                minPatientAgeInDaysForAgeGroup0To1, 
                maxPatientAgeInDaysForAgeGroup15To120
            ];

            return pool.query(query, params)
                .then(res => res[0])
                .catch(error => logger.error(error));
        },

        countPatients(year, minPatientAge, maxPatientAge) {
            const query = `
                SELECT COUNT(DISTINCT appointments.patientFile) as amountOfAppointments
                FROM appointments
                JOIN patients ON patients.file = appointments.patientFile
                WHERE 
                    YEAR(appointments.date) = ? AND 
                    TIMESTAMPDIFF(YEAR, patients.dateOfBirth, CURDATE()) >= ? AND 
                    TIMESTAMPDIFF(YEAR, patients.dateOfBirth, CURDATE()) < ?
            `;
            const params = [year, minPatientAge, maxPatientAge];
            return pool.query(query, params)
                .then(res => res[0])
                .catch(err => logger.error(err));
        }

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
    },
    dropAllTables() {
        pool.query(`drop table if exists appointments, treatments, users, patients, timeSlots, doctors, payments`)
            .then(() => console.log("All tables dropped successfully"))
            .catch(error => console.log(error));
    },
    import() {
        const filePath = "../database backup/rodion_drwatsondental (4).sql";

        // Make SQL import faster
        // const fs = require("fs");
        // fs.readFile(filePath, "utf8", (error, data) => {
        //     if (error) 
        //         console.log("Error reading file " + error)
        //     else {
        //         const lineToPrepend = `
        //             SET autocommit=0;
        //             SET unique_checks=0;
        //             SET foreign_key_checks=0;
        //         `;
        //         const lineToAppend = `
        //             COMMIT;
        //             SET unique_checks=1;
        //             SET foreign_key_checks=1;
        //         `;
        //         const newContent = lineToPrepend + "\n" + data + "\n" + lineToAppend;
        //         fs.writeFile(filePath, newContent, error => {
        //             if (error) 
        //                 console.log("Error writing file " + error);
        //             else 
        //                 console.log("File written successfully");
        //         })
        //     }
        // });

        const Importer = require('mysql-import');

        const importer = new Importer({
            host: process.env.DATABASE_HOST,
            user: process.env.DATABASE_USER,
            password: process.env.DATABASE_PASSWORD,
            database: process.env.DATABASE_DATABASE_NAME, 
        });

        importer.onProgress(progress=>{
            var percent = Math.floor(progress.bytes_processed / progress.total_bytes * 10000) / 100;
            console.log(`${percent}% Completed`);
        });

        importer.import(filePath)
            .then(() => {
                var files_imported = importer.getImported();
                console.log(`${files_imported.length} SQL file(s) imported.`);})
            .catch(err => {
                console.error(err);
            });
    }
}




module.exports = { database };
