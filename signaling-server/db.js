const mysql = require('mysql2');

// Create a connection to MySQL (without specifying database initially)
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'dhoni@111'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('✅ Connected to MySQL database');

    initializeDatabase();
});

const initializeDatabase = () => {
    db.query('CREATE DATABASE IF NOT EXISTS meeting_management', (err) => {
        if (err) {
            console.error('❌ Error creating database:', err);
            return;
        }
        console.log('✅ Database ensured');

        // Change to the newly created database
        db.changeUser({ database: 'meeting_management' }, (err) => {
            if (err) {
                console.error('❌ Error switching to database:', err);
                return;
            }

            console.log('✅ Using database: meeting_management');

            // List of table creation queries
            const tables = [
                `CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL
                )`,

                `CREATE TABLE IF NOT EXISTS meetings (
                    meeting_id INT AUTO_INCREMENT PRIMARY KEY,
                    topic VARCHAR(255) NOT NULL,
                    start_time DATETIME NOT NULL,
                    end_time DATETIME NOT NULL,
                    duration INT NOT NULL,
                    participants JSON DEFAULT NULL
                )`,

                `CREATE TABLE IF NOT EXISTS user_meetings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    meeting_id INT NOT NULL,
                    participants JSON DEFAULT NULL,
                    start_time DATETIME NOT NULL,
                    end_time DATETIME NOT NULL,
                    duration INT NOT NULL,
                    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
                )`,

                `CREATE TABLE IF NOT EXISTS user_service_feedback (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    homeowner_userid INT NOT NULL,
                    serviceprovider_userid INT NOT NULL,
                    rating ENUM('1', '2', '3') NOT NULL,
                    primary_reason JSON DEFAULT NULL
                )`,

                `CREATE TABLE IF NOT EXISTS meeting_chats (
                    chat_id INT AUTO_INCREMENT PRIMARY KEY,
                    meeting_id INT NOT NULL,
                    user_id INT NOT NULL,
                    messages JSON DEFAULT NULL,
                    attachments JSON DEFAULT NULL,
                    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )`
            ];

            // Execute each table creation query separately
            tables.forEach((query) => {
                db.query(query, (err) => {
                    if (err) {
                        console.error('❌ Error creating table:', err);
                    } else {
                        console.log('✅ Table ensured:', query.split(' ')[5]); // Logs table name
                    }
                });
            });
        });
    });
};

module.exports = db;

