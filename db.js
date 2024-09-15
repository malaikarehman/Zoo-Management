const bcrypt = require('bcryptjs');
const mysql = require('mysql');
const util = require('util');

// Create and connect the database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'malaika123',
    database: 'zoo'
});

db.connect(err => {
    if (err) throw err;
    console.log('Connected to the database.');
    createUsersTable();
    Tables();
});

// Promisify the db.query function after db is initialized
const dbQuery = util.promisify(db.query).bind(db);

function createUsersTable() {
    const sql = `
        CREATE TABLE IF NOT EXISTS users ( id INT AUTO_INCREMENT PRIMARY KEY,username VARCHAR(100) NOT NULL UNIQUE,email VARCHAR(100) NOT NULL UNIQUE,password VARCHAR(255) NOT NULL,
            role VARCHAR(255)
        )`;
    db.query(sql, err => {
        if (err) throw err;
        console.log("Table 'users' is ready.");
    });
}

function Tables() {
    const createRoomsTable = `
        CREATE TABLE IF NOT EXISTS rooms (room_type VARCHAR(50) PRIMARY KEY,total_count INT NOT NULL,available_count INT NOT NULL);
    `;

    const createBookingsTable = `
        CREATE TABLE IF NOT EXISTS bookings ( booking_id INT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL,booking_date DATE NOT NULL,ticket_type VARCHAR(50) NOT NULL,hotel_room VARCHAR(50) NOT NULL,card_number VARCHAR(20) NOT NULL,expiry_date VARCHAR(5) NOT NULL,cvc VARCHAR(4) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'Pending',FOREIGN KEY (hotel_room) REFERENCES rooms(room_type),FOREIGN KEY (user_id) REFERENCES users(id));
    `;

    const loyalityTable ="CREATE TABLE IF NOT EXISTS loyalty_points (user_id INT NOT NULL,points INT DEFAULT 0,PRIMARY KEY (user_id),FOREIGN KEY (user_id) REFERENCES users(id));";

    db.query(createRoomsTable, function(err) {
        if (err) {
            console.error("Failed to create rooms table:", err);
            return;
        }
        console.log("Rooms table created or already exists.");
        db.query(createBookingsTable, function(err) {
            if (err) {
                console.error("Failed to create bookings table:", err);
                return;
            }
            console.log("Bookings table created or already exists.");
            db.query(loyalityTable, function(err) {
                if (err) {
                    console.error("Failed to create bookings table:", err);
                    return;
                }
                console.log("loyality table created or already exists.");
            });
        });
    });
    insert();
}

async function insert() {
    try {
        // Deleting previous data
        await dbQuery("DELETE FROM users");
        await dbQuery("DELETE FROM rooms");
        await dbQuery("DELETE FROM bookings");
        await dbQuery("DELETE FROM loyalty_points");

        console.log("All previous data deleted.");

        // Inserting rooms
        const roomsSql = "INSERT INTO rooms (room_type, total_count, available_count) VALUES ('standard', 20, 20), ('deluxe', 15, 15), ('suite', 5, 5)";
        await dbQuery(roomsSql);
        console.log("Rooms inserted.");

        // Inserting users with hashed passwords
        const users = [
            { username: 'Admin', email: 'admin@gmail.com', password: 'password123', role: 'admin' },
            { username: 'UserOne', email: 'userone@gmail.com', password: 'password456', role: 'customer' }
        ];
        for (const user of users) {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            const insertUserSql = "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)";
            await dbQuery(insertUserSql, [user.username, user.email, hashedPassword, user.role]);
            console.log(`User ${user.username} inserted successfully.`);
        }

        // Inserting dummy bookings
        const dummyBookings = `
            INSERT INTO bookings (user_id, booking_date, ticket_type, hotel_room, card_number, expiry_date, cvc, status) VALUES
            (2, '2024-04-25', 'family', 'standard', '4111111111111111', '12/25', '123', 'Confirmed'),
            (2, '2024-04-26', 'single', 'deluxe', '4222222222222222', '01/26', '234', 'Pending'),
            (2, '2024-04-27', 'group', 'suite', '4333333333333333', '02/27', '345', 'Cancelled');
        `;
        await dbQuery(dummyBookings);
        console.log("Dummy bookings inserted.");

        // Calculating and inserting/updating loyalty points
        const points = {
            'single': 10,
            'family': 50,
            'group': 100
        };
        const totalPoints = points['family'] + points['single'] + points['group']; // Calculate total points from bookings
        const loyaltySql = "INSERT INTO loyalty_points (user_id, points) VALUES (2, ?) ON DUPLICATE KEY UPDATE points = points + ?";
        await dbQuery(loyaltySql, [totalPoints, totalPoints]);
        console.log("Loyalty points updated for user 2.");

    } catch (err) {
        console.error("Failed to complete database setup:", err);
    }
}


module.exports = {db,dbQuery};
