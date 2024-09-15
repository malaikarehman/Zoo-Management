const bcrypt = require('bcryptjs');
const { db, dbQuery } = require('../db');const fs = require('fs');
const path = require('path');

function processBooking(sessionId, data, res, sessions) {
    const userId = sessions[sessionId]?.userId;
    if (!userId) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('User must be logged in to make a booking');
        return;
    }

    const bookingDate = data.get('bookingDate');
    const ticketType = data.get('ticketType');
    const hotelRoom = data.get('hotelRoom');
    const cardNumber = data.get('cardNumber');
    const expiryDate = data.get('expiryDate');
    const cvc = data.get('cvc');

    const checkAvailabilityQuery = `
        SELECT COUNT(*) AS booked_count
        FROM bookings
        WHERE booking_date = ? AND hotel_room = ?
    `;

    db.query(checkAvailabilityQuery, [bookingDate, hotelRoom], (err, results) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Failed to check room availability');
            return;
        }

        db.query('SELECT total_count, available_count FROM rooms WHERE room_type = ?', [hotelRoom], (err, roomResults) => {
            if (err) {
                console.error("Database error:", err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Failed to retrieve room details');
                return;
            }

            if (roomResults.length === 0) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('No available rooms of the selected type found');
                return;
            }

            const { total_count, available_count } = roomResults[0];
            const availableRooms = total_count - results[0].booked_count;

            if (availableRooms > 0) {
                const insertQuery = `
                    INSERT INTO bookings
                    (user_id, booking_date, ticket_type, hotel_room, card_number, expiry_date, cvc, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'Confirmed')
                `;
                db.query(insertQuery, [userId, bookingDate, ticketType, hotelRoom, cardNumber, expiryDate, cvc], async (err, bookingResult) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Failed to process your booking');
                        return;
                    }

                    // Update loyalty points
                    try {
                        await updateLoyaltyPoints(userId, getPointsForTicketType(ticketType));
                        res.writeHead(302, { 'Location': '/dashboard' }); // Redirect to dashboard after successful booking
                        res.end();
                    } catch (error) {
                        console.error('Failed to update loyalty points:', error);
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Failed to update loyalty points');
                    }
                });
            } else {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('No available rooms of the selected type on the selected date');
            }
        });
    });
}

function getPointsForTicketType(ticketType) {
    const points = {
        'single': 100,
        'family': 300,
        'group': 500
    };
    return points[ticketType] || 0;
}

async function updateLoyaltyPoints(userId, pointsToAdd) {
    const sql = `
        INSERT INTO loyalty_points (user_id, points)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE points = points + VALUES(points);
    `;
    await db.query(sql, [userId, pointsToAdd]);  // Assuming db.query is promisified
}



function fetchBookings(userId, isAdmin, callback) {
    let query;
    if (isAdmin) {
        query = 'SELECT * FROM bookings';  // Fetch all bookings for admin
    } else {
        query = 'SELECT * FROM bookings WHERE user_id = ?';  // Fetch bookings for specific user
    }

    db.query(query, isAdmin ? [] : [userId], (err, results) => {
        if (err) {
            return callback(err, null);
        }
        return callback(null, results);
    });
}



function renderBookingDetails(bookingId, res) {
    // Query the database to get details for the specific booking ID
    
    db.query('SELECT * FROM bookings WHERE booking_id = ?', [bookingId], (err, results) => {
        if (err || results.length === 0) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>Internal Server Error or Booking Not Found</h1>');
            return;
        }
        
        const booking = results[0];
        const responseHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>View Booking - Riget Zoo Adventures</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f4f4f4;
                    margin: 0;
                    padding: 0;
                    color: #333;
                }
                header {
                    background-color: #007bff;
                    color: white;
                    padding: 10px 20px;
                    text-align: center;
                }
                .container {
                    width: 80%;
                    margin: 40px auto;
                    background: white;
                    padding: 20px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                }
                .card {
                    background: white;
                    border: 1px solid #ccc;
                    margin-top: 20px;
                    padding: 20px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                .card-header {
                    background: #007bff;
                    color: white;
                    padding: 10px;
                    font-size: 20px;
                }
                .card-title {
                    font-size: 24px;
                }
                .card-text, li {
                    font-size: 16px;
                    line-height: 1.6;
                }
                .list-group {
                    list-style: none;
                    padding: 0;
                    margin-top: 20px;
                }
                .list-group-item {
                    background: none;
                    border: none;
                    padding: 5px 0;
                }
                .btn {
                    display: inline-block;
                    padding: 10px 20px;
                    margin-top: 20px;
                    background-color: #007bff;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    text-align: center;
                }
                .btn:hover {
                    background-color: #0056b3;
                }
                .badge {
                    display: inline-block;
                    padding: 5px 10px;
                    background-color: #28a745;
                    color: white;
                    border-radius: 5px;
                }
                header {
                    background-color: #f8f9fa;
                    padding: 10px 20px;
                    text-align: left;
                }
                header a {
                    text-decoration: none;
                    color: #007bff;
                }
                header h1 {
                    margin: 0;
                }
            </style>
        </head>
        <body>
            <header>
                <a href="/home.html">
                    <h1>Riget Zoo Adventures</h1>
                </a>
            </header>
        
            <div class="container">
                <h1>Booking Details</h1>
                <div class="card">
                    <div class="card-header">
                    Booking #${booking.booking_id}
                    </div>
                    <div class="card-body">
                        <h5 class="card-title">Safari Adventure</h5>
                        <p class="card-text">Some details about the adventure...</p>
                        <ul class="list-group">
                            <li class="list-group-item"><strong>Type:</strong> ${booking.ticket_type}</li>
                            <li class="list-group-item"><strong>Date:</strong> ${booking.booking_date}</li>
                            <li class="list-group-item"><strong>Hotel Room:</strong> ${booking.hotel_room}</li>
                            <li class="list-group-item"><strong>Status:</strong> <span class="">${booking.status}</span></li>
                        </ul>
                        <a href="/dashboard" class="btn">Go back to Dashboard</a>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(responseHTML);
    });
}





function isValidSession(req) {
    const cookies = parseCookies(req);
    const sessionId = cookies['sessionId'];
    return sessionId && sessions[sessionId]; // Assuming `sessions` is where you store session data
}




async function cancelBooking(bookingId, res) {
    try {
        // Query to delete the booking from the database
        const result = await dbQuery('DELETE FROM bookings WHERE booking_id = ?', [bookingId]);
        
        if (result.affectedRows === 0) {
            // No rows affected means no booking was found with that ID
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>Booking not found</h1>');
        } else {
            // If the booking was successfully deleted, redirect to the dashboard
            res.writeHead(302, { 'Location': '/dashboard' });
            res.end();
        }
    } catch (error) {
        console.error('Failed to cancel booking:', error);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>Internal Server Error</h1>');
    }
}

function renderRescheduleForm(bookingId, res) {
    const query = 'SELECT * FROM bookings WHERE booking_id = ?';
    db.query(query, [bookingId], (err, results) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>Internal Server Error</h1>');
            return;
        }
        if (results.length === 0) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>Booking not found</h1>');
            return;
        }
        const booking = results[0];
        fs.readFile(path.join(__dirname, '../public', 'booking-reschedule.html'), 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('<h1>Internal Server Error</h1>');
                return;
            }
            const formattedDate = booking.booking_date.toISOString().split('T')[0];
            // Replace placeholders in the HTML with actual booking details
            data = data.replace(/{{bookingId}}/g, booking.booking_id)
            .replace(/{{bookingDate}}/g, formattedDate);
            // Assume booking.ticket_type and booking.hotel_room contain the values from the database.
data = data.replace(/{{ticketTypeOptions}}/g, `
<option value="single" ${booking.ticket_type === 'single' ? 'selected' : ''}>Single Ticket</option>
<option value="family" ${booking.ticket_type === 'family' ? 'selected' : ''}>Family Pack</option>
<option value="group" ${booking.ticket_type === 'group' ? 'selected' : ''}>Group Ticket</option>
`);

data = data.replace(/{{hotelRoomOptions}}/g, `
<option value="standard" ${booking.hotel_room === 'standard' ? 'selected' : ''}>Standard Room</option>
<option value="deluxe" ${booking.hotel_room === 'deluxe' ? 'selected' : ''}>Deluxe Room</option>
<option value="suite" ${booking.hotel_room === 'suite' ? 'selected' : ''}>Suite</option>
`);

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    });
}



function updateBookingDetails(bookingId, parsedBody, res) {
    const newDate = parsedBody.get('newDate');
    const ticketType = parsedBody.get('ticketType');
    const hotelRoom = parsedBody.get('hotelRoom');

    const updateQuery = `
        UPDATE bookings
        SET booking_date = ?, ticket_type = ?, hotel_room = ?
        WHERE booking_id = ?;
    `;

    db.query(updateQuery, [newDate, ticketType, hotelRoom, bookingId], (err, result) => {
        if (err) {
            console.error('Error updating booking:', err); // More detailed error logging
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Failed to update booking');
            return;
        }
        // Success: Redirect to dashboard
        res.writeHead(302, { 'Location': '/dashboard' });
        res.end();
    });
}

module.exports = { processBooking , fetchBookings,renderBookingDetails,isValidSession,cancelBooking,renderRescheduleForm,updateBookingDetails};